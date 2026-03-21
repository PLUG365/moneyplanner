import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import {
  deleteTransaction,
  getDatesWithTransactions,
  getTransactionsByDate,
  getTransactionsByMonth,
  Transaction,
} from '@/lib/database';

type ViewMode = 'list' | 'calendar';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
const MONTHS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

function formatAmount(amount: number): string {
  return amount.toLocaleString('ja-JP');
}

function parseYMD(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return { y, m, d };
}

export default function HistoryScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const now = new Date();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [markedDates, setMarkedDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedDateTxs, setSelectedDateTxs] = useState<Transaction[]>([]);

  const load = useCallback(() => {
    const txs = getTransactionsByMonth(year, month);
    setTransactions(txs);
    const dates = getDatesWithTransactions(year, month);
    setMarkedDates(dates);
    if (selectedDate) {
      setSelectedDateTxs(getTransactionsByDate(selectedDate));
    }
  }, [year, month, selectedDate]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
    setSelectedDate(null);
    setSelectedDateTxs([]);
  };

  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
    setSelectedDate(null);
    setSelectedDateTxs([]);
  };

  const handleDelete = (tx: Transaction) => {
    Alert.alert('削除確認', `この記録を削除しますか？\n${tx.categoryName} ¥${formatAmount(tx.amount)}`, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: () => {
          deleteTransaction(tx.id);
          load();
        },
      },
    ]);
  };

  const handleSelectDate = (dateStr: string) => {
    if (selectedDate === dateStr) {
      setSelectedDate(null);
      setSelectedDateTxs([]);
    } else {
      setSelectedDate(dateStr);
      setSelectedDateTxs(getTransactionsByDate(dateStr));
    }
  };

  const incomeColor = colorScheme === 'dark' ? '#42A5F5' : '#1565C0';
  const expenseColor = colorScheme === 'dark' ? '#EF5350' : '#C62828';

  // --- カレンダー計算 ---
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  const calendarCells: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (calendarCells.length % 7 !== 0) calendarCells.push(null);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* セグメント切り替え */}
      <View style={[styles.segmentContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.segmentButton, viewMode === 'list' && { backgroundColor: colors.tint }]}
          onPress={() => setViewMode('list')}>
          <Text style={[styles.segmentText, viewMode === 'list' && { color: '#fff' }]}>リスト</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segmentButton, viewMode === 'calendar' && { backgroundColor: colors.tint }]}
          onPress={() => setViewMode('calendar')}>
          <Text style={[styles.segmentText, viewMode === 'calendar' && { color: '#fff' }]}>カレンダー</Text>
        </TouchableOpacity>
      </View>

      {/* 月ナビゲーション */}
      <View style={[styles.monthNav, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TouchableOpacity onPress={prevMonth} style={styles.navButton}>
          <Text style={[styles.navArrow, { color: colors.tint }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.monthTitle, { color: colors.text }]}>
          {year}年{month}月
        </Text>
        <TouchableOpacity onPress={nextMonth} style={styles.navButton}>
          <Text style={[styles.navArrow, { color: colors.tint }]}>›</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {viewMode === 'list' ? (
          // --- リストビュー ---
          transactions.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.subText }]}>記録がありません</Text>
          ) : (
            transactions.map(tx => (
              <TouchableOpacity
                key={tx.id}
                style={[styles.txItem, { backgroundColor: colors.card, borderColor: colors.border }]}
                onLongPress={() => handleDelete(tx)}>
                <View style={[styles.categoryDot, { backgroundColor: tx.categoryColor }]} />
                <View style={styles.txMain}>
                  <Text style={[styles.txCategory, { color: colors.text }]}>{tx.categoryName}</Text>
                  {tx.memo ? (
                    <Text style={[styles.txMemo, { color: colors.subText }]} numberOfLines={1}>{tx.memo}</Text>
                  ) : null}
                  <Text style={[styles.txDate, { color: colors.subText }]}>
                    {(() => { const { y, m, d } = parseYMD(tx.date); return `${y}年${m}月${d}日`; })()}
                  </Text>
                </View>
                <Text style={[
                  styles.txAmount,
                  { color: tx.type === 'income' ? incomeColor : expenseColor },
                ]}>
                  {tx.type === 'income' ? '+' : '-'}¥{formatAmount(tx.amount)}
                </Text>
              </TouchableOpacity>
            ))
          )
        ) : (
          // --- カレンダービュー ---
          <View>
            {/* 曜日ヘッダー */}
            <View style={styles.weekHeader}>
              {WEEKDAYS.map((w, i) => (
                <Text
                  key={w}
                  style={[
                    styles.weekDay,
                    { color: i === 0 ? expenseColor : i === 6 ? incomeColor : colors.subText },
                  ]}>
                  {w}
                </Text>
              ))}
            </View>

            {/* 日付グリッド */}
            <View style={styles.calendarGrid}>
              {calendarCells.map((day, idx) => {
                if (day === null) return <View key={`e-${idx}`} style={styles.dayCell} />;
                const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const hasData = markedDates.includes(dateStr);
                const isSelected = selectedDate === dateStr;
                const dayOfWeek = idx % 7;
                const dayColor = dayOfWeek === 0 ? expenseColor : dayOfWeek === 6 ? incomeColor : colors.text;

                return (
                  <TouchableOpacity
                    key={dateStr}
                    style={[
                      styles.dayCell,
                      isSelected && { backgroundColor: colors.tint + '22' },
                    ]}
                    onPress={() => hasData && handleSelectDate(dateStr)}>
                    <Text style={[styles.dayNumber, { color: dayColor }, isSelected && { fontWeight: '700' }]}>
                      {day}
                    </Text>
                    {hasData && (
                      <View style={[styles.dateDot, { backgroundColor: colors.tint }]} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 選択日の記録 */}
            {selectedDate && (
              <View style={{ marginTop: 8 }}>
                <Text style={[styles.selectedDateTitle, { color: colors.subText }]}>
                  {(() => { const { y, m, d } = parseYMD(selectedDate); return `${y}年${m}月${d}日`; })()}
                </Text>
                {selectedDateTxs.map(tx => (
                  <TouchableOpacity
                    key={tx.id}
                    style={[styles.txItem, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onLongPress={() => handleDelete(tx)}>
                    <View style={[styles.categoryDot, { backgroundColor: tx.categoryColor }]} />
                    <View style={styles.txMain}>
                      <Text style={[styles.txCategory, { color: colors.text }]}>{tx.categoryName}</Text>
                      {tx.memo ? (
                        <Text style={[styles.txMemo, { color: colors.subText }]} numberOfLines={1}>{tx.memo}</Text>
                      ) : null}
                    </View>
                    <Text style={[
                      styles.txAmount,
                      { color: tx.type === 'income' ? incomeColor : expenseColor },
                    ]}>
                      {tx.type === 'income' ? '+' : '-'}¥{formatAmount(tx.amount)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  segmentContainer: {
    flexDirection: 'row',
    margin: 12,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  segmentText: { fontSize: 15, fontWeight: '600', color: '#999' },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 8,
  },
  navButton: { padding: 8 },
  navArrow: { fontSize: 26, fontWeight: '400' },
  monthTitle: { fontSize: 17, fontWeight: '700' },
  scrollContent: { paddingHorizontal: 12, paddingBottom: 100 },
  emptyText: { textAlign: 'center', marginTop: 48, fontSize: 15 },
  txItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  categoryDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  txMain: { flex: 1 },
  txCategory: { fontSize: 15, fontWeight: '600' },
  txMemo: { fontSize: 12, marginTop: 2 },
  txDate: { fontSize: 12, marginTop: 2 },
  txAmount: { fontSize: 16, fontWeight: '700' },
  weekHeader: { flexDirection: 'row', marginBottom: 4 },
  weekDay: { flex: 1, textAlign: 'center', fontSize: 13, fontWeight: '600' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  dayNumber: { fontSize: 15 },
  dateDot: { width: 5, height: 5, borderRadius: 3, marginTop: 2 },
  selectedDateTitle: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginLeft: 4 },
});
