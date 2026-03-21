import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
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
} from 'react-native';

import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { addTransaction, Category, getCategories, TransactionType } from '@/lib/database';

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function displayDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${y}年${parseInt(m)}月${parseInt(d)}日`;
}

function formatAmount(raw: string): string {
  const n = parseInt(raw.replace(/,/g, ''), 10);
  if (isNaN(n)) return '';
  return n.toLocaleString('ja-JP');
}

export default function RecordScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const today = formatDate(new Date());
  const [type, setType] = useState<TransactionType>('expense');
  const [amountRaw, setAmountRaw] = useState('');
  const [date, setDate] = useState(today);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [memo, setMemo] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const cats = getCategories(type);
      setCategories(cats);
      if (cats.length > 0 && categoryId === null) setCategoryId(cats[0].id);
    }, [type])
  );

  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    const cats = getCategories(newType);
    setCategories(cats);
    if (cats.length > 0) setCategoryId(cats[0].id);
  };

  const handleSave = () => {
    const amount = parseInt(amountRaw.replace(/,/g, ''), 10);
    if (!amountRaw || isNaN(amount) || amount <= 0) {
      Alert.alert('エラー', '金額を入力してください');
      return;
    }
    if (!categoryId) {
      Alert.alert('エラー', 'カテゴリを選択してください');
      return;
    }
    addTransaction(date, amount, type, categoryId, memo);
    setAmountRaw('');
    setMemo('');
    setDate(today);
    Alert.alert('保存しました');
  };

  const incomeColor = colorScheme === 'dark' ? '#42A5F5' : '#1565C0';
  const expenseColor = colorScheme === 'dark' ? '#EF5350' : '#C62828';
  const activeColor = type === 'income' ? incomeColor : expenseColor;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">

      {/* 収入/支出トグル */}
      <View style={[styles.typeToggle, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.typeButton, type === 'income' && { backgroundColor: incomeColor }]}
          onPress={() => handleTypeChange('income')}>
          <Text style={[styles.typeButtonText, type === 'income' && styles.typeButtonTextActive]}>
            収入
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.typeButton, type === 'expense' && { backgroundColor: expenseColor }]}
          onPress={() => handleTypeChange('expense')}>
          <Text style={[styles.typeButtonText, type === 'expense' && styles.typeButtonTextActive]}>
            支出
          </Text>
        </TouchableOpacity>
      </View>

      {/* 金額入力 */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.subText }]}>金額</Text>
        <View style={styles.amountRow}>
          <Text style={[styles.yen, { color: activeColor }]}>¥</Text>
          <TextInput
            style={[styles.amountInput, { color: activeColor }]}
            value={amountRaw ? formatAmount(amountRaw) : ''}
            onChangeText={text => setAmountRaw(text.replace(/[^0-9]/g, ''))}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={colors.border}
          />
        </View>
      </View>

      {/* 日付 */}
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => setShowDatePicker(true)}>
        <Text style={[styles.label, { color: colors.subText }]}>日付</Text>
        <Text style={[styles.dateText, { color: colors.text }]}>{displayDate(date)}</Text>
      </TouchableOpacity>

      {/* 日付ピッカー */}
      {Platform.OS === 'ios' ? (
        <Modal transparent animationType="slide" visible={showDatePicker}>
          <View style={styles.datePickerOverlay}>
            <View style={[styles.datePickerContainer, { backgroundColor: colors.card }]}>
              <View style={[styles.datePickerHeader, { borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Text style={[styles.datePickerDone, { color: colors.tint }]}>完了</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={new Date(date)}
                mode="date"
                display="spinner"
                locale="ja-JP"
                maximumDate={new Date()}
                onChange={(_, selected) => {
                  if (selected) setDate(formatDate(selected));
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
            maximumDate={new Date()}
            onChange={(_, selected) => {
              setShowDatePicker(false);
              if (selected) setDate(formatDate(selected));
            }}
          />
        )
      )}

      {/* カテゴリ */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.subText }]}>カテゴリ</Text>
        <View style={styles.categoryGrid}>
          {categories.map(cat => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.categoryChip,
                { borderColor: cat.color },
                categoryId === cat.id && { backgroundColor: cat.color },
              ]}
              onPress={() => setCategoryId(cat.id)}>
              <Text
                style={[
                  styles.categoryChipText,
                  { color: cat.color },
                  categoryId === cat.id && { color: '#fff' },
                ]}>
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* メモ */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.subText }]}>メモ（任意）</Text>
        <TextInput
          style={[styles.memoInput, { color: colors.text, borderColor: colors.border }]}
          value={memo}
          onChangeText={setMemo}
          placeholder="メモを入力"
          placeholderTextColor={colors.subText}
          multiline
          maxLength={100}
        />
      </View>

      {/* 保存ボタン */}
      <TouchableOpacity
        style={[styles.saveButton, { backgroundColor: activeColor }]}
        onPress={handleSave}>
        <Text style={styles.saveButtonText}>保存する</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 100 },
  typeToggle: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 12,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  typeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
  },
  typeButtonTextActive: { color: '#fff' },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  label: { fontSize: 12, marginBottom: 8 },
  amountRow: { flexDirection: 'row', alignItems: 'center' },
  yen: { fontSize: 28, fontWeight: '700', marginRight: 4 },
  amountInput: { fontSize: 36, fontWeight: '700', flex: 1 },
  dateText: { fontSize: 18, fontWeight: '500' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: {
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  categoryChipText: { fontSize: 14, fontWeight: '500' },
  memoInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    minHeight: 60,
  },
  saveButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  saveButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  datePickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  datePickerContainer: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 20,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  datePickerDone: { fontSize: 17, fontWeight: '600' },
});
