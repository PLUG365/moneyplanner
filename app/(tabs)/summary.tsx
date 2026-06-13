import { router, useFocusEffect, type Href } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

import MonthPickerModal from "@/components/MonthPickerModal";
import ProgressOverlay from "@/components/ProgressOverlay";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useCachedTransactions } from "@/hooks/useCachedTransactions";
import { useCollection, useHouseholdId } from "@/hooks/useFirestore";
import {
    BudgetDefinition,
    BudgetStatus,
    Category,
    householdCollection,
    mapBudgetDefinition,
    mapCategory,
    MonthlyCategorySummary,
    MonthlyTotal,
} from "@/lib/firestore";
import { buildFirestoreQueryKey } from "@/lib/firestoreSubscription";
import { buildHistoryDrilldownParams } from "@/lib/historyDrilldown";
import { formatYearMonthLabel, shiftYearMonth } from "@/lib/monthPicker";
import {
    buildBudgetStatusesFromData,
    buildMonthCategorySummaryFromTransactions,
    buildYearMonthlyTotalsFromTransactions,
} from "@/lib/summaryAggregation";

type ViewMode = "monthly" | "yearly";

function fmt(n: number): string {
  return n.toLocaleString("ja-JP");
}

const MONTH_LABELS = [
  "1月",
  "2月",
  "3月",
  "4月",
  "5月",
  "6月",
  "7月",
  "8月",
  "9月",
  "10月",
  "11月",
  "12月",
];

