import assert from "node:assert/strict";
import test from "node:test";

import {
    buildCategoryDisplayOrderPatch,
    moveCategoryInDisplayOrder,
    sortCategoriesForDisplay,
} from "./categoryOrdering";

test("sortCategoriesForDisplay uses displayOrder before default and name fallback", () => {
  const sorted = sortCategoriesForDisplay([
    {
      id: "later",
      name: "あと",
      type: "expense",
      isDefault: true,
      displayOrder: 20,
    },
    { id: "custom", name: "追加", type: "expense", isDefault: false },
    {
      id: "first",
      name: "先",
      type: "expense",
      isDefault: true,
      displayOrder: 10,
    },
  ]);

  assert.deepEqual(
    sorted.map((item) => item.id),
    ["first", "later", "custom"],
  );
});

test("moveCategoryInDisplayOrder moves a category within the same type", () => {
  const moved = moveCategoryInDisplayOrder(
    [
      { id: "a", name: "A", type: "expense", isDefault: true, displayOrder: 0 },
      { id: "b", name: "B", type: "expense", isDefault: true, displayOrder: 1 },
      {
        id: "income",
        name: "I",
        type: "income",
        isDefault: true,
        displayOrder: 0,
      },
      { id: "c", name: "C", type: "expense", isDefault: true, displayOrder: 2 },
    ],
    "c",
    "up",
  );

  assert.deepEqual(
    moved.map((item) => item.id),
    ["a", "c", "b", "income"],
  );
});

test("buildCategoryDisplayOrderPatch assigns dense order values", () => {
  assert.deepEqual(
    buildCategoryDisplayOrderPatch([
      {
        id: "a",
        name: "A",
        type: "expense",
        isDefault: true,
        displayOrder: 20,
      },
      {
        id: "b",
        name: "B",
        type: "expense",
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
