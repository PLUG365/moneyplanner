import {
    collection,
    deleteDoc,
    deleteField,
    doc,
    getDoc,
    getDocs,
    getFirestore,
    onSnapshot,
    query,
    serverTimestamp,
    setDoc,
    where,
    writeBatch,
} from "@react-native-firebase/firestore";
import { getHouseholdDeletionCollectionNames } from "./accountDeletion";
import { getCurrentUser } from "./auth";
import { getSnapshotDataOrNull } from "./firestoreSnapshot";
import {
    normalizeJoinDisplayName,
    validateJoinDisplayName,
} from "./householdJoinRequestValidation";
import {
    isActiveHouseholdMember,
    mapHouseholdMember,
} from "./householdMembership";
import {
    buildInviteCodeExpiryDate,
    createReplacementInviteCode,
    isInviteCodeFormat,
    resolveInviteCodeState,
} from "./inviteCode";
import { createSecureInviteCode } from "./inviteCodeSecure";
import {
    buildInviteJoinFailurePatch,
    buildInviteJoinResetPatch,
    getInviteJoinCooldownRemainingMs,
    isInviteJoinCooldownActive,
    parseInviteJoinAttemptState,
} from "./inviteJoinRateLimit";

export interface HouseholdMember {
  uid: string;
  displayName: string;
  removed?: boolean;
}

export interface HouseholdJoinRequest {
  uid: string;
  displayName: string;
  status: "pending" | "approved" | "rejected";
}

export interface HouseholdInviteCodeInfo {
  code: string;
  expiresAt: Date | null;
  state: "active" | "expired" | "disabled";
}

function isPermissionDeniedError(error: unknown): boolean {
  if (error == null) return false;

  const asRecord =
    typeof error === "object"
      ? (error as { code?: unknown; message?: unknown })
      : null;

  const code =
    typeof asRecord?.code === "string"
      ? asRecord.code
      : error instanceof Error &&
          typeof (error as Error & { code?: unknown }).code === "string"
        ? String((error as Error & { code?: unknown }).code)
        : "";

  const message =
    typeof asRecord?.message === "string"
      ? asRecord.message
      : error instanceof Error
        ? String(error.message ?? "")
        : typeof error === "string"
          ? error
          : "";

  return /permission[-_ ]denied|PERMISSION_DENIED|insufficient permissions/i.test(
    `${code} ${message}`,
  );
}

function parseTimestampLikeToDate(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value);
  }
  if (typeof value === "string") {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? null : new Date(ms);
  }
  if (typeof value === "object") {
    const maybeTimestamp = value as {
      toDate?: () => Date;
      toMillis?: () => number;
    };
    if (typeof maybeTimestamp.toDate === "function") {
      const date = maybeTimestamp.toDate();
      return date instanceof Date ? date : null;
    }
    if (typeof maybeTimestamp.toMillis === "function") {
      const ms = maybeTimestamp.toMillis();
      return Number.isFinite(ms) ? new Date(ms) : null;
    }
  }
  return null;
}

/**
 * 新しい世帯を作成し、現在のユーザーを紐付ける
 */
