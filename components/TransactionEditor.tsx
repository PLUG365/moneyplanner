import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useMemo, useState } from "react";
import {
    Alert,
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

import MoneyInputModal from "@/components/MoneyInputModal";
import {
    getStoresByCategory,
    TransactionType,
    upsertStore,
} from "@/lib/firestore";
import { formatTransactionAmountInputDisplay } from "@/lib/transactionAmountInput";
import {
    buildCategoryDisplayName,
    getBreakdownChoicesForCategory,
    getCategoryModalNextStep,
} from "@/lib/transactionEditorPresentation";

type EditorId = string | number;

type Account = {
  id: EditorId;
  name: string;
  balance: number;
};

type Category = {
  id: EditorId;
  name: string;
  color: string;
};

type Breakdown = {
  id: EditorId;
  categoryId: EditorId;
  name: string;
};

type Store = {
  id: EditorId;
  name: string;
};

type CategoryModalStep = "category" | "breakdown";

const ACCOUNT_PICKER_PRELOAD_TIMEOUT_MS = 900;

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
  accounts: Account[];
  accountId: EditorId | null;
  categoryId: EditorId | null;
  breakdowns: Breakdown[];
  breakdownId: EditorId | null;
  storeId: EditorId | null;
  storeName: string;
  memo: string;
  incomeColor: string;
  expenseColor: string;
  bottomInset?: number;
  amountInputUseNativeModal?: boolean;
  onAccountPickerOpen?: () => void | Promise<unknown>;
  submitLabel: string;
  onTypeChange: (type: TransactionType) => void;
  onAmountRawChange: (amountRaw: string) => void;
  onDateChange: (date: string) => void;
  onAccountChange: (accountId: any) => void;
  onCategoryChange: (categoryId: any) => void;
  onBreakdownChange: (breakdownId: any) => void;
  onStoreChange: (storeId: any, storeName: string) => void;
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

async function waitForOptionalPreload(
  preload?: () => void | Promise<unknown>,
): Promise<void> {
  if (!preload) return;

  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    await Promise.race([
      Promise.resolve(preload()).catch(() => undefined),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, ACCOUNT_PICKER_PRELOAD_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export default function TransactionEditor({
  colors,
  type,
  amountRaw,
  date,
  categories,
  accounts,
  accountId,
  categoryId,
  breakdowns,
  breakdownId,
  storeId,
  storeName,
  memo,
  incomeColor,
  expenseColor,
  bottomInset = 0,
  amountInputUseNativeModal = true,
  onAccountPickerOpen,
  submitLabel,
  onTypeChange,
  onAmountRawChange,
  onDateChange,
  onAccountChange,
  onCategoryChange,
  onBreakdownChange,
  onStoreChange,
  onMemoChange,
  onSubmit,
}: Props) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showAmountModal, setShowAmountModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showStoreModal, setShowStoreModal] = useState(false);
  const [storeSearchQuery, setStoreSearchQuery] = useState("");
  const [categoryStores, setCategoryStores] = useState<Store[]>([]);
  const [categoryModalStep, setCategoryModalStep] =
    useState<CategoryModalStep>("category");
  const [modalBreakdownCategory, setModalBreakdownCategory] =
    useState<Category | null>(null);
  const [modalBreakdownChoices, setModalBreakdownChoices] = useState<
    Breakdown[]
  >([]);
  const [categorySelectionLoadingId, setCategorySelectionLoadingId] =
    useState<EditorId | null>(null);
  const [pendingBreakdown, setPendingBreakdown] = useState<Breakdown | null>(
    null,
  );
  const [isMemoFocused, setIsMemoFocused] = useState(false);
  const keyboardAccessoryViewId = "transaction-editor-keyboard-accessory";

  const activeColor = type === "income" ? incomeColor : expenseColor;
  const amountDisplay = formatTransactionAmountInputDisplay(amountRaw);
  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === categoryId) ?? null,
    [categories, categoryId],
  );
  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === accountId) ?? null,
    [accounts, accountId],
  );
  const selectedBreakdown = useMemo(
    () =>
      breakdowns.find((b) => b.id === breakdownId) ??
      (pendingBreakdown?.id === breakdownId ? pendingBreakdown : null),
    [breakdowns, breakdownId, pendingBreakdown],
  );
  const currentCategoryBreakdowns = useMemo(
    () => getBreakdownChoicesForCategory(categoryId, breakdowns),
    [breakdowns, categoryId],
  );
  const categoryDisplayName = buildCategoryDisplayName({
    categoryName: selectedCategory?.name,
    breakdownName: selectedBreakdown?.name,
  });
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

  const openStorePicker = async () => {
    setCategoryStores(
      await getStoresByCategory(
        typeof categoryId === "string" ? categoryId : null,
      ),
    );
    setStoreSearchQuery("");
    setShowStoreModal(true);
  };

  const openAccountPicker = async () => {
    await waitForOptionalPreload(onAccountPickerOpen);
    setShowAccountModal(true);
  };

  const openCategoryPicker = () => {
    setCategoryModalStep("category");
    setModalBreakdownCategory(selectedCategory);
    setModalBreakdownChoices(currentCategoryBreakdowns);
    setCategorySelectionLoadingId(null);
    setShowCategoryModal(true);
  };

  const closeCategoryPicker = () => {
    setShowCategoryModal(false);
    setCategoryModalStep("category");
    setCategorySelectionLoadingId(null);
  };

  const handleCategorySelect = async (cat: Category) => {
    setCategorySelectionLoadingId(cat.id);
    try {
      const nextBreakdowns = getBreakdownChoicesForCategory(cat.id, breakdowns);
      onCategoryChange(cat.id);
      onBreakdownChange(null);
      setPendingBreakdown(null);
      setModalBreakdownCategory(cat);
      setModalBreakdownChoices(nextBreakdowns);

      if (getCategoryModalNextStep(nextBreakdowns.length) === "close") {
        closeCategoryPicker();
        return;
      }

      setCategoryModalStep("breakdown");
    } finally {
      setCategorySelectionLoadingId(null);
    }
  };

  const handleBreakdownSelect = (item: Breakdown) => {
    setPendingBreakdown(item);
    onBreakdownChange(item.id);
    closeCategoryPicker();
  };

  return (
    <>
      <View style={styles.container}>
        <View
          style={[
            styles.fixedTop,
            {
              borderBottomColor: colors.border,
              backgroundColor: colors.background,
            },
          ]}
        >
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
            <View style={styles.amountRow}>
              <Text style={[styles.yen, { color: activeColor }]}>¥</Text>
              <TouchableOpacity
                style={styles.amountInputButton}
                onPress={() => {
                  Keyboard.dismiss();
                  setShowAmountModal(true);
                }}
              >
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.5}
                  style={[
                    styles.amountInputText,
                    { color: amountRaw ? activeColor : colors.border },
                  ]}
                >
                  {amountDisplay.replace(/^¥/, "") || "0"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <TextInput
            style={[
              styles.memoInput,
              { color: colors.text, borderColor: colors.border },
            ]}
            value={memo}
            onChangeText={onMemoChange}
            onFocus={() => setIsMemoFocused(true)}
            onBlur={() => setIsMemoFocused(false)}
            placeholder="メモを入力（任意）"
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
          {Platform.OS === "ios" && isMemoFocused ? (
            <TouchableOpacity
              style={[styles.memoDoneButton, { borderColor: colors.border }]}
              onPress={Keyboard.dismiss}
            >
              <Text style={[styles.memoDoneButtonText, { color: colors.tint }]}>
                メモ入力を完了
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={[styles.dateText, { color: colors.text }]}>
              {displayDate(date)}
            </Text>
          </TouchableOpacity>

          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.selectorButton,
                { borderColor: selectedAccount ? colors.tint : colors.border },
              ]}
              onPress={() => {
                void openAccountPicker();
              }}
            >
              <Text
                style={[
                  styles.selectorValue,
                  { color: selectedAccount ? colors.text : colors.subText },
                ]}
              >
                {selectedAccount?.name ?? "口座を選択"}
              </Text>
              <Text style={[styles.selectorAction, { color: colors.tint }]}>
                選択
              </Text>
            </TouchableOpacity>
          </View>

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
                      <Text
                        style={[styles.datePickerDone, { color: colors.tint }]}
                      >
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
            <TouchableOpacity
              style={[
                styles.selectorButton,
                { borderColor: selectedCategory?.color || colors.border },
              ]}
              onPress={openCategoryPicker}
            >
              <Text
                style={[
                  styles.selectorValue,
                  { color: selectedCategory?.color || colors.text },
                ]}
              >
                {categoryDisplayName}
              </Text>
              <Text style={[styles.selectorAction, { color: colors.tint }]}>
                選択
              </Text>
            </TouchableOpacity>
          </View>

          {type === "expense" && (
            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.selectorButton,
                  { borderColor: storeName ? colors.tint : colors.border },
                ]}
                onPress={openStorePicker}
              >
                <Text
                  style={[
                    styles.selectorValue,
                    { color: storeName ? colors.text : colors.subText },
                  ]}
                >
                  {storeName || "お店を選択"}
                </Text>
                {storeName ? (
                  <TouchableOpacity
                    style={styles.storeClearButton}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    onPress={() => onStoreChange(null, "")}
                  >
                    <Text
                      style={[styles.selectorAction, { color: colors.subText }]}
                    >
                      ✕
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={[styles.selectorAction, { color: colors.tint }]}>
                    選択
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        <View
          style={[
            styles.fixedBottom,
            {
              borderTopColor: colors.border,
              backgroundColor: colors.background,
              paddingBottom: 16 + bottomInset,
            },
          ]}
        >
          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: activeColor }]}
            onPress={onSubmit}
          >
            <Text style={styles.submitButtonText}>{submitLabel}</Text>
          </TouchableOpacity>
        </View>

        <MoneyInputModal
          visible={showAmountModal}
          title="金額"
          value={amountRaw}
          placeholder="¥0"
          colors={colors}
          allowOperators
          onChange={onAmountRawChange}
          onInvalidExpression={() =>
            Alert.alert("エラー", "計算式を確認してください")
          }
          onCancel={() => setShowAmountModal(false)}
          onConfirm={() => setShowAmountModal(false)}
          useNativeModal={amountInputUseNativeModal}
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
              {categoryModalStep === "breakdown"
                ? "内訳を選択"
                : "カテゴリを選択"}
            </Text>
            <TouchableOpacity onPress={closeCategoryPicker}>
              <Text style={[styles.fullModalClose, { color: colors.tint }]}>
                閉じる
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.fullModalContent}>
            {categoryModalStep === "category" ? (
              categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  disabled={categorySelectionLoadingId !== null}
                  style={[
                    styles.fullCategoryRow,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.card,
                    },
                    categoryId === cat.id && {
                      borderColor: cat.color,
                      borderWidth: 2,
                    },
                  ]}
                  onPress={() => {
                    void handleCategorySelect(cat);
                  }}
                >
                  <View
                    style={[
                      styles.fullCategoryDot,
                      { backgroundColor: cat.color },
                    ]}
                  />
                  <Text
                    style={[styles.fullCategoryName, { color: colors.text }]}
                  >
                    {cat.name}
                  </Text>
                  {categorySelectionLoadingId === cat.id ? (
                    <Text
                      style={[
                        styles.fullCategorySelected,
                        { color: colors.subText },
                      ]}
                    >
                      確認中...
                    </Text>
                  ) : categoryId === cat.id ? (
                    <Text
                      style={[
                        styles.fullCategorySelected,
                        { color: cat.color },
                      ]}
                    >
                      選択中
                    </Text>
                  ) : null}
                </TouchableOpacity>
              ))
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.modalBackRow, { borderColor: colors.border }]}
                  onPress={() => setCategoryModalStep("category")}
                >
                  <Text style={[styles.modalBackText, { color: colors.tint }]}>
                    カテゴリを選び直す
                  </Text>
                </TouchableOpacity>
                <Text
                  style={[
                    styles.breakdownModalTitle,
                    { color: colors.subText },
                  ]}
                >
                  {modalBreakdownCategory?.name}
                </Text>
                {modalBreakdownChoices.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.fullCategoryRow,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.card,
                      },
                      breakdownId === item.id && {
                        borderColor:
                          modalBreakdownCategory?.color ?? colors.tint,
                        borderWidth: 2,
                      },
                    ]}
                    onPress={() => handleBreakdownSelect(item)}
                  >
                    <Text
                      style={[styles.fullCategoryName, { color: colors.text }]}
                    >
                      {item.name}
                    </Text>
                    {breakdownId === item.id ? (
                      <Text
                        style={[
                          styles.fullCategorySelected,
                          {
                            color: modalBreakdownCategory?.color ?? colors.tint,
                          },
                        ]}
                      >
                        選択中
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                ))}
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={showAccountModal} animationType="slide">
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
              口座を選択
            </Text>
            <TouchableOpacity onPress={() => setShowAccountModal(false)}>
              <Text style={[styles.fullModalClose, { color: colors.tint }]}>
                閉じる
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.fullModalContent}>
            {accounts.map((account) => (
              <TouchableOpacity
                key={account.id}
                style={[
                  styles.fullCategoryRow,
                  { borderColor: colors.border, backgroundColor: colors.card },
                  accountId === account.id && {
                    borderColor: colors.tint,
                    borderWidth: 2,
                  },
                ]}
                onPress={() => {
                  onAccountChange(account.id);
                  setShowAccountModal(false);
                }}
              >
                <Text style={[styles.fullCategoryName, { color: colors.text }]}>
                  {account.name}
                </Text>
                <Text
                  style={[
                    styles.fullCategorySelected,
                    { color: colors.subText },
                  ]}
                >
                  ¥{account.balance.toLocaleString("ja-JP")}
                </Text>
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
              {
                borderBottomColor: colors.border,
                backgroundColor: colors.card,
              },
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
                onPress={async () => {
                  const name = storeSearchQuery.trim();
                  const sid = await upsertStore(
                    name,
                    typeof categoryId === "string" ? categoryId : null,
                  );
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
              <Text style={[styles.storeEmptyText, { color: colors.subText }]}>
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
  container: { flex: 1, position: "relative" },
  fixedTop: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  scrollArea: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
  },
  fixedBottom: {
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
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
  amountInputButton: { flex: 1, minHeight: 44, justifyContent: "center" },
  amountInputText: { fontSize: 36, fontWeight: "700" },
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
  storeClearButton: {
    minWidth: 28,
    minHeight: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  memoInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 15,
    minHeight: 44,
    marginTop: 8,
  },
  memoDoneButton: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
  },
  memoDoneButtonText: { fontSize: 13, fontWeight: "700" },
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
  modalBackRow: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalBackText: { fontSize: 15, fontWeight: "700" },
  breakdownModalSection: { marginTop: 14, gap: 10 },
  breakdownModalTitle: { fontSize: 13, fontWeight: "700" },
  breakdownModalEmpty: {
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 8,
  },
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
