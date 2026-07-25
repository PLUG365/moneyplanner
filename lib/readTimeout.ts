/**
 * サーバー読み取りに上限時間を設ける（ADR の O-3）。
 *
 * 目的は**固着の回避だけ**であり、表示を速くするためのものではない。
 *
 * 両フックは `inFlightRef` で読み込みを直列化している。`getDocsFromServer` 相当の
 * 読み取りは、完全なオフラインなら即座に失敗するが、**電波が中途半端なときは
 * 応答も失敗もせずに待ち続けることがある**。そうなると `inFlightRef` が立ったままになり、
 * 以降の読み込み要求は予約キューに積まれるだけで実行されない。画面にはキャッシュが
 * 描画済みなので一見正常に見えるまま、年の切り替えや検索の適用が無反応になる。
 *
 * 書き込み側には既に `lib/pendingWrite.ts` の `waitForPendingWrite` があり、
 * 「一定時間で待つのをやめる」方針が取られている。読み取り側にも同じ考え方を入れる。
 *
 * 上限に達した場合、Firestore 側の処理は中断されない（キャンセル手段が無い）。
 * 遅れて届いた結果は破棄する。破棄する際に失敗が未処理の Promise 拒否にならないよう、
 * `waitForPendingWrite` と同じくフラグで吸収する。
 */

/** 上限時間に達したことを表す。呼び出し側はこれを見て挙動を決める。 */
export const READ_TIMED_OUT = Symbol("read-timed-out");

/**
 * 固着回避のための上限時間。
 *
 * **短くしすぎないこと。** これは遅い回線を諦めるための値ではなく、応答が返らない
 * 状態から復帰するための値である。短いと、時間はかかるが成功したはずの読み取りを
 * 捨ててしまい、遅い回線でいつまでも最新化されなくなる。
 */
export const SERVER_READ_TIMEOUT_MS = 15000;

export async function withReadTimeout<T>(
  readPromise: Promise<T>,
  timeoutMs: number = SERVER_READ_TIMEOUT_MS,
): Promise<T | typeof READ_TIMED_OUT> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let timedOut = false;

  // 上限に達したあとで届いた失敗を、未処理の Promise 拒否にしない。
  // 型注釈を明示しないと、READ_TIMED_OUT が unique symbol から symbol へ広がる。
  const guardedRead: Promise<T | typeof READ_TIMED_OUT> = readPromise.then(
    (value) => value,
    (error: unknown) => {
      if (timedOut) return READ_TIMED_OUT;
      throw error;
    },
  );

  try {
    return await Promise.race<T | typeof READ_TIMED_OUT>([
      guardedRead,
      new Promise<typeof READ_TIMED_OUT>((resolve) => {
        timer = setTimeout(() => {
          timedOut = true;
          resolve(READ_TIMED_OUT);
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
