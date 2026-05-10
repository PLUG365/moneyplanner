import type { TransactionType } from "./firestore";

type CopySource = {
  id: string;
  type: TransactionType;
  categoryId: string | null;
  categoryName: string;
  breakdownId: string | null;
  breakdownName: string;
  accountId: string;
  accountName: string;
};

type CopyCategory = {
  id: string;
  name: string;
  type: TransactionType;
};

type CopyBreakdown = {
  id: string;
  categoryId: string;
  name: string;
};

type CopyAccount = {
  id: string;
  name: string;
};

type ResolveContext = {
  categories: CopyCategory[];
  breakdownsByCategory: Map<string, CopyBreakdown[]>;
  accounts: CopyAccount[];
  defaultAccountId: string;
};

type MasterSelectionSource = {
  type: TransactionType;
  categoryId: string | null;
  categoryName: string;
  breakdownId: string | null;
  breakdownName: string;
};

type MasterSelectionContext = {
  categories: CopyCategory[];
  breakdownsByCategory: Map<string, CopyBreakdown[]>;
};

export type MasterSelection = {
  categoryId: string;
  breakdownId: string | null;
};

export type CopyTarget = {
  categoryId: string;
  breakdownId: string | null;
  accountId: string;
  accountFallback: boolean;
};

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function buildBreakdownsByCategory<T extends CopyBreakdown>(
  breakdowns: T[],
): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const breakdown of breakdowns) {
    const categoryBreakdowns = result.get(breakdown.categoryId) ?? [];
    categoryBreakdowns.push(breakdown);
    result.set(breakdown.categoryId, categoryBreakdowns);
  }
  return result;
}

export function resolveTransactionMasterSelection(
  source: MasterSelectionSource,
  context: MasterSelectionContext,
): MasterSelection | null {
  const candidateCategories = context.categories.filter(
    (category) => category.type === source.type,
  );

  const category = source.categoryId
    ? candidateCategories.find(
        (candidate) => candidate.id === source.categoryId,
      )
    : undefined;
  const resolvedCategory =
    category ??
    candidateCategories.find(
      (candidate) =>
        normalize(candidate.name) === normalize(source.categoryName),
    );

  if (!resolvedCategory) {
    return null;
  }

  const breakdowns =
    context.breakdownsByCategory.get(resolvedCategory.id) ?? [];
  const breakdown = source.breakdownId
    ? breakdowns.find((candidate) => candidate.id === source.breakdownId)
    : undefined;
  const resolvedBreakdown =
    breakdown ??
    (source.breakdownName.trim()
      ? breakdowns.find(
          (candidate) =>
            normalize(candidate.name) === normalize(source.breakdownName),
        )
      : undefined);

  return {
    categoryId: resolvedCategory.id,
    breakdownId: resolvedBreakdown?.id ?? null,
  };
}

export function resolveTransactionCopyTarget(
  source: CopySource,
  context: ResolveContext,
): CopyTarget | null {
  const selection = resolveTransactionMasterSelection(source, context);
  if (!selection) {
    return null;
  }

  const account = context.accounts.find(
    (candidate) => candidate.id === source.accountId,
  );
  const accountByName = context.accounts.find(
    (candidate) => candidate.name === source.accountName,
  );
  const defaultAccount =
    context.accounts.find(
      (candidate) => candidate.id === context.defaultAccountId,
    ) ?? context.accounts[0];

  const resolvedAccountId =
    account?.id ??
    accountByName?.id ??
    defaultAccount?.id ??
    context.defaultAccountId;
  const accountFallback = !account && !accountByName;

  return {
    categoryId: selection.categoryId,
    breakdownId: selection.breakdownId,
    accountId: resolvedAccountId,
    accountFallback,
  };
}
