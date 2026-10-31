// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited

import { shiftMonths } from "../../../lib/period-shift.js";
import { extractTaxYearStart, parseDate } from "../../../lib/scenario-loader.js";
import { taxYearFileName } from "../../../lib/tax-year.js";
import {
  fixtureSmallPools,
  fixtureStructuresAndBuildings,
  journalTotalsByCode,
  openingPoolAllowance,
  smallPoolsWriteOff,
} from "../report.js";

export function checkSa103f(ctx) {
  const { check, checkText, expected, num, pl, rate, results, shiftDate, taxData, vt } = ctx;

  // ── SE Full (SA103F): the full return against the accounts and against the
  // short return beside it ─────────────────────────────────────────────────
  //
  // SE Full is a live HMRC return sharing a workbook with SE Short, every box
  // formula-fed from the profit and loss account, the fixed asset schedule or
  // the Admin sheet. Nothing read it back, so it could carry a different
  // figure from the short return and no check would notice. Cell addresses,
  // box numbers and formulas are read out of the template's own sheet XML.
  const seFull = results["SE Full"];
  const sa103s = results["SE Short"];
  if (seFull && pl) {
    // Each box against the profit and loss figure its own formula names.
    const sa103fPlSources = [
      ["D55", "box 15 turnover", num(pl.B9)],
      ["O55", "box 16 other business income", num(pl.B38)],
      ["D66", "box 17 goods bought for resale", num(pl.B14) + num(pl.B16)],
      ["D70", "box 18 subcontractor payments", num(pl.B15)],
      ["D74", "box 19 wages, salaries and staff costs", num(pl.B21)],
      ["D78", "box 20 car, van and travel expenses", num(pl.B25) + num(pl.B26)],
      ["D82", "box 21 rent, rates, power and insurance", num(pl.B22)],
      ["D86", "box 22 repairs and maintenance", num(pl.B23)],
      ["D90", "box 23 phone, stationery and office costs", num(pl.B24)],
      ["D94", "box 24 advertising and entertainment", num(pl.B27)],
      ["D98", "box 25 interest on bank and other loans", num(pl.B30)],
      ["D102", "box 26 bank, credit card and finance charges", num(pl.B31)],
      ["D106", "box 27 irrecoverable debts written off", num(pl.B29)],
      ["D110", "box 28 accountancy, legal and professional fees", num(pl.B28)],
      ["D114", "box 29 depreciation and loss on sale of assets", num(pl.B33) + num(pl.B34)],
      ["D118", "box 30 other business expenses", num(pl.B32)],
      ["D122", "box 31 total expenses", num(pl.B17) + num(pl.B35)],
      ["O114", "box 44 disallowable depreciation", num(pl.B34)],
      ["O204", "box 75 other business income", num(pl.B11)],
    ];
    for (const [cell, caption, plFigure] of sa103fPlSources) {
      check(`SA103F ${caption} (${cell}) = the profit and loss account`, num(seFull[cell]), plFigure);
    }

    // Box 46's own caption calls it the total of boxes 32 to 45, not a
    // second read of the depreciation figure box 44 already carries.
    check(
      "SA103F box 46 total disallowable expenses (O122) = boxes 32 to 45",
      num(seFull.O122),
      num(seFull.O66) +
        num(seFull.O70) +
        num(seFull.O74) +
        num(seFull.O78) +
        num(seFull.O82) +
        num(seFull.O86) +
        num(seFull.O90) +
        num(seFull.O94) +
        num(seFull.O98) +
        num(seFull.O102) +
        num(seFull.O106) +
        num(seFull.O110) +
        num(seFull.O114) +
        num(seFull.O118),
    );

    // Box 44 is row 34 alone, so a loss on the disposal of an asset (row 33)
    // stays inside box 29's allowable total with nothing moved to a
    // disallowable box, even though a loss on disposal is not an allowable
    // deduction: the balancing allowance in box 56 is what relieves it. The
    // template has no fix available -- this warns of the gap rather than
    // failing on it, carrying the loss itself as the size of what box 44
    // leaves out.
    check(
      "SA103F box 44 disallowable depreciation (O114) leaves the loss on disposal (row 33) out of the disallowable total that box 29 (D114) carries",
      num(seFull.O114),
      num(seFull.D114),
      0.01,
      "warning",
    );

    // VitalTax pools rows 5 to 7 for its own annual sales figure; box 15
    // pools rows 5 to 8, the extra row being sales coded "d" ("Other
    // Income" on the P&L, despite the name a turnover line). A trader
    // reading VitalTax as a running total of the year's turnover would
    // undercount it by that row. The shipped template has no fix
    // available -- this warns of the gap rather than failing, carrying
    // the excluded row as the size of the gap.
    if (vt) {
      check(
        "VitalTax annual sales (G5) excludes the Other Income sales that SA103F box 15 (D55) includes",
        num(vt.G5),
        num(seFull.D55),
        0.01,
        "warning",
      );

      // VitalTax's own other-income row sums three P&L rows together --
      // Other Income (turnover), Investment Grants and Interest received --
      // where SA103F keeps them apart: the grants reach box 75 (O204), not
      // box 16 (O55). A trader reading VitalTax's other-income row as a
      // quarterly "other business income" figure would carry the grants
      // there too, double-counting them against the annual return. The
      // Other Income row's own contribution is anchored on the scenario's
      // own sales coded "d" rather than on the P&L cell it feeds, so a
      // wrong Other Income line cannot hide inside this check.
      const otherIncomeSales = journalTotalsByCode(expected.sales, rate, "a").net.d || 0;
      check(
        "VitalTax other income (rows 8, 11 and 38 folded together) treats Investment Grants as ordinary other income, while SA103F reports them apart at box 75 (O204) rather than box 16 (O55)",
        num(pl.B8) + num(pl.B11) + num(pl.B38),
        num(seFull.O55) + otherIncomeSales,
        0.01,
        "warning",
      );
    }

    // The form's own arithmetic, each total against the boxes it adds up.
    check(
      "SA103F box 57 total capital allowances (O154) = boxes 49 to 56",
      num(seFull.O154),
      num(seFull.D139) +
        num(seFull.D144) +
        num(seFull.D147) +
        num(seFull.D150) +
        num(seFull.D152) +
        num(seFull.D156) +
        num(seFull.D160) +
        num(seFull.O139) +
        num(seFull.O144) +
        num(seFull.O149),
    );
    check(
      "SA103F box 47 net profit (D129) = boxes 15 and 16 less box 31",
      num(seFull.D129),
      Math.max(0, num(seFull.D55) + num(seFull.O55) - num(seFull.D122)),
    );
    check(
      "SA103F box 61 total additions to net profit (D174) = boxes 46, 59 and 60",
      num(seFull.D174),
      num(seFull.O122) + num(seFull.O160) + num(seFull.D169),
    );
    check("SA103F box 63 total deductions from net profit (O169) = boxes 57 and 62", num(seFull.O169), num(seFull.O154) + num(seFull.D179));
    // Box 64 works from the net profit when there is one and from the net
    // loss when there is not, which is what the box's own nested IF says.
    const taxProfitFromNetProfit = num(seFull.D129) + num(seFull.D174) - num(seFull.O169);
    const taxProfitFromNetLoss = -num(seFull.O129) + num(seFull.D174) - num(seFull.O169);
    check(
      "SA103F box 64 net business profit for tax purposes (O174) = box 47 or box 48, plus box 61, less box 63",
      num(seFull.O174),
      taxProfitFromNetProfit > 0 ? taxProfitFromNetProfit : Math.max(0, taxProfitFromNetLoss),
    );
    // HMRC's working sheet for boxes 73 and 77 takes one figure, box 64 less
    // box 65 plus boxes 68, 71 and 72; box 73 is it when positive, box 77 its
    // negation when not. Box 72 (O190) prints a dash on this template and
    // contributes nil.
    const adjustedProfitBeforeFloor = num(seFull.O174) - num(seFull.O179) + num(seFull.D197) + num(seFull.D210);
    check(
      "SA103F box 73 adjusted profit (O194) = box 64 less box 65 plus boxes 68 and 71, floored at nil",
      num(seFull.O194),
      Math.max(0, adjustedProfitBeforeFloor),
    );
    check(
      "SA103F box 77 adjusted loss (D219) = box 65 less box 64, 68 and 71, floored at nil",
      num(seFull.D219),
      Math.max(0, -adjustedProfitBeforeFloor),
    );
    check(
      "SA103F box 76 total taxable profits (O210) = box 73 less box 74 plus box 75",
      num(seFull.O210),
      num(seFull.O194) - num(seFull.O199) + num(seFull.O204),
    );

    // The basis period record (boxes 68, 69 and 73.3), anchored on the
    // fixture's own basisPeriod figures and the package's tax year --
    // independent of the Business Details cells the s.7A formula itself
    // reads, so a self-consistent-but-wrong sheet fails here.
    const businessDetails = results["Business Details"] || {};
    const basisPeriod = expected.basis_period || {};
    const bpOverlapBroughtForward = basisPeriod.overlapProfitBroughtForward || 0;
    const bpTransitionBroughtForward = basisPeriod.transitionProfitBroughtForward || 0;
    const bpTransitionAcceleration = basisPeriod.transitionProfitAccelerationAmount || 0;
    const bpFollowingPeriodProfit = basisPeriod.followingPeriodProfit || 0;
    check(
      "Business Details!D59 overlap profit brought forward = the fixture's own figure",
      num(businessDetails.D59),
      bpOverlapBroughtForward,
    );
    check(
      "Business Details!O59 transition profit not yet treated as arising = the fixture's own figure",
      num(businessDetails.O59),
      bpTransitionBroughtForward,
    );
    check(
      "Business Details!O69 additional transition profit elected this year = the fixture's own figure",
      num(businessDetails.O69),
      bpTransitionAcceleration,
    );
    check("Business Details!D74 following period's profit = the fixture's own figure", num(businessDetails.D74), bpFollowingPeriodProfit);

    // The tax year this figure is computed for -- calculateSeCells' own
    // source (taxData.tax_year.start, falling back to the scenario's own
    // dates), not packageYearEnd: a caller checking a single computed
    // result rather than a generated package directory passes no year end.
    const basisPeriodStartYear = taxData?.tax_year?.start
      ? new Date(taxData.tax_year.start).getUTCFullYear()
      : extractTaxYearStart(expected);
    const packageTaxYearEnd = basisPeriodStartYear ? basisPeriodStartYear + 1 : null;
    // s.7A(2)(a): overlap relief is used in full on the 2023-24 return only.
    const expectedOverlapReliefUsed = packageTaxYearEnd === 2024 ? bpOverlapBroughtForward : 0;
    check(
      "Business Details!D64 overlap relief used this year = the 2023-24 return uses it in full, else nil",
      num(businessDetails.D64),
      expectedOverlapReliefUsed,
    );
    check(
      "Business Details!D69 overlap profit carried forward = box 69's input less box 69's relief used",
      num(businessDetails.D69),
      bpOverlapBroughtForward - expectedOverlapReliefUsed,
    );
    // para 72(3)-(4): 1/(years left, this one included) of the untaxed
    // transition balance, nil before 2023-24.
    const expectedTransitionArising =
      packageTaxYearEnd && packageTaxYearEnd >= 2024 ? bpTransitionBroughtForward / Math.max(1, 2029 - packageTaxYearEnd) : 0;
    check(
      "Business Details!O64 transition profit treated as arising this year, before election = the fixture's balance divided by the years left",
      num(businessDetails.O64),
      expectedTransitionArising,
    );
    check(
      "Business Details!O74 transition profit carried forward = the fixture's balance less what this year and the election take",
      num(businessDetails.O74),
      bpTransitionBroughtForward - expectedTransitionArising - bpTransitionAcceleration,
    );
    // para 73(3): an election cannot exceed the untaxed balance left once
    // this year's automatic slice is taken out of it -- checked against the
    // sheet's own O69, not the fixture's, so a sheet that carries an
    // over-large election fails here even when the fixture itself is fine.
    check(
      "Business Details!O69 election does not exceed the untaxed transition balance (para 73(3))",
      Math.max(0, num(businessDetails.O69) - (bpTransitionBroughtForward - expectedTransitionArising)),
      0,
    );
    // Box 73.3 (D201): this year's automatic slice plus the election.
    check(
      "SA103F box 73.3 spread of the transition profit treated as arising (D201) = box O64 plus box O69",
      num(seFull.D201),
      expectedTransitionArising + bpTransitionAcceleration,
    );

    // Box 68 (D197), s.7A: nil under s.7C for an accounting date of 31
    // March to 5 April. Both fixtures ship one, so the independent figure
    // is nil on every package year -- a book whose accounting date sits
    // outside that window is covered by the calc-tier basis period test.
    const periodProfit = num(seFull.O174) - num(seFull.O179);
    const periodCoveredStart = expected.period_covered_start ? parseDate(expected.period_covered_start) : null;
    const periodCoveredEnd = expected.period_covered_end ? parseDate(expected.period_covered_end) : null;
    let expectedBasisAdjustment = 0;
    if (periodCoveredStart && periodCoveredEnd && basisPeriodStartYear) {
      const naturalStartYear = parseInt(taxYearFileName(periodCoveredEnd, "se").split("-")[1], 10);
      const shiftYears = (d) => shiftMonths(d, (basisPeriodStartYear - naturalStartYear) * 12);
      const shiftedStart = shiftYears(periodCoveredStart);
      const shiftedEnd = shiftYears(periodCoveredEnd);
      const marchThirtyFirst = new Date(Date.UTC(basisPeriodStartYear + 1, 2, 31));
      if (shiftedEnd < marchThirtyFirst) {
        const dayMs = 24 * 60 * 60 * 1000;
        const taxYearStart = new Date(Date.UTC(basisPeriodStartYear, 3, 6));
        const taxYearEnd = new Date(Date.UTC(basisPeriodStartYear + 1, 3, 5));
        const followingPeriodEnd = shiftMonths(shiftedEnd, 12);
        const thisPeriodShare = (shiftedEnd - Math.max(shiftedStart, taxYearStart) + dayMs) / (shiftedEnd - shiftedStart + dayMs);
        const nextPeriodShare = (taxYearEnd - shiftedEnd) / (followingPeriodEnd - shiftedEnd);
        expectedBasisAdjustment = thisPeriodShare * periodProfit + nextPeriodShare * bpFollowingPeriodProfit - periodProfit;
      }
    }
    check(
      "SA103F box 68 adjustment where the accounting period was not 12 months long (D197) = the s.7A apportionment",
      num(seFull.D197),
      expectedBasisAdjustment,
      0.01,
    );

    // The capital allowance boxes have no profit and loss source: they read
    // the fixed asset schedule across the cross-file external link.
    const returnSchedule = results["Fixedassets.xlsx!Schedule"];
    if (returnSchedule) {
      check("SA103F box 49 annual investment allowance (D139) = Schedule Q1", num(seFull.D139), Math.max(0, num(returnSchedule.Q1)));
      check("SA103F box 50 capital allowances at 18% (D144) = Schedule R1", num(seFull.D144), num(returnSchedule.R1));
      check("SA103F box 51 capital allowances at 6% (D147) = Schedule AC1", num(seFull.D147), num(returnSchedule.AC1));
      // The small pools write-off runs per rate pool over the pooled balance
      // alone, the single asset pool rows (AE1, AF1) left out:
      // O144 = IF((R1-AE1+AH1)<1000,AH1,0)+IF((AC1-AF1+AI1)<1000,AI1,0).
      check(
        "SA103F box 55 100% and other enhanced capital allowances (O144) = each pool's Schedule written-down value (AH1, AI1) while that pool's balance is under £1,000",
        num(seFull.O144),
        smallPoolsWriteOff(returnSchedule),
      );
      check("SA103F box 56 allowances on sale or cessation (O149) = Schedule Y1", num(seFull.O149), num(returnSchedule.Y1));
      check("SA103F box 59 balancing charge (O160) = Schedule Z1", num(seFull.O160), num(returnSchedule.Z1));
      check("SA103F box 53 Structures and Buildings Allowance (D156) = Schedule K120", num(seFull.D156), num(returnSchedule.K120));
      check(
        "SA103F box 53.1 Freeport and Investment Zone Structures and Buildings Allowance (D160) = Schedule K121",
        num(seFull.D160),
        num(returnSchedule.K121),
      );
    }

    // Box 50 against the scenario's own assets and the year's own rate,
    // neither of them read back out of the workbook. Every existing asset
    // claims the writing down allowance on the tax written-down value it was
    // brought forward at, whatever it cost, so a car whose allowance is capped
    // again, or diverted into another allowance box, leaves box 50 short of
    // what the scenario's assets are entitled to.
    // Each pool against the scenario's own assets: the main pool's boxes 50
    // and the special rate pool's box 51, each at its own year's rate, so an
    // asset marked for one pool that lands in the other moves both boxes.
    // A privately used car claims its allowance on the business share alone
    // (Schedule column M), single asset pool or not, so the anchor carries
    // that factor row by row.
    if (taxData?.capital_allowances && expected.opening_fixed_assets) {
      check(
        "SA103F box 50 capital allowances at 18% (D144) = the scenario's opening tax written-down values at the year's writing down rate, less private use",
        num(seFull.D144),
        openingPoolAllowance(expected, "main") * taxData.capital_allowances.writing_down_allowance,
      );
      check(
        "SA103F box 51 capital allowances at 6% (D147) = the scenario's special rate pool tax written-down values at the year's special rate, less private use",
        num(seFull.D147),
        openingPoolAllowance(expected, "special") * (taxData.capital_allowances.writing_down_allowance_special || 0),
      );
      // The same rule the sheet applies, run over the fixture's own pools:
      // a sheet whose R1, AC1, AE1, AF1, AH1 and AI1 agree with each other
      // but not with the assets fails here.
      check(
        "SA103F box 55 100% and other enhanced capital allowances (O144) = the small pools write-off computed per pool from the scenario's own pooled assets",
        num(seFull.O144),
        fixtureSmallPools(expected, taxData, rate).writeOff,
      );
    }

    // The boxes the trader states by hand, each against the scenario's own
    // stated figure rather than against the sheet. A box the scenario does
    // not state stays nil, and a stated one moves the total it feeds by
    // exactly itself.
    const statedAllowances = expected.annual_allowances || {};
    const statedAdjustments = expected.annual_adjustments || {};
    const annualBoxes = [
      ["52", "zero-emission goods vehicle allowance", "D150", statedAllowances.zeroEmissionsGoodsVehicleAllowance],
      ["52.1", "zero-emission car allowance", "D152", statedAllowances.zeroEmissionsCarAllowance],
      ["54", "electric charge-point allowance", "O139", statedAllowances.electricChargePointAllowance],
      ["62", "income included but not taxable as business profits", "D179", statedAdjustments.includedNonTaxableProfits],
      ["71", "adjustment for change of accounting practice", "D210", statedAdjustments.accountingAdjustment],
    ];
    for (const [box, caption, cell, stated] of annualBoxes) {
      check(`SA103F box ${box} ${caption} (${cell}) = the figure the book states`, num(seFull[cell]), stated || 0);
    }
    // Boxes 53 and 53.1 are not stated: the Schedule's SBA block computes
    // them from the fixture's own claims, each priced at its own rate over
    // the days it covers within the package's period. Only when a rate
    // year's own tax data is in hand -- some callers check an isolated
    // cell with none, and the rate is what fixes the fixture's own figure.
    if (taxData?.capital_allowances) {
      const sba = fixtureStructuresAndBuildings(expected, taxData, num(seFull.Q2), num(seFull.V2), shiftDate);
      check(
        "SA103F box 53 Structures and Buildings Allowance (D156) = the fixture's own claims at the year's rate",
        num(seFull.D156),
        sba.box53,
      );
      check(
        "SA103F box 53.1 Freeport and Investment Zone Structures and Buildings Allowance (D160) = the fixture's own claims at the year's enhanced rate",
        num(seFull.D160),
        sba.box53_1,
      );
    }
    const ownUseStated = statedAdjustments.goodsAndServicesOwnUse || 0;
    check(
      "SA103F box 60 goods and services for own use (D169) = the figure the book states on Business Details!O50",
      num(seFull.D169),
      ownUseStated,
    );
    if (results["Business Details"]) {
      check(
        "Business Details!O50 goods and services for own use = the figure the book states",
        num(results["Business Details"].O50),
        ownUseStated,
      );
    }
    const statedAllowanceTotal = annualBoxes
      .filter(([box]) => box !== "62" && box !== "71")
      .reduce((total, [, , , stated]) => total + (stated || 0), 0);
    check(
      "SA103F box 57 total capital allowances (O154) less the schedule-fed boxes 49, 50, 51, 53, 53.1, 55 and 56 = the allowances the book states (boxes 52, 52.1 and 54)",
      num(seFull.O154) -
        num(seFull.D139) -
        num(seFull.D144) -
        num(seFull.D147) -
        num(seFull.D156) -
        num(seFull.D160) -
        num(seFull.O144) -
        num(seFull.O149),
      statedAllowanceTotal,
    );
    check(
      "SA103F box 63 total deductions from net profit (O169) less box 57 = the box 62 figure the book states",
      num(seFull.O169) - num(seFull.O154),
      statedAdjustments.includedNonTaxableProfits || 0,
    );
    check(
      "SA103F box 61 total additions to net profit (D174) less boxes 46 and 59 = the box 60 figure the book states",
      num(seFull.D174) - num(seFull.O122) - num(seFull.O160),
      ownUseStated,
    );
    // The same two boxes anchored on the figures the book states, so a
    // sheet whose box 71 cell and adjusted figures agree with each other
    // but not with the book fails here.
    const statedAccountingAdjustment = statedAdjustments.accountingAdjustment || 0;
    check(
      "SA103F box 73 adjusted profit (O194) = box 64 less box 65 plus boxes 68 and 71 the book states, floored at nil",
      num(seFull.O194),
      Math.max(0, num(seFull.O174) - num(seFull.O179) + expectedBasisAdjustment + statedAccountingAdjustment),
    );
    check(
      "SA103F box 77 adjusted loss (D219) = box 65 less box 64, 68 and 71 the book states, floored at nil",
      num(seFull.D219),
      Math.max(0, num(seFull.O179) - num(seFull.O174) - expectedBasisAdjustment - statedAccountingAdjustment),
    );

    if (sa103s) {
      // Boxes the two returns carry identically.
      const sa103fCounterparts = [
        ["D55", "D38", "box 15 turnover"],
        ["O55", "O38", "box 16 other business income"],
        ["O129", "O71", "box 48 net loss"],
        ["D139", "D80", "box 49 annual investment allowance"],
        ["O144", "D85", "box 55 100% and other enhanced capital allowances"],
        ["O160", "O85", "box 59 balancing charge"],
        ["D169", "D94", "box 60 goods and services for own use"],
        ["O179", "O106", "box 65 net business loss for tax purposes"],
        ["O199", "O94", "box 74 loss brought forward set against this year"],
        ["O204", "O99", "box 75 other business income"],
        ["D231", "O124", "box 81 contractor deductions taken off"],
      ];
      // The short return reads the fixed asset schedule and Business Details
      // directly, so the boxes the trader states or claims on SE Full alone
      // (52, 52.1, 53, 53.1, 54 and 62) never reach it: its taxable profit
      // stands higher than the full return's by exactly those figures.
      const fullReturnOnlyDeductions =
        num(seFull.D150) + num(seFull.D152) + num(seFull.D156) + num(seFull.D160) + num(seFull.O139) + num(seFull.D179);
      check(
        "SA103F box 64 net business profit for tax purposes: full return (O174) = short return (D99) less the SE Full-only boxes 52, 52.1, 53, 53.1, 54 and 62",
        num(seFull.O174),
        Math.max(0, num(sa103s.D99) - fullReturnOnlyDeductions),
      );
      // Box 71 is the one SE Full-only figure that adds to the taxable
      // profit; the short return has no box for it either.
      check(
        "SA103F box 76 total taxable profits: full return (O210) = short return (D106) less the SE Full-only boxes 52, 52.1, 53, 53.1, 54 and 62 plus box 71, with each return's own loss set-off",
        num(seFull.O210),
        Math.max(0, num(sa103s.D106) - fullReturnOnlyDeductions + num(seFull.D210) + num(sa103s.O94) - num(seFull.O199)),
      );
      check(
        "SA103S box 28 net business profit for tax purposes (D99) leaves out the allowances and box 62 adjustment the trader states on SE Full alone",
        num(sa103s.D99),
        num(seFull.O174),
        0.01,
        "warning",
      );
      // Six of these read the short return's expense analysis, which the sheet
      // leaves blank when turnover is under the VAT threshold. There is
      // nothing to compare then; the total expenses box below still stands.
      const shortExpenseBoxes = new Set(["D55", "D51", "D60", "D64", "O55", "O46"]);
      const shortAnalysisShown = typeof sa103s.D46 === "number";
      for (const [fullCell, shortCell, caption] of sa103fCounterparts) {
        if (!shortAnalysisShown && shortExpenseBoxes.has(shortCell)) continue;
        check(`SA103F ${caption}: full return (${fullCell}) = short return (${shortCell})`, num(seFull[fullCell]), num(sa103s[shortCell]));
      }

      // Boxes 19 to 23 and 28: SA103S has no disallowable column, so each of
      // these six drops its own share of boxes 32 to 45 before it reaches
      // the short return.
      const sa103fNetOfDisallowable = [
        ["D74", "D55", "O74", "box 19 wages, salaries and staff costs"],
        ["D78", "D51", "O78", "box 20 car, van and travel expenses"],
        ["D82", "D60", "O82", "box 21 rent, rates, power and insurance"],
        ["D86", "D64", "O86", "box 22 repairs and maintenance"],
        ["D90", "O55", "O90", "box 23 phone, stationery and office costs"],
        ["D110", "O46", "O110", "box 28 accountancy, legal and professional fees"],
      ];
      for (const [fullCell, shortCell, disallowableCell, caption] of sa103fNetOfDisallowable) {
        if (!shortAnalysisShown) continue;
        check(
          `SA103F ${caption}: short return (${shortCell}) = full return (${fullCell}) less its own disallowable share (${disallowableCell})`,
          num(sa103s[shortCell]),
          num(seFull[fullCell]) - num(seFull[disallowableCell]),
        );
      }

      // Where the two forms differ by design. The full return has a
      // disallowable column, so it totals expenses before the add-back and
      // carries a net profit that much lower; the short return has no such
      // column and takes depreciation out of the total instead. The two
      // allowance layouts also split differently: the full return separates
      // the allowances on sale that the short return rolls into its own boxes.
      check(
        "SA103F box 31 total expenses (D122) = the short return's total expenses with box 46 disallowable depreciation added back",
        num(seFull.D122),
        num(sa103s.O64) + num(seFull.O122),
      );
      check(
        "SA103F box 47 net profit (D129) = the short return's net profit less box 46 disallowable depreciation",
        num(seFull.D129),
        num(sa103s.D71) - num(seFull.O122),
      );
      check(
        "SA103F box 57 total capital allowances (O154) = the short return's allowance boxes 23, 24 and 25 plus the SE Full-only boxes 52, 52.1, 53, 53.1 and 54",
        num(seFull.O154),
        num(sa103s.D80) +
          num(sa103s.D85) +
          num(sa103s.O80) +
          num(seFull.D150) +
          num(seFull.D152) +
          num(seFull.D156) +
          num(seFull.D160) +
          num(seFull.O139),
      );
      check(
        "SA103S box 25 other capital allowances (O80) leaves out the allowances the trader states or claims on SE Full alone (boxes 52, 52.1, 53, 53.1 and 54)",
        num(sa103s.O80),
        num(seFull.O154) - num(sa103s.D80) - num(sa103s.D85),
        0.01,
        "warning",
      );
    }

    // The period and the rates the return prints on its own face, against the
    // Admin sheet cells each one reads.
    if (results.Admin) {
      check("SA103F: the period the return covers starts on the Admin tax year start (Q2 = B4)", num(seFull.Q2), num(results.Admin.B4), 0);
      check("SA103F: the period the return covers ends on the Admin tax year end (V2 = B17)", num(seFull.V2), num(results.Admin.B17), 0);
      check(
        "SA103F: the writing down allowance rate the return prints (G141) = the Admin rate (G5)",
        num(seFull.G141),
        num(results.Admin.G5),
        0.0001,
      );
      check(
        "SA103F: the Class 4 threshold the return prints (J280) = the Admin Class 4 lower limit (N20)",
        num(seFull.J280),
        num(results.Admin.N20),
      );
    }

    // The online filing deadline printed at the top of the return (G1) is
    // always 31 January the year after the tax year ends, whatever year the
    // package was generated for -- a check anchored on the tax year end
    // rather than on the sheet's own Admin!B21 echo, so a wrong date on both
    // sides of that link would still be caught.
    if (taxData?.tax_year?.end) {
      const deadlineYear = new Date(taxData.tax_year.end).getUTCFullYear() + 1;
      checkText(
        "SA103F: the online filing deadline banner (G1) names 31 January the year after the tax year ends",
        seFull.G1,
        `COPY DETAILS TO HMRC FORM          Submit HMRC RETURN ONLINE                   by 31st January ${deadlineYear}`,
      );
    }
  }
}
