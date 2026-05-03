export type ReconciliationAccount = {
  id: string;
  balance: number;
  initialBalance?: number | null;
};

export type ReconciliationTransaction = {
  accountId?: string | null;
  type: "income" | "expense";
  amount: number;
};

export type AccountBalanceReconciliationPatch = {
  accountId: string;
  initialBalance: number;
  balance: number;
  initializeInitialBalance: boolean;
  updateBalance: boolean;
};

function signedAmount(transaction: ReconciliationTransaction): number {
  return transaction.type === "income"
    ? transaction.amount
    : -transaction.amount;
}

export function buildAccountBalanceReconciliation(
  accounts: ReconciliationAccount[],
  transactions: ReconciliationTransaction[],
  defaultAccountId = "default",
): AccountBalanceReconciliationPatch[] {
  const netByAccountId = new Map<string, number>();

  for (const transaction of transactions) {
    const accountId = transaction.accountId || defaultAccountId;
    netByAccountId.set(
      accountId,
      (netByAccountId.get(accountId) ?? 0) + signedAmount(transaction),
    );
  }

  return accounts.flatMap((account) => {
    const net = netByAccountId.get(account.id) ?? 0;
    const hasInitialBalance = typeof account.initialBalance === "number";
    const initialBalance = hasInitialBalance
      ? Number(account.initialBalance)
      : account.balance - net;
    const expectedBalance = initialBalance + net;
    const updateBalance = account.balance !== expectedBalance;
    const initializeInitialBalance = !hasInitialBalance;

    if (!initializeInitialBalance && !updateBalance) return [];

    return [
      {
        accountId: account.id,
        initialBalance,
        balance: expectedBalance,
        initializeInitialBalance,
        updateBalance,
      },
    ];
  });
}
