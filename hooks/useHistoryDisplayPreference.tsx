import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  loadHistoryDisplayPreference,
  saveHistoryDisplayPreference,
} from "@/lib/historyDisplayPreference";
import { DEFAULT_HISTORY_DISPLAY_PREFERENCE } from "@/lib/historyDisplayPreferenceFormat";

type HistoryDisplayPreferenceContextValue = {
  showFutureTransactions: boolean;
  setShowFutureTransactions: (showFutureTransactions: boolean) => void;
};

const HistoryDisplayPreferenceContext =
  createContext<HistoryDisplayPreferenceContextValue | null>(null);

/**
 * 履歴タブの表示設定を端末ローカルに持つ。世帯で共有すると同居人の見え方まで
 * 変わってしまうため、テーマ設定と同じく端末ごとの設定として扱う。
 */
export function HistoryDisplayPreferenceProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [showFutureTransactions, setShowFutureTransactionsState] = useState(
    DEFAULT_HISTORY_DISPLAY_PREFERENCE.showFutureTransactions,
  );

  useEffect(() => {
    let mounted = true;
    loadHistoryDisplayPreference().then((saved) => {
      if (!mounted || !saved) return;
      setShowFutureTransactionsState(saved.showFutureTransactions);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const setShowFutureTransactions = useCallback((next: boolean) => {
    setShowFutureTransactionsState(next);
    void saveHistoryDisplayPreference({ showFutureTransactions: next });
  }, []);

  const value = useMemo(
    () => ({ showFutureTransactions, setShowFutureTransactions }),
    [setShowFutureTransactions, showFutureTransactions],
  );

  return (
    <HistoryDisplayPreferenceContext.Provider value={value}>
      {children}
    </HistoryDisplayPreferenceContext.Provider>
  );
}

export function useHistoryDisplayPreference(): HistoryDisplayPreferenceContextValue {
  const context = useContext(HistoryDisplayPreferenceContext);
  if (context) return context;
  // Provider外（テスト等）では既定値を返す
  return {
    showFutureTransactions:
      DEFAULT_HISTORY_DISPLAY_PREFERENCE.showFutureTransactions,
    setShowFutureTransactions: () => {},
  };
}
