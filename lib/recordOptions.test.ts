import assert from "node:assert/strict";
import test from "node:test";

import { buildRecordCategoryOptions } from "./recordOptions";

test("buildRecordCategoryOptions keeps the configured category display order", () => {
  const categories = buildRecordCategoryOptions([
    {
      id: "daily",
      name: "日用品",
      type: "expense",
      color: "#00796B",
      isDefault: true,
      displayOrder: 2,
    },
    {
      id: "food",
      name: "食費",
      type: "expense",
      color: "#C62828",
      isDefault: true,
      displayOrder: 0,
    },
    {
      id: "transport",
      name: "交通",
      type: "expense",
      color: "#1565C0",
      isDefault: true,
      displayOrder: 1,
    },
  ]);

  assert.deepEqual(
    categories.map((category) => category.id),
    ["food", "transport", "daily"],
  );
});
