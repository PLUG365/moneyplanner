import assert from "node:assert/strict";
import { test } from "node:test";

import { getSceneTopPadding } from "./safeAreaLayout";

test("getSceneTopPadding uses the device safe area top inset", () => {
  assert.equal(getSceneTopPadding(47), 47);
});

test("getSceneTopPadding never returns a negative padding", () => {
  assert.equal(getSceneTopPadding(-8), 0);
});
