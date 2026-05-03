type StoreEditInput = {
  storeId: string | null;
  storeName: string;
  categoryId: string;
};

export type StoreEditResolution =
  | { kind: "selected"; storeId: string }
  | { kind: "restore"; storeName: string; categoryId: string }
  | { kind: "none" };

export function buildStoreEditResolution(
  input: StoreEditInput,
): StoreEditResolution {
  if (input.storeId) {
    return { kind: "selected", storeId: input.storeId };
  }

  const storeName = input.storeName.trim();
  if (storeName) {
    return { kind: "restore", storeName, categoryId: input.categoryId };
  }

  return { kind: "none" };
}
