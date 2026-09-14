// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// se-fixture-figures.js — independent derivations of SE fixture figures the
// reconciliation checks under test compare against, built straight from a
// loaded scenario's own transaction and asset rows and the tax year's rate
// tables. Never calls the SE calculator (app/lib/calculators/se.js) or its
// checks (app/products/se.js) — the code these tests exercise — so a check
// that passes here is anchored in the fixture, not in the engine it is
// checking. Shared because more than one SE test file needs the same
// derivation.

import { splitVat } from "../../lib/tax/vat.js";

function roundedNetOfVat(gross, rate) {
  return Math.round((gross / (1 + rate)) * 100) / 100;
}

/**
 * The VAT fraction a scenario's journal amounts were entered gross of: nil
 * for a scenario that declares itself unregistered, the tax year's own
 * standard rate otherwise.
 * @param {Object} scenario - a loaded scenario
 * @param {Object} taxData - the tax year's data (app/data/<year>.toml)
 * @returns {number}
 */
export function vatRateForScenario(scenario, taxData) {
  return scenario?.metadata?.vat_registered === false ? 0 : (taxData?.vat?.standard_rate ?? 0);
}

/**
 * Every sales transaction's net-of-VAT amount, summed by its code letter.
 * Mirrors the SE calculator's own per-code sales total (the Sales month
 * tabs' analysis columns), computed independently from the raw journal.
 * @param {Object} scenario - a loaded scenario
 * @param {number} rate - the VAT fraction sales were entered gross of
 * @returns {Object} code letter -> net total for the year
 */
export function salesNetByCode(scenario, rate) {
  const net = {};
  for (const transactions of Object.values(scenario.sales || {})) {
    for (const tx of transactions) {
      if (tx.mileage) continue;
      const code = tx.code || "a";
      net[code] = (net[code] || 0) + splitVat(tx.amount, rate).net;
    }
  }
  return net;
}

/**
 * One Bank.xlsx code letter's receipts for the year. A bank entry carries no
 * VAT to strip off, unlike a sales or purchase journal row.
 * @param {Object} scenario - a loaded scenario
 * @param {string} code - the bank journal's own code letter
 * @returns {number}
 */
export function bankReceiptsByCode(scenario, code) {
  let total = 0;
  for (const transactions of Object.values(scenario.bank || {})) {
    for (const tx of transactions) {
      const file = (tx.account || "1200") === "1220" ? "Cash.xlsx" : "Bank.xlsx";
      if (file === "Bank.xlsx" && tx.code === code && tx.direction === "in") total += tx.amount;
    }
  }
  return total;
}

// Fixedassets.xlsx!Schedule reads an opening asset's depreciation rate off
// its category.
const EXISTING_ASSET_DEPRECIATION_RATE_KEYS = { motor: "motor_vehicles", computer: "computer_equipment" };
// The schedule's "new plant" block holds five rows; a sixth capital
// purchase the schedule has no row for is left out, the same way the sheet
// leaves it out.
const NEW_ASSET_ROW_LIMIT = 5;

// The scenario's opening fixed assets, in declaration order, bucketed by
// the category Fixedassets.xlsx!Schedule reads their rows off.
function openingAssetsByCategory(scenario) {
  const byCategory = { motor: [], computer: [] };
  for (const asset of scenario.opening_fixed_assets || []) {
    if (byCategory[asset.category]) byCategory[asset.category].push(asset);
  }
  return byCategory;
}

// The scenario's "fa" coded capital purchases, in declaration order,
// capped at the schedule's five "new plant" rows.
function newAssetPurchases(scenario) {
  const purchases = [];
  for (const transactions of Object.values(scenario.purchases || {})) {
    for (const tx of transactions) if (tx.code === "fa") purchases.push(tx);
  }
  return purchases.slice(0, NEW_ASSET_ROW_LIMIT);
}

// Each "fs" coded disposal's net proceeds, paired with the opening asset it
// disposes of: the motor category's assets first, then the computer
// category's, in declaration order — Fixedassets.xlsx!Schedule's own
// pairing rule.
function disposalsByAsset(scenario, byCategory, rate) {
  const disposalOrder = [...byCategory.motor, ...byCategory.computer];
  const proceedsInOrder = [];
  for (const transactions of Object.values(scenario.sales || {})) {
    for (const tx of transactions) if (tx.code === "fs") proceedsInOrder.push(roundedNetOfVat(tx.amount, rate));
  }
  const byAsset = new Map();
  proceedsInOrder.forEach((proceeds, index) => {
    if (disposalOrder[index]) byAsset.set(disposalOrder[index], proceeds);
  });
  return byAsset;
}

/**
 * The year's depreciation charge (Profit & Loss Account row 34) and loss on
 * disposal (row 33) Fixedassets.xlsx!Schedule carries, computed asset by
 * asset from the scenario's own opening_fixed_assets and its "fa"/"fs"
 * coded transactions and the tax year's depreciation rates: an existing
 * asset's charge is its rate on cost, capped at what is left to write off;
 * a new asset's is the whole year's rate on cost; a disposed asset's loss
 * is its cost less its written down value (opening plus this year's
 * charge) less the sale proceeds.
 * @param {Object} scenario - a loaded scenario
 * @param {Object} taxData - the tax year's data (app/data/<year>.toml)
 * @param {number} rate - the VAT fraction capital transactions were entered gross of
 * @returns {{totalDepreciation: number, disposalLoss: number}}
 */
