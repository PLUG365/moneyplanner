import assert from "node:assert/strict";
import test from "node:test";

import {
  MIN_PERIOD_NAV_TOUCH_TARGET,
  SUMMARY_PERIOD_NAV_LAYOUT,
} from "./summaryPeriodNav";

test("summary period navigation keeps side buttons tappable without making the title consume spacer taps", () => {
  assert.equal(SUMMARY_PERIOD_NAV_LAYOUT.titleConsumesFlexibleSpace, false);
  assert.ok(
    SUMMARY_PERIOD_NAV_LAYOUT.sideButtonSize >= MIN_PERIOD_NAV_TOUCH_TARGET,
  );
  assert.ok(
    SUMMARY_PERIOD_NAV_LAYOUT.titleMinHeight >= MIN_PERIOD_NAV_TOUCH_TARGET,
  );
});
