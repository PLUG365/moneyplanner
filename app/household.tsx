import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { createHousehold, requestJoinHousehold } from "@/lib/household";
import { validateJoinDisplayName } from "@/lib/householdJoinRequestValidation";
import { router } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

export default function HouseholdScreen() {
  const [mode, setMode] = useState<"choose" | "join">("choose");
  const [inviteCode, setInviteCode] = useState("");
  const [createDisplayName, setCreateDisplayName] = useState("");
  const [joinDisplayName, setJoinDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];

  const handleCreate = async () => {
    const validationError = validateJoinDisplayName(createDisplayName);
    if (validationError) {
      Alert.alert("入力エラー", validationError);
      return;
    }

    setLoading(true);
    try {
      const code = await createHousehold(createDisplayName);
      setCreatedCode(code);
    } catch (e: any) {
      Alert.alert("エラー", e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
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
      await requestJoinHousehold(inviteCode, joinDisplayName);
      Alert.alert(
        "参加リクエストを送信しました",
        "世帯メンバーの承認後に参加できます。承認されるまでお待ちください。",
      );
      setInviteCode("");
      setJoinDisplayName("");
      setMode("choose");
    } catch (e: any) {
      Alert.alert("エラー", e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    router.replace("/(tabs)");
  };

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
        <Pressable
          style={[styles.button, { backgroundColor: colors.tint }]}
          onPress={handleContinue}
        >
          <Text style={styles.buttonText}>はじめる</Text>
        </Pressable>
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
          placeholder="招待コード（6桁）"
          placeholderTextColor={colors.subText}
          autoCapitalize="characters"
          maxLength={6}
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
  codeBox: {
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 16,
    marginBottom: 32,
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
