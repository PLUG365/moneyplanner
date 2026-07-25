import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import {
  bumpLocalWriteEpoch,
  getLocalWriteEpoch,
  isLocalWriteEpochCurrent,
  resetLocalWriteEpochs,
} from "./localWriteEpoch";

beforeEach(() => {
  resetLocalWriteEpochs();
});

test("未書き込みの世帯は 0 から始まる", () => {
  assert.equal(getLocalWriteEpoch("h1"), 0);
});

test("保存時点の値を持つエントリは、書き込みが無ければ使える", () => {
  const epoch = getLocalWriteEpoch("h1");
  assert.equal(isLocalWriteEpochCurrent("h1", epoch), true);
});

test("書き込み後は、書き込み前に作ったエントリを使わない", () => {
  const staleEpoch = getLocalWriteEpoch("h1");
  bumpLocalWriteEpoch("h1");
  assert.equal(isLocalWriteEpochCurrent("h1", staleEpoch), false);
});

test("書き込み後に作り直したエントリは使える", () => {
  bumpLocalWriteEpoch("h1");
  const freshEpoch = getLocalWriteEpoch("h1");
  assert.equal(isLocalWriteEpochCurrent("h1", freshEpoch), true);
});

test("世帯ごとに独立している", () => {
  const otherEpoch = getLocalWriteEpoch("h2");
  bumpLocalWriteEpoch("h1");
  assert.equal(isLocalWriteEpochCurrent("h2", otherEpoch), true);
});

test("連続した書き込みでも、途中の値では使えないままになる", () => {
  const staleEpoch = getLocalWriteEpoch("h1");
  bumpLocalWriteEpoch("h1");
  bumpLocalWriteEpoch("h1");
  assert.equal(isLocalWriteEpochCurrent("h1", staleEpoch), false);
  assert.equal(getLocalWriteEpoch("h1"), 2);
});

test("epoch が undefined のエントリ（旧形式）は使えない扱いにする", () => {
  assert.equal(isLocalWriteEpochCurrent("h1", undefined), false);
});

test("householdId が空文字なら書き込みカウンタを進めない", () => {
  bumpLocalWriteEpoch("");
  assert.equal(getLocalWriteEpoch(""), 0);
});