export default function SummaryScreen() {
  const { colors } = useAppTheme();
  const householdId = useHouseholdId();

  const now = new Date();
  const [viewMode, setViewMode] = useState<ViewMode>("monthly");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [showPeriodPicker, setShowPeriodPicker] = useState(false);
  const yearScope = String(year);
  const {
    data: transactionData,
    loading: transactionLoading,
    fromCache: transactionFromCache,
    refreshIfStale: refreshTransactionsIfStale,
  } = useCachedTransactions(householdId, {
    scopeKey: `summary-year:${yearScope}`,
    range: { from: `${year}-01-01`, to: `${year}-12-31` },
  });
  const budgetSubscription = useCollection<BudgetDefinition>(
    buildFirestoreQueryKey(householdId, "budgets"),
    () => (householdId ? householdCollection(householdId, "budgets") : null),
    mapBudgetDefinition,
  );
  const categorySubscription = useCollection<Category>(
    buildFirestoreQueryKey(householdId, "categories", "expense"),
    () =>
      householdId
        ? householdCollection(householdId, "categories").where(
            "type",
            "==",
            "expense",
          )
        : null,
    mapCategory,
  );

  useFocusEffect(
    useCallback(() => {
      refreshTransactionsIfStale();
    }, [refreshTransactionsIfStale]),
  );

  const categorySummary: MonthlyCategorySummary[] = useMemo(
    () =>
      buildMonthCategorySummaryFromTransactions(transactionData, year, month),
    [month, transactionData, year],
  );
  const budgetStatuses: BudgetStatus[] = useMemo(
    () =>
      buildBudgetStatusesFromData({
        year,
        month,
        transactions: transactionData,
        budgets: budgetSubscription.data,
        categories: categorySubscription.data,
        fromCache:
          transactionFromCache ||
          budgetSubscription.fromCache ||
          categorySubscription.fromCache,
      }),
    [
      budgetSubscription.data,
      budgetSubscription.fromCache,
      categorySubscription.data,
      categorySubscription.fromCache,
      month,
      transactionData,
      transactionFromCache,
      year,
    ],
  );
  const yearlyData: MonthlyTotal[] = useMemo(
    () => buildYearMonthlyTotalsFromTransactions(transactionData, year),
    [transactionData, year],
  );
  const loading =
    transactionLoading ||
    budgetSubscription.loading ||
    categorySubscription.loading;

  const prevPeriod = () => {
    if (viewMode === "monthly") {
      const next = shiftYearMonth(year, month, -1);
      setYear(next.year);
      setMonth(next.month);
    } else {
      setYear((y) => y - 1);
    }
  };

  const nextPeriod = () => {
    if (viewMode === "monthly") {
      const next = shiftYearMonth(year, month, 1);
      setYear(next.year);
      setMonth(next.month);
    } else {
      setYear((y) => y + 1);
    }
  };

  const openHistoryDrilldown = (item: {
    type: "income" | "expense";
    categoryName: string;
  }) => {
    router.push({
      pathname: "/(tabs)/history",
      params: {
        ...buildHistoryDrilldownParams({
          type: item.type,
          categoryName: item.categoryName,
          year,
          month,
        }),
        drilldownAt: String(Date.now()),
      },
    } as Href);
  };

  const incomeColor = colors.income;
  const expenseColor = colors.expense;
  const warningColor = colors.warning;
  const exceededColor = colors.exceeded;
  const safeColor = colors.safe;
  const statusTintAlpha = colors.mode === "dark" ? "29" : "1A";

  const incomeItems = categorySummary.filter((s) => s.type === "income");
  const expenseItems = categorySummary.filter((s) => s.type === "expense");
  const totalIncome = incomeItems.reduce((s, c) => s + c.total, 0);
  const totalExpense = expenseItems.reduce((s, c) => s + c.total, 0);
  const balance = totalIncome - totalExpense;

  const yearTotalIncome = yearlyData.reduce((s, m) => s + m.income, 0);
  const yearTotalExpense = yearlyData.reduce((s, m) => s + m.expense, 0);
  const yearBalance = yearTotalIncome - yearTotalExpense;

  const getStatusMeta = (status: BudgetStatus) => {
    if (status.level === "exceeded") {
      return {
        label: "超過",
        color: exceededColor,
        tint: exceededColor + statusTintAlpha,
      };
    }
    if (status.level === "warning") {
      return {
        label: "注意",
        color: warningColor,
        tint: warningColor + statusTintAlpha,
      };
    }
    return {
      label: "安全",
      color: safeColor,
      tint: safeColor + statusTintAlpha,
    };
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* セグメント */}
      <View
        style={[
          styles.segmentContainer,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.segmentButton,
            viewMode === "monthly" && { backgroundColor: colors.tint },
          ]}
          onPress={() => setViewMode("monthly")}
        >
          <Text
            style={[
              styles.segmentText,
              viewMode === "monthly" && { color: "#fff" },
            ]}
          >
            月次
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.segmentButton,
            viewMode === "yearly" && { backgroundColor: colors.tint },
          ]}
          onPress={() => setViewMode("yearly")}
        >
          <Text
            style={[
              styles.segmentText,
              viewMode === "yearly" && { color: "#fff" },
            ]}
          >
            年次
          </Text>
        </TouchableOpacity>
      </View>

      {/* 期間ナビゲーション */}
      <View
        style={[
          styles.monthNav,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <TouchableOpacity onPress={prevPeriod} style={styles.navButton}>
          <Text style={[styles.navArrow, { color: colors.tint }]}>‹</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.monthTitleButton}
          onPress={() => setShowPeriodPicker((visible) => !visible)}
        >
          <Text style={[styles.monthTitle, { color: colors.text }]}>
            {formatYearMonthLabel(year, month, viewMode)}
          </Text>
          <Text style={[styles.monthJumpHint, { color: colors.subText }]}>
            変更
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={nextPeriod} style={styles.navButton}>
          <Text style={[styles.navArrow, { color: colors.tint }]}>›</Text>
        </TouchableOpacity>
      </View>

      {showPeriodPicker ? (
        <MonthPickerModal
          visible={showPeriodPicker}
          colors={colors}
          year={year}
          month={month}
          title="集計月を選択"
          onClose={() => setShowPeriodPicker(false)}
          onChange={(nextYear, nextMonth) => {
            setYear(nextYear);
            setMonth(nextMonth);
          }}
        />
      ) : null}

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {viewMode === "monthly" ? (
          <>
            {/* サマリーカード */}
            <View
              style={[
                styles.summaryCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text
                    style={[styles.summaryLabel, { color: colors.subText }]}
                  >
                    収入
                  </Text>
                  <Text style={[styles.summaryValue, { color: incomeColor }]}>
                    ¥{fmt(totalIncome)}
                  </Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text
                    style={[styles.summaryLabel, { color: colors.subText }]}
                  >
                    支出
                  </Text>
                  <Text style={[styles.summaryValue, { color: expenseColor }]}>
                    ¥{fmt(totalExpense)}
                  </Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text
                    style={[styles.summaryLabel, { color: colors.subText }]}
                  >
                    収支
                  </Text>
                  <Text
                    style={[
                      styles.summaryValue,
                      { color: balance >= 0 ? incomeColor : expenseColor },
                    ]}
                  >
                    {balance >= 0 ? "+" : ""}¥{fmt(balance)}
                  </Text>
                </View>
              </View>
            </View>

            {budgetStatuses.length > 0 && (
              <View
                style={[
                  styles.tableCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.tableTitle, { color: expenseColor }]}>
                  予算進捗（支出）
                </Text>
                {budgetStatuses.map((item) => {
                  const meta = getStatusMeta(item);
                  const progressWidth =
                    `${Math.min(item.usageRate * 100, 100)}%` as `${number}%`;
                  const percent = Math.round(item.usageRate * 100);
                  const delta = item.budgetAmount - item.spentAmount;
                  return (
                    <TouchableOpacity
                      key={`budget-${item.categoryId}`}
                      style={[
                        styles.budgetRow,
                        {
                          borderTopColor: colors.border,
                          backgroundColor: meta.tint,
                        },
                      ]}
                      activeOpacity={0.75}
                      onPress={() =>
                        openHistoryDrilldown({
                          type: "expense",
                          categoryName: item.categoryName,
                        })
                      }
                    >
                      <View style={styles.budgetHeaderRow}>
                        <View style={styles.budgetNameWrap}>
                          <View
                            style={[
                              styles.categoryDot,
                              { backgroundColor: item.categoryColor },
                            ]}
                          />
                          <Text
                            style={[
                              styles.categoryName,
                              { color: colors.text },
                            ]}
                          >
                            {item.categoryName}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.statusBadge,
                            {
                              borderColor: meta.color,
                              backgroundColor: "transparent",
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusBadgeText,
                              { color: meta.color },
                            ]}
                          >
                            {meta.label}
                          </Text>
                        </View>
                      </View>

                      <View
                        style={[
                          styles.progressTrack,
                          { backgroundColor: colors.track },
                        ]}
                      >
                        <View
                          style={[
                            styles.progressFill,
                            {
                              width: progressWidth,
                              backgroundColor: meta.color,
                            },
                          ]}
                        />
                      </View>

                      <Text
                        style={[
                          styles.budgetDetailText,
                          { color: colors.subText },
                        ]}
                      >
                        使用率 {percent}% / 予算 ¥{fmt(item.budgetAmount)} /
                        支出 ¥{fmt(item.spentAmount)}
                      </Text>
                      <Text
                        style={[styles.budgetDetailText, { color: meta.color }]}
                      >
                        {delta >= 0
                          ? `残り ¥${fmt(delta)}`
                          : `超過 ¥${fmt(Math.abs(delta))}`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* 収入カテゴリ */}
            {incomeItems.length > 0 && (
              <View
                style={[
                  styles.tableCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.tableTitle, { color: incomeColor }]}>
                  収入
                </Text>
                {incomeItems.map((item) => (
                  <TouchableOpacity
                    key={`${item.categoryId}-${item.categoryName}-${item.categoryColor}`}
                    style={[styles.tableRow, { borderTopColor: colors.border }]}
                    activeOpacity={0.75}
                    onPress={() => openHistoryDrilldown(item)}
                  >
                    <View
                      style={[
                        styles.categoryDot,
                        { backgroundColor: item.categoryColor },
                      ]}
                    />
                    <Text style={[styles.categoryName, { color: colors.text }]}>
                      {item.categoryName}
                    </Text>
                    <Text
                      style={[styles.categoryAmount, { color: incomeColor }]}
                    >
                      ¥{fmt(item.total)}
                    </Text>
                    <Text
                      style={[styles.rowChevron, { color: colors.subText }]}
                    >
                      ›
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[
                    styles.tableRow,
                    styles.totalRow,
                    { borderTopColor: colors.border },
                  ]}
                  activeOpacity={0.75}
                  onPress={() =>
                    openHistoryDrilldown({
                      type: "income",
                      categoryName: "",
                    })
                  }
                >
                  <Text style={[styles.totalLabel, { color: colors.subText }]}>
                    合計
                  </Text>
                  <Text style={[styles.totalAmount, { color: incomeColor }]}>
                    ¥{fmt(totalIncome)}
                  </Text>
                  <Text style={[styles.rowChevron, { color: colors.subText }]}>
                    ›
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* 支出カテゴリ */}
            {expenseItems.length > 0 && (
              <View
                style={[
                  styles.tableCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.tableTitle, { color: expenseColor }]}>
                  支出
                </Text>
                {expenseItems.map((item) => (
                  <TouchableOpacity
                    key={`${item.categoryId}-${item.categoryName}-${item.categoryColor}`}
                    style={[styles.tableRow, { borderTopColor: colors.border }]}
                    activeOpacity={0.75}
                    onPress={() => openHistoryDrilldown(item)}
                  >
                    <View
                      style={[
                        styles.categoryDot,
                        { backgroundColor: item.categoryColor },
                      ]}
                    />
                    <Text style={[styles.categoryName, { color: colors.text }]}>
                      {item.categoryName}
                    </Text>
                    <Text
                      style={[styles.categoryAmount, { color: expenseColor }]}
                    >
                      ¥{fmt(item.total)}
                    </Text>
                    <Text
                      style={[styles.rowChevron, { color: colors.subText }]}
                    >
                      ›
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[
                    styles.tableRow,
                    styles.totalRow,
                    { borderTopColor: colors.border },
                  ]}
                  activeOpacity={0.75}
                  onPress={() =>
                    openHistoryDrilldown({
                      type: "expense",
                      categoryName: "",
                    })
                  }
                >
                  <Text style={[styles.totalLabel, { color: colors.subText }]}>
                    合計
                  </Text>
                  <Text style={[styles.totalAmount, { color: expenseColor }]}>
                    ¥{fmt(totalExpense)}
                  </Text>
                  <Text style={[styles.rowChevron, { color: colors.subText }]}>
                    ›
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {categorySummary.length === 0 && (
              <Text style={[styles.emptyText, { color: colors.subText }]}>
                記録がありません
              </Text>
            )}
          </>
        ) : (
          <>
            {/* 年次サマリー */}
            <View
              style={[
                styles.summaryCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text
                    style={[styles.summaryLabel, { color: colors.subText }]}
                  >
                    収入合計
                  </Text>
                  <Text style={[styles.summaryValue, { color: incomeColor }]}>
                    ¥{fmt(yearTotalIncome)}
                  </Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text
                    style={[styles.summaryLabel, { color: colors.subText }]}
                  >
                    支出合計
                  </Text>
                  <Text style={[styles.summaryValue, { color: expenseColor }]}>
                    ¥{fmt(yearTotalExpense)}
                  </Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text
                    style={[styles.summaryLabel, { color: colors.subText }]}
                  >
                    収支
                  </Text>
                  <Text
                    style={[
                      styles.summaryValue,
                      { color: yearBalance >= 0 ? incomeColor : expenseColor },
                    ]}
                  >
                    {yearBalance >= 0 ? "+" : ""}¥{fmt(yearBalance)}
                  </Text>
                </View>
              </View>
            </View>

            {/* 月別テーブル */}
            <View
              style={[
                styles.tableCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View
                style={[
                  styles.tableHeaderRow,
                  { borderBottomColor: colors.border },
                ]}
              >
                <Text
                  style={[
                    styles.tableHeaderCell,
                    { color: colors.subText, flex: 1 },
                  ]}
                >
                  月
                </Text>
                <Text
                  style={[
                    styles.tableHeaderCell,
                    { color: incomeColor, flex: 2, textAlign: "right" },
                  ]}
                >
                  収入
                </Text>
                <Text
                  style={[
                    styles.tableHeaderCell,
                    { color: expenseColor, flex: 2, textAlign: "right" },
                  ]}
                >
                  支出
                </Text>
                <Text
                  style={[
                    styles.tableHeaderCell,
                    { color: colors.subText, flex: 2, textAlign: "right" },
                  ]}
                >
                  収支
                </Text>
              </View>
              {yearlyData.map((row) => {
                const bal = row.income - row.expense;
                const hasData = row.income > 0 || row.expense > 0;
                return (
                  <View
                    key={row.month}
                    style={[
                      styles.yearTableRow,
                      { borderTopColor: colors.border },
                    ]}
                  >
                    <Text
                      style={[styles.yearMonthLabel, { color: colors.text }]}
                    >
                      {MONTH_LABELS[row.month - 1]}
                    </Text>
                    <Text
                      style={[
                        styles.yearCell,
                        { color: hasData ? incomeColor : colors.subText },
                      ]}
                    >
                      {hasData ? `¥${fmt(row.income)}` : "-"}
                    </Text>
                    <Text
                      style={[
                        styles.yearCell,
                        { color: hasData ? expenseColor : colors.subText },
                      ]}
                    >
                      {hasData ? `¥${fmt(row.expense)}` : "-"}
                    </Text>
                    <Text
                      style={[
                        styles.yearCell,
                        {
                          color: !hasData
                            ? colors.subText
                            : bal >= 0
                              ? incomeColor
                              : expenseColor,
                        },
                      ]}
                    >
                      {!hasData ? "-" : `${bal >= 0 ? "+" : ""}¥${fmt(bal)}`}
                    </Text>
                  </View>
                );
              })}
              <View
                style={[
                  styles.yearTableRow,
                  styles.totalRow,
                  { borderTopColor: colors.border },
                ]}
              >
                <Text
                  style={[
                    styles.yearMonthLabel,
                    { color: colors.text, fontWeight: "700" },
                  ]}
                >
                  合計
                </Text>
                <Text
                  style={[
                    styles.yearCell,
                    { color: incomeColor, fontWeight: "700" },
                  ]}
                >
                  ¥{fmt(yearTotalIncome)}
                </Text>
                <Text
                  style={[
                    styles.yearCell,
                    { color: expenseColor, fontWeight: "700" },
                  ]}
                >
                  ¥{fmt(yearTotalExpense)}
                </Text>
                <Text
                  style={[
                    styles.yearCell,
                    {
                      color: yearBalance >= 0 ? incomeColor : expenseColor,
                      fontWeight: "700",
                    },
                  ]}
                >
                  {yearBalance >= 0 ? "+" : ""}¥{fmt(yearBalance)}
                </Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <ProgressOverlay visible={loading} message="読み込み中…" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  segmentContainer: {
    flexDirection: "row",
    margin: 12,
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
  },
  segmentText: { fontSize: 15, fontWeight: "600", color: "#999" },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 8,
  },
  navButton: { padding: 8 },
  navArrow: { fontSize: 26 },
  monthTitleButton: { alignItems: "center", paddingVertical: 6, flex: 1 },
  monthTitle: { fontSize: 17, fontWeight: "700" },
  monthJumpHint: { fontSize: 11, fontWeight: "700", marginTop: 2 },
  scrollContent: { paddingHorizontal: 12, paddingBottom: 100 },
  emptyText: { textAlign: "center", marginTop: 48, fontSize: 15 },
  summaryCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  summaryRow: { flexDirection: "row", alignItems: "center" },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryLabel: { fontSize: 12, marginBottom: 4 },
  summaryValue: { fontSize: 16, fontWeight: "700" },
  summaryDivider: { width: 1, height: 40, backgroundColor: "#E0E0E0" },
  tableCard: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    overflow: "hidden",
  },
  tableTitle: {
    fontSize: 14,
    fontWeight: "700",
    padding: 12,
    paddingBottom: 8,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  categoryDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  categoryName: { flex: 1, fontSize: 14 },
  categoryAmount: { fontSize: 14, fontWeight: "600" },
  rowChevron: { fontSize: 18, fontWeight: "700", marginLeft: 8 },
  totalRow: { backgroundColor: "rgba(0,0,0,0.03)" },
  totalLabel: { flex: 1, fontSize: 13, fontWeight: "600" },
  totalAmount: { fontSize: 15, fontWeight: "700" },
  tableHeaderRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tableHeaderCell: { fontSize: 12, fontWeight: "600" },
  yearTableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  yearMonthLabel: { flex: 1, fontSize: 14 },
  yearCell: { flex: 2, fontSize: 13, textAlign: "right" },
  budgetRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  budgetHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  budgetNameWrap: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  statusBadgeText: { fontSize: 11, fontWeight: "700" },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressFill: { height: "100%", borderRadius: 999 },
  budgetDetailText: { fontSize: 12, fontWeight: "600", marginBottom: 2 },
  inlineDatePickerWrap: {
    marginBottom: 8,
    borderWidth: 1,
    borderRadius: 10,
    overflow: "hidden",
  },
});
