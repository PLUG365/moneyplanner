import { useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import TransactionEditor from "@/components/TransactionEditor";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import {
  addTransaction,
  Breakdown,
  Category,
  getBreakdownsByCategory,
  getBudgetStatusForDate,
  getCategories,
  TransactionType,
} from "@/lib/database";

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

type ToastVariant = "info" | "warning" | "exceeded";

export default function RecordScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];

  const [type, setType] = useState<TransactionType>("expense");
  const [amountRaw, setAmountRaw] = useState("");
  const [date, setDate] = useState(formatDate(new Date()));
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [breakdowns, setBreakdowns] = useState<Breakdown[]>([]);
  const [breakdownId, setBreakdownId] = useState<number | null>(null);
  const [storeId, setStoreId] = useState<number | null>(null);
  const [storeName, setStoreName] = useState("");
  const [memo, setMemo] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [toastVariant, setToastVariant] = useState<ToastVariant>("info");
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastSlideX = useRef(new Animated.Value(72)).current;
  const toastOpacity = useRef(new Animated.Value(0)).current;

  const resetSelectionState = useCallback((targetType: TransactionType) => {
    setCategories(getCategories(targetType));
    setCategoryId(null);
    setBreakdowns([]);
    setBreakdownId(null);
  }, []);

  const resetForm = useCallback(
    (targetType: TransactionType) => {
      setAmountRaw("");
      setMemo("");
      setDate(formatDate(new Date()));
      setStoreId(null);
      setStoreName("");
      resetSelectionState(targetType);
    },
    [resetSelectionState],
  );

  useFocusEffect(
    useCallback(() => {
      resetForm(type);
    }, [type, resetForm]),
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
    resetSelectionState(newType);
  };

  const handleCategoryChange = (nextCategoryId: number) => {
    setCategoryId(nextCategoryId);
    const bds = getBreakdownsByCategory(nextCategoryId);
    setBreakdowns(bds);
    setBreakdownId(null);
    setStoreId(null);
    setStoreName("");
  };

  const handleSave = () => {
    const amount = parseInt(amountRaw.replace(/,/g, ""), 10);
    if (!amountRaw || isNaN(amount) || amount < 0) {
      Alert.alert("エラー", "金額を入力してください");
      return;
    }
    if (!categoryId) {
      Alert.alert("エラー", "カテゴリを選択してください");
      return;
    }

    addTransaction(date, amount, type, categoryId, memo, breakdownId, storeId);

    const afterStatus =
      type === "expense" ? getBudgetStatusForDate(date, categoryId) : null;
    let nextToastMessage = "保存しました";
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

    resetForm(type);
    showToast(nextToastMessage, nextToastVariant);
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
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <TransactionEditor
          colors={colors}
          type={type}
          amountRaw={amountRaw}
          date={date}
          categories={categories}
          categoryId={categoryId}
          breakdowns={breakdowns}
          breakdownId={breakdownId}
          storeId={storeId}
          storeName={storeName}
          memo={memo}
          incomeColor={incomeColor}
          expenseColor={expenseColor}
          submitLabel="保存する"
          onTypeChange={handleTypeChange}
          onAmountRawChange={setAmountRaw}
          onDateChange={setDate}
          onCategoryChange={handleCategoryChange}
          onBreakdownChange={setBreakdownId}
          onStoreChange={(id, name) => { setStoreId(id); setStoreName(name); }}
          onMemoChange={setMemo}
          onSubmit={handleSave}
        />
      </ScrollView>

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
  content: { padding: 16, paddingBottom: 100 },
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
