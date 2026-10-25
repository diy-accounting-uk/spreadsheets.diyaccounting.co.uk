// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// ixbrl-summary-book.js — writes the Company books an iXBRL accounts file
// stands for: one for the file's own year and one for the year before. A file
// carries no transactions, so each book holds one journal line per tagged
// line, dated the period end, and the opening balance sheet the year needs.
// The books page, the MCP tools and a roll forward then read them as they
// read any Company book.
//
// diya-gl works the Corporation Tax itself, so a first run of the engine
// finds the tax and the profit after it, and the dividend and the tax paid
// are the amounts that bring the closing balance sheet to the file's own
// figures. The tax and profit after tax of the book can differ from the file;
// the `differences` list names each place the book and the file part.

import { buildNewBook } from "./diya-gl-new-book.js";
import { diyaGlToScenario } from "./diya-gl-loader.js";
import { calculateFromDiyaGl } from "./diya-gl-calculator.js";
import { buildOpeningBalance, toV2OpeningBalances } from "./scenario-extractor.js";
import { FIXED_ASSET_ACCOUNTS, FIXED_ASSET_CLASSES, IxbrlError, microProfitBeforeTax } from "./ixbrl-accounts.js";

// The register's class name for each class the accounts note uses.
const REGISTER_CLASS = {
  landBuildings: "landBuildings",
  plantMachinery: "plantMachinery",
  furnitureFittings: "fixturesFittings",
  computerEquipment: "computerTechnology",
  motorVehicles: "motorVehicles",
};

const CLASS_LABEL = {
  landBuildings: "Land and buildings",
  plantMachinery: "Plant and machinery",
  furnitureFittings: "Fixtures and fittings",
  computerEquipment: "Computer equipment",
  motorVehicles: "Motor vehicles",
};

// The class a year's additions and a file with no note both land in; the
// schedule depreciates purchases coded as fixed assets at this class's rate.
const ADDITIONS_CLASS = "plantMachinery";
const ADDITIONS_RATE_KEY = "plant_and_machinery";

const money = (value) => Math.round(value * 100) / 100;
const n = (value) => value ?? 0;
const sum = (values) => values.reduce((total, value) => total + value, 0);

