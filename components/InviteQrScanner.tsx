import { CameraView, useCameraPermissions } from "expo-camera";
import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { parseScannedInviteCode } from "@/lib/inviteQr";

export type InviteQrScannerProps = {
  visible: boolean;
  onClose: () => void;
  onScanned: (code: string) => void;
};

/** 招待コードQRの読み取りモーダル。
 *  expo-camera（ネイティブモジュール）に依存するため、呼び出し側は
 *  旧ビルド対策として本コンポーネントを遅延require()すること（household.tsx参照）。 */
export default function InviteQrScanner({
  visible,
  onClose,
  onScanned,
}: InviteQrScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [invalidMessage, setInvalidMessage] = useState<string | null>(null);
  const handledRef = useRef(false);
  const invalidTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) return;
    handledRef.current = false;
    setInvalidMessage(null);
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [visible, permission, requestPermission]);

  useEffect(() => {
    return () => {
      if (invalidTimerRef.current) clearTimeout(invalidTimerRef.current);
    };
  }, []);

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (handledRef.current) return;
    const code = parseScannedInviteCode(data);
    if (code) {
      handledRef.current = true;
      onScanned(code);
      return;
    }
    if (invalidTimerRef.current) clearTimeout(invalidTimerRef.current);
    setInvalidMessage("招待コードのQRコードではありません");
    invalidTimerRef.current = setTimeout(() => setInvalidMessage(null), 2000);
  };

  if (!visible) return null;

  return (
    <Modal visible transparent={false} animationType="slide">
      <View style={styles.container}>
        {permission?.granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={handleBarcodeScanned}
          />
        ) : (
          <View style={styles.permissionWrap}>
            <Text style={styles.permissionText}>
              {permission && !permission.canAskAgain
                ? "カメラへのアクセスが許可されていません。iPhoneの設定アプリからこのアプリのカメラを許可してください。"
                : "QRコードの読み取りにはカメラの許可が必要です"}
            </Text>
            {permission?.canAskAgain !== false ? (
              <Pressable
                style={styles.permissionButton}
                onPress={() => void requestPermission()}
              >
                <Text style={styles.permissionButtonText}>カメラを許可</Text>
              </Pressable>
            ) : null}
          </View>
        )}

        <View style={styles.overlayTop}>
          <Text style={styles.instructionText}>
            招待コードのQRコードを写してください
          </Text>
          {invalidMessage ? (
            <Text style={styles.invalidText}>{invalidMessage}</Text>
          ) : null}
        </View>

        <View style={styles.overlayBottom}>
          <Pressable style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>キャンセル</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  permissionWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  permissionText: {
    color: "#FFFFFF",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 20,
  },
  permissionButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  permissionButtonText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "600",
  },
  overlayTop: {
    position: "absolute",
    top: 80,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 24,
  },
  instructionText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowRadius: 4,
  },
  invalidText: {
    color: "#FFD54F",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 12,
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowRadius: 4,
  },
  overlayBottom: {
    position: "absolute",
    bottom: 60,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  cancelButtonText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "600",
  },
});
