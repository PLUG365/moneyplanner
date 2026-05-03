import assert from "node:assert/strict";
import test from "node:test";

import { applyNumericInputKey } from "./numericInput";

test("applyNumericInputKey appends digits and backspaces", () => {
  assert.equal(applyNumericInputKey("12", "3", {}), "123");
  assert.equal(applyNumericInputKey("123", "backspace", {}), "12");
  assert.equal(applyNumericInputKey("123", "clear", {}), "");
});

test("applyNumericInputKey keeps only one leading zero for plain values", () => {
  assert.equal(applyNumericInputKey("", "0", {}), "0");
  assert.equal(applyNumericInputKey("0", "0", {}), "0");
  assert.equal(applyNumericInputKey("0", "5", {}), "5");
});

test("applyNumericInputKey supports arithmetic operators when enabled", () => {
  assert.equal(
    applyNumericInputKey("12000", "+", { allowOperators: true }),
    "12000+",
  );
  assert.equal(
    applyNumericInputKey("12000+", "3", { allowOperators: true }),
    "12000+3",
  );
  assert.equal(
    applyNumericInputKey("12000+", "*", { allowOperators: true }),
    "12000*",
  );
});

test("applyNumericInputKey ignores arithmetic operators when disabled", () => {
  assert.equal(applyNumericInputKey("12000", "+", {}), "12000");
  assert.equal(applyNumericInputKey("12000", "*", {}), "12000");
});

test("applyNumericInputKey allows a leading minus only when negative input is enabled", () => {
  assert.equal(
    applyNumericInputKey("", "-", {
      allowOperators: true,
      allowNegative: true,
    }),
    "-",
  );
  assert.equal(applyNumericInputKey("", "-", { allowOperators: true }), "");
});
