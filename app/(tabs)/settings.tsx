import { router, useFocusEffect, type Href } from "expo-router";
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

import MoneyInputModal from "@/components/MoneyInputModal";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useCollection } from "@/hooks/useFirestore";
import {
    ACCOUNT_DELETION_CONFIRMATION_TEXT,
    isAccountDeletionConfirmationValid,
} from "@/lib/accountDeletion";
import {
    deleteCurrentUserAccount,
    getCurrentUser,
    reauthenticateCurrentUserWithApple,
    signOut,
} from "@/lib/auth";
import {
    moveCategoryInDisplayOrder,
    type CategoryMoveDirection,
} from "@/lib/categoryOrdering";
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
    deleteHouseholdDataAndCurrentUserProfile,
    deleteMonthlyBudget,
    getAccounts,
    getBreakdownsByCategory,
    getCategories,
    getMonthlyBudgets,
    householdCollection,
    mapAccount,
    reconcileAccountBalancesFromTransactions,
    resetCategoryAndBreakdownsToDefault,
    resetFirestoreForDevelopment,
    setMonthlyBudget,
    TransactionType,
    updateAccountBalance,
    updateAccountName,
    updateBreakdown,
    updateCategory,
    updateCategoryDisplayOrders,
} from "@/lib/firestore";
import { buildFirestoreQueryKey } from "@/lib/firestoreSubscription";
import {
    getHouseholdId,
    getHouseholdMembers,
    getInviteCode,
    regenerateInviteCode,
    removeHouseholdMember,
    type HouseholdMember,
} from "@/lib/household";
import { buildBudgetInputMap } from "@/lib/settingsBudgetEditor";
import { getMemberRemovalActionLabel } from "@/lib/settingsHouseholdMembers";
import {
    formatAccountBalanceInputDisplay,
    formatYenDisplay,
    getSettingsKeyboardAccessoryPreview,
    resolveAccountBalanceInput,
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
import { getSettingsWriteAvailability } from "@/lib/settingsWriteAvailability";

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

type NumericInputTarget = "category-budget" | "account-balance";

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
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  );

  const [categoryEditingId, setCategoryEditingId] = useState<string | null>(
    null,
  );
  const [categoryNameInput, setCategoryNameInput] = useState("");
  const [categoryColorInput, setCategoryColorInput] = useState(
    PRESET_COLORS[5],
  );
  const [categoryBudgetInput, setCategoryBudgetInput] = useState("");

  const [breakdownEditingId, setBreakdownEditingId] = useState<string | null>(
    null,
  );
  const [breakdownNameInput, setBreakdownNameInput] = useState("");
  const [accountEditingId, setAccountEditingId] = useState<string | null>(null);
  const [accountNameInput, setAccountNameInput] = useState("");
  const [accountBalanceInput, setAccountBalanceInput] = useState("");
  const [activeKeyboardField, setActiveKeyboardField] =
    useState<SettingsKeyboardField>(null);
  const [numericInputTarget, setNumericInputTarget] =
    useState<NumericInputTarget | null>(null);

  const [exporting, setExporting] = useState(false);
  const [budgetInputs, setBudgetInputs] = useState<Record<string, string>>({});
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [householdMembers, setHouseholdMembers] = useState<HouseholdMember[]>(
    [],
  );
  const [householdLoading, setHouseholdLoading] = useState(false);
  const [regeneratingInviteCode, setRegeneratingInviteCode] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const currentUser = getCurrentUser();

  const settingsConnectivitySubscription = useCollection<Account>(
    buildFirestoreQueryKey(householdId, "accounts", "settings-connectivity"),
    () => (householdId ? householdCollection(householdId, "accounts") : null),
    mapAccount,
  );
  const settingsWriteAvailability = getSettingsWriteAvailability({
    settingsDataFromCache:
      !settingsConnectivitySubscription.loading &&
      settingsConnectivitySubscription.fromCache,
  });
  const isSettingsWriteDisabled = !settingsWriteAvailability.canWrite;

  useEffect(() => {
    if (isSettingsWriteDisabled && numericInputTarget !== null) {
      setNumericInputTarget(null);
    }
    if (isSettingsWriteDisabled && showEditorModal) {
      setShowEditorModal(false);
      setActiveKeyboardField(null);
      Keyboard.dismiss();
    }
  }, [isSettingsWriteDisabled, numericInputTarget, showEditorModal]);

  const showSettingsOfflineAlert = () => {
    Alert.alert(
      "オンライン接続が必要です",
      "設定変更は他メンバーの操作と競合しやすいため、オフライン中は操作できません。オンライン復帰後に更新してください。",
    );
  };

  const guardSettingsWrite = (): boolean => {
    if (!isSettingsWriteDisabled) return true;
    showSettingsOfflineAlert();
    return false;
  };

  const load = useCallback(async () => {
    const [incomeCategories, expenseCategories, loadedAccounts] =
      await Promise.all([
        getCategories("income"),
        getCategories("expense"),
        getAccounts(),
      ]);
    const allCategories = [...incomeCategories, ...expenseCategories];
    setCategories(allCategories);
    setAccounts(loadedAccounts);

    const firstCategory =
      allCategories.find((c) => c.type === activeType) ?? null;
    const nextCategoryId =
      selectedCategoryId &&
      allCategories.some((c) => c.id === selectedCategoryId)
        ? selectedCategoryId
        : (firstCategory?.id ?? null);

    setSelectedCategoryId(nextCategoryId);
    if (nextCategoryId) {
      setBreakdowns(await getBreakdownsByCategory(nextCategoryId));
    } else {
      setBreakdowns([]);
    }
  }, [activeType, selectedCategoryId]);

  const loadBudgetEditor = useCallback(async () => {
    const rows = await getMonthlyBudgets("expense");
    setBudgetInputs(buildBudgetInputMap(rows));
  }, []);

  const loadHouseholdInfo = useCallback(async () => {
    setHouseholdLoading(true);
    try {
      const nextHouseholdId = await getHouseholdId();
      setHouseholdId(nextHouseholdId);
      if (!nextHouseholdId) {
        setInviteCode(null);
        setHouseholdMembers([]);
        return;
      }

      const [nextInviteCode, nextMembers] = await Promise.all([
        getInviteCode(nextHouseholdId),
        getHouseholdMembers(nextHouseholdId),
      ]);
      setInviteCode(nextInviteCode);
      setHouseholdMembers(nextMembers);
    } catch {
      setInviteCode(null);
      setHouseholdMembers([]);
    } finally {
      setHouseholdLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
      void loadBudgetEditor();
      void loadHouseholdInfo();
    }, [load, loadBudgetEditor, loadHouseholdInfo]),
  );

  useEffect(() => {
    void loadBudgetEditor();
  }, [loadBudgetEditor]);

  const visibleCategories = useMemo(
    () => categories.filter((c) => c.type === activeType),
    [categories, activeType],
  );

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId],
  );

  const handleMoveCategory = async (
    categoryId: string,
    direction: CategoryMoveDirection,
  ) => {
    if (!guardSettingsWrite()) return;

    const movedVisibleCategories = moveCategoryInDisplayOrder(
      visibleCategories,
      categoryId,
      direction,
    );
    const movedQueue = [...movedVisibleCategories];
    const nextCategories = categories.map((category) =>
      category.type === activeType
        ? (movedQueue.shift() ?? category)
        : category,
    );

    setCategories(nextCategories);
    await updateCategoryDisplayOrders(movedVisibleCategories);
    await load();
  };

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

  const reloadBreakdowns = async (categoryId: string | null) => {
    if (!categoryId) {
      setBreakdowns([]);
      return;
    }
    setBreakdowns(await getBreakdownsByCategory(categoryId));
  };

  const handleTypeChange = (type: TransactionType) => {
    setActiveType(type);
    const first = categories.find((c) => c.type === type) ?? null;
    const nextId = first?.id ?? null;
    setSelectedCategoryId(nextId);
    void reloadBreakdowns(nextId);
    resetCategoryForm();
    resetBreakdownForm();
    resetAccountForm();
  };

  const handleSaveAccount = async () => {
    if (!guardSettingsWrite()) return;

    const trimmed = accountNameInput.trim();
    if (!trimmed) {
      Alert.alert("エラー", "口座名を入力してください");
      return;
    }

    const balance = resolveAccountBalanceInput(accountBalanceInput);
    if (balance === null) {
      Alert.alert("エラー", "残高の入力内容を確認してください");
      return;
    }

    if (accountEditingId) {
      await updateAccountName(accountEditingId, trimmed);
      await updateAccountBalance(accountEditingId, balance);
    } else {
      await addAccount(trimmed, balance);
    }

    await load();
    resetAccountForm();
    setShowEditorModal(false);
  };

  const handleEditAccount = (account: Account) => {
    if (!guardSettingsWrite()) return;

    setAccountEditingId(account.id);
    const draft = buildAccountEditorDraft(account);
    setAccountNameInput(draft.name);
    setAccountBalanceInput(draft.balance);
    setManagerTab("account");
    setShowEditorModal(true);
  };

  const handleDeleteAccount = (account: Account) => {
    if (!guardSettingsWrite()) return;

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
          onPress: async () => {
            await deleteAccountAndMoveToDefault(account.id);
            await load();
            resetAccountForm();
          },
        },
      ],
    );
  };

  const numericModalValue =
    numericInputTarget === "category-budget"
      ? categoryBudgetInput
      : numericInputTarget === "account-balance"
        ? accountBalanceInput
        : "";
  const handleNumericModalChange = (value: string) => {
    if (numericInputTarget === "category-budget") setCategoryBudgetInput(value);
    if (numericInputTarget === "account-balance") setAccountBalanceInput(value);
  };

  const handleSaveCategory = async () => {
    if (!guardSettingsWrite()) return;

    const trimmed = categoryNameInput.trim();
    if (!trimmed) {
      Alert.alert("エラー", "カテゴリ名を入力してください");
      return;
    }

    let savedCategoryId: string;
    if (categoryEditingId) {
      await updateCategory(categoryEditingId, trimmed, categoryColorInput);
      savedCategoryId = categoryEditingId;
    } else {
      savedCategoryId = await addCategory(
        trimmed,
        activeType,
        categoryColorInput,
      );
    }

    if (activeType === "expense") {
      const normalized = categoryBudgetInput.replace(/\D/g, "");
      if (!normalized) {
        await deleteMonthlyBudget(savedCategoryId);
      } else {
        const amount = parseInt(normalized, 10);
        if (!isNaN(amount) && amount >= 0) {
          await setMonthlyBudget(savedCategoryId, amount);
        }
      }
    }

    await load();
    await loadBudgetEditor();
    resetCategoryForm();
    setShowEditorModal(false);
  };

  const handleEditCategory = (cat: Category) => {
    if (!guardSettingsWrite()) return;

    setCategoryEditingId(cat.id);
    const draft = buildCategoryEditorDraft(cat);
    setCategoryNameInput(draft.name);
    setCategoryColorInput(draft.color);
    setCategoryBudgetInput(budgetInputs[cat.id] ?? "");
    setManagerTab("category");
    setShowEditorModal(true);
  };

  const handleDeleteCategory = (cat: Category) => {
    if (!guardSettingsWrite()) return;

    Alert.alert("削除確認", `「${cat.name}」を削除しますか？`, [
      { text: "キャンセル", style: "cancel" },
      {
        text: "削除",
        style: "destructive",
        onPress: () => {
          setCategories((prev) => prev.filter((item) => item.id !== cat.id));
          setBreakdowns((prev) =>
            prev.filter((item) => item.categoryId !== cat.id),
          );
          setBudgetInputs((prev) => {
            const next = { ...prev };
            delete next[cat.id];
            return next;
          });
          if (selectedCategoryId === cat.id) {
            setSelectedCategoryId(null);
          }
          void deleteCategory(cat.id)
            .then(async () => {
              await load();
              await loadBudgetEditor();
            })
            .catch(() => {
              Alert.alert("エラー", "カテゴリ削除に失敗しました");
              void load();
              void loadBudgetEditor();
            });
        },
      },
    ]);
  };

  const handleSaveBreakdown = async () => {
    if (!guardSettingsWrite()) return;

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
      await updateBreakdown(breakdownEditingId, trimmed);
    } else {
      await addBreakdown(selectedCategoryId, trimmed);
    }

    await reloadBreakdowns(selectedCategoryId);
    resetBreakdownForm();
    setShowEditorModal(false);
  };

  const handleEditBreakdown = (item: Breakdown) => {
    if (!guardSettingsWrite()) return;

    setBreakdownEditingId(item.id);
    const draft = buildBreakdownEditorDraft(item);
    setBreakdownNameInput(draft.name);
    setManagerTab("breakdown");
    setShowEditorModal(true);
  };

  const handleDeleteBreakdown = (item: Breakdown) => {
    if (!guardSettingsWrite()) return;

    Alert.alert("削除確認", `「${item.name}」を削除しますか？`, [
      { text: "キャンセル", style: "cancel" },
      {
        text: "削除",
        style: "destructive",
        onPress: () => {
          setBreakdowns((prev) => prev.filter((row) => row.id !== item.id));
          void deleteBreakdown(item.id)
            .then(() => reloadBreakdowns(selectedCategoryId))
            .catch(() => {
              Alert.alert("エラー", "内訳削除に失敗しました");
              void reloadBreakdowns(selectedCategoryId);
            });
        },
      },
    ]);
  };

  const handleResetMasterToDefault = () => {
    if (!guardSettingsWrite()) return;

    Alert.alert(
      "カテゴリ/内訳をデフォルトに戻す",
      "カテゴリと内訳のマスタを初期状態に戻します。記録済みデータは削除されず、同名カテゴリの予算とお店候補は可能な範囲で引き継がれます。独自カテゴリや独自内訳は削除されます。実行しますか？",
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "実行",
          style: "destructive",
          onPress: async () => {
            try {
              await resetCategoryAndBreakdownsToDefault();
              await load();
              resetCategoryForm();
              resetBreakdownForm();
              await loadBudgetEditor();
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
    if (!guardSettingsWrite()) return;

    resetCategoryForm();
    resetBreakdownForm();
    resetAccountForm();
    setActiveKeyboardField(null);
    setShowEditorModal(false);
    setManagerMode("category");
    setManagerTab("category");
    setShowManagerModal(true);
  };

  const handleOpenAccountManager = async () => {
    if (!guardSettingsWrite()) return;

    await reconcileAccountBalancesFromTransactions();
    await load();

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
    if (!guardSettingsWrite()) return;

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
    if (!guardSettingsWrite()) return;

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
    if (!guardSettingsWrite()) return;

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

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch {
      Alert.alert("エラー", "ログアウトに失敗しました");
    }
  };

  const executeAccountDeletion = async (confirmationInput?: string) => {
    if (!guardSettingsWrite()) return;

    if (!isAccountDeletionConfirmationValid(confirmationInput ?? "")) {
      Alert.alert(
        "確認できません",
        `「${ACCOUNT_DELETION_CONFIRMATION_TEXT}」と入力してください`,
      );
      return;
    }

    setDeletingAccount(true);
    try {
      await reauthenticateCurrentUserWithApple();
      await deleteHouseholdDataAndCurrentUserProfile();
      await deleteCurrentUserAccount();
      router.replace("/auth" as Href);
    } catch (error) {
      Alert.alert(
        "エラー",
        error instanceof Error
          ? error.message
          : "認証解除と全データ削除に失敗しました",
      );
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleDeleteAccountAndAllData = () => {
    if (!guardSettingsWrite()) return;

    if (!currentUser || !householdId) {
      Alert.alert("エラー", "ログインまたは世帯情報を確認できません");
      return;
    }

    Alert.alert(
      "認証解除と全データ削除",
      "世帯の共有データをすべて削除し、現在のアカウントを削除します。削除前に必要なデータはCSVで書き出してください。",
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "続ける",
          style: "destructive",
          onPress: () => {
            Alert.prompt(
              "確認入力",
              `実行するには「${ACCOUNT_DELETION_CONFIRMATION_TEXT}」と入力してください`,
              [
                { text: "キャンセル", style: "cancel" },
                {
                  text: "削除する",
                  style: "destructive",
                  onPress: (text?: string) => void executeAccountDeletion(text),
                },
              ],
              "plain-text",
            );
          },
        },
      ],
    );
  };

  const handleRemoveMember = (member: HouseholdMember) => {
    if (!guardSettingsWrite()) return;

    if (!householdId) return;

    const isSelf = currentUser?.uid === member.uid;
    Alert.alert(
      isSelf ? "世帯から退出" : "メンバーを解除",
      isSelf
        ? "世帯から退出します。世帯データは削除されません。実行しますか？"
        : `「${member.displayName}」を世帯から解除します。解除されたメンバーは次回アクセス時に世帯データへアクセスできなくなります。`,
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: isSelf ? "退出" : "解除",
          style: "destructive",
          onPress: async () => {
            try {
              await removeHouseholdMember(householdId, member.uid);
              if (isSelf) {
                router.replace("/household" as Href);
                return;
              }
              await loadHouseholdInfo();
            } catch {
              Alert.alert(
                "エラー",
                isSelf ? "退出に失敗しました" : "解除に失敗しました",
              );
            }
          },
        },
      ],
    );
  };

  const handleRegenerateInviteCode = () => {
    if (!guardSettingsWrite()) return;

    if (!householdId) {
      Alert.alert("エラー", "世帯情報を確認できません");
      return;
    }

    Alert.alert(
      "招待コードを再発行",
      "現在の招待コードを無効にし、新しいコードを発行します。すでに共有済みの古いコードでは参加できなくなります。",
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "再発行",
          style: "destructive",
          onPress: async () => {
            setRegeneratingInviteCode(true);
            try {
              const nextInviteCode = await regenerateInviteCode(householdId);
              setInviteCode(nextInviteCode);
              Alert.alert("完了", "招待コードを再発行しました");
            } catch (error) {
              Alert.alert(
                "エラー",
                error instanceof Error
                  ? error.message
                  : "招待コードの再発行に失敗しました",
              );
            } finally {
              setRegeneratingInviteCode(false);
            }
          },
        },
      ],
    );
  };

  const handleResetDatabase = () => {
    if (!guardSettingsWrite()) return;

    Alert.alert(
      "開発用DBリセット",
      "カテゴリ・内訳・記録データをすべて初期化します。実行しますか？",
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "リセット",
          style: "destructive",
          onPress: async () => {
            try {
              await resetFirestoreForDevelopment();
              await load();
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
          <>
            <TouchableOpacity
              style={[styles.actionButton, styles.devPreviewButton]}
              onPress={() => router.push("/dev-ui-preview" as Href)}
            >
              <Text style={styles.actionButtonText}>開発用: UIプレビュー</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.devResetButton,
                isSettingsWriteDisabled && styles.disabledControl,
              ]}
              onPress={handleResetDatabase}
              disabled={isSettingsWriteDisabled}
            >
              <Text style={styles.actionButtonText}>開発用: DBをリセット</Text>
            </TouchableOpacity>
          </>
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
        {isSettingsWriteDisabled ? (
          <Text style={[styles.offlineNoticeText, { color: colors.subText }]}>
            オフライン中は設定変更できません
          </Text>
        ) : null}
        <Text style={[styles.sectionDescription, { color: colors.subText }]}>
          カテゴリ・内訳の追加・編集・削除ができます。
        </Text>
        <TouchableOpacity
          style={[
            styles.actionButton,
            { backgroundColor: colors.tint },
            isSettingsWriteDisabled && styles.disabledControl,
          ]}
          onPress={handleOpenManager}
          disabled={isSettingsWriteDisabled}
        >
          <Text style={styles.actionButtonText}>管理画面を開く</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.actionButton,
            styles.resetDefaultButton,
            isSettingsWriteDisabled && styles.disabledControl,
          ]}
          onPress={handleResetMasterToDefault}
          disabled={isSettingsWriteDisabled}
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
        <Text style={[styles.sectionTitle, { color: colors.text }]}>世帯</Text>
        <Text style={[styles.sectionDescription, { color: colors.subText }]}>
          招待コードと世帯メンバーを確認できます。
        </Text>
        <View style={[styles.infoRow, { borderColor: colors.border }]}>
          <Text style={[styles.infoLabel, { color: colors.subText }]}>
            招待コード
          </Text>
          <Text style={[styles.infoValue, { color: colors.text }]}>
            {householdLoading ? "読み込み中..." : (inviteCode ?? "未設定")}
          </Text>
        </View>
        <TouchableOpacity
          style={[
            styles.actionButton,
            styles.inviteCodeButton,
            isSettingsWriteDisabled && styles.disabledControl,
          ]}
          onPress={handleRegenerateInviteCode}
          disabled={
            isSettingsWriteDisabled ||
            householdLoading ||
            regeneratingInviteCode ||
            !householdId
          }
        >
          <Text style={styles.actionButtonText}>
            {regeneratingInviteCode ? "再発行中..." : "招待コードを再発行"}
          </Text>
        </TouchableOpacity>
        <Text style={[styles.groupLabel, { color: colors.subText }]}>
          メンバー
        </Text>
        {householdMembers.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.subText }]}>
            メンバー情報がありません
          </Text>
        ) : (
          householdMembers.map((member) => (
            <View
              key={member.uid}
              style={[styles.memberRow, { borderColor: colors.border }]}
            >
              <View style={styles.memberInfoWrap}>
                <Text style={[styles.itemName, { color: colors.text }]}>
                  {member.displayName}
                  {member.uid === currentUser?.uid ? "（自分）" : ""}
                </Text>
                <Text
                  style={[styles.memberUidText, { color: colors.subText }]}
                  numberOfLines={1}
                >
                  {member.uid}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => handleRemoveMember(member)}
                disabled={isSettingsWriteDisabled}
              >
                <Text
                  style={[
                    styles.itemDelete,
                    isSettingsWriteDisabled && { color: colors.subText },
                  ]}
                >
                  {getMemberRemovalActionLabel(currentUser?.uid, member.uid)}
                </Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      <View
        style={[
          styles.section,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          アカウント
        </Text>
        <TouchableOpacity
          style={[styles.actionButton, styles.signOutButton]}
          onPress={handleSignOut}
        >
          <Text style={styles.actionButtonText}>ログアウト</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.actionButton,
            styles.accountDeleteButton,
            isSettingsWriteDisabled && styles.disabledControl,
          ]}
          onPress={handleDeleteAccountAndAllData}
          disabled={isSettingsWriteDisabled || deletingAccount}
        >
          <Text style={styles.actionButtonText}>
            {deletingAccount ? "削除中..." : "認証解除と全データ削除"}
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
          style={[
            styles.actionButton,
            styles.accountManagerButton,
            isSettingsWriteDisabled && styles.disabledControl,
          ]}
          onPress={handleOpenAccountManager}
          disabled={isSettingsWriteDisabled}
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
                      isSettingsWriteDisabled && styles.disabledControl,
                    ]}
                    onPress={handleOpenCategoryCreate}
                    disabled={isSettingsWriteDisabled}
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
                  {visibleCategories.map((cat, categoryIndex) => (
                    <View
                      key={cat.id}
                      style={[styles.itemRow, { borderColor: colors.border }]}
                    >
                      <View style={styles.reorderButtons}>
                        <TouchableOpacity
                          style={[
                            styles.reorderButton,
                            { borderColor: colors.border },
                            (categoryIndex === 0 ||
                              isSettingsWriteDisabled) && { opacity: 0.35 },
                          ]}
                          disabled={
                            categoryIndex === 0 || isSettingsWriteDisabled
                          }
                          onPress={() => handleMoveCategory(cat.id, "up")}
                        >
                          <Text
                            style={[
                              styles.reorderButtonText,
                              { color: colors.tint },
                            ]}
                          >
                            ↑
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.reorderButton,
                            { borderColor: colors.border },
                            (categoryIndex === visibleCategories.length - 1 ||
                              isSettingsWriteDisabled) && { opacity: 0.35 },
                          ]}
                          disabled={
                            categoryIndex === visibleCategories.length - 1 ||
                            isSettingsWriteDisabled
                          }
                          onPress={() => handleMoveCategory(cat.id, "down")}
                        >
                          <Text
                            style={[
                              styles.reorderButtonText,
                              { color: colors.tint },
                            ]}
                          >
                            ↓
                          </Text>
                        </TouchableOpacity>
                      </View>
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
                      <TouchableOpacity
                        onPress={() => handleEditCategory(cat)}
                        disabled={isSettingsWriteDisabled}
                      >
                        <Text
                          style={[
                            styles.itemAction,
                            {
                              color: isSettingsWriteDisabled
                                ? colors.subText
                                : colors.tint,
                            },
                          ]}
                        >
                          編集
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeleteCategory(cat)}
                        disabled={isSettingsWriteDisabled}
                      >
                        <Text
                          style={[
                            styles.itemDelete,
                            isSettingsWriteDisabled && {
                              color: colors.subText,
                            },
                          ]}
                        >
                          削除
                        </Text>
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
                      isSettingsWriteDisabled && styles.disabledControl,
                    ]}
                    onPress={handleOpenBreakdownCreate}
                    disabled={isSettingsWriteDisabled}
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
                          void reloadBreakdowns(cat.id);
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
                            disabled={isSettingsWriteDisabled}
                          >
                            <Text
                              style={[
                                styles.itemAction,
                                {
                                  color: isSettingsWriteDisabled
                                    ? colors.subText
                                    : colors.tint,
                                },
                              ]}
                            >
                              編集
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleDeleteBreakdown(item)}
                            disabled={isSettingsWriteDisabled}
                          >
                            <Text
                              style={[
                                styles.itemDelete,
                                isSettingsWriteDisabled && {
                                  color: colors.subText,
                                },
                              ]}
                            >
                              削除
                            </Text>
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
                      isSettingsWriteDisabled && styles.disabledControl,
                    ]}
                    onPress={handleOpenAccountCreate}
                    disabled={isSettingsWriteDisabled}
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
                        disabled={isSettingsWriteDisabled}
                      >
                        <Text
                          style={[
                            styles.itemAction,
                            {
                              color: isSettingsWriteDisabled
                                ? colors.subText
                                : colors.tint,
                            },
                          ]}
                        >
                          編集
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeleteAccount(account)}
                        disabled={account.isDefault || isSettingsWriteDisabled}
                      >
                        <Text
                          style={[
                            styles.itemDelete,
                            (account.isDefault || isSettingsWriteDisabled) && {
                              color: colors.subText,
                            },
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
                            isSettingsWriteDisabled && styles.disabledControl,
                          ]}
                          disabled={isSettingsWriteDisabled}
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
                        <TouchableOpacity
                          style={[
                            styles.textInput,
                            styles.numericInputButton,
                            { borderColor: colors.border },
                            isSettingsWriteDisabled && styles.disabledControl,
                          ]}
                          disabled={isSettingsWriteDisabled}
                          onPress={() => {
                            Keyboard.dismiss();
                            setActiveKeyboardField(null);
                            setNumericInputTarget("category-budget");
                          }}
                        >
                          <Text
                            style={[
                              styles.numericInputButtonText,
                              {
                                color: categoryBudgetInput
                                  ? colors.text
                                  : colors.subText,
                              },
                            ]}
                          >
                            {formatYenDisplay(categoryBudgetInput) ||
                              "予算なし"}
                          </Text>
                        </TouchableOpacity>
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
                    <TouchableOpacity
                      style={[
                        styles.textInput,
                        styles.numericInputButton,
                        { borderColor: colors.border },
                        isSettingsWriteDisabled && styles.disabledControl,
                      ]}
                      disabled={isSettingsWriteDisabled}
                      onPress={() => {
                        Keyboard.dismiss();
                        setActiveKeyboardField(null);
                        setNumericInputTarget("account-balance");
                      }}
                    >
                      <Text
                        style={[
                          styles.numericInputButtonText,
                          {
                            color: accountBalanceInput
                              ? colors.text
                              : colors.subText,
                          },
                        ]}
                      >
                        {formatAccountBalanceInputDisplay(
                          accountBalanceInput,
                        ) || "初期残高（例: ¥100000）"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.inlineClearButton,
                        { borderColor: colors.border },
                        isSettingsWriteDisabled && styles.disabledControl,
                      ]}
                      disabled={isSettingsWriteDisabled}
                      onPress={() => setAccountBalanceInput("0")}
                    >
                      <Text
                        style={[
                          styles.inlineClearButtonText,
                          { color: colors.subText },
                        ]}
                      >
                        残高を0にする
                      </Text>
                    </TouchableOpacity>
                    {isSettingsWriteDisabled ? (
                      <Text
                        style={[
                          styles.offlineNoticeText,
                          { color: colors.subText },
                        ]}
                      >
                        オフライン中は設定変更できません
                      </Text>
                    ) : null}
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
                        backgroundColor: isSettingsWriteDisabled
                          ? colors.border
                          : colors.tint,
                        borderColor: isSettingsWriteDisabled
                          ? colors.border
                          : colors.tint,
                      },
                    ]}
                    disabled={isSettingsWriteDisabled}
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
        <MoneyInputModal
          visible={numericInputTarget !== null}
          title={
            numericInputTarget === "account-balance" ? "初期残高" : "月次予算"
          }
          value={numericModalValue}
          placeholder={
            numericInputTarget === "account-balance" ? "¥0" : "予算なし"
          }
          colors={colors}
          allowOperators={numericInputTarget === "account-balance"}
          allowNegative={numericInputTarget === "account-balance"}
          onChange={handleNumericModalChange}
          emptyValue={numericInputTarget === "account-balance" ? 0 : null}
          onInvalidExpression={() =>
            Alert.alert("エラー", "計算式を確認してください")
          }
          onCancel={() => setNumericInputTarget(null)}
          onConfirm={() => setNumericInputTarget(null)}
          useNativeModal={false}
        />
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
  disabledControl: { opacity: 0.45 },
  devResetButton: {
    backgroundColor: "#B71C1C",
    marginTop: 10,
  },
  devPreviewButton: {
    backgroundColor: "#455A64",
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
  inviteCodeButton: {
    backgroundColor: "#00695C",
    marginBottom: 14,
  },
  signOutButton: {
    backgroundColor: "#455A64",
  },
  accountDeleteButton: {
    backgroundColor: "#B71C1C",
    marginTop: 10,
  },
  actionButtonText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  infoRow: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  infoLabel: { fontSize: 12, fontWeight: "600", marginBottom: 4 },
  infoValue: { fontSize: 18, fontWeight: "700", letterSpacing: 2 },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    gap: 8,
  },
  memberInfoWrap: { flex: 1, minWidth: 0 },
  memberUidText: { fontSize: 11, marginTop: 2 },
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
  reorderButtons: {
    flexDirection: "column",
    gap: 4,
    marginRight: 8,
  },
  reorderButton: {
    width: 28,
    height: 24,
    borderWidth: 1,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  reorderButtonText: { fontSize: 14, fontWeight: "700" },
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
  numericInputButton: {
    minHeight: 43,
    justifyContent: "center",
  },
  numericInputButtonText: { fontSize: 15 },
  inlineClearButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  inlineClearButtonText: { fontSize: 13, fontWeight: "600" },
  offlineNoticeText: { fontSize: 12, fontWeight: "600", marginTop: 8 },
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
