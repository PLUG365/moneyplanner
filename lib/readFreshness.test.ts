import assert from "node:assert/strict";
import test from "node:test";

import {
    hasDataVersionChanged,
    shouldReadServerForScope,
} from "./readFreshness";

test("hasDataVersionChanged treats matching versions as fresh", () => {
  assert.equal(hasDataVersionChanged("v1", "v1"), false);
  assert.equal(hasDataVersionChanged(null, null), false);
});

test("hasDataVersionChanged detects marker changes", () => {
  assert.equal(hasDataVersionChanged("v1", "v2"), true);
  assert.equal(hasDataVersionChanged(null, "v2"), true);
  assert.equal(hasDataVersionChanged("v1", null), true);
});

test("shouldReadServerForScope reads server when no cached scope data exists", () => {
  assert.equal(
    shouldReadServerForScope({
      hasCachedData: false,
      scopeVersion: "v1",
      currentDataVersion: "v1",
    }),
    true,
  );
});

test("shouldReadServerForScope skips server when cached scope matches current marker", () => {
  assert.equal(
    shouldReadServerForScope({
      hasCachedData: true,
      scopeVersion: "v1",
      currentDataVersion: "v1",
    }),
    false,
  );
});

test("shouldReadServerForScope reads server when cached scope is stale", () => {
  assert.equal(
    shouldReadServerForScope({
      hasCachedData: true,
      scopeVersion: "v1",
      currentDataVersion: "v2",
    }),
    true,
  );
});

test("stampが無いスコープは、マーカーも無くてもキャッシュを信用しない", () => {
  // scopeVersion が null＝一度も全件読みしていない。マーカーも null だと
  // `null !== null` が false になり、根拠が無いままキャッシュを採用してしまう。
  assert.equal(
    shouldReadServerForScope({
      hasCachedData: true,
      scopeVersion: null,
      currentDataVersion: null,
    }),
    true,
  );
});

test("stampが無ければマーカーが一致していてもサーバーを読む", () => {
  assert.equal(
    shouldReadServerForScope({
      hasCachedData: true,
      scopeVersion: null,
      currentDataVersion: "v1",
    }),
    true,
  );
});

// ── 件数比較（ADR の R3。LRU GC によるキャッシュ退避の検出）────────────

test("マーカーが一致していても、キャッシュ件数がstamp時を下回ればサーバーを読む", () => {
  assert.equal(
    shouldReadServerForScope({
      hasCachedData: true,
      scopeVersion: "v1",
      currentDataVersion: "v1",
      stampedDocCount: 500,
      cachedDocCount: 300,
    }),
    true,
  );
});

test("件数が一致していればキャッシュのまま", () => {
  assert.equal(
    shouldReadServerForScope({
      hasCachedData: true,
      scopeVersion: "v1",
      currentDataVersion: "v1",
      stampedDocCount: 500,
      cachedDocCount: 500,
    }),
    false,
  );
});

test("件数が増える方向では読み直さない", () => {
  // マーカー不変で件数が増えることは設計上ありえず、検出しても対処できない。
  assert.equal(
    shouldReadServerForScope({
      hasCachedData: true,
      scopeVersion: "v1",
      currentDataVersion: "v1",
      stampedDocCount: 500,
      cachedDocCount: 501,
    }),
    false,
  );
});

test("件数が未記録なら件数比較を行わない（旧形式・差分読み更新）", () => {
  assert.equal(
    shouldReadServerForScope({
      hasCachedData: true,
      scopeVersion: "v1",
      currentDataVersion: "v1",
      cachedDocCount: 300,
    }),
    false,
  );
  assert.equal(
    shouldReadServerForScope({
      hasCachedData: true,
      scopeVersion: "v1",
      currentDataVersion: "v1",
      stampedDocCount: 500,
    }),
    false,
  );
});

test("追加・更新・削除は件数比較より前にマーカーで捕まる", () => {
  // 件数が一致していてもマーカーが動いていればサーバーを読む（例: 金額の編集）。
  assert.equal(
    shouldReadServerForScope({
      hasCachedData: true,
      scopeVersion: "v1",
      currentDataVersion: "v2",
      stampedDocCount: 500,
      cachedDocCount: 500,
    }),
    true,
  );
  // ソフトデリートは生のDoc件数を減らさないが、マーカーが動くので捕まる。
  assert.equal(
    shouldReadServerForScope({
      hasCachedData: true,
      scopeVersion: "v1",
      currentDataVersion: "v2",
      stampedDocCount: 500,
      cachedDocCount: 500,
    }),
    true,
  );
});
