import firestore from "@react-native-firebase/firestore";
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
import { createStoredMemberProfile } from "./memberProfile";

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

  const currentUserDoc = await firestore()
    .collection("users")
    .doc(user.uid)
    .get();
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

  const householdRef = firestore().collection("households").doc();
  const householdId = householdRef.id;

  const batch = firestore().batch();

  batch.set(householdRef, {
    createdBy: user.uid,
    inviteCode,
    createdAt: firestore.FieldValue.serverTimestamp(),
  });

  batch.set(firestore().collection("inviteCodes").doc(inviteCode), {
    householdId,
    createdBy: user.uid,
    createdAt: firestore.FieldValue.serverTimestamp(),
    expiresAt: buildInviteCodeExpiryDate(),
    disabledAt: null,
  });

  batch.set(firestore().collection("users").doc(user.uid), {
    householdId,
    displayName: normalizedDisplayName,
    createdAt: firestore.FieldValue.serverTimestamp(),
  });

  batch.set(householdRef.collection("members").doc(user.uid), {
    displayName: normalizedDisplayName,
    joinedAt: firestore.FieldValue.serverTimestamp(),
  });

  await batch.commit();

  return inviteCode;
}

/**
 * 招待コードで既存の世帯に参加
 */
export async function joinHousehold(inviteCode: string): Promise<void> {
  const user = getCurrentUser();
  if (!user) throw new Error("未ログインです");

  const code = inviteCode.trim().toUpperCase();

  const inviteDoc = await firestore().collection("inviteCodes").doc(code).get();
  const inviteData = getSnapshotDataOrNull(inviteDoc);
  const householdId = inviteData?.householdId;

  if (!householdId) {
    throw new Error("招待コードが見つかりません");
  }

  const inviteState = resolveInviteCodeState(inviteData ?? {});
  if (inviteState === "disabled") {
    throw new Error(
      "この招待コードは無効です。最新のコードを確認してください。",
    );
  }
  if (inviteState === "expired") {
    throw new Error(
      "この招待コードは有効期限切れです。再発行を依頼してください。",
    );
  }

  const householdRef = firestore().collection("households").doc(householdId);
  const memberProfile = createStoredMemberProfile(user);
  const memberRef = householdRef.collection("members").doc(user.uid);

  // 参加前に最新の inviteCode を確認（レース条件防止）
  const householdSnap = await householdRef.get();
  const currentInviteCode = householdSnap.data()?.inviteCode;

  if (currentInviteCode !== code) {
    throw new Error("招待コードが無効です。再発行されている可能性があります。");
  }

  const memberSnap = await memberRef.get();
  const memberData = memberSnap.data();
  if (memberData?.rejoinDisabled === true || memberData?.removedAt != null) {
    throw new Error(
      "この世帯への再参加は制限されています。世帯管理者に確認してください。",
    );
  }

  const batch = firestore().batch();

  batch.set(firestore().collection("users").doc(user.uid), {
    householdId,
    displayName: memberProfile.displayName,
    createdAt: firestore.FieldValue.serverTimestamp(),
  });

  batch.set(
    memberRef,
    {
      displayName: memberProfile.displayName,
      joinedAt: firestore.FieldValue.serverTimestamp(),
      removedAt: firestore.FieldValue.delete(),
    },
    { merge: true },
  );

  await batch.commit();
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

    const userRef = firestore().collection("users").doc(user.uid);
    const currentUserDoc = await userRef.get();
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
      await userRef.set(
        {
          inviteJoinFailedAttempts: failurePatch.failedAttempts,
          inviteJoinLastFailedAt: firestore.FieldValue.serverTimestamp(),
          inviteJoinCooldownUntil:
            failurePatch.cooldownUntil === null
              ? firestore.FieldValue.delete()
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

    const inviteDoc = await firestore()
      .collection("inviteCodes")
      .doc(code)
      .get();
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
    const batch = firestore().batch();

    const joinRequestData = {
      uid: user.uid,
      displayName: normalizedName,
      inviteCode: code,
      status: "pending",
      requestedAt: firestore.FieldValue.serverTimestamp(),
      reviewedAt: firestore.FieldValue.delete(),
      reviewedBy: firestore.FieldValue.delete(),
    };

    batch.set(
      firestore()
        .collection("households")
        .doc(householdId)
        .collection("joinRequests")
        .doc(user.uid),
      joinRequestData,
      { merge: true },
    );
    batch.set(
      userRef,
      {
        inviteJoinFailedAttempts: resetPatch.failedAttempts,
        inviteJoinCooldownUntil: firestore.FieldValue.delete(),
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
  const snapshot = await firestore()
    .collection("households")
    .doc(householdId)
    .collection("joinRequests")
    .get();

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

  const householdRef = firestore().collection("households").doc(householdId);
  const requestRef = householdRef.collection("joinRequests").doc(requestUserId);
  const memberRef = householdRef.collection("members").doc(requestUserId);

  const requestSnap = await requestRef.get();
  const requestData = getSnapshotDataOrNull(requestSnap);
  if (!requestData || requestData.status !== "pending") {
    throw new Error("承認対象の参加リクエストが見つかりません");
  }

  const memberSnap = await memberRef.get();
  const memberData = memberSnap.data();
  if (memberData?.rejoinDisabled === true || memberData?.removedAt != null) {
    throw new Error("このユーザーは再参加できない状態です");
  }

  const displayName = normalizeJoinDisplayName(
    String(requestData.displayName ?? ""),
  );
  const validationError = validateJoinDisplayName(displayName);
  if (validationError) {
    throw new Error(validationError);
  }

  const batch = firestore().batch();
  batch.set(
    memberRef,
    {
      displayName,
      joinedAt: firestore.FieldValue.serverTimestamp(),
      removedAt: firestore.FieldValue.delete(),
    },
    { merge: true },
  );
  batch.set(
    requestRef,
    {
      status: "approved",
      reviewedAt: firestore.FieldValue.serverTimestamp(),
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

  const requestRef = firestore()
    .collection("households")
    .doc(householdId)
    .collection("joinRequests")
    .doc(user.uid);
  const requestSnap = await requestRef.get();
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

  await firestore().collection("users").doc(user.uid).set(
    {
      householdId,
      displayName: normalizedDisplayName,
      pendingHouseholdId: firestore.FieldValue.delete(),
      createdAt: firestore.FieldValue.serverTimestamp(),
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

  const ref = firestore()
    .collection("households")
    .doc(householdId)
    .collection("joinRequests")
    .doc(user.uid);

  return ref.onSnapshot((snap) => {
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

  const userRef = firestore().collection("users").doc(user.uid);
  const requestRef = firestore()
    .collection("households")
    .doc(householdId)
    .collection("joinRequests")
    .doc(user.uid);

  const requestSnap = await requestRef.get();
  const requestData = getSnapshotDataOrNull(requestSnap);
  if (requestData?.status === "approved") {
    throw new Error("すでに承認済みのためキャンセルできません");
  }

  const batch = firestore().batch();
  if (requestData) {
    batch.delete(requestRef);
  }
  batch.set(
    userRef,
    {
      pendingHouseholdId: firestore.FieldValue.delete(),
    },
    { merge: true },
  );

  await batch.commit();
}

export async function getPendingHouseholdId(): Promise<string | null> {
  const user = getCurrentUser();
  if (!user) return null;

  const userSnap = await firestore().collection("users").doc(user.uid).get();
  const userData = getSnapshotDataOrNull(userSnap);
  const householdId = userData?.pendingHouseholdId;
  return typeof householdId === "string" && householdId.length > 0
    ? householdId
    : null;
}

export async function clearPendingHouseholdId(): Promise<void> {
  const user = getCurrentUser();
  if (!user) throw new Error("未ログインです");

  await firestore().collection("users").doc(user.uid).set(
    {
      pendingHouseholdId: firestore.FieldValue.delete(),
    },
    { merge: true },
  );
}

export async function rejectJoinRequest(
  householdId: string,
  requestUserId: string,
): Promise<void> {
  const user = getCurrentUser();
  if (!user) throw new Error("未ログインです");

  const requestRef = firestore()
    .collection("households")
    .doc(householdId)
    .collection("joinRequests")
    .doc(requestUserId);

  const requestSnap = await requestRef.get();
  const requestData = getSnapshotDataOrNull(requestSnap);
  if (!requestData || requestData.status !== "pending") {
    throw new Error("却下対象の参加リクエストが見つかりません");
  }

  await requestRef.set(
    {
      status: "rejected",
      reviewedAt: firestore.FieldValue.serverTimestamp(),
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

  const doc = await firestore().collection("users").doc(user.uid).get();
  const userData = getSnapshotDataOrNull(doc);
  if (!userData) return null;

  const householdId = userData.householdId;
  if (!householdId) return null;

  const memberDoc = await firestore()
    .collection("households")
    .doc(householdId)
    .collection("members")
    .doc(user.uid)
    .get();

  if (!isActiveHouseholdMember(memberDoc.data())) {
    await firestore().collection("users").doc(user.uid).set(
      {
        householdId: firestore.FieldValue.delete(),
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
  const doc = await firestore().collection("households").doc(householdId).get();
  const data = getSnapshotDataOrNull(doc);
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

  const inviteCodeDoc = await firestore()
    .collection("inviteCodes")
    .doc(code)
    .get();
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

  const householdRef = firestore().collection("households").doc(householdId);
  const householdSnap = await householdRef.get();
  const householdData = getSnapshotDataOrNull(householdSnap);
  if (!householdData) {
    throw new Error("世帯が見つかりません");
  }

  const oldInviteCode = householdData.inviteCode;
  const nextInviteCode = createReplacementInviteCode(
    oldInviteCode,
    createSecureInviteCode,
  );

  const batch = firestore().batch();
  batch.update(householdRef, {
    inviteCode: nextInviteCode,
    inviteCodeUpdatedAt: firestore.FieldValue.serverTimestamp(),
  });
  if (oldInviteCode) {
    batch.set(
      firestore().collection("inviteCodes").doc(oldInviteCode),
      {
        disabledAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }
  batch.set(firestore().collection("inviteCodes").doc(nextInviteCode), {
    householdId,
    createdBy: user.uid,
    createdAt: firestore.FieldValue.serverTimestamp(),
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
  const snapshot = await firestore()
    .collection("households")
    .doc(householdId)
    .collection("members")
    .get();

  return snapshot.docs
    .map((doc) => mapHouseholdMember(doc.id, doc.data()))
    .filter((member) => !member.removed);
}

/**
 * 世帯メンバーを解除する
 */
export async function removeHouseholdMember(
  householdId: string,
  userId: string,
): Promise<void> {
  const currentUser = getCurrentUser();
  if (!currentUser) throw new Error("未ログインです");

  const householdRef = firestore().collection("households").doc(householdId);
  const membersRef = householdRef.collection("members");
  const isSelf = currentUser.uid === userId;

  if (isSelf) {
    const membersSnap = await membersRef.get();
    const activeMembers = membersSnap.docs.filter((doc) =>
      isActiveHouseholdMember(doc.data()),
    );

    // 最後のメンバー退出時は世帯ごと削除する。
    if (activeMembers.length <= 1) {
      const collectionNames = [
        ...getHouseholdDeletionCollectionNames(),
        "joinRequests",
      ];

      for (const name of collectionNames) {
        const collectionSnap = await householdRef.collection(name).get();
        if (collectionSnap.empty) continue;

        const docs = collectionSnap.docs;
        for (let i = 0; i < docs.length; i += 499) {
          const batch = firestore().batch();
          docs.slice(i, i + 499).forEach((doc) => batch.delete(doc.ref));
          await batch.commit();
        }
      }

      const inviteCodesSnap = await firestore()
        .collection("inviteCodes")
        .where("householdId", "==", householdId)
        .get();
      if (!inviteCodesSnap.empty) {
        const docs = inviteCodesSnap.docs;
        for (let i = 0; i < docs.length; i += 499) {
          const batch = firestore().batch();
          docs.slice(i, i + 499).forEach((doc) => batch.delete(doc.ref));
          await batch.commit();
        }
      }

      await householdRef.delete();
      await firestore().collection("users").doc(currentUser.uid).set(
        {
          householdId: firestore.FieldValue.delete(),
        },
        { merge: true },
      );
      return;
    }
  }

  await membersRef.doc(userId).set(
    {
      removedAt: firestore.FieldValue.serverTimestamp(),
      rejoinDisabled: true,
    },
    { merge: true },
  );
}
