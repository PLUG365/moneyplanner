import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    Alert,
    Modal,
    Platform,
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
import TransactionEditor from "@/components/TransactionEditor";
import { useBottomTabOverflow } from "@/components/ui/TabBarBackground";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useCollection, useHouseholdId } from "@/hooks/useFirestore";
import {
    Account,
    addTransaction,
    Breakdown,
    Category,
    DEFAULT_ACCOUNT_ID,
    deleteTransactionFromPrevious,
    householdCollection,
    mapAccount,
    mapBreakdown,
    mapCategory,
    mapTransaction,
    reconcileAccountBalancesFromTransactions,
    Transaction,
    TransactionType,
    updateTransactionFromPrevious,
} from "@/lib/firestore";
import { buildFirestoreQueryKey } from "@/lib/firestoreSubscription";
import { parseHistoryDrilldownParams } from "@/lib/historyDrilldown";
import { buildHistoryListTransactions } from "@/lib/historyList";
import {
    filterHistoryTransactions,
    type HistorySearchType,
} from "@/lib/historySearch";
import {
    formatYearMonthLabel,
    fromYearMonthDate,
    shiftYearMonth,
    toYearMonthDate,
} from "@/lib/monthPicker";
import { waitForPendingWrite } from "@/lib/pendingWrite";
import { buildRecordCategoryOptions } from "@/lib/recordOptions";
import { resolveTransactionAmountInput } from "@/lib/transactionAmountInput";
import { isValidTransactionAmount } from "@/lib/transactionAmountValidation";
import {
    buildBreakdownsByCategory,
    resolveTransactionCopyTarget,
    resolveTransactionMasterSelection,
} from "@/lib/transactionCopy";
import { buildStoreEditResolution } from "@/lib/transactionStoreEdit";
import {
    fromYearMonthDate as fromYearMonthDateString,
    toYearMonthDate as toYearMonthDateString,
} from "@/lib/yearMonthDateRange";

type ViewMode = "list" | "calendar";
const WRITE_ACK_TIMEOUT_MS = 900;

type UncopiedRecord = {
  id: string;
  date: string;
  type: TransactionType;
  amount: number;
  categoryName: string;
  breakdownName: string;
};

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function formatAmount(amount: number): string {
  return amount.toLocaleString("ja-JP");
}

function parseYMD(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return { y, m, d };
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function displayDate(dateStr: string): string {
  const { y, m, d } = parseYMD(dateStr);
  return `${y}年${m}月${d}日`;
}

function toLocalDate(dateStr: string): Date {
  const { y, m, d } = parseYMD(dateStr);
  return new Date(y, m - 1, d);
}

function uniqueNonEmpty(values: (string | null | undefined)[]): string[] {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]),
  );
}

