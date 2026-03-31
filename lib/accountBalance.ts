export type TransactionTypeLike = "income" | "expense";

export type BalanceAdjustment = {
  accountId: number;
  delta: number;
};

type BalanceInput = {
  accountId: number;
  type: TransactionTypeLike;
  amount: number;
};

function toSignedAmount(type: TransactionTypeLike, amount: number): number {
  return type === "income" ? amount : -amount;
}

function normalizeAdjustments(map: Map<number, number>): BalanceAdjustment[] {
  return Array.from(map.entries())
    .filter(([, delta]) => delta !== 0)
    .map(([accountId, delta]) => ({ accountId, delta }));
}

export function buildBalanceAdjustmentsForCreate(
  input: BalanceInput,
): BalanceAdjustment[] {
  return [
    {
      accountId: input.accountId,
      delta: toSignedAmount(input.type, input.amount),
    },
  ];
}

export function buildBalanceAdjustmentsForDelete(
  input: BalanceInput,
): BalanceAdjustment[] {
  return [
    {
      accountId: input.accountId,
      delta: -toSignedAmount(input.type, input.amount),
    },
  ];
}

export function buildBalanceAdjustmentsForUpdate(
  before: BalanceInput,
  after: BalanceInput,
): BalanceAdjustment[] {
  const adjustments = new Map<number, number>();
  const beforeDelta = -toSignedAmount(before.type, before.amount);
  const afterDelta = toSignedAmount(after.type, after.amount);

  adjustments.set(
    before.accountId,
    (adjustments.get(before.accountId) ?? 0) + beforeDelta,
  );
  adjustments.set(
    after.accountId,
    (adjustments.get(after.accountId) ?? 0) + afterDelta,
  );

  return normalizeAdjustments(adjustments);
}
