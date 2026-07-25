/**
 * 取引の読み取り順序と、その結果をどう扱ってよいかの判定。
 *
 * `docs/decisions/initial-render-latency-version-check.md` の案B・R8・R10 に対応する。
 * 案Bの本体は「マーカーのサーバー往復を初回描画の前から後ろへ移す」ことであり、
 * その順序と分岐をフックに埋め込むとユニットテストが書けない。判断だけをここへ
 * 切り出し、フック側は結果に従って読むだけにする。
 *
 * `lib/readFreshness.ts` の `shouldReadServerForScope`（サーバー再読込の要否）とは
 * 役割が別。あちらは「鮮度」、こちらは「順序」と「その結果の扱い方」を決める。
 */

/**
 * 初回描画に使う供給元。
 * `"none"` は「まだ描画してよいものが無い」＝サーバー読みの完了を待つ。
 */
export type FirstPaintSource = "memory" | "cache" | "none";

/** 読み取り結果の供給元。`FirstPaintSource` にサーバー読みを加えたもの。 */
export type ReadSource = FirstPaintSource | "server";

/**
 * 初回描画をどこから行うかを決める。
 *
 * 案B適用後は、この判断がマーカーのサーバー読みより前に行われる。つまり
 * 「鮮度が確定していない状態で、まず何を出すか」を決める関数である。
 *
 * - `forceServer`（pull-to-refresh）はユーザーが明示的に最新を求めた操作なので、
 *   キャッシュを飛ばしてサーバー読みを待たせる
 * - メモリキャッシュは、端末自身の書き込み後に無効化済みであることが前提
 *   （`lib/localWriteEpoch.ts`。呼び出し側が `hasUsableMemory` に反映する）
 * - ディスクキャッシュは0件だと「世帯が空」と「未キャッシュ」を区別できないため、
 *   描画せずサーバー読みを待つ
 */
export function pickFirstPaintSource(input: {
  forceServer: boolean;
  hasUsableMemory: boolean;
  /** ディスクキャッシュ読みで得た生のDoc件数（ソフトデリート除外前）。 */
  cachedDocCount: number;
}): FirstPaintSource {
  if (input.forceServer) return "none";
  if (input.hasUsableMemory) return "memory";
  if (input.cachedDocCount > 0) return "cache";
  return "none";
}

/**
 * 「0件と確定してよいか」＝空メッセージを表示してよいかを決める（Issue #9）。
 *
 * 「読み込み中か」とは別の状態である。`loading` は `ProgressOverlay` を駆動する
 * ため、空メッセージの判定に流用すると年切替のたびにオーバーレイが点滅する。
 *
 * ディスクキャッシュ0件では「世帯が空」と「未キャッシュ」を区別できないので、
 * サーバー読みが返るまで確定させない。
 */
export function resolveHasSettled(input: {
  paintedSource: FirstPaintSource;
  serverReadDone: boolean;
}): boolean {
  if (input.serverReadDone) return true;
  return input.paintedSource !== "none";
}

/**
 * いま手元にある配列が「現在の日付範囲に対する全件」か（R8）。
 *
 * 検索結果の合計を表示してよいかの判定に使う。部分集計を全体の合計として
 * 表示することは、本アプリで最も避けるべき誤りであるため、判定は保守的に倒す。
 *
 * **stamp の有無だけで判定してはならない。** 理由は2つある。
 *
 * - `lib/scopeVersionStore.ts` の `setPersistedScopeVersion` は `version == null` を
 *   記録しない。マーカーDocが未作成の世帯やオフライン初回では stamp が永久に
 *   残らず、stampを必要条件にすると合計が一度も表示されない（R8）
 * - `page` モードのスコープは `limit()` 付きの部分読みなのに stamp される。
 *   stampを十分条件にすると、部分読みを完全と誤認する（R6-b）
 *
 * したがって「全件読みのスコープであること」を前提に、供給元ごとに判定する。
 */
export function isReadComplete(input: {
  /** 全件読み（`all` モード＝`limit` なし）のスコープか。 */
  isFetchAllScope: boolean;
  source: ReadSource;
  /**
   * memory / cache から供給する場合に、そのスコープが過去に全件読みされたと
   * 分かっているか（stamp と件数の照合結果を呼び出し側で解決して渡す）。
   */
  scopeKnownComplete: boolean;
}): boolean {
  // ページング読みは定義上ここに来ないが、来ても完全とは扱わない（R6-b）。
  if (!input.isFetchAllScope) return false;
  // 全件サーバー読みの直後は、stamp の成否と無関係にその配列は完全（R8）。
  if (input.source === "server") return true;
  if (input.source === "none") return false;
  return input.scopeKnownComplete;
}
