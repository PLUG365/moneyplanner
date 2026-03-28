import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
    Alert,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import {
    Breakdown,
    Category,
    deleteTransaction,
    getBreakdownsByCategory,
    getCategories,
    getDatesWithTransactions,
    getTransactionsByDate,
    getTransactionsByMonth,
    Transaction,
    TransactionType,
    updateTransaction,
} from "@/lib/database";

type ViewMode = "list" | "calendar";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function formatAmount(amount: number): string {
  return amount.toLocaleString("ja-JP");
}

function parseYMD(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return { y, m, d };
}

export default function HistoryScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];

  const now = new Date();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [markedDates, setMarkedDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedDateTxs, setSelectedDateTxs] = useState<Transaction[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTxId, setEditingTxId] = useState<number | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editAmountRaw, setEditAmountRaw] = useState("");
  const [editType, setEditType] = useState<TransactionType>("expense");
  const [editCategoryId, setEditCategoryId] = useState<number | null>(null);
  const [editBreakdownId, setEditBreakdownId] = useState<number | null>(null);
  const [editMemo, setEditMemo] = useState("");
  const [editCategories, setEditCategories] = useState<Category[]>([]);
  const [editBreakdowns, setEditBreakdowns] = useState<Breakdown[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const load = useCallback(() => {
    const txs = getTransactionsByMonth(year, month);
    setTransactions(txs);
    const dates = getDatesWithTransactions(year, month);
    setMarkedDates(dates);
    if (selectedDate) {
      setSelectedDateTxs(getTransactionsByDate(selectedDate));
    }
  }, [year, month, selectedDate]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const prevMonth = () => {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else setMonth((m) => m - 1);
    setSelectedDate(null);
    setSelectedDateTxs([]);
  };

  const nextMonth = () => {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else setMonth((m) => m + 1);
    setSelectedDate(null);
    setSelectedDateTxs([]);
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
          onPress: () => {
            deleteTransaction(tx.id);
            load();
          },
        },
      ],
    );
  };

  const syncEditCategories = (
    type: TransactionType,
    preferredCategoryId?: number | null,
    preferredBreakdownId?: number | null,
  ) => {
    const cats = getCategories(type);
    setEditCategories(cats);

    const nextCategoryId =
      preferredCategoryId && cats.some((c) => c.id === preferredCategoryId)
        ? preferredCategoryId
        : (cats[0]?.id ?? null);
    setEditCategoryId(nextCategoryId);

    if (nextCategoryId) {
      const bds = getBreakdownsByCategory(nextCategoryId);
      setEditBreakdowns(bds);
      const nextBreakdownId =
        preferredBreakdownId && bds.some((b) => b.id === preferredBreakdownId)
          ? preferredBreakdownId
          : (bds[0]?.id ?? null);
      setEditBreakdownId(nextBreakdownId);
    } else {
      setEditBreakdowns([]);
      setEditBreakdownId(null);
    }
  };

  const openEditModal = (tx: Transaction) => {
    setEditingTxId(tx.id);
    setEditDate(tx.date);
    setEditAmountRaw(String(tx.amount));
    setEditType(tx.type);
    setEditMemo(tx.memo || "");
    syncEditCategories(tx.type, tx.categoryId, tx.breakdownId);
    setShowEditModal(true);
  };

  const handleEditTypeChange = (nextType: TransactionType) => {
    setEditType(nextType);
    syncEditCategories(nextType);
  };

  const handleEditCategoryChange = (nextCategoryId: number) => {
    setEditCategoryId(nextCategoryId);
    const bds = getBreakdownsByCategory(nextCategoryId);
    setEditBreakdowns(bds);
    setEditBreakdownId(bds[0]?.id ?? null);
  };

  const handleUpdate = () => {
    if (!editingTxId) return;

    const amount = parseInt(editAmountRaw.replace(/,/g, ""), 10);
    if (!editAmountRaw || isNaN(amount) || amount <= 0) {
      Alert.alert("エラー", "金額を入力してください");
      return;
    }
    if (!editCategoryId) {
      Alert.alert("エラー", "カテゴリを選択してください");
      return;
    }

    updateTransaction(
      editingTxId,
      editDate,
      amount,
      editType,
      editCategoryId,
      editMemo,
      editBreakdownId,
    );

    setShowEditModal(false);
    setEditingTxId(null);
    load();
  };

  const handleSelectDate = (dateStr: string) => {
    if (selectedDate === dateStr) {
      setSelectedDate(null);
      setSelectedDateTxs([]);
    } else {
      setSelectedDate(dateStr);
      setSelectedDateTxs(getTransactionsByDate(dateStr));
    }
  };

  const incomeColor = colorScheme === "dark" ? "#42A5F5" : "#1565C0";
  const expenseColor = colorScheme === "dark" ? "#EF5350" : "#C62828";

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
          onPress={() => setViewMode("list")}
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
          onPress={() => setViewMode("calendar")}
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

      {/* 月ナビゲーション */}
      <View
        style={[
          styles.monthNav,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <TouchableOpacity onPress={prevMonth} style={styles.navButton}>
          <Text style={[styles.navArrow, { color: colors.tint }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.monthTitle, { color: colors.text }]}>
          {year}年{month}月
        </Text>
        <TouchableOpacity onPress={nextMonth} style={styles.navButton}>
          <Text style={[styles.navArrow, { color: colors.tint }]}>›</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {viewMode === "list" ? (
          // --- リストビュー ---
          transactions.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.subText }]}>
              記録がありません
            </Text>
          ) : (
            transactions.map((tx) => (
              <TouchableOpacity
                key={tx.id}
                style={[
                  styles.txItem,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
                onLongPress={() => handleDelete(tx)}
              >
                <View
                  style={[
                    styles.categoryDot,
                    { backgroundColor: tx.categoryColor },
                  ]}
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
                  {tx.memo ? (
                    <Text
                      style={[styles.txMemo, { color: colors.subText }]}
                      numberOfLines={1}
                    >
                      {tx.memo}
                    </Text>
                  ) : null}
                  <Text style={[styles.txDate, { color: colors.subText }]}>
                    {(() => {
                      const { y, m, d } = parseYMD(tx.date);
                      return `${y}年${m}月${d}日`;
                    })()}
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
                <TouchableOpacity
                  style={[styles.editButton, { borderColor: colors.border }]}
                  onPress={() => openEditModal(tx)}
                >
                  <Text style={[styles.editButtonText, { color: colors.tint }]}>
                    編集
                  </Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))
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
                {selectedDateTxs.map((tx) => (
                  <TouchableOpacity
                    key={tx.id}
                    style={[
                      styles.txItem,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      },
                    ]}
                    onLongPress={() => handleDelete(tx)}
                  >
                    <View
                      style={[
                        styles.categoryDot,
                        { backgroundColor: tx.categoryColor },
                      ]}
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
                      {tx.memo ? (
                        <Text
                          style={[styles.txMemo, { color: colors.subText }]}
                          numberOfLines={1}
                        >
                          {tx.memo}
                        </Text>
                      ) : null}
                    </View>
                    <Text
                      style={[
                        styles.txAmount,
                        {
                          color:
                            tx.type === "income" ? incomeColor : expenseColor,
                        },
                      ]}
                    >
                      {tx.type === "income" ? "+" : "-"}¥
                      {formatAmount(tx.amount)}
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.editButton,
                        { borderColor: colors.border },
                      ]}
                      onPress={() => openEditModal(tx)}
                    >
                      <Text
                        style={[styles.editButtonText, { color: colors.tint }]}
                      >
                        編集
                      </Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <Modal visible={showEditModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <View
              style={[styles.modalHeader, { borderBottomColor: colors.border }]}
            >
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                記録を編集
              </Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Text style={[styles.modalClose, { color: colors.tint }]}>
                  閉じる
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalContent}>
              <View style={[styles.typeToggle, { borderColor: colors.border }]}>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    editType === "income" && { backgroundColor: incomeColor },
                  ]}
                  onPress={() => handleEditTypeChange("income")}
                >
                  <Text
                    style={[
                      styles.typeText,
                      editType === "income" && { color: "#fff" },
                    ]}
                  >
                    収入
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    editType === "expense" && { backgroundColor: expenseColor },
                  ]}
                  onPress={() => handleEditTypeChange("expense")}
                >
                  <Text
                    style={[
                      styles.typeText,
                      editType === "expense" && { color: "#fff" },
                    ]}
                  >
                    支出
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.inputLabel, { color: colors.subText }]}>
                金額
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  { borderColor: colors.border, color: colors.text },
                ]}
                value={editAmountRaw}
                onChangeText={(text) =>
                  setEditAmountRaw(text.replace(/[^0-9]/g, ""))
                }
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.subText}
              />

              <Text style={[styles.inputLabel, { color: colors.subText }]}>
                日付
              </Text>
              <TouchableOpacity
                style={[styles.selectorButton, { borderColor: colors.border }]}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={[styles.selectorText, { color: colors.text }]}>
                  {editDate}
                </Text>
              </TouchableOpacity>

              <Text style={[styles.inputLabel, { color: colors.subText }]}>
                カテゴリ
              </Text>
              <View style={styles.chipWrap}>
                {editCategories.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.chip,
                      { borderColor: cat.color },
                      editCategoryId === cat.id && {
                        backgroundColor: cat.color,
                      },
                    ]}
                    onPress={() => handleEditCategoryChange(cat.id)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: cat.color },
                        editCategoryId === cat.id && { color: "#fff" },
                      ]}
                    >
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {editBreakdowns.length > 0 && (
                <>
                  <Text style={[styles.inputLabel, { color: colors.subText }]}>
                    内訳
                  </Text>
                  <View style={styles.chipWrap}>
                    {editBreakdowns.map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        style={[
                          styles.chip,
                          { borderColor: colors.tint },
                          editBreakdownId === item.id && {
                            backgroundColor: colors.tint,
                          },
                        ]}
                        onPress={() => setEditBreakdownId(item.id)}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            { color: colors.tint },
                            editBreakdownId === item.id && { color: "#fff" },
                          ]}
                        >
                          {item.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <Text style={[styles.inputLabel, { color: colors.subText }]}>
                メモ
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  styles.memoInput,
                  { borderColor: colors.border, color: colors.text },
                ]}
                value={editMemo}
                onChangeText={setEditMemo}
                placeholder="メモを入力"
                placeholderTextColor={colors.subText}
                multiline
                maxLength={100}
              />

              <TouchableOpacity
                style={[styles.updateButton, { backgroundColor: colors.tint }]}
                onPress={handleUpdate}
              >
                <Text style={styles.updateButtonText}>更新する</Text>
              </TouchableOpacity>
            </ScrollView>

            {Platform.OS === "ios" ? (
              <Modal transparent animationType="slide" visible={showDatePicker}>
                <View style={styles.datePickerOverlay}>
                  <View
                    style={[
                      styles.datePickerContainer,
                      { backgroundColor: colors.card },
                    ]}
                  >
                    <View
                      style={[
                        styles.datePickerHeader,
                        { borderBottomColor: colors.border },
                      ]}
                    >
                      <TouchableOpacity
                        onPress={() => setShowDatePicker(false)}
                      >
                        <Text
                          style={[
                            styles.datePickerDone,
                            { color: colors.tint },
                          ]}
                        >
                          完了
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <DateTimePicker
                      value={new Date(editDate)}
                      mode="date"
                      display="spinner"
                      locale="ja-JP"
                      maximumDate={new Date()}
                      onChange={(_, selected) => {
                        if (selected) {
                          const y = selected.getFullYear();
                          const m = String(selected.getMonth() + 1).padStart(
                            2,
                            "0",
                          );
                          const d = String(selected.getDate()).padStart(2, "0");
                          setEditDate(`${y}-${m}-${d}`);
                        }
                      }}
                    />
                  </View>
                </View>
              </Modal>
            ) : (
              showDatePicker && (
                <DateTimePicker
                  value={new Date(editDate)}
                  mode="date"
                  display="default"
                  maximumDate={new Date()}
                  onChange={(_, selected) => {
                    setShowDatePicker(false);
                    if (selected) {
                      const y = selected.getFullYear();
                      const m = String(selected.getMonth() + 1).padStart(
                        2,
                        "0",
                      );
                      const d = String(selected.getDate()).padStart(2, "0");
                      setEditDate(`${y}-${m}-${d}`);
                    }
                  }}
                />
              )
            )}
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
  monthTitle: { fontSize: 17, fontWeight: "700" },
  scrollContent: { paddingHorizontal: 12, paddingBottom: 100 },
  emptyText: { textAlign: "center", marginTop: 48, fontSize: 15 },
  txItem: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  categoryDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  txMain: { flex: 1 },
  txCategory: { fontSize: 15, fontWeight: "600" },
  txMemo: { fontSize: 12, marginTop: 2 },
  txDate: { fontSize: 12, marginTop: 2 },
  txAmount: { fontSize: 16, fontWeight: "700" },
  editButton: {
    marginLeft: 10,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  editButtonText: { fontSize: 12, fontWeight: "700" },
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
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalSheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: "90%",
  },
  modalHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: { fontSize: 17, fontWeight: "700" },
  modalClose: { fontSize: 14, fontWeight: "600" },
  modalContent: { padding: 16, paddingBottom: 28 },
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