export async function createHousehold(displayName: string): Promise<string> {
  const user = getCurrentUser();
  if (!user) throw new Error("未ログインです");

  const normalizedDisplayName = normalizeJoinDisplayName(displayName);
  const validationError = validateJoinDisplayName(normalizedDisplayName);
  if (validationError) {
    throw new Error(validationError);
  }

  const currentUserDoc = await getDoc(doc(getFirestore(), "users", user.uid));
  const currentUserData = getSnapshotDataOrNull(currentUserDoc);
  if (typeof currentUserData?.pendingHouseholdId === "string") {
    throw new Error(
      "承認待ちの参加リクエストがあります。承認されるまでお待ちください。",
    );
  }

  const inviteCode = createReplacementInviteCode(
    undefined,
    createSecureInviteCode,
  );

  const householdRef = doc(collection(getFirestore(), "households"));
  const householdId = householdRef.id;

  const batch = writeBatch(getFirestore());

  batch.set(householdRef, {
    createdBy: user.uid,
    inviteCode,
    createdAt: serverTimestamp(),
  });

  batch.set(doc(getFirestore(), "inviteCodes", inviteCode), {
    householdId,
    createdBy: user.uid,
    createdAt: serverTimestamp(),
    expiresAt: buildInviteCodeExpiryDate(),
    disabledAt: null,
  });

  batch.set(doc(getFirestore(), "users", user.uid), {
    householdId,
    displayName: normalizedDisplayName,
    createdAt: serverTimestamp(),
  });

  batch.set(doc(collection(householdRef, "members"), user.uid), {
    displayName: normalizedDisplayName,
    joinedAt: serverTimestamp(),
  });

  await batch.commit();

  return inviteCode;
}

/**
 * 招待コードで世帯参加リクエストを作成する
 */
export async function requestJoinHousehold(
  inviteCode: string,
  displayName: string,
): Promise<string> {
  try {
    const user = getCurrentUser();
    if (!user) throw new Error("未ログインです");

    const userRef = doc(getFirestore(), "users", user.uid);
    const currentUserDoc = await getDoc(userRef);
    const currentUserData = getSnapshotDataOrNull(currentUserDoc);
    if (typeof currentUserData?.pendingHouseholdId === "string") {
      throw new Error(
        "承認待ちの参加リクエストがあります。承認されるまでお待ちください。",
      );
    }

    const attemptState = parseInviteJoinAttemptState(currentUserData ?? {});
    if (isInviteJoinCooldownActive(attemptState)) {
      const remainingMs = getInviteJoinCooldownRemainingMs(attemptState);
      const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 60000));
      throw new Error(
        `招待コードの試行回数が上限に達しました。${remainingMinutes}分後に再試行してください。`,
      );
    }

    const failJoinAttempt = async (message: string): Promise<never> => {
      const failurePatch = buildInviteJoinFailurePatch(attemptState);
      await setDoc(
        userRef,
        {
          inviteJoinFailedAttempts: failurePatch.failedAttempts,
          inviteJoinLastFailedAt: serverTimestamp(),
          inviteJoinCooldownUntil:
            failurePatch.cooldownUntil === null
              ? deleteField()
              : failurePatch.cooldownUntil,
        },
        { merge: true },
      );

      throw new Error(message);
    };

    const normalizedName = normalizeJoinDisplayName(displayName);
    const validationError = validateJoinDisplayName(normalizedName);
    if (validationError) {
      throw new Error(validationError);
    }

    const code = inviteCode.trim().toUpperCase();
    if (!isInviteCodeFormat(code)) {
      return failJoinAttempt("招待コードの形式が正しくありません");
    }

    const inviteDoc = await getDoc(doc(getFirestore(), "inviteCodes", code));
    const inviteData = getSnapshotDataOrNull(inviteDoc);
    const householdId = inviteData?.householdId;
    if (!householdId) {
      return failJoinAttempt("招待コードが見つかりません");
    }

    const inviteState = resolveInviteCodeState(inviteData ?? {});
    if (inviteState === "disabled") {
      return failJoinAttempt(
        "この招待コードは無効です。最新のコードを確認してください。",
      );
    }
    if (inviteState === "expired") {
      return failJoinAttempt(
        "この招待コードは有効期限切れです。再発行を依頼してください。",
      );
    }

    if (currentUserData?.householdId === householdId) {
      throw new Error("すでにこの世帯に参加しています");
    }

    const resetPatch = buildInviteJoinResetPatch();
    const batch = writeBatch(getFirestore());

    const joinRequestData = {
      uid: user.uid,
      displayName: normalizedName,
      inviteCode: code,
      status: "pending",
      requestedAt: serverTimestamp(),
      reviewedAt: deleteField(),
      reviewedBy: deleteField(),
    };

    batch.set(
      doc(getFirestore(), "households", householdId, "joinRequests", user.uid),
      joinRequestData,
      { merge: true },
    );
    batch.set(
      userRef,
      {
        inviteJoinFailedAttempts: resetPatch.failedAttempts,
        inviteJoinCooldownUntil: deleteField(),
        pendingHouseholdId: householdId,
      },
      { merge: true },
    );

    await batch.commit();
    return householdId;
  } catch (error) {
    if (isPermissionDeniedError(error)) {
      throw new Error(
        "参加リクエストの送信に失敗しました。作成者側の設定画面で参加リクエスト状態を確認し、必要なら招待コードを再発行してから再試行してください。",
      );
    }
    throw error;
  }
}

