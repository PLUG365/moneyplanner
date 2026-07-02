import { router, useFocusEffect, type Href } from "expo-router";
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    ActionSheetIOS,
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

import { InviteQrCode } from "@/components/InviteQrCode";
import MoneyInputModal from "@/components/MoneyInputModal";
import ProgressOverlay, {
    type ProgressOverlayProgress,
} from "@/components/ProgressOverlay";
import { THEME_IDS, THEMES } from "@/constants/Themes";
import { useAppTheme } from "@/hooks/useAppTheme";
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
import { } from "@/lib/categoryOrdering";
import { exportCSV } from "@/lib/csvExport";
import { formatImportErrors, prepareCsvImport } from "@/lib/csvImport";
import { useCsvImportPurchase } from "@/hooks/useCsvImportPurchase";
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
    getAllTransactions,
    getBreakdownsByCategory,
    getCategories,
    getCategoryDeletionImpact,
    getMonthlyBudgets,
    householdCollection,
    mapAccount,
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
    approveJoinRequest,
    getHouseholdId,
    getHouseholdMembers,
    getInviteCode,
    getPendingJoinRequests,
    HouseholdJoinRequest,
    regenerateInviteCode,
    rejectJoinRequest,
    removeHouseholdMember,
    type HouseholdMember,
} from "@/lib/household";
import { waitForPendingWrite } from "@/lib/pendingWrite";
import { buildBudgetInputMap } from "@/lib/settingsBudgetEditor";
import { getMemberRemovalActionLabel } from "@/lib/settingsHouseholdMembers";
import {
    formatAccountBalanceInputDisplay,
    formatBudgetInputDisplay,
    getSettingsKeyboardAccessoryPreview,
    resolveAccountBalanceInput,
    resolveBudgetInput,
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

const WRITE_ACK_TIMEOUT_MS = 900;

const PRESET_COLORS = [
  "#6E8FB5",
  "#88A8C8",
  "#9BB8D8",
  "#6E9E94",
  "#8FAE8B",
  "#C96B7B",
  "#C2879F",
  "#C98A4B",
  "#D9B36B",
  "#9C8AC9",
  "#A88FB8",
  "#7D8A99",
  "#A09A94",
  "#A98E7E",
  "#7BA277",
];

const KEYBOARD_ACCESSORY_VIEW_ID = "settings-keyboard-accessory";

type NumericInputTarget = "category-budget" | "account-balance";

export default function SettingsScreen() {
  const { colors, themeId, setThemeId } = useAppTheme();
  const insets = useSafeAreaInsets();
  const {
    access: csvImportAccess,
    purchasing: csvImportPurchasing,
    purchase: purchaseCsvImport,
    restore: restoreCsvImport,
  } = useCsvImportPurchase();

  const sheetAnim = useRef(new Animated.Value(600)).current;

  const [categories, setCategories] = useState<Category[]>([]);
  const [breakdowns, setBreakdowns] = useState<Breakdown[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const [showManagerModal, setShowManagerModal] = useState(false);
  const [showInviteQr, setShowInviteQr] = useState(false);
  const [showEditorModal, setShowEditorModal] = useState(false);
  // 口座の残高保存は全取引を読むため時間がかかる。実行中フラグでボタンに反映する。
  const [savingAccount, setSavingAccount] = useState(false);
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
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] =
    useState<ProgressOverlayProgress | null>(null);
  // 誤操作防止のため、破壊的操作を含むセクションはデフォルトで閉じる。
  const [householdSectionExpanded, setHouseholdSectionExpanded] =
    useState(false);
  const [accountSectionExpanded, setAccountSectionExpanded] = useState(false);
  const [budgetInputs, setBudgetInputs] = useState<Record<string, string>>({});
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [householdMembers, setHouseholdMembers] = useState<HouseholdMember[]>(
    [],
  );
  const [pendingJoinRequests, setPendingJoinRequests] = useState<
    HouseholdJoinRequest[]
  >([]);
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

  const closeTransientInputs = () => {
    setActiveKeyboardField(null);
    setNumericInputTarget(null);
    Keyboard.dismiss();
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
        setPendingJoinRequests([]);
        return;
      }

      const [nextInviteCode, nextMembers, nextJoinRequests] = await Promise.all(
        [
          getInviteCode(nextHouseholdId),
          getHouseholdMembers(nextHouseholdId),
          getPendingJoinRequests(nextHouseholdId),
        ],
      );
      setInviteCode(nextInviteCode);
      setHouseholdMembers(nextMembers);
      setPendingJoinRequests(nextJoinRequests);
    } catch {
      setInviteCode(null);
      setHouseholdMembers([]);
      setPendingJoinRequests([]);
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

  const handleMoveCategoryToIndex = async (
    categoryId: string,
    toIndex: number,
  ) => {
    if (!guardSettingsWrite()) return;

    const sorted = [...visibleCategories];
    const fromIndex = sorted.findIndex((c) => c.id === categoryId);
    if (fromIndex < 0 || fromIndex === toIndex) return;

    const [moved] = sorted.splice(fromIndex, 1);
    sorted.splice(toIndex, 0, moved);

    const movedQueue = [...sorted];
    const nextCategories = categories.map((category) =>
      category.type === activeType
        ? (movedQueue.shift() ?? category)
        : category,
    );

    setCategories(nextCategories);
    await updateCategoryDisplayOrders(sorted);
    await load();
  };

  const handleOpenCategoryOrderPicker = (
    categoryId: string,
    currentIndex: number,
  ) => {
    if (isSettingsWriteDisabled) return;
    const positionOptions = visibleCategories.map((_, i) => `${i + 1}番目`);
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [...positionOptions, "キャンセル"],
        cancelButtonIndex: positionOptions.length,
        title: "並び順を選択",
      },
      (buttonIndex) => {
        if (buttonIndex === positionOptions.length) return;
        if (buttonIndex === currentIndex) return;
        void handleMoveCategoryToIndex(categoryId, buttonIndex);
      },
    );
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
      Alert.alert("エラー", "初期残高の入力内容を確認してください");
      return;
    }

    setSavingAccount(true);
    try {
      if (accountEditingId) {
        // 口座名変更は全取引のスナップショット名を書き換えるため重い。
        // 名前が変わっていない（残高だけ変更）場合はスキップする。
        if (editingAccount?.name !== trimmed) {
          await waitForPendingWrite(
            updateAccountName(accountEditingId, trimmed),
            WRITE_ACK_TIMEOUT_MS,
          );
        }
        await waitForPendingWrite(
          updateAccountBalance(accountEditingId, balance),
          WRITE_ACK_TIMEOUT_MS,
        );
      } else {
        await waitForPendingWrite(
          addAccount(trimmed, balance),
          WRITE_ACK_TIMEOUT_MS,
        );
      }
    } catch (error) {
      Alert.alert(
        "エラー",
        error instanceof Error ? error.message : "保存に失敗しました",
      );
      return;
    } finally {
      setSavingAccount(false);
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

    const initialBalanceWarning =
      account.initialBalance !== null && account.initialBalance !== 0
        ? `\n\n⚠️ 初期残高 ¥${account.initialBalance.toLocaleString()} は引き継がれません。`
        : "";

    Alert.alert(
      "口座を削除",
      `「${account.name}」の取引は既定口座へ移管されます。\n\n削除口座の現在の残高は既定口座に加算されません。移管される取引の収支のみが既定口座の残高に反映されます。${initialBalanceWarning}`,

      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "削除",
          style: "destructive",
          onPress: async () => {
            try {
              await waitForPendingWrite(
                deleteAccountAndMoveToDefault(account.id),
                WRITE_ACK_TIMEOUT_MS,
              );
              await load();
              resetAccountForm();
            } catch (error) {
              Alert.alert(
                "エラー",
                error instanceof Error
                  ? error.message
                  : "口座削除に失敗しました",
              );
            }
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

    const shouldSaveBudget =
      activeType === "expense" && categoryBudgetInput.trim().length > 0;
    const parsedBudgetAmount = shouldSaveBudget
      ? resolveBudgetInput(categoryBudgetInput)
      : null;
    if (shouldSaveBudget && parsedBudgetAmount === null) {
      Alert.alert("エラー", "予算額の入力内容を確認してください");
      return;
    }

    let savedCategoryId: string;
    try {
      if (categoryEditingId) {
        await waitForPendingWrite(
          updateCategory(categoryEditingId, trimmed, categoryColorInput),
          WRITE_ACK_TIMEOUT_MS,
        );
        savedCategoryId = categoryEditingId;
      } else {
        const result = await waitForPendingWrite(
          addCategory(trimmed, activeType, categoryColorInput),
          WRITE_ACK_TIMEOUT_MS,
        );
        savedCategoryId =
          result.status === "acknowledged" ? result.value : "unknown";
      }

      if (activeType === "expense") {
        if (!categoryBudgetInput) {
          await waitForPendingWrite(
            deleteMonthlyBudget(savedCategoryId),
            WRITE_ACK_TIMEOUT_MS,
          );
        } else if (parsedBudgetAmount !== null && parsedBudgetAmount >= 0) {
          await waitForPendingWrite(
            setMonthlyBudget(savedCategoryId, parsedBudgetAmount),
            WRITE_ACK_TIMEOUT_MS,
          );
        }
      }

      await load();
      await loadBudgetEditor();
      resetCategoryForm();
      setShowEditorModal(false);
    } catch (error) {
      Alert.alert(
        "エラー",
        error instanceof Error ? error.message : "保存に失敗しました",
      );
    }
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

  const handleDeleteCategory = async (cat: Category) => {
    if (!guardSettingsWrite()) return;

    let impactText =
      "履歴一覧のカテゴリ名表示は残りますが、カテゴリ管理・予算管理の対象から外れます。";
    try {
      const impact = await getCategoryDeletionImpact(cat.id);
      const lines: string[] = [];
      lines.push(
        "履歴一覧のカテゴリ名表示は残ります（取引スナップショット）。",
      );
      lines.push("このカテゴリはカテゴリ管理・予算管理の対象から外れます。");
      lines.push(
        "既存取引のカテゴリ連携は解除されるため、編集時は再選択が必要になる場合があります。",
      );
      lines.push(
        `過去 ${impact.transactionCount} 件の取引でカテゴリ連携が解除されます。`,
      );
      if (impact.breakdownCount > 0) {
        lines.push(`内訳 ${impact.breakdownCount} 件が削除されます。`);
      }
      if (impact.hasBudget) {
        lines.push("このカテゴリの予算設定は削除されます。");
      }
      impactText = lines.join("\n");
    } catch {
      impactText =
        "履歴一覧のカテゴリ名表示は残りますが、カテゴリ管理・予算管理の対象から外れ、既存取引とのカテゴリ連携が解除されます。";
    }

    Alert.alert(
      "削除確認",
      `「${cat.name}」を削除しますか？\n\n${impactText}`,
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "削除",
          style: "destructive",
          onPress: async () => {
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
            try {
              await waitForPendingWrite(
                deleteCategory(cat.id),
                WRITE_ACK_TIMEOUT_MS,
              );
              await load();
              await loadBudgetEditor();
            } catch (error) {
              Alert.alert(
                "エラー",
                error instanceof Error
                  ? error.message
                  : "カテゴリ削除に失敗しました",
              );
              await load();
              await loadBudgetEditor();
            }
          },
        },
      ],
    );
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

    try {
      if (breakdownEditingId) {
        await waitForPendingWrite(
          updateBreakdown(breakdownEditingId, trimmed),
          WRITE_ACK_TIMEOUT_MS,
        );
      } else {
        await waitForPendingWrite(
          addBreakdown(selectedCategoryId, trimmed),
          WRITE_ACK_TIMEOUT_MS,
        );
      }

      await reloadBreakdowns(selectedCategoryId);
      resetBreakdownForm();
      setShowEditorModal(false);
    } catch (error) {
      Alert.alert(
        "エラー",
        error instanceof Error ? error.message : "保存に失敗しました",
      );
    }
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
        onPress: async () => {
          setBreakdowns((prev) => prev.filter((row) => row.id !== item.id));
          try {
            await waitForPendingWrite(
              deleteBreakdown(item.id),
              WRITE_ACK_TIMEOUT_MS,
            );
            await reloadBreakdowns(selectedCategoryId);
          } catch (error) {
            Alert.alert(
              "エラー",
              error instanceof Error ? error.message : "内訳削除に失敗しました",
            );
            await reloadBreakdowns(selectedCategoryId);
          }
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
    closeTransientInputs();
    setShowEditorModal(false);
    setManagerMode("category");
    setManagerTab("category");
    setShowManagerModal(true);
  };

  const handleOpenAccountManager = async () => {
    if (!guardSettingsWrite()) return;

    await load();

    resetCategoryForm();
    resetBreakdownForm();
    resetAccountForm();
    closeTransientInputs();
    setShowEditorModal(false);
    setManagerMode("account");
    setManagerTab("account");
    setShowManagerModal(true);
  };

  const handleCloseManagerModal = () => {
    closeTransientInputs();
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
    closeTransientInputs();
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

  // 一覧での誤タップ防止のため、削除は編集画面内からのみ行う。
  // 既定口座は削除不可のため削除ボタン自体を出さない。
  const editingAccount = accounts.find((a) => a.id === accountEditingId);
  const editorDeleteVisible =
    managerTab === "category"
      ? categoryEditingId !== null
      : managerTab === "breakdown"
        ? breakdownEditingId !== null
        : editingAccount !== undefined &&
          !editingAccount.isDefault &&
          editingAccount.id !== DEFAULT_ACCOUNT_ID;

  const handleDeleteFromEditor = () => {
    if (managerTab === "category") {
      const target = categories.find((c) => c.id === categoryEditingId);
      if (!target) return;
      handleCloseEditorModal();
      void handleDeleteCategory(target);
      return;
    }
    if (managerTab === "breakdown") {
      const target = breakdowns.find((b) => b.id === breakdownEditingId);
      if (!target) return;
      handleCloseEditorModal();
      handleDeleteBreakdown(target);
      return;
    }
    if (!editingAccount) return;
    handleCloseEditorModal();
    handleDeleteAccount(editingAccount);
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const transactions = await getAllTransactions();
      if (transactions.length === 0) {
        Alert.alert("CSV出力", "出力対象のデータがありません");
        return;
      }

      await exportCSV(transactions);
    } catch (error) {
      if (error instanceof Error) {
        const message = error.message || "CSV出力に失敗しました";
        const normalized = message.toLowerCase();
        if (
          normalized.includes("cancel") ||
          normalized.includes("canceled") ||
          normalized.includes("cancelled") ||
          message.includes("キャンセル")
        ) {
          Alert.alert("CSV出力", "CSV共有をキャンセルしました");
        } else {
          Alert.alert("エラー", `CSV出力に失敗しました\n${message}`);
        }
      } else {
        Alert.alert("エラー", "CSV出力に失敗しました");
      }
    } finally {
      setExporting(false);
    }
  };

  const handlePurchaseCsvImport = async () => {
    const result = await purchaseCsvImport();
    if (result.outcome === "purchased") {
      Alert.alert(
        "CSV取り込み",
        "購入が完了しました。CSV取り込みが利用できます。",
      );
    } else if (result.outcome === "failed") {
      Alert.alert("エラー", `購入を完了できませんでした\n${result.message}`);
    }
    // cancelled はユーザー操作のため何も表示しない
  };

  const handleRestoreCsvImport = async () => {
    const result = await restoreCsvImport();
    if (result.outcome === "restored") {
      Alert.alert(
        "CSV取り込み",
        "購入を復元しました。CSV取り込みが利用できます。",
      );
    } else if (result.outcome === "not-found") {
      Alert.alert(
        "CSV取り込み",
        "このApple IDで復元できる購入が見つかりませんでした",
      );
    } else {
      Alert.alert("エラー", `購入の復元に失敗しました\n${result.message}`);
    }
  };

  const handleImportCSV = async () => {
    if (!csvImportAccess.allowed) {
      if (csvImportPurchasing) return;
      Alert.alert("CSV取り込み", csvImportAccess.message, [
        { text: "キャンセル", style: "cancel" },
        {
          text: "購入を復元",
          onPress: () => {
            void handleRestoreCsvImport();
          },
        },
        {
          text: `${csvImportAccess.priceLabel}で購入`,
          onPress: () => {
            void handlePurchaseCsvImport();
          },
        },
      ]);
      return;
    }

    setImporting(true);
    try {
      const prepared = await prepareCsvImport();
      if (prepared.status === "cancelled") {
        return;
      }
      if (prepared.status === "encoding-error") {
        Alert.alert("CSV取り込み", "UTF-8のCSVのみ対応しています");
        return;
      }
      if (prepared.status === "format-error") {
        Alert.alert(
          "CSV取り込み",
          `フォーマットエラーがあるため取り込みを中止しました\n\n${formatImportErrors(prepared.errors)}`,
        );
        return;
      }

      Alert.alert(
        "CSV取り込み",
        `${prepared.rowCount}件を取り込みますか？\n（口座残高は調整されません）`,
        [
          { text: "キャンセル", style: "cancel" },
          {
            text: "取り込む",
            onPress: async () => {
              setImporting(true);
              setImportProgress({ done: 0, total: prepared.rowCount });
              try {
                const count = await prepared.execute((done, total) =>
                  setImportProgress({ done, total }),
                );
                Alert.alert("CSV取り込み", `${count}件を取り込みました`);
              } catch (error) {
                const message =
                  error instanceof Error ? `\n${error.message}` : "";
                Alert.alert("エラー", `CSV取り込みに失敗しました${message}`);
              } finally {
                setImportProgress(null);
                setImporting(false);
              }
            },
          },
        ],
      );
    } catch (error) {
      const message = error instanceof Error ? `\n${error.message}` : "";
      Alert.alert("エラー", `CSV取り込みに失敗しました${message}`);
    } finally {
      setImporting(false);
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
      await waitForPendingWrite(
        deleteHouseholdDataAndCurrentUserProfile(),
        WRITE_ACK_TIMEOUT_MS,
      );
      await waitForPendingWrite(
        deleteCurrentUserAccount(),
        WRITE_ACK_TIMEOUT_MS,
      );
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

    const otherMemberCount = householdMembers.filter(
      (member) => member.uid !== currentUser.uid,
    ).length;
    const memberWarning =
      otherMemberCount > 0
        ? `この世帯には他のメンバーが ${otherMemberCount} 名います。実行すると他メンバーの家計データも消えます。`
        : "この操作は世帯データを完全に削除します。";

    Alert.alert(
      "認証解除と全データ削除",
      `${memberWarning}\n\n世帯の共有データをすべて削除し、現在のアカウントを削除します。削除前に必要なデータはCSVで書き出してください。`,
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
    const otherActiveMembers = householdMembers.filter(
      (row) => row.uid !== currentUser?.uid,
    ).length;
    Alert.alert(
      isSelf ? "世帯から退出" : "メンバーを解除",
      isSelf
        ? otherActiveMembers === 0
          ? "最後のメンバーとして退出すると、世帯データは全削除されます。実行しますか？"
          : "世帯から退出します。世帯データは削除されません。実行しますか？"
        : `「${member.displayName}」を世帯から解除します。解除されたメンバーは次回アクセス時に世帯データへアクセスできなくなります。`,
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: isSelf ? "退出" : "解除",
          style: "destructive",
          onPress: async () => {
            try {
              await waitForPendingWrite(
                removeHouseholdMember(householdId, member.uid),
                WRITE_ACK_TIMEOUT_MS,
              );
              if (isSelf) {
                router.replace("/household" as Href);
                return;
              }
              await loadHouseholdInfo();
              Alert.alert(
                "メンバーを解除しました",
                "再参加を防ぐため、必要に応じて招待コードを再発行してください。",
              );
            } catch (error) {
              Alert.alert(
                "エラー",
                error instanceof Error
                  ? error.message
                  : isSelf
                    ? "退出に失敗しました"
                    : "解除に失敗しました",
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
      "現在の招待コードを無効にし、新しいコードを発行します。すでに共有済みの古いコードでは参加できなくなります。現在のメンバーには影響しません。",
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "再発行",
          style: "destructive",
          onPress: async () => {
            setRegeneratingInviteCode(true);
            try {
              const result = await waitForPendingWrite(
                regenerateInviteCode(householdId),
                WRITE_ACK_TIMEOUT_MS,
              );
              const nextInviteCode =
                result.status === "acknowledged" ? result.value : null;
              if (nextInviteCode) {
                setInviteCode(nextInviteCode);
                Alert.alert("完了", "招待コードを再発行しました");
              } else {
                Alert.alert(
                  "エラー",
                  "招待コードの再発行に失敗しました（同期待ち）",
                );
              }
            } catch (error) {
              try {
                const currentCode = await getInviteCode(householdId);
                if (currentCode) {
                  setInviteCode(currentCode);
                }
              } catch {}
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

  const handleApproveJoinRequest = async (request: HouseholdJoinRequest) => {
    if (!guardSettingsWrite()) return;
    if (!householdId) {
      Alert.alert("エラー", "世帯情報を確認できません");
      return;
    }

    Alert.alert(
      "参加リクエスト承認",
      `「${request.displayName}」を世帯へ参加させますか？`,
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "承認",
          onPress: async () => {
            try {
              await waitForPendingWrite(
                approveJoinRequest(householdId, request.uid),
                WRITE_ACK_TIMEOUT_MS,
              );
              await loadHouseholdInfo();
              Alert.alert("完了", "参加リクエストを承認しました");
            } catch (error) {
              Alert.alert(
                "エラー",
                error instanceof Error ? error.message : "承認に失敗しました",
              );
            }
          },
        },
      ],
    );
  };

  const handleRejectJoinRequest = async (request: HouseholdJoinRequest) => {
    if (!guardSettingsWrite()) return;
    if (!householdId) {
      Alert.alert("エラー", "世帯情報を確認できません");
      return;
    }

    Alert.alert(
      "参加リクエスト却下",
      `「${request.displayName}」の参加リクエストを却下しますか？`,
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "却下",
          style: "destructive",
          onPress: async () => {
            try {
              await waitForPendingWrite(
                rejectJoinRequest(householdId, request.uid),
                WRITE_ACK_TIMEOUT_MS,
              );
              await loadHouseholdInfo();
              Alert.alert("完了", "参加リクエストを却下しました");
            } catch (error) {
              Alert.alert(
                "エラー",
                error instanceof Error ? error.message : "却下に失敗しました",
              );
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

  const incomeColor = colors.income;
  const expenseColor = colors.expense;

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
        <TouchableOpacity
          style={[
            styles.actionButton,
            styles.importButton,
            { backgroundColor: colors.tint },
            isSettingsWriteDisabled && styles.disabledControl,
          ]}
          onPress={handleImportCSV}
          disabled={importing || isSettingsWriteDisabled}
        >
          <Text style={styles.actionButtonText}>
            {importing ? "取り込み中..." : "CSVを取り込む"}
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

      <View
        style={[
          styles.section,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          配色テーマ
        </Text>
        <Text style={[styles.sectionDescription, { color: colors.subText }]}>
          アプリ全体の配色を選べます。この端末にのみ保存されます。
        </Text>
        <View style={styles.themeGrid}>
          {THEME_IDS.map((id) => {
            const theme = THEMES[id];
            const selected = id === themeId;
            return (
              <TouchableOpacity
                key={id}
                style={[
                  styles.themeOption,
                  {
                    backgroundColor: theme.background,
                    borderColor: selected ? colors.tint : colors.border,
                    borderWidth: selected ? 2 : 1,
                  },
                ]}
                onPress={() => setThemeId(id)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <View style={styles.themeSwatchRow}>
                  <View
                    style={[
                      styles.themeSwatch,
                      {
                        backgroundColor: theme.card,
                        borderColor: theme.border,
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.themeSwatch,
                      { backgroundColor: theme.tint },
                    ]}
                  />
                  <View
                    style={[
                      styles.themeSwatch,
                      { backgroundColor: theme.income },
                    ]}
                  />
                  <View
                    style={[
                      styles.themeSwatch,
                      { backgroundColor: theme.expense },
                    ]}
                  />
                </View>
                <Text style={[styles.themeLabel, { color: theme.text }]}>
                  {theme.label}
                </Text>
                {selected ? (
                  <Text
                    style={[styles.themeSelectedMark, { color: theme.tint }]}
                  >
                    ✓ 使用中
                  </Text>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View
        style={[
          styles.section,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <TouchableOpacity
          style={styles.collapsibleHeader}
          onPress={() => setHouseholdSectionExpanded((value) => !value)}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.sectionTitle,
              styles.collapsibleTitle,
              { color: colors.text },
            ]}
          >
            世帯
          </Text>
          <Text style={[styles.collapsibleChevron, { color: colors.subText }]}>
            {householdSectionExpanded ? "▲ 閉じる" : "▼ 開く"}
          </Text>
        </TouchableOpacity>
        {householdSectionExpanded ? (
          <View style={styles.collapsibleBody}>
            <Text
              style={[styles.sectionDescription, { color: colors.subText }]}
            >
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
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.inviteCodeButton,
                !inviteCode && styles.disabledControl,
              ]}
              onPress={() => setShowInviteQr(true)}
              disabled={!inviteCode || householdLoading}
            >
              <Text style={styles.actionButtonText}>
                招待コードをQRで表示
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
              householdMembers.map((member) => {
                const isSelf = member.uid === currentUser?.uid;
                return (
                  <View
                    key={member.uid}
                    style={[
                      styles.memberRow,
                      {
                        borderColor: isSelf ? colors.tint : colors.border,
                        backgroundColor: isSelf
                          ? colors.tint + "12"
                          : colors.background,
                      },
                    ]}
                  >
                    <View style={styles.memberInfoWrap}>
                      <View style={styles.memberNameRow}>
                        <Text style={[styles.itemName, { color: colors.text }]}>
                          {member.displayName}
                        </Text>
                        {isSelf ? (
                          <Text
                            style={[
                              styles.selfBadge,
                              {
                                color: colors.tint,
                                borderColor: colors.tint,
                              },
                            ]}
                          >
                            自分
                          </Text>
                        ) : null}
                      </View>
                      <Text
                        style={[
                          styles.memberUidText,
                          { color: colors.subText },
                        ]}
                        numberOfLines={1}
                      >
                        {member.uid}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.memberActionButton,
                        {
                          borderColor: isSelf ? "#C98A4B" : "#C25E6E",
                          backgroundColor: isSelf ? "#F9F0E4" : "#F9E9EC",
                        },
                        isSettingsWriteDisabled && styles.disabledControl,
                      ]}
                      onPress={() => handleRemoveMember(member)}
                      disabled={isSettingsWriteDisabled}
                    >
                      <Text
                        style={[
                          styles.memberActionText,
                          { color: isSelf ? "#B36A00" : "#B71C1C" },
                          isSettingsWriteDisabled && { color: colors.subText },
                        ]}
                      >
                        {getMemberRemovalActionLabel(
                          currentUser?.uid,
                          member.uid,
                        )}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}

            <Text style={[styles.groupLabel, { color: colors.subText }]}>
              参加リクエスト
            </Text>
            {pendingJoinRequests.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.subText }]}>
                承認待ちの参加リクエストはありません
              </Text>
            ) : (
              pendingJoinRequests.map((request) => (
                <View
                  key={request.uid}
                  style={[styles.requestRow, { borderColor: colors.border }]}
                >
                  <View style={styles.memberInfoWrap}>
                    <Text style={[styles.itemName, { color: colors.text }]}>
                      {request.displayName}
                    </Text>
                    <Text
                      style={[styles.memberUidText, { color: colors.subText }]}
                      numberOfLines={1}
                    >
                      {request.uid}
                    </Text>
                  </View>
                  <View style={styles.requestActions}>
                    <TouchableOpacity
                      style={[
                        styles.requestButton,
                        styles.requestApproveButton,
                        isSettingsWriteDisabled && styles.disabledControl,
                      ]}
                      onPress={() => handleApproveJoinRequest(request)}
                      disabled={isSettingsWriteDisabled}
                    >
                      <Text style={styles.requestApproveText}>承認</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.requestButton,
                        styles.requestRejectButton,
                        isSettingsWriteDisabled && styles.disabledControl,
                      ]}
                      onPress={() => handleRejectJoinRequest(request)}
                      disabled={isSettingsWriteDisabled}
                    >
                      <Text style={styles.requestRejectText}>却下</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        ) : null}
      </View>

      <View
        style={[
          styles.section,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <TouchableOpacity
          style={styles.collapsibleHeader}
          onPress={() => setAccountSectionExpanded((value) => !value)}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.sectionTitle,
              styles.collapsibleTitle,
              { color: colors.text },
            ]}
          >
            アカウント
          </Text>
          <Text style={[styles.collapsibleChevron, { color: colors.subText }]}>
            {accountSectionExpanded ? "▲ 閉じる" : "▼ 開く"}
          </Text>
        </TouchableOpacity>
        {accountSectionExpanded ? (
          <View style={styles.collapsibleBody}>
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
        ) : null}
      </View>

      {__DEV__ && (
        <View
          style={[
            styles.section,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            開発用
          </Text>
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
        </View>
      )}

      <Modal visible={showInviteQr} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.inviteQrCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.inviteQrTitle, { color: colors.text }]}>
              招待コード
            </Text>
            {inviteCode ? (
              <View style={styles.inviteQrCodeWrap}>
                <InviteQrCode value={inviteCode} size={220} />
              </View>
            ) : null}
            <Text style={[styles.inviteQrCodeText, { color: colors.tint }]}>
              {inviteCode ?? ""}
            </Text>
            <Text style={[styles.inviteQrNote, { color: colors.subText }]}>
              参加する家族の端末で、世帯参加画面の「QRコードを読み取る」から読み取れます
            </Text>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.tint }]}
              onPress={() => setShowInviteQr(false)}
            >
              <Text style={styles.actionButtonText}>閉じる</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
                      <TouchableOpacity
                        style={[
                          styles.orderBadge,
                          { borderColor: colors.border },
                          isSettingsWriteDisabled && { opacity: 0.35 },
                        ]}
                        disabled={isSettingsWriteDisabled}
                        onPress={() =>
                          handleOpenCategoryOrderPicker(cat.id, categoryIndex)
                        }
                      >
                        <Text
                          style={[
                            styles.orderBadgeText,
                            { color: colors.tint },
                          ]}
                        >
                          {categoryIndex + 1}
                        </Text>
                      </TouchableOpacity>
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
                            ? `予算 ¥${parseInt(budgetInputs[cat.id], 10).toLocaleString("ja-JP")}`
                            : "予算なし"}
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
                            {formatBudgetInputDisplay(categoryBudgetInput) ||
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
                        初期残高を0にする
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
                    disabled={isSettingsWriteDisabled || savingAccount}
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
                {editorDeleteVisible ? (
                  <TouchableOpacity
                    style={[
                      styles.editorDeleteButton,
                      isSettingsWriteDisabled && styles.disabledControl,
                    ]}
                    disabled={isSettingsWriteDisabled}
                    onPress={handleDeleteFromEditor}
                  >
                    <Text style={styles.editorDeleteButtonText}>
                      {managerTab === "category"
                        ? "このカテゴリを削除"
                        : managerTab === "breakdown"
                          ? "この内訳を削除"
                          : "この口座を削除"}
                    </Text>
                  </TouchableOpacity>
                ) : null}
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
          allowOperators
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

      <ProgressOverlay
        visible={importProgress !== null || savingAccount}
        message={importProgress !== null ? "CSVを取り込んでいます…" : "保存中…"}
        progress={importProgress}
      />
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
  collapsibleHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  collapsibleTitle: { marginBottom: 0 },
  collapsibleChevron: { fontSize: 12, fontWeight: "600" },
  collapsibleBody: { marginTop: 12 },
  sectionDescription: { fontSize: 13, marginBottom: 12, lineHeight: 20 },
  themeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  themeOption: {
    flexBasis: "47%",
    flexGrow: 1,
    borderRadius: 12,
    padding: 12,
  },
  themeSwatchRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 8,
  },
  themeSwatch: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "transparent",
  },
  themeLabel: { fontSize: 14, fontWeight: "700" },
  themeSelectedMark: { fontSize: 12, fontWeight: "700", marginTop: 4 },
  actionButton: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  disabledControl: { opacity: 0.45 },
  importButton: {
    marginTop: 10,
  },
  devResetButton: {
    backgroundColor: "#B71C1C",
    marginTop: 10,
  },
  devPreviewButton: {
    backgroundColor: "#455A64",
    marginTop: 10,
  },
  resetDefaultButton: {
    backgroundColor: "#C98A4B",
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
  memberNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  memberInfoWrap: { flex: 1, minWidth: 0 },
  memberUidText: { fontSize: 11, marginTop: 2 },
  selfBadge: {
    fontSize: 11,
    fontWeight: "700",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  memberActionButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  memberActionText: { fontSize: 13, fontWeight: "700" },
  requestRow: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  requestActions: {
    flexDirection: "row",
    gap: 8,
  },
  requestButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  requestApproveButton: {
    borderColor: "#7BA277",
    backgroundColor: "#EEF4ED",
  },
  requestRejectButton: {
    borderColor: "#C25E6E",
    backgroundColor: "#F9E9EC",
  },
  requestApproveText: { color: "#5C7F58", fontSize: 13, fontWeight: "700" },
  requestRejectText: { color: "#A84A5A", fontSize: 13, fontWeight: "700" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  inviteQrCard: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
    alignItems: "center",
  },
  inviteQrTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 16,
  },
  inviteQrCodeWrap: {
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 12,
  },
  inviteQrCodeText: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 3,
    marginBottom: 12,
  },
  inviteQrNote: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginBottom: 16,
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
  orderBadge: {
    width: 30,
    height: 30,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  orderBadgeText: { fontSize: 14, fontWeight: "700" },
  categoryDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  itemName: { flex: 1, fontSize: 15 },
  itemAction: { fontSize: 13, fontWeight: "600", marginRight: 10 },
  editorDeleteButton: {
    marginTop: 28,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#C25E6E",
    paddingVertical: 12,
    alignItems: "center",
  },
  editorDeleteButtonText: {
    color: "#C62828",
    fontSize: 14,
    fontWeight: "600",
  },
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
