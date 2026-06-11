import type { ParsedImportRow } from "./csvImportParse";
import type { TransactionType } from "./firestore";

export type ResolveMasterAccount = {
  id: string;
  name: string;
};

export type ResolveMasterCategory = {
  id: string;
  name: string;
  type: TransactionType;
  color: string;
};

export type ResolveMasterBreakdown = {
  id: string;
  categoryId: string;
  name: string;
};

export type ResolveMasterStore = {
  id: string;
  name: string;
};

export type ResolveImportMasters = {
  accounts: ResolveMasterAccount[];
  categories: ResolveMasterCategory[];
  breakdowns: ResolveMasterBreakdown[];
  stores: ResolveMasterStore[];
  defaultAccountId: string;
};

export type ResolvedImportRow = {
  line: number;
  date: string;
  type: TransactionType;
  amount: number;
  memo: string;
  accountId: string;
  categoryId: string | null;
  breakdownId: string | null;
  storeId: string | null;
  accountName: string;
  categoryName: string;
  categoryColor: string | null;
  breakdownName: string;
  storeName: string;
};

export function resolveImportRows(
  rows: ParsedImportRow[],
  masters: ResolveImportMasters,
): ResolvedImportRow[] {
  const accountByName = new Map<string, ResolveMasterAccount>();
  for (const account of masters.accounts) {
    accountByName.set(account.name.trim(), account);
  }

  const categoryByTypeName = new Map<string, ResolveMasterCategory>();
  for (const category of masters.categories) {
    categoryByTypeName.set(
      `${category.type}\u0000${category.name.trim()}`,
      category,
    );
  }

  const breakdownByCategoryName = new Map<string, ResolveMasterBreakdown>();
  for (const breakdown of masters.breakdowns) {
    breakdownByCategoryName.set(
      `${breakdown.categoryId}\u0000${breakdown.name.trim()}`,
      breakdown,
    );
  }

  const storeByName = new Map<string, ResolveMasterStore>();
  for (const store of masters.stores) {
    storeByName.set(store.name.trim(), store);
  }

  return rows.map((row) => {
    const account = row.accountName
      ? accountByName.get(row.accountName)
      : undefined;
    const category = row.categoryName
      ? categoryByTypeName.get(`${row.type}\u0000${row.categoryName}`)
      : undefined;
    const breakdown =
      category && row.breakdownName
        ? breakdownByCategoryName.get(
            `${category.id}\u0000${row.breakdownName}`,
          )
        : undefined;
    const store = row.storeName ? storeByName.get(row.storeName) : undefined;

    return {
      line: row.line,
      date: row.date,
      type: row.type,
      amount: row.amount,
      memo: row.memo,
      accountId: account?.id ?? masters.defaultAccountId,
      categoryId: category?.id ?? null,
      breakdownId: breakdown?.id ?? null,
      storeId: store?.id ?? null,
      accountName: row.accountName,
      categoryName: row.categoryName,
      categoryColor: category?.color ?? null,
      breakdownName: row.breakdownName,
      storeName: row.storeName,
    };
  });
}
