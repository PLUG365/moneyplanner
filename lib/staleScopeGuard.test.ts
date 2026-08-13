import assert from "node:assert/strict";
import { test } from "node:test";

import { decideStaleScopeWrite, isCurrentScopeResult, shouldClearPaintedForScopeChange } from "./staleScopeGuard";

const SCOPE_A = "hh1:transactions:2026";
const SCOPE_B = "hh1:transactions:2025";
const SCOPE_OTHER_HOUSEHOLD = "hh2:transactions:2026";

test("要求スコープと一致するとき、表示状態の書き込みをすべて許可する", () => {
  assert.deepEqual(
    decideStaleScopeWrite({
      resultScopeKey: SCOPE_A,
      requestedScopeKey: SCOPE_A,
    }),
    {
      applyContent: true,
      applySettled: true,
      applyError: true,
      applyLoadingRelease: true,
      applyFlowRelease: true,
    },
  );
});

test("スコープが切り替わっていると、表示状態の書き込みを止める", () => {
  const decision = decideStaleScopeWrite({
    resultScopeKey: SCOPE_A,
    requestedScopeKey: SCOPE_B,
  });
  assert.equal(decision.applyContent, false);
  assert.equal(decision.applySettled, false);
  assert.equal(decision.applyError, false);
});

test("同じ年でも世帯が違えば止める", () => {
  assert.equal(
    isCurrentScopeResult({
      resultScopeKey: SCOPE_A,
      requestedScopeKey: SCOPE_OTHER_HOUSEHOLD,
    }),
    false,
  );
});

test("世帯ID未解決（要求スコープが null）のとき、どの結果も反映しない", () => {
  const decision = decideStaleScopeWrite({
    resultScopeKey: SCOPE_A,
    requestedScopeKey: null,
  });
  assert.equal(decision.applyContent, false);
  assert.equal(decision.applySettled, false);
  assert.equal(decision.applyError, false);
});

// ここが本修正で最も重要な不変条件である。stale を理由にローディング解除や
// 進行中フラグの解放を飛ばすと、修正前の「一瞬前の年が見える」よりも重い
// 「画面が固着する」症状になる（ADR がこの修正を先送りした理由そのもの）。
for (const [label, requestedScopeKey] of [
  ["一致", SCOPE_A],
  ["不一致", SCOPE_B],
  ["未解決", null],
] as const) {
  test(`要求スコープが${label}でも、ローディング解除と再読込の実行は必ず許可する`, () => {
    const decision = decideStaleScopeWrite({
      resultScopeKey: SCOPE_A,
      requestedScopeKey,
    });
    assert.equal(decision.applyLoadingRelease, true);
    assert.equal(decision.applyFlowRelease, true);
  });
}

test("年を連続で切り替えても、最後に要求されたスコープだけが反映される", () => {
  // 2026 → 2025 → 2024 と素早く切り替えた状況。進行中だった 2026 と、
  // 予約へ回った 2025 の結果は捨て、2024 だけを反映する。
  const requested = "hh1:transactions:2024";
  const results = [SCOPE_A, SCOPE_B, requested];
  const applied = results.filter((resultScopeKey) =>
    isCurrentScopeResult({ resultScopeKey, requestedScopeKey: requested }),
  );
  assert.deepEqual(applied, [requested]);
});

// ── 予約へ回った要求による表示無効化 ────────────────────────────────
// 進行中の読みがあるときに別スコープが要求されると、その要求はすぐには実行されない。
// 旧スコープの書き込みを止めるだけでは、既に描画済みの内容が残り続ける。

test("進行中に別スコープが要求されたら、描画済みの内容を破棄する", () => {
  assert.equal(
    shouldClearPaintedForScopeChange({
      paintedScopeKey: SCOPE_A,
      targetScopeKey: SCOPE_B,
    }),
    true,
  );
});

test("同じスコープの再読込では、描画済みの内容を保持する", () => {
  assert.equal(
    shouldClearPaintedForScopeChange({
      paintedScopeKey: SCOPE_A,
      targetScopeKey: SCOPE_A,
    }),
    false,
  );
});

test("pull-to-refresh（forceServer）でも、スコープが違えば破棄する", () => {
  assert.equal(
    shouldClearPaintedForScopeChange({
      paintedScopeKey: SCOPE_A,
      targetScopeKey: SCOPE_B,
    }),
    true,
  );
  // 同一スコープの更新なら、そもそも不一致にならないので画面は空にならない。
  assert.equal(
    shouldClearPaintedForScopeChange({
      paintedScopeKey: SCOPE_A,
      targetScopeKey: SCOPE_A,
    }),
    false,
  );
});

test("同じ年でも世帯が違えば、描画済みの内容を破棄する", () => {
  assert.equal(
    shouldClearPaintedForScopeChange({
      paintedScopeKey: SCOPE_A,
      targetScopeKey: SCOPE_OTHER_HOUSEHOLD,
    }),
    true,
  );
});

test("世帯IDが未解決になったら、描画済みの内容を破棄する", () => {
  assert.equal(
    shouldClearPaintedForScopeChange({
      paintedScopeKey: SCOPE_A,
      targetScopeKey: null,
    }),
    true,
  );
});

test("何も描画していなければ、破棄するものはない", () => {
  assert.equal(
    shouldClearPaintedForScopeChange({
      paintedScopeKey: null,
      targetScopeKey: SCOPE_B,
    }),
    true,
  );
  assert.equal(
    shouldClearPaintedForScopeChange({
      paintedScopeKey: null,
      targetScopeKey: null,
    }),
    false,
  );
});

// A → B → A と往復したとき、A の進行中クロージャは「現在」と判定してよい。
// scopeKey がクエリを一意に表す限り、内容は等価である。
test("A → B → A と戻った場合、進行中の A は現在として扱われる", () => {
  assert.equal(
    isCurrentScopeResult({
      resultScopeKey: SCOPE_A,
      requestedScopeKey: SCOPE_A,
    }),
    true,
  );
  assert.equal(
    shouldClearPaintedForScopeChange({
      paintedScopeKey: SCOPE_A,
      targetScopeKey: SCOPE_A,
    }),
    false,
  );
});