export async function getPendingJoinRequests(
  householdId: string,
): Promise<HouseholdJoinRequest[]> {
  const snapshot = await getDocs(
    collection(getFirestore(), "households", householdId, "joinRequests"),
  );

  return snapshot.docs
    .map((doc) => ({
      uid: doc.id,
      displayName: String(doc.data().displayName ?? ""),
      status:
        doc.data().status === "approved" || doc.data().status === "rejected"
          ? doc.data().status
          : "pending",
    }))
    .filter((request) => request.status === "pending");
}

export async function approveJoinRequest(
  householdId: string,
  requestUserId: string,
): Promise<void> {
  const user = getCurrentUser();
  if (!user) throw new Error("未ログインです");

  const householdRef = doc(getFirestore(), "households", householdId);
  const requestRef = doc(
    collection(householdRef, "joinRequests"),
    requestUserId,
  );
  const memberRef = doc(collection(householdRef, "members"), requestUserId);

  const requestSnap = await getDoc(requestRef);
  const requestData = getSnapshotDataOrNull(requestSnap);
  if (!requestData || requestData.status !== "pending") {
    throw new Error("承認対象の参加リクエストが見つかりません");
  }

  // 参加は承認制のため、退出/解除済みユーザーの再参加も既存メンバーの承認に
  // 委ねる（再参加抑止フラグは2026-07-04に廃止。過去データの rejoinDisabled は無視し、
  // 承認時に removedAt をクリアして再参加させる。build 26 発見事項 #1）。
  const displayName = normalizeJoinDisplayName(
    String(requestData.displayName ?? ""),
  );
  const validationError = validateJoinDisplayName(displayName);
  if (validationError) {
    throw new Error(validationError);
  }

  const batch = writeBatch(getFirestore());
  batch.set(
    memberRef,
    {
      displayName,
      joinedAt: serverTimestamp(),
      removedAt: deleteField(),
    },
    { merge: true },
  );
  batch.set(
    requestRef,
    {
      status: "approved",
      reviewedAt: serverTimestamp(),
      reviewedBy: user.uid,
    },
    { merge: true },
  );

  await batch.commit();
}

