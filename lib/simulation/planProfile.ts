import type {
    AssumptionKey,
    EducationStageKey,
    SchoolKind,
} from "@/lib/simulation/assumptions";

export type PlanProfileChild = {
  id: number;
  name: string;
  birthDate: string;
  schoolPlan: Record<EducationStageKey, SchoolKind>;
};

export type PlanProfilePayload = {
  startYear: string;
  years: string;
  initialBalance: string;
  annualIncome: string;
  annualExpense: string;
  children: PlanProfileChild[];
  assumptionRates: Record<AssumptionKey, string>;
  isInputSectionOpen: boolean;
  isEducationSectionOpen: boolean;
  isCarSectionOpen: boolean;
  isHousingSectionOpen: boolean;
};

const EDUCATION_KEYS: EducationStageKey[] = [
  "preschool",
  "elementary",
  "middle",
  "high",
  "university",
];

const ASSUMPTION_KEYS: AssumptionKey[] = [
  "incomeGrowthRate",
  "expenseInflationRate",
  "assetReturnRate",
];

function isSchoolKind(value: unknown): value is SchoolKind {
  return value === "public" || value === "private";
}

function defaultSchoolPlan(): Record<EducationStageKey, SchoolKind> {
  return {
    preschool: "public",
    elementary: "public",
    middle: "public",
    high: "public",
    university: "public",
  };
}

function normalizeSchoolPlan(
  input: unknown,
): Record<EducationStageKey, SchoolKind> {
  if (!input || typeof input !== "object") {
    return defaultSchoolPlan();
  }

  const raw = input as Record<string, unknown>;
  const result = defaultSchoolPlan();
  EDUCATION_KEYS.forEach((key) => {
    if (isSchoolKind(raw[key])) {
      result[key] = raw[key];
    }
  });
  return result;
}

function normalizeChildren(input: unknown): PlanProfileChild[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const raw = item as Record<string, unknown>;
      if (
        !Number.isFinite(raw.id) ||
        typeof raw.name !== "string" ||
        typeof raw.birthDate !== "string"
      ) {
        return null;
      }

      return {
        id: Number(raw.id),
        name: raw.name,
        birthDate: raw.birthDate,
        schoolPlan: normalizeSchoolPlan(raw.schoolPlan),
      };
    })
    .filter((item): item is PlanProfileChild => item !== null);
}

function normalizeAssumptionRates(
  input: unknown,
  fallback: Record<AssumptionKey, string>,
): Record<AssumptionKey, string> {
  if (!input || typeof input !== "object") {
    return fallback;
  }

  const raw = input as Record<string, unknown>;
  const result = { ...fallback };
  ASSUMPTION_KEYS.forEach((key) => {
    if (typeof raw[key] === "string") {
      result[key] = raw[key];
    }
  });
  return result;
}

export function defaultPlanProfile(currentYear: number): PlanProfilePayload {
  return {
    startYear: String(currentYear),
    years: "20",
    initialBalance: "5000000",
    annualIncome: "0",
    annualExpense: "0",
    children: [],
    assumptionRates: {
      incomeGrowthRate: "1",
      expenseInflationRate: "2",
      assetReturnRate: "1",
    },
    isInputSectionOpen: false,
    isEducationSectionOpen: false,
    isCarSectionOpen: false,
    isHousingSectionOpen: false,
  };
}

export function normalizePlanProfilePayload(
  input: unknown,
  fallback: PlanProfilePayload,
): PlanProfilePayload {
  if (!input || typeof input !== "object") {
    return fallback;
  }

  const raw = input as Record<string, unknown>;
  if (
    typeof raw.startYear !== "string" ||
    typeof raw.years !== "string" ||
    typeof raw.initialBalance !== "string" ||
    typeof raw.annualIncome !== "string" ||
    typeof raw.annualExpense !== "string" ||
    typeof raw.isInputSectionOpen !== "boolean" ||
    typeof raw.isEducationSectionOpen !== "boolean" ||
    typeof raw.isCarSectionOpen !== "boolean" ||
    typeof raw.isHousingSectionOpen !== "boolean"
  ) {
    return fallback;
  }

  const children = normalizeChildren(raw.children);
  const assumptionRates = normalizeAssumptionRates(
    raw.assumptionRates,
    fallback.assumptionRates,
  );

  return {
    startYear: raw.startYear,
    years: raw.years,
    initialBalance: raw.initialBalance,
    annualIncome: raw.annualIncome,
    annualExpense: raw.annualExpense,
    children,
    assumptionRates,
    isInputSectionOpen: raw.isInputSectionOpen,
    isEducationSectionOpen: raw.isEducationSectionOpen,
    isCarSectionOpen: raw.isCarSectionOpen,
    isHousingSectionOpen: raw.isHousingSectionOpen,
  };
}
