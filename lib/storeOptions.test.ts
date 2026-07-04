import assert from "node:assert/strict";
import test from "node:test";

import {
    buildStoreOptionsForCategory,
    buildStoreOptionsFromTransactions,
    buildVisibleStorePickerOptions,
    findStoreByName,
} from "./storeOptions";

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

test("buildVisibleStorePickerOptions limits visible stores in source order", () => {
  const stores = Array.from({ length: 45 }, (_, index) => ({
    id: `store-${index + 1}`,
    name: `お店${String(index + 1).padStart(2, "0")}`,
    categoryId: null,
    lastUsedAt: "2026-06-01T00:00:00.000Z",
  }));

  const options = buildVisibleStorePickerOptions(stores, "");

  assert.equal(options.length, 40);
  assert.equal(options[0].id, "store-1");
  assert.equal(options.at(-1)?.id, "store-40");
});

test("buildVisibleStorePickerOptions narrows stores by partial search query before limiting", () => {
  const stores = [
    {
      id: "store-1",
      name: "駅前スーパー",
      categoryId: null,
      lastUsedAt: "2026-06-01T00:00:00.000Z",
    },
    {
      id: "store-2",
      name: "港スーパー",
      categoryId: null,
      lastUsedAt: "2026-06-01T00:00:00.000Z",
    },
    {
      id: "store-3",
      name: "駅ビル薬局",
      categoryId: null,
      lastUsedAt: "2026-06-01T00:00:00.000Z",
    },
  ];

  assert.deepEqual(
    buildVisibleStorePickerOptions(stores, " スーパー ").map(
      (store) => store.id,
    ),
    ["store-1", "store-2"],
  );
});

test("buildStoreOptionsFromTransactions builds unique store names by recent transaction date", () => {
  const options = buildStoreOptionsFromTransactions([
    {
      date: "2026-05-01",
      createdAt: "2026-05-01T09:00:00.000Z",
      categoryName: "食費",
      storeName: "駅前スーパー",
    },
    {
      date: "2026-05-03",
      createdAt: "2026-05-03T09:00:00.000Z",
      categoryName: "日用品",
      storeName: "薬局",
    },
    {
      date: "2026-05-05",
      createdAt: "2026-05-05T09:00:00.000Z",
      categoryName: "食費",
      storeName: " 駅前スーパー ",
    },
  ]);

  assert.deepEqual(
    options.map((store) => ({ id: store.id, name: store.name })),
    [
      { id: null, name: "駅前スーパー" },
      { id: null, name: "薬局" },
    ],
  );
});

test("buildStoreOptionsFromTransactions prioritizes stores recently used with the selected category", () => {
  const options = buildStoreOptionsFromTransactions(
    [
      {
        date: "2026-05-10",
        createdAt: "2026-05-10T09:00:00.000Z",
        categoryName: "日用品",
        storeName: "薬局",
      },
      {
        date: "2026-05-01",
        createdAt: "2026-05-01T09:00:00.000Z",
        categoryName: "食費",
        storeName: "駅前スーパー",
      },
    ],
    "食費",
  );

  assert.deepEqual(
    options.map((store) => store.name),
    ["駅前スーパー", "薬局"],
  );
});

test("buildStoreOptionsFromTransactions ignores income transaction store names", () => {
  const options = buildStoreOptionsFromTransactions([
    {
      type: "income",
      date: "2026-05-10",
      createdAt: "2026-05-10T09:00:00.000Z",
      categoryName: "給与",
      storeName: "勤務先",
    },
    {
      type: "expense",
      date: "2026-05-01",
      createdAt: "2026-05-01T09:00:00.000Z",
      categoryName: "食費",
      storeName: "駅前スーパー",
    },
  ]);

  assert.deepEqual(
    options.map((store) => store.name),
    ["駅前スーパー"],
  );
});
