import assert from "node:assert/strict";
import { test } from "node:test";

import { READ_TIMED_OUT, withReadTimeout } from "./readTimeout";

test("上限内に解決すればその値を返す", async () => {
  const result = await withReadTimeout(Promise.resolve("snapshot"), 50);
  assert.equal(result, "snapshot");
});

test("上限に達したら READ_TIMED_OUT を返す", async () => {
  const result = await withReadTimeout(new Promise<string>(() => {}), 1);
  assert.equal(result, READ_TIMED_OUT);
});

test("上限内の失敗はそのまま呼び出し側へ投げる", async () => {
  await assert.rejects(
    withReadTimeout(Promise.reject(new Error("permission-denied")), 50),
    /permission-denied/,
  );
});

test("上限に達したあとで届いた失敗は未処理の拒否にならない", async () => {
  let rejectLater!: (error: Error) => void;
  const slowRead = new Promise<string>((_resolve, reject) => {
    rejectLater = reject;
  });

  const result = await withReadTimeout(slowRead, 1);
  assert.equal(result, READ_TIMED_OUT);

  // 破棄したあとに失敗が届いても、未処理の Promise 拒否を起こさない。
  rejectLater(new Error("unavailable"));
  await new Promise((resolve) => setTimeout(resolve, 10));
});

test("上限に達したあとで届いた成功も無視する", async () => {
  let resolveLater!: (value: string) => void;
  const slowRead = new Promise<string>((resolve) => {
    resolveLater = resolve;
  });

  const result = await withReadTimeout(slowRead, 1);
  assert.equal(result, READ_TIMED_OUT);

  resolveLater("late");
  await new Promise((resolve) => setTimeout(resolve, 10));
  // 既に READ_TIMED_OUT を返しているので、遅れて届いた値は使われない。
  assert.equal(result, READ_TIMED_OUT);
});

test("値が undefined でも上限到達と区別できる", async () => {
  const result = await withReadTimeout(Promise.resolve(undefined), 50);
  assert.equal(result, undefined);
  assert.notEqual(result, READ_TIMED_OUT);
});

test("値が null でも上限到達と区別できる", async () => {
  const result = await withReadTimeout(Promise.resolve(null), 50);
  assert.equal(result, null);
  assert.notEqual(result, READ_TIMED_OUT);
});
