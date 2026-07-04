import React, { useEffect, useRef, useState } from "react";
import { Animated, Modal, StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "@/hooks/useAppTheme";

export type ProgressOverlayProgress = {
  done: number;
  total: number;
};

type ProgressOverlayProps = {
  visible: boolean;
  message: string;
  /** 省略時は件数不明の処理として無限アニメーションのみ表示する。 */
  progress?: ProgressOverlayProgress | null;
};

const COIN_COUNT = 3;
const COIN_BOUNCE_HEIGHT = -12;
const COIN_BOUNCE_DURATION = 320;
const COIN_STAGGER = 140;
// キャッシュ即返し等の短時間ロードではModalを出さない。
// visible が数msでトグルすると iOS で透明なModalウィンドウが残留し、
// 以降のタッチを全部吸ってしまう既知の不具合があるため、
// 一定時間続いたロードだけ表示する。
const SHOW_DELAY_MS = 250;

/** 重たい処理中に表示する共通オーバーレイ。
 *  コインがコイン袋に向かって順番に跳ねるアニメーションで、
 *  progress を渡すと進捗バーと件数も表示する。 */
export default function ProgressOverlay({
  visible,
  message,
  progress,
}: ProgressOverlayProps) {
  const { colors } = useAppTheme();
  const coinAnims = useRef(
    Array.from({ length: COIN_COUNT }, () => new Animated.Value(0)),
  ).current;
  const bagAnim = useRef(new Animated.Value(0)).current;

  // 表示はディレイ後、非表示は即時。非表示時はModal自体をアンマウントする。
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!visible) {
      setShown(false);
      return;
    }
    const timer = setTimeout(() => setShown(true), SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [visible]);

  useEffect(() => {
    if (!shown) return;

    const coinLoops = coinAnims.map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * COIN_STAGGER),
          Animated.timing(value, {
            toValue: 1,
            duration: COIN_BOUNCE_DURATION,
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: COIN_BOUNCE_DURATION,
            useNativeDriver: true,
          }),
          Animated.delay((COIN_COUNT - 1 - index) * COIN_STAGGER),
        ]),
      ),
    );
    const bagLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bagAnim, {
          toValue: 1,
          duration: 480,
          useNativeDriver: true,
        }),
        Animated.timing(bagAnim, {
          toValue: 0,
          duration: 480,
          useNativeDriver: true,
        }),
      ]),
    );

    coinLoops.forEach((loop) => loop.start());
    bagLoop.start();
    return () => {
      coinLoops.forEach((loop) => loop.stop());
      bagLoop.stop();
      coinAnims.forEach((value) => value.setValue(0));
      bagAnim.setValue(0);
    };
  }, [shown, coinAnims, bagAnim]);

  const hasProgress = progress != null && progress.total > 0;
  const ratio = hasProgress ? Math.min(progress.done / progress.total, 1) : 0;
  const percent = Math.floor(ratio * 100);

  if (!shown) {
    return null;
  }

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {}}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.animationRow}>
            {coinAnims.map((value, index) => (
              <Animated.View
                key={index}
                style={[
                  styles.coin,
                  {
                    transform: [
                      {
                        translateY: value.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, COIN_BOUNCE_HEIGHT],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <Text style={styles.coinLabel}>¥</Text>
              </Animated.View>
            ))}
            <Animated.Text
              style={[
                styles.bag,
                {
                  transform: [
                    {
                      rotate: bagAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ["-6deg", "6deg"],
                      }),
                    },
                  ],
                },
              ]}
            >
              💰
            </Animated.Text>
          </View>

          <Text style={[styles.message, { color: colors.text }]}>
            {message}
          </Text>

          {hasProgress ? (
            <>
              <View
                style={[styles.barTrack, { backgroundColor: colors.track }]}
              >
                <View
                  style={[
                    styles.barFill,
                    { backgroundColor: colors.tint, width: `${percent}%` },
                  ]}
                />
              </View>
              <Text style={[styles.progressText, { color: colors.subText }]}>
                {progress.done.toLocaleString("ja-JP")} /{" "}
                {progress.total.toLocaleString("ja-JP")}件（{percent}%）
              </Text>
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  card: {
    minWidth: 240,
    maxWidth: 320,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 24,
    paddingHorizontal: 28,
    alignItems: "center",
  },
  animationRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 14,
  },
  // 金貨の絵文字は存在しないため、金色の円＋¥で描画する。
  coin: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#FFD54F",
    borderWidth: 2,
    borderColor: "#E0A82E",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 3,
  },
  coinLabel: {
    color: "#8B6914",
    fontSize: 12,
    fontWeight: "800",
  },
  bag: {
    fontSize: 30,
    marginLeft: 8,
  },
  message: {
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
  barTrack: {
    alignSelf: "stretch",
    height: 8,
    borderRadius: 4,
    marginTop: 16,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    marginTop: 8,
  },
});
