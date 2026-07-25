import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isReadComplete,
  pickFirstPaintSource,
  resolveHasSettled,
} from "./transactionReadPlan";

// ── pickFirstPaintSource（案Bの順序）────────────────────────────

test("forceServer はキャッシュを飛ばしてサーバー読みを待たせる", () => {
  assert.equal(
    pickFirstPaintSource({
      forceServer: true,
      hasUsableMemory: true,
      cachedDocCount: 100,
    }),
    "none",
  );
});

test("使えるメモリキャッシュがあればそれを最優先で描画する", () => {
  assert.equal(
    pickFirstPaintSource({
      forceServer: false,
      hasUsableMemory: true,
      cachedDocCount: 100,
    }),
    "memory",
  );
});

test("メモリが使えない場合はディスクキャッシュから描画する", () => {
  assert.equal(
    pickFirstPaintSource({
      forceServer: false,
      hasUsableMemory: false,
      cachedDocCount: 1,
    }),
    "cache",
  );
});

test("ディスクキャッシュ0件では描画せずサーバー読みを待つ", () => {
  assert.equal(
    pickFirstPaintSource({
      forceServer: false,
      hasUsableMemory: false,
      cachedDocCount: 0,
    }),
    "none",
  );
});

test("端末自身の書き込みでメモリが無効化されたら、ディスクキャッシュへ落ちる", () => {
  // localWriteEpoch の不一致を呼び出し側が hasUsableMemory: false に反映した状態（R1）
  assert.equal(
    pickFirstPaintSource({
      forceServer: false,
      hasUsableMemory: false,
      cachedDocCount: 50,
    }),
    "cache",
  );
});

// ── resolveHasSettled（Issue #9 の空状態ルール）──────────────────

test("サーバー読みが終われば、描画元に関わらず確定する", () => {
  assert.equal(
    resolveHasSettled({ paintedSource: "none", serverReadDone: true }),
    true,
  );
});

test("キャッシュから描画できた時点で確定してよい", () => {
  assert.equal(
    resolveHasSettled({ paintedSource: "cache", serverReadDone: false }),
    true,
  );
});

test("メモリから描画できた時点でも確定してよい", () => {
  assert.equal(
    resolveHasSettled({ paintedSource: "memory", serverReadDone: false }),
    true,
  );
});

test("描画できるものが無い間は確定させない（空メッセージを出さない）", () => {
  assert.equal(
    resolveHasSettled({ paintedSource: "none", serverReadDone: false }),
    false,
  );
});

// ── isReadComplete（R8 の完全性判定）──────────────────────────

test("全件サーバー読みの直後は、stampが無くても完全と扱う", () => {
  // マーカーDocが未作成／オフラインで version が null だと stamp は残らない。
  // stampを必要条件にすると合計が一度も出なくなる（R8）。
  assert.equal(
    isReadComplete({
      isFetchAllScope: true,
      source: "server",
      scopeKnownComplete: false,
    }),
    true,
  );
});

test("ページングスコープは、stamp済みでも完全と扱わない", () => {
  // page スコープは limit 付きの部分読みなのに stamp される（R6-b）。
  assert.equal(
    isReadComplete({
      isFetchAllScope: false,
      source: "server",
      scopeKnownComplete: true,
    }),
    false,
  );
});

test("キャッシュ供給は、そのスコープが完全と分かっているときだけ完全", () => {
  assert.equal(
    isReadComplete({
      isFetchAllScope: true,
      source: "cache",
      scopeKnownComplete: true,
    }),
    true,
  );
  assert.equal(
    isReadComplete({
      isFetchAllScope: true,
      source: "cache",
      scopeKnownComplete: false,
    }),
    false,
  );
});

test("メモリ供給も同じ規則に従う", () => {
  assert.equal(
    isReadComplete({
      isFetchAllScope: true,
      source: "memory",
      scopeKnownComplete: true,
    }),
    true,
  );
});

test("描画できるものが無い状態は完全ではない", () => {
  assert.equal(
    isReadComplete({
      isFetchAllScope: true,
      source: "none",
      scopeKnownComplete: true,
    }),
    false,
  );
});

// ── 組み合わせ（実際に起きる経路）──────────────────────────────

test("初回インストール直後の検索: 描画せず待ち、サーバー読み後に合計を出す", () => {
  const painted = pickFirstPaintSource({
    forceServer: false,
    hasUsableMemory: false,
    cachedDocCount: 0,
  });
  assert.equal(painted, "none");
  assert.equal(
    resolveHasSettled({ paintedSource: painted, serverReadDone: false }),
    false,
  );
  assert.equal(
    isReadComplete({
      isFetchAllScope: true,
      source: painted,
      scopeKnownComplete: false,
    }),
    false,
  );

  // サーバー読み完了後
  assert.equal(
    resolveHasSettled({ paintedSource: painted, serverReadDone: true }),
    true,
  );
  assert.equal(
    isReadComplete({
      isFetchAllScope: true,
      source: "server",
      scopeKnownComplete: false,
    }),
    true,
  );
});

test("ソフトリセット直後: ディスクキャッシュから即描画し、合計も出せる", () => {
  const painted = pickFirstPaintSource({
    forceServer: false,
    hasUsableMemory: false,
    cachedDocCount: 320,
  });
  assert.equal(painted, "cache");
  assert.equal(
    resolveHasSettled({ paintedSource: painted, serverReadDone: false }),
    true,
  );
  assert.equal(
    isReadComplete({
      isFetchAllScope: true,
      source: painted,
      scopeKnownComplete: true,
    }),
    true,
  );
});

test("記録直後に集計を開く: メモリを使わずディスクから描く", () => {
  // R1 により hasUsableMemory は false になっている
  const painted = pickFirstPaintSource({
    forceServer: false,
    hasUsableMemory: false,
    cachedDocCount: 320,
  });
  assert.equal(painted, "cache");
  assert.equal(
    resolveHasSettled({ paintedSource: painted, serverReadDone: false }),
    true,
  );
});
