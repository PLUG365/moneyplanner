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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { exportCSV } from "@/lib/csvExport";
import {
  Account,
  addAccount,
  addBreakdown,
  addCategory,
  Breakdown,
  Category,
  DEFAULT_ACCOUNT_ID,
  deleteAccountAndMoveToDefault,
  deleteBreakdown,
  deleteCategory,
  deleteMonthlyBudget,
  getAccounts,
  getBreakdownsByCategory,
  getCategories,
  getMonthlyBudgets,
  resetCategoryAndBreakdownsToDefault,
  resetDatabaseForDevelopment,
  setMonthlyBudget,
  TransactionType,
  updateAccountBalance,
  updateAccountName,
  updateBreakdown,
  updateCategory,
} from "@/lib/database";
import {
  formatYenDisplay,
  getSettingsKeyboardAccessoryPreview,
  type SettingsKeyboardField,
} from "@/lib/settingsKeyboardAccessory";
import {
  buildAccountEditorDraft,
  buildBreakdownEditorDraft,
  buildCategoryEditorDraft,
  buildEditorMeta,
  buildEmptyAccountEditorDraft,
  buildEmptyBreakdownEditorDraft,
  buildEmptyCategoryEditorDraft,
  type SettingsManagerTab,
} from "@/lib/settingsManagerEditor";

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

const KEYBOARD_ACCESSORY_VIEW_ID = "settings-keyboard-accessory";

