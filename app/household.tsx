import { InviteQrCode } from "@/components/InviteQrCode";
import { type InviteQrScannerProps } from "@/components/InviteQrScanner";
import { useAppTheme } from "@/hooks/useAppTheme";
import {
    cancelJoinRequest,
    clearPendingHouseholdId,
    completeJoinAfterApproval,
    createHousehold,
    getPendingHouseholdId,
    requestJoinHousehold,
    watchJoinRequestApproval,
} from "@/lib/household";
import { validateJoinDisplayName } from "@/lib/householdJoinRequestValidation";
import { router } from "expo-router";
import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type ComponentType,
} from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

function resolveHouseholdErrorMessage(error: unknown): string {
  const code =
    typeof error === "object" &&
    error !== null &&
    typeof (error as { code?: unknown }).code === "string"
      ? String((error as { code?: unknown }).code)
      : "";

  const message =
    error instanceof Error
      ? String(error.message ?? "")
      : typeof error === "object" &&
          error !== null &&
          typeof (error as { message?: unknown }).message === "string"
        ? String((error as { message?: unknown }).message)
        : "不明なエラーが発生しました";

  if (/permission[-_ ]denied|PERMISSION_DENIED/i.test(`${code} ${message}`)) {
    return "参加リクエストの送信に失敗しました。作成者側の設定画面で参加リクエスト状態を確認し、必要なら招待コードを再発行してから再試行してください。";
  }

  return message;
}

