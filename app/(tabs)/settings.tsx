import { useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    Alert,
    InputAccessoryView,
    Keyboard,
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
import { exportCSV } from "@/lib/csvExport";
import {
    addBreakdown,
    addCategory,
    Breakdown,
    Category,
    deleteBreakdown,
    deleteCategory,
    deleteMonthlyBudget,
    getBreakdownsByCategory,
    getCategories,
    getMonthlyBudgets,
    resetCategoryAndBreakdownsToDefault,
    resetDatabaseForDevelopment,
    setMonthlyBudget,
    TransactionType,
    updateBreakdown,
    updateCategory,
} from "@/lib/database";

const PRESET_COLORS = [
  "#1565C0",
  "#1976D2",
  "#42A5F5",
  "#00796B",
  "#2E7D32",
  "#C62828",
  "#AD1457",
  "#E65100",
  "#F57F17",
  "#4527A0",
  "#6A1B9A",
  "#37474F",
  "#757575",
  "#5D4037",
  "#00695C",
];

type ManagerTab = "category" | "breakdown";
const KEYBOARD_ACCESSORY_VIEW_ID = "settings-keyboard-accessory";

function formatYenDisplay(rawDigits: string): string {
  if (!rawDigits) return "";
  const amount = parseInt(rawDigits, 10);
  if (isNaN(amount)) return "";
  return `¥${amount.toLocaleString("ja-JP")}`;
}

export default function SettingsScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];

  const [categories, setCategories] = useState<Category[]>([]);
  const [breakdowns, setBreakdowns] = useState<Breakdown[]>([]);

  const [showManagerModal, setShowManagerModal] = useState(false);
  const [managerTab, setManagerTab] = useState<ManagerTab>("category");
  const [activeType, setActiveType] = useState<TransactionType>("expense");
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(
    null,
  );

  const [categoryEditingId, setCategoryEditingId] = useState<number | null>(
    null,
  );
  const [categoryNameInput, setCategoryNameInput] = useState("");
  const [categoryColorInput, setCategoryColorInput] = useState(
    PRESET_COLORS[5],
  );

  const [breakdownEditingId, setBreakdownEditingId] = useState<number | null>(
    null,
  );
  const [breakdownNameInput, setBreakdownNameInput] = useState("");

  const [exporting, setExporting] = useState(false);
  const [budgetInputs, setBudgetInputs] = useState<Record<number, string>>({});

  const load = useCallback(() => {
    const allCategories = getCategories();
    setCategories(allCategories);

    const firstCategory =
      allCategories.find((c) => c.type === activeType) ?? null;
    const nextCategoryId =
      selectedCategoryId &&
      allCategories.some((c) => c.id === selectedCategoryId)
        ? selectedCategoryId
        : (firstCategory?.id ?? null);

    setSelectedCategoryId(nextCategoryId);
    if (nextCategoryId) {
      setBreakdowns(getBreakdownsByCategory(nextCategoryId));
    } else {
      setBreakdowns([]);
    }
  }, [activeType, selectedCategoryId]);

  const loadBudgetEditor = useCallback(() => {
    const rows = getMonthlyBudgets("expense");
    const nextInputs: Record<number, string> = {};
    rows.forEach((row) => {
      nextInputs[row.categoryId] = row.amount > 0 ? String(row.amount) : "";
    });
    setBudgetInputs(nextInputs);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      loadBudgetEditor();
    }, [load, loadBudgetEditor]),
  );

  useEffect(() => {
    loadBudgetEditor();
  }, [loadBudgetEditor]);

  const visibleCategories = useMemo(
    () => categories.filter((c) => c.type === activeType),
    [categories, activeType],
  );

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId],
  );

  const resetCategoryForm = () => {
    setCategoryEditingId(null);
    setCategoryNameInput("");
    setCategoryColorInput(
      activeType === "income" ? PRESET_COLORS[0] : PRESET_COLORS[5],
    );
  };

  const resetBreakdownForm = () => {
    setBreakdownEditingId(null);
    setBreakdownNameInput("");
  };

  const reloadBreakdowns = (categoryId: number | null) => {
    if (!categoryId) {
      setBreakdowns([]);
      return;
    }
    setBreakdowns(getBreakdownsByCategory(categoryId));
  };

  const handleTypeChange = (type: TransactionType) => {
    setActiveType(type);
    const first = categories.find((c) => c.type === type) ?? null;
    const nextId = first?.id ?? null;
    setSelectedCategoryId(nextId);
    reloadBreakdowns(nextId);
    resetCategoryForm();
    resetBreakdownForm();
  };

  const handleSaveCategory = () => {
    const trimmed = categoryNameInput.trim();
    if (!trimmed) {
      Alert.alert("エラー", "カテゴリ名を入力してください");
      return;
    }

    if (categoryEditingId) {
      updateCategory(categoryEditingId, trimmed, categoryColorInput);
    } else {
      addCategory(trimmed, activeType, categoryColorInput);
    }

    load();
    loadBudgetEditor();
    resetCategoryForm();
  };

  const handleEditCategory = (cat: Category) => {
    setCategoryEditingId(cat.id);
    setCategoryNameInput(cat.name);
    setCategoryColorInput(cat.color);
  };

  const handleDeleteCategory = (cat: Category) => {
    Alert.alert("削除確認", `「${cat.name}」を削除しますか？`, [
      { text: "キャンセル", style: "cancel" },
      {
        text: "削除",
        style: "destructive",
        onPress: () => {
          deleteCategory(cat.id);
          load();
          loadBudgetEditor();
          if (selectedCategoryId === cat.id) {
            setSelectedCategoryId(null);
          }
        },
      },
    ]);
  };

  const handleSaveBreakdown = () => {
    const trimmed = breakdownNameInput.trim();
    if (!trimmed) {
      Alert.alert("エラー", "内訳名を入力してください");
      return;
    }
    if (!selectedCategoryId) {
      Alert.alert("エラー", "カテゴリを選択してください");
      return;
    }

    if (breakdownEditingId) {
      updateBreakdown(breakdownEditingId, trimmed);
    } else {
      addBreakdown(selectedCategoryId, trimmed);
    }

    reloadBreakdowns(selectedCategoryId);
    resetBreakdownForm();
  };

  const handleEditBreakdown = (item: Breakdown) => {
    setBreakdownEditingId(item.id);
    setBreakdownNameInput(item.name);
  };

  const handleDeleteBreakdown = (item: Breakdown) => {
    Alert.alert("削除確認", `「${item.name}」を削除しますか？`, [
      { text: "キャンセル", style: "cancel" },
      {
        text: "削除",
        style: "destructive",
        onPress: () => {
          deleteBreakdown(item.id);
          reloadBreakdowns(selectedCategoryId);
        },
      },
    ]);
  };

  const handleResetMasterToDefault = () => {
    Alert.alert(
      "カテゴリ/内訳をデフォルトに戻す",
      "カテゴリと内訳のマスタを初期状態に戻します。記録済みデータは削除されません。実行しますか？",
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "実行",
          style: "destructive",
          onPress: () => {
            try {
              resetCategoryAndBreakdownsToDefault();
              load();
              resetCategoryForm();
              resetBreakdownForm();
              loadBudgetEditor();
              Alert.alert("完了", "カテゴリ/内訳をデフォルトに戻しました");
            } catch {
              Alert.alert("エラー", "初期化に失敗しました");
            }
          },
        },
      ],
    );
  };

  const handleOpenManager = () => {
    resetCategoryForm();
    resetBreakdownForm();
    setManagerTab("category");
    setShowManagerModal(true);
  };

  const handleBudgetInputChange = (categoryId: number, raw: string) => {
    const normalized = raw.replace(/\D/g, "").slice(0, 7);
    setBudgetInputs((prev) => ({ ...prev, [categoryId]: normalized }));

    if (!normalized) {
      deleteMonthlyBudget(categoryId);
      return;
    }

    const amount = parseInt(normalized, 10);
    if (!isNaN(amount) && amount >= 0) {
      setMonthlyBudget(categoryId, amount);
    }
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      await exportCSV();
    } catch {
      Alert.alert("エラー", "CSV出力に失敗しました");
    } finally {
      setExporting(false);
    }
  };

  const handleResetDatabase = () => {
    Alert.alert(
      "開発用DBリセット",
      "カテゴリ・内訳・記録データをすべて初期化します。実行しますか？",
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "リセット",
          style: "destructive",
          onPress: () => {
            try {
              resetDatabaseForDevelopment();
              load();
              setSelectedCategoryId(null);
              setCategoryEditingId(null);
              setBreakdownEditingId(null);
              setCategoryNameInput("");
              setBreakdownNameInput("");
              Alert.alert("完了", "DBを初期化しました（開発用）");
            } catch {
              Alert.alert("エラー", "DB初期化に失敗しました");
            }
          },
        },
      ],
    );
  };

  const incomeColor = colorScheme === "dark" ? "#42A5F5" : "#1565C0";
  const expenseColor = colorScheme === "dark" ? "#EF5350" : "#C62828";

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <View
        style={[
          styles.section,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          データ
        </Text>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.tint }]}
          onPress={handleExportCSV}
          disabled={exporting}
        >
          <Text style={styles.actionButtonText}>
            {exporting ? "出力中..." : "CSVで書き出す"}
          </Text>
        </TouchableOpacity>

        {__DEV__ && (
          <TouchableOpacity
            style={[styles.actionButton, styles.devResetButton]}
            onPress={handleResetDatabase}
          >
            <Text style={styles.actionButtonText}>開発用: DBをリセット</Text>
          </TouchableOpacity>
        )}
      </View>

      <View
        style={[
          styles.section,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          カテゴリ/内訳設定
        </Text>
        <Text style={[styles.sectionDescription, { color: colors.subText }]}>
          今後の設定項目追加にも対応しやすいポップアップ方式で管理します。
        </Text>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.tint }]}
          onPress={handleOpenManager}
        >
          <Text style={styles.actionButtonText}>管理画面を開く</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.resetDefaultButton]}
          onPress={handleResetMasterToDefault}
        >
          <Text style={styles.actionButtonText}>
            カテゴリ/内訳をデフォルトに戻す
          </Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showManagerModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.popupWindow,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View
              style={[styles.popupHeader, { borderBottomColor: colors.border }]}
            >
              <Text style={[styles.popupTitle, { color: colors.text }]}>
                設定管理
              </Text>
              <TouchableOpacity onPress={() => setShowManagerModal(false)}>
                <Text style={[styles.popupClose, { color: colors.tint }]}>
                  閉じる
                </Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.tabRow, { borderColor: colors.border }]}>
              <TouchableOpacity
                style={[
                  styles.tabButton,
                  managerTab === "category" && { backgroundColor: colors.tint },
                ]}
                onPress={() => setManagerTab("category")}
              >
                <Text
                  style={[
                    styles.tabButtonText,
                    managerTab === "category" && { color: "#fff" },
                  ]}
                >
                  カテゴリ
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.tabButton,
                  managerTab === "breakdown" && {
                    backgroundColor: colors.tint,
                  },
                ]}
                onPress={() => setManagerTab("breakdown")}
              >
                <Text
                  style={[
                    styles.tabButtonText,
                    managerTab === "breakdown" && { color: "#fff" },
                  ]}
                >
                  内訳
                </Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.typeToggle, { borderColor: colors.border }]}>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  activeType === "income" && { backgroundColor: incomeColor },
                ]}
                onPress={() => handleTypeChange("income")}
              >
                <Text
                  style={[
                    styles.typeText,
                    activeType === "income" && { color: "#fff" },
                  ]}
                >
                  収入
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  activeType === "expense" && { backgroundColor: expenseColor },
                ]}
                onPress={() => handleTypeChange("expense")}
              >
                <Text
                  style={[
                    styles.typeText,
                    activeType === "expense" && { color: "#fff" },
                  ]}
                >
                  支出
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.managerBody}>
              {managerTab === "category" ? (
                <>
                  <ScrollView
                    style={styles.managerListScroll}
                    contentContainerStyle={styles.managerListContent}
                  >
                    <Text
                      style={[styles.groupLabel, { color: colors.subText }]}
                    >
                      カテゴリ一覧
                    </Text>
                    {visibleCategories.map((cat) => (
                      <View
                        key={cat.id}
                        style={[styles.itemRow, { borderColor: colors.border }]}
                      >
                        <View
                          style={[
                            styles.categoryDot,
                            { backgroundColor: cat.color },
                          ]}
                        />
                        <Text style={[styles.itemName, { color: colors.text }]}>
                          {cat.name}
                        </Text>
                        {activeType === "expense" ? (
                          <TextInput
                            style={[
                              styles.inlineBudgetInput,
                              {
                                borderColor: colors.border,
                                color: colors.text,
                              },
                            ]}
                            value={formatYenDisplay(budgetInputs[cat.id] ?? "")}
                            onChangeText={(text) =>
                              handleBudgetInputChange(cat.id, text)
                            }
                            placeholder="¥0"
                            placeholderTextColor={colors.subText}
                            keyboardType="number-pad"
                            returnKeyType="done"
                            inputAccessoryViewID={
                              Platform.OS === "ios"
                                ? KEYBOARD_ACCESSORY_VIEW_ID
                                : undefined
                            }
                          />
                        ) : null}
                        <TouchableOpacity
                          onPress={() => handleEditCategory(cat)}
                        >
                          <Text
                            style={[styles.itemAction, { color: colors.tint }]}
                          >
                            編集
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDeleteCategory(cat)}
                        >
                          <Text style={[styles.itemDelete]}>削除</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>

                  <View
                    style={[
                      styles.managerForm,
                      {
                        borderTopColor: colors.border,
                        backgroundColor: colors.card,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.groupLabel, { color: colors.subText }]}
                    >
                      カテゴリ{categoryEditingId ? "編集" : "追加"}
                    </Text>
                    <TextInput
                      style={[
                        styles.textInput,
                        { borderColor: colors.border, color: colors.text },
                      ]}
                      value={categoryNameInput}
                      onChangeText={setCategoryNameInput}
                      placeholder="カテゴリ名"
                      placeholderTextColor={colors.subText}
                      maxLength={20}
                      returnKeyType="done"
                      blurOnSubmit
                      onSubmitEditing={Keyboard.dismiss}
                      inputAccessoryViewID={
                        Platform.OS === "ios"
                          ? KEYBOARD_ACCESSORY_VIEW_ID
                          : undefined
                      }
                    />

                    <View style={styles.colorGrid}>
                      {PRESET_COLORS.map((c) => (
                        <TouchableOpacity
                          key={c}
                          style={[
                            styles.colorSwatch,
                            { backgroundColor: c },
                            categoryColorInput === c &&
                              styles.colorSwatchSelected,
                          ]}
                          onPress={() => setCategoryColorInput(c)}
                        />
                      ))}
                    </View>

                    <View style={styles.formButtons}>
                      <TouchableOpacity
                        style={[
                          styles.formButton,
                          { borderColor: colors.border },
                        ]}
                        onPress={resetCategoryForm}
                      >
                        <Text
                          style={[
                            styles.formButtonText,
                            { color: colors.subText },
                          ]}
                        >
                          リセット
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.formButton,
                          {
                            backgroundColor: colors.tint,
                            borderColor: colors.tint,
                          },
                        ]}
                        onPress={handleSaveCategory}
                      >
                        <Text
                          style={[styles.formButtonText, { color: "#fff" }]}
                        >
                          {categoryEditingId ? "更新" : "追加"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              ) : (
                <>
                  <ScrollView
                    style={styles.managerListScroll}
                    contentContainerStyle={styles.managerListContent}
                  >
                    <Text
                      style={[styles.groupLabel, { color: colors.subText }]}
                    >
                      対象カテゴリ
                    </Text>
                    <View style={styles.chipWrap}>
                      {visibleCategories.map((cat) => (
                        <TouchableOpacity
                          key={cat.id}
                          style={[
                            styles.chip,
                            { borderColor: cat.color },
                            selectedCategoryId === cat.id && {
                              backgroundColor: cat.color,
                            },
                          ]}
                          onPress={() => {
                            setSelectedCategoryId(cat.id);
                            reloadBreakdowns(cat.id);
                            resetBreakdownForm();
                          }}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              { color: cat.color },
                              selectedCategoryId === cat.id && {
                                color: "#fff",
                              },
                            ]}
                          >
                            {cat.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text
                      style={[styles.groupLabel, { color: colors.subText }]}
                    >
                      内訳一覧
                    </Text>
                    {selectedCategory ? (
                      breakdowns.length > 0 ? (
                        breakdowns.map((item) => (
                          <View
                            key={item.id}
                            style={[
                              styles.itemRow,
                              { borderColor: colors.border },
                            ]}
                          >
                            <Text
                              style={[styles.itemName, { color: colors.text }]}
                            >
                              {item.name}
                            </Text>
                            <TouchableOpacity
                              onPress={() => handleEditBreakdown(item)}
                            >
                              <Text
                                style={[
                                  styles.itemAction,
                                  { color: colors.tint },
                                ]}
                              >
                                編集
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleDeleteBreakdown(item)}
                            >
                              <Text style={[styles.itemDelete]}>削除</Text>
                            </TouchableOpacity>
                          </View>
                        ))
                      ) : (
                        <Text
                          style={[styles.emptyText, { color: colors.subText }]}
                        >
                          内訳がありません
                        </Text>
                      )
                    ) : (
                      <Text
                        style={[styles.emptyText, { color: colors.subText }]}
                      >
                        カテゴリを選択してください
                      </Text>
                    )}
                  </ScrollView>

                  <View
                    style={[
                      styles.managerForm,
                      {
                        borderTopColor: colors.border,
                        backgroundColor: colors.card,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.groupLabel, { color: colors.subText }]}
                    >
                      内訳{breakdownEditingId ? "編集" : "追加"}
                    </Text>
                    <TextInput
                      style={[
                        styles.textInput,
                        { borderColor: colors.border, color: colors.text },
                      ]}
                      value={breakdownNameInput}
                      onChangeText={setBreakdownNameInput}
                      placeholder="内訳名"
                      placeholderTextColor={colors.subText}
                      maxLength={30}
                      returnKeyType="done"
                      blurOnSubmit
                      onSubmitEditing={Keyboard.dismiss}
                      inputAccessoryViewID={
                        Platform.OS === "ios"
                          ? KEYBOARD_ACCESSORY_VIEW_ID
                          : undefined
                      }
                    />

                    <View style={styles.formButtons}>
                      <TouchableOpacity
                        style={[
                          styles.formButton,
                          { borderColor: colors.border },
                        ]}
                        onPress={resetBreakdownForm}
                      >
                        <Text
                          style={[
                            styles.formButtonText,
                            { color: colors.subText },
                          ]}
                        >
                          リセット
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.formButton,
                          {
                            backgroundColor: colors.tint,
                            borderColor: colors.tint,
                          },
                        ]}
                        onPress={handleSaveBreakdown}
                      >
                        <Text
                          style={[styles.formButtonText, { color: "#fff" }]}
                        >
                          {breakdownEditingId ? "更新" : "追加"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {Platform.OS === "ios" ? (
        <InputAccessoryView nativeID={KEYBOARD_ACCESSORY_VIEW_ID}>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 12, paddingBottom: 100 },
  section: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 8 },
  sectionDescription: { fontSize: 13, marginBottom: 12, lineHeight: 20 },
  actionButton: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  devResetButton: {
    backgroundColor: "#B71C1C",
    marginTop: 10,
  },
  resetDefaultButton: {
    backgroundColor: "#EF6C00",
    marginTop: 10,
  },
  actionButtonText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  popupWindow: {
    width: "100%",
    maxWidth: 640,
    height: "85%",
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  popupHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  popupTitle: { fontSize: 17, fontWeight: "700" },
  popupClose: { fontSize: 14, fontWeight: "600" },
  tabRow: {
    flexDirection: "row",
    margin: 12,
    borderWidth: 1,
    borderRadius: 10,
    overflow: "hidden",
  },
  tabButton: { flex: 1, paddingVertical: 10, alignItems: "center" },
  tabButtonText: { fontSize: 14, fontWeight: "600", color: "#999" },
  typeToggle: {
    flexDirection: "row",
    marginHorizontal: 12,
    borderWidth: 1,
    borderRadius: 10,
    overflow: "hidden",
  },
  typeButton: { flex: 1, paddingVertical: 10, alignItems: "center" },
  typeText: { fontSize: 14, fontWeight: "600", color: "#999" },
  managerBody: { flex: 1 },
  managerListScroll: { flex: 1 },
  managerListContent: { padding: 12, paddingBottom: 12 },
  managerForm: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
  },
  groupLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 10,
    marginBottom: 6,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 8,
  },
  categoryDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  itemName: { flex: 1, fontSize: 15 },
  itemAction: { fontSize: 13, fontWeight: "600", marginRight: 10 },
  itemDelete: { fontSize: 13, color: "#C62828", fontWeight: "600" },
  inlineBudgetInput: {
    width: 98,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 12,
    textAlign: "right",
    marginRight: 8,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 10,
    marginBottom: 12,
  },
  colorSwatch: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  colorSwatchSelected: {
    borderWidth: 3,
    borderColor: "#fff",
  },
  formButtons: { flexDirection: "row", gap: 10 },
  formButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  formButtonText: { fontSize: 14, fontWeight: "600" },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  chip: {
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: { fontSize: 13, fontWeight: "600" },
  emptyText: { fontSize: 13, marginBottom: 8 },
  keyboardAccessory: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "flex-end",
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  keyboardAccessoryDone: { fontSize: 16, fontWeight: "600" },
});
