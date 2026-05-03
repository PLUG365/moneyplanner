import assert from "node:assert/strict";
import test from "node:test";

import { evaluateMoneyInputForModal } from "./moneyInputEvaluation";

test("evaluateMoneyInputForModal confirms the modal after a valid calculation", () => {
  assert.deepEqual(evaluateMoneyInputForModal("1200+300", {}), {
    kind: "valid",
    value: "1500",
    shouldConfirm: true,
  });
});

test("evaluateMoneyInputForModal keeps the modal open after an invalid calculation", () => {
  assert.deepEqual(evaluateMoneyInputForModal("1200/0", {}), {
    kind: "invalid",
    shouldConfirm: false,
  });
});
