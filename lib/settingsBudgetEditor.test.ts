import assert from "node:assert/strict";
import test from "node:test";

import { buildBudgetInputMap } from "./settingsBudgetEditor";

test("buildBudgetInputMap keys inputs by Firestore category id", () => {
  assert.deepEqual(
    buildBudgetInputMap([
      { categoryId: "food", amount: 35000 },
      { categoryId: "daily", amount: 0 },
    ]),
    {
      food: "35000",
      daily: "",
    },
  );
});