export default function HistoryScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const bottomTabOverflow = useBottomTabOverflow();
  const safeAreaInsets = useSafeAreaInsets();
  const householdId = useHouseholdId();
  const historyParams = useLocalSearchParams<{
    historyType?: string;
    categoryName?: string;
    fromDate?: string;
    toDate?: string;
    expandSearch?: string;
    drilldownAt?: string;
  }>();
  const {
    historyType,
    categoryName: drilldownCategoryName,
    fromDate: drilldownFromDate,
    toDate: drilldownToDate,
    expandSearch,
    drilldownAt,
  } = historyParams;

  const now = new Date();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [markedDates, setMarkedDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedDateTxs, setSelectedDateTxs] = useState<Transaction[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editAmountRaw, setEditAmountRaw] = useState("");
  const [editType, setEditType] = useState<TransactionType>("expense");
  const [editAccounts, setEditAccounts] = useState<Account[]>([]);
  const [editAccountId, setEditAccountId] = useState<string | null>(null);
  const [editCategoryId, setEditCategoryId] = useState<string | null>(null);
  const [editBreakdownId, setEditBreakdownId] = useState<string | null>(null);
  const [editMemo, setEditMemo] = useState("");
  const [editStoreId, setEditStoreId] = useState<string | null>(null);
  const [editStoreName, setEditStoreName] = useState("");
  const [editCategories, setEditCategories] = useState<Category[]>([]);
  const [editBreakdowns, setEditBreakdowns] = useState<Breakdown[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);
  const [showBulkCopyModal, setShowBulkCopyModal] = useState(false);
  const [copyDate, setCopyDate] = useState(formatDate(new Date()));
  const [showCopyDatePicker, setShowCopyDatePicker] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showUncopiedModal, setShowUncopiedModal] = useState(false);
  const [uncopiedRecords, setUncopiedRecords] = useState<UncopiedRecord[]>([]);
  const [historySearchType, setHistorySearchType] =
    useState<HistorySearchType>("all");
  const [historySearchCategoryName, setHistorySearchCategoryName] =
    useState("");
  const [historySearchBreakdownName, setHistorySearchBreakdownName] =
    useState("");
  const [historySearchStoreName, setHistorySearchStoreName] = useState("");
  const [historySearchMemoQuery, setHistorySearchMemoQuery] = useState("");
  const [historySearchFromDate, setHistorySearchFromDate] = useState<
    string | null
  >(null);
  const [historySearchToDate, setHistorySearchToDate] = useState<string | null>(
    null,
  );
  const [searchDatePickerTarget, setSearchDatePickerTarget] =
    useState<HistorySearchDateTarget | null>(null);
  const [isHistorySearchExpanded, setIsHistorySearchExpanded] = useState(false);

  const monthScope = `${year}-${String(month).padStart(2, "0")}`;
  const accountSubscription = useCollection<Account>(
    buildFirestoreQueryKey(householdId, "accounts", "history-edit"),
    () => (householdId ? householdCollection(householdId, "accounts") : null),
    mapAccount,
  );
  const allTransactionsSubscription = useCollection<Transaction>(
    buildFirestoreQueryKey(householdId, "transactions", "all"),
    () => {
      if (!householdId) return null;
      return householdCollection(householdId, "transactions").orderBy(
        "date",
        "desc",
      );
    },
    mapTransaction,
  );

  const monthTransactionsSubscription = useCollection<Transaction>(
    buildFirestoreQueryKey(householdId, "transactions", monthScope),
    () => {
      if (!householdId) return null;
      const from = fromYearMonthDateString(year, month);
      const to = toYearMonthDateString(year, month);
      return householdCollection(householdId, "transactions")
        .where("date", ">=", from)
        .where("date", "<=", to)
        .orderBy("date", "desc");
    },
    mapTransaction,
  );
  const categorySubscription = useCollection<Category>(
    buildFirestoreQueryKey(householdId, "categories", "history-edit"),
    () => (householdId ? householdCollection(householdId, "categories") : null),
    mapCategory,
  );
  const breakdownSubscription = useCollection<Breakdown>(
    buildFirestoreQueryKey(householdId, "breakdowns", "history-edit"),
    () => (householdId ? householdCollection(householdId, "breakdowns") : null),
    mapBreakdown,
  );

  const listTransactions = useMemo(
    () => buildHistoryListTransactions(allTransactionsSubscription.data),
    [allTransactionsSubscription.data],
  );

  const calendarTransactions = useMemo(
    () => buildHistoryListTransactions(monthTransactionsSubscription.data),
    [monthTransactionsSubscription.data],
  );

  const filteredListTransactions = useMemo(
    () =>
      filterHistoryTransactions(listTransactions, {
        type: historySearchType,
        categoryName: historySearchCategoryName,
        breakdownName: historySearchBreakdownName,
        storeName: historySearchStoreName,
        memoQuery: historySearchMemoQuery,
        fromDate: historySearchFromDate,
        toDate: historySearchToDate,
      }),
    [
      historySearchBreakdownName,
      historySearchCategoryName,
      historySearchFromDate,
      historySearchMemoQuery,
      historySearchStoreName,
      historySearchToDate,
      historySearchType,
      listTransactions,
    ],
  );

  const accountOptions = useMemo(
    () => [...accountSubscription.data],
    [accountSubscription.data],
  );
  const categoryOptions = useMemo(
    () => buildRecordCategoryOptions(categorySubscription.data),
    [categorySubscription.data],
  );
  const breakdownOptions = useMemo(
    () =>
      [...breakdownSubscription.data].sort((a, b) => {
        if (a.isDefault !== b.isDefault) return b.isDefault ? 1 : -1;
        return a.name.localeCompare(b.name);
      }),
    [breakdownSubscription.data],
  );
  const breakdownsByCategory = useMemo(
    () => buildBreakdownsByCategory(breakdownOptions),
    [breakdownOptions],
  );
  const selectedEditAccount = useMemo(
    () =>
      accountOptions.find((account) => account.id === editAccountId) ?? null,
    [accountOptions, editAccountId],
  );
  const selectedEditCategory = useMemo(
    () =>
      editCategories.find((category) => category.id === editCategoryId) ?? null,
    [editCategories, editCategoryId],
  );
  const selectedEditBreakdown = useMemo(
    () =>
      editBreakdowns.find((breakdown) => breakdown.id === editBreakdownId) ??
      null,
    [editBreakdowns, editBreakdownId],
  );

  const historySearchCategoryOptions = useMemo(
    () =>
      uniqueNonEmpty(
        listTransactions
          .filter((tx) => tx.type === historySearchType)
          .map((tx) => tx.categoryName),
      ),
    [historySearchType, listTransactions],
  );

  const historySearchBreakdownOptions = useMemo(
    () =>
      uniqueNonEmpty(
        listTransactions
          .filter(
            (tx) =>
              tx.type === historySearchType &&
              (!historySearchCategoryName ||
                tx.categoryName === historySearchCategoryName),
          )
          .map((tx) => tx.breakdownName),
      ),
    [historySearchCategoryName, historySearchType, listTransactions],
  );

  const historySearchStoreOptions = useMemo(
    () =>
      uniqueNonEmpty(
        listTransactions
          .filter(
            (tx) =>
              tx.type === "expense" &&
              (!historySearchCategoryName ||
                tx.categoryName === historySearchCategoryName),
          )
          .map((tx) => tx.storeName),
      ),
    [historySearchCategoryName, listTransactions],
  );

  const load = useCallback(async () => {
    setTransactions(filteredListTransactions);
    setMarkedDates(
      Array.from(new Set(calendarTransactions.map((tx) => tx.date))),
    );
    setSelectedDateTxs(
      selectedDate
        ? calendarTransactions.filter((tx) => tx.date === selectedDate)
        : [],
    );
  }, [calendarTransactions, filteredListTransactions, selectedDate]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const parsed = parseHistoryDrilldownParams({
      historyType,
      categoryName: drilldownCategoryName,
      fromDate: drilldownFromDate,
      toDate: drilldownToDate,
      expandSearch,
    });
    if (!parsed) return;

    setViewMode("list");
    setHistorySearchType(parsed.type);
    setHistorySearchCategoryName(parsed.categoryName);
    setHistorySearchBreakdownName("");
    setHistorySearchStoreName("");
    setHistorySearchMemoQuery("");
    setHistorySearchFromDate(parsed.fromDate || null);
    setHistorySearchToDate(parsed.toDate || null);
    setSearchDatePickerTarget(null);
    setIsHistorySearchExpanded(parsed.expandSearch);
    clearCalendarSelection();
  }, [
    drilldownAt,
    drilldownCategoryName,
    drilldownFromDate,
    drilldownToDate,
    expandSearch,
    historyType,
  ]);

  const clearHistorySearchConditions = () => {
    setHistorySearchType("all");
    setHistorySearchCategoryName("");
    setHistorySearchBreakdownName("");
    setHistorySearchStoreName("");
    setHistorySearchMemoQuery("");
    setHistorySearchFromDate(null);
    setHistorySearchToDate(null);
    setSearchDatePickerTarget(null);
  };

  const handleHistorySearchTypeChange = (nextType: HistorySearchType) => {
    setHistorySearchType(nextType);
    setHistorySearchCategoryName("");
    setHistorySearchBreakdownName("");
    setHistorySearchStoreName("");
    setHistorySearchMemoQuery("");
    setHistorySearchFromDate(null);
    setHistorySearchToDate(null);
    setSearchDatePickerTarget(null);
  };

  useFocusEffect(
    useCallback(() => {
      return () => {
        setIsSelectionMode(false);
        setSelectedTxIds([]);
        setShowBulkCopyModal(false);
        setShowCopyDatePicker(false);
        setShowUncopiedModal(false);
        setUncopiedRecords([]);
      };
    }, []),
  );

  const clearCalendarSelection = () => {
    setSelectedDate(null);
    setSelectedDateTxs([]);
  };

  const prevMonth = () => {
    const next = shiftYearMonth(year, month, -1);
    setYear(next.year);
    setMonth(next.month);
    clearCalendarSelection();
  };

  const nextMonth = () => {
    const next = shiftYearMonth(year, month, 1);
    setYear(next.year);
    setMonth(next.month);
    clearCalendarSelection();
  };

  const handleCalendarMonthChange = (selected: Date) => {
    const next = fromYearMonthDate(selected);
    setYear(next.year);
    setMonth(next.month);
    clearCalendarSelection();
  };

  const handleSwitchToCalendarView = () => {
    setViewMode("calendar");
    setSearchDatePickerTarget(null);
    // カレンダー表示時は検索条件を非適用にする
    setHistorySearchType("all");
    setHistorySearchCategoryName("");
    setHistorySearchBreakdownName("");
    setHistorySearchStoreName("");
    setHistorySearchMemoQuery("");
    setHistorySearchFromDate(null);
    setHistorySearchToDate(null);
  };

  const handleHistoryScrollBeginDrag = () => {
    setShowMonthPicker(false);
    setSearchDatePickerTarget(null);
  };

  const handleSwitchToListView = () => {
    setViewMode("list");
    clearCalendarSelection();
  };

  const handleDelete = (tx: Transaction) => {
    Alert.alert(
      "削除確認",
      `この記録を削除しますか？\n${tx.categoryName} ¥${formatAmount(tx.amount)}`,
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "削除",
          style: "destructive",
          onPress: async () => {
            await waitForPendingWrite(
              deleteTransactionFromPrevious(tx),
              WRITE_ACK_TIMEOUT_MS,
            );
          },
        },
      ],
    );
  };

  const handleDeleteFromEditModal = () => {
    if (!editingTx) return;
    const targetTx = editingTx;
    setShowEditModal(false);
    setEditingTx(null);
    setEditingTxId(null);
    handleDelete(targetTx);
  };

  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedTxIds([]);
  };

  const toggleSelection = (id: string) => {
    setSelectedTxIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id],
    );
  };

  const handleLongPressTransaction = (id: string) => {
    if (!isSelectionMode) {
      setIsSelectionMode(true);
      setSelectedTxIds([id]);
      return;
    }
    toggleSelection(id);
  };

  const handleOpenBulkCopy = () => {
    if (selectedTxIds.length === 0) {
      Alert.alert("未選択", "コピーする記録を選択してください");
      return;
    }
    setCopyDate(formatDate(new Date()));
    setShowBulkCopyModal(true);
  };

  const handleExecuteBulkCopy = async () => {
    if (selectedTxIds.length === 0) {
      Alert.alert("未選択", "コピーする記録を選択してください");
      return;
    }

    let copied = 0;
    let skipped = 0;
    let fallbackCount = 0;
    const failed: UncopiedRecord[] = [];
    const sourceMap = new Map(transactions.map((tx) => [tx.id, tx]));

    const categories = categoryOptions;
    const accounts = accountOptions;

    for (const id of selectedTxIds) {
      const tx = sourceMap.get(id);
      if (!tx) {
        skipped += 1;
        continue;
      }

      const target = resolveTransactionCopyTarget(tx, {
        categories,
        breakdownsByCategory,
        accounts,
        defaultAccountId: DEFAULT_ACCOUNT_ID,
      });
      if (!target) {
        skipped += 1;
        failed.push({
          id: tx.id,
          date: tx.date,
          type: tx.type,
          amount: tx.amount,
          categoryName: tx.categoryName,
          breakdownName: tx.breakdownName,
        });
        continue;
      }

      if (target.accountFallback) {
        fallbackCount += 1;
      }

      await waitForPendingWrite(
        addTransaction(
          copyDate,
          tx.amount,
          tx.type,
          target.categoryId,
          target.accountId,
          tx.memo ?? "",
          target.breakdownId,
          tx.storeId,
          {
            accountName:
              accounts.find((account) => account.id === target.accountId)
                ?.name ?? tx.accountName,
            categoryName:
              categories.find((category) => category.id === target.categoryId)
                ?.name ?? tx.categoryName,
            categoryColor:
              categories.find((category) => category.id === target.categoryId)
                ?.color ?? tx.categoryColor,
            breakdownName:
              (target.breakdownId
                ? breakdownsByCategory
                    .get(target.categoryId)
                    ?.find((breakdown) => breakdown.id === target.breakdownId)
                    ?.name
                : "") ?? tx.breakdownName,
            storeName: tx.storeName,
          },
        ),
        WRITE_ACK_TIMEOUT_MS,
      );
      copied += 1;
    }

    setShowBulkCopyModal(false);
    setShowCopyDatePicker(false);
    exitSelectionMode();
    await load();

    setUncopiedRecords(failed);
    setShowUncopiedModal(failed.length > 0);

    if (copied === 0 && failed.length > 0) {
      return;
    }
    if (copied === 0) {
      Alert.alert("コピーできませんでした", "コピー対象が見つかりません");
      return;
    }
    if (failed.length > 0 || skipped > 0) {
      let message = `${copied}件コピーしました（${Math.max(failed.length, skipped)}件未コピー）`;
      if (fallbackCount > 0) {
        message += `\n口座が存在しない${fallbackCount}件は既定口座で登録されました。`;
      }
      Alert.alert("一括コピー完了", message);
      return;
    }
    let message = `${copied}件コピーしました`;
    if (fallbackCount > 0) {
      message += `\n口座が存在しない${fallbackCount}件は既定口座で登録されました。`;
    }
    Alert.alert("一括コピー完了", message);
  };

  const syncEditCategories = (
    type: TransactionType,
    preferredCategoryId?: string | null,
    preferredBreakdownId?: string | null,
    preferredCategoryName = "",
    preferredBreakdownName = "",
  ) => {
    const cats = categoryOptions.filter((category) => category.type === type);
    setEditCategories(cats);

    const initialSelection = resolveTransactionMasterSelection(
      {
        type,
        categoryId: preferredCategoryId ?? null,
        categoryName: preferredCategoryName,
        breakdownId: preferredBreakdownId ?? null,
        breakdownName: preferredBreakdownName,
      },
      { categories: cats, breakdownsByCategory: new Map() },
    );
    const nextCategoryId = initialSelection?.categoryId ?? cats[0]?.id ?? null;
    setEditCategoryId(nextCategoryId);

    if (nextCategoryId) {
      const bds = breakdownsByCategory.get(nextCategoryId) ?? [];
      setEditBreakdowns(bds);
      const selection = resolveTransactionMasterSelection(
        {
          type,
          categoryId: nextCategoryId,
          categoryName: preferredCategoryName,
          breakdownId: preferredBreakdownId ?? null,
          breakdownName: preferredBreakdownName,
        },
        {
          categories: cats,
          breakdownsByCategory: new Map([[nextCategoryId, bds]]),
        },
      );
      setEditBreakdownId(selection?.breakdownId ?? null);
    } else {
      setEditBreakdowns([]);
      setEditBreakdownId(null);
    }
  };

  const openEditModal = async (tx: Transaction) => {
    void reconcileAccountBalancesFromTransactions().catch(() => undefined);
    setEditAccounts(accountOptions);
    setEditingTxId(tx.id);
    setEditingTx(tx);
    setEditDate(tx.date);
    setEditAmountRaw(String(tx.amount));
    setEditType(tx.type);
    setEditAccountId(
      accountOptions.some((account) => account.id === tx.accountId)
        ? tx.accountId
        : (accountOptions.find((account) => account.id === DEFAULT_ACCOUNT_ID)
            ?.id ??
            accountOptions[0]?.id ??
            null),
    );
    setEditMemo(tx.memo || "");
    setEditStoreId(tx.storeId);
    setEditStoreName(tx.storeName);
    syncEditCategories(
      tx.type,
      tx.categoryId,
      tx.breakdownId,
      tx.categoryName,
      tx.breakdownName,
    );
    setShowEditModal(true);
  };

  const handleEditTypeChange = (nextType: TransactionType) => {
    setEditType(nextType);
    setEditStoreId(null);
    setEditStoreName("");
    syncEditCategories(nextType);
  };

  const handleEditCategoryChange = (nextCategoryId: string) => {
    setEditCategoryId(nextCategoryId);
    const bds = breakdownsByCategory.get(nextCategoryId) ?? [];
    setEditBreakdowns(bds);
    setEditBreakdownId(null);
    setEditStoreId(null);
    setEditStoreName("");
  };

  const handleUpdate = async () => {
    if (!editingTxId || !editingTx) return;

    const amount = resolveTransactionAmountInput(editAmountRaw);
    if (!isValidTransactionAmount(amount, editMemo)) {
      Alert.alert("エラー", "金額を入力するか、メモを入力してください");
      return;
    }
    if (!editCategoryId) {
      Alert.alert("エラー", "カテゴリを選択してください");
      return;
    }
    if (!editAccountId) {
      Alert.alert("エラー", "口座を選択してください");
      return;
    }

    const storeResolution = buildStoreEditResolution({
      storeId: editStoreId,
      storeName: editStoreName,
      categoryId: editCategoryId,
    });
    const resolvedStoreId =
      storeResolution.kind === "selected" ? storeResolution.storeId : null;

    await waitForPendingWrite(
      updateTransactionFromPrevious(
        editingTx,
        editDate,
        amount,
        editType,
        editCategoryId,
        editAccountId,
        editMemo,
        editBreakdownId,
        resolvedStoreId,
        {
          accountName: selectedEditAccount?.name ?? editingTx.accountName,
          categoryName: selectedEditCategory?.name ?? editingTx.categoryName,
          categoryColor: selectedEditCategory?.color ?? editingTx.categoryColor,
          breakdownName: selectedEditBreakdown?.name ?? editingTx.breakdownName,
          storeName:
            storeResolution.kind === "restore"
              ? storeResolution.storeName
              : editStoreName,
        },
      ),
      WRITE_ACK_TIMEOUT_MS,
    );

    setShowEditModal(false);
    setEditingTxId(null);
    setEditingTx(null);
  };

  const handleEditAccountPickerOpen = async () => {
    void reconcileAccountBalancesFromTransactions().catch(() => undefined);
    setEditAccounts(accountOptions);
  };

  const handleSelectDate = (dateStr: string) => {
    if (selectedDate === dateStr) {
      setSelectedDate(null);
      setSelectedDateTxs([]);
    } else {
      setSelectedDate(dateStr);
      setSelectedDateTxs(transactions.filter((tx) => tx.date === dateStr));
    }
  };

  const incomeColor = colorScheme === "dark" ? "#42A5F5" : "#1565C0";
  const expenseColor = colorScheme === "dark" ? "#EF5350" : "#C62828";

  const renderTransactionItem = (tx: Transaction) => {
    const isSelected = selectedTxIds.includes(tx.id);
    return (
      <TouchableOpacity
        key={tx.id}
        style={[
          styles.txRow,
          isSelectionMode && styles.txRowSelection,
          isSelected && { backgroundColor: colors.tint + "14" },
        ]}
        activeOpacity={0.9}
        onLongPress={() => handleLongPressTransaction(tx.id)}
        delayLongPress={220}
        onPress={() => {
          if (isSelectionMode) toggleSelection(tx.id);
        }}
      >
        {isSelectionMode ? (
          <View
            style={[
              styles.checkbox,
              { borderColor: colors.tint },
              isSelected && { backgroundColor: colors.tint },
            ]}
          >
            {isSelected ? <Text style={styles.checkboxMark}>✓</Text> : null}
          </View>
        ) : null}

        <View
          style={[
            styles.txItem,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
            isSelectionMode && styles.txItemShifted,
            isSelected && { borderColor: colors.tint },
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
              <Text
                style={[styles.txMemo, { color: colors.subText }]}
                numberOfLines={1}
              >
                {tx.breakdownName}
              </Text>
            ) : null}
            {tx.storeName ? (
              <Text
                style={[styles.txMemo, { color: colors.subText }]}
                numberOfLines={1}
              >
                🏪 {tx.storeName}
              </Text>
            ) : null}
            {tx.accountName ? (
              <Text
                style={[styles.txMemo, { color: colors.subText }]}
                numberOfLines={1}
              >
                口座: {tx.accountName}
              </Text>
            ) : null}
            {tx.memo ? (
              <Text
                style={[styles.txMemo, { color: colors.subText }]}
                numberOfLines={1}
              >
                {tx.memo}
              </Text>
            ) : null}
            <Text style={[styles.txDate, { color: colors.subText }]}>
              {displayDate(tx.date)}
            </Text>
          </View>
          <Text
            style={[
              styles.txAmount,
              {
                color: tx.type === "income" ? incomeColor : expenseColor,
              },
            ]}
          >
            {tx.type === "income" ? "+" : "-"}¥{formatAmount(tx.amount)}
          </Text>

          {!isSelectionMode ? (
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.editButton, { borderColor: colors.border }]}
                onPress={() => openEditModal(tx)}
              >
                <Text style={[styles.editButtonText, { color: colors.tint }]}>
                  編集
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  // --- カレンダー計算 ---
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  const calendarCells: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (calendarCells.length % 7 !== 0) calendarCells.push(null);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* セグメント切り替え */}
      <View
        style={[
          styles.segmentContainer,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.segmentButton,
            viewMode === "list" && { backgroundColor: colors.tint },
          ]}
          onPress={handleSwitchToListView}
        >
          <Text
            style={[
              styles.segmentText,
              viewMode === "list" && { color: "#fff" },
            ]}
          >
            リスト
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.segmentButton,
            viewMode === "calendar" && { backgroundColor: colors.tint },
          ]}
          onPress={handleSwitchToCalendarView}
        >
          <Text
            style={[
              styles.segmentText,
              viewMode === "calendar" && { color: "#fff" },
            ]}
          >
            カレンダー
          </Text>
        </TouchableOpacity>
      </View>

      {viewMode === "calendar" ? (
        <View
          style={[
            styles.monthNav,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <TouchableOpacity onPress={prevMonth} style={styles.navButton}>
            <Text style={[styles.navArrow, { color: colors.tint }]}>‹</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.monthTitleButton}
            onPress={() => setShowMonthPicker((visible) => !visible)}
          >
            <Text style={[styles.monthTitle, { color: colors.text }]}>
              {formatYearMonthLabel(year, month, "monthly")}
            </Text>
            <Text style={[styles.monthJumpHint, { color: colors.subText }]}>
              変更
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={nextMonth} style={styles.navButton}>
            <Text style={[styles.navArrow, { color: colors.tint }]}>›</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {viewMode === "calendar" && showMonthPicker ? (
        Platform.OS === "ios" ? (
          <View
            style={[
              styles.inlineDatePickerWrap,
              { borderColor: colors.border, marginHorizontal: 12 },
            ]}
          >
            <View
              style={[
                styles.inlineDatePickerHeader,
                { borderBottomColor: colors.border },
              ]}
            >
              <TouchableOpacity onPress={() => setShowMonthPicker(false)}>
                <Text style={[styles.datePickerDone, { color: colors.tint }]}>
                  完了
                </Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={toYearMonthDate(year, month)}
              mode="date"
              display="spinner"
              locale="ja-JP"
              onChange={(_, selected) => {
                if (selected) handleCalendarMonthChange(selected);
              }}
            />
          </View>
        ) : (
          <DateTimePicker
            value={toYearMonthDate(year, month)}
            mode="date"
            display="default"
            onChange={(event, selected) => {
              setShowMonthPicker(false);
              if (event.type === "set" && selected) {
                handleCalendarMonthChange(selected);
              }
            }}
          />
        )
      ) : null}

      {viewMode === "list" ? (
        <HistorySearchPanel
          colors={colors}
          type={historySearchType}
          categoryName={historySearchCategoryName}
          breakdownName={historySearchBreakdownName}
          storeName={historySearchStoreName}
          memoQuery={historySearchMemoQuery}
          fromDate={historySearchFromDate}
          toDate={historySearchToDate}
          datePickerTarget={searchDatePickerTarget}
          categoryOptions={historySearchCategoryOptions}
          breakdownOptions={historySearchBreakdownOptions}
          storeOptions={historySearchStoreOptions}
          expanded={isHistorySearchExpanded}
          onExpandedChange={setIsHistorySearchExpanded}
          onTypeChange={handleHistorySearchTypeChange}
          onCategoryNameChange={setHistorySearchCategoryName}
          onBreakdownNameChange={setHistorySearchBreakdownName}
          onStoreNameChange={setHistorySearchStoreName}
          onMemoQueryChange={setHistorySearchMemoQuery}
          onFromDateChange={setHistorySearchFromDate}
          onToDateChange={setHistorySearchToDate}
          onDatePickerTargetChange={setSearchDatePickerTarget}
          onClearConditions={clearHistorySearchConditions}
        />
      ) : null}

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isSelectionMode && { paddingBottom: 180 },
        ]}
        onScrollBeginDrag={handleHistoryScrollBeginDrag}
      >
        {viewMode === "list" ? (
          // --- リストビュー ---
          transactions.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.subText }]}>
              記録がありません
            </Text>
          ) : (
            transactions.map((tx) => renderTransactionItem(tx))
          )
        ) : (
          // --- カレンダービュー ---
          <View>
            {/* 曜日ヘッダー */}
            <View style={styles.weekHeader}>
              {WEEKDAYS.map((w, i) => (
                <Text
                  key={w}
                  style={[
                    styles.weekDay,
                    {
                      color:
                        i === 0
                          ? expenseColor
                          : i === 6
                            ? incomeColor
                            : colors.subText,
                    },
                  ]}
                >
                  {w}
                </Text>
              ))}
            </View>

            {/* 日付グリッド */}
            <View style={styles.calendarGrid}>
              {calendarCells.map((day, idx) => {
                if (day === null)
                  return <View key={`e-${idx}`} style={styles.dayCell} />;
                const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const hasData = markedDates.includes(dateStr);
                const isSelected = selectedDate === dateStr;
                const dayOfWeek = idx % 7;
                const dayColor =
                  dayOfWeek === 0
                    ? expenseColor
                    : dayOfWeek === 6
                      ? incomeColor
                      : colors.text;

                return (
                  <TouchableOpacity
                    key={dateStr}
                    style={[
                      styles.dayCell,
                      isSelected && { backgroundColor: colors.tint + "22" },
                    ]}
                    onPress={() => hasData && handleSelectDate(dateStr)}
                  >
                    <Text
                      style={[
                        styles.dayNumber,
                        { color: dayColor },
                        isSelected && { fontWeight: "700" },
                      ]}
                    >
                      {day}
                    </Text>
                    {hasData && (
                      <View
                        style={[
                          styles.dateDot,
                          { backgroundColor: colors.tint },
                        ]}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 選択日の記録 */}
            {selectedDate && (
              <View style={{ marginTop: 8 }}>
                <Text
                  style={[styles.selectedDateTitle, { color: colors.subText }]}
                >
                  {(() => {
                    const { y, m, d } = parseYMD(selectedDate);
                    return `${y}年${m}月${d}日`;
                  })()}
                </Text>
                {selectedDateTxs.map((tx) => renderTransactionItem(tx))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {isSelectionMode ? (
        <View
          style={[
            styles.selectionBar,
            {
              backgroundColor: colors.card,
              borderTopColor: colors.border,
              paddingBottom: bottomTabOverflow + 8,
            },
          ]}
        >
          <TouchableOpacity
            style={[styles.selectionButton, { borderColor: colors.border }]}
            onPress={exitSelectionMode}
          >
            <Text style={[styles.selectionCancelText, { color: colors.text }]}>
              キャンセル
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.selectionButton,
              { backgroundColor: colors.tint },
              selectedTxIds.length === 0 && { opacity: 0.5 },
            ]}
            disabled={selectedTxIds.length === 0}
            onPress={handleOpenBulkCopy}
          >
            <Text style={styles.selectionCopyText}>一括コピー</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <Modal visible={showBulkCopyModal} transparent animationType="fade">
        <View style={styles.copyModalOverlay}>
          <View
            style={[styles.copyModalCard, { backgroundColor: colors.card }]}
          >
            <Text style={[styles.copyModalTitle, { color: colors.text }]}>
              一括コピー
            </Text>
            <Text style={[styles.copyModalDesc, { color: colors.subText }]}>
              コピー先の日付を選択してください
            </Text>

            <TouchableOpacity
              style={[styles.copyDateButton, { borderColor: colors.border }]}
              onPress={() => setShowCopyDatePicker(true)}
            >
              <Text style={[styles.copyDateText, { color: colors.text }]}>
                {displayDate(copyDate)}
              </Text>
            </TouchableOpacity>

            {showCopyDatePicker ? (
              Platform.OS === "ios" ? (
                <View
                  style={[
                    styles.inlineDatePickerWrap,
                    { borderColor: colors.border },
                  ]}
                >
                  <View
                    style={[
                      styles.inlineDatePickerHeader,
                      { borderBottomColor: colors.border },
                    ]}
                  >
                    <TouchableOpacity
                      onPress={() => setShowCopyDatePicker(false)}
                    >
                      <Text
                        style={[styles.datePickerDone, { color: colors.tint }]}
                      >
                        完了
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <DateTimePicker
                    value={toLocalDate(copyDate)}
                    mode="date"
                    display="spinner"
                    locale="ja-JP"
                    onChange={(_, selected) => {
                      if (selected) setCopyDate(formatDate(selected));
                    }}
                  />
                </View>
              ) : (
                <DateTimePicker
                  value={toLocalDate(copyDate)}
                  mode="date"
                  display="default"
                  onChange={(event, selected) => {
                    setShowCopyDatePicker(false);
                    if (event.type === "set" && selected) {
                      setCopyDate(formatDate(selected));
                    }
                  }}
                />
              )
            ) : null}

            <View style={styles.copyModalActions}>
              <TouchableOpacity
                style={[
                  styles.copyActionButton,
                  { borderColor: colors.border },
                ]}
                onPress={() => {
                  setShowBulkCopyModal(false);
                  setShowCopyDatePicker(false);
                }}
              >
                <Text style={[styles.copyActionCancel, { color: colors.text }]}>
                  キャンセル
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.copyActionButton,
                  { backgroundColor: colors.tint },
                ]}
                onPress={handleExecuteBulkCopy}
              >
                <Text style={styles.copyActionRun}>コピー実行</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showEditModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <View
              style={[styles.modalHeader, { borderBottomColor: colors.border }]}
            >
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                記録を編集
              </Text>
              <View style={styles.modalHeaderActions}>
                <TouchableOpacity onPress={handleDeleteFromEditModal}>
                  <Text style={styles.modalDeleteText}>削除</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setShowEditModal(false);
                    setEditingTx(null);
                    setEditingTxId(null);
                  }}
                >
                  <Text style={[styles.modalClose, { color: colors.tint }]}>
                    閉じる
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.modalEditorContainer}>
              <TransactionEditor
                colors={colors}
                type={editType}
                amountRaw={editAmountRaw}
                date={editDate}
                categories={editCategories}
                accounts={editAccounts}
                accountId={editAccountId}
                categoryId={editCategoryId}
                breakdowns={editBreakdowns}
                breakdownId={editBreakdownId}
                storeId={editStoreId}
                storeName={editStoreName}
                memo={editMemo}
                incomeColor={incomeColor}
                expenseColor={expenseColor}
                bottomInset={safeAreaInsets.bottom + 8}
                amountInputUseNativeModal={false}
                onAccountPickerOpen={handleEditAccountPickerOpen}
                submitLabel="更新する"
                onTypeChange={handleEditTypeChange}
                onAmountRawChange={setEditAmountRaw}
                onDateChange={setEditDate}
                onAccountChange={setEditAccountId}
                onCategoryChange={handleEditCategoryChange}
                onBreakdownChange={setEditBreakdownId}
                onStoreChange={(id, name) => {
                  setEditStoreId(id);
                  setEditStoreName(name);
                }}
                onMemoChange={setEditMemo}
                onSubmit={handleUpdate}
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showUncopiedModal} transparent animationType="fade">
        <View style={styles.copyModalOverlay}>
          <View
            style={[styles.copyModalCard, { backgroundColor: colors.card }]}
          >
            <Text style={[styles.copyModalTitle, { color: colors.text }]}>
              一部コピーされませんでした
            </Text>
            <Text style={[styles.copyModalDesc, { color: colors.subText }]}>
              現在存在しないカテゴリのため、下記はコピーされませんでした。
            </Text>

            <ScrollView
              style={styles.uncopiedList}
              contentContainerStyle={styles.uncopiedListContent}
            >
              {uncopiedRecords.map((item) => (
                <View
                  key={item.id}
                  style={[
                    styles.uncopiedItem,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.background,
                    },
                  ]}
                >
                  <Text style={[styles.uncopiedTitle, { color: colors.text }]}>
                    {displayDate(item.date)} /{" "}
                    {item.type === "income" ? "収入" : "支出"}
                  </Text>
                  <Text
                    style={[styles.uncopiedMeta, { color: colors.subText }]}
                  >
                    カテゴリ: {item.categoryName || "未分類"}
                  </Text>
                  {item.breakdownName ? (
                    <Text
                      style={[styles.uncopiedMeta, { color: colors.subText }]}
                    >
                      内訳: {item.breakdownName}
                    </Text>
                  ) : null}
                  <Text
                    style={[styles.uncopiedMeta, { color: colors.subText }]}
                  >
                    金額: ¥{formatAmount(item.amount)}
                  </Text>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[
                styles.copyActionButton,
                { backgroundColor: colors.tint, marginTop: 10 },
              ]}
              onPress={() => {
                setShowUncopiedModal(false);
                setUncopiedRecords([]);
              }}
            >
              <Text style={styles.copyActionRun}>閉じる</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  navArrow: { fontSize: 26, fontWeight: "400" },
  monthTitleButton: { alignItems: "center", paddingVertical: 6, flex: 1 },
  monthTitle: { fontSize: 17, fontWeight: "700" },
  monthJumpHint: { fontSize: 11, fontWeight: "700", marginTop: 2 },
  scrollContent: { paddingHorizontal: 12, paddingBottom: 100 },
  emptyText: { textAlign: "center", marginTop: 48, fontSize: 15 },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  txRowSelection: {
    paddingLeft: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  checkboxMark: { color: "#fff", fontSize: 14, fontWeight: "700" },
  txItem: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    flex: 1,
  },
  txItemShifted: { marginLeft: 4 },
  categoryDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  txMain: { flex: 1 },
  txCategory: { fontSize: 15, fontWeight: "600" },
  txMemo: { fontSize: 12, marginTop: 2 },
  txDate: { fontSize: 12, marginTop: 2 },
  txAmount: { fontSize: 16, fontWeight: "700" },
  actionButtons: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 10,
    gap: 6,
  },
  editButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  editButtonText: { fontSize: 12, fontWeight: "700" },
  deleteButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  deleteButtonText: { fontSize: 12, fontWeight: "700", color: "#C62828" },
  weekHeader: { flexDirection: "row", marginBottom: 4 },
  weekDay: { flex: 1, textAlign: "center", fontSize: 13, fontWeight: "600" },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: {
    width: `${100 / 7}%`,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 8,
  },
  dayNumber: { fontSize: 15 },
  dateDot: { width: 5, height: 5, borderRadius: 3, marginTop: 2 },
  selectedDateTitle: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
    marginLeft: 4,
  },
  selectionBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 10,
    paddingTop: 10,
    paddingHorizontal: 12,
  },
  selectionButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  selectionCancelText: { fontSize: 14, fontWeight: "700" },
  selectionCopyText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  copyModalOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
    paddingHorizontal: 20,
  },
  copyModalCard: {
    width: "100%",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  copyModalTitle: { fontSize: 18, fontWeight: "700" },
  copyModalDesc: { fontSize: 13, marginTop: 4, marginBottom: 12 },
  copyDateButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  copyDateText: { fontSize: 16, fontWeight: "600" },
  inlineDatePickerWrap: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 10,
    overflow: "hidden",
  },
  inlineDatePickerHeader: {
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  copyModalActions: {
    marginTop: 14,
    flexDirection: "row",
    gap: 10,
  },
  copyActionButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  copyActionCancel: { fontSize: 14, fontWeight: "700" },
  copyActionRun: { color: "#fff", fontSize: 14, fontWeight: "700" },
  uncopiedList: {
    maxHeight: 260,
    marginTop: 8,
  },
  uncopiedListContent: {
    gap: 8,
  },
  uncopiedItem: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  uncopiedTitle: { fontSize: 13, fontWeight: "700" },
  uncopiedMeta: { fontSize: 12, marginTop: 2 },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalSheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    height: "90%",
  },
  modalHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  modalTitle: { fontSize: 17, fontWeight: "700" },
  modalClose: { fontSize: 14, fontWeight: "600" },
  modalDeleteText: { fontSize: 14, fontWeight: "700", color: "#C62828" },
  modalEditorContainer: { flex: 1, minHeight: 0 },
  typeToggle: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 14,
  },
  typeButton: { flex: 1, paddingVertical: 10, alignItems: "center" },
  typeText: { fontSize: 14, color: "#999", fontWeight: "600" },
  inputLabel: { fontSize: 12, marginBottom: 6, marginTop: 4 },
  textInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 10,
  },
  memoInput: { minHeight: 70, textAlignVertical: "top" },
  selectorButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
  },
  selectorText: { fontSize: 15, fontWeight: "500" },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  chip: {
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: { fontSize: 13, fontWeight: "600" },
  updateButton: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 6,
  },
  updateButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  datePickerOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  datePickerContainer: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 20,
  },
  datePickerHeader: {
    flexDirection: "row",
    justifyContent: "flex-end",
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  datePickerDone: { fontSize: 17, fontWeight: "600" },
});
