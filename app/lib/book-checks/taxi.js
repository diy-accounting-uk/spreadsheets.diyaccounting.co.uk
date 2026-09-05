// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// book-checks/taxi.js -- the Taxi Driver book's own warnings: a fare day
// with no miles of its own where other fare days carry them, a vehicle
// bought but never entered on the Fixed Assets register, and business
// miles crossing the year's higher-rate mileage band. All three are
// advisory: they warn, never fail, and never block a save.
//
// Pure functions only, no Node built-ins and no DOM, so the page, the CLI
// and the MCP server run the same rules. book-checks.js picks this module
// up from the book's own entityInformation["diya-gl:product"].

const FARE_ACCOUNT = "4000";
const VEHICLE_ACCOUNT = "7000";

function formatMoney(value) {
  const sign = value < 0 ? "-" : "";
  return sign + "£" + Math.abs(value).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function byEntryNumber(a, b) {
  const ka = a.entryNumber || "";
  const kb = b.entryNumber || "";
  return ka < kb ? -1 : ka > kb ? 1 : 0;
}

function byPostingDate(a, b) {
  return a.postingDate < b.postingDate ? -1 : a.postingDate > b.postingDate ? 1 : 0;
}

function offenderOf(line) {
  return {
    entryNumber: line.entryNumber,
    postingDate: line.postingDate,
    accountMainID: line.accountMainID,
    detail: line.detailComment || "",
    amount: line.amount,
  };
}

function monthKeyOf(dateStr) {
  return dateStr.slice(0, 7);
}

// A book field parsed from TOML carries its date as a Date (smol-toml's
// TomlDate); a line's own postingDate, parsed from JSON, is already a
// plain "YYYY-MM-DD" string. Both compare as the same ISO string.
function isoDate(value) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

// A line's own miles: present only when both the unit and a usable
// quantity are there. A line naming the unit but carrying no quantity
// (or vice versa) has no usable mileage.
function hasOwnMiles(line) {
  return line.measurableUnitOfMeasure === "miles" && typeof line.measurableQuantity === "number" && isFinite(line.measurableQuantity);
}

// ============================== book-taxi-fare-miles ==============================

function isFareLine(line) {
  return line.sourceJournalID === "sales" && String(line.accountMainID) === FARE_ACCOUNT && line.amount > 0;
}

function fareDayNoMilesWarning(ctx) {
  const fareLines = ctx.lines.filter(isFareLine);
  const anyCarryMiles = fareLines.some(hasOwnMiles);
  const offenders = anyCarryMiles ? fareLines.filter((line) => !hasOwnMiles(line)).sort(byEntryNumber) : [];
  const warn = offenders.length > 0;
  const result = {
    id: "book-taxi-fare-miles",
    tier: "warning",
    label: "Every fare day carrying miles elsewhere carries its own",
    result: warn ? "warn" : "pass",
    actual: offenders.length,
    consequence: warn
      ? "A fare day with no miles of its own leaves the year's business mileage claim short by whatever miles that day drove."
      : null,
    offenders: offenders.map(offenderOf),
  };
  if (warn) result.helper = { id: "book-taxi-fare-miles", label: "Enter the day's miles", kind: "focus", field: "miles" };
  return result;
}

// ============================== book-taxi-vehicle-register ==============================

function isVehiclePurchaseLine(line) {
  return line.sourceJournalID === "purchases" && String(line.accountMainID) === VEHICLE_ACCOUNT;
}

// Costs and amounts compared to the penny, guarded against binary-float
// noise the way the shared checks compare amounts.
function penceEqual(a, b) {
  return Math.round((a || 0) * 100) === Math.round((b || 0) * 100);
}

function isOnRegister(book, line) {
  const assets = (book && book.fixedAssets) || [];
  return assets.some((asset) => isoDate(asset.acquiredDate) === line.postingDate && penceEqual(asset.cost, line.amount));
}

function unregisteredVehicleLines(ctx) {
  return ctx.lines.filter((line) => isVehiclePurchaseLine(line) && !isOnRegister(ctx.book, line)).sort(byEntryNumber);
}

function vehicleNotOnRegisterWarning(ctx) {
  const offenders = unregisteredVehicleLines(ctx);
  const warn = offenders.length > 0;
  const result = {
    id: "book-taxi-vehicle-register",
    tier: "warning",
    label: "Every vehicle bought is on the Fixed Assets register",
    result: warn ? "warn" : "pass",
    actual: offenders.length,
    consequence: warn
      ? "A vehicle bought but not entered on the Fixed Assets register earns no capital allowance, and PurchasesMar!T2 has nothing to schedule against it."
      : null,
    offenders: offenders.map(offenderOf),
  };
  if (warn) result.helper = { id: "book-taxi-vehicle-register", label: "Register these vehicles", kind: "book" };
  return result;
}

// The next asset id a registered vehicle takes: "FA-" plus the existing
// register's length, one-based and zero-padded to three digits.
function nextAssetID(existingCount, offset) {
  return "FA-" + String(existingCount + offset).padStart(3, "0");
}

function registerVehiclePlan(ctx, offenders) {
  return {
    title: "Register these vehicles",
    changes: offenders.map((line) => ({
      entryNumber: line.entryNumber,
      what: "asset",
      becomes: (line.lineItemComment || line.detailComment || "") + " " + formatMoney(line.amount) + " bought " + line.postingDate,
    })),
  };
}

function registerVehicleApply(ctx, offenders) {
  const existing = (ctx.book && ctx.book.fixedAssets) || [];
  const newAssets = offenders.map((line, index) => ({
    assetID: nextAssetID(existing.length, index + 1),
    description: line.lineItemComment || line.detailComment || "",
    cost: line.amount,
    acquiredDate: line.postingDate,
  }));
  return { ...ctx.book, fixedAssets: existing.concat(newAssets) };
}

// ============================== book-taxi-miles-band ==============================

function milesPastBandWarning(ctx, taxData) {
  const limit =
    taxData && taxData.mileage && typeof taxData.mileage.higher_rate_limit === "number" ? taxData.mileage.higher_rate_limit : null;
  const milesLines = ctx.lines
    .filter((line) => (line.sourceJournalID === "sales" || line.sourceJournalID === "purchases") && hasOwnMiles(line))
    .slice()
    .sort(byPostingDate);

  const byMonth = new Map();
  for (const line of milesLines) {
    const month = monthKeyOf(line.postingDate);
    byMonth.set(month, (byMonth.get(month) || 0) + line.measurableQuantity);
  }

  let offender = null;
  if (limit !== null) {
    let running = 0;
    for (const month of Array.from(byMonth.keys()).sort()) {
      running += byMonth.get(month);
      if (running > limit) {
        offender = { month: month, milesToDate: running };
        break;
      }
    }
  }

  const warn = offender !== null;
  return {
    id: "book-taxi-miles-band",
    tier: "warning",
    label: "Business miles stay inside the higher-rate band",
    result: warn ? "warn" : "pass",
    actual: warn ? 1 : 0,
    consequence: warn
      ? "Business miles crossed the " +
        limit +
        "-mile higher-rate limit in " +
        offender.month +
        ", after " +
        offender.milesToDate +
        " miles; miles claimed after that point go in at the lower rate instead of the higher one."
      : null,
    offenders: warn ? [offender] : [],
  };
}

// ============================== exports ==============================

export const TAXI_WARNINGS = [fareDayNoMilesWarning, vehicleNotOnRegisterWarning, milesPastBandWarning];

export const TAXI_BOOK_HELPERS = {
  "book-taxi-vehicle-register": {
    offenders: unregisteredVehicleLines,
    buildHelper: registerVehiclePlan,
    apply: registerVehicleApply,
  },
};

export const TAXI_PRODUCT_RULES = { checks: [], warnings: TAXI_WARNINGS, sharedOffenders: {}, bookHelpers: TAXI_BOOK_HELPERS };
