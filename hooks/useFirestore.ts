import {
    type FirestoreDocRef,
    type FirestoreQuery,
} from "@/lib/firestore";
import { getHouseholdId } from "@/lib/household";
import {
    onSnapshot,
    type DocumentData,
} from "@react-native-firebase/firestore";
import { useEffect, useRef, useState } from "react";

/**
 * 世帯IDを取得・キャッシュするフック。
 * レイアウトやコレクションフックの queryKey 組み立てに使う。
 */
export function useHouseholdId(): string | null {
  const [householdId, setHouseholdId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getHouseholdId().then((id) => {
      if (!cancelled) setHouseholdId(id);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return householdId;
}

/**
 * Firestore コレクションのリアルタイムリスナーフック。
 *
 * @param queryKey  クエリを一意に識別するキー。null ならリスナー無効。
 *                  パラメータが変わったら別の文字列を渡すこと。
 * @param queryFactory  Firestore FirestoreQuery を返すファクトリ。
 *                      queryKey が変わったときだけ呼ばれる。
 * @param mapFn  ドキュメントを T に変換する関数。
 */
export function useCollection<T>(
  queryKey: string | null,
  queryFactory: () => FirestoreQuery | null,
  mapFn: (id: string, data: DocumentData) => T,
): {
  data: T[];
  loading: boolean;
  error: Error | null;
  fromCache: boolean;
  hasPendingWrites: boolean;
} {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [hasPendingWrites, setHasPendingWrites] = useState(false);

  const queryFactoryRef = useRef(queryFactory);
  const mapFnRef = useRef(mapFn);
  queryFactoryRef.current = queryFactory;
  mapFnRef.current = mapFn;

  useEffect(() => {
    if (queryKey === null) {
      setData([]);
      setLoading(false);
      setFromCache(false);
      setHasPendingWrites(false);
      return;
    }

    setLoading(true);
    const builtQuery = queryFactoryRef.current();
    if (!builtQuery) {
      setData([]);
      setLoading(false);
      setFromCache(false);
      setHasPendingWrites(false);
      return;
    }

    const unsub = onSnapshot(
      builtQuery,
      { includeMetadataChanges: true },
      (snap) => {
        setData(snap.docs.map((doc) => mapFnRef.current(doc.id, doc.data())));
        setFromCache(snap.metadata.fromCache);
        setHasPendingWrites(snap.metadata.hasPendingWrites);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err as Error);
        setLoading(false);
      },
    );

    return () => unsub();
  }, [queryKey]);

  return { data, loading, error, fromCache, hasPendingWrites };
}

/**
 * Firestore 単一ドキュメントのリアルタイムリスナーフック。
 *
 * @param docKey  ドキュメントを一意に識別するキー。null ならリスナー無効。
 * @param docFactory  FirestoreDocRef を返すファクトリ。
 * @param mapFn  ドキュメントを T に変換する関数。
 */
export function useDocument<T>(
  docKey: string | null,
  docFactory: () => FirestoreDocRef | null,
  mapFn: (id: string, data: DocumentData) => T,
): { data: T | null; loading: boolean; error: Error | null } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const docFactoryRef = useRef(docFactory);
  const mapFnRef = useRef(mapFn);
  docFactoryRef.current = docFactory;
  mapFnRef.current = mapFn;

  useEffect(() => {
    if (docKey === null) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const ref = docFactoryRef.current();
    if (!ref) {
      setData(null);
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(
      ref,
      (snap) => {
        const snapData = snap.data();
        if (snapData) {
          setData(mapFnRef.current(snap.id, snapData));
        } else {
          setData(null);
        }
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err as Error);
        setLoading(false);
      },
    );

    return () => unsub();
  }, [docKey]);

  return { data, loading, error };
}
