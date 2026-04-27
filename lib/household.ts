import firestore from "@react-native-firebase/firestore";
import { getCurrentUser } from "./auth";
import { getSnapshotDataOrNull } from "./firestoreSnapshot";
import {
    isActiveHouseholdMember,
    mapHouseholdMember,
} from "./householdMembership";
import { createReplacementInviteCode } from "./inviteCode";
import { createStoredMemberProfile } from "./memberProfile";

export interface HouseholdMember {
  uid: string;
  displayName: string;
  removed?: boolean;
}

/**
 * 新しい世帯を作成し、現在のユーザーを紐付ける
 */
export async function createHousehold(): Promise<string> {
  const user = getCurrentUser();
  if (!user) throw new Error("未ログインです");

  const inviteCode = createReplacementInviteCode();
  const memberProfile = createStoredMemberProfile(user);

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
  });

  batch.set(firestore().collection("users").doc(user.uid), {
    householdId,
    displayName: memberProfile.displayName,
    createdAt: firestore.FieldValue.serverTimestamp(),
  });

  batch.set(householdRef.collection("members").doc(user.uid), {
    displayName: memberProfile.displayName,
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

  const householdRef = firestore().collection("households").doc(householdId);
  const memberProfile = createStoredMemberProfile(user);

  const batch = firestore().batch();

  batch.set(firestore().collection("users").doc(user.uid), {
    householdId,
    displayName: memberProfile.displayName,
    createdAt: firestore.FieldValue.serverTimestamp(),
  });

  batch.set(
    householdRef.collection("members").doc(user.uid),
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
  const nextInviteCode = createReplacementInviteCode(oldInviteCode);

  const batch = firestore().batch();
  batch.update(householdRef, {
    inviteCode: nextInviteCode,
    inviteCodeUpdatedAt: firestore.FieldValue.serverTimestamp(),
  });
  if (oldInviteCode) {
    batch.delete(firestore().collection("inviteCodes").doc(oldInviteCode));
  }
  batch.set(firestore().collection("inviteCodes").doc(nextInviteCode), {
    householdId,
    createdBy: user.uid,
    createdAt: firestore.FieldValue.serverTimestamp(),
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
  await firestore()
    .collection("households")
    .doc(householdId)
    .collection("members")
    .doc(userId)
    .set(
      {
        removedAt: firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
}