export default function HouseholdScreen() {
  const [mode, setMode] = useState<"choose" | "join" | "waiting">("choose");
  const [inviteCode, setInviteCode] = useState("");
  const [createDisplayName, setCreateDisplayName] = useState("");
  const [joinDisplayName, setJoinDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingPending, setCheckingPending] = useState(true);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [pendingHouseholdId, setPendingHouseholdId] = useState<string | null>(
    null,
  );
  const [scannerVisible, setScannerVisible] = useState(false);
  const [ScannerComponent, setScannerComponent] =
    useState<ComponentType<InviteQrScannerProps> | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const { colors } = useAppTheme();

  const stopWatching = useCallback(() => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
  }, []);

  const startWatching = useCallback(
    (householdId: string, fallbackDisplayName: string) => {
      stopWatching();
      unsubscribeRef.current = watchJoinRequestApproval(
        householdId,
        async (approvedDisplayName) => {
          stopWatching();
          setLoading(true);
          try {
            await completeJoinAfterApproval(
              householdId,
              approvedDisplayName || fallbackDisplayName,
            );
            router.replace("/(tabs)");
          } catch (error: unknown) {
            Alert.alert("エラー", resolveHouseholdErrorMessage(error));
          } finally {
            setLoading(false);
          }
        },
        async () => {
          stopWatching();
          setPendingHouseholdId(null);
          setMode("choose");
          await clearPendingHouseholdId().catch(() => undefined);
          Alert.alert(
            "参加リクエストが却下されました",
            "別の招待コードで再度お試しください。",
          );
        },
        async () => {
          stopWatching();
          setPendingHouseholdId(null);
          setMode("choose");
          await clearPendingHouseholdId().catch(() => undefined);
        },
      );
    },
    [stopWatching],
  );

  useEffect(() => {
    let mounted = true;

    const restorePendingRequest = async () => {
      const householdId = await getPendingHouseholdId().catch(() => null);
      if (!mounted || !householdId) return;

      setPendingHouseholdId(householdId);
      setMode("waiting");
      startWatching(householdId, "");
      if (mounted) setCheckingPending(false);
    };

    restorePendingRequest().finally(() => {
      if (mounted) setCheckingPending(false);
    });

    return () => {
      mounted = false;
      stopWatching();
    };
  }, [startWatching, stopWatching]);

  const blockIfPending = (): boolean => {
    if (checkingPending) return true;
    if (!pendingHouseholdId) return false;

    Alert.alert(
      "参加リクエスト送信中",
      "承認待ちの参加リクエストがあります。承認されるまでお待ちください。",
    );
    return true;
  };

  const handleCreate = async () => {
    if (blockIfPending()) return;

    const validationError = validateJoinDisplayName(createDisplayName);
    if (validationError) {
      Alert.alert("入力エラー", validationError);
      return;
    }

    setLoading(true);
    try {
      const code = await createHousehold(createDisplayName);
      setCreatedCode(code);
    } catch (error: unknown) {
      Alert.alert("エラー", resolveHouseholdErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (blockIfPending()) return;

    if (inviteCode.trim().length === 0) {
      Alert.alert("入力エラー", "招待コードを入力してください");
      return;
    }
    const validationError = validateJoinDisplayName(joinDisplayName);
    if (validationError) {
      Alert.alert("入力エラー", validationError);
      return;
    }

    setLoading(true);
    try {
      const householdId = await requestJoinHousehold(
        inviteCode,
        joinDisplayName,
      );
      const fallbackDisplayName = joinDisplayName;
      setInviteCode("");
      setJoinDisplayName("");
      setPendingHouseholdId(householdId);
      setMode("waiting");
      startWatching(householdId, fallbackDisplayName);
    } catch (error: unknown) {
      Alert.alert("エラー", resolveHouseholdErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleCancelJoinRequest = () => {
    if (!pendingHouseholdId) return;

    Alert.alert(
      "参加リクエストをキャンセル",
      "承認待ちの参加リクエストを取り消しますか？",
      [
        { text: "戻る", style: "cancel" },
        {
          text: "キャンセルする",
          style: "destructive",
          onPress: async () => {
            const householdId = pendingHouseholdId;
            stopWatching();
            setLoading(true);
            try {
              await cancelJoinRequest(householdId);
              setPendingHouseholdId(null);
              setMode("choose");
            } catch (error: unknown) {
              Alert.alert("エラー", resolveHouseholdErrorMessage(error));
              startWatching(householdId, "");
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleContinue = () => {
    router.replace("/(tabs)");
  };

  const handleOpenScanner = () => {
    try {
      // expo-camera未同梱の旧ビルドでモジュール解決クラッシュしないよう、
      // スキャナー（ネイティブ依存）はボタン押下時に遅延ロードする
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const scannerModule = require("@/components/InviteQrScanner") as {
        default: ComponentType<InviteQrScannerProps>;
      };
      setScannerComponent(() => scannerModule.default);
      setScannerVisible(true);
    } catch {
      Alert.alert(
        "QR読み取り",
        "この機能を使うには、新しいアプリビルド（dev-client/TestFlightの更新）が必要です",
      );
    }
  };

  const handleScannedInviteCode = (code: string) => {
    setInviteCode(code);
    setScannerVisible(false);
  };

  if (checkingPending) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  if (createdCode) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.text }]}>
          世帯を作成しました
        </Text>
        <Text style={[styles.subtitle, { color: colors.subText }]}>
          家族にこの招待コードを共有してください
        </Text>
        <View
          style={[
            styles.codeBox,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.code, { color: colors.tint }]}>
            {createdCode}
          </Text>
        </View>
        <View style={[styles.qrWrap, { borderColor: colors.border }]}>
          <InviteQrCode value={createdCode} size={180} />
        </View>
        <Text style={[styles.qrNote, { color: colors.subText }]}>
          参加側の「QRコードを読み取る」でこのQRを読み取れます
        </Text>
        <Pressable
          style={[styles.button, { backgroundColor: colors.tint }]}
          onPress={handleContinue}
        >
          <Text style={styles.buttonText}>はじめる</Text>
        </Pressable>
      </View>
    );
  }

  if (mode === "waiting") {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator
          size="large"
          color={colors.tint}
          style={{ marginBottom: 24 }}
        />
        <Text style={[styles.title, { color: colors.text }]}>承認待ち</Text>
        <Text style={[styles.subtitle, { color: colors.subText }]}>
          世帯メンバーが参加リクエストを承認するまでお待ちください。承認されると自動的に参加完了します。
        </Text>
        {loading ? null : (
          <>
            <Text style={[styles.waitingNote, { color: colors.subText }]}>
              この画面を閉じても、次回起動時に承認待ち状態を再開します。
            </Text>
            <Pressable
              onPress={handleCancelJoinRequest}
              style={styles.linkButton}
            >
              <Text style={[styles.linkText, { color: colors.tint }]}>
                申請をキャンセル
              </Text>
            </Pressable>
          </>
        )}
      </View>
    );
  }

  if (mode === "join") {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.text }]}>世帯に参加</Text>
        <Text style={[styles.subtitle, { color: colors.subText }]}>
          家族から受け取った招待コードを入力してください
        </Text>
        <TextInput
          style={[
            styles.nicknameInput,
            {
              color: colors.text,
              borderColor: colors.border,
              backgroundColor: colors.card,
            },
          ]}
          value={joinDisplayName}
          onChangeText={setJoinDisplayName}
          placeholder="ニックネーム（20文字以内）"
          placeholderTextColor={colors.subText}
          maxLength={20}
        />
        <TextInput
          style={[
            styles.input,
            {
              color: colors.text,
              borderColor: colors.border,
              backgroundColor: colors.card,
            },
          ]}
          value={inviteCode}
          onChangeText={setInviteCode}
          placeholder="招待コード（6〜10桁）"
          placeholderTextColor={colors.subText}
          autoCapitalize="characters"
          maxLength={10}
        />
        {loading ? (
          <ActivityIndicator
            size="large"
            color={colors.tint}
            style={{ marginTop: 24 }}
          />
        ) : (
          <>
            <Pressable
              style={[styles.outlineButton, { borderColor: colors.tint }]}
              onPress={handleOpenScanner}
            >
              <Text style={[styles.outlineButtonText, { color: colors.tint }]}>
                QRコードを読み取る
              </Text>
            </Pressable>
            <Pressable
              style={[styles.button, { backgroundColor: colors.tint }]}
              onPress={handleJoin}
            >
              <Text style={styles.buttonText}>参加する</Text>
            </Pressable>
            <Pressable
              onPress={() => setMode("choose")}
              style={styles.linkButton}
            >
              <Text style={[styles.linkText, { color: colors.tint }]}>
                戻る
              </Text>
            </Pressable>
          </>
        )}
        {ScannerComponent ? (
          <ScannerComponent
            visible={scannerVisible}
            onClose={() => setScannerVisible(false)}
            onScanned={handleScannedInviteCode}
          />
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>世帯を設定</Text>
      <Text style={[styles.subtitle, { color: colors.subText }]}>
        家計簿データは世帯単位で共有されます
      </Text>
      <TextInput
        style={[
          styles.nicknameInput,
          {
            color: colors.text,
            borderColor: colors.border,
            backgroundColor: colors.card,
          },
        ]}
        value={createDisplayName}
        onChangeText={setCreateDisplayName}
        placeholder="ニックネーム（20文字以内）"
        placeholderTextColor={colors.subText}
        maxLength={20}
      />

      {loading ? (
        <ActivityIndicator
          size="large"
          color={colors.tint}
          style={{ marginTop: 24 }}
        />
      ) : (
        <>
          <Pressable
            style={[styles.button, { backgroundColor: colors.tint }]}
            onPress={handleCreate}
          >
            <Text style={styles.buttonText}>新しい世帯を作成</Text>
          </Pressable>
          <Pressable
            style={[styles.outlineButton, { borderColor: colors.tint }]}
            onPress={() => setMode("join")}
          >
            <Text style={[styles.outlineButtonText, { color: colors.tint }]}>
              招待コードで参加
            </Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 22,
  },
  waitingNote: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
    maxWidth: 280,
  },
  codeBox: {
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 16,
    marginBottom: 16,
  },
  qrWrap: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 8,
  },
  qrNote: {
    fontSize: 12,
    textAlign: "center",
    marginBottom: 24,
  },
  code: {
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: 6,
  },
  input: {
    width: "100%",
    maxWidth: 280,
    height: 52,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 20,
    textAlign: "center",
    letterSpacing: 2,
    marginBottom: 10,
  },
  nicknameInput: {
    width: "100%",
    maxWidth: 280,
    height: 52,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    textAlign: "left",
    letterSpacing: 0,
    marginBottom: 10,
  },
  button: {
    width: 280,
    height: 52,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
  },
  outlineButton: {
    width: 280,
    height: 52,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
  },
  outlineButtonText: {
    fontSize: 17,
    fontWeight: "600",
  },
  linkButton: {
    marginTop: 16,
    padding: 8,
  },
  linkText: {
    fontSize: 15,
  },
});
