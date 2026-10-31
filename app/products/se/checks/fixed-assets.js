// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited

import { netOfVat } from "../../../lib/product-sheets/vat-rate.js";
import { EXISTING_ASSET_ROWS, SINGLE_ASSET_POOL_MARKER } from "../layout.js";
import { MONTH_COLS } from "../reads.js";
import { fixtureSmallPools, openingPoolAllowance } from "../report.js";

export function checkFixedAssets(ctx) {
  const { check, checkText, expected, num, pl, rate, results, taxData } = ctx;

  // ── Fixed assets (Fixedassets.xlsx Schedule vs Purchases/Sales, and P&L) ──
  //
  // 1. Note vs schedule. FAreconciliation is the workbook's own tie-out
  //    between the asset schedule and the two ledgers. E11/K11 re-sum the
  //    Schedule's New-asset and disposal rows; E13/K13 read the cumulative
  //    fixed asset totals straight out of Purchases.xlsx and Sales.xlsx
  //    across a leaf-to-leaf external link. Comparing the two sides is the
  //    comparison the sheet was built to make. The scenario's own
  //    "fa"/"fs"-coded net totals then anchor both sides to what a customer
  //    actually typed in, so a schedule and a ledger that agree on the wrong
  //    figure still fails.
  const fr = results["Fixedassets.xlsx!FAreconciliation"];
  if (fr) {
    check("Fixed assets: Schedule new-asset additions = Purchases.xlsx fixed asset total", fr.E11 || 0, fr.E13 || 0);
    check("Fixed assets: Schedule disposals = Sales.xlsx fixed asset sales total", fr.K11 || 0, fr.K13 || 0);
  }
  if (fr && expected.purchases) {
    let faGross = 0;
    for (const transactions of Object.values(expected.purchases)) {
      for (const tx of transactions) if (tx.code === "fa") faGross += tx.amount;
    }
    const faNet = netOfVat(faGross, rate);
    check("Fixed assets: Schedule new-asset additions (FAreconciliation E11) = scenario fa-coded net total", fr.E11 || 0, faNet);
  }
  if (fr && expected.sales) {
    let fsGross = 0;
    for (const transactions of Object.values(expected.sales)) {
      for (const tx of transactions) if (tx.code === "fs") fsGross += tx.amount;
    }
    const fsNet = netOfVat(fsGross, rate);
    check("Fixed assets: Schedule disposals (FAreconciliation K11) = scenario fs-coded net total", fr.K11 || 0, fsNet);
  }

  const sched = results["Fixedassets.xlsx!Schedule"];
  if (sched) {
    // 2. Closing NBV identity within the Schedule itself: cost less
    //    disposals, less depreciation carried forward less depreciation on
    //    the disposals. (The equivalent opening identity does not hold in
    //    this template: the "New Fixed Assets" rows have no opening-WDV
    //    formula at all -- G is blank for a New row regardless of E -- so
    //    G1 is the existing-assets figure alone while E1/F1 include in-year
    //    additions. Asserting G1 = E1-F1 would be checking a false
    //    identity, not the workbook's own logic.)
    check(
      "Fixed assets: closing NBV = cost less disposals, less depreciation carried forward less depreciation on disposals",
      sched.K1 || 0,
      (sched.E1 || 0) - (sched.W1 || 0) - ((sched.J1 || 0) - (sched.X1 || 0)),
    );

    // The schedule's cost total against its own two halves, so the Fixed
    // Asset Schedule section's opening and additions lines are the sheet's
    // figures rather than a total split by the report.
    check(
      "Fixed assets: Schedule total cost = existing assets plus assets bought in the year",
      sched.E1 || 0,
      (sched.E57 || 0) + (sched.E110 || 0),
    );

    // The special rate pool's rate reaches the Schedule across the link
    // from Admin!G6 (AC4 = [1]Admin!$G$6), and the pool's allowance (AC1) is
    // the marked assets' tax written-down values at that rate, so an asset
    // whose marker was lost, or a row whose R formula still claims the main
    // rate, moves this.
    if (taxData?.capital_allowances && expected.opening_fixed_assets) {
      check(
        "Fixed assets: Schedule special rate (AC4) = Admin special rate WDA",
        sched.AC4 || 0,
        taxData.capital_allowances.writing_down_allowance_special || 0,
        0.0001,
      );
      check(
        "Fixed assets: Schedule special rate pool allowance (AC1) = the scenario's special rate assets at the year's special rate, less private use",
        sched.AC1 || 0,
        openingPoolAllowance(expected, "special") * (taxData.capital_allowances.writing_down_allowance_special || 0),
      );

      // The pooled written-down values by rate pool (AH, AI), and each
      // pool's balance before this year's allowance, which is what the small
      // pools test runs over: the main pool's from the van and the year's
      // additions, the special rate pool's from the estate car's 9,000
      // alone, so a pool that counted the other's balance, or a single asset
      // pool's, moves here.
      const pools = fixtureSmallPools(expected, taxData, rate);
      check(
        "Fixed assets: Schedule main pool written down value (AH1) = the scenario's pooled main rate assets' tax written-down values less this year's allowance, plus additions less their annual investment allowance",
        sched.AH1 || 0,
        pools.main.writtenDown,
      );
      check(
        "Fixed assets: Schedule special rate pool written down value (AI1) = the scenario's pooled special rate assets' tax written-down values less this year's allowance",
        sched.AI1 || 0,
        pools.special.writtenDown,
      );
      check(
        "Fixed assets: main pool balance before this year's allowance (R1 - AE1 + AH1) = the scenario's pooled main rate assets' tax written-down values plus additions less their annual investment allowance",
        num(sched.R1) - num(sched.AE1) + num(sched.AH1),
        pools.main.balance,
      );
      check(
        "Fixed assets: special rate pool balance before this year's allowance (AC1 - AF1 + AI1) = the scenario's pooled special rate assets' tax written-down values",
        num(sched.AC1) - num(sched.AF1) + num(sched.AI1),
        pools.special.balance,
      );

      // The single asset pools (column AD marked P): each marked asset's
      // allowance at its own rate on its business share, and its written-down
      // value less that allowance, anchored on the fixture's assets.
      const wda = taxData.capital_allowances.writing_down_allowance;
      const specialWda = taxData.capital_allowances.writing_down_allowance_special || 0;
      const singleAssets = expected.opening_fixed_assets.filter((asset) => asset.single_asset_pool);
      const singleAllowance = (asset) =>
        (asset.tax_wdv || 0) * (asset.pool === "special" ? specialWda : wda) * (1 - (asset.private_use || 0));
      check(
        "Fixed assets: Schedule single asset pool main rate allowance (AE1) = the scenario's single asset pool main rate assets at the year's rate, less private use",
        sched.AE1 || 0,
        singleAssets.filter((asset) => asset.pool !== "special").reduce((t, asset) => t + singleAllowance(asset), 0),
      );
      check(
        "Fixed assets: Schedule single asset pool special rate allowance (AF1) = the scenario's single asset pool special rate assets at the year's special rate, less private use",
        sched.AF1 || 0,
        singleAssets.filter((asset) => asset.pool === "special").reduce((t, asset) => t + singleAllowance(asset), 0),
      );
      check(
        "Fixed assets: Schedule single asset pool written down value (AG1) = the scenario's single asset pool assets' tax written-down values less this year's allowance",
        sched.AG1 || 0,
        singleAssets.reduce((t, asset) => t + (asset.tax_wdv || 0) - singleAllowance(asset), 0),
      );
      // The marker and the private use share on the row itself, for each
      // motor asset the fixture declares, in the order the writer fills the
      // block.
      expected.opening_fixed_assets
        .filter((asset) => asset.category === "motor")
        .forEach((asset, index) => {
          const row = EXISTING_ASSET_ROWS.motor[index];
          if (row === undefined || !(`AD${row}` in sched)) return;
          checkText(
            `Fixed assets: Schedule single asset pool marker (AD${row}) = ${asset.single_asset_pool ? "P" : "blank"} for the scenario's motor asset ${index + 1}`,
            typeof sched[`AD${row}`] === "string" ? sched[`AD${row}`].trim() : "",
            asset.single_asset_pool ? SINGLE_ASSET_POOL_MARKER : "",
          );
          check(
            `Fixed assets: Schedule private use share (M${row}) = the scenario's motor asset ${index + 1} private use`,
            num(sched[`M${row}`]),
            asset.private_use || 0,
            0.0001,
          );
        });
    }

    // 3. P&L depreciation and disposal lines carry the Schedule's own
    //    annual totals across the cross-file link (each month books 1/12
    //    of the annual figure, so the 12 months' P&L cells sum back to it).
    if (pl) {
      const plDepreciation = MONTH_COLS.reduce((s, col) => s + (pl[`${col}34`] || 0), 0);
      check("P&L: Depreciation (row 34, summed) = Schedule I1", plDepreciation, sched.I1 || 0);
      const plDisposalLoss = MONTH_COLS.reduce((s, col) => s + (pl[`${col}33`] || 0), 0);
      const expectedDisposalLoss = -((sched.V1 || 0) - (sched.W1 || 0) + (sched.X1 || 0));
      check("P&L: Loss on disposal (row 33, summed) = Schedule -(V1-W1+X1)", plDisposalLoss, expectedDisposalLoss);
    }
  }

  // ── HP finance agreements (Fixedassets.xlsx HPfinance sheet) ────────────
  // Each check is anchored in the agreement's own fixture fields, not in
  // another cell of the same sheet, so a schedule that is merely
  // self-consistent cannot pass.
  const hp = results["Fixedassets.xlsx!HPfinance"];
  if (hp && expected.hp_agreements) {
    const [agreement1, agreement2] = expected.hp_agreements;
    if (agreement1) {
      check(
        "HP: first agreement monthly payment = the amount financed with charges over its term",
        hp.I8 || 0,
        (agreement1.amount_financed + agreement1.admin_charges + agreement1.total_interest) / agreement1.months,
      );
      check("HP: first agreement capital and interest split sums to the monthly payment", (hp.J8 || 0) + (hp.K8 || 0), hp.I8 || 0);
    }
    if (agreement2) {
      check(
        "HP: second agreement monthly payment computes",
        hp.I10 || 0,
        (agreement2.amount_financed + agreement2.admin_charges + agreement2.total_interest) / agreement2.months,
      );
      check("HP: second agreement capital and interest split sums to the monthly payment", (hp.J10 || 0) + (hp.K10 || 0), hp.I10 || 0);
    }
    check(
      "HP: long term creditors = the agreements' amounts financed",
      hp.E2 || 0,
      expected.hp_agreements.reduce((s, a) => s + a.amount_financed, 0),
    );
  }

  // The year's HP interest and admin charges reaching the P&L's own "HP
  // Interest, Lease, Bank Charges" line, through Bank.xlsx/Cash.xlsx code
  // "B" -- the same bank-charges code every other direct payment on that
  // line already uses. Computed from the scenario's own bank transactions,
  // not from the P&L cell it is compared to, so a broken cross-file link
  // shows up here rather than passing by construction.
  if (pl && expected.bank) {
    let bankChargesTotal = 0;
    for (const transactions of Object.values(expected.bank)) {
      for (const tx of transactions) {
        if (tx.code !== "B") continue;
        bankChargesTotal += tx.direction === "out" ? tx.amount : -tx.amount;
      }
    }
    check("P&L: HP interest and charges reach the finance line (B31)", pl.B31 || 0, bankChargesTotal);
  }
}
