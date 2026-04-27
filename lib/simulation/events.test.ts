import assert from "node:assert/strict";
import test from "node:test";

import {
    expandLifeEventsByYear,
    type CarPurchaseEvent,
    type ChildEducationEvent,
    type HousingPurchaseEvent,
} from "./events";

test("expandLifeEventsByYear accepts Firestore string ids", () => {
  const educationEvent: ChildEducationEvent = {
    id: "education-1",
    eventType: "child_education",
    childName: "長女",
    startYear: 2028,
    durationYears: 2,
    annualCost: 500000,
  };
  const carEvent: CarPurchaseEvent = {
    id: "car-1",
    eventType: "car_purchase",
    carName: "ファミリーカー",
    purchaseYear: 2029,
    expenseType: "purchase",
    amount: 1800000,
  };
  const housingEvent: HousingPurchaseEvent = {
    id: "housing-1",
    eventType: "housing_purchase",
    homeName: "自宅",
    purchaseYear: 2030,
    expenseType: "repair",
    amount: 700000,
  };

  assert.deepEqual(
    expandLifeEventsByYear([educationEvent, carEvent, housingEvent], 2028, 4),
    {
      2028: 500000,
      2029: 2300000,
      2030: 700000,
    },
  );
});
