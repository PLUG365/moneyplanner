import assert from "node:assert/strict";
import test from "node:test";

import { defaultThemeId, isThemeId, THEME_IDS, THEMES } from "../constants/Themes";
import {
    parseThemePreference,
    serializeThemePreference,
} from "./themePreferenceFormat";

function luminance(hex: string): number {
  const c = hex.replace("#", "");
  const channel = (i: number) => {
    const v = parseInt(c.substring(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

function contrastRatio(a: string, b: string): number {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

test("all themes meet contrast requirements", () => {
  for (const theme of Object.values(THEMES)) {
    for (const surface of [theme.background, theme.card]) {
      assert.ok(
        contrastRatio(theme.text, surface) >= 7,
        `${theme.id}: text on ${surface}`,
      );
      assert.ok(
        contrastRatio(theme.subText, surface) >= 4.5,
        `${theme.id}: subText on ${surface}`,
      );
      for (const accent of [
        theme.tint,
        theme.income,
        theme.expense,
        theme.warning,
        theme.exceeded,
        theme.safe,
      ]) {
        assert.ok(
          contrastRatio(accent, surface) >= 3.5,
          `${theme.id}: accent ${accent} on ${surface}`,
        );
      }
    }
    // ボタン上の白文字（tint/income/expense背景）
    if (theme.mode === "light") {
      for (const buttonBg of [theme.tint, theme.income, theme.expense]) {
        assert.ok(
          contrastRatio("#FFFFFF", buttonBg) >= 3,
          `${theme.id}: white text on ${buttonBg}`,
        );
      }
    }
  }
});

test("theme ids are valid and default follows system scheme", () => {
  assert.equal(THEME_IDS.length, 4);
  for (const id of THEME_IDS) {
    assert.equal(isThemeId(id), true);
    assert.equal(THEMES[id].id, id);
  }
  assert.equal(isThemeId("sepia"), false);
  assert.equal(defaultThemeId("dark"), "peony-dark");
  assert.equal(defaultThemeId("light"), "peony-light");
  assert.equal(defaultThemeId(null), "peony-light");
});

test("theme preference serialization round-trips and rejects invalid input", () => {
  assert.equal(
    parseThemePreference(serializeThemePreference("lavender-dark")),
    "lavender-dark",
  );
  assert.equal(parseThemePreference(null), null);
  assert.equal(parseThemePreference("not json"), null);
  assert.equal(parseThemePreference('{"themeId":"sepia"}'), null);
});
