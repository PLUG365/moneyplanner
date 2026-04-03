import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { signInWithApple } from "@/lib/auth";
import * as AppleAuthentication from "expo-apple-authentication";
import { useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";

export default function AuthScreen() {
  const [loading, setLoading] = useState(false);
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];

  const handleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithApple();
    } catch (e: any) {
      if (e.code !== "ERR_REQUEST_CANCELED") {
        Alert.alert("ログインエラー", e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.appName, { color: colors.tint }]}>moneyplanner</Text>
      <Text style={[styles.subtitle, { color: colors.subText }]}>
        世帯の家計簿を家族で共有
      </Text>

      <View style={styles.buttonContainer}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.tint} />
        ) : (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={
              AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
            }
            buttonStyle={
              colorScheme === "dark"
                ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
            }
            cornerRadius={12}
            style={styles.appleButton}
            onPress={handleSignIn}
          />
        )}
      </View>
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
  appName: {
    fontSize: 32,
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 48,
  },
  buttonContainer: {
    height: 56,
    justifyContent: "center",
  },
  appleButton: {
    width: 280,
    height: 52,
  },
});
