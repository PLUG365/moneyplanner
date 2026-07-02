import { useMemo } from "react";
import { View } from "react-native";

import { buildInviteQrMatrix } from "@/lib/inviteQr";

type InviteQrCodeProps = {
  value: string;
  /** QR全体（クワイエットゾーン込み）の一辺のサイズ */
  size?: number;
};

/** 招待コードをQRコードとして描画する。
 *  純JS実装（qrcode-generator + Viewグリッド）のためネイティブ依存はなく、
 *  既存ビルドのdev-clientでもそのまま表示できる。
 *  ダークテーマでも読み取れるよう、背景は常に白・モジュールは常に黒で描く。 */
export function InviteQrCode({ value, size = 220 }: InviteQrCodeProps) {
  const matrix = useMemo(() => buildInviteQrMatrix(value), [value]);
  const quietModules = 4; // QR規格のクワイエットゾーン（4モジュール）
  const cellSize = size / (matrix.length + quietModules * 2);
  const quietZone = cellSize * quietModules;

  return (
    <View
      style={{
        width: size,
        height: size,
        backgroundColor: "#FFFFFF",
        padding: quietZone,
      }}
      accessibilityLabel={`招待コード ${value} のQRコード`}
    >
      {matrix.map((row, rowIndex) => (
        <View key={rowIndex} style={{ flexDirection: "row" }}>
          {row.map((dark, colIndex) => (
            <View
              key={colIndex}
              style={{
                width: cellSize,
                height: cellSize,
                backgroundColor: dark ? "#000000" : "#FFFFFF",
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}
