import firestore from "@react-native-firebase/firestore";
import { getCurrentUser } from "./auth";

const INVITE_CODE_LENGTH = 6;

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 紛らわしい文字を除外
  let code = "";
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export interface HouseholdMember {
  uid: string;
  displayName: string;
}

/**
 * 新しい世帯を作成し、現在のユーザーを紐付ける
 */
export async function createHousehold(): Promise<string> {
  const user = getCurrentUser();
  if (!user) throw new Error("未ログインです");

  const inviteCode = generateInviteCode();

  const householdRef = firestore().collection("households").doc();
  const householdId = householdRef.id;

  const batch = firestore().batch();

  batch.set(householdRef, {
    createdBy: user.uid,
    inviteCode,
    createdAt: firestore.FieldValue.serverTimestamp(),
  });

  batch.set(firestore().collection("users").doc(user.uid), {
    householdId,
    displayName: user.displayName || "メンバー",
    createdAt: firestore.FieldValue.serverTimestamp(),
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

  const snapshot = await firestore()
    .collection("households")
    .where("inviteCode", "==", code)
    .limit(1)
    .get();

  if (snapshot.empty) {
    throw new Error("招待コードが見つかりません");
  }

  const householdId = snapshot.docs[0].id;

  await firestore()
    .collection("users")
    .doc(user.uid)
    .set({
      householdId,
      displayName: user.displayName || "メンバー",
      createdAt: firestore.FieldValue.serverTimestamp(),
    });
}

/**
 * 現在のユーザーの世帯IDを取得
 */
export async function getHouseholdId(): Promise<string | null> {
  const user = getCurrentUser();
  if (!user) return null;

  const doc = await firestore().collection("users").doc(user.uid).get();
  if (!doc.exists) return null;

  return (doc.data() as { householdId?: string })?.householdId ?? null;
}

/**
 * 世帯の招待コードを取得
 */
export async function getInviteCode(
  householdId: string,
): Promise<string | null> {
  const doc = await firestore().collection("households").doc(householdId).get();
  if (!doc.exists) return null;

  return (doc.data() as { inviteCode?: string })?.inviteCode ?? null;
}

/**
 * 世帯メンバー一覧を取得
 */
export async function getHouseholdMembers(
  householdId: string,
): Promise<HouseholdMember[]> {
  const snapshot = await firestore()
    .collection("users")
    .where("householdId", "==", householdId)
    .get();

  return snapshot.docs.map((doc) => ({
    uid: doc.id,
    displayName:
      (doc.data() as { displayName?: string }).displayName || "メンバー",
  }));
}
