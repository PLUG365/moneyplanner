import DateTimePicker, {
    type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useFocusEffect } from "expo-router";
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    Alert,
    Linking,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import {
    addLifeEvent,
    deleteLifeEvent,
    getLifeEvents,
    getPlanProfile,
    getYearMonthlyTotals,
    savePlanProfile,
    updateLifeEvent,
    type PlanLifeEvent,
} from "@/lib/database";
import {
    ADDITIONAL_CHILD_COST_DEFINITIONS,
    ASSUMPTION_DEFINITIONS,
    DEFAULT_ASSUMPTIONS,
    EDUCATION_STAGE_DEFINITIONS,
    getPublicDefaultsUpdatedLabel,
    isPublicDefaultsUpdateDue,
    PUBLIC_DEFAULTS_VERSION,
    type AssumptionKey,
    type EducationStageKey,
    type SchoolKind,
} from "@/lib/simulation/assumptions";
import { runSimulation } from "@/lib/simulation/engine";
import {
    expandLifeEventsByYear,
    type CarPurchaseEvent,
    type ChildEducationEvent,
    type HousingPurchaseEvent,
} from "@/lib/simulation/events";
import {
    defaultPlanProfile,
    normalizePlanProfilePayload,
    type PlanProfilePayload,
} from "@/lib/simulation/planProfile";

function formatAmount(value: number): string {
  return Math.round(value).toLocaleString("ja-JP");
}

function toInt(raw: string, fallback = 0): number {
  const n = parseInt(raw.replace(/,/g, ""), 10);
  return Number.isFinite(n) ? n : fallback;
}

function toRate(raw: string, fallback: number): number {
  const n = parseFloat(raw.replace(/,/g, ""));
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return n / 100;
}

type ChildSchoolPlan = Record<EducationStageKey, SchoolKind>;

type FamilyChild = {
  id: number;
  name: string;
  birthDate: string;
  schoolPlan: ChildSchoolPlan;
};

type EducationSuggestion = {
  childId: number;
  childName: string;
  stageKey: string;
  stageLabel: string;
  startYear: number;
  durationYears: number;
  annualCost: number;
  schoolKind: SchoolKind | "common";
};

type BirthDateTarget = { kind: "child"; id: number };

type HousingExpenseType = HousingPurchaseEvent["expenseType"];
type CarExpenseType = CarPurchaseEvent["expenseType"];
type HousingExpenseTypeInput = HousingExpenseType | "";
type CarExpenseTypeInput = CarExpenseType | "";

const HOUSING_EXPENSE_TYPE_OPTIONS: {
  value: HousingExpenseType;
  label: string;
}[] = [
  { value: "downPayment", label: "頭金" },
  { value: "repair", label: "修繕" },
  { value: "renovation", label: "リフォーム" },
  { value: "other", label: "諸費用" },
];

const CAR_EXPENSE_TYPE_OPTIONS: {
  value: CarExpenseType;
  label: string;
}[] = [
  { value: "purchase", label: "購入" },
  { value: "repair", label: "修理" },
  { value: "inspection", label: "車検" },
  { value: "other", label: "諸費用" },
];

type CostSourceItem = {
  label: string;
  url: string;
};

type EducationEventType =
  | "幼保"
  | "小学校"
  | "中学校"
  | "高校"
  | "大学"
  | "塾"
  | "習い事"
  | "仕送り"
  | "その他";

const EDUCATION_EVENT_TYPE_OPTIONS: EducationEventType[] = [
  "幼保",
  "小学校",
  "中学校",
  "高校",
  "大学",
  "塾",
  "習い事",
  "仕送り",
  "その他",
];

function defaultSchoolPlan(): ChildSchoolPlan {
  return {
    preschool: "public",
    elementary: "public",
    middle: "public",
    high: "public",
    university: "public",
  };
}

function parseBirthYear(birthDate: string): number | null {
  const matched = birthDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!matched) return null;
  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);
  if (!Number.isFinite(year) || year < 1900 || year > 2100) return null;
  if (!Number.isFinite(month) || month < 1 || month > 12) return null;
  if (!Number.isFinite(day) || day < 1 || day > 31) return null;
  return year;
}

function formatBirthDate(date: Date): string {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseBirthDateToDate(birthDate: string, fallback: Date): Date {
  const matched = birthDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!matched) return fallback;

  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);
  const date = new Date(year, month - 1, day);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return fallback;
  }

  return date;
}

function buildEducationSuggestions(
  children: FamilyChild[],
): EducationSuggestion[] {
  const suggestions: EducationSuggestion[] = [];
  children.forEach((child) => {
    const birthYear = parseBirthYear(child.birthDate);
    if (!birthYear) return;

    EDUCATION_STAGE_DEFINITIONS.forEach((stage) => {
      const schoolKind = child.schoolPlan[stage.key];
      suggestions.push({
        childId: child.id,
        childName: child.name.trim() || `子ども${child.id}`,
        stageKey: stage.key,
        stageLabel: stage.label,
        startYear: birthYear + stage.startAge,
        durationYears: stage.durationYears,
        annualCost: stage.annualCost[schoolKind],
        schoolKind,
      });
    });

    ADDITIONAL_CHILD_COST_DEFINITIONS.forEach((item) => {
      suggestions.push({
        childId: child.id,
        childName: child.name.trim() || `子ども${child.id}`,
        stageKey: item.key,
        stageLabel: item.label,
        startYear: birthYear + item.startAge,
        durationYears: item.durationYears,
        annualCost: item.annualCost,
        schoolKind: "common",
      });
    });
  });
  return suggestions;
}

function buildCostSourceItems(): CostSourceItem[] {
  const all = [
    ...EDUCATION_STAGE_DEFINITIONS.map((item) => ({
      label: item.sourceLabel,
      url: item.sourceUrl,
    })),
    ...ADDITIONAL_CHILD_COST_DEFINITIONS.map((item) => ({
      label: item.sourceLabel,
      url: item.sourceUrl,
    })),
  ];

  const seen = new Set<string>();
  const result: CostSourceItem[] = [];
  all.forEach((item) => {
    const key = `${item.label}:${item.url}`;
    if (seen.has(key)) return;
    seen.add(key);
    result.push(item);
  });
  return result;
}

function parseChildEducationEvent(
  row: PlanLifeEvent,
): ChildEducationEvent | null {
  if (row.eventType !== "child_education") {
    return null;
  }

  try {
    const parsed = JSON.parse(row.paramsJson) as {
      childId?: unknown;
      childName?: unknown;
      educationType?: unknown;
      startYear?: unknown;
      durationYears?: unknown;
      annualCost?: unknown;
    };

    const startYear = Number(parsed.startYear);
    const durationYears = Number(parsed.durationYears);
    const annualCost = Number(parsed.annualCost);
    const childId = Number(parsed.childId);

    if (
      !Number.isFinite(startYear) ||
      !Number.isFinite(durationYears) ||
      !Number.isFinite(annualCost)
    ) {
      return null;
    }

    return {
      id: row.id,
      eventType: "child_education",
      childId: Number.isFinite(childId) ? childId : undefined,
      childName:
        typeof parsed.childName === "string" && parsed.childName.trim()
          ? parsed.childName.trim()
          : `子ども${row.id}`,
      educationType:
        typeof parsed.educationType === "string" && parsed.educationType.trim()
          ? parsed.educationType.trim()
          : undefined,
      startYear,
      durationYears,
      annualCost,
    };
  } catch {
    return null;
  }
}

