import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useMemo, useState } from "react";
import {
  InputAccessoryView,
  Keyboard,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import {
  Breakdown,
  Category,
  getStoresByCategory,
  Store,
  TransactionType,
  upsertStore,
} from "@/lib/database";

type ThemeColors = {
  text: string;
  subText: string;
  background: string;
  card: string;
  border: string;
  tint: string;
};

type Props = {
  colors: ThemeColors;
  type: TransactionType;
  amountRaw: string;
  date: string;
  categories: Category[];
  categoryId: number | null;
  breakdowns: Breakdown[];
  breakdownId: number | null;
  storeId: number | null;
  storeName: string;
  memo: string;
  incomeColor: string;
  expenseColor: string;
  submitLabel: string;
  onTypeChange: (type: TransactionType) => void;
  onAmountRawChange: (amountRaw: string) => void;
  onDateChange: (date: string) => void;
  onCategoryChange: (categoryId: number) => void;
  onBreakdownChange: (breakdownId: number | null) => void;
  onStoreChange: (storeId: number | null, storeName: string) => void;
  onMemoChange: (memo: string) => void;
  onSubmit: () => void;
};

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function displayDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${y}年${parseInt(m)}月${parseInt(d)}日`;
}

function formatAmount(raw: string): string {
  const n = parseInt(raw.replace(/,/g, ""), 10);
  if (isNaN(n)) return "";
  return n.toLocaleString("ja-JP");
}

export default function TransactionEditor({
  colors,
  type,
  amountRaw,
  date,
  categories,
  categoryId,
  breakdowns,
  breakdownId,
  storeId,
  storeName,
  memo,
  incomeColor,
  expenseColor,
  submitLabel,
  onTypeChange,
  onAmountRawChange,
  onDateChange,
  onCategoryChange,
  onBreakdownChange,
  onStoreChange,
  onMemoChange,
  onSubmit,
}: Props) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showStoreModal, setShowStoreModal] = useState(false);
  const [storeSearchQuery, setStoreSearchQuery] = useState("");
  const [categoryStores, setCategoryStores] = useState<Store[]>([]);
  const keyboardAccessoryViewId = "transaction-editor-keyboard-accessory";

  const activeColor = type === "income" ? incomeColor : expenseColor;
  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === categoryId) ?? null,
    [categories, categoryId],
  );
  const selectedBreakdown = useMemo(
    () => breakdowns.find((b) => b.id === breakdownId) ?? null,
    [breakdowns, breakdownId],
  );

  const filteredStores = useMemo(() => {
    if (!storeSearchQuery.trim()) return categoryStores;
    return categoryStores.filter((s) =>
      s.name.includes(storeSearchQuery.trim()),
    );
  }, [categoryStores, storeSearchQuery]);

  const exactStoreMatchExists = useMemo(
    () => categoryStores.some((s) => s.name === storeSearchQuery.trim()),
    [categoryStores, storeSearchQuery],
  );

  const openStorePicker = () => {
    if (!categoryId) return;
    setCategoryStores(getStoresByCategory(categoryId));
    setStoreSearchQuery("");
    setShowStoreModal(true);
  };

  return (
    <>
      <View
        style={[
          styles.typeToggle,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.typeButton,
            type === "income" && { backgroundColor: incomeColor },
          ]}
          onPress={() => onTypeChange("income")}
        >
          <Text
            style={[
              styles.typeButtonText,
              type === "income" && styles.typeButtonTextActive,
            ]}
          >
            収入
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.typeButton,
            type === "expense" && { backgroundColor: expenseColor },
          ]}
          onPress={() => onTypeChange("expense")}
        >
          <Text
            style={[
              styles.typeButtonText,
              type === "expense" && styles.typeButtonTextActive,
            ]}
          >
            支出
          </Text>
        </TouchableOpacity>
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.label, { color: colors.subText }]}>金額</Text>
        <View style={styles.amountRow}>
          <Text style={[styles.yen, { color: activeColor }]}>¥</Text>
          <TextInput
            style={[styles.amountInput, { color: activeColor }]}
            value={amountRaw ? formatAmount(amountRaw) : ""}
            onChangeText={(text) =>
              onAmountRawChange(text.replace(/[^0-9]/g, ""))
            }
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={colors.border}
            returnKeyType="done"
            blurOnSubmit
            onSubmitEditing={Keyboard.dismiss}
            inputAccessoryViewID={
              Platform.OS === "ios" ? keyboardAccessoryViewId : undefined
            }
          />
        </View>
      </View>

      <TouchableOpacity
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
        onPress={() => setShowDatePicker(true)}
      >
        <Text style={[styles.label, { color: colors.subText }]}>日付</Text>
        <Text style={[styles.dateText, { color: colors.text }]}>
          {displayDate(date)}
        </Text>
      </TouchableOpacity>

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
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Text style={[styles.datePickerDone, { color: colors.tint }]}>
                    完了
                  </Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={new Date(date)}
                mode="date"
                display="spinner"
                locale="ja-JP"
                onChange={(_, selected) => {
                  if (selected) onDateChange(formatDate(selected));
                }}
              />
            </View>
          </View>
        </Modal>
      ) : (
        showDatePicker && (
          <DateTimePicker
            value={new Date(date)}
            mode="date"
            display="default"
            onChange={(_, selected) => {
              setShowDatePicker(false);
              if (selected) onDateChange(formatDate(selected));
            }}
          />
        )
      )}

      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.label, { color: colors.subText }]}>カテゴリ</Text>
        <TouchableOpacity
          style={[
            styles.selectorButton,
            { borderColor: selectedCategory?.color || colors.border },
          ]}
          onPress={() => setShowCategoryModal(true)}
        >
          <Text
            style={[
              styles.selectorValue,
              { color: selectedCategory?.color || colors.text },
            ]}
          >
            {selectedCategory?.name ?? "カテゴリを選択"}
          </Text>
          <Text style={[styles.selectorAction, { color: colors.tint }]}>
            選択
          </Text>
        </TouchableOpacity>

        <Text style={[styles.label, { color: colors.subText, marginTop: 14 }]}>
          内訳
        </Text>
        {breakdowns.length === 0 ? (
          <Text style={[styles.emptyBreakdownText, { color: colors.subText }]}>
            このカテゴリに内訳はありません
          </Text>
        ) : (
          <View style={styles.categoryGrid}>
            {breakdowns.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.categoryChip,
                  { borderColor: selectedCategory?.color || colors.tint },
                  breakdownId === item.id && {
                    backgroundColor: selectedCategory?.color || colors.tint,
                  },
                ]}
                onPress={() =>
                  onBreakdownChange(breakdownId === item.id ? null : item.id)
                }
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    { color: selectedCategory?.color || colors.tint },
                    breakdownId === item.id && { color: "#fff" },
                  ]}
                >
                  {item.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {selectedBreakdown ? (
          <Text
            style={[styles.selectedBreakdownText, { color: colors.subText }]}
          >
            選択中: {selectedBreakdown.name}
          </Text>
        ) : null}
      </View>

      {type === "expense" && (
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.label, { color: colors.subText }]}>
            お店（任意）
          </Text>
          <TouchableOpacity
            style={[
              styles.selectorButton,
              { borderColor: storeName ? colors.tint : colors.border },
            ]}
            onPress={openStorePicker}
            disabled={!categoryId}
          >
            <Text
              style={[
                styles.selectorValue,
                { color: storeName ? colors.text : colors.subText },
              ]}
            >
              {storeName || (categoryId ? "お店を選択" : "カテゴリを先に選択")}
            </Text>
            {storeName ? (
              <TouchableOpacity
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => onStoreChange(null, "")}
              >
                <Text style={[styles.selectorAction, { color: colors.subText }]}>
                  ✕
                </Text>
              </TouchableOpacity>
            ) : (
              <Text
                style={[
                  styles.selectorAction,
                  { color: categoryId ? colors.tint : colors.subText },
                ]}
              >
                選択
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.label, { color: colors.subText }]}>
          メモ（任意）
        </Text>
        <TextInput
          style={[
            styles.memoInput,
            { color: colors.text, borderColor: colors.border },
          ]}
          value={memo}
          onChangeText={onMemoChange}
          placeholder="メモを入力"
          placeholderTextColor={colors.subText}
          multiline
          maxLength={100}
          returnKeyType="done"
          blurOnSubmit
          onSubmitEditing={Keyboard.dismiss}
          inputAccessoryViewID={
            Platform.OS === "ios" ? keyboardAccessoryViewId : undefined
          }
        />
      </View>

      {Platform.OS === "ios" ? (
        <InputAccessoryView nativeID={keyboardAccessoryViewId}>
          <View
            style={[
              styles.keyboardAccessory,
              { backgroundColor: colors.card, borderTopColor: colors.border },
            ]}
          >
            <TouchableOpacity onPress={Keyboard.dismiss}>
              <Text
                style={[styles.keyboardAccessoryDone, { color: colors.tint }]}
              >
                入力完了
              </Text>
            </TouchableOpacity>
          </View>
        </InputAccessoryView>
      ) : null}

      <TouchableOpacity
        style={[styles.submitButton, { backgroundColor: activeColor }]}
        onPress={onSubmit}
      >
        <Text style={styles.submitButtonText}>{submitLabel}</Text>
      </TouchableOpacity>

      <Modal visible={showCategoryModal} animationType="slide">
        <SafeAreaView
          style={[
            styles.fullModalContainer,
            { backgroundColor: colors.background },
          ]}
        >
          <View
            style={[
              styles.fullModalHeader,
              { borderBottomColor: colors.border },
            ]}
          >
            <Text style={[styles.fullModalTitle, { color: colors.text }]}>
              カテゴリを選択
            </Text>
            <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
              <Text style={[styles.fullModalClose, { color: colors.tint }]}>
                閉じる
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.fullModalContent}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.fullCategoryRow,
                  { borderColor: colors.border, backgroundColor: colors.card },
                  categoryId === cat.id && {
                    borderColor: cat.color,
                    borderWidth: 2,
                  },
                ]}
                onPress={() => {
                  onCategoryChange(cat.id);
                  setShowCategoryModal(false);
                }}
              >
                <View
                  style={[
                    styles.fullCategoryDot,
                    { backgroundColor: cat.color },
                  ]}
                />
                <Text style={[styles.fullCategoryName, { color: colors.text }]}>
                  {cat.name}
                </Text>
                {categoryId === cat.id ? (
                  <Text
                    style={[styles.fullCategorySelected, { color: cat.color }]}
                  >
                    選択中
                  </Text>
                ) : null}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={showStoreModal} animationType="slide">
        <SafeAreaView
          style={[
            styles.fullModalContainer,
            { backgroundColor: colors.background },
          ]}
        >
          <View
            style={[
              styles.fullModalHeader,
              { borderBottomColor: colors.border },
            ]}
          >
            <Text style={[styles.fullModalTitle, { color: colors.text }]}>
              お店を選択
            </Text>
            <TouchableOpacity onPress={() => setShowStoreModal(false)}>
              <Text style={[styles.fullModalClose, { color: colors.tint }]}>
                閉じる
              </Text>
            </TouchableOpacity>
          </View>
          <View
            style={[
              styles.storeSearchContainer,
              { borderBottomColor: colors.border, backgroundColor: colors.card },
            ]}
          >
            <TextInput
              style={[
                styles.storeSearchInput,
                { color: colors.text, borderColor: colors.border },
              ]}
              value={storeSearchQuery}
              onChangeText={setStoreSearchQuery}
              placeholder="お店名で検索"
              placeholderTextColor={colors.subText}
              autoFocus
              returnKeyType="done"
              blurOnSubmit={false}
            />
          </View>
          <ScrollView
            contentContainerStyle={styles.fullModalContent}
            keyboardShouldPersistTaps="handled"
          >
            {storeSearchQuery.trim() !== "" && !exactStoreMatchExists && (
              <TouchableOpacity
                style={[
                  styles.addStoreButton,
                  { backgroundColor: colors.tint },
                ]}
                onPress={() => {
                  const name = storeSearchQuery.trim();
                  const sid = upsertStore(name, categoryId!);
                  onStoreChange(sid, name);
                  setShowStoreModal(false);
                }}
              >
                <Text style={styles.addStoreButtonText}>
                  「{storeSearchQuery.trim()}」を追加して選択
                </Text>
              </TouchableOpacity>
            )}
            {filteredStores.length === 0 && storeSearchQuery.trim() === "" && (
              <Text
                style={[styles.storeEmptyText, { color: colors.subText }]}
              >
                まだお店が登録されていません
              </Text>
            )}
            {filteredStores.map((store) => (
              <TouchableOpacity
                key={store.id}
                style={[
                  styles.fullCategoryRow,
                  { borderColor: colors.border, backgroundColor: colors.card },
                  storeId === store.id && {
                    borderColor: colors.tint,
                    borderWidth: 2,
                  },
                ]}
                onPress={() => {
                  onStoreChange(store.id, store.name);
                  setShowStoreModal(false);
                }}
              >
                <Text style={[styles.fullCategoryName, { color: colors.text }]}>
                  {store.name}
                </Text>
                {storeId === store.id ? (
                  <Text
                    style={[
                      styles.fullCategorySelected,
                      { color: colors.tint },
                    ]}
                  >
                    選択中
                  </Text>
                ) : null}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  typeToggle: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 12,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
  },
  typeButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#999",
  },
  typeButtonTextActive: { color: "#fff" },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  label: { fontSize: 12, marginBottom: 8 },
  amountRow: { flexDirection: "row", alignItems: "center" },
  yen: { fontSize: 28, fontWeight: "700", marginRight: 4 },
  amountInput: { fontSize: 36, fontWeight: "700", flex: 1 },
  dateText: { fontSize: 18, fontWeight: "500" },
  selectorButton: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectorValue: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  selectorAction: {
    marginLeft: 12,
    fontSize: 14,
    fontWeight: "700",
  },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  categoryChip: {
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  categoryChipText: { fontSize: 14, fontWeight: "500" },
  emptyBreakdownText: { fontSize: 14 },
  selectedBreakdownText: { fontSize: 12, marginTop: 8 },
  memoInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    minHeight: 60,
  },
  keyboardAccessory: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "flex-end",
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  keyboardAccessoryDone: { fontSize: 16, fontWeight: "600" },
  submitButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 4,
  },
  submitButtonText: { color: "#fff", fontSize: 17, fontWeight: "700" },
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
  fullModalContainer: { flex: 1 },
  fullModalHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fullModalTitle: { fontSize: 18, fontWeight: "700" },
  fullModalClose: { fontSize: 15, fontWeight: "600" },
  fullModalContent: { padding: 16, paddingBottom: 32, gap: 10 },
  fullCategoryRow: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  fullCategoryDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  fullCategoryName: { flex: 1, fontSize: 16, fontWeight: "600" },
  fullCategorySelected: { fontSize: 13, fontWeight: "700" },
  storeSearchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  storeSearchInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 15,
  },
  addStoreButton: {
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  addStoreButtonText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  storeEmptyText: { fontSize: 14, textAlign: "center", paddingVertical: 16 },
});
