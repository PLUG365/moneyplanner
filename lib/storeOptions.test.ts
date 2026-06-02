import assert from "node:assert/strict";
import test from "node:test";

import { buildStoreOptionsForCategory, findStoreByName } from "./storeOptions";

test("buildStoreOptionsForCategory shows all stores and prioritizes stores used with the category", () => {
  const stores = [
    {
      id: "store-food",
      name: "駅前スーパー",
      categoryId: "cat-food",
      lastUsedAt: "2026-06-01T00:00:00.000Z",
    },
    {
      id: "store-daily",
      name: "ドラッグストア",
      categoryId: "cat-daily",
      lastUsedAt: "2026-06-02T00:00:00.000Z",
    },
    {
      id: "store-other",
      name: "ホームセンター",
      categoryId: "cat-hobby",
      lastUsedAt: "2026-06-04T00:00:00.000Z",
    },
  ];

  const options = buildStoreOptionsForCategory(
    stores,
    [
      {
        storeId: "store-food",
        categoryId: "cat-daily",
        lastUsedAt: "2026-06-03T00:00:00.000Z",
      },
    ],
    "cat-daily",
  );

  assert.deepEqual(
    options.map((store) => store.id),
    ["store-food", "store-other", "store-daily"],
  );
});

test("buildStoreOptionsForCategory returns all stores when category is not specified", () => {
  const stores = [
    {
      id: "store-old",
      name: "古い店",
      categoryId: null,
      lastUsedAt: "2026-06-01T00:00:00.000Z",
    },
    {
      id: "store-new",
      name: "新しい店",
      categoryId: "cat-food",
      lastUsedAt: "2026-06-02T00:00:00.000Z",
    },
  ];

  const options = buildStoreOptionsForCategory(stores, [], null);

  assert.deepEqual(
    options.map((store) => store.id),
    ["store-new", "store-old"],
  );
});

test("buildStoreOptionsForCategory merges stores with the same trimmed name", () => {
  const options = buildStoreOptionsForCategory(
    [
      {
        id: "store-old",
        name: "駅前スーパー",
        categoryId: "cat-food",
        lastUsedAt: "2026-06-01T00:00:00.000Z",
      },
      {
        id: "store-new",
        name: " 駅前スーパー ",
        categoryId: "cat-daily",
        lastUsedAt: "2026-06-03T00:00:00.000Z",
      },
    ],
    [],
    "cat-daily",
  );

  assert.deepEqual(options, [
    {
      id: "store-new",
      name: "駅前スーパー",
      categoryId: "cat-daily",
      lastUsedAt: "2026-06-03T00:00:00.000Z",
    },
  ]);
});

test("findStoreByName matches existing stores by trimmed case-insensitive name", () => {
  const store = findStoreByName(" 駅前スーパー ", [
    {
      id: "store-1",
      name: "駅前スーパー",
      categoryId: "cat-food",
      lastUsedAt: "2026-06-01T00:00:00.000Z",
    },
  ]);

  assert.equal(store?.id, "store-1");
});
