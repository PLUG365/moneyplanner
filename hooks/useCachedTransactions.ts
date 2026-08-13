import {
    getDocsFromCache,
    getDocsFromServer,
    orderBy,
    query,
    where,
} from "@react-native-firebase/firestore";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import {
    householdCollection,
    mapActiveTransactions,
    readHouseholdDataVersionPreferServer,
    Transaction,
    type FirestoreQuery,
    type FirestoreQuerySnapshot,
} from "@/lib/firestore";
import {
    getLocalWriteEpoch,
    isLocalWriteEpochCurrent,
} from "@/lib/localWriteEpoch";
import { DataVersion, shouldReadServerForScope } from "@/lib/readFreshness";
import { READ_TIMED_OUT, withReadTimeout } from "@/lib/readTimeout";
import {
  decideStaleScopeWrite,
  shouldClearPaintedForScopeChange,
} from "@/lib/staleScopeGuard";
import { areTransactionListsEquivalent } from "@/lib/transactionListIdentity";
import {
    pickFirstPaintSource,
    resolveHasSettled,
    type FirstPaintSource,
} from "@/lib/transactionReadPlan";
import {
    getPersistedScopeDocCount,
    getPersistedScopeVersion,
    loadScopeVersions,
    setPersistedScopeVersion,
} from "@/lib/scopeVersionStore";

type CachedTransactionScope = {
  items: Transaction[];
  version: DataVersion;
  fromCache: boolean;
  /** このエントリを作った時点の、端末自身の書き込みカウンタ（ADR の R1）。 */
  epoch: number;
};

type CachedTransactionsRange = {
  from: string;
  to: string;
};

type UseCachedTransactionsOptions = {
  scopeKey: string;
  range: CachedTransactionsRange;
  orderByDateDesc?: boolean;
};

/** マスク時に返す固定の空配列。毎回新しい配列を返すと再描画が跳ねる。 */
const EMPTY_TRANSACTIONS: Transaction[] = [];

const transactionScopeCache = new Map<string, CachedTransactionScope>();
const currentVersionByHousehold = new Map<string, DataVersion>();

function buildScopeCacheKey(householdId: string, scopeKey: string): string {
  return `${householdId}:transactions:${scopeKey}`;
}

function buildTransactionQuery(
  householdId: string,
  range: CachedTransactionsRange,
  orderByDateDesc: boolean,
): FirestoreQuery {
  let transactionsQuery: FirestoreQuery = query(
    householdCollection(householdId, "transactions"),
    where("date", ">=", range.from),
    where("date", "<=", range.to),
  );
  if (orderByDateDesc) {
    transactionsQuery = query(transactionsQuery, orderBy("date", "desc"));
  }
  return transactionsQuery;
}

async function getTransactionSnapshot(
  targetQuery: FirestoreQuery,
  source: "cache" | "server",
): Promise<FirestoreQuerySnapshot | null> {
  try {
    return source === "cache"
      ? await getDocsFromCache(targetQuery)
      : await getDocsFromServer(targetQuery);
  } catch (error) {
    if (source === "cache") return null;
    throw error;
  }
}

