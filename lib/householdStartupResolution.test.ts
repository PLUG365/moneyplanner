import assert from "node:assert/strict";
import test from "node:test";

async function loadPolicy() {
  const policy = await import("./householdStartupResolution").catch(() => null);
  assert.ok(policy, "起動時の世帯判定ポリシーを実装する必要があります");
  return policy;
}

test("cache 由来で user または member が欠落するときは未所属でなく判定不能にする", async () => {
  const { resolveHouseholdMembership } = await loadPolicy();

  assert.equal(
    resolveHouseholdMembership({
      user: { exists: false, fromCache: true },
    }).kind,
    "indeterminate",
  );
  assert.equal(
    resolveHouseholdMembership({
      user: { exists: true, householdId: "household-1", fromCache: false },
      member: { exists: false, active: false, fromCache: true },
    }).kind,
    "indeterminate",
  );
});

test("server で確定した user.householdId 欠落だけを未所属にする", async () => {
  const { resolveHouseholdMembership } = await loadPolicy();

  assert.equal(
    resolveHouseholdMembership({
      user: { exists: true, fromCache: false },
    }).kind,
    "unaffiliated",
  );
});

test("member 未指定の indeterminate は『情報不足』であって『サーバーで確認できなかった』ではない", async () => {
  const { resolveHouseholdMembership } = await loadPolicy();

  // member を渡さない限り、サーバー由来で householdId が確定していても
  // indeterminate になる。呼び出し側はこれを再試行の打ち切り条件に使わず、
  // member を読んでから判定し直すこと。打ち切ると、キャッシュが空の起動が
  // 毎回1往復を空振りしてから再試行する。
  assert.equal(
    resolveHouseholdMembership({
      user: { exists: true, householdId: "household-1", fromCache: false },
    }).kind,
    "indeterminate",
  );

  assert.deepEqual(
    resolveHouseholdMembership({
      user: { exists: true, householdId: "household-1", fromCache: false },
      member: { exists: true, active: true, fromCache: false },
    }),
    { kind: "member", householdId: "household-1" },
  );
});

test("active member は cache 由来でも所属として解決する", async () => {
  const { resolveHouseholdMembership } = await loadPolicy();

  assert.deepEqual(
    resolveHouseholdMembership({
      user: { exists: true, householdId: "household-1", fromCache: true },
      member: { exists: true, active: true, fromCache: true },
    }),
    { kind: "member", householdId: "household-1" },
  );
});

test("cache に member ドキュメントが存在しない場合は active 値だけで所属としない", async () => {
  const { resolveHouseholdMembership } = await loadPolicy();

  assert.equal(
    resolveHouseholdMembership({
      user: { exists: true, householdId: "household-1", fromCache: false },
      member: { exists: false, active: true, fromCache: true },
    }).kind,
    "indeterminate",
  );
});

test("一時例外の後、再試行が成功すればその所属結果を返す", async () => {
  const { retryHouseholdResolution } = await loadPolicy();
  let attempts = 0;

  const result = await retryHouseholdResolution(async () => {
    attempts += 1;
    if (attempts < 3) throw new Error("temporary unavailable");
    return "household-1";
  }, 3);

  assert.equal(result, "household-1");
  assert.equal(attempts, 3);
});

test("永続例外は null に変換せず reject する", async () => {
  const { retryHouseholdResolution } = await loadPolicy();
  let attempts = 0;

  await assert.rejects(
    retryHouseholdResolution(async () => {
      attempts += 1;
      throw new Error("persistent unavailable");
    }, 3),
    /persistent unavailable/,
  );
  assert.equal(attempts, 3);
});

test("確定未所属の null は再試行しない", async () => {
  const { retryHouseholdResolution } = await loadPolicy();
  let attempts = 0;

  const result = await retryHouseholdResolution(async () => {
    attempts += 1;
    return null;
  }, 3);

  assert.equal(result, null);
  assert.equal(attempts, 1);
});
