import assert from "node:assert/strict";
import test from "node:test";

import {
    defaultPlanProfile,
    normalizePlanProfilePayload,
    type PlanProfilePayload,
} from "@/lib/simulation/planProfile";

test("normalizePlanProfilePayload keeps valid fields", () => {
  const input: PlanProfilePayload = {
    startYear: "2026",
    years: "30",
    initialBalance: "1000000",
    annualIncome: "5000000",
    annualExpense: "3000000",
    children: [
      {
        id: 1,
        name: "長女",
        birthDate: "2019-04-01",
        schoolPlan: {
          preschool: "private",
          elementary: "public",
          middle: "public",
          high: "private",
          university: "private",
        },
      },
    ],
    assumptionRates: {
      incomeGrowthRate: "1.2",
      expenseInflationRate: "2.0",
      assetReturnRate: "1.5",
    },
    isInputSectionOpen: true,
    isEducationSectionOpen: true,
    isCarSectionOpen: false,
    isHousingSectionOpen: false,
  };

  const normalized = normalizePlanProfilePayload(
    input,
    defaultPlanProfile(2026),
  );
  assert.equal(normalized.startYear, "2026");
  assert.equal(normalized.children.length, 1);
  assert.equal(normalized.children[0].schoolPlan.preschool, "private");
  assert.equal(normalized.isEducationSectionOpen, true);
});

test("normalizePlanProfilePayload falls back for invalid fields", () => {
  const fallback = defaultPlanProfile(2026);
  const normalized = normalizePlanProfilePayload(
    {
      startYear: 123,
      children: [{ id: "x", schoolPlan: { preschool: "invalid" } }],
      assumptionRates: { incomeGrowthRate: 2 },
    },
    fallback,
  );

  assert.deepEqual(normalized, fallback);
});
