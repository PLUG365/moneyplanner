import { useAppTheme } from "@/hooks/useAppTheme";
import { signInWithApple } from "@/lib/auth";
import * as AppleAuthentication from "expo-apple-authentication";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  View,
} from "react-native";

const appIcon = require("@/assets/images/icon.png");

export default function AuthScreen() {
  const [loading, setLoading] = useState(false);
  const { colors } = useAppTheme();

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
      <View style={styles.brandArea}>
        <View style={styles.brandBlock}>
          <Image
            source={appIcon}
            style={styles.appIcon}
            accessibilityLabel="NANBO"
          />
          <Text style={[styles.appName, { color: colors.text }]}>NANBO</Text>
          <Text style={[styles.subtitle, { color: colors.subText }]}>みんなの家計簿</Text>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
      </View>

      <View style={styles.actionArea}>
        <View
          style={styles.appleButtonContainer}
          pointerEvents={loading ? "none" : "auto"}
          accessibilityState={{ busy: loading, disabled: loading }}
        >
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={
              AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
            }
            buttonStyle={
              colors.mode === "dark"
                ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
            }
            cornerRadius={12}
            style={styles.appleButton}
            onPress={handleSignIn}
            accessibilityState={{ busy: loading, disabled: loading }}
          />
          {loading && (
            <View style={styles.loadingOverlay} pointerEvents="none">
              <ActivityIndicator size="small" color={colors.tint} />
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 48,
    paddingBottom: 40,
  },
  brandArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  brandBlock: {
    alignItems: "center",
  },
  appIcon: {
    width: 104,
    height: 104,
    borderRadius: 24,
    marginBottom: 24,
  },
  appName: {
    fontSize: 30,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 15,
    marginTop: 8,
  },
  divider: {
    width: 96,
    height: StyleSheet.hairlineWidth,
    marginTop: 40,
  },
  actionArea: {
    height: 56,
    justifyContent: "center",
    alignItems: "center",
  },
  appleButtonContainer: {
    width: 280,
    height: 52,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  appleButton: {
    width: 280,
    height: 52,
  },
});
