import React from "react";
import {
    Modal,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

import { applyNumericInputKey, type NumericInputKey } from "@/lib/numericInput";

type NumericInputModalColors = {
  text: string;
  subText: string;
  background: string;
  card: string;
  border: string;
  tint: string;
};

type NumericInputModalProps = {
  visible: boolean;
  title: string;
  value: string;
  displayValue: string;
  placeholder: string;
  colors: NumericInputModalColors;
  allowOperators?: boolean;
  allowNegative?: boolean;
  onChange: (value: string) => void;
  onEvaluate?: () => void;
  onCancel: () => void;
  onConfirm: () => void;
  useNativeModal?: boolean;
};

const DIGIT_ROWS: NumericInputKey[][] = [
  ["7", "8", "9", "backspace"],
  ["4", "5", "6", "clear"],
  ["1", "2", "3"],
  ["0"],
];

const OPERATOR_ROWS: NumericInputKey[][] = [
  ["7", "8", "9", "backspace"],
  ["4", "5", "6", "+"],
  ["1", "2", "3", "-"],
  ["clear", "0", "*", "/"],
];

function getKeyLabel(key: NumericInputKey): string {
  if (key === "backspace") return "⌫";
  if (key === "clear") return "C";
  if (key === "*") return "×";
  if (key === "/") return "÷";
  return key;
}

export default function NumericInputModal({
  visible,
  title,
  value,
  displayValue,
  placeholder,
  colors,
  allowOperators = false,
  allowNegative = false,
  onChange,
  onEvaluate,
  onCancel,
  onConfirm,
  useNativeModal = true,
}: NumericInputModalProps) {
  const rows = allowOperators ? OPERATOR_ROWS : DIGIT_ROWS;

  const handlePress = (key: NumericInputKey) => {
    onChange(
      applyNumericInputKey(value, key, { allowOperators, allowNegative }),
    );
  };

  const content = visible ? (
    <View style={styles.overlay}>
      <SafeAreaView
        style={[
          styles.sheet,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onCancel} style={styles.headerButton}>
            <Text style={[styles.cancelText, { color: colors.subText }]}>
              閉じる
            </Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <TouchableOpacity onPress={onConfirm} style={styles.headerButton}>
            <Text style={[styles.doneText, { color: colors.tint }]}>完了</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.preview, { backgroundColor: colors.background }]}>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
            style={[
              styles.previewText,
              { color: value ? colors.text : colors.subText },
            ]}
          >
            {displayValue || placeholder}
          </Text>
        </View>

        <View style={styles.keypad}>
          {rows.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.keyRow}>
              {row.map((key) => (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.key,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.background,
                    },
                    isOperatorKey(key) && { backgroundColor: colors.tint },
                  ]}
                  onPress={() => handlePress(key)}
                >
                  <Text
                    style={[
                      styles.keyText,
                      { color: isOperatorKey(key) ? "#fff" : colors.text },
                    ]}
                  >
                    {getKeyLabel(key)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </View>

        {onEvaluate ? (
          <TouchableOpacity
            style={[styles.evaluateButton, { backgroundColor: colors.tint }]}
            onPress={onEvaluate}
          >
            <Text style={styles.evaluateButtonText}>計算</Text>
          </TouchableOpacity>
        ) : null}
      </SafeAreaView>
    </View>
  ) : null;

  if (!useNativeModal) {
    return content;
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      {content}
    </Modal>
  );
}

function isOperatorKey(key: NumericInputKey): boolean {
  return key === "+" || key === "-" || key === "*" || key === "/";
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.35)",
    zIndex: 20,
    elevation: 20,
  },
  sheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  header: {
    minHeight: 54,
    borderBottomWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
  },
  headerButton: { minWidth: 64, paddingVertical: 12 },
  cancelText: { fontSize: 15, fontWeight: "700" },
  doneText: { fontSize: 15, fontWeight: "700", textAlign: "right" },
  title: { fontSize: 16, fontWeight: "700" },
  preview: {
    margin: 12,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  previewText: { fontSize: 30, fontWeight: "700", textAlign: "right" },
  evaluateButton: {
    marginHorizontal: 12,
    marginTop: 2,
    marginBottom: 12,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  evaluateButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  keypad: { paddingHorizontal: 12, paddingBottom: 12, gap: 8 },
  keyRow: { flexDirection: "row", gap: 8 },
  key: {
    flex: 1,
    minHeight: 54,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  keyText: { fontSize: 22, fontWeight: "700" },
});
