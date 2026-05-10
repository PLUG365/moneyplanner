import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import React from "react";
import {
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

import {
    buildHistorySearchConditionSummary,
    type HistorySearchType,
} from "@/lib/historySearch";

export type HistorySearchDateTarget = "from" | "to";

type HistorySearchPanelColors = {
  text: string;
  subText: string;
  card: string;
  border: string;
  tint: string;
};

type HistorySearchPanelProps = {
  colors: HistorySearchPanelColors;
  type: HistorySearchType;
  categoryName: string;
  breakdownName: string;
  storeName: string;
  memoQuery: string;
  fromDate: string | null;
  toDate: string | null;
  datePickerTarget: HistorySearchDateTarget | null;
  categoryOptions: string[];
  breakdownOptions: string[];
  storeOptions: string[];
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onTypeChange: (type: HistorySearchType) => void;
  onCategoryNameChange: (name: string) => void;
  onBreakdownNameChange: (name: string) => void;
  onStoreNameChange: (name: string) => void;
  onMemoQueryChange: (query: string) => void;
  onFromDateChange: (date: string | null) => void;
  onToDateChange: (date: string | null) => void;
  onDatePickerTargetChange: (target: HistorySearchDateTarget | null) => void;
  onClearConditions: () => void;
};

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

export default function HistorySearchPanel({
  colors,
  type,
  categoryName,
  breakdownName,
  storeName,
  memoQuery,
  fromDate,
  toDate,
  datePickerTarget,
  categoryOptions,
  breakdownOptions,
  storeOptions,
  expanded,
  onExpandedChange,
  onTypeChange,
  onCategoryNameChange,
  onBreakdownNameChange,
  onStoreNameChange,
  onMemoQueryChange,
  onFromDateChange,
  onToDateChange,
  onDatePickerTargetChange,
  onClearConditions,
}: HistorySearchPanelProps) {
  const summary = buildHistorySearchConditionSummary({
    type,
    categoryName,
    breakdownName,
    storeName,
    memoQuery,
    fromDate,
    toDate,
  });
  const hasConditions = summary.count > 0;

  const getDatePickerValue = (target: HistorySearchDateTarget): Date =>
    toLocalDate(
      target === "from"
        ? (fromDate ?? formatDate(new Date()))
        : (toDate ?? formatDate(new Date())),
    );

  return (
    <View
      style={[
        styles.searchPanel,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.searchSummaryHeaderOuter}>
        <TouchableOpacity
          style={styles.searchSummaryHeader}
          onPress={() => onExpandedChange(!expanded)}
        >
          <View style={styles.searchSummaryTextWrap}>
            <View style={styles.searchSummaryTitleRow}>
              <Text style={[styles.searchSummaryTitle, { color: colors.text }]}>
                検索条件
              </Text>
              {hasConditions ? (
                <View
                  style={[
                    styles.conditionBadge,
                    { backgroundColor: colors.tint },
                  ]}
                >
                  <Text style={styles.conditionBadgeText}>{summary.count}</Text>
                </View>
              ) : null}
            </View>
            <Text
              numberOfLines={1}
              style={[
                styles.searchSummaryLabel,
                { color: hasConditions ? colors.text : colors.subText },
              ]}
            >
              {summary.label}
            </Text>
          </View>
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={18}
            color={colors.tint}
          />
        </TouchableOpacity>
        {hasConditions ? (
          <TouchableOpacity
            style={[
              styles.searchClearIconButton,
              { borderColor: colors.border },
            ]}
            onPress={onClearConditions}
            accessibilityLabel="検索条件をクリア"
          >
            <Ionicons name="close-circle" size={16} color={colors.subText} />
            <Text
              style={[styles.searchClearIconLabel, { color: colors.subText }]}
            >
              クリア
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {!expanded ? null : (
        <>
          <Text style={[styles.searchLabel, { color: colors.subText }]}>
            種別
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={[styles.searchChipRow, { marginBottom: 2 }]}>
              {(
                [
                  ["all", "指定なし"],
                  ["expense", "支出"],
                  ["income", "収入"],
                ] as const
              ).map(([value, label]) => (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.searchChip,
                    {
                      borderColor: type === value ? colors.tint : colors.border,
                      backgroundColor:
                        type === value ? colors.tint : "transparent",
                    },
                  ]}
                  onPress={() => onTypeChange(value)}
                >
                  <Text
                    style={[
                      styles.searchChipText,
                      { color: type === value ? "#fff" : colors.subText },
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {type === "all" ? null : (
            <>
              <Text style={[styles.searchLabel, { color: colors.subText }]}>
                カテゴリ
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.searchChipRow}>
                  <TouchableOpacity
                    style={[
                      styles.searchChip,
                      { borderColor: colors.border },
                      !categoryName && { backgroundColor: colors.tint },
                    ]}
                    onPress={() => {
                      onCategoryNameChange("");
                      onBreakdownNameChange("");
                      onStoreNameChange("");
                    }}
                  >
                    <Text
                      style={[
                        styles.searchChipText,
                        { color: categoryName ? colors.text : "#fff" },
                      ]}
                    >
                      指定なし
                    </Text>
                  </TouchableOpacity>
                  {categoryOptions.map((name) => (
                    <TouchableOpacity
                      key={name}
                      style={[
                        styles.searchChip,
                        { borderColor: colors.border },
                        categoryName === name && {
                          backgroundColor: colors.tint,
                        },
                      ]}
                      onPress={() => {
                        onCategoryNameChange(name);
                        onBreakdownNameChange("");
                        onStoreNameChange("");
                      }}
                    >
                      <Text
                        style={[
                          styles.searchChipText,
                          {
                            color: categoryName === name ? "#fff" : colors.text,
                          },
                        ]}
                      >
                        {name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {!categoryName ? null : (
                <>
                  <Text style={[styles.searchLabel, { color: colors.subText }]}>
                    内訳
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.searchChipRow}>
                      <TouchableOpacity
                        style={[
                          styles.searchChip,
                          { borderColor: colors.border },
                          !breakdownName && { backgroundColor: colors.tint },
                        ]}
                        onPress={() => {
                          onBreakdownNameChange("");
                          onStoreNameChange("");
                        }}
                      >
                        <Text
                          style={[
                            styles.searchChipText,
                            { color: breakdownName ? colors.text : "#fff" },
                          ]}
                        >
                          指定なし
                        </Text>
                      </TouchableOpacity>
                      {breakdownOptions.map((name) => (
                        <TouchableOpacity
                          key={name}
                          style={[
                            styles.searchChip,
                            { borderColor: colors.border },
                            breakdownName === name && {
                              backgroundColor: colors.tint,
                            },
                          ]}
                          onPress={() => onBreakdownNameChange(name)}
                        >
                          <Text
                            style={[
                              styles.searchChipText,
                              {
                                color:
                                  breakdownName === name ? "#fff" : colors.text,
                              },
                            ]}
                          >
                            {name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </>
              )}

              {!categoryName || type !== "expense" ? null : (
                <>
                  <Text style={[styles.searchLabel, { color: colors.subText }]}>
                    お店
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.searchChipRow}>
                      <TouchableOpacity
                        style={[
                          styles.searchChip,
                          { borderColor: colors.border },
                          !storeName && { backgroundColor: colors.tint },
                        ]}
                        onPress={() => onStoreNameChange("")}
                      >
                        <Text
                          style={[
                            styles.searchChipText,
                            { color: storeName ? colors.text : "#fff" },
                          ]}
                        >
                          指定なし
                        </Text>
                      </TouchableOpacity>
                      {storeOptions.map((name) => (
                        <TouchableOpacity
                          key={name}
                          style={[
                            styles.searchChip,
                            { borderColor: colors.border },
                            storeName === name && {
                              backgroundColor: colors.tint,
                            },
                          ]}
                          onPress={() => onStoreNameChange(name)}
                        >
                          <Text
                            style={[
                              styles.searchChipText,
                              {
                                color:
                                  storeName === name ? "#fff" : colors.text,
                              },
                            ]}
                          >
                            {name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </>
              )}
            </>
          )}

          <Text style={[styles.searchLabel, { color: colors.subText }]}>
            メモ
          </Text>
          <TextInput
            style={[
              styles.searchInput,
              { borderColor: colors.border, color: colors.text },
            ]}
            value={memoQuery}
            onChangeText={onMemoQueryChange}
            placeholder="メモを部分一致で検索"
            placeholderTextColor={colors.subText}
            returnKeyType="search"
            autoCorrect={false}
          />

          <Text style={[styles.searchLabel, { color: colors.subText }]}>
            日付
          </Text>
          <View style={styles.searchDateRow}>
            <TouchableOpacity
              style={[styles.searchDateButton, { borderColor: colors.border }]}
              onPress={() => onDatePickerTargetChange("from")}
            >
              <Text style={[styles.searchDateText, { color: colors.text }]}>
                {`開始: ${fromDate ? displayDate(fromDate) : "未指定"}`}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.searchDateButton, { borderColor: colors.border }]}
              onPress={() => onDatePickerTargetChange("to")}
            >
              <Text style={[styles.searchDateText, { color: colors.text }]}>
                {`終了: ${toDate ? displayDate(toDate) : "未指定"}`}
              </Text>
            </TouchableOpacity>
          </View>
          {datePickerTarget ? (
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
                  onPress={() => {
                    if (datePickerTarget === "from") {
                      onFromDateChange(null);
                    } else {
                      onToDateChange(null);
                    }
                    onDatePickerTargetChange(null);
                  }}
                >
                  <Text
                    style={[styles.searchClearText, { color: colors.subText }]}
                  >
                    未指定にする
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => onDatePickerTargetChange(null)}
                >
                  <Text style={[styles.datePickerDone, { color: colors.tint }]}>
                    完了
                  </Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={getDatePickerValue(datePickerTarget)}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                locale="ja-JP"
                onChange={(event, selected) => {
                  if (Platform.OS !== "ios") onDatePickerTargetChange(null);
                  if (event.type === "dismissed" || !selected) return;
                  const nextDate = formatDate(selected);
                  if (datePickerTarget === "from") {
                    onFromDateChange(nextDate);
                  } else {
                    onToDateChange(nextDate);
                  }
                }}
              />
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  searchPanel: {
    marginHorizontal: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  searchLabel: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
    marginTop: 8,
  },
  searchSummaryHeaderOuter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  searchSummaryHeader: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchSummaryTextWrap: { flex: 1, minWidth: 0 },
  searchClearIconButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    marginLeft: 8,
  },
  searchClearIconLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  searchSummaryTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 3,
  },
  searchSummaryTitle: { fontSize: 13, fontWeight: "700" },
  searchSummaryLabel: { fontSize: 12, fontWeight: "600" },
  searchSummaryAction: { fontSize: 13, fontWeight: "700" },
  conditionBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  conditionBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  searchTypeToggle: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 9,
    overflow: "hidden",
    marginBottom: 8,
  },
  searchTypeButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
  },
  searchTypeText: { fontSize: 13, fontWeight: "700", color: "#999" },
  searchChipRow: { flexDirection: "row", gap: 8, paddingRight: 8 },
  searchChip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  searchChipText: { fontSize: 13, fontWeight: "700" },
  searchInput: {
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 14,
  },
  searchDateRow: { flexDirection: "row", gap: 8 },
  searchDateButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  searchDateText: { fontSize: 12, fontWeight: "700" },
  searchClearButton: {
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 9,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  searchClearText: { fontSize: 13, fontWeight: "700" },
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
  datePickerDone: { fontSize: 17, fontWeight: "600" },
});
