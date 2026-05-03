import assert from "node:assert/strict";
import test from "node:test";

import { buildStoreEditResolution } from "./transactionStoreEdit";

test("buildStoreEditResolution keeps an explicitly selected store id", () => {
  assert.deepEqual(
    buildStoreEditResolution({
      storeId: "store-1",
      storeName: "駅前スーパー",
      categoryId: "cat-food",
    }),
    { kind: "selected", storeId: "store-1" },
  );
});

test("buildStoreEditResolution restores a visible store name when id is missing", () => {
  assert.deepEqual(
    buildStoreEditResolution({
      storeId: null,
      storeName: " 駅前スーパー ",
      categoryId: "cat-food",
    }),
    { kind: "restore", storeName: "駅前スーパー", categoryId: "cat-food" },
  );
});

test("buildStoreEditResolution clears store when the visible name is empty", () => {
  assert.deepEqual(
    buildStoreEditResolution({
      storeId: null,
      storeName: " ",
      categoryId: "cat-food",
    }),
    { kind: "none" },
  );
});
