export function getMemberRemovalActionLabel(
  currentUserId: string | null | undefined,
  memberUserId: string,
): "退出" | "解除" {
  return currentUserId === memberUserId ? "退出" : "解除";
}