const addDays = (isoDay, days) => {
  const date = new Date(`${isoDay}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const addYears = (isoDay, years) => {
  const date = new Date(`${isoDay}T00:00:00Z`);
  date.setUTCFullYear(date.getUTCFullYear() + years);
  return date.toISOString().slice(0, 10);
};

// ============================================================================
// A year's balance sheet as the book states it
// ============================================================================

// The figures a book needs from one balance sheet. What no tagged line
// explains stays in the account it belongs to: the part of current assets no
// line explains is cash, and the part of the creditors within one year no
// line explains is a trade creditor.
function sheetOf(balanceSheet) {
  const stocks = n(balanceSheet.stocks);
  const debtors = n(balanceSheet.debtors);
  const currentAssets = balanceSheet.currentAssets ?? stocks + debtors + n(balanceSheet.cashAtBank);
  const lineCreditors = n(balanceSheet.tradeCreditors) + n(balanceSheet.corporationTax) + n(balanceSheet.otherCreditors);
  const within = balanceSheet.creditorsWithinOneYear ?? lineCreditors;
  const corporationTax = n(balanceSheet.corporationTax);
  const calledUp = n(balanceSheet.calledUpShareCapital);
  const fixedAssets = n(balanceSheet.fixedAssets);
  const afterOneYear = n(balanceSheet.creditorsAfterOneYear);
  const equity = balanceSheet.capitalAndReserves ?? balanceSheet.netAssets ?? fixedAssets + currentAssets - within - afterOneYear;
  return {
    fixedAssets,
    stock: stocks,
    debtors,
    cash: currentAssets - stocks - debtors,
    creditors: within - corporationTax,
    corporationTax,
    afterOneYear,
    shareCapital: calledUp,
    retained: equity - calledUp,
    equity,
  };
}

// ============================================================================
// Fixed assets
// ============================================================================

// The register for a year: each class's cost, depreciation brought forward and
// the rate that gives the tagged charge, the cost of the year's additions,
// bought as one fixed asset purchase, and the assets disposed of, each sold
// for its net book value plus its share of the tagged gain on disposal.
function fixedAssetPlan({
  openingNetBookValue,
  closingNetBookValue,
  note,
  totalCharge,
  additionsRate,
  gainOnDisposal,
  differences,
  label,
}) {
  const classes = [];
  if (note) {
    for (const className of FIXED_ASSET_CLASSES) {
      const line = note[className];
      if (!line) continue;
      classes.push({ className, cost: line.costAtStart, depreciation: line.depreciationAtStart, charge: line.depreciationCharge });
    }
  }
  const noteNetBookValue = sum(classes.map((entry) => entry.cost - entry.depreciation));
  if (classes.length === 0 && openingNetBookValue > 0) {
    classes.push({ className: ADDITIONS_CLASS, cost: openingNetBookValue, depreciation: 0, charge: totalCharge });
  } else if (openingNetBookValue - noteNetBookValue > 0.5) {
    const plant = classes.find((entry) => entry.className === ADDITIONS_CLASS);
    if (plant) plant.cost += openingNetBookValue - noteNetBookValue;
    else classes.push({ className: ADDITIONS_CLASS, cost: openingNetBookValue - noteNetBookValue, depreciation: 0, charge: 0 });
  }
  const openingValue = sum(classes.map((entry) => entry.cost - entry.depreciation));

  // The assets disposed of leave the held entries as entries of their own, at
  // no charge: the note's cost and depreciation on disposals when the file has
  // them, else the whole fall in net book value beyond the charge.
  const disposed = [];
  const takeOut = (className, cost, depreciation) => {
    const held = classes.find((entry) => entry.className === className);
    if (!held) return;
    const takenCost = Math.min(cost, held.cost);
    const takenDepreciation = Math.min(depreciation, held.depreciation, takenCost);
    if (!(takenCost > 0)) return;
    held.cost -= takenCost;
    held.depreciation -= takenDepreciation;
    disposed.push({ className, cost: takenCost, depreciation: takenDepreciation, charge: 0, rate: 0, disposed: true });
  };
  if (note) {
    for (const className of FIXED_ASSET_CLASSES) {
      const line = note[className];
      if (line?.disposals > 0) takeOut(className, line.disposals, line.depreciationOnDisposals);
    }
  }
  if (!note && openingValue - totalCharge - closingNetBookValue > 0.5) {
    takeOut(ADDITIONS_CLASS, openingValue - totalCharge - closingNetBookValue, 0);
  }
  const disposedNetBookValue = sum(disposed.map((entry) => entry.cost - entry.depreciation));
  for (const entry of disposed) entry.taxWrittenDownValue = entry.cost - entry.depreciation;

  // The gross cost of the additions: the closing net book value less the
  // held one, with the tagged charge put back. The additions take their own
  // charge at the class rate, and the assets already held take the rest of
  // the tagged charge. When the additions' own charge is more than the tagged
  // one, the additions are sized to the closing net book value and the charge
  // is theirs alone.
  const netChange = closingNetBookValue - (openingValue - disposedNetBookValue);
  if (netChange + totalCharge < -0.5) {
    differences.push(
      `${label}: fixed assets fall by ${money(-(netChange + totalCharge))} more than the charge and the disposals in the fixed asset note.`,
    );
  }
  let additions = Math.max(netChange + totalCharge, 0);
  let heldCharge = totalCharge - additions * additionsRate;
  if (heldCharge < 0) {
    additions = netChange > 0 && additionsRate < 1 ? netChange / (1 - additionsRate) : 0;
    heldCharge = Math.max(totalCharge - additions * additionsRate, 0);
  }
  const engineCharge = heldCharge + additions * additionsRate;
  const taggedHeld = sum(classes.map((entry) => entry.charge));
  const totalCost = sum(classes.map((entry) => entry.cost));
  for (const entry of classes) {
    const share = taggedHeld > 0 ? entry.charge / taggedHeld : totalCost > 0 ? entry.cost / totalCost : 0;
    const charge = heldCharge * share;
    entry.rate = entry.cost > 0 ? Math.min(Math.round((charge / entry.cost) * 1e6) / 1e6, 1) : 0;
  }
  if (totalCharge > 0 && totalCost === 0 && additions * additionsRate < totalCharge - 0.5) {
    differences.push(`${label}: a depreciation charge of ${money(totalCharge)} falls on no asset held at the start of the year.`);
  }

  // Each disposal is a sale of the asset for its net book value, and the
  // tagged gain (a loss when negative) is shared over the assets by value. A
  // disposal with no proceeds is not a sale, so its asset stays on the register.
  const result = disposedNetBookValue > 0 ? n(gainOnDisposal) : 0;
  const sold = [];
  const unsold = [];
  for (const entry of disposed) {
    const netBookValue = entry.cost - entry.depreciation;
    const proceeds = money(netBookValue + (result * netBookValue) / disposedNetBookValue);
    if (proceeds > 0) sold.push({ entry, proceeds });
    else {
      unsold.push(entry);
      differences.push(`${label}: a disposal of ${money(netBookValue)} net book value at no proceeds is not posted.`);
    }
  }
  return {
    classes: [...sold.map((sale) => sale.entry), ...unsold, ...classes.filter((entry) => entry.cost > 0 || entry.depreciation > 0)],
    additions: money(additions),
    engineCharge: money(engineCharge),
    sales: sold.map((sale) => ({ className: sale.entry.className, proceeds: sale.proceeds })),
    disposalResult: unsold.length === 0 ? result : 0,
    disposalProceeds: money(sum(sold.map((sale) => sale.proceeds))),
  };
}

// ============================================================================
// Lines
// ============================================================================

class LineWriter {
  constructor(prefix) {
    this.lines = [];
    this.prefix = prefix;
  }

  next() {
    return `${this.prefix}-${String(this.lines.length + 1).padStart(4, "0")}`;
  }

  add(line) {
    this.lines.push({ entryNumber: this.next(), ...line });
  }

  journal(date, reference, account, side, signedAmount, comment) {
    if (!(Math.abs(signedAmount) > 0)) return;
    // A balance on the other side of its usual one posts to the other side.
    const amount = Math.abs(signedAmount);
    if (signedAmount < 0) side = side === "D" ? "C" : "D";
    this.add({
      sourceJournalID: "journal",
      postingDate: date,
      accountMainID: account,
      debitCreditCode: side,
      amount: money(amount),
      documentType: "journal",
      documentReference: reference,
      detailComment: "Opening balances",
      lineItemComment: comment,
      taxCode: "OS",
      taxRate: 0,
    });
  }

  invoice(journal, date, reference, account, amount, comment) {
    if (!(amount > 0)) return;
    this.add({
      sourceJournalID: journal,
      postingDate: date,
      accountMainID: account,
      amount: money(amount),
      documentType: "invoice",
      documentReference: reference,
      detailComment: comment,
      lineItemComment: comment,
      taxCode: "NA",
      taxRate: 0,
      paymentMethod: "bank-transfer",
    });
  }

  // A bank line on the current account. `receipt` is money in.
  bank(date, reference, code, receipt, amount, comment) {
    if (!(amount > 0)) return;
    this.add({
      "sourceJournalID": "bank",
      "postingDate": date,
      "accountMainID": "1200",
      "debitCreditCode": receipt ? "D" : "C",
      "amount": money(amount),
      "documentType": "bank-statement",
      "documentReference": reference,
      "detailComment": comment,
      "lineItemComment": comment,
      "taxCode": "OS",
      "taxRate": 0,
      "diya-gl:bankCode": code,
      "diya-gl:bankAccountID": "1200",
    });
  }
}

const referenceFor = (concept) => `IXBRL-${concept}`;

// The opening journal: the balance sheet at the start of the year.
function openingJournal(writer, date, opening, assetClasses) {
  const reference = "OB-001";
  for (const entry of assetClasses) {
    writer.journal(date, reference, FIXED_ASSET_ACCOUNTS[entry.className], "D", entry.cost, `${CLASS_LABEL[entry.className]}, cost`);
    writer.journal(
      date,
      reference,
      FIXED_ASSET_ACCOUNTS[entry.className],
      "C",
      entry.depreciation,
      `${CLASS_LABEL[entry.className]}, depreciation`,
    );
  }
  writer.journal(date, reference, "1100", "D", opening.stock, "Stock");
  writer.journal(date, reference, "1300", "D", opening.debtors, "Debtors");
  writer.journal(date, reference, "1200", opening.cash >= 0 ? "D" : "C", Math.abs(opening.cash), "Current account");
  writer.journal(date, reference, "2100", "C", opening.creditors, "Creditors falling due within one year");
  writer.journal(date, reference, "2300", "C", opening.corporationTax, "Corporation Tax");
  writer.journal(date, reference, "2600", "C", opening.afterOneYear, "Creditors falling due after more than one year");
  writer.journal(date, reference, "3000", "C", opening.shareCapital, "Called up share capital");
  writer.journal(date, reference, "3100", opening.retained >= 0 ? "C" : "D", Math.abs(opening.retained), "Profit and loss account");
}

// ============================================================================
// One year
// ============================================================================

// The profit and loss lines a year posts: [{ concept, journal, account, amount, label }] and
// the interest received.
function profitAndLossLines(profitAndLoss, { stockMovement, depreciation, taggedDepreciation, disposalResult }) {
  const posts = [];
  const add = (concept, journal, account, amount, label) => {
    if (amount !== undefined && amount !== 0) posts.push({ concept, journal, account, amount, label });
  };
  add("TurnoverRevenue", "sales", "4000", profitAndLoss.turnover, "Turnover");
  add("OtherOperatingIncomeFormat2", "sales", "4003", profitAndLoss.otherOperatingIncome, "Other operating income");
  const costOfSales = profitAndLoss.costOfSales !== undefined ? profitAndLoss.costOfSales : profitAndLoss.rawMaterialsConsumables;
  const costConcept = profitAndLoss.costOfSales !== undefined ? "CostSales" : "RawMaterialsConsumablesUsed";
  if (costOfSales !== undefined || stockMovement !== 0)
    add(costConcept, "purchases", "5000", n(costOfSales) + stockMovement, "Cost of sales");
  add("StaffCostsEmployeeBenefitsExpense", "purchases", "5101", profitAndLoss.staffCosts, "Staff costs");
  if (profitAndLoss.administrativeExpenses !== undefined) {
    // The engine works the gain or loss on disposal from the sale, so it comes out of the expenses the file nets it into.
    add(
      "AdministrativeExpenses",
      "purchases",
      "5501",
      profitAndLoss.administrativeExpenses - depreciation + disposalResult,
      "Administrative expenses",
    );
  }
  if (profitAndLoss.otherOperatingExpenses !== undefined) {
    // The micro-entity charge is its own line; the engine's charge replaces it, so any charge beyond it comes off the other expenses.
    const extraCharge = Math.max(depreciation - taggedDepreciation, 0);
    add(
      "OtherOperatingExpensesFormat2",
      "purchases",
      "5501",
      profitAndLoss.otherOperatingExpenses - extraCharge + (profitAndLoss.administrativeExpenses === undefined ? disposalResult : 0),
      "Other operating expenses",
    );
  }
  return posts;
}

function plProfitBeforeTax(profitAndLoss) {
  if (profitAndLoss.profitBeforeTax !== undefined) return profitAndLoss.profitBeforeTax;
  const micro = microProfitBeforeTax(profitAndLoss);
  if (micro !== undefined) return micro + n(profitAndLoss.interestReceivable);
  if (profitAndLoss.operatingProfit !== undefined) return profitAndLoss.operatingProfit + n(profitAndLoss.interestReceivable);
  if (profitAndLoss.profit !== undefined) return profitAndLoss.profit + n(profitAndLoss.tax);
  return undefined;
}

function bookShell(accounts, period, taxData, extras) {
  const { name, number } = accounts.company;
  const book = buildNewBook(
    { product: "ltd", businessName: name || `Company ${number}`, yearEnd: period.end, vatRegistered: false },
    taxData,
  );
  book.documentInfo.periodCoveredStart = period.start;
  book.documentInfo.periodCoveredEnd = period.end;
  book.documentInfo.entriesComment = extras.comment;
  if (accounts.principalActivity) book.entityInformation.organizationDescription = accounts.principalActivity;
  if (number) book.entityInformation["diya-gl:companyNumber"] = number;
  book.accounts.purchases["5101"] = { "accountMainDescription": "Employee wages (non-PAYE)", "diya-gl:column": "S" };
  book.accounts.purchases["5501"] = { "accountMainDescription": "General admin", "diya-gl:column": "AA" };
  book.accounts.sales["4006"] = { accountMainDescription: "Fixed asset sales" };
  book.accounts.capital = { 3000: { accountMainDescription: "Share capital" }, 3100: { accountMainDescription: "Retained earnings" } };
  book.accounts.assets = {
    "0000": { accountMainDescription: "Land and buildings" },
    "0010": { accountMainDescription: "Plant and machinery" },
    "0020": { accountMainDescription: "Fixtures and fittings" },
    "0030": { accountMainDescription: "Computer equipment" },
    "0040": { accountMainDescription: "Motor vehicles" },
    "1100": { accountMainDescription: "Stock" },
    "1300": { accountMainDescription: "Trade debtors" },
  };
  book.accounts.liabilities = {
    2100: { accountMainDescription: "Trade creditors" },
    2300: { accountMainDescription: "Corporation Tax liability" },
    2600: { accountMainDescription: "Creditors due after more than one year" },
  };
  if (accounts.directors.length > 0) book.directors = accounts.directors.map((name) => ({ name, role: "Director" }));
  return book;
}

async function runEngine(book, lines, taxData) {
  const scenario = diyaGlToScenario(book, lines, "ltd");
  return calculateFromDiyaGl(book, lines, "ltd", taxData, scenario);
}

async function loadTaxData(period, deps) {
  const [{ loadTaxDataForBook }, { nodeResourceLoader }] = await Promise.all([
    import("./product-workbook.js"),
    import("./app-resources.js"),
  ]);
  const probe = {
    documentInfo: { periodCoveredEnd: period.end, periodCoveredStart: period.start },
    entityInformation: { "diya-gl:product": "Company" },
  };
  try {
    return await loadTaxDataForBook(probe, { resources: deps.resources ?? nodeResourceLoader() });
  } catch (cause) {
    throw new IxbrlError(`diya-gl has no tax tables for the year ending ${period.end} (${cause.message}).`);
  }
}

/**
 * Build one year's book and lines.
 * @param {Object} accounts - mapIxbrlAccounts' result
 * @param {"current"|"prior"} which
 * @param {Object} deps - { resources } the resource loader for the tax year's data
 */
async function buildYear(accounts, which, deps) {
  const current = which === "current";
  const differences = [];
  const label = current ? "Current year" : "Prior year";
  const period = current ? accounts.period : accounts.priorPeriod;
  const closingSheet = sheetOf(accounts.balanceSheet[current ? "currentYear" : "priorYear"]);
  const profitAndLoss = accounts.profitAndLoss?.[current ? "currentYear" : "priorYear"] ?? null;
  const taxData = await loadTaxData(period, deps);
  const additionsRate = taxData.depreciation?.[ADDITIONS_RATE_KEY] ?? 0;

  // The opening balance sheet is the prior year's closing one, for the file's own year.
  let opening = current ? sheetOf(accounts.balanceSheet.priorYear) : { ...closingSheet };

  // A file with no profit and loss account states the year's profit as the movement in net assets.
  let derivedProfit = 0;
  const derivesProfit = !profitAndLoss && current;
  if (derivesProfit) derivedProfit = closingSheet.equity - opening.equity;

  // Fixed assets.
  const taggedCharge = profitAndLoss?.depreciation ?? 0;
  const noteCharge =
    current && accounts.fixedAssetNote ? sum(Object.values(accounts.fixedAssetNote).map((entry) => entry.depreciationCharge)) : 0;
  const totalCharge = noteCharge || taggedCharge;
  const openingFixedNetBookValue = current ? opening.fixedAssets : closingSheet.fixedAssets + totalCharge;
  const assets = fixedAssetPlan({
    openingNetBookValue: openingFixedNetBookValue,
    closingNetBookValue: closingSheet.fixedAssets,
    note: current ? accounts.fixedAssetNote : null,
    totalCharge,
    additionsRate,
    gainOnDisposal: current ? profitAndLoss?.gainOnDisposal : undefined,
    differences,
    label,
  });

  // The profit and loss lines. A file with no profit and loss account has its year's profit after tax as the
  // movement in net assets, so the profit before tax is that movement with the tax the engine works put back.
  const stockMovement = current ? closingSheet.stock - opening.stock : 0;
  const additionsAmount = assets.additions;
  // The ledger takes interest as received net of the tax deducted at source; the engine grosses it up to the figure the accounts state.
  const interest = profitAndLoss ? money(n(profitAndLoss.interestReceivable) * (1 - n(taxData.corporation_tax?.small_profits_rate))) : 0;
  const postsFor = (derivedTax) => {
    const stated = profitAndLoss
      ? profitAndLossLines(profitAndLoss, {
          stockMovement,
          depreciation: assets.engineCharge,
          taggedDepreciation: n(profitAndLoss.depreciation),
          disposalResult: assets.disposalResult,
        })
      : [];
    const derivedBeforeTax = derivedProfit + (derivedProfit > 0 ? derivedTax : 0) + assets.engineCharge;
    if (derivesProfit && derivedBeforeTax !== 0) {
      stated.push({
        concept: "NetAssetsLiabilities",
        journal: "sales",
        account: "4000",
        amount: derivedBeforeTax,
        label: "Profit for the year, from the movement in net assets",
      });
    }
    // A line stated against its usual side (a loss on a sales line, a credit on a cost line) posts in the other journal.
    const usable = stated.map((post) =>
      post.amount >= 0
        ? post
        : post.journal === "sales"
          ? { ...post, journal: "purchases", account: "5501", amount: -post.amount }
          : { ...post, journal: "sales", account: "4003", amount: -post.amount },
    );
    return {
      usable,
      usableSales: sum(usable.filter((post) => post.journal === "sales").map((post) => post.amount)) + assets.disposalProceeds,
      usablePurchases: sum(usable.filter((post) => post.journal === "purchases").map((post) => post.amount)) + additionsAmount,
    };
  };
  let posted = postsFor(0);

  const build = (flow) => {
    // The prior year's opening balance sheet: the closing one worked back.
    const openingSheet = { ...opening, ...flow.opening };
    const book = bookShell(accounts, period, taxData, {
      comment: current
        ? "Summary of the figures in an iXBRL accounts file: one line for each tagged line of the year. The opening balance sheet is the file's prior-year balance sheet."
        : "Summary of the figures in an iXBRL accounts file: one line for each tagged line of the year before. Its opening balance sheet is worked back from the file's prior-year balance sheet.",
    });
    const writer = new LineWriter(current ? "IXC" : "IXP");
    openingJournal(writer, period.start, openingSheet, assets.classes);
    for (const post of posted.usable)
      writer.invoice(post.journal, period.end, referenceFor(post.concept), post.account, post.amount, post.label);
    if (additionsAmount > 0)
      writer.invoice(
        "purchases",
        period.end,
        referenceFor("PropertyPlantEquipmentAdditions"),
        "5900",
        additionsAmount,
        "Fixed asset additions",
      );

    for (const sale of assets.sales)
      writer.invoice("sales", period.end, referenceFor("DisposalsPropertyPlantEquipment"), "4006", sale.proceeds, "Fixed asset sale");

    const receiptsFromCustomers = posted.usableSales - (closingSheet.debtors - openingSheet.debtors);
    if (receiptsFromCustomers >= 0)
      writer.bank(period.end, referenceFor("Debtors"), "DR", true, receiptsFromCustomers, "Receipts from customers");
    else writer.bank(period.end, referenceFor("Debtors"), "DR", false, -receiptsFromCustomers, "Refunds to customers");
    if (interest > 0)
      writer.bank(
        period.end,
        referenceFor("OtherInterestReceivableSimilarIncomeFinanceIncome"),
        "K",
        true,
        interest,
        "Bank interest received",
      );
    const paymentsToSuppliers = openingSheet.creditors + posted.usablePurchases - closingSheet.creditors;
    if (paymentsToSuppliers >= 0)
      writer.bank(period.end, referenceFor("Creditors"), "CR", false, paymentsToSuppliers, "Payments to suppliers");
    else writer.bank(period.end, referenceFor("Creditors"), "CR", true, -paymentsToSuppliers, "Refunds from suppliers");
    const longTerm = closingSheet.afterOneYear - openingSheet.afterOneYear;
    if (longTerm > 0)
      writer.bank(period.end, referenceFor("Creditors"), "LCR", true, longTerm, "Creditors falling due after more than one year");
    else if (longTerm < 0)
      writer.bank(period.end, referenceFor("Creditors"), "LCR", false, -longTerm, "Repaid creditors falling due after more than one year");
    if (flow.taxPaid > 0) writer.bank(period.end, referenceFor("CorporationTaxPayable"), "RT", false, flow.taxPaid, "Corporation Tax paid");
    if (flow.dividend > 0) writer.bank(period.end, referenceFor("Equity"), "DV", false, flow.dividend, "Dividend paid");

    if (flow.dividend > 0) book.dividends = [{ boardMeetingDate: period.end, declaredDate: period.end, amount: money(flow.dividend) }];
    if (closingSheet.stock > 0 || openingSheet.stock > 0)
      book.stock = { openingValue: money(openingSheet.stock), closingValue: money(closingSheet.stock) };
    if (assets.classes.length > 0) {
      book.fixedAssets = assets.classes.map((entry, index) => ({
        assetID: entry.disposed ? `FA-IXBRL-${entry.className}-disposed-${index + 1}` : `FA-IXBRL-${entry.className}`,
        class: REGISTER_CLASS[entry.className],
        description: entry.disposed ? `${CLASS_LABEL[entry.className]}, disposed of` : CLASS_LABEL[entry.className],
        cost: money(entry.cost),
        accumulatedDepreciation: money(entry.depreciation),
        depreciationRate: entry.rate,
        ...(entry.taxWrittenDownValue === undefined ? {} : { taxWrittenDownValue: money(entry.taxWrittenDownValue) }),
      }));
    }
    book.openingBalances = toV2OpeningBalances(buildOpeningBalance(writer.lines));
    return { book, lines: writer.lines, openingSheet };
  };

  // First pass: no dividend and no tax paid. The engine's tax and profit give the amounts that
  // bring the closing balance sheet to the file's.
  const flows = { opening: {}, dividend: 0, taxPaid: 0 };
  let first;
  let results;
  let derivedTax = 0;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    posted = postsFor(derivedTax);
    first = build(flows);
    results = await runEngine(first.book, first.lines, taxData);
    const worked = results["PubP&L"].F50;
    if (!derivesProfit || Math.abs(worked - derivedTax) < 0.005) break;
    derivedTax = worked;
  }
  const closingTax = results.PubBalSht.E17;
  const closingRetained = results.PubBalSht.F39 - results.PubBalSht.F36;
  if (current) {
    flows.taxPaid = Math.max(closingTax - closingSheet.corporationTax, 0);
    if (closingTax - closingSheet.corporationTax < -0.005)
      differences.push(`${label}: the book owes ${money(closingTax)} Corporation Tax and the file ${closingSheet.corporationTax}.`);
    flows.dividend = Math.max(closingRetained - closingSheet.retained, 0);
    if (closingRetained - closingSheet.retained < -0.005) {
      differences.push(
        `${label}: the book's profit and loss account is ${money(closingRetained)} and the file's ${closingSheet.retained}.`,
      );
    }
  } else {
    // No dividend before the first year: the opening reserves are what the closing ones less the year's profit leave.
    const profitAfterTax = closingRetained - first.openingSheet.retained;
    const retained = closingSheet.retained - profitAfterTax;
    const taxOpening = Math.max(closingSheet.corporationTax - (closingTax - first.openingSheet.corporationTax), 0);
    flows.taxPaid = taxOpening + (closingTax - first.openingSheet.corporationTax) - closingSheet.corporationTax;
    const receipts = posted.usableSales - (closingSheet.debtors - opening.debtors) + interest;
    const payments = opening.creditors + posted.usablePurchases - closingSheet.creditors + flows.taxPaid;
    const longTerm = closingSheet.afterOneYear - opening.afterOneYear;
    flows.opening = { retained, corporationTax: taxOpening, cash: closingSheet.cash - (receipts - payments + longTerm) };
  }
  const final = build(flows);
  const finalResults = await runEngine(final.book, final.lines, taxData);

  const { "PubBalSht": balanceSheet, "PubP&L": publishedPl } = finalResults;
  const statedProfit = profitAndLoss ? plProfitBeforeTax(profitAndLoss) : undefined;
  if (statedProfit !== undefined && Math.abs(publishedPl.F49 - statedProfit) > 1) {
    differences.push(`${label}: the book's profit before tax is ${money(publishedPl.F49)} and the file's ${statedProfit}.`);
  }
  if (profitAndLoss?.tax !== undefined && Math.abs(publishedPl.F50 - profitAndLoss.tax) > 1) {
    differences.push(
      `${label}: the book works ${money(publishedPl.F50)} Corporation Tax; the file states ${profitAndLoss.tax}. The accounts filed keep the file's figure.`,
    );
  }
  if (Math.abs(balanceSheet.F33 - closingSheet.equity) > 1) {
    differences.push(`${label}: the book's net assets are ${money(balanceSheet.F33)} and the file's ${closingSheet.equity}.`);
  }
  return { book: final.book, lines: final.lines, differences, results: finalResults };
}

/**
 * The summary books for a file: the file's own year, and the year before.
 * @param {Object} accounts - mapIxbrlAccounts' result
 * @param {Object} [deps]
 * @param {Object} [deps.resources] - resource loader for the tax year data; defaults to reading app/
 * @returns {Promise<{book: Object, lines: Array, comparative: {book: Object, lines: Array}, differences: string[]}>}
 */
export async function buildIxbrlSummaryBooks(accounts, deps = {}) {
  const priorPeriod = accounts.priorPeriod ?? {
    start: addYears(addDays(accounts.period.start, 0), -1),
    end: addDays(accounts.period.start, -1),
  };
  const withPrior = { ...accounts, priorPeriod };
  const current = await buildYear(withPrior, "current", deps);
  const prior = await buildYear(withPrior, "prior", deps);
  return {
    book: current.book,
    lines: current.lines,
    comparative: { book: prior.book, lines: prior.lines },
    differences: [...current.differences, ...prior.differences],
  };
}
