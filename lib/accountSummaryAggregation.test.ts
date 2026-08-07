import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAccountSummaryTotals,
  buildMonthAccountSummaryFromTransactions,
} from "./accountSummaryAggregation";

const transactions = [
  {
    date: "2026-08-01",
    amount: 300000,
    type: "income" as const,
    accountId: "bank",
    accountName: "銀行",
  },
  {
    date: "2026-08-03",
    amount: 50000,
    type: "expense" as const,
    accountId: "bank",
    accountName: "銀行",
  },
  {
    date: "2026-08-05",
    amount: 1200,
    type: "expense" as const,
    accountId: "wallet",
    accountName: "財布",
  },
  {
    date: "2026-07-31",
    amount: 999999,
    type: "expense" as const,
    accountId: "bank",
    accountName: "銀行",
  },
  {
    date: "2026-09-01",
    amount: 999999,
    type: "expense" as const,
    accountId: "bank",
    accountName: "銀行",
  },
];

test("buildMonthAccountSummaryFromTransactions sums income and expense per account", () => {
  assert.deepEqual(
    buildMonthAccountSummaryFromTransactions(transactions, 2026, 8),
    [
      {
        accountId: "bank",
        accountName: "銀行",
        income: 300000,
        expense: 50000,
        net: 250000,
      },
      {
        accountId: "wallet",
        accountName: "財布",
        income: 0,
        expense: 1200,
        net: -1200,
      },
    ],
  );
});

test("buildMonthAccountSummaryFromTransactions ignores other months", () => {
  const summaries = buildMonthAccountSummaryFromTransactions(
    transactions,
    2026,
    7,
  );
  assert.deepEqual(summaries, [
    {
      accountId: "bank",
      accountName: "銀行",
      income: 0,
      expense: 999999,
      net: -999999,
    },
  ]);
});

test("buildMonthAccountSummaryFromTransactions groups deleted accounts by snapshot name", () => {
  const summaries = buildMonthAccountSummaryFromTransactions(
    [
      {
        date: "2026-08-01",
        amount: 100,
        type: "expense",
        accountId: null,
        accountName: "解約した口座",
      },
      {
        date: "2026-08-02",
        amount: 200,
        type: "expense",
        accountId: null,
        accountName: "解約した口座",
      },
      {
        date: "2026-08-02",
        amount: 300,
        type: "expense",
        accountId: null,
        accountName: "",
      },
    ],
    2026,
    8,
  );

  // 同額なので並びは口座名順に落ち着く。
  assert.deepEqual(summaries, [
    {
      accountId: "snapshot:解約した口座",
      accountName: "解約した口座",
      income: 0,
      expense: 300,
      net: -300,
    },
    {
      accountId: "",
      accountName: "口座なし",
      income: 0,
      expense: 300,
      net: -300,
    },
  ]);
});

test("buildMonthAccountSummaryFromTransactions orders by how much moved through the account", () => {
  const summaries = buildMonthAccountSummaryFromTransactions(
    [
      {
        date: "2026-08-01",
        amount: 100,
        type: "expense",
        accountId: "small",
        accountName: "小口",
      },
      {
        date: "2026-08-01",
        amount: 5000,
        type: "income",
        accountId: "big",
        accountName: "大口",
      },
    ],
    2026,
    8,
  );

  assert.deepEqual(
    summaries.map((summary) => summary.accountId),
    ["big", "small"],
  );
});

test("buildAccountSummaryTotals adds up every account", () => {
  const summaries = buildMonthAccountSummaryFromTransactions(
    transactions,
    2026,
    8,
  );
  assert.deepEqual(buildAccountSummaryTotals(summaries), {
    income: 300000,
    expense: 51200,
    net: 248800,
  });
});

test("buildAccountSummaryTotals handles an empty month", () => {
  assert.deepEqual(buildAccountSummaryTotals([]), {
    income: 0,
    expense: 0,
    net: 0,
  });
});
