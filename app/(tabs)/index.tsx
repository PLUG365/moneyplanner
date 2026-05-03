import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useFocusEffect } from "expo-router";
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    Alert,
    Animated,
    Easing,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

import TransactionEditor from "@/components/TransactionEditor";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useCollection, useHouseholdId } from "@/hooks/useFirestore";
import {
    Account,
    addTransaction,
    Breakdown,
    Category,
    DEFAULT_ACCOUNT_ID,
    getBudgetStatusForDate,
    householdCollection,
    mapAccount,
    mapBreakdown,
    mapCategory,
    reconcileAccountBalancesFromTransactions,
    TransactionType,
} from "@/lib/firestore";
import { buildFirestoreQueryKey } from "@/lib/firestoreSubscription";
import { waitForPendingWrite } from "@/lib/pendingWrite";
import { buildRecordCategoryOptions } from "@/lib/recordOptions";
import { resolveTransactionAmountInput } from "@/lib/transactionAmountInput";
import { isValidTransactionAmount } from "@/lib/transactionAmountValidation";

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

type ToastVariant = "info" | "warning" | "exceeded";
const WRITE_ACK_TIMEOUT_MS = 900;

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise.catch(() => fallback),
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export default function RecordScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const tabBarHeight = useBottomTabBarHeight();
  const householdId = useHouseholdId();

  const [type, setType] = useState<TransactionType>("expense");
  const [amountRaw, setAmountRaw] = useState("");
  const [date, setDate] = useState(formatDate(new Date()));
  const [accountId, setAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [breakdownId, setBreakdownId] = useState<string | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState("");
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastVariant, setToastVariant] = useState<ToastVariant>("info");
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastSlideX = useRef(new Animated.Value(72)).current;
  const toastOpacity = useRef(new Animated.Value(0)).current;

  const accountSubscription = useCollection<Account>(
    buildFirestoreQueryKey(householdId, "accounts"),
    () => (householdId ? householdCollection(householdId, "accounts") : null),
    mapAccount,
  );
  const categorySubscription = useCollection<Category>(
    buildFirestoreQueryKey(householdId, "categories", type),
    () =>
      householdId
        ? householdCollection(householdId, "categories").where(
            "type",
            "==",
            type,
          )
        : null,
    mapCategory,
  );
  const breakdownSubscription = useCollection<Breakdown>(
    buildFirestoreQueryKey(householdId, "breakdowns", "all"),
    () => (householdId ? householdCollection(householdId, "breakdowns") : null),
    mapBreakdown,
  );

  const accounts = useMemo(
    () =>
      [...accountSubscription.data].sort((a, b) => {
        if (a.isDefault !== b.isDefault) return b.isDefault ? 1 : -1;
        return a.id.localeCompare(b.id);
      }),
    [accountSubscription.data],
  );
  const categories = useMemo(
    () => buildRecordCategoryOptions(categorySubscription.data),
    [categorySubscription.data],
  );
  const breakdowns = useMemo(
    () =>
      [...breakdownSubscription.data].sort((a, b) => {
        if (a.isDefault !== b.isDefault) return b.isDefault ? 1 : -1;
        return a.name.localeCompare(b.name);
      }),
    [breakdownSubscription.data],
  );
  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === accountId) ?? null,
    [accountId, accounts],
  );
  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === categoryId) ?? null,
    [categories, categoryId],
  );
  const selectedBreakdown = useMemo(
    () => breakdowns.find((breakdown) => breakdown.id === breakdownId) ?? null,
    [breakdownId, breakdowns],
  );

  useEffect(() => {
    setAccountId((prev) => {
      if (prev && accounts.some((account) => account.id === prev)) return prev;
      const defaultAccount =
        accounts.find((account) => account.id === DEFAULT_ACCOUNT_ID) ??
        accounts[0] ??
        null;
      return defaultAccount?.id ?? null;
    });
  }, [accounts]);

  useEffect(() => {
    setCategoryId((prev) =>
      prev && categories.some((category) => category.id === prev) ? prev : null,
    );
  }, [categories]);

  useEffect(() => {
    setBreakdownId((prev) =>
      prev &&
      breakdowns.some(
        (breakdown) =>
          breakdown.id === prev && breakdown.categoryId === categoryId,
      )
        ? prev
        : null,
    );
  }, [breakdowns, categoryId]);

  const resetForm = useCallback(() => {
    setAmountRaw("");
    setMemo("");
    setDate(formatDate(new Date()));
    setStoreId(null);
    setStoreName("");
    setCategoryId(null);
    setBreakdownId(null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      resetForm();
    }, [resetForm]),
  );

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const hideToast = useCallback(() => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    Animated.parallel([
      Animated.timing(toastSlideX, {
        toValue: 72,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setToastMessage("");
      }
    });
  }, [toastOpacity, toastSlideX]);

  const showToast = (message: string, variant: ToastVariant = "info") => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToastMessage(message);
    setToastVariant(variant);
    toastSlideX.setValue(72);
    toastOpacity.setValue(0);
    Animated.parallel([
      Animated.timing(toastSlideX, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
    toastTimerRef.current = setTimeout(() => {
      hideToast();
    }, 3000);
  };

  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    setCategoryId(null);
    setBreakdownId(null);
    setStoreId(null);
    setStoreName("");
  };

  const handleCategoryChange = (nextCategoryId: string) => {
    setCategoryId(nextCategoryId);
    setBreakdownId(null);
    setStoreId(null);
    setStoreName("");
  };

  const handleSave = async () => {
    if (saving) return;
    const amount = resolveTransactionAmountInput(amountRaw);
    if (!isValidTransactionAmount(amount, memo)) {
      Alert.alert("エラー", "金額を入力するか、メモを入力してください");
      return;
    }
    if (!categoryId) {
      Alert.alert("エラー", "カテゴリを選択してください");
      return;
    }
    if (!accountId) {
      Alert.alert("エラー", "口座を選択してください");
      return;
    }

    setSaving(true);
    try {
      const writeResult = await waitForPendingWrite(
        addTransaction(
          date,
          amount,
          type,
          categoryId,
          accountId,
          memo,
          breakdownId,
          storeId,
          {
            accountName: selectedAccount?.name,
            categoryName: selectedCategory?.name,
            categoryColor: selectedCategory?.color,
            breakdownName: selectedBreakdown?.name,
            storeName,
          },
        ),
        WRITE_ACK_TIMEOUT_MS,
      );

      const afterStatus =
        writeResult.status === "acknowledged" && type === "expense"
          ? await withTimeout(
              getBudgetStatusForDate(date, categoryId),
              WRITE_ACK_TIMEOUT_MS,
              null,
            )
          : null;
      let nextToastMessage =
        writeResult.status === "queued"
          ? "保存しました（同期待ち）"
          : "保存しました";
      let nextToastVariant: ToastVariant = "info";
      if (
        afterStatus &&
        (afterStatus.level === "warning" || afterStatus.level === "exceeded")
      ) {
        const percent = Math.round(afterStatus.usageRate * 100);
        nextToastMessage =
          afterStatus.level === "exceeded"
            ? `予算超過: ${afterStatus.categoryName} (${percent}%)`
            : `予算注意: ${afterStatus.categoryName} (${percent}%)`;
        nextToastVariant =
          afterStatus.level === "exceeded" ? "exceeded" : "warning";
      }

      resetForm();
      showToast(nextToastMessage, nextToastVariant);
    } catch (error) {
      Alert.alert(
        "エラー",
        error instanceof Error ? error.message : "保存に失敗しました",
      );
    } finally {
      setSaving(false);
    }
  };

  const incomeColor = colorScheme === "dark" ? "#42A5F5" : "#1565C0";
  const expenseColor = colorScheme === "dark" ? "#EF5350" : "#C62828";
  const warningColor = colorScheme === "dark" ? "#FFCA28" : "#EF6C00";
  const exceededColor = colorScheme === "dark" ? "#FF8A80" : "#C62828";

  const getToastCardStyle = () => {
    if (toastVariant === "exceeded") {
      return {
        backgroundColor:
          colorScheme === "dark"
            ? "rgba(198, 40, 40, 0.95)"
            : "rgba(198, 40, 40, 0.92)",
      };
    }
    if (toastVariant === "warning") {
      return {
        backgroundColor:
          colorScheme === "dark"
            ? "rgba(239, 108, 0, 0.95)"
            : "rgba(239, 108, 0, 0.92)",
      };
    }
    return {
      backgroundColor:
        colorScheme === "dark"
          ? "rgba(33, 33, 33, 0.95)"
          : "rgba(33, 33, 33, 0.92)",
    };
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TransactionEditor
        colors={colors}
        type={type}
        amountRaw={amountRaw}
        date={date}
        categories={categories}
        accounts={accounts}
        accountId={accountId}
        categoryId={categoryId}
        breakdowns={breakdowns}
        breakdownId={breakdownId}
        storeId={storeId}
        storeName={storeName}
        memo={memo}
        incomeColor={incomeColor}
        expenseColor={expenseColor}
        bottomInset={tabBarHeight}
        onAccountPickerOpen={reconcileAccountBalancesFromTransactions}
        submitLabel={saving ? "保存中..." : "保存する"}
        onTypeChange={handleTypeChange}
        onAmountRawChange={setAmountRaw}
        onDateChange={setDate}
        onAccountChange={setAccountId}
        onCategoryChange={handleCategoryChange}
        onBreakdownChange={setBreakdownId}
        onStoreChange={(id, name) => {
          setStoreId(id);
          setStoreName(name);
        }}
        onMemoChange={setMemo}
        onSubmit={handleSave}
      />

      {toastMessage ? (
        <View style={styles.toastWrap} pointerEvents="box-none">
          <Animated.View
            style={[
              styles.toastCard,
              getToastCardStyle(),
              toastVariant === "warning" && { borderColor: warningColor },
              toastVariant === "exceeded" && { borderColor: exceededColor },
              {
                opacity: toastOpacity,
                transform: [{ translateX: toastSlideX }],
              },
            ]}
          >
            <View style={styles.toastRow}>
              <Text style={styles.toastText}>{toastMessage}</Text>
              <TouchableOpacity
                style={styles.toastCloseButton}
                onPress={hideToast}
                activeOpacity={0.7}
              >
                <Text style={styles.toastCloseText}>×</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  toastWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 96,
    alignItems: "flex-end",
    paddingHorizontal: 16,
    zIndex: 1000,
    elevation: 1000,
  },
  toastCard: {
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    width: "100%",
    maxWidth: 360,
  },
  toastRow: { flexDirection: "row", alignItems: "center" },
  toastText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  toastCloseButton: {
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  toastCloseText: {
    color: "#fff",
    fontSize: 20,
    lineHeight: 20,
    fontWeight: "700",
  },
});
