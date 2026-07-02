import assert from "node:assert/strict";
import test from "node:test";

import {
    buildCsvImportAccess,
    CSV_IMPORT_PRICE_LABEL,
    CSV_IMPORT_PRODUCT_ID,
    getCsvImportAccessFromEnv,
    getCsvImportPurchaseEnvFlags,
    hasCsvImportPurchase,
    parseCsvImportEntitlement,
    serializeCsvImportEntitlement,
} from "./csvImportPurchaseGate";

test("csv import stays available when purchase gate is disabled", () => {
  const access = buildCsvImportAccess({
    purchaseRequired: false,
    entitlementPurchased: false,
  });

  assert.equal(access.allowed, true);
  assert.equal(access.productId, CSV_IMPORT_PRODUCT_ID);
  assert.equal(access.priceLabel, CSV_IMPORT_PRICE_LABEL);
});

test("csv import is blocked when purchase is required but entitlement is missing", () => {
  const access = buildCsvImportAccess({
    purchaseRequired: true,
    entitlementPurchased: false,
  });

  assert.equal(access.allowed, false);
  assert.match(access.message, /CSVインポート/);
  assert.match(access.message, /¥300/);
});

test("csv import is available when purchase is required and entitlement exists", () => {
  const access = buildCsvImportAccess({
    purchaseRequired: true,
    entitlementPurchased: true,
  });

  assert.equal(access.allowed, true);
});

test("csv import gate is disabled unless explicitly enabled by environment", () => {
  const access = getCsvImportAccessFromEnv({});

  assert.equal(access.allowed, true);
});

test("purchase env flags are parsed independently", () => {
  assert.deepEqual(getCsvImportPurchaseEnvFlags({}), {
    purchaseRequired: false,
    envUnlocked: false,
  });
  assert.deepEqual(
    getCsvImportPurchaseEnvFlags({
      EXPO_PUBLIC_CSV_IMPORT_IAP_ENABLED: "1",
      EXPO_PUBLIC_CSV_IMPORT_UNLOCKED: "1",
    }),
    { purchaseRequired: true, envUnlocked: true },
  );
});

test("entitlement is detected only for the purchased csv import product", () => {
  assert.equal(hasCsvImportPurchase([]), false);
  assert.equal(
    hasCsvImportPurchase([
      { productId: "other_product", purchaseState: "purchased" },
    ]),
    false,
  );
  assert.equal(
    hasCsvImportPurchase([
      { productId: CSV_IMPORT_PRODUCT_ID, purchaseState: "pending" },
    ]),
    false,
  );
  assert.equal(
    hasCsvImportPurchase([
      { productId: "other_product", purchaseState: "purchased" },
      { productId: CSV_IMPORT_PRODUCT_ID, purchaseState: "purchased" },
    ]),
    true,
  );
});

test("entitlement file round-trips and rejects invalid content", () => {
  assert.equal(
    parseCsvImportEntitlement(serializeCsvImportEntitlement(true)),
    true,
  );
  assert.equal(
    parseCsvImportEntitlement(serializeCsvImportEntitlement(false)),
    false,
  );
  assert.equal(parseCsvImportEntitlement("not json"), false);
  assert.equal(parseCsvImportEntitlement("{}"), false);
  assert.equal(
    parseCsvImportEntitlement('{"csvImportPurchased":"yes"}'),
    false,
  );
});

test("csv import gate can be enabled and unlocked by environment", () => {
  const locked = getCsvImportAccessFromEnv({
    EXPO_PUBLIC_CSV_IMPORT_IAP_ENABLED: "1",
  });
  const unlocked = getCsvImportAccessFromEnv({
    EXPO_PUBLIC_CSV_IMPORT_IAP_ENABLED: "1",
    EXPO_PUBLIC_CSV_IMPORT_UNLOCKED: "1",
  });

  assert.equal(locked.allowed, false);
  assert.equal(unlocked.allowed, true);
});
