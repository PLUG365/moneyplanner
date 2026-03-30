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
  incomeGrowthRate: 0.01,
  expenseInflationRate: 0.02,
  assetReturnRate: 0.01,
};

export const DEFAULT_PENSION_START_AGE = 65;
export const DEFAULT_PENSION_ANNUAL = 1800000;

const CHILD_LEARNING_COST_URL =
  "https://www.e-stat.go.jp/stat-search?page=1&query=%E5%AD%90%E4%BE%9B%E3%81%AE%E5%AD%A6%E7%BF%92%E8%B2%BB%E8%AA%BF%E6%9F%BB";
const UNIVERSITY_TUITION_URL =
  "https://www.e-stat.go.jp/stat-search?page=1&query=%E5%A4%A7%E5%AD%A6%20%E6%8E%88%E6%A5%AD%E6%96%99";
const REMITTANCE_REFERENCE_URL =
  "https://www.e-stat.go.jp/stat-search?page=1&query=%E4%BB%95%E9%80%81%E3%82%8A";

export const EDUCATION_STAGE_DEFINITIONS: EducationStageDefinition[] = [
  {
    key: "preschool",
    label: "幼保",
    startAge: 3,
    durationYears: 3,
    annualCost: { public: 280000, private: 650000 },
    sourceLabel: "e-Stat 子供の学習費調査（概算）",
    sourceUrl: CHILD_LEARNING_COST_URL,
  },
  {
    key: "elementary",
    label: "小学校",
    startAge: 6,
    durationYears: 6,
    annualCost: { public: 350000, private: 1650000 },
    sourceLabel: "e-Stat 子供の学習費調査（概算）",
    sourceUrl: CHILD_LEARNING_COST_URL,
  },
  {
    key: "middle",
    label: "中学校",
    startAge: 12,
    durationYears: 3,
    annualCost: { public: 540000, private: 1430000 },
    sourceLabel: "e-Stat 子供の学習費調査（概算）",
    sourceUrl: CHILD_LEARNING_COST_URL,
  },
  {
    key: "high",
    label: "高校",
    startAge: 15,
    durationYears: 3,
    annualCost: { public: 510000, private: 1050000 },
    sourceLabel: "e-Stat 子供の学習費調査（概算）",
    sourceUrl: CHILD_LEARNING_COST_URL,
  },
  {
    key: "university",
    label: "大学",
    startAge: 18,
    durationYears: 4,
    annualCost: { public: 700000, private: 1800000 },
    sourceLabel: "e-Stat 大学授業料関連統計（概算）",
    sourceUrl: UNIVERSITY_TUITION_URL,
  },
];

export const ADDITIONAL_CHILD_COST_DEFINITIONS: AdditionalChildCostDefinition[] =
  [
    {
      key: "cramSchool",
      label: "塾",
      startAge: 10,
      durationYears: 9,
      annualCost: 360000,
      sourceLabel: "e-Stat 子供の学習費調査（学校外活動費の概算）",
      sourceUrl: CHILD_LEARNING_COST_URL,
    },
    {
      key: "lessons",
      label: "習い事",
      startAge: 6,
      durationYears: 12,
      annualCost: 240000,
      sourceLabel: "e-Stat 子供の学習費調査（学校外活動費の概算）",
      sourceUrl: CHILD_LEARNING_COST_URL,
    },
    {
      key: "remittance",
      label: "仕送り",
      startAge: 18,
      durationYears: 4,
      annualCost: 1200000,
      sourceLabel: "e-Stat 仕送り関連統計（概算）",
      sourceUrl: REMITTANCE_REFERENCE_URL,
    },
  ];

export const ASSUMPTION_DEFINITIONS: AssumptionDefinition[] = [
  {
    key: "incomeGrowthRate",
    label: "収入成長率",
    description: "毎年の収入増加率（控えめ設定）",
    defaultValue: DEFAULT_ASSUMPTIONS.incomeGrowthRate,
    min: -0.1,
    max: 0.2,
    sourceLabel: "民間給与実態統計調査（国税庁）",
    sourceUrl:
      "https://www.nta.go.jp/publication/statistics/kokuzeicho/minkan/",
  },
  {
    key: "expenseInflationRate",
    label: "生活費上昇率",
    description: "毎年の支出増加率（物価上昇を反映）",
    defaultValue: DEFAULT_ASSUMPTIONS.expenseInflationRate,
    min: -0.05,
    max: 0.15,
    sourceLabel: "消費者物価指数 CPI（e-Stat）",
    sourceUrl: "https://www.e-stat.go.jp/",
  },
  {
    key: "assetReturnRate",
    label: "資産運用利回り",
    description: "年間の資産増減率（税引き後の想定）",
    defaultValue: DEFAULT_ASSUMPTIONS.assetReturnRate,
    min: -0.2,
    max: 0.3,
    sourceLabel: "家計シミュレーションMVPの暫定想定",
    sourceUrl:
      "https://gist.github.com/minoru365/d4ffe5031aaa849c2537acc2cd768301",
  },
];
