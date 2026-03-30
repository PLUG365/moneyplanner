import {
    getPublicDefaultsUpdatedLabel,
    isPublicDefaultsUpdateDue,
    PUBLIC_DEFAULT_ADDITIONAL_CHILD_COSTS,
    PUBLIC_DEFAULT_ASSUMPTIONS,
    PUBLIC_DEFAULT_EDUCATION_STAGES,
    PUBLIC_DEFAULTS_UPDATED_AT,
    PUBLIC_DEFAULTS_VERSION,
} from "@/lib/simulation/publicDefaults";

export type AssumptionKey =
  | "incomeGrowthRate"
  | "expenseInflationRate"
  | "assetReturnRate";

export type AssumptionDefinition = {
  key: AssumptionKey;
  label: string;
  description: string;
  defaultValue: number;
  min: number;
  max: number;
  sourceLabel: string;
  sourceUrl: string;
};

export type SchoolKind = "public" | "private";

export type EducationStageKey =
  | "preschool"
  | "elementary"
  | "middle"
  | "high"
  | "university";

export type EducationStageDefinition = {
  key: EducationStageKey;
  label: string;
  startAge: number;
  durationYears: number;
  annualCost: Record<SchoolKind, number>;
  sourceLabel: string;
  sourceUrl: string;
};

export type AdditionalChildCostDefinition = {
  key: "cramSchool" | "lessons" | "remittance";
  label: string;
  startAge: number;
  durationYears: number;
  annualCost: number;
  sourceLabel: string;
  sourceUrl: string;
};

export const DEFAULT_ASSUMPTIONS: Record<AssumptionKey, number> = {
  incomeGrowthRate: PUBLIC_DEFAULT_ASSUMPTIONS.incomeGrowthRate.value,
  expenseInflationRate: PUBLIC_DEFAULT_ASSUMPTIONS.expenseInflationRate.value,
  assetReturnRate: PUBLIC_DEFAULT_ASSUMPTIONS.assetReturnRate.value,
};

export const DEFAULT_PENSION_START_AGE = 65;
export const DEFAULT_PENSION_ANNUAL = 1800000;

export { getPublicDefaultsUpdatedLabel, isPublicDefaultsUpdateDue, PUBLIC_DEFAULTS_UPDATED_AT, PUBLIC_DEFAULTS_VERSION };

export const EDUCATION_STAGE_DEFINITIONS: EducationStageDefinition[] =
  PUBLIC_DEFAULT_EDUCATION_STAGES.map((stage) => ({
    ...stage,
    annualCost: {
      public: stage.annualCost.public,
      private: stage.annualCost.private,
    },
  }));

export const ADDITIONAL_CHILD_COST_DEFINITIONS: AdditionalChildCostDefinition[] =
  PUBLIC_DEFAULT_ADDITIONAL_CHILD_COSTS.map((item) => ({ ...item }));

export const ASSUMPTION_DEFINITIONS: AssumptionDefinition[] = [
  {
    key: "incomeGrowthRate",
    label: "収入成長率",
    description: "毎年の収入増加率（控えめ設定）",
    defaultValue: DEFAULT_ASSUMPTIONS.incomeGrowthRate,
    min: -0.1,
    max: 0.2,
    sourceLabel: PUBLIC_DEFAULT_ASSUMPTIONS.incomeGrowthRate.sourceLabel,
    sourceUrl: PUBLIC_DEFAULT_ASSUMPTIONS.incomeGrowthRate.sourceUrl,
  },
  {
    key: "expenseInflationRate",
    label: "生活費上昇率",
    description: "毎年の支出増加率（物価上昇を反映）",
    defaultValue: DEFAULT_ASSUMPTIONS.expenseInflationRate,
    min: -0.05,
    max: 0.15,
    sourceLabel: PUBLIC_DEFAULT_ASSUMPTIONS.expenseInflationRate.sourceLabel,
    sourceUrl: PUBLIC_DEFAULT_ASSUMPTIONS.expenseInflationRate.sourceUrl,
  },
  {
    key: "assetReturnRate",
    label: "資産運用利回り",
    description: "年間の資産増減率（税引き後の想定）",
    defaultValue: DEFAULT_ASSUMPTIONS.assetReturnRate,
    min: -0.2,
    max: 0.3,
    sourceLabel: PUBLIC_DEFAULT_ASSUMPTIONS.assetReturnRate.sourceLabel,
    sourceUrl: PUBLIC_DEFAULT_ASSUMPTIONS.assetReturnRate.sourceUrl,
  },
];