export function depreciationAndDisposalLoss(scenario, taxData, rate) {
  const depreciationRates = taxData?.depreciation || {};
  const byCategory = openingAssetsByCategory(scenario);

  const chargeByAsset = new Map();
  let existingCharge = 0;
  for (const [category, rateKey] of Object.entries(EXISTING_ASSET_DEPRECIATION_RATE_KEYS)) {
    const depRate = depreciationRates[rateKey] ?? 0;
    for (const asset of byCategory[category]) {
      const nbv = asset.cost - (asset.acc_dep || 0);
      const charge = Math.min(asset.cost * depRate, nbv);
      chargeByAsset.set(asset, charge);
      existingCharge += charge;
    }
  }

  const plantRate = depreciationRates.plant_and_machinery ?? 0;
  const newAssetsCharge = newAssetPurchases(scenario).reduce((total, tx) => total + roundedNetOfVat(tx.amount, rate) * plantRate, 0);

  const disposals = disposalsByAsset(scenario, byCategory, rate);
  let disposalLoss = 0;
  for (const [asset, proceeds] of disposals) {
    const writtenDownAfterCharge = (asset.acc_dep || 0) + (chargeByAsset.get(asset) || 0);
    disposalLoss += asset.cost - writtenDownAfterCharge - proceeds;
  }

  return { totalDepreciation: existingCharge + newAssetsCharge, disposalLoss };
}

/**
 * The year's capital allowances total (Profit Forecast!C38, "the fixed
 * asset schedule" — Schedule!Q1 + R1 + AC1 + Y1 - Z1) computed asset by
 * asset from the scenario's own opening_fixed_assets and its "fa"/"fs"
 * coded transactions and the tax year's allowance rates: a new asset
 * claims the Annual Investment Allowance in full; an existing asset with a
 * tax written down value claims a writing down allowance at the main rate,
 * or the special rate on the special-rate pool, on its business share (one
 * less the private use proportion a motor asset states); an asset marked
 * single_asset_pool is its own pool, so its allowance is counted apart
 * from the main and special rate pools it would otherwise join, while the
 * printed boxes 50 and 51 (R1 and AC1) still carry it by rate; a disposed
 * asset's allowance pool residual (its tax written down value less the
 * writing down allowance just claimed on it) is compared against the sale
 * proceeds for a balancing allowance or charge, again on the business
 * share.
 * @param {Object} scenario - a loaded scenario
 * @param {Object} taxData - the tax year's data (app/data/<year>.toml)
 * @param {number} rate - the VAT fraction capital transactions were entered gross of
 * @returns {{aia: number, mainPoolWda: number, specialPoolWda: number, singleAssetMainWda: number, singleAssetSpecialWda: number, singleAssetWrittenDown: number, balancingAllowance: number, balancingCharge: number, total: number}}
 */
export function capitalAllowancesFromSchedule(scenario, taxData, rate) {
  const wdaRate = taxData?.capital_allowances?.writing_down_allowance ?? 0;
  const specialRate = taxData?.capital_allowances?.writing_down_allowance_special ?? 0;
  const aiaRate = taxData?.capital_allowances?.annual_investment_allowance ?? 0;

  const byCategory = openingAssetsByCategory(scenario);
  const disposals = disposalsByAsset(scenario, byCategory, rate);

  let mainPoolWda = 0;
  let specialPoolWda = 0;
  let singleAssetMainWda = 0;
  let singleAssetSpecialWda = 0;
  let singleAssetWrittenDown = 0;
  let balancingAllowance = 0;
  let balancingCharge = 0;
  for (const [category, assets] of Object.entries(byCategory)) {
    for (const asset of assets) {
      const taxWdv = asset.tax_wdv;
      if (typeof taxWdv !== "number" || taxWdv <= 0) continue;
      const special = asset.pool === "special";
      // The Schedule applies the private use share (column M) on the motor
      // rows only.
      const businessShare = category === "motor" ? 1 - (asset.private_use || 0) : 1;
      const wda = taxWdv * (special ? specialRate : wdaRate) * businessShare;
      if (asset.single_asset_pool === true) {
        if (special) singleAssetSpecialWda += wda;
        else singleAssetMainWda += wda;
        singleAssetWrittenDown += taxWdv - wda;
      } else if (special) specialPoolWda += wda;
      else mainPoolWda += wda;

      const proceeds = disposals.get(asset);
      if (proceeds === undefined) continue;
      const poolResidual = taxWdv - wda;
      if (proceeds < poolResidual) balancingAllowance += (poolResidual - proceeds) * businessShare;
      else if (proceeds > poolResidual) balancingCharge += (proceeds - poolResidual) * businessShare;
    }
  }

  const aia = newAssetPurchases(scenario).reduce((total, tx) => total + roundedNetOfVat(tx.amount, rate) * aiaRate, 0);

  return {
    aia,
    mainPoolWda,
    specialPoolWda,
    singleAssetMainWda,
    singleAssetSpecialWda,
    singleAssetWrittenDown,
    balancingAllowance,
    balancingCharge,
    total: aia + mainPoolWda + specialPoolWda + singleAssetMainWda + singleAssetSpecialWda + balancingAllowance - balancingCharge,
  };
}