export async function completeJoinAfterApproval(
  householdId: string,
  displayName: string,
): Promise<void> {
  const user = getCurrentUser();
  if (!user) throw new Error("未ログインです");

  const requestRef = doc(
    getFirestore(),
    "households",
    householdId,
    "joinRequests",
    user.uid,
  );
  const requestSnap = await getDoc(requestRef);
  const requestData = getSnapshotDataOrNull(requestSnap);
  if (!requestData || requestData.status !== "approved") {
    throw new Error("参加リクエストがまだ承認されていません");
  }

  const normalizedDisplayName = normalizeJoinDisplayName(
    String(requestData.displayName ?? displayName),
  );
  const validationError = validateJoinDisplayName(normalizedDisplayName);
  if (validationError) {
    throw new Error(validationError);
  }

  await setDoc(
    doc(getFirestore(), "users", user.uid),
    {
      householdId,
      displayName: normalizedDisplayName,
      pendingHouseholdId: deleteField(),
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export function watchJoinRequestApproval(
  householdId: string,
  onApproved: (displayName: string) => void,
  onRejected: () => void,
  onCanceled: () => void = onRejected,
): () => void {
  const user = getCurrentUser();
  if (!user) return () => {};

  const ref = doc(
    getFirestore(),
    "households",
    householdId,
    "joinRequests",
    user.uid,
  );

  return onSnapshot(ref, (snap) => {
    const data = getSnapshotDataOrNull(snap);
    if (!data) {
      onCanceled();
      return;
    }
    if (data.status === "approved") {
      onApproved(String(data.displayName ?? ""));
    } else if (data.status === "rejected") {
      onRejected();
    }
  });
}

export async function cancelJoinRequest(householdId: string): Promise<void> {
  const user = getCurrentUser();
  if (!user) throw new Error("未ログインです");

  const userRef = doc(getFirestore(), "users", user.uid);
  const requestRef = doc(
    getFirestore(),
    "households",
    householdId,
    "joinRequests",
    user.uid,
  );

  const requestSnap = await getDoc(requestRef);
  const requestData = getSnapshotDataOrNull(requestSnap);
  if (requestData?.status === "approved") {
    throw new Error("すでに承認済みのためキャンセルできません");
  }

  const batch = writeBatch(getFirestore());
  if (requestData) {
    batch.delete(requestRef);
  }
  batch.set(
    userRef,
    {
      pendingHouseholdId: deleteField(),
    },
    { merge: true },
  );

  await batch.commit();
}

export async function getPendingHouseholdId(): Promise<string | null> {
  const user = getCurrentUser();
  if (!user) return null;

  const userSnap = await getDoc(doc(getFirestore(), "users", user.uid));
  const userData = getSnapshotDataOrNull(userSnap);
  const householdId = userData?.pendingHouseholdId;
  return typeof householdId === "string" && householdId.length > 0
    ? householdId
    : null;
}

export async function clearPendingHouseholdId(): Promise<void> {
  const user = getCurrentUser();
  if (!user) throw new Error("未ログインです");

  await setDoc(
    doc(getFirestore(), "users", user.uid),
    {
      pendingHouseholdId: deleteField(),
    },
    { merge: true },
  );
}

/**
 * 世帯未参加ユーザー自身の users/{uid} プロフィールを削除する。
 * 世帯設定画面からのアカウント削除（App Store Guideline 5.1.1(v) 対応）の
 * 前処理として使う。世帯参加中のユーザーには使わない（世帯データが
 * 孤児化するため、設定画面の全データ削除フローを使う）。
 */
export async function deleteCurrentUserProfileWithoutHousehold(): Promise<void> {
  const user = getCurrentUser();
  if (!user) throw new Error("未ログインです");

  if (await getHouseholdId()) {
    throw new Error(
      "世帯参加中はこの画面からアカウント削除できません。設定画面の「アカウントを削除」を使ってください。",
    );
  }

  // 承認待ちの参加リクエストが残っていれば先に取り下げる。
  // 失敗しても続行する（users 削除で pendingHouseholdId 自体は消え、
  // 相手世帯に残ったリクエストは世帯側で却下できる）。
  const pendingHouseholdId = await getPendingHouseholdId();
  if (pendingHouseholdId) {
    await cancelJoinRequest(pendingHouseholdId).catch(() => undefined);
  }

  await deleteDoc(doc(getFirestore(), "users", user.uid));
}

export async function rejectJoinRequest(
  householdId: string,
  requestUserId: string,
): Promise<void> {
  const user = getCurrentUser();
  if (!user) throw new Error("未ログインです");

  const requestRef = doc(
    getFirestore(),
    "households",
    householdId,
    "joinRequests",
    requestUserId,
  );

  const requestSnap = await getDoc(requestRef);
  const requestData = getSnapshotDataOrNull(requestSnap);
  if (!requestData || requestData.status !== "pending") {
    throw new Error("却下対象の参加リクエストが見つかりません");
  }

  await setDoc(
    requestRef,
    {
      status: "rejected",
      reviewedAt: serverTimestamp(),
      reviewedBy: user.uid,
    },
    { merge: true },
  );
}

/**
 * 現在のユーザーの世帯IDを取得
 */
export async function getHouseholdId(): Promise<string | null> {
  const user = getCurrentUser();
  if (!user) return null;

  const userSnap = await getDoc(doc(getFirestore(), "users", user.uid));
  const userData = getSnapshotDataOrNull(userSnap);
  if (!userData) return null;

  const householdId = userData.householdId;
  if (!householdId) return null;

  const memberDoc = await getDoc(
    doc(getFirestore(), "households", householdId, "members", user.uid),
  );

  if (!isActiveHouseholdMember(memberDoc.data())) {
    await setDoc(
      doc(getFirestore(), "users", user.uid),
      {
        householdId: deleteField(),
      },
      { merge: true },
    );
    return null;
  }

  return householdId;
}

/**
 * 世帯の招待コードを取得
 */
export async function getInviteCode(
  householdId: string,
): Promise<string | null> {
  const householdSnap = await getDoc(
    doc(getFirestore(), "households", householdId),
  );
  const data = getSnapshotDataOrNull(householdSnap);
  if (!data) return null;

  return data.inviteCode ?? null;
}

/**
 * 世帯の招待コードと有効期限情報を取得
 */
export async function getInviteCodeInfo(
  householdId: string,
): Promise<HouseholdInviteCodeInfo | null> {
  const code = await getInviteCode(householdId);
  if (!code) return null;

  const inviteCodeDoc = await getDoc(doc(getFirestore(), "inviteCodes", code));
  const inviteCodeData = getSnapshotDataOrNull(inviteCodeDoc);

  return {
    code,
    expiresAt: parseTimestampLikeToDate(inviteCodeData?.expiresAt),
    state: resolveInviteCodeState(inviteCodeData ?? {}),
  };
}

/**
 * 世帯の招待コードを再発行する
 */
export async function regenerateInviteCode(
  householdId: string,
): Promise<string> {
  const user = getCurrentUser();
  if (!user) throw new Error("未ログインです");

  const householdRef = doc(getFirestore(), "households", householdId);
  const householdSnap = await getDoc(householdRef);
  const householdData = getSnapshotDataOrNull(householdSnap);
  if (!householdData) {
    throw new Error("世帯が見つかりません");
  }

  const oldInviteCode = householdData.inviteCode;
  const nextInviteCode = createReplacementInviteCode(
    oldInviteCode,
    createSecureInviteCode,
  );

  const batch = writeBatch(getFirestore());
  batch.update(householdRef, {
    inviteCode: nextInviteCode,
    inviteCodeUpdatedAt: serverTimestamp(),
  });
  if (oldInviteCode) {
    batch.set(
      doc(getFirestore(), "inviteCodes", oldInviteCode),
      {
        disabledAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }
  batch.set(doc(getFirestore(), "inviteCodes", nextInviteCode), {
    householdId,
    createdBy: user.uid,
    createdAt: serverTimestamp(),
    expiresAt: buildInviteCodeExpiryDate(),
    disabledAt: null,
  });

  await batch.commit();
  return nextInviteCode;
}

/**
 * 世帯メンバー一覧を取得
 */
export async function getHouseholdMembers(
  householdId: string,
): Promise<HouseholdMember[]> {
  const snapshot = await getDocs(
    collection(getFirestore(), "households", householdId, "members"),
  );

  return snapshot.docs
    .map((doc) => mapHouseholdMember(doc.id, doc.data()))
    .filter((member) => !member.removed);
}

/**
 * 世帯メンバーを解除する
 * onProgress は最後の1人の退出（世帯全削除）時のみ呼ばれる。
 */
export async function removeHouseholdMember(
  householdId: string,
  userId: string,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const currentUser = getCurrentUser();
  if (!currentUser) throw new Error("未ログインです");

  const householdRef = doc(getFirestore(), "households", householdId);
  const membersRef = collection(householdRef, "members");
  const isSelf = currentUser.uid === userId;

  if (isSelf) {
    const membersSnap = await getDocs(membersRef);
    const activeMembers = membersSnap.docs.filter((doc) =>
      isActiveHouseholdMember(doc.data()),
    );

    // 最後のメンバー退出時は世帯ごと削除する。
    // members を先に消すと Security Rules の activeMember 資格を失い、
    // 以降の削除がすべて permission-denied になるため（build 26 発見事項 #2）、
    // データ → 招待コード → (members + 世帯ドキュメントを1バッチ) の順で消す。
    if (activeMembers.length <= 1) {
      const collectionNames = getHouseholdDeletionCollectionNames();
      // 進捗はドキュメント件数ベースで報告する（コレクション単位だと大量データの
      // 削除中にバーが止まって見える。build 27 実機報告）。
      const collectionSnaps = [];
      for (const name of collectionNames) {
        collectionSnaps.push(await getDocs(collection(householdRef, name)));
      }
      const inviteCodesSnap = await getDocs(
        query(
          collection(getFirestore(), "inviteCodes"),
          where("householdId", "==", householdId),
        ),
      );
      const totalDocs =
        collectionSnaps.reduce((sum, snap) => sum + snap.size, 0) +
        inviteCodesSnap.size +
        membersSnap.size +
        2; // 世帯ドキュメント + users.householdId クリア
      let doneDocs = 0;
      const reportProgress = () => onProgress?.(doneDocs, totalDocs);
      reportProgress();

      // データ → 招待コード → (members + 世帯ドキュメントを1バッチ) の順で消す。
      // members を先に消すと Security Rules の activeMember 資格を失い、
      // 以降の削除がすべて permission-denied になる（build 26 発見事項 #2）。
      for (const snap of [...collectionSnaps, inviteCodesSnap]) {
        const docs = snap.docs;
        for (let i = 0; i < docs.length; i += 499) {
          const batch = writeBatch(getFirestore());
          const chunk = docs.slice(i, i + 499);
          chunk.forEach((doc) => batch.delete(doc.ref));
          await batch.commit();
          doneDocs += chunk.length;
          reportProgress();
        }
      }

      // members と世帯ドキュメントは1バッチで削除する
      // （ルールはバッチ前の状態で評価されるため、まとめてなら消せる）。
      const finalBatch = writeBatch(getFirestore());
      finalBatch.delete(householdRef);
      membersSnap.docs.forEach((memberDoc) => finalBatch.delete(memberDoc.ref));
      await finalBatch.commit();
      doneDocs += membersSnap.size + 1;
      reportProgress();

      await setDoc(
        doc(getFirestore(), "users", currentUser.uid),
        {
          householdId: deleteField(),
        },
        { merge: true },
      );
      doneDocs += 1;
      reportProgress();
      return;
    }
  }

  await setDoc(
    doc(membersRef, userId),
    {
      removedAt: serverTimestamp(),
    },
    { merge: true },
  );

  // 自己退出時は自分の users.householdId も即時クリアする。
  // 残したままだと requestJoinHousehold の「すでにこの世帯に参加しています」
  // 判定に引っかかり、同じ世帯へ再参加できない（build 26 発見事項 #1）。
  // 他メンバーを解除した場合は対象者の users を書けないため、従来どおり
  // 対象者の次回起動時に getHouseholdId() がクリアする。
  if (isSelf) {
    await setDoc(
      doc(getFirestore(), "users", currentUser.uid),
      {
        householdId: deleteField(),
      },
      { merge: true },
    );
  }
}
