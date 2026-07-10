import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBreakdownDisplayOrderPatch,
  sortBreakdownsForDisplay,
} from "./breakdownOrdering";

test("sortBreakdownsForDisplay uses displayOrder within a category", () => {
  const sorted = sortBreakdownsForDisplay([
    {
      id: "later",
      categoryId: "food",
      name: "あと",
      isDefault: true,
      displayOrder: 20,
    },
    {
      id: "first",
      categoryId: "food",
      name: "先",
      isDefault: true,
      displayOrder: 10,
    },
  ]);

  assert.deepEqual(
    sorted.map((item) => item.id),
    ["first", "later"],
  );
});

test("sortBreakdownsForDisplay preserves the legacy fallback before backfill", () => {
  const sorted = sortBreakdownsForDisplay([
    {
      id: "new",
      categoryId: "food",
      name: "新規",
      isDefault: false,
      displayOrder: 3,
    },
    {
      id: "default",
      categoryId: "food",
      name: "既定",
      isDefault: true,
    },
    {
      id: "custom",
      categoryId: "food",
      name: "追加",
      isDefault: false,
    },
  ]);

  assert.deepEqual(
    sorted.map((item) => item.id),
    ["default", "custom", "new"],
  );
});

test("buildBreakdownDisplayOrderPatch assigns dense order values", () => {
  assert.deepEqual(
    buildBreakdownDisplayOrderPatch([
      {
        id: "a",
        categoryId: "food",
        name: "A",
        isDefault: true,
        displayOrder: 20,
      },
      {
        id: "b",
        categoryId: "food",
        name: "B",
        isDefault: true,
        displayOrder: 10,
      },
    ]),
    [
      { id: "a", displayOrder: 0 },
      { id: "b", displayOrder: 1 },
    ],
  );
});
