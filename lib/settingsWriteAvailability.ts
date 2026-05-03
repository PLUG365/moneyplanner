export type SettingsWriteAvailability = {
  canWrite: boolean;
  reason: "offline" | null;
};

export function getSettingsWriteAvailability(input: {
  settingsDataFromCache: boolean;
}): SettingsWriteAvailability {
  if (input.settingsDataFromCache) {
    return { canWrite: false, reason: "offline" };
  }

  return { canWrite: true, reason: null };
}
