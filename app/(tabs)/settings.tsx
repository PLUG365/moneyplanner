import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import {
  addCategory,
  Category,
  deleteCategory,
  getCategories,
  TransactionType,
} from '@/lib/database';
import { exportCSV } from '@/lib/csvExport';

const PRESET_COLORS = [
  '#1565C0', '#1976D2', '#42A5F5', '#00796B', '#2E7D32',
  '#C62828', '#AD1457', '#E65100', '#F57F17', '#4527A0',
  '#6A1B9A', '#37474F', '#757575', '#5D4037', '#00695C',
];

export default function SettingsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const [categories, setCategories] = useState<Category[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<TransactionType>('expense');
  const [newColor, setNewColor] = useState(PRESET_COLORS[5]);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(() => {
    setCategories(getCategories());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleAddCategory = () => {
    if (!newName.trim()) {
      Alert.alert('エラー', 'カテゴリ名を入力してください');
      return;
    }
    addCategory(newName.trim(), newType, newColor);
    setNewName('');
    setNewColor(PRESET_COLORS[5]);
    setShowAddModal(false);
    load();
  };

  const handleDeleteCategory = (cat: Category) => {
    if (cat.isDefault) {
      Alert.alert('削除不可', 'デフォルトカテゴリは削除できません');
      return;
    }
    Alert.alert('削除確認', `「${cat.name}」を削除しますか？`, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: () => { deleteCategory(cat.id); load(); },
      },
    ]);
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      await exportCSV();
    } catch (e) {
      Alert.alert('エラー', 'CSV出力に失敗しました');
    } finally {
      setExporting(false);
    }
  };

  const incomeCategories = categories.filter(c => c.type === 'income');
  const expenseCategories = categories.filter(c => c.type === 'expense');
  const incomeColor = colorScheme === 'dark' ? '#42A5F5' : '#1565C0';
  const expenseColor = colorScheme === 'dark' ? '#EF5350' : '#C62828';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}>

      {/* CSV出力 */}
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>データ</Text>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.tint }]}
          onPress={handleExportCSV}
          disabled={exporting}>
          <Text style={styles.actionButtonText}>
            {exporting ? '出力中...' : '📤 CSVで書き出す'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* カテゴリ管理 */}
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>カテゴリ管理</Text>
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: colors.tint }]}
            onPress={() => setShowAddModal(true)}>
            <Text style={styles.addButtonText}>＋ 追加</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.categoryGroupLabel, { color: incomeColor }]}>収入</Text>
        {incomeCategories.map(cat => (
          <View key={cat.id} style={[styles.categoryRow, { borderTopColor: colors.border }]}>
            <View style={[styles.categoryDot, { backgroundColor: cat.color }]} />
            <Text style={[styles.categoryName, { color: colors.text }]}>{cat.name}</Text>
            {cat.isDefault ? (
              <Text style={[styles.defaultBadge, { color: colors.subText }]}>デフォルト</Text>
            ) : (
              <TouchableOpacity onPress={() => handleDeleteCategory(cat)}>
                <Text style={styles.deleteText}>削除</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        <Text style={[styles.categoryGroupLabel, { color: expenseColor, marginTop: 12 }]}>支出</Text>
        {expenseCategories.map(cat => (
          <View key={cat.id} style={[styles.categoryRow, { borderTopColor: colors.border }]}>
            <View style={[styles.categoryDot, { backgroundColor: cat.color }]} />
            <Text style={[styles.categoryName, { color: colors.text }]}>{cat.name}</Text>
            {cat.isDefault ? (
              <Text style={[styles.defaultBadge, { color: colors.subText }]}>デフォルト</Text>
            ) : (
              <TouchableOpacity onPress={() => handleDeleteCategory(cat)}>
                <Text style={styles.deleteText}>削除</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>

      {/* カテゴリ追加モーダル */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>カテゴリを追加</Text>

            {/* 種別トグル */}
            <View style={[styles.typeToggle, { borderColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.typeButton, newType === 'income' && { backgroundColor: incomeColor }]}
                onPress={() => setNewType('income')}>
                <Text style={[styles.typeText, newType === 'income' && { color: '#fff' }]}>収入</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeButton, newType === 'expense' && { backgroundColor: expenseColor }]}
                onPress={() => setNewType('expense')}>
                <Text style={[styles.typeText, newType === 'expense' && { color: '#fff' }]}>支出</Text>
              </TouchableOpacity>
            </View>

            {/* 名前入力 */}
            <TextInput
              style={[styles.nameInput, { color: colors.text, borderColor: colors.border }]}
              value={newName}
              onChangeText={setNewName}
              placeholder="カテゴリ名"
              placeholderTextColor={colors.subText}
              maxLength={20}
            />

            {/* カラー選択 */}
            <Text style={[styles.colorLabel, { color: colors.subText }]}>色</Text>
            <View style={styles.colorGrid}>
              {PRESET_COLORS.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: c },
                    newColor === c && styles.colorSwatchSelected,
                  ]}
                  onPress={() => setNewColor(c)}
                />
              ))}
            </View>

            {/* ボタン */}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { borderColor: colors.border }]}
                onPress={() => { setShowAddModal(false); setNewName(''); }}>
                <Text style={[styles.modalButtonText, { color: colors.subText }]}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.tint }]}
                onPress={handleAddCategory}>
                <Text style={[styles.modalButtonText, { color: '#fff' }]}>追加</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  actionButton: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  actionButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  addButton: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  categoryGroupLabel: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  categoryDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  categoryName: { flex: 1, fontSize: 15 },
  defaultBadge: { fontSize: 12 },
  deleteText: { fontSize: 13, color: '#C62828', fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  typeToggle: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 14,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  typeText: { fontSize: 15, fontWeight: '600', color: '#999' },
  nameInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    marginBottom: 14,
  },
  colorLabel: { fontSize: 13, marginBottom: 8 },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  colorSwatch: { width: 32, height: 32, borderRadius: 16 },
  colorSwatchSelected: {
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  modalButtons: { flexDirection: 'row', gap: 10 },
  modalButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  modalButtonText: { fontSize: 15, fontWeight: '600' },
});