function parseCarPurchaseEvent(row: PlanLifeEvent): CarPurchaseEvent | null {
  if (row.eventType !== "car_purchase") {
    return null;
  }

  try {
    const parsed = JSON.parse(row.paramsJson) as {
      carName?: unknown;
      purchaseYear?: unknown;
      expenseType?: unknown;
      amount?: unknown;
    };

    const purchaseYear = Number(parsed.purchaseYear);
    const amount = Number(parsed.amount);
    const expenseType = parsed.expenseType;
    const isValidExpenseType =
      expenseType === "purchase" ||
      expenseType === "repair" ||
      expenseType === "inspection" ||
      expenseType === "other";

    if (
      !Number.isFinite(purchaseYear) ||
      !Number.isFinite(amount) ||
      !isValidExpenseType
    ) {
      return null;
    }

    return {
      id: row.id,
      eventType: "car_purchase",
      carName:
        typeof parsed.carName === "string" && parsed.carName.trim()
          ? parsed.carName.trim()
          : `クルマ${row.id}`,
      purchaseYear,
      expenseType,
      amount,
    };
  } catch {
    return null;
  }
}

function isLegacyCarParams(paramsJson: string): boolean {
  try {
    const parsed = JSON.parse(paramsJson) as Record<string, unknown>;
    return "annualMaintenanceCost" in parsed || "maintenanceYears" in parsed;
  } catch {
    return true;
  }
}

function parseHousingPurchaseEvent(
  row: PlanLifeEvent,
): HousingPurchaseEvent | null {
  if (row.eventType !== "housing_purchase") {
    return null;
  }

  try {
    const parsed = JSON.parse(row.paramsJson) as {
      homeName?: unknown;
      purchaseYear?: unknown;
      expenseType?: unknown;
      amount?: unknown;
    };

    const purchaseYear = Number(parsed.purchaseYear);
    const amount = Number(parsed.amount);
    const expenseType = parsed.expenseType;
    const isValidExpenseType =
      expenseType === "downPayment" ||
      expenseType === "repair" ||
      expenseType === "renovation" ||
      expenseType === "other";

    if (
      !Number.isFinite(purchaseYear) ||
      !Number.isFinite(amount) ||
      !isValidExpenseType
    ) {
      return null;
    }

    return {
      id: row.id,
      eventType: "housing_purchase",
      homeName:
        typeof parsed.homeName === "string" && parsed.homeName.trim()
          ? parsed.homeName.trim()
          : `住まい${row.id}`,
      purchaseYear,
      expenseType,
      amount,
    };
  } catch {
    return null;
  }
}

function isLegacyHousingParams(paramsJson: string): boolean {
  try {
    const parsed = JSON.parse(paramsJson) as Record<string, unknown>;
    return (
      "loanPrincipal" in parsed ||
      "loanInterestRate" in parsed ||
      "loanYears" in parsed ||
      "annualMaintenanceCost" in parsed ||
      "rentOffsetAnnual" in parsed
    );
  } catch {
    return true;
  }
}

