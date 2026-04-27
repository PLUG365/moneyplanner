export type AppCheckProviderOptions = {
  android: {
    provider: "debug" | "playIntegrity";
    debugToken?: string;
  };
  apple: {
    provider:
      | "debug"
      | "deviceCheck"
      | "appAttest"
      | "appAttestWithDeviceCheckFallback";
    debugToken?: string;
  };
};

export function buildAppCheckProviderOptions(
  isDevelopment: boolean,
  debugToken?: string,
): AppCheckProviderOptions {
  const normalizedDebugToken = debugToken?.trim() || undefined;

  if (isDevelopment) {
    return {
      android: {
        provider: "debug",
        ...(normalizedDebugToken ? { debugToken: normalizedDebugToken } : {}),
      },
      apple: {
        provider: "debug",
        ...(normalizedDebugToken ? { debugToken: normalizedDebugToken } : {}),
      },
    };
  }

  return {
    android: { provider: "playIntegrity" },
    apple: { provider: "appAttestWithDeviceCheckFallback" },
  };
}
