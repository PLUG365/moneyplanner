import React from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { shiftYearMonth } from "@/lib/monthPicker";

type MonthPickerColors = {
  text: string;
  subText: string;
  card: string;
  border: string;
  tint: string;
};

type MonthPickerModalProps = {
  visible: boolean;
  colors: MonthPickerColors;
  year: number;
  month: number;
  title: string;
  onClose: () => void;
  onChange: (year: number, month: number) => void;
};

const MONTH_LABELS = [
  "1月",
  "2月",
  "3月",
  "4月",
  "5月",
  "6月",
  "7月",
  "8月",
  "9月",
  "10月",
  "11月",
  "12月",
];

export default function MonthPickerModal({
  visible,
  colors,
  year,
  month,
  title,
  onClose,
  onChange,
}: MonthPickerModalProps) {
  const selectToday = () => {
    const today = new Date();
    onChange(today.getFullYear(), today.getMonth() + 1);
    onClose();
  };

  const selectMonth = (nextMonth: number) => {
    onChange(year, nextMonth);
    onClose();
  };

  const prevYear = () => {
    const next = shiftYearMonth(year, month, -12);
    onChange(next.year, next.month);
  };

  const nextYear = () => {
    const next = shiftYearMonth(year, month, 12);
    onChange(next.year, next.month);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={selectToday}>
              <Text style={[styles.headerAction, { color: colors.tint }]}>
                今日
              </Text>
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={[styles.headerAction, { color: colors.tint }]}>
                完了
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.yearRow}>
            <TouchableOpacity onPress={prevYear} style={styles.yearButton}>
              <Text style={[styles.yearArrow, { color: colors.tint }]}>‹</Text>
            </TouchableOpacity>
            <Text style={[styles.yearLabel, { color: colors.text }]}>
              {year}年
            </Text>
            <TouchableOpacity onPress={nextYear} style={styles.yearButton}>
              <Text style={[styles.yearArrow, { color: colors.tint }]}>›</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.monthGrid}>
            {MONTH_LABELS.map((label, index) => {
              const nextMonth = index + 1;
              const isSelected = nextMonth === month;
              return (
                <TouchableOpacity
                  key={label}
                  style={[
                    styles.monthButton,
                    {
                      borderColor: isSelected ? colors.tint : colors.border,
                      backgroundColor: isSelected
                        ? colors.tint + "18"
                        : colors.card,
                    },
                  ]}
                  onPress={() => selectMonth(nextMonth)}
                >
                  <Text
                    style={[
                      styles.monthText,
                      { color: isSelected ? colors.tint : colors.text },
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    paddingBottom: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerAction: { fontSize: 16, fontWeight: "700" },
  title: { fontSize: 16, fontWeight: "700" },
  yearRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  yearButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },
  yearArrow: { fontSize: 28, fontWeight: "400" },
  yearLabel: { fontSize: 18, fontWeight: "700" },
  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    gap: 8,
  },
  monthButton: {
    width: "31.5%",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  monthText: { fontSize: 15, fontWeight: "600" },
});
