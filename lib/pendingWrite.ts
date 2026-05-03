export type PendingWriteResult<T> =
  | { status: "acknowledged"; value: T }
  | { status: "queued" };

export async function waitForPendingWrite<T>(
  writePromise: Promise<T>,
  timeoutMs: number,
): Promise<PendingWriteResult<T>> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let timedOut = false;

  const guardedWrite = writePromise.then(
    (value) => ({ status: "acknowledged", value }) as const,
    (error) => {
      if (timedOut) {
        return { status: "queued" } as const;
      }
      throw error;
    },
  );

  try {
    return await Promise.race([
      guardedWrite,
      new Promise<PendingWriteResult<T>>((resolve) => {
        timer = setTimeout(() => {
          timedOut = true;
          resolve({ status: "queued" });
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
