export type AppCheckReadiness = {
  ready: true;
  error: unknown | null;
};

export async function waitForAppCheckReadiness(
  initialize: () => Promise<void>,
): Promise<AppCheckReadiness> {
  try {
    await initialize();
    return { ready: true, error: null };
  } catch (error) {
    return { ready: true, error };
  }
}