export default function PlanScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const currentYear = new Date().getFullYear();
  const publicDefaultsUpdatedLabel = useMemo(
    () => getPublicDefaultsUpdatedLabel("ja-JP"),
    [],
  );
  const isPublicDefaultsDue = useMemo(() => isPublicDefaultsUpdateDue(), []);
  const defaultProfile = useMemo(
    () => defaultPlanProfile(currentYear),
    [currentYear],
  );
  const hasLoadedProfileRef = useRef(false);
  const isHydratingProfileRef = useRef(false);
  const annualIncomeTouchedRef = useRef(false);
  const annualExpenseTouchedRef = useRef(false);

  const [startYear, setStartYear] = useState(String(currentYear));
  const [years, setYears] = useState("20");
  const [initialBalance, setInitialBalance] = useState("5000000");
  const [annualIncome, setAnnualIncome] = useState("0");
  const [annualExpense, setAnnualExpense] = useState("0");
  const [children, setChildren] = useState<FamilyChild[]>([]);
  const [expandedChildIds, setExpandedChildIds] = useState<Set<number>>(
    new Set(),
  );
  const [assumptionRates, setAssumptionRates] = useState<
    Record<AssumptionKey, string>
  >({
    incomeGrowthRate: String(DEFAULT_ASSUMPTIONS.incomeGrowthRate * 100),
    expenseInflationRate: String(
      DEFAULT_ASSUMPTIONS.expenseInflationRate * 100,
    ),
    assetReturnRate: String(DEFAULT_ASSUMPTIONS.assetReturnRate * 100),
  });
  const [educationEvents, setEducationEvents] = useState<ChildEducationEvent[]>(
    [],
  );
  const [carEvents, setCarEvents] = useState<CarPurchaseEvent[]>([]);
  const [housingEvents, setHousingEvents] = useState<HousingPurchaseEvent[]>(
    [],
  );
  const [eventChildId, setEventChildId] = useState<number | null>(null);
  const [eventEducationType, setEventEducationType] = useState("");
  const [eventStartYear, setEventStartYear] = useState("");
  const [eventDurationYears, setEventDurationYears] = useState("");
  const [eventAnnualCost, setEventAnnualCost] = useState("");
  const [carName, setCarName] = useState("");
  const [carPurchaseYear, setCarPurchaseYear] = useState("");
  const [carExpenseType, setCarExpenseType] = useState<CarExpenseTypeInput>("");
  const [carAmount, setCarAmount] = useState("");
  const [homeName, setHomeName] = useState("");
  const [homePurchaseYear, setHomePurchaseYear] = useState("");
  const [homeExpenseType, setHomeExpenseType] =
    useState<HousingExpenseTypeInput>("");
  const [homeAmount, setHomeAmount] = useState("");
  const [isInputSectionOpen, setIsInputSectionOpen] = useState(false);
  const [isHousingSectionOpen, setIsHousingSectionOpen] = useState(false);
  const [isCarSectionOpen, setIsCarSectionOpen] = useState(false);
  const [isEducationSectionOpen, setIsEducationSectionOpen] = useState(false);
  const [birthDatePickerTarget, setBirthDatePickerTarget] =
    useState<BirthDateTarget | null>(null);
  const [birthDatePickerValue, setBirthDatePickerValue] = useState(
    new Date(1985, 0, 1),
  );
  const [suggestionSyncMessage, setSuggestionSyncMessage] = useState("");
  const [isSuggestionPopupVisible, setIsSuggestionPopupVisible] =
    useState(false);

  const resetEventInputForms = useCallback(() => {
    setEventChildId(null);
    setEventEducationType("");
    setEventStartYear("");
    setEventDurationYears("");
    setEventAnnualCost("");
    setCarName("");
    setCarPurchaseYear("");
    setCarExpenseType("");
    setCarAmount("");
    setHomeName("");
    setHomePurchaseYear("");
    setHomeExpenseType("");
    setHomeAmount("");
  }, []);

  useFocusEffect(
    useCallback(() => {
      resetEventInputForms();
    }, [resetEventInputForms]),
  );

  useFocusEffect(
    useCallback(() => {
      if (hasLoadedProfileRef.current) {
        return;
      }

      const stored = getPlanProfile();
      hasLoadedProfileRef.current = true;
      if (!stored) {
        return;
      }

      try {
        const parsed = JSON.parse(stored.payloadJson) as unknown;
        const normalized = normalizePlanProfilePayload(parsed, defaultProfile);
        isHydratingProfileRef.current = true;
        setStartYear(normalized.startYear);
        setYears(normalized.years);
        setInitialBalance(normalized.initialBalance);
        setAnnualIncome(normalized.annualIncome);
        if (toInt(normalized.annualIncome, 0) !== 0)
          annualIncomeTouchedRef.current = true;
        setAnnualExpense(normalized.annualExpense);
        if (toInt(normalized.annualExpense, 0) !== 0)
          annualExpenseTouchedRef.current = true;
        setChildren(normalized.children);
        setAssumptionRates(normalized.assumptionRates);
        setIsInputSectionOpen(normalized.isInputSectionOpen);
        setIsEducationSectionOpen(normalized.isEducationSectionOpen);
        setIsCarSectionOpen(normalized.isCarSectionOpen);
        setIsHousingSectionOpen(normalized.isHousingSectionOpen);
      } catch {
        // noop
      } finally {
        setTimeout(() => {
          isHydratingProfileRef.current = false;
        }, 0);
      }
    }, [defaultProfile]),
  );

  useEffect(() => {
    if (!hasLoadedProfileRef.current || isHydratingProfileRef.current) {
      return;
    }

    const payload: PlanProfilePayload = {
      startYear,
      years,
      initialBalance,
      annualIncome,
      annualExpense,
      children,
      assumptionRates,
      isInputSectionOpen,
      isEducationSectionOpen,
      isCarSectionOpen,
      isHousingSectionOpen,
    };

    savePlanProfile(JSON.stringify(payload));
  }, [
    annualExpense,
    annualIncome,
    assumptionRates,
    children,
    initialBalance,
    isCarSectionOpen,
    isEducationSectionOpen,
    isHousingSectionOpen,
    isInputSectionOpen,
    startYear,
    years,
  ]);

  useFocusEffect(
    useCallback(() => {
      const totals = getYearMonthlyTotals(currentYear);
      const incomeTotal = totals.reduce((sum, row) => sum + row.income, 0);
      const expenseTotal = totals.reduce((sum, row) => sum + row.expense, 0);
      if (
        incomeTotal > 0 &&
        toInt(annualIncome, 0) === 0 &&
        !annualIncomeTouchedRef.current
      ) {
        setAnnualIncome(String(Math.round(incomeTotal)));
      }
      if (
        expenseTotal > 0 &&
        toInt(annualExpense, 0) === 0 &&
        !annualExpenseTouchedRef.current
      ) {
        setAnnualExpense(String(Math.round(expenseTotal)));
      }

      let rows = getLifeEvents();
      const legacyHousingIds = rows
        .filter(
          (row) =>
            row.eventType === "housing_purchase" &&
            isLegacyHousingParams(row.paramsJson),
        )
        .map((row) => row.id);

      if (legacyHousingIds.length > 0) {
        legacyHousingIds.forEach((id) => deleteLifeEvent(id));
        rows = getLifeEvents();
      }

      const legacyCarIds = rows
        .filter(
          (row) =>
            row.eventType === "car_purchase" &&
            isLegacyCarParams(row.paramsJson),
        )
        .map((row) => row.id);

      if (legacyCarIds.length > 0) {
        legacyCarIds.forEach((id) => deleteLifeEvent(id));
        rows = getLifeEvents();
      }

      setEducationEvents(
        rows
          .map(parseChildEducationEvent)
          .filter((e): e is ChildEducationEvent => e !== null),
      );
      setCarEvents(
        rows
          .map(parseCarPurchaseEvent)
          .filter((e): e is CarPurchaseEvent => e !== null),
      );
      setHousingEvents(
        rows
          .map(parseHousingPurchaseEvent)
          .filter((e): e is HousingPurchaseEvent => e !== null),
      );
    }, [annualExpense, annualIncome, currentYear]),
  );

  const educationSuggestions = useMemo(
    () => buildEducationSuggestions(children),
    [children],
  );
  const familyTargetOptions = useMemo(
    () => [
      ...children.map((child) => ({
        key: `child-${child.id}`,
        value: child.id,
        label: child.name.trim() || `子ども${child.id}`,
      })),
    ],
    [children],
  );
  const costSourceItems = useMemo(() => buildCostSourceItems(), []);

  const projectionRows = useMemo(() => {
    const simStartYear = toInt(startYear, currentYear);
    const simYears = toInt(years, 20);
    const eventExpenseMap = expandLifeEventsByYear(
      [...educationEvents, ...carEvents, ...housingEvents],
      simStartYear,
      simYears,
    );

    return runSimulation({
      startYear: simStartYear,
      years: simYears,
      initialBalance: toInt(initialBalance, 0),
      annualIncome: toInt(annualIncome, 0),
      annualExpense: toInt(annualExpense, 0),
      extraIncomeByYear: {},
      extraExpensesByYear: eventExpenseMap,
      assumptions: {
        incomeGrowthRate: toRate(
          assumptionRates.incomeGrowthRate,
          DEFAULT_ASSUMPTIONS.incomeGrowthRate,
        ),
        expenseInflationRate: toRate(
          assumptionRates.expenseInflationRate,
          DEFAULT_ASSUMPTIONS.expenseInflationRate,
        ),
        assetReturnRate: toRate(
          assumptionRates.assetReturnRate,
          DEFAULT_ASSUMPTIONS.assetReturnRate,
        ),
      },
    });
  }, [
    annualExpense,
    annualIncome,
    assumptionRates,
    carEvents,
    currentYear,
    educationEvents,
    housingEvents,
    initialBalance,
    startYear,
    years,
  ]);

  const finalRow = projectionRows[projectionRows.length - 1];

  const handleResetAssumptions = () => {
    setAssumptionRates({
      incomeGrowthRate: String(DEFAULT_ASSUMPTIONS.incomeGrowthRate * 100),
      expenseInflationRate: String(
        DEFAULT_ASSUMPTIONS.expenseInflationRate * 100,
      ),
      assetReturnRate: String(DEFAULT_ASSUMPTIONS.assetReturnRate * 100),
    });
  };

  const handleAddEducationEvent = () => {
    if (
      eventChildId === null ||
      !eventEducationType ||
      !eventStartYear ||
      !eventDurationYears ||
      !eventAnnualCost
    ) {
      return;
    }

    const start = toInt(eventStartYear, currentYear + 3);
    const duration = Math.max(1, toInt(eventDurationYears, 4));
    const annualCost = Math.max(0, toInt(eventAnnualCost, 0));
    const selectedChild = children.find((child) => child.id === eventChildId);
    if (!selectedChild) {
      return;
    }
    const childName = selectedChild.name.trim() || `子ども${selectedChild.id}`;

    addLifeEvent(
      "child_education",
      JSON.stringify({
        childId: selectedChild.id,
        childName,
        educationType: eventEducationType,
        startYear: start,
        durationYears: duration,
        annualCost,
      }),
    );

    const events = getLifeEvents()
      .map(parseChildEducationEvent)
      .filter((e): e is ChildEducationEvent => e !== null);
    setEducationEvents(events);

    setEventChildId(null);
    setEventEducationType("");
    setEventStartYear("");
    setEventDurationYears("");
    setEventAnnualCost("");
  };

  const handleDeleteEducationEvent = (id: number) => {
    deleteLifeEvent(id);
    setEducationEvents((prev) => prev.filter((event) => event.id !== id));
  };

  const handleAddCarEvent = () => {
    if (!carName.trim() || !carPurchaseYear || !carExpenseType || !carAmount) {
      return;
    }

    const purchaseYear = toInt(carPurchaseYear, currentYear + 1);
    const amount = Math.max(0, toInt(carAmount, 0));
    const nextCarName = carName.trim() || `クルマ${carEvents.length + 1}`;

    addLifeEvent(
      "car_purchase",
      JSON.stringify({
        carName: nextCarName,
        purchaseYear,
        expenseType: carExpenseType as CarExpenseType,
        amount,
      }),
    );

    const events = getLifeEvents()
      .map(parseCarPurchaseEvent)
      .filter((e): e is CarPurchaseEvent => e !== null);
    setCarEvents(events);

    setCarName("");
    setCarPurchaseYear("");
    setCarExpenseType("");
    setCarAmount("");
  };

  const handleDeleteCarEvent = (id: number) => {
    deleteLifeEvent(id);
    setCarEvents((prev) => prev.filter((event) => event.id !== id));
  };

  const handleAddHousingEvent = () => {
    if (
      !homeName.trim() ||
      !homePurchaseYear ||
      !homeExpenseType ||
      !homeAmount
    ) {
      return;
    }

    const purchaseYear = toInt(homePurchaseYear, currentYear + 2);
    const amount = Math.max(0, toInt(homeAmount, 0));
    const nextHomeName = homeName.trim() || `住まい${housingEvents.length + 1}`;

    addLifeEvent(
      "housing_purchase",
      JSON.stringify({
        homeName: nextHomeName,
        purchaseYear,
        expenseType: homeExpenseType as HousingExpenseType,
        amount,
      }),
    );

    const events = getLifeEvents()
      .map(parseHousingPurchaseEvent)
      .filter((e): e is HousingPurchaseEvent => e !== null);
    setHousingEvents(events);

    setHomeName("");
    setHomePurchaseYear("");
    setHomeExpenseType("");
    setHomeAmount("");
  };

  const handleDeleteHousingEvent = (id: number) => {
    deleteLifeEvent(id);
    setHousingEvents((prev) => prev.filter((event) => event.id !== id));
  };

  const addChild = () => {
    const newChild: FamilyChild = {
      id: Date.now(),
      name: `子ども${children.length + 1}`,
      birthDate: "2018-04-01",
      schoolPlan: defaultSchoolPlan(),
    };
    setChildren((prev) => [newChild, ...prev]);
    // new child starts collapsed
  };

  const syncEducationEventChildName = (
    childId: number,
    oldName: string,
    newName: string,
  ): void => {
    if (oldName === newName) {
      return;
    }

    const rows = getLifeEvents().filter(
      (row) => row.eventType === "child_education",
    );
    rows.forEach((row) => {
      try {
        const parsed = JSON.parse(row.paramsJson) as Record<string, unknown>;
        const parsedChildId = Number(parsed.childId);
        const isTargetById =
          Number.isFinite(parsedChildId) && parsedChildId === childId;
        const isLegacyTargetByName =
          !Number.isFinite(parsedChildId) && parsed.childName === oldName;
        if (!isTargetById && !isLegacyTargetByName) {
          return;
        }

        updateLifeEvent(
          row.id,
          JSON.stringify({
            ...parsed,
            childId,
            childName: newName,
          }),
        );
      } catch {
        // noop
      }
    });

    setEducationEvents((prev) =>
      prev.map((event) =>
        event.childId === childId ||
        (event.childId === undefined && event.childName === oldName)
          ? { ...event, childId, childName: newName }
          : event,
      ),
    );

    setEventChildId((prev) => (prev === childId ? childId : prev));
  };

  const updateChild = (
    id: number,
    key: "name" | "birthDate",
    value: string,
  ) => {
    if (key === "name") {
      const currentChild = children.find((child) => child.id === id);
      const oldResolvedName =
        currentChild?.name.trim() ||
        (currentChild ? `子ども${currentChild.id}` : "");
      const newResolvedName = value.trim() || `子ども${id}`;
      syncEducationEventChildName(id, oldResolvedName, newResolvedName);
    }

    setChildren((prev) =>
      prev.map((child) =>
        child.id === id ? { ...child, [key]: value } : child,
      ),
    );
  };

  const updateChildSchool = (
    id: number,
    stage: EducationStageKey,
    schoolKind: SchoolKind,
  ) => {
    setChildren((prev) =>
      prev.map((child) =>
        child.id === id
          ? {
              ...child,
              schoolPlan: { ...child.schoolPlan, [stage]: schoolKind },
            }
          : child,
      ),
    );
  };

  const removeChild = (id: number) => {
    const targetChild = children.find((child) => child.id === id);
    const targetName = targetChild?.name.trim() || `子ども${id}`;

    const rows = getLifeEvents().filter(
      (row) => row.eventType === "child_education",
    );
    rows.forEach((row) => {
      try {
        const parsed = JSON.parse(row.paramsJson) as Record<string, unknown>;
        const parsedChildId = Number(parsed.childId);
        const isTargetById =
          Number.isFinite(parsedChildId) && parsedChildId === id;
        const isLegacyTargetByName =
          !Number.isFinite(parsedChildId) && parsed.childName === targetName;

        if (isTargetById || isLegacyTargetByName) {
          deleteLifeEvent(row.id);
        }
      } catch {
        // noop
      }
    });

    setEducationEvents((prev) =>
      prev.filter(
        (event) =>
          !(
            event.childId === id ||
            (event.childId === undefined && event.childName === targetName)
          ),
      ),
    );
    setEventChildId((prev) => (prev === id ? null : prev));
    setChildren((prev) => prev.filter((child) => child.id !== id));
  };

  const confirmRemoveChild = (id: number) => {
    const targetChild = children.find((child) => child.id === id);
    const targetName = targetChild?.name.trim() || `子ども${id}`;

    Alert.alert(
      "子どもを削除しますか？",
      `${targetName} を削除すると、紐づく教育イベントも削除されます。`,
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "削除する",
          style: "destructive",
          onPress: () => removeChild(id),
        },
      ],
    );
  };

  const openBirthDatePicker = (target: BirthDateTarget, birthDate: string) => {
    const fallback = new Date(currentYear - 7, 3, 1);
    setBirthDatePickerValue(parseBirthDateToDate(birthDate, fallback));
    setBirthDatePickerTarget(target);
  };

  const handleBirthDateChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    if (Platform.OS === "android") {
      setBirthDatePickerTarget(null);
    }

    if (event.type === "dismissed" || !selectedDate || !birthDatePickerTarget) {
      return;
    }

    setBirthDatePickerValue(selectedDate);
    const formatted = formatBirthDate(selectedDate);
    updateChild(birthDatePickerTarget.id, "birthDate", formatted);
  };

  const handleApplyEducationSuggestions = () => {
    if (educationSuggestions.length === 0) {
      setSuggestionSyncMessage("登録できる提案がありません");
      setIsSuggestionPopupVisible(false);
      return;
    }

    const existingKeys = new Set(
      educationEvents.map(
        (event) =>
          `${event.childId ?? event.childName}:${event.educationType ?? ""}:${event.startYear}:${event.durationYears}:${event.annualCost}`,
      ),
    );

    let added = 0;
    educationSuggestions.forEach((suggestion) => {
      const key = `${suggestion.childId}:${suggestion.stageLabel}:${suggestion.startYear}:${suggestion.durationYears}:${suggestion.annualCost}`;
      if (existingKeys.has(key)) {
        return;
      }

      addLifeEvent(
        "child_education",
        JSON.stringify({
          childId: suggestion.childId,
          childName: suggestion.childName,
          educationType: suggestion.stageLabel,
          startYear: suggestion.startYear,
          durationYears: suggestion.durationYears,
          annualCost: suggestion.annualCost,
          stageKey: suggestion.stageKey,
          schoolKind: suggestion.schoolKind,
        }),
      );
      existingKeys.add(key);
      added += 1;
    });

    if (added > 0) {
      const events = getLifeEvents()
        .map(parseChildEducationEvent)
        .filter((e): e is ChildEducationEvent => e !== null);
      setEducationEvents(events);
      setSuggestionSyncMessage(`${added}件の進学イベントを登録しました`);
      setIsSuggestionPopupVisible(false);
      return;
    }

    setSuggestionSyncMessage(
      "既存イベントと重複したため追加はありませんでした",
    );
    setIsSuggestionPopupVisible(false);
  };

  const handleOpenSourceLink = async (url: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) return;
      await Linking.openURL(url);
    } catch {
      // noop
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.card,
          styles.fixedSummaryCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.subTitle, { color: colors.text }]}>
          結果サマリー
        </Text>
        <Text style={[styles.summaryText, { color: colors.subText }]}>
          最終年: {finalRow?.year ?? "-"}
        </Text>
        <Text
          style={[
            styles.summaryAmount,
            {
              color:
                finalRow && finalRow.closingBalance >= 0
                  ? colors.income
                  : colors.expense,
            },
          ]}
        >
          ¥{finalRow ? formatAmount(finalRow.closingBalance) : "0"}
        </Text>
      </View>

      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={styles.content}
      >
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <TouchableOpacity
            style={styles.collapseHeader}
            onPress={() => setIsInputSectionOpen((prev) => !prev)}
          >
            <Text style={[styles.title, { color: colors.text }]}>入力設定</Text>
            <Text style={[styles.collapseIcon, { color: colors.subText }]}>
              {isInputSectionOpen ? "▲" : "▼"}
            </Text>
          </TouchableOpacity>

          {isInputSectionOpen ? (
            <>
              <Text style={[styles.description, { color: colors.subText }]}>
                年次収支の簡易シミュレーション
              </Text>

              <Text style={[styles.label, { color: colors.subText }]}>
                開始年
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { color: colors.text, borderColor: colors.border },
                ]}
                value={startYear}
                onChangeText={(text) =>
                  setStartYear(text.replace(/[^0-9]/g, ""))
                }
                keyboardType="number-pad"
              />

              <Text style={[styles.label, { color: colors.subText }]}>
                シミュレーション年数
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { color: colors.text, borderColor: colors.border },
                ]}
                value={years}
                onChangeText={(text) => setYears(text.replace(/[^0-9]/g, ""))}
                keyboardType="number-pad"
              />

              <Text style={[styles.label, { color: colors.subText }]}>
                初期資産（円）
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { color: colors.text, borderColor: colors.border },
                ]}
                value={
                  initialBalance ? formatAmount(toInt(initialBalance, 0)) : ""
                }
                onChangeText={(text) =>
                  setInitialBalance(text.replace(/[^0-9]/g, ""))
                }
                keyboardType="number-pad"
              />

              <Text style={[styles.label, { color: colors.subText }]}>
                年間収入（円）
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { color: colors.text, borderColor: colors.border },
                ]}
                value={annualIncome ? formatAmount(toInt(annualIncome, 0)) : ""}
                onChangeText={(text) => {
                  annualIncomeTouchedRef.current = true;
                  setAnnualIncome(text.replace(/[^0-9]/g, ""));
                }}
                keyboardType="number-pad"
              />

              <Text style={[styles.label, { color: colors.subText }]}>
                年間支出（円）
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { color: colors.text, borderColor: colors.border },
                ]}
                value={
                  annualExpense ? formatAmount(toInt(annualExpense, 0)) : ""
                }
                onChangeText={(text) => {
                  annualExpenseTouchedRef.current = true;
                  setAnnualExpense(text.replace(/[^0-9]/g, ""));
                }}
                keyboardType="number-pad"
              />

              <View style={styles.assumptionHeader}>
                <Text style={[styles.subTitle, { color: colors.text }]}>
                  家族構成（子ども）
                </Text>
                <TouchableOpacity
                  style={[
                    styles.iconButton,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.card,
                    },
                  ]}
                  onPress={addChild}
                >
                  <Text style={[styles.iconButtonText, { color: colors.text }]}>
                    +
                  </Text>
                </TouchableOpacity>
              </View>

              {children.length === 0 ? (
                <Text
                  style={[styles.emptyEventsText, { color: colors.subText }]}
                >
                  未登録です
                </Text>
              ) : (
                children.map((child) => {
                  const isExpanded = expandedChildIds.has(child.id);
                  return (
                    <View
                      key={child.id}
                      style={[
                        styles.memberCard,
                        { borderColor: colors.border },
                      ]}
                    >
                      <TouchableOpacity
                        style={styles.memberHeader}
                        onPress={() =>
                          setExpandedChildIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(child.id)) {
                              next.delete(child.id);
                            } else {
                              next.add(child.id);
                            }
                            return next;
                          })
                        }
                      >
                        <Text
                          style={[styles.memberTitle, { color: colors.text }]}
                        >
                          {child.name || "子ども"}
                          {"  "}
                          <Text
                            style={{
                              fontSize: 11,
                              color: colors.subText,
                              fontWeight: "400",
                            }}
                          >
                            {child.birthDate}
                          </Text>
                        </Text>
                        <View style={styles.memberHeaderRight}>
                          <Text
                            style={[
                              styles.collapseChevron,
                              { color: colors.subText },
                            ]}
                          >
                            {isExpanded ? "▲" : "▼"}
                          </Text>
                          <TouchableOpacity
                            onPress={() => confirmRemoveChild(child.id)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Text style={styles.deleteEventText}>削除</Text>
                          </TouchableOpacity>
                        </View>
                      </TouchableOpacity>

                      {isExpanded ? (
                        <>
                          <Text
                            style={[styles.label, { color: colors.subText }]}
                          >
                            名前
                          </Text>
                          <TextInput
                            style={[
                              styles.input,
                              {
                                color: colors.text,
                                borderColor: colors.border,
                              },
                            ]}
                            value={child.name}
                            onChangeText={(text) =>
                              updateChild(child.id, "name", text)
                            }
                            placeholder="例: 長女"
                            placeholderTextColor={colors.subText}
                          />

                          <Text
                            style={[styles.label, { color: colors.subText }]}
                          >
                            生年月日（YYYY-MM-DD）
                          </Text>
                          <TouchableOpacity
                            style={[
                              styles.dateInputBase,
                              styles.dateInputButton,
                              { borderColor: colors.border },
                            ]}
                            onPress={() =>
                              openBirthDatePicker(
                                { kind: "child", id: child.id },
                                child.birthDate,
                              )
                            }
                          >
                            <Text
                              style={[
                                styles.dateInputText,
                                { color: colors.text },
                              ]}
                            >
                              {child.birthDate}
                            </Text>
                          </TouchableOpacity>

                          <Text
                            style={[styles.label, { color: colors.subText }]}
                          >
                            進学プラン
                          </Text>
                          {EDUCATION_STAGE_DEFINITIONS.map((stage) => (
                            <View
                              key={`${child.id}-${stage.key}`}
                              style={styles.schoolKindRow}
                            >
                              <Text
                                style={[
                                  styles.assumptionLabel,
                                  { color: colors.text },
                                ]}
                              >
                                {stage.label}
                              </Text>
                              <TouchableOpacity
                                style={[
                                  styles.kindButton,
                                  {
                                    borderColor: colors.border,
                                    backgroundColor:
                                      child.schoolPlan[stage.key] === "public"
                                        ? colors.tint
                                        : "transparent",
                                  },
                                ]}
                                onPress={() =>
                                  updateChildSchool(
                                    child.id,
                                    stage.key,
                                    "public",
                                  )
                                }
                              >
                                <Text
                                  style={{
                                    color:
                                      child.schoolPlan[stage.key] === "public"
                                        ? "#fff"
                                        : colors.text,
                                    fontWeight: "700",
                                    fontSize: 12,
                                  }}
                                >
                                  公立
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[
                                  styles.kindButton,
                                  {
                                    borderColor: colors.border,
                                    backgroundColor:
                                      child.schoolPlan[stage.key] === "private"
                                        ? colors.tint
                                        : "transparent",
                                  },
                                ]}
                                onPress={() =>
                                  updateChildSchool(
                                    child.id,
                                    stage.key,
                                    "private",
                                  )
                                }
                              >
                                <Text
                                  style={{
                                    color:
                                      child.schoolPlan[stage.key] === "private"
                                        ? "#fff"
                                        : colors.text,
                                    fontWeight: "700",
                                    fontSize: 12,
                                  }}
                                >
                                  私立
                                </Text>
                              </TouchableOpacity>
                            </View>
                          ))}
                        </>
                      ) : null}
                    </View>
                  );
                })
              )}

              <Text style={[styles.familyHint, { color: colors.subText }]}>
                生年月日と進学プランから、幼保〜大学の教育費に加えて塾・習い事費を自動反映します。
              </Text>

              {educationSuggestions.length > 0 ? (
                <View
                  style={[styles.memberCard, { borderColor: colors.border }]}
                >
                  <Text style={[styles.memberTitle, { color: colors.text }]}>
                    教育費提案（自動）
                  </Text>
                  <TouchableOpacity
                    style={[styles.addButton, { backgroundColor: colors.tint }]}
                    onPress={() => setIsSuggestionPopupVisible(true)}
                  >
                    <Text style={styles.addButtonText}>
                      自動提案を表示（{educationSuggestions.length}件）
                    </Text>
                  </TouchableOpacity>
                  <Text
                    style={[styles.eventCardText, { color: colors.subText }]}
                  >
                    提案は登録するまで結果サマリーに反映されません。
                  </Text>
                  {suggestionSyncMessage ? (
                    <Text
                      style={[styles.eventCardText, { color: colors.subText }]}
                    >
                      {suggestionSyncMessage}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              <View style={styles.assumptionHeader}>
                <Text style={[styles.subTitle, { color: colors.text }]}>
                  想定値（%）
                </Text>
                <TouchableOpacity onPress={handleResetAssumptions}>
                  <Text style={[styles.resetText, { color: colors.tint }]}>
                    初期値に戻す
                  </Text>
                </TouchableOpacity>
              </View>
              <Text
                style={[styles.assumptionMetaText, { color: colors.subText }]}
              >
                公的データ同梱版: v{PUBLIC_DEFAULTS_VERSION} / 最終更新:{" "}
                {publicDefaultsUpdatedLabel}
                {isPublicDefaultsDue ? "（更新推奨）" : ""}
              </Text>

              {ASSUMPTION_DEFINITIONS.map((item) => (
                <View key={item.key} style={styles.assumptionRow}>
                  <Text
                    style={[styles.assumptionLabel, { color: colors.text }]}
                  >
                    {item.label}
                  </Text>
                  <TextInput
                    style={[
                      styles.rateInput,
                      { color: colors.text, borderColor: colors.border },
                    ]}
                    value={assumptionRates[item.key]}
                    onChangeText={(text) => {
                      const cleaned = text.replace(/[^0-9.-]/g, "");
                      setAssumptionRates((prev) => ({
                        ...prev,
                        [item.key]: cleaned,
                      }));
                    }}
                    keyboardType="decimal-pad"
                  />
                  <Text style={[styles.rateUnit, { color: colors.subText }]}>
                    %
                  </Text>
                </View>
              ))}
            </>
          ) : null}
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <TouchableOpacity
            style={styles.collapseHeader}
            onPress={() => setIsHousingSectionOpen((prev) => !prev)}
          >
            <Text style={[styles.subTitle, { color: colors.text }]}>
              大型出費イベント（住宅）
            </Text>
            <Text style={[styles.collapseIcon, { color: colors.subText }]}>
              {isHousingSectionOpen ? "▲" : "▼"}
            </Text>
          </TouchableOpacity>

          {isHousingSectionOpen ? (
            <>
              <Text style={[styles.description, { color: colors.subText }]}>
                名称・購入年・種別・金額を登録して一時支出として反映します
              </Text>

              <Text style={[styles.label, { color: colors.subText }]}>
                名称
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { color: colors.text, borderColor: colors.border },
                ]}
                value={homeName}
                onChangeText={setHomeName}
                placeholder="例: 郊外戸建て"
                placeholderTextColor={colors.subText}
              />

              <View style={styles.eventInputRow}>
                <View style={styles.eventInputCol}>
                  <Text style={[styles.label, { color: colors.subText }]}>
                    購入年
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      { color: colors.text, borderColor: colors.border },
                    ]}
                    value={homePurchaseYear}
                    onChangeText={(text) =>
                      setHomePurchaseYear(text.replace(/[^0-9]/g, ""))
                    }
                    keyboardType="number-pad"
                  />
                </View>
              </View>

              <Text style={[styles.label, { color: colors.subText }]}>
                種別
              </Text>
              <View style={styles.schoolKindRow}>
                {HOUSING_EXPENSE_TYPE_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.kindButton,
                      {
                        borderColor: colors.border,
                        backgroundColor:
                          homeExpenseType === option.value
                            ? colors.tint
                            : "transparent",
                      },
                    ]}
                    onPress={() => setHomeExpenseType(option.value)}
                  >
                    <Text
                      style={{
                        color:
                          homeExpenseType === option.value
                            ? "#fff"
                            : colors.text,
                        fontWeight: "700",
                        fontSize: 12,
                      }}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.label, { color: colors.subText }]}>
                金額（円）
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { color: colors.text, borderColor: colors.border },
                ]}
                value={homeAmount ? formatAmount(toInt(homeAmount, 0)) : ""}
                onChangeText={(text) =>
                  setHomeAmount(text.replace(/[^0-9]/g, ""))
                }
                keyboardType="number-pad"
              />

              <TouchableOpacity
                style={[styles.addButton, { backgroundColor: colors.tint }]}
                onPress={handleAddHousingEvent}
              >
                <Text style={styles.addButtonText}>住宅イベントを追加</Text>
              </TouchableOpacity>

              {housingEvents.length === 0 ? (
                <Text
                  style={[styles.emptyEventsText, { color: colors.subText }]}
                >
                  未登録です
                </Text>
              ) : (
                housingEvents.map((event) => (
                  <View
                    key={event.id}
                    style={[styles.eventCard, { borderColor: colors.border }]}
                  >
                    <View style={styles.eventCardHeader}>
                      <Text
                        style={[styles.eventCardTitle, { color: colors.text }]}
                      >
                        {event.homeName}
                      </Text>
                      <TouchableOpacity
                        onPress={() => handleDeleteHousingEvent(event.id)}
                      >
                        <Text style={styles.deleteEventText}>削除</Text>
                      </TouchableOpacity>
                    </View>
                    <Text
                      style={[styles.eventCardText, { color: colors.subText }]}
                    >
                      {event.purchaseYear}年 /
                      {
                        HOUSING_EXPENSE_TYPE_OPTIONS.find(
                          (item) => item.value === event.expenseType,
                        )?.label
                      }{" "}
                      ¥{formatAmount(event.amount)}
                    </Text>
                  </View>
                ))
              )}
            </>
          ) : null}
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <TouchableOpacity
            style={styles.collapseHeader}
            onPress={() => setIsCarSectionOpen((prev) => !prev)}
          >
            <Text style={[styles.subTitle, { color: colors.text }]}>
              大型出費イベント（クルマ）
            </Text>
            <Text style={[styles.collapseIcon, { color: colors.subText }]}>
              {isCarSectionOpen ? "▲" : "▼"}
            </Text>
          </TouchableOpacity>

          {isCarSectionOpen ? (
            <>
              <Text style={[styles.description, { color: colors.subText }]}>
                名称・購入年・種別・金額を登録して一時支出として反映します
              </Text>

              <Text style={[styles.label, { color: colors.subText }]}>
                名称
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { color: colors.text, borderColor: colors.border },
                ]}
                value={carName}
                onChangeText={setCarName}
                placeholder="例: ミニバン"
                placeholderTextColor={colors.subText}
              />

              <View style={styles.eventInputRow}>
                <View style={styles.eventInputCol}>
                  <Text style={[styles.label, { color: colors.subText }]}>
                    購入年
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      { color: colors.text, borderColor: colors.border },
                    ]}
                    value={carPurchaseYear}
                    onChangeText={(text) =>
                      setCarPurchaseYear(text.replace(/[^0-9]/g, ""))
                    }
                    keyboardType="number-pad"
                  />
                </View>
              </View>

              <Text style={[styles.label, { color: colors.subText }]}>
                種別
              </Text>
              <View style={styles.schoolKindRow}>
                {CAR_EXPENSE_TYPE_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.kindButton,
                      {
                        borderColor: colors.border,
                        backgroundColor:
                          carExpenseType === option.value
                            ? colors.tint
                            : "transparent",
                      },
                    ]}
                    onPress={() => setCarExpenseType(option.value)}
                  >
                    <Text
                      style={{
                        color:
                          carExpenseType === option.value
                            ? "#fff"
                            : colors.text,
                        fontWeight: "700",
                        fontSize: 12,
                      }}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.label, { color: colors.subText }]}>
                金額（円）
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { color: colors.text, borderColor: colors.border },
                ]}
                value={carAmount ? formatAmount(toInt(carAmount, 0)) : ""}
                onChangeText={(text) =>
                  setCarAmount(text.replace(/[^0-9]/g, ""))
                }
                keyboardType="number-pad"
              />

              <TouchableOpacity
                style={[styles.addButton, { backgroundColor: colors.tint }]}
                onPress={handleAddCarEvent}
              >
                <Text style={styles.addButtonText}>クルマイベントを追加</Text>
              </TouchableOpacity>

              {carEvents.length === 0 ? (
                <Text
                  style={[styles.emptyEventsText, { color: colors.subText }]}
                >
                  未登録です
                </Text>
              ) : (
                carEvents.map((event) => (
                  <View
                    key={event.id}
                    style={[styles.eventCard, { borderColor: colors.border }]}
                  >
                    <View style={styles.eventCardHeader}>
                      <Text
                        style={[styles.eventCardTitle, { color: colors.text }]}
                      >
                        {event.carName}
                      </Text>
                      <TouchableOpacity
                        onPress={() => handleDeleteCarEvent(event.id)}
                      >
                        <Text style={styles.deleteEventText}>削除</Text>
                      </TouchableOpacity>
                    </View>
                    <Text
                      style={[styles.eventCardText, { color: colors.subText }]}
                    >
                      {event.purchaseYear}年 /
                      {
                        CAR_EXPENSE_TYPE_OPTIONS.find(
                          (item) => item.value === event.expenseType,
                        )?.label
                      }{" "}
                      ¥{formatAmount(event.amount)}
                    </Text>
                  </View>
                ))
              )}
            </>
          ) : null}
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <TouchableOpacity
            style={styles.collapseHeader}
            onPress={() => setIsEducationSectionOpen((prev) => !prev)}
          >
            <Text style={[styles.subTitle, { color: colors.text }]}>
              大型出費イベント（教育）
            </Text>
            <Text style={[styles.collapseIcon, { color: colors.subText }]}>
              {isEducationSectionOpen ? "▲" : "▼"}
            </Text>
          </TouchableOpacity>

          {isEducationSectionOpen ? (
            <>
              <Text style={[styles.description, { color: colors.subText }]}>
                家族を選んで、教育関連費を一時支出として反映します
              </Text>

              <Text style={[styles.label, { color: colors.subText }]}>
                対象
              </Text>
              {familyTargetOptions.length === 0 ? (
                <Text
                  style={[styles.emptyEventsText, { color: colors.subText }]}
                >
                  子どもの家族構成を先に登録してください
                </Text>
              ) : (
                <>
                  <View style={styles.schoolKindRow}>
                    {familyTargetOptions.map((option) => (
                      <TouchableOpacity
                        key={option.key}
                        style={[
                          styles.kindButton,
                          {
                            borderColor: colors.border,
                            backgroundColor:
                              eventChildId === option.value
                                ? colors.tint
                                : "transparent",
                          },
                        ]}
                        onPress={() => setEventChildId(option.value)}
                      >
                        <Text
                          style={{
                            color:
                              eventChildId === option.value
                                ? "#fff"
                                : colors.text,
                            fontWeight: "700",
                            fontSize: 12,
                          }}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={[styles.label, { color: colors.subText }]}>
                    種別
                  </Text>
                  <View style={styles.schoolKindRow}>
                    {EDUCATION_EVENT_TYPE_OPTIONS.map((option) => (
                      <TouchableOpacity
                        key={option}
                        style={[
                          styles.kindButton,
                          {
                            borderColor: colors.border,
                            backgroundColor:
                              eventEducationType === option
                                ? colors.tint
                                : "transparent",
                          },
                        ]}
                        onPress={() => setEventEducationType(option)}
                      >
                        <Text
                          style={{
                            color:
                              eventEducationType === option
                                ? "#fff"
                                : colors.text,
                            fontWeight: "700",
                            fontSize: 12,
                          }}
                        >
                          {option}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={styles.eventInputRow}>
                    <View style={styles.eventInputCol}>
                      <Text style={[styles.label, { color: colors.subText }]}>
                        開始年
                      </Text>
                      <TextInput
                        style={[
                          styles.input,
                          { color: colors.text, borderColor: colors.border },
                        ]}
                        value={eventStartYear}
                        onChangeText={(text) =>
                          setEventStartYear(text.replace(/[^0-9]/g, ""))
                        }
                        keyboardType="number-pad"
                      />
                    </View>
                    <View style={styles.eventInputCol}>
                      <Text style={[styles.label, { color: colors.subText }]}>
                        年数
                      </Text>
                      <TextInput
                        style={[
                          styles.input,
                          { color: colors.text, borderColor: colors.border },
                        ]}
                        value={eventDurationYears}
                        onChangeText={(text) =>
                          setEventDurationYears(text.replace(/[^0-9]/g, ""))
                        }
                        keyboardType="number-pad"
                      />
                    </View>
                  </View>

                  <Text style={[styles.label, { color: colors.subText }]}>
                    年間費用（円）
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      { color: colors.text, borderColor: colors.border },
                    ]}
                    value={
                      eventAnnualCost
                        ? formatAmount(toInt(eventAnnualCost, 0))
                        : ""
                    }
                    onChangeText={(text) =>
                      setEventAnnualCost(text.replace(/[^0-9]/g, ""))
                    }
                    keyboardType="number-pad"
                  />

                  <TouchableOpacity
                    style={[styles.addButton, { backgroundColor: colors.tint }]}
                    onPress={handleAddEducationEvent}
                  >
                    <Text style={styles.addButtonText}>教育イベントを追加</Text>
                  </TouchableOpacity>
                </>
              )}

              {educationEvents.length === 0 ? (
                <Text
                  style={[styles.emptyEventsText, { color: colors.subText }]}
                >
                  未登録です
                </Text>
              ) : (
                educationEvents.map((event) => (
                  <View
                    key={event.id}
                    style={[styles.eventCard, { borderColor: colors.border }]}
                  >
                    <View style={styles.eventCardHeader}>
                      <Text
                        style={[styles.eventCardTitle, { color: colors.text }]}
                      >
                        {event.childName}
                      </Text>
                      <TouchableOpacity
                        onPress={() => handleDeleteEducationEvent(event.id)}
                      >
                        <Text style={styles.deleteEventText}>削除</Text>
                      </TouchableOpacity>
                    </View>
                    <Text
                      style={[styles.eventCardText, { color: colors.subText }]}
                    >
                      {event.educationType ? `${event.educationType} / ` : ""}
                      {event.startYear}年開始 / {event.durationYears}年 / 年額 ¥
                      {formatAmount(event.annualCost)}
                    </Text>
                  </View>
                ))
              )}
            </>
          ) : null}
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.subTitle, { color: colors.text }]}>
            年次テーブル
          </Text>
          {projectionRows.map((row) => (
            <View
              key={row.year}
              style={[styles.rowCard, { borderColor: colors.border }]}
            >
              <Text style={[styles.rowYear, { color: colors.text }]}>
                {row.year}年
              </Text>
              <Text style={[styles.rowText, { color: colors.subText }]}>
                収入: ¥{formatAmount(row.income)}
              </Text>
              <Text style={[styles.rowText, { color: colors.subText }]}>
                支出: ¥{formatAmount(row.expense)}
              </Text>
              <Text style={[styles.rowText, { color: colors.subText }]}>
                年間収支: ¥{formatAmount(row.netCashFlow)}
              </Text>
              <Text style={[styles.rowText, { color: colors.subText }]}>
                運用損益: ¥{formatAmount(row.investmentGain)}
              </Text>
              <Text
                style={[
                  styles.rowBalance,
                  {
                    color:
                      row.closingBalance >= 0 ? colors.income : colors.expense,
                  },
                ]}
              >
                年末資産: ¥{formatAmount(row.closingBalance)}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <Modal
        visible={isSuggestionPopupVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsSuggestionPopupVisible(false)}
      >
        <View style={styles.popupBackdrop}>
          <View
            style={[
              styles.popupCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.memberHeader}>
              <Text style={[styles.memberTitle, { color: colors.text }]}>
                教育費提案（自動）
              </Text>
              <TouchableOpacity
                onPress={() => setIsSuggestionPopupVisible(false)}
              >
                <Text style={[styles.resetText, { color: colors.tint }]}>
                  閉じる
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.popupScroll}
              contentContainerStyle={styles.popupScrollContent}
            >
              <View style={[styles.sourceCard, { borderColor: colors.border }]}>
                <Text style={[styles.memberTitle, { color: colors.text }]}>
                  教育費・塾/習い事費の根拠
                </Text>
                <Text style={[styles.eventCardText, { color: colors.subText }]}>
                  各年額は以下の公的統計等をベースにした概算値です。
                </Text>
                {costSourceItems.map((item, index) => (
                  <TouchableOpacity
                    key={`${item.url}-${index}`}
                    onPress={() => handleOpenSourceLink(item.url)}
                  >
                    <Text
                      style={[styles.sourceLinkText, { color: colors.tint }]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {educationSuggestions.map((item, index) => (
                <Text
                  key={`${item.childId}-${item.stageKey}-${index}`}
                  style={[styles.eventCardText, { color: colors.subText }]}
                >
                  {item.childName} / {item.stageLabel}（
                  {item.schoolKind === "common"
                    ? "共通"
                    : item.schoolKind === "public"
                      ? "公立"
                      : "私立"}
                  ）: {item.startYear}年〜
                  {item.startYear + item.durationYears - 1}年 / 年額 ¥
                  {formatAmount(item.annualCost)}
                </Text>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: colors.tint }]}
              onPress={handleApplyEducationSuggestions}
            >
              <Text style={styles.addButtonText}>
                提案を教育イベントとして登録
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {birthDatePickerTarget ? (
        <View
          style={[
            styles.datePickerCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.memberHeader}>
            <Text style={[styles.memberTitle, { color: colors.text }]}>
              生年月日を選択
            </Text>
            <TouchableOpacity onPress={() => setBirthDatePickerTarget(null)}>
              <Text style={[styles.resetText, { color: colors.tint }]}>
                閉じる
              </Text>
            </TouchableOpacity>
          </View>
          <DateTimePicker
            value={birthDatePickerValue}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            maximumDate={new Date()}
            onChange={handleBirthDateChange}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fixedSummaryCard: {
    marginHorizontal: 14,
    marginTop: 14,
    marginBottom: 8,
    zIndex: 20,
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    borderBottomWidth: 2,
  },
  mainScroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 14,
    paddingBottom: 30,
    paddingTop: 6,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 6 },
  collapseHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  collapseIcon: { fontSize: 13, fontWeight: "700" },
  description: { fontSize: 13, marginBottom: 10 },
  label: { fontSize: 12, marginTop: 8, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dateInputBase: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dateInputButton: {
    justifyContent: "center",
  },
  dateInputText: {
    fontSize: 16,
  },
  subTitle: { fontSize: 16, fontWeight: "700" },
  assumptionHeader: {
    marginTop: 12,
    marginBottom: 4,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  resetText: { fontSize: 12, fontWeight: "600" },
  assumptionMetaText: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
  },
  assumptionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  assumptionLabel: { flex: 1, fontSize: 13, fontWeight: "500" },
  rateInput: {
    width: 78,
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    textAlign: "right",
  },
  rateUnit: { marginLeft: 6, fontSize: 12 },
  eventInputRow: {
    flexDirection: "row",
    gap: 8,
  },
  eventInputCol: { flex: 1 },
  addButton: {
    marginTop: 12,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  addButtonText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  familyHint: { marginTop: 8, fontSize: 12 },
  secondaryButton: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  secondaryButtonText: { fontSize: 13, fontWeight: "700" },
  iconButton: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonText: { fontSize: 20, lineHeight: 22, fontWeight: "700" },
  sourceCard: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  sourceLinkText: {
    fontSize: 12,
    marginTop: 6,
    textDecorationLine: "underline",
  },
  memberCard: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  memberHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  memberHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  collapseChevron: {
    fontSize: 11,
  },
  memberTitle: { fontSize: 14, fontWeight: "700" },
  schoolKindRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 8,
  },
  kindButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  datePickerCard: {
    borderWidth: 1,
    borderRadius: 12,
    marginHorizontal: 14,
    marginBottom: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  popupBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  popupCard: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    maxHeight: "85%",
  },
  popupScroll: {
    marginTop: 8,
  },
  popupScrollContent: {
    paddingBottom: 8,
  },
  emptyEventsText: { marginTop: 10, fontSize: 12 },
  eventCard: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  eventCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  eventCardTitle: { fontSize: 13, fontWeight: "700" },
  deleteEventText: { fontSize: 12, color: "#C62828", fontWeight: "700" },
  eventCardText: { fontSize: 12, marginTop: 4 },
  summaryText: { marginTop: 8, fontSize: 13 },
  summaryAmount: { marginTop: 8, fontSize: 24, fontWeight: "800" },
  rowCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
  },
  rowYear: { fontSize: 14, fontWeight: "700", marginBottom: 4 },
  rowText: { fontSize: 12, marginTop: 1 },
  rowBalance: { fontSize: 14, fontWeight: "700", marginTop: 6 },
});
