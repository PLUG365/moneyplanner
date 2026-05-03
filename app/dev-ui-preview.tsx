import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import HistorySearchPanel, {
  type HistorySearchDateTarget,
} from "@/components/HistorySearchPanel";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import {
  filterHistoryTransactions,
  type HistorySearchType,
} from "@/lib/historySearch";
import {
  buildHistorySearchPreviewOptions,
  historySearchPreviewTransactions,
  type HistorySearchPreviewTransaction,
} from "@/lib/historySearchPreview";

function formatAmount(amount: number): string {
  return amount.toLocaleString("ja-JP");
}

function displayDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return `${year}年${month}月${day}日`;
}

export default function DevUiPreviewScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();

  const [searchType, setSearchType] = useState<HistorySearchType>("expense");
  const [categoryName, setCategoryName] = useState("");
  const [breakdownName, setBreakdownName] = useState("");
  const [storeName, setStoreName] = useState("");
  const [memoQuery, setMemoQuery] = useState("");
  const [fromDate, setFromDate] = useState<string | null>(null);
  const [toDate, setToDate] = useState<string | null>(null);
  const [datePickerTarget, setDatePickerTarget] =
    useState<HistorySearchDateTarget | null>(null);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

  const options = useMemo(
    () =>
      buildHistorySearchPreviewOptions(
        historySearchPreviewTransactions,
        searchType,
        categoryName,
      ),
    [categoryName, searchType],
  );

  const previewTransactions = useMemo(
    () =>
      filterHistoryTransactions(historySearchPreviewTransactions, {
        type: searchType,
        categoryName,
        breakdownName,
        storeName,
        memoQuery,
        fromDate,
        toDate,
      }),
    [
      breakdownName,
      categoryName,
      fromDate,
      memoQuery,
      searchType,
      storeName,
      toDate,
    ],
  );

  const clearConditions = () => {
    setCategoryName("");
    setBreakdownName("");
    setStoreName("");
    setMemoQuery("");
    setFromDate(null);
    setToDate(null);
    setDatePickerTarget(null);
  };

  const handleTypeChange = (nextType: HistorySearchType) => {
    setSearchType(nextType);
    clearConditions();
  };

  const renderTransaction = (tx: HistorySearchPreviewTransaction) => (
    <View
      key={tx.id}
      style={[
        styles.txItem,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View
        style={[styles.categoryDot, { backgroundColor: tx.categoryColor }]}
      />
      <View style={styles.txMain}>
        <Text style={[styles.txCategory, { color: colors.text }]}>
          {tx.categoryName}
        </Text>
        {tx.breakdownName ? (
          <Text style={[styles.txMeta, { color: colors.subText }]}>
            {tx.breakdownName}
          </Text>
        ) : null}
        {tx.storeName ? (
          <Text style={[styles.txMeta, { color: colors.subText }]}>
            {tx.storeName}
          </Text>
        ) : null}
        <Text style={[styles.txMeta, { color: colors.subText }]}>
          {`${tx.accountName} / ${displayDate(tx.date)}`}
        </Text>
        {tx.memo ? (
          <Text style={[styles.txMeta, { color: colors.subText }]}>
            {tx.memo}
          </Text>
        ) : null}
      </View>
      <Text
        style={[
          styles.txAmount,
          { color: tx.type === "income" ? colors.income : colors.expense },
        ]}
      >
        {tx.type === "income" ? "+" : "-"}¥{formatAmount(tx.amount)}
      </Text>
    </View>
  );

  if (!__DEV__) {
    router.replace("/(tabs)/settings");
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 12,
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={[styles.backText, { color: colors.tint }]}>戻る</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={[styles.title, { color: colors.text }]}>
            UIプレビュー
          </Text>
          <Text style={[styles.subtitle, { color: colors.subText }]}>
            履歴検索パネル
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <HistorySearchPanel
          colors={colors}
          type={searchType}
          categoryName={categoryName}
          breakdownName={breakdownName}
          storeName={storeName}
          memoQuery={memoQuery}
          fromDate={fromDate}
          toDate={toDate}
          datePickerTarget={datePickerTarget}
          categoryOptions={options.categoryOptions}
          breakdownOptions={options.breakdownOptions}
          storeOptions={options.storeOptions}
          expanded={isSearchExpanded}
          onExpandedChange={setIsSearchExpanded}
          onTypeChange={handleTypeChange}
          onCategoryNameChange={setCategoryName}
          onBreakdownNameChange={setBreakdownName}
          onStoreNameChange={setStoreName}
          onMemoQueryChange={setMemoQuery}
          onFromDateChange={setFromDate}
          onToDateChange={setToDate}
          onDatePickerTargetChange={setDatePickerTarget}
          onClearConditions={clearConditions}
        />

        <Text style={[styles.resultTitle, { color: colors.subText }]}>
          表示結果 {previewTransactions.length}件
        </Text>
        {previewTransactions.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.subText }]}>
            条件に一致するサンプルがありません
          </Text>
        ) : (
          previewTransactions.map(renderTransaction)
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backButton: {
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  backText: { fontSize: 15, fontWeight: "700" },
  headerTitleWrap: { flex: 1 },
  title: { fontSize: 18, fontWeight: "700" },
  subtitle: { fontSize: 12, marginTop: 2 },
  content: { paddingTop: 12, paddingBottom: 40 },
  resultTitle: {
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: "700",
  },
  emptyText: {
    marginHorizontal: 12,
    marginTop: 10,
    fontSize: 14,
    textAlign: "center",
  },
  txItem: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginHorizontal: 12,
    marginBottom: 8,
  },
  categoryDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  txMain: { flex: 1, minWidth: 0 },
  txCategory: { fontSize: 15, fontWeight: "700" },
  txMeta: { fontSize: 12, marginTop: 2 },
  txAmount: { fontSize: 16, fontWeight: "700", marginLeft: 10 },
});