export function useCachedTransactions(
  householdId: string | null,
  options: UseCachedTransactionsOptions,
): {
  data: Transaction[];
  loading: boolean;
  error: Error | null;
  fromCache: boolean;
  /** このスコープの読み込みが一巡したか。空メッセージの表示可否に使う。 */
  hasSettled: boolean;
  /**
   * いま `data` に入っている配列が、このスコープの全件か。
   *
   * 集計（合計・カテゴリ別・予算進捗）の表示可否に使う。Firestore のキャッシュには
   * 「この端末が過去に取得したぶん」しか入っておらず、履歴タブのページングで
   * 取り込まれた一部だけが該当年に入っている、という状態が起こりうる。そこから
   * 合計を出すと**確定値の顔をした誤った金額**になる。一覧と違い、集計は欠けても
   * 見て分からないため、確認できないときは表示しない。
   */
  isComplete: boolean;
  refresh: () => void;
  refreshIfStale: () => void;
} {
  const [data, setData] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [fromCache, setFromCache] = useState(false);
  // このスコープの読み込みが一巡したか。`loading` はサーバー読みの間だけ true に
  // なる（= ProgressOverlay 用）ので、その手前の版チェック・キャッシュ読みの間は
  // 「data 空 かつ 非ローディング」になり、呼び出し側が0件と誤判定する（Issue #9）。
  // 空メッセージの表示可否はこちらで判定する。
  const [hasSettled, setHasSettled] = useState(false);
  // `data` がこのスコープの全件か（集計の表示可否）。安全側の false から始める。
  const [isComplete, setIsComplete] = useState(false);
  // 現在 `data` に入っている内容が、どのスコープのものか。スコープ切替の判定に使う。
  const paintedScopeRef = useRef<string | null>(null);
  // いまの `hasSettled` がどのスコープについての確定かを保持する。
  //
  // `paintedScopeRef` では代用できない。描画できるものが何も無いまま読みが失敗・
  // タイムアウトした場合、描画は起きないので `paintedScopeRef` は null のままだが、
  // `hasSettled` は確定している。描画の有無で `hasSettled` をマスクすると、
  // その画面は永久に確定しない状態になる。
  const settledScopeRef = useRef<string | null>(null);
  // いまの `error` がどのスコープの失敗かを保持する。旧スコープの失敗を
  // 新スコープのエラーとして出さないために、返す直前で突き合わせる。
  const errorScopeRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);
  // 最後に要求されたスコープのキャッシュキー。進行中のクロージャは自分が起動した
  // 時点のスコープを保持したままなので、書き込みの直前にこれと突き合わせて
  // 「まだ現在のスコープか」を判定する（`lib/staleScopeGuard.ts`）。
  // `inFlightRef` による早期 return より前に更新する必要がある。予約へ回った要求も
  // 「最新の意図」として記録しないと、進行中の旧スコープが stale と判定されない。
  const requestedScopeRef = useRef<string | null>(null);
  // 進行中に scope（年・日付範囲）変更などで来た再読込要求を、完了後にやり直すための予約。
  const pendingReloadRef = useRef<{
    forceServer?: boolean;
    refreshMarker?: boolean;
  } | null>(null);
  const loadRef = useRef<
    | ((input?: {
        forceServer?: boolean;
        refreshMarker?: boolean;
      }) => Promise<void>)
    | null
  >(null);
  const rangeFrom = options.range.from;
  const rangeTo = options.range.to;
  const orderByDateDesc = !!options.orderByDateDesc;
  const scopeKey = options.scopeKey;

  const load = useCallback(
    async (input?: { forceServer?: boolean; refreshMarker?: boolean }) => {
      // スコープキーは早期 return より前に確定させ、「最後に要求されたスコープ」
      // として記録する。世帯ID未解決の間は null を記録し、進行中の読みがあれば
      // それも stale として扱う（別世帯の内容を出さない）。
      const cacheKey = householdId
        ? buildScopeCacheKey(householdId, scopeKey)
        : null;
      requestedScopeRef.current = cacheKey;

      if (!householdId || !cacheKey) {
        // ここでは hasSettled を倒さない（false のまま維持する）。倒すと世帯ID未解決の間に
        // 空メッセージが出てしまうため。世帯なしユーザーはルートレイアウトが /household へ
        // 遷移させるので、通常この状態でタブが表示され続けることはない。
        // ただし万一 householdId が解決しないままだと、集計タブはデータも空メッセージも
        // 出さない無表示状態になる（loading は false のためオーバーレイも消える）。
        setData([]);
        setLoading(false);
        setFromCache(false);
        // 世帯IDが一時的に null になってから同じ世帯へ戻ると、ここで内容だけ消して
        // スコープの目印を残したままにすると、マスクが「現在のスコープのもの」と判定して
        // 消した内容の isComplete / hasSettled / error を復活させてしまう。
        // 内容とスコープの目印は必ず同時に無効化する。
        setIsComplete(false);
        setError(null);
        paintedScopeRef.current = null;
        settledScopeRef.current = null;
        errorScopeRef.current = null;
        return;
      }
      if (inFlightRef.current) {
        // ドロップせず、完了後に最新スコープで読み直すよう予約する。
        // 上書きではなくフラグをマージし、refreshMarker/forceServer の要求を取りこぼさない。
        const prev = pendingReloadRef.current;
        pendingReloadRef.current = {
          forceServer: !!(prev?.forceServer || input?.forceServer),
          refreshMarker: !!(prev?.refreshMarker || input?.refreshMarker),
        };
        // 予約は進行中の読みが終わるまで実行されない。その間、画面には前のスコープの
        // 内容が残ったままになる（旧スコープの書き込みを止めるだけでは消えない）。
        // 要求を受け付けた時点で表示状態を無効化する。
        //
        // 空表示が伸びるが、家計の数値を別の年のものとして見せるよりは安全である。
        // ここで `setLoading(true)` はしない。進行中の読みの `finally` が無条件に
        // `setLoading(false)` を通すため、点滅するだけで意味がない。
        if (
          shouldClearPaintedForScopeChange({
            paintedScopeKey: paintedScopeRef.current,
            targetScopeKey: cacheKey,
          })
        ) {
          setData([]);
          setFromCache(false);
          setIsComplete(false);
          setHasSettled(false);
          settledScopeRef.current = cacheKey;
          paintedScopeRef.current = null;
        }
        return;
      }
      inFlightRef.current = true;
      // 書き込みの直前に毎回評価する。捕捉した値を使うと、待っている間に起きた
      // スコープ変更を見落とす。
      const decideWrite = () =>
        decideStaleScopeWrite({
          resultScopeKey: cacheKey,
          requestedScopeKey: requestedScopeRef.current,
        });
      // 年切替などでスコープが変わるときも、新スコープの読み込みが終わるまでは
      // 0件と確定させない（下で setData([]) するため、ここで倒さないと
      // 切替直後に空メッセージが出る）。
      setHasSettled(false);
      settledScopeRef.current = cacheKey;
      // スコープが変わる場合、描画するまで data は前のスコープの配列である。
      // 集計に使ってよいかは、新しいスコープで描き直すまで確定させない。
      setIsComplete(false);
      await loadScopeVersions();

      const query = buildTransactionQuery(
        householdId,
        { from: rangeFrom, to: rangeTo },
        orderByDateDesc,
      );
      // 端末自身が書き込んだあとのエントリは、その書き込みを含まないため使わない。
      // 捨てたあとはディスクキャッシュ読みが初回描画になり、そちらは未送信の
      // 書き込みも含むので、自分の記録が反映された状態で描画される（ADR の R1）。
      const memoryEntry = transactionScopeCache.get(cacheKey);
      const memory =
        memoryEntry && isLocalWriteEpochCurrent(householdId, memoryEntry.epoch)
          ? memoryEntry
          : undefined;

      // スコープ（年・日付範囲）が変わったときだけ空にする。前のスコープのデータを
      // 新しいスコープの内容として見せないための処理である。
      //
      // 「メモリキャッシュが使えないとき」を条件にしてはいけない。端末自身の書き込み後は
      // R1 により memory を捨てるため、記録直後に集計タブへ移ると画面がいったん空に
      // なってしまう。同じスコープなら、画面に出ている内容をディスク読みが返るまで
      // 保持したほうがよい（ディスク読みはローカルなので待ち時間は短い）。
      if (
        shouldClearPaintedForScopeChange({
          paintedScopeKey: paintedScopeRef.current,
          targetScopeKey: cacheKey,
        }) &&
        decideWrite().applyContent
      ) {
        setData([]);
        setFromCache(false);
      }

      // 何を描画できたか。catch 側でも参照するため try の外で宣言する。
      let painted: FirstPaintSource = pickFirstPaintSource({
        forceServer: !!input?.forceServer,
        hasUsableMemory: !!memory,
        cachedDocCount: 0,
      });

      try {
        // ── Phase 1: 初回描画（ネットワークを使わない）─────────────────
        // 案B: マーカーのサーバー往復をこの後ろへ移し、手元にあるものを先に描く。
        // 以前はマーカー読みが先頭にあり、データが端末にあっても往復を待たされていた。
        //
        // 描画に使った配列が「いつ時点のサーバー読みか」。鮮度判定に使う。
        let paintedVersion: DataVersion = null;
        // 件数比較用（ADR の R3）。ディスクキャッシュから描いたときだけ意味を持つ。
        let stampedDocCount: number | undefined;
        let cachedDocCount: number | undefined;
        // 描画に使った配列が、このスコープの全件と分かっているか。
        let paintedComplete = false;

        if (painted === "memory" && memory) {
          // 内容が同じなら前の配列を保持する。参照が変わらなければ再描画自体が
          // 起きず、スクロール位置の跳ねやタップ先のズレを避けられる（ADR の R4）。
          if (decideWrite().applyContent) {
            setData((prev) =>
              areTransactionListsEquivalent(prev, memory.items)
                ? prev
                : memory.items,
            );
            setFromCache(memory.fromCache);
            paintedScopeRef.current = cacheKey;
          }
          paintedVersion = memory.version;
          // サーバー読みで作られたエントリ（fromCache === false）は、stamp の
          // 保存可否に関わらず全件である。ディスク由来なら stamp の有無で判断する。
          paintedComplete = !memory.fromCache || memory.version !== null;
        } else if (painted === "none" && !input?.forceServer) {
          const cacheSnap = await getTransactionSnapshot(query, "cache");
          painted = pickFirstPaintSource({
            forceServer: false,
            hasUsableMemory: false,
            cachedDocCount: cacheSnap?.docs.length ?? 0,
          });
          if (painted === "cache" && cacheSnap) {
            const cachedItems = mapActiveTransactions(cacheSnap.docs);
            // ディスクキャッシュの版は「現在版」ではなく、永続化した
            // 「このスコープを最後にサーバー読みした時点の版」を使う。
            paintedVersion = getPersistedScopeVersion(cacheKey);
            // 比較はソフトデリート除外前の生の件数で行う（ADR の R3）。
            stampedDocCount = getPersistedScopeDocCount(cacheKey);
            cachedDocCount = cacheSnap.docs.length;
            transactionScopeCache.set(cacheKey, {
              items: cachedItems,
              version: paintedVersion,
              fromCache: true,
              epoch: getLocalWriteEpoch(householdId),
            });
            if (decideWrite().applyContent) {
              setData((prev) =>
                areTransactionListsEquivalent(prev, cachedItems)
                  ? prev
                  : cachedItems,
              );
              setFromCache(true);
              paintedScopeRef.current = cacheKey;
            }
            // stamp があれば、過去にこのスコープをサーバーから読み切っている。
            // 無ければ、履歴タブのページングで入った一部が混ざっているだけかもしれない。
            paintedComplete = paintedVersion !== null;
          }
        }
        if (decideWrite().applyContent) {
          setIsComplete(paintedComplete);

          // 描画できたかで「0件と確定してよいか」が決まる。ディスクキャッシュ0件では
          // 「世帯が空」と「未キャッシュ」を区別できないため、サーバー読みを待つ。
          setHasSettled(
            resolveHasSettled({ paintedSource: painted, serverReadDone: false }),
          );
          settledScopeRef.current = cacheKey;
        } else {
          // ここまでの待ちの間にスコープが変わっている。以降の読みは新しいスコープの
          // 読み込みが行うので、ネットワークを使わずに降りる。`finally` は必ず通るため、
          // 進行中フラグの解放と予約された再読込は失われない。
          return;
        }

        // ── Phase 2: 鮮度確認（ここで初めてネットワークを使う）───────────
        // すでに描画済みなので、この往復が遅くても初回表示は待たされない。
        let currentVersion = currentVersionByHousehold.get(householdId);
        if (input?.refreshMarker || currentVersion === undefined) {
          const markerResult = await withReadTimeout(
            readHouseholdDataVersionPreferServer(householdId),
          );
          if (markerResult === READ_TIMED_OUT) {
            // **メモ化しない。** ここで null を書き込むと、1回の応答なしが
            // セッション中ずっと「マーカーは null」として残ってしまう。
            if (painted !== "none") {
              // 描画済みなら、鮮度を確認できないまま読み直さずここで終える。
              // 次のフォーカスで再試行される。
              if (decideWrite().applyError) {
                setError(null);
                errorScopeRef.current = cacheKey;
              }
              return;
            }
            // 何も描けていない場合は、鮮度不明のままデータ読みへ進む。
            // その読みが成功しても currentVersion は undefined のままなので
            // stamp は記録されない（＝完全性を主張しない）。
          } else {
            currentVersion = markerResult;
            currentVersionByHousehold.set(householdId, currentVersion);
          }
        }

        // マーカー読みの待ちの間にスコープが変わっている場合、ここから先は
        // 新しいスコープの読みが行う。サーバー読みへ進むと通信を無駄にするうえ、
        // 下の `setLoading(true)` で旧スコープ用のオーバーレイが出てしまう。
        if (!decideWrite().applyContent) return;

        if (
          painted !== "none" &&
          !shouldReadServerForScope({
            hasCachedData: true,
            scopeVersion: paintedVersion,
            // マーカー読みが応答しなかった場合は undefined のまま来る。null として
            // 扱えば「不一致 → サーバーを読む」に倒れるが、その手前で描画済みなら
            // 既に return しているため、ここへは何も描けていない場合しか来ない。
            currentDataVersion: currentVersion ?? null,
            stampedDocCount,
            cachedDocCount,
          })
        ) {
          if (decideWrite().applyError) {
            setError(null);
            errorScopeRef.current = cacheKey;
          }
          return;
        }

        // ── Phase 3: サーバー読み ────────────────────────────────
        // メモリから描いたが版が古かった場合、ディスクキャッシュも同じ版なので
        // 読み直さずサーバーへ行く（メモリの版は最後のサーバー読みの stamp と一致する）。
        //
        // オーバーレイは「描けるものが何も無かったとき」だけ出す。描画済みの上に
        // かぶせると、背景での再検証のたびに画面が覆われる（ADR の R2）。
        // 描画済みの間は fromCache が true のままなので、呼び出し側はそれを
        // 「更新中」の手がかりに使える。
        // 全件と分かっているものを描けていないなら、集計は出せない状態なので
        // 読み込み中として扱う。描画済みでも部分的なキャッシュしか無い場合を含む。
        if (!paintedComplete) setLoading(true);
        const serverResult = await withReadTimeout(
          getTransactionSnapshot(query, "server"),
        );
        if (serverResult === READ_TIMED_OUT) {
          // 失敗と同じ扱いにする。下の catch が受け、描画済みなら画面は据え置き、
          // 何も描けていなければエラーとして呼び出し側へ伝わる。
          throw new Error("取引のサーバー読み込みが応答しませんでした");
        }
        const serverSnap = serverResult;
        const serverItems =
          mapActiveTransactions(serverSnap?.docs ?? []);
        const version = currentVersion ?? null;
        transactionScopeCache.set(cacheKey, {
          items: serverItems,
          version,
          fromCache: false,
          epoch: getLocalWriteEpoch(householdId),
        });
        // 生のDoc件数を併記する。次回のキャッシュ読みでこれを下回っていれば、
        // 書き込みが無いのに手元が減った＝退避されたと判定できる（ADR の R3）。
        setPersistedScopeVersion(cacheKey, version, serverSnap?.docs.length);
        // サーバー読みを待っている間にスコープが変わっていることがある。キャッシュへの
        // 保存は上のとおりスコープ別なので通してよいが、画面へは反映しない。
        if (decideWrite().applyContent) {
          setData((prev) =>
            areTransactionListsEquivalent(prev, serverItems)
              ? prev
              : serverItems,
          );
          setFromCache(false);
          paintedScopeRef.current = cacheKey;
          // サーバーから読み切った直後なので、stamp の保存可否に関わらず全件である。
          setIsComplete(true);
          setError(null);
          errorScopeRef.current = cacheKey;
        }
      } catch (err) {
        // 何も描けていないときだけエラーを伝える。キャッシュから描画できている
        // 場合、背景の再検証が失敗しても画面をエラーへ切り替えない（ADR の R5）。
        // 更新できていないことは fromCache が true のままであることで表す。
        // 旧スコープの失敗を新スコープのエラーとして出さない。
        if (painted === "none" && decideWrite().applyError) {
          setError(err as Error);
          errorScopeRef.current = cacheKey;
        }
      } finally {
        const decision = decideWrite();
        // 解除は常に通す。stale を理由に飛ばすと、後続の読みが setLoading(true) を
        // 通らない経路へ入ったときにオーバーレイが残り続ける。
        if (decision.applyLoadingRelease) setLoading(false);
        // 逆に hasSettled は通さない。旧スコープの完了で確定させると、新スコープの
        // 読み込み中に空メッセージが出る（これが本修正の対象そのもの）。新スコープの
        // 読みが自分の finally で必ず立てる。
        if (decision.applySettled) {
          setHasSettled(true);
          settledScopeRef.current = cacheKey;
        }
        // 進行中フラグの解放と予約の実行は絶対に止めない。ここを飛ばすと固着する。
        inFlightRef.current = false;
        const pending = pendingReloadRef.current;
        pendingReloadRef.current = null;
        if (pending) {
          // 最新の load（=最新スコープ）で読み直す
          void loadRef.current?.(pending);
        }
      }
    },
    [householdId, orderByDateDesc, rangeFrom, rangeTo, scopeKey],
  );

  // 「最後に要求されたスコープ」と `load` の参照を**コミット時点で**同期する。
  //
  // `load` の中だけで更新すると間に合わない。スコープ B が React にコミットされてから
  // 副作用（`useEffect`）で `load` が呼ばれるまでの間に、進行中の A の await が解決すると、
  // A は自分を「まだ現在のスコープ」と判定して B の画面へ書き込んでしまう。
  // `useLayoutEffect` はコミットと同じタスク内で同期実行されるため、この隙間を塞げる。
  //
  // `loadRef` もここで更新する。レンダー中に代入すると、破棄された並行レンダーの
  // クロージャが残り、予約の再実行がコミットされていないスコープを読みにいく。
  const requestedCacheKey = householdId
    ? buildScopeCacheKey(householdId, scopeKey)
    : null;
  useLayoutEffect(() => {
    loadRef.current = load;
    requestedScopeRef.current = requestedCacheKey;
  }, [load, requestedCacheKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(() => {
    void load({ forceServer: true, refreshMarker: true });
  }, [load]);

  const refreshIfStale = useCallback(() => {
    void load({ refreshMarker: true });
  }, [load]);

  // 描画済みの内容が現在のスコープのものでない間は、外へ出さない。
  //
  // 命令的なクリアだけでは1フレーム漏れる。新しいスコープがコミットされてから
  // `useEffect` が `load` を呼ぶまでの間に React は描画するため、その1フレームは
  // 前のスコープの配列が出てしまう。ここで導出して塞ぐ。
  //
  // 内容・確定・エラーは別々の ref で判定する。ひとつにまとめてはいけない。
  // 何も描画できないまま失敗した場合、描画は起きないが確定とエラーは起きており、
  // 描画の有無でまとめてマスクすると画面が永久に確定しない。
  //
  // これらは ref だが、更新は必ず対応する setter と同時に行われるため、
  // レンダーごとの導出結果は状態と整合する。
  const paintedIsCurrent = paintedScopeRef.current === requestedCacheKey;
  const settledIsCurrent = settledScopeRef.current === requestedCacheKey;
  const errorIsCurrent = errorScopeRef.current === requestedCacheKey;

  return {
    // 参照を固定する。マスクのたびに新しい配列を返すと再描画が跳ねる。
    data: paintedIsCurrent ? data : EMPTY_TRANSACTIONS,
    loading,
    // 旧スコープの失敗を新スコープのエラーとして出さない。
    error: errorIsCurrent ? error : null,
    fromCache: paintedIsCurrent ? fromCache : false,
    hasSettled: settledIsCurrent ? hasSettled : false,
    // 別スコープの内容を出していない以上、集計に使ってよいとは言えない。
    isComplete: paintedIsCurrent ? isComplete : false,
    refresh,
    refreshIfStale,
  };
}
