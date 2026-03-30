export type ChildEducationEvent = {
  id: number;
  eventType: "child_education";
  childId?: number;
  childName: string;
  educationType?: string;
  startYear: number;
  durationYears: number;
  annualCost: number;
};

export type CarPurchaseEvent = {
  id: number;
  eventType: "car_purchase";
  carName: string;
  purchaseYear: number;
  expenseType: "purchase" | "repair" | "inspection" | "other";
  amount: number;
};

export type HousingPurchaseEvent = {
  id: number;
  eventType: "housing_purchase";
  homeName: string;
  purchaseYear: number;
  expenseType: "downPayment" | "repair" | "renovation" | "other";
  amount: number;
};

export type LifeEvent =
  | ChildEducationEvent
  | CarPurchaseEvent
  | HousingPurchaseEvent;

export function expandLifeEventsByYear(
  events: LifeEvent[],
  startYear: number,
  years: number,
): Record<number, number> {
  const result: Record<number, number> = {};
  const endYear = startYear + Math.max(1, years) - 1;

  for (const event of events) {
    if (event.eventType === "child_education") {
      const begin = Math.max(event.startYear, startYear);
      const finish = Math.min(
        event.startYear + Math.max(1, event.durationYears) - 1,
        endYear,
      );

      for (let year = begin; year <= finish; year += 1) {
        result[year] = (result[year] ?? 0) + Math.max(0, event.annualCost);
      }
      continue;
    }

    if (event.eventType === "car_purchase") {
      if (event.purchaseYear >= startYear && event.purchaseYear <= endYear) {
        result[event.purchaseYear] =
          (result[event.purchaseYear] ?? 0) + Math.max(0, event.amount);
      }
      continue;
    }

    if (event.eventType === "housing_purchase") {
      if (event.purchaseYear >= startYear && event.purchaseYear <= endYear) {
        result[event.purchaseYear] =
          (result[event.purchaseYear] ?? 0) + Math.max(0, event.amount);
      }
    }
  }

  return result;
}