export default function SettingsScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();

  const sheetAnim = useRef(new Animated.Value(600)).current;

  const [categories, setCategories] = useState<Category[]>([]);
  const [breakdowns, setBreakdowns] = useState<Breakdown[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const [showManagerModal, setShowManagerModal] = useState(false);
  const [showEditorModal, setShowEditorModal] = useState(false);
  const [managerMode, setManagerMode] = useState<"category" | "account">(
    "category",
  );

  useEffect(() => {
    if (showEditorModal) {
      sheetAnim.setValue(600);
      Animated.spring(sheetAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 60,
        friction: 12,
      }).start();
    }
  }, [showEditorModal, sheetAnim]);

  const [managerTab, setManagerTab] = useState<SettingsManagerTab>("category");
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
  const [categoryBudgetInput, setCategoryBudgetInput] = useState("");

  const [breakdownEditingId, setBreakdownEditingId] = useState<number | null>(
    null,
  );
  const [breakdownNameInput, setBreakdownNameInput] = useState("");
  const [accountEditingId, setAccountEditingId] = useState<number | null>(null);
  const [accountNameInput, setAccountNameInput] = useState("");
  const [accountBalanceInput, setAccountBalanceInput] = useState("");
  const [activeKeyboardField, setActiveKeyboardField] =
    useState<SettingsKeyboardField>(null);

  const [exporting, setExporting] = useState(false);
  const [budgetInputs, setBudgetInputs] = useState<Record<number, string>>({});

  const load = useCallback(() => {
    const allCategories = getCategories();
    setCategories(allCategories);
    setAccounts(getAccounts());

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

  const isEditingCurrentTab =
    (managerTab === "category" && categoryEditingId !== null) ||
    (managerTab === "breakdown" && breakdownEditingId !== null) ||
    (managerTab === "account" && accountEditingId !== null);

  const editorMeta = buildEditorMeta(managerTab, isEditingCurrentTab);

  const keyboardAccessoryPreview = useMemo(() => {
    const budgetValue =
      activeKeyboardField?.kind === "budget" ? categoryBudgetInput : "";

    return getSettingsKeyboardAccessoryPreview(activeKeyboardField, {
      categoryName: categoryNameInput,
      breakdownName: breakdownNameInput,
      accountName: accountNameInput,
      accountBalance: accountBalanceInput,
      budgetValue,
    });
  }, [
    accountBalanceInput,
    accountNameInput,
    activeKeyboardField,
    breakdownNameInput,
    categoryBudgetInput,
    categoryNameInput,
  ]);

  const resetCategoryForm = () => {
    setCategoryEditingId(null);
    setCategoryNameInput("");
    setCategoryBudgetInput("");
    setActiveKeyboardField(null);
    setCategoryColorInput(
      activeType === "income" ? PRESET_COLORS[0] : PRESET_COLORS[5],
    );
  };

  const resetBreakdownForm = () => {
    setBreakdownEditingId(null);
    setBreakdownNameInput("");
    setActiveKeyboardField(null);
  };

  const resetAccountForm = () => {
    setAccountEditingId(null);
    setAccountNameInput("");
    setAccountBalanceInput("");
    setActiveKeyboardField(null);
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
    resetAccountForm();
  };

  const handleSaveAccount = () => {
    const trimmed = accountNameInput.trim();
    if (!trimmed) {
      Alert.alert("エラー", "口座名を入力してください");
      return;
    }

    const balance = parseInt(accountBalanceInput || "0", 10);
    if (isNaN(balance)) {
      Alert.alert("エラー", "残高を入力してください");
      return;
    }

    if (accountEditingId) {
      updateAccountName(accountEditingId, trimmed);
      updateAccountBalance(accountEditingId, balance);
    } else {
      addAccount(trimmed, balance);
    }

    load();
    resetAccountForm();
    setShowEditorModal(false);
  };

  const handleEditAccount = (account: Account) => {
    setAccountEditingId(account.id);
    const draft = buildAccountEditorDraft(account);
    setAccountNameInput(draft.name);
    setAccountBalanceInput(draft.balance);
    setManagerTab("account");
    setShowEditorModal(true);
  };

  const handleDeleteAccount = (account: Account) => {
    if (account.id === DEFAULT_ACCOUNT_ID || account.isDefault) {
      Alert.alert("削除不可", "既定口座は削除できません");
      return;
    }
    Alert.alert(
      "口座を削除",
      `「${account.name}」の取引は既定口座へ移管されます。\n\n削除口座の現在の残高は既定口座に加算されません。移管される取引の収支のみが既定口座の残高に反映されます。`,

      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "削除",
          style: "destructive",
          onPress: () => {
            deleteAccountAndMoveToDefault(account.id);
            load();
            resetAccountForm();
          },
        },
      ],
    );
  };

  const handleSaveCategory = () => {
    const trimmed = categoryNameInput.trim();
    if (!trimmed) {
      Alert.alert("エラー", "カテゴリ名を入力してください");
      return;
    }

    let savedCategoryId: number;
    if (categoryEditingId) {
      updateCategory(categoryEditingId, trimmed, categoryColorInput);
      savedCategoryId = categoryEditingId;
    } else {
      savedCategoryId = addCategory(trimmed, activeType, categoryColorInput);
    }

    if (activeType === "expense") {
      const normalized = categoryBudgetInput.replace(/\D/g, "");
      if (!normalized) {
        deleteMonthlyBudget(savedCategoryId);
      } else {
        const amount = parseInt(normalized, 10);
        if (!isNaN(amount) && amount >= 0) {
          setMonthlyBudget(savedCategoryId, amount);
        }
      }
    }

    load();
    loadBudgetEditor();
    resetCategoryForm();
    setShowEditorModal(false);
  };

  const handleEditCategory = (cat: Category) => {
    setCategoryEditingId(cat.id);
    const draft = buildCategoryEditorDraft(cat);
    setCategoryNameInput(draft.name);
    setCategoryColorInput(draft.color);
    setCategoryBudgetInput(budgetInputs[cat.id] ?? "");
    setManagerTab("category");
    setShowEditorModal(true);
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
    setShowEditorModal(false);
  };

  const handleEditBreakdown = (item: Breakdown) => {
    setBreakdownEditingId(item.id);
    const draft = buildBreakdownEditorDraft(item);
    setBreakdownNameInput(draft.name);
    setManagerTab("breakdown");
    setShowEditorModal(true);
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
    resetAccountForm();
    setActiveKeyboardField(null);
    setShowEditorModal(false);
    setManagerMode("category");
    setManagerTab("category");
    setShowManagerModal(true);
  };

  const handleOpenAccountManager = () => {
    resetCategoryForm();
    resetBreakdownForm();
    resetAccountForm();
    setActiveKeyboardField(null);
    setShowEditorModal(false);
    setManagerMode("account");
    setManagerTab("account");
    setShowManagerModal(true);
  };

  const handleCloseManagerModal = () => {
    setActiveKeyboardField(null);
    Keyboard.dismiss();
    setShowEditorModal(false);
    setShowManagerModal(false);
  };

  const handleOpenCategoryCreate = () => {
    resetCategoryForm();
    const draft = buildEmptyCategoryEditorDraft(
      activeType,
      activeType === "income" ? PRESET_COLORS[0] : PRESET_COLORS[5],
    );
    setCategoryNameInput(draft.name);
    setCategoryColorInput(draft.color);
    setManagerTab("category");
    setShowEditorModal(true);
  };

  const handleOpenBreakdownCreate = () => {
    if (!selectedCategoryId) {
      Alert.alert("エラー", "カテゴリを選択してください");
      return;
    }
    resetBreakdownForm();
    const draft = buildEmptyBreakdownEditorDraft();
    setBreakdownNameInput(draft.name);
    setManagerTab("breakdown");
    setShowEditorModal(true);
  };

  const handleOpenAccountCreate = () => {
    resetAccountForm();
    const draft = buildEmptyAccountEditorDraft();
    setAccountNameInput(draft.name);
    setAccountBalanceInput(draft.balance);
    setManagerTab("account");
    setShowEditorModal(true);
  };

  const handleCloseEditorModal = () => {
    setActiveKeyboardField(null);
    Keyboard.dismiss();
    setShowEditorModal(false);
    if (managerTab === "category") {
      resetCategoryForm();
      return;
    }
    if (managerTab === "breakdown") {
      resetBreakdownForm();
      return;
    }
    resetAccountForm();
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
          カテゴリ/内訳
        </Text>
        <Text style={[styles.sectionDescription, { color: colors.subText }]}>
          カテゴリ・内訳の追加・編集・削除ができます。
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

      <View
        style={[
          styles.section,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          口座設定
        </Text>
        <Text style={[styles.sectionDescription, { color: colors.subText }]}>
          口座の追加・編集・削除ができます。
        </Text>
        <TouchableOpacity
          style={[styles.actionButton, styles.accountManagerButton]}
          onPress={handleOpenAccountManager}
        >
          <Text style={styles.actionButtonText}>口座管理を開く</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={showManagerModal || showEditorModal}
        transparent
        animationType="fade"
      >
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
                {managerMode === "account" ? "口座管理" : "カテゴリ/内訳管理"}
              </Text>
              <TouchableOpacity onPress={handleCloseManagerModal}>
                <Text style={[styles.popupClose, { color: colors.tint }]}>
                  閉じる
                </Text>
              </TouchableOpacity>
            </View>

            {managerMode === "category" && (
              <View style={[styles.tabRow, { borderColor: colors.border }]}>
                <TouchableOpacity
                  style={[
                    styles.tabButton,
                    managerTab === "category" && {
                      backgroundColor: colors.tint,
                    },
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
            )}

            {managerTab !== "account" ? (
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
                    activeType === "expense" && {
                      backgroundColor: expenseColor,
                    },
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
            ) : null}

            <View style={styles.managerBody}>
              {managerTab === "category" ? (
                <ScrollView
                  style={styles.managerListScroll}
                  contentContainerStyle={styles.managerListContent}
                >
                  <TouchableOpacity
                    style={[
                      styles.secondaryActionButton,
                      { borderColor: colors.tint },
                    ]}
                    onPress={handleOpenCategoryCreate}
                  >
                    <Text
                      style={[
                        styles.secondaryActionButtonText,
                        { color: colors.tint },
                      ]}
                    >
                      カテゴリを追加
                    </Text>
                  </TouchableOpacity>
                  <Text style={[styles.groupLabel, { color: colors.subText }]}>
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
                        <Text
                          style={[
                            styles.budgetDisplayText,
                            { color: colors.subText },
                          ]}
                        >
                          {budgetInputs[cat.id]
                            ? `¥${parseInt(budgetInputs[cat.id], 10).toLocaleString("ja-JP")}`
                            : "未設定"}
                        </Text>
                      ) : null}
                      <TouchableOpacity onPress={() => handleEditCategory(cat)}>
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
              ) : managerTab === "breakdown" ? (
                <ScrollView
                  style={styles.managerListScroll}
                  contentContainerStyle={styles.managerListContent}
                >
                  <TouchableOpacity
                    style={[
                      styles.secondaryActionButton,
                      { borderColor: colors.tint },
                    ]}
                    onPress={handleOpenBreakdownCreate}
                  >
                    <Text
                      style={[
                        styles.secondaryActionButtonText,
                        { color: colors.tint },
                      ]}
                    >
                      内訳を追加
                    </Text>
                  </TouchableOpacity>
                  <Text style={[styles.groupLabel, { color: colors.subText }]}>
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
                            selectedCategoryId === cat.id && { color: "#fff" },
                          ]}
                        >
                          {cat.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={[styles.groupLabel, { color: colors.subText }]}>
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
                    <Text style={[styles.emptyText, { color: colors.subText }]}>
                      カテゴリを選択してください
                    </Text>
                  )}
                </ScrollView>
              ) : (
                <ScrollView
                  style={styles.managerListScroll}
                  contentContainerStyle={styles.managerListContent}
                >
                  <TouchableOpacity
                    style={[
                      styles.secondaryActionButton,
                      { borderColor: colors.tint },
                    ]}
                    onPress={handleOpenAccountCreate}
                  >
                    <Text
                      style={[
                        styles.secondaryActionButtonText,
                        { color: colors.tint },
                      ]}
                    >
                      口座を追加
                    </Text>
                  </TouchableOpacity>
                  <Text style={[styles.groupLabel, { color: colors.subText }]}>
                    口座一覧
                  </Text>
                  {accounts.map((account) => (
                    <View
                      key={account.id}
                      style={[styles.itemRow, { borderColor: colors.border }]}
                    >
                      <View style={styles.accountInfoWrap}>
                        <Text style={[styles.itemName, { color: colors.text }]}>
                          {account.name}
                          {account.isDefault ? "（既定）" : ""}
                        </Text>
                        <Text
                          style={[
                            styles.accountBalanceText,
                            { color: colors.subText },
                          ]}
                        >
                          ¥{account.balance.toLocaleString("ja-JP")}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleEditAccount(account)}
                      >
                        <Text
                          style={[styles.itemAction, { color: colors.tint }]}
                        >
                          編集
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeleteAccount(account)}
                        disabled={account.isDefault}
                      >
                        <Text
                          style={[
                            styles.itemDelete,
                            account.isDefault && { color: colors.subText },
                          ]}
                        >
                          削除
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          </View>
        </View>
        {showEditorModal && (
          <View style={styles.editorOverlay}>
            <Animated.View
              style={[
                styles.editorWindow,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  paddingTop: insets.top,
                  paddingBottom: insets.bottom,
                },
                { transform: [{ translateY: sheetAnim }] },
              ]}
            >
              <View
                style={[
                  styles.popupHeader,
                  { borderBottomColor: colors.border },
                ]}
              >
                <Text style={[styles.popupTitle, { color: colors.text }]}>
                  {editorMeta.title}
                </Text>
                <TouchableOpacity onPress={handleCloseEditorModal}>
                  <Text style={[styles.popupClose, { color: colors.tint }]}>
                    閉じる
                  </Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                contentContainerStyle={styles.editorContent}
                keyboardShouldPersistTaps="handled"
                automaticallyAdjustKeyboardInsets
              >
                {managerTab === "category" ? (
                  <>
                    <Text
                      style={[styles.groupLabel, { color: colors.subText }]}
                    >
                      カテゴリ名
                    </Text>
                    <TextInput
                      style={[
                        styles.textInput,
                        { borderColor: colors.border, color: colors.text },
                      ]}
                      value={categoryNameInput}
                      onChangeText={setCategoryNameInput}
                      onFocus={() =>
                        setActiveKeyboardField({ kind: "category-name" })
                      }
                      onBlur={() => setActiveKeyboardField(null)}
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

                    <Text
                      style={[styles.groupLabel, { color: colors.subText }]}
                    >
                      色
                    </Text>
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

                    {activeType === "expense" && (
                      <>
                        <Text
                          style={[styles.groupLabel, { color: colors.subText }]}
                        >
                          月次予算
                        </Text>
                        <TextInput
                          style={[
                            styles.textInput,
                            { borderColor: colors.border, color: colors.text },
                          ]}
                          value={formatYenDisplay(categoryBudgetInput)}
                          onChangeText={(text) =>
                            setCategoryBudgetInput(text.replace(/\D/g, ""))
                          }
                          onFocus={() =>
                            setActiveKeyboardField({
                              kind: "budget",
                              categoryName: categoryNameInput,
                            })
                          }
                          onBlur={() => setActiveKeyboardField(null)}
                          placeholder="予算なし"
                          placeholderTextColor={colors.subText}
                          keyboardType="number-pad"
                          returnKeyType="done"
                          inputAccessoryViewID={
                            Platform.OS === "ios"
                              ? KEYBOARD_ACCESSORY_VIEW_ID
                              : undefined
                          }
                        />
                      </>
                    )}
                  </>
                ) : managerTab === "breakdown" ? (
                  <>
                    <Text
                      style={[styles.groupLabel, { color: colors.subText }]}
                    >
                      対象カテゴリ
                    </Text>
                    <View
                      style={[
                        styles.editorInfoCard,
                        {
                          borderColor: colors.border,
                          backgroundColor: colors.background,
                        },
                      ]}
                    >
                      <Text
                        style={[styles.editorInfoText, { color: colors.text }]}
                      >
                        {selectedCategory?.name ?? "カテゴリ未選択"}
                      </Text>
                    </View>

                    <Text
                      style={[styles.groupLabel, { color: colors.subText }]}
                    >
                      内訳名
                    </Text>
                    <TextInput
                      style={[
                        styles.textInput,
                        { borderColor: colors.border, color: colors.text },
                      ]}
                      value={breakdownNameInput}
                      onChangeText={setBreakdownNameInput}
                      onFocus={() =>
                        setActiveKeyboardField({ kind: "breakdown-name" })
                      }
                      onBlur={() => setActiveKeyboardField(null)}
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
                  </>
                ) : (
                  <>
                    <Text
                      style={[styles.groupLabel, { color: colors.subText }]}
                    >
                      口座名
                    </Text>
                    <TextInput
                      style={[
                        styles.textInput,
                        { borderColor: colors.border, color: colors.text },
                      ]}
                      value={accountNameInput}
                      onChangeText={setAccountNameInput}
                      onFocus={() =>
                        setActiveKeyboardField({ kind: "account-name" })
                      }
                      onBlur={() => setActiveKeyboardField(null)}
                      placeholder="口座名"
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

                    <Text
                      style={[styles.groupLabel, { color: colors.subText }]}
                    >
                      初期残高
                    </Text>
                    <TextInput
                      style={[
                        styles.textInput,
                        { borderColor: colors.border, color: colors.text },
                      ]}
                      value={formatYenDisplay(accountBalanceInput)}
                      onChangeText={(text) =>
                        setAccountBalanceInput(text.replace(/\D/g, ""))
                      }
                      onFocus={() =>
                        setActiveKeyboardField({ kind: "account-balance" })
                      }
                      onBlur={() => setActiveKeyboardField(null)}
                      placeholder="初期残高（例: ¥100000）"
                      placeholderTextColor={colors.subText}
                      keyboardType="number-pad"
                      returnKeyType="done"
                      inputAccessoryViewID={
                        Platform.OS === "ios"
                          ? KEYBOARD_ACCESSORY_VIEW_ID
                          : undefined
                      }
                    />
                  </>
                )}
                <View
                  style={[
                    styles.editorFooter,
                    { borderTopColor: colors.border },
                  ]}
                >
                  <TouchableOpacity
                    style={[styles.formButton, { borderColor: colors.border }]}
                    onPress={handleCloseEditorModal}
                  >
                    <Text
                      style={[styles.formButtonText, { color: colors.subText }]}
                    >
                      キャンセル
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
                    onPress={
                      managerTab === "category"
                        ? handleSaveCategory
                        : managerTab === "breakdown"
                          ? handleSaveBreakdown
                          : handleSaveAccount
                    }
                  >
                    <Text style={[styles.formButtonText, { color: "#fff" }]}>
                      {editorMeta.submitLabel}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </Animated.View>
          </View>
        )}
      </Modal>

      {Platform.OS === "ios" ? (
        <InputAccessoryView nativeID={KEYBOARD_ACCESSORY_VIEW_ID}>
          <View
            style={[
              styles.keyboardAccessory,
              { backgroundColor: colors.card, borderTopColor: colors.border },
            ]}
          >
            <View style={styles.keyboardAccessoryPreviewWrap}>
              <Text
                style={[
                  styles.keyboardAccessoryLabel,
                  { color: colors.subText },
                ]}
              >
                {keyboardAccessoryPreview?.title ?? "入力中"}
              </Text>
              <Text
                numberOfLines={1}
                style={[
                  styles.keyboardAccessoryValue,
                  {
                    color: keyboardAccessoryPreview?.isPlaceholder
                      ? colors.subText
                      : colors.text,
                  },
                ]}
              >
                {keyboardAccessoryPreview?.text ??
                  "入力内容がここに表示されます"}
              </Text>
            </View>
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
  accountManagerButton: {
    backgroundColor: "#00695C",
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
  secondaryActionButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  secondaryActionButtonText: { fontSize: 14, fontWeight: "700" },
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
  accountInfoWrap: { flex: 1 },
  accountBalanceText: { fontSize: 12, marginTop: 2 },
  categoryDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  itemName: { flex: 1, fontSize: 15 },
  itemAction: { fontSize: 13, fontWeight: "600", marginRight: 10 },
  itemDelete: { fontSize: 13, color: "#C62828", fontWeight: "600" },
  budgetDisplayText: {
    fontSize: 12,
    marginRight: 8,
    minWidth: 48,
    textAlign: "right",
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
  editorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  editorWindow: {
    flex: 1,
    width: "100%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 0,
    overflow: "hidden",
  },
  editorContent: {
    padding: 16,
    paddingBottom: 20,
  },
  editorFooter: {
    flexDirection: "row",
    gap: 10,
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  editorInfoCard: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  editorInfoText: {
    fontSize: 15,
    fontWeight: "500",
  },
  keyboardAccessory: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  keyboardAccessoryPreviewWrap: {
    flex: 1,
  },
  keyboardAccessoryLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 2,
  },
  keyboardAccessoryValue: {
    fontSize: 14,
    fontWeight: "500",
  },
  keyboardAccessoryDone: { fontSize: 16, fontWeight: "600" },
});
