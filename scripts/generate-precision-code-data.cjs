#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a Date as YYYY-MM-DD */
function fmt(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/** Return the last day of a given year/month (1-based month) */
function lastDay(year, month) {
  return new Date(year, month, 0).getDate();
}

/** Return YYYY-MM-DD for a given FY month index (0=Apr 2025 .. 11=Mar 2026), on the given day */
function fyDate(monthIndex, day) {
  const baseMonth = 4; // April
  const m = baseMonth + monthIndex;
  const year = m <= 12 ? 2025 : 2026;
  const month = m <= 12 ? m : m - 12;
  const maxDay = lastDay(year, month);
  const d = Math.min(day, maxDay);
  return `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Return YYYY-MM-DD for the last day of a FY month index */
function fyLastDay(monthIndex) {
  const baseMonth = 4;
  const m = baseMonth + monthIndex;
  const year = m <= 12 ? 2025 : 2026;
  const month = m <= 12 ? m : m - 12;
  return fyDate(monthIndex, lastDay(year, month));
}

/** FY month names for comments */
const FY_MONTH_NAMES = [
  'Apr 2025', 'May 2025', 'Jun 2025', 'Jul 2025', 'Aug 2025', 'Sep 2025',
  'Oct 2025', 'Nov 2025', 'Dec 2025', 'Jan 2026', 'Feb 2026', 'Mar 2026'
];

// Collect all entries unsorted; we sort at the end
const entries = [];

// ---------------------------------------------------------------------------
// SALES
// ---------------------------------------------------------------------------

function addSale(opts) {
  entries.push({
    sourceJournalID: 'sales',
    postingDate: opts.date,
    accountMainID: opts.account,
    amount: opts.amount,
    detailComment: opts.customer,
    lineItemComment: opts.comment,
    documentType: opts.docType || 'invoice',
    documentReference: opts.docRef,
    taxCode: opts.taxCode || 'S',
    taxRate: opts.taxRate != null ? opts.taxRate : 0.2,
  });
}

// Acme Corp: 8,000 gross/month x 12 (INV-1001 to INV-1012)
for (let i = 0; i < 12; i++) {
  addSale({
    date: fyDate(i, 15), account: '4000', amount: 8000,
    customer: 'Acme Corp', comment: 'IT consultancy services',
    docRef: `INV-${1001 + i}`,
  });
}

// TechStart Ltd: 2,400 gross/month x 12 (INV-1101 to INV-1112)
for (let i = 0; i < 12; i++) {
  addSale({
    date: fyDate(i, 18), account: '4000', amount: 2400,
    customer: 'TechStart Ltd', comment: 'IT consultancy retainer',
    docRef: `INV-${1101 + i}`,
  });
}

// DataFlow Inc: 1,800 gross, every other month starting Apr (Apr, Jun, Aug, Oct, Dec, Feb)
const dataflowMonths = [0, 2, 4, 6, 8, 10]; // Apr, Jun, Aug, Oct, Dec, Feb
for (let j = 0; j < dataflowMonths.length; j++) {
  addSale({
    date: fyDate(dataflowMonths[j], 20), account: '4000', amount: 1800,
    customer: 'DataFlow Inc', comment: 'Ad-hoc consultancy project',
    docRef: `INV-${1201 + j}`,
  });
}

// Beta Systems: 1,200 gross quarterly Apr, Jul, Oct, Jan (INV-1301 to INV-1304)
const betaMonths = [0, 3, 6, 9];
for (let j = 0; j < betaMonths.length; j++) {
  addSale({
    date: fyDate(betaMonths[j], 1), account: '4001', amount: 1200,
    customer: 'Beta Systems', comment: 'Software licence renewal',
    docRef: `INV-${1301 + j}`,
  });
}

// CloudNine Ltd: 600 gross monthly (INV-1401 to INV-1412)
for (let i = 0; i < 12; i++) {
  addSale({
    date: fyDate(i, 5), account: '4001', amount: 600,
    customer: 'CloudNine Ltd', comment: 'SaaS licence fee',
    docRef: `INV-${1401 + i}`,
  });
}

// Product C training
addSale({ date: '2025-06-20', account: '4002', amount: 2400, customer: 'Gamma Ltd', comment: 'Advanced DevOps training course', docRef: 'INV-1501' });
addSale({ date: '2025-11-20', account: '4002', amount: 3600, customer: 'Delta PLC', comment: 'Cloud architecture workshop', docRef: 'INV-1502' });
addSale({ date: '2026-02-20', account: '4002', amount: 1800, customer: 'MegaCorp', comment: 'Security awareness training', docRef: 'INV-1503' });
addSale({ date: '2025-09-20', account: '4002', amount: 960, customer: 'StartupHub', comment: 'Agile methodology workshop', docRef: 'INV-1504' });

// Other direct income (4003)
addSale({ date: '2025-09-25', account: '4003', amount: 600, customer: 'Epsilon Partners', comment: 'Client referral commission', docRef: 'INV-1601' });
addSale({ date: '2026-01-25', account: '4003', amount: 480, customer: 'Lambda Corp', comment: 'Client referral commission', docRef: 'INV-1602' });

// Grants (4004, OS, 0)
addSale({ date: '2025-08-01', account: '4004', amount: 2500, customer: 'Innovate UK', comment: 'Small business innovation grant', docRef: 'INV-1701', taxCode: 'OS', taxRate: 0 });

// Bad debts (4005) - credit note
addSale({ date: '2026-03-31', account: '4005', amount: 360, customer: 'Zeta Corp', comment: 'Bad debt written off', docRef: 'CN-1801', docType: 'credit-note' });

// Fixed asset sales (4006)
addSale({ date: '2025-10-10', account: '4006', amount: 15000, customer: 'Private buyer', comment: 'Disposal of company van', docRef: 'INV-1901' });

// Additional consultancy (4000)
// QuickFix IT: 960 gross in May, Aug, Nov
const quickfixMonths = [1, 4, 7];
for (let j = 0; j < quickfixMonths.length; j++) {
  addSale({
    date: fyDate(quickfixMonths[j], 12), account: '4000', amount: 960,
    customer: 'QuickFix IT', comment: 'IT support consultancy',
    docRef: `INV-${2001 + j}`,
  });
}

// WidgetWorks: 1,440 gross in Jun, Sep, Dec, Mar
const widgetMonths = [2, 5, 8, 11];
for (let j = 0; j < widgetMonths.length; j++) {
  addSale({
    date: fyDate(widgetMonths[j], 22), account: '4000', amount: 1440,
    customer: 'WidgetWorks', comment: 'Project consultancy',
    docRef: `INV-${2101 + j}`,
  });
}

// Pinnacle Group: 720 gross monthly (INV-2201 to INV-2212)
for (let i = 0; i < 12; i++) {
  addSale({
    date: fyDate(i, 10), account: '4000', amount: 720,
    customer: 'Pinnacle Group', comment: 'Monthly support contract',
    docRef: `INV-${2201 + i}`,
  });
}

// NorthStar Digital: 2,160 gross in Jul, Oct, Jan
const northstarMonths = [3, 6, 9];
for (let j = 0; j < northstarMonths.length; j++) {
  addSale({
    date: fyDate(northstarMonths[j], 14), account: '4000', amount: 2160,
    customer: 'NorthStar Digital', comment: 'Project delivery',
    docRef: `INV-${2301 + j}`,
  });
}

// Cedar Systems: 480 gross monthly (INV-2401 to INV-2412)
for (let i = 0; i < 12; i++) {
  addSale({
    date: fyDate(i, 8), account: '4000', amount: 480,
    customer: 'Cedar Systems', comment: 'Managed services',
    docRef: `INV-${2401 + i}`,
  });
}

// Oakridge Partners: 1,200 gross in May, Aug, Nov, Feb
const oakridgeMonths = [1, 4, 7, 10];
for (let j = 0; j < oakridgeMonths.length; j++) {
  addSale({
    date: fyDate(oakridgeMonths[j], 25), account: '4000', amount: 1200,
    customer: 'Oakridge Partners', comment: 'Quarterly consulting engagement',
    docRef: `INV-${2501 + j}`,
  });
}

// FreshField Ltd: 360 gross monthly, account 4001 (INV-2601 to INV-2612)
for (let i = 0; i < 12; i++) {
  addSale({
    date: fyDate(i, 3), account: '4001', amount: 360,
    customer: 'FreshField Ltd', comment: 'Software monitoring licence',
    docRef: `INV-${2601 + i}`,
  });
}

// Horizon Analytics: 840 gross quarterly, account 4003 (INV-2701 to INV-2704)
const horizonMonths = [0, 3, 6, 9];
for (let j = 0; j < horizonMonths.length; j++) {
  addSale({
    date: fyDate(horizonMonths[j], 28), account: '4003', amount: 840,
    customer: 'Horizon Analytics', comment: 'Data analytics commission',
    docRef: `INV-${2701 + j}`,
  });
}

// Summit Training: 1,200 gross in May, Sep, Jan, account 4002
const summitMonths = [1, 5, 9];
for (let j = 0; j < summitMonths.length; j++) {
  addSale({
    date: fyDate(summitMonths[j], 16), account: '4002', amount: 1200,
    customer: 'Summit Training', comment: 'Technical training delivery',
    docRef: `INV-${2801 + j}`,
  });
}

// ---------------------------------------------------------------------------
// PURCHASES
// ---------------------------------------------------------------------------

function addPurchase(opts) {
  const entry = {
    sourceJournalID: 'purchases',
    postingDate: opts.date,
    accountMainID: opts.account,
    amount: opts.amount,
    detailComment: opts.supplier,
    lineItemComment: opts.comment,
    documentType: opts.docType || 'invoice',
    documentReference: opts.docRef || undefined,
    taxCode: opts.taxCode || 'S',
    taxRate: opts.taxRate != null ? opts.taxRate : 0.2,
  };
  if (opts.cisDeduction != null) {
    entry['diya-gl:cisDeduction'] = opts.cisDeduction;
    entry['diya-gl:cisRate'] = opts.cisRate;
  }
  if (opts.measurableQuantity != null) {
    entry.measurableQuantity = opts.measurableQuantity;
    entry.measurableUnitOfMeasure = opts.unitOfMeasure || 'miles';
    entry.measurableDescription = opts.measurableDescription;
  }
  // Remove undefined values
  for (const k of Object.keys(entry)) {
    if (entry[k] === undefined) delete entry[k];
  }
  entries.push(entry);
}

// --- Monthly recurring (12 each) ---

// 5200 WorkSpace Ltd rent: 1,200 gross, 1st of month
for (let i = 0; i < 12; i++) {
  addPurchase({ date: fyDate(i, 1), account: '5200', amount: 1200, supplier: 'WorkSpace Ltd', comment: 'Monthly office rent' });
}

// 5501 BT Business phone: 60 gross, 20th of month
for (let i = 0; i < 12; i++) {
  addPurchase({ date: fyDate(i, 20), account: '5501', amount: 60, supplier: 'BT Business', comment: 'Telephone line rental' });
}

// 5800 Smith & Co accountancy: 300 gross, last day of month
for (let i = 0; i < 12; i++) {
  addPurchase({ date: fyLastDay(i), account: '5800', amount: 300, supplier: 'Smith & Co', comment: 'Monthly accountancy retainer' });
}

// 5601 Shell fuel: 150 gross, 15th of month
for (let i = 0; i < 12; i++) {
  addPurchase({ date: fyDate(i, 15), account: '5601', amount: 150, supplier: 'Shell', comment: 'Fuel for company vehicle' });
}

// 5601 Shell fuel 2nd: 120 gross, 28th of month
for (let i = 0; i < 12; i++) {
  addPurchase({ date: fyDate(i, 28), account: '5601', amount: 120, supplier: 'Shell', comment: 'Additional fuel purchase' });
}

// 5401 Amazon supplies: 36 gross, 10th of month
for (let i = 0; i < 12; i++) {
  addPurchase({ date: fyDate(i, 10), account: '5401', amount: 36, supplier: 'Amazon', comment: 'Office supplies' });
}

// 5401 Ryman stationery: 24 gross, 5th of month
for (let i = 0; i < 12; i++) {
  addPurchase({ date: fyDate(i, 5), account: '5401', amount: 24, supplier: 'Ryman', comment: 'Stationery supplies' });
}

// 5601 NCP parking: 18 gross, 12th of month
for (let i = 0; i < 12; i++) {
  addPurchase({ date: fyDate(i, 12), account: '5601', amount: 18, supplier: 'NCP', comment: 'Parking charges' });
}

// 5501 Microsoft 365: 30 gross, 1st of month
for (let i = 0; i < 12; i++) {
  addPurchase({ date: fyDate(i, 1), account: '5501', amount: 30, supplier: 'Microsoft', comment: 'Microsoft 365 subscription' });
}

// 5501 Slack subscription: 15 gross, 1st of month
for (let i = 0; i < 12; i++) {
  addPurchase({ date: fyDate(i, 1), account: '5501', amount: 15, supplier: 'Slack', comment: 'Slack team subscription' });
}

// 5002 AWS hosting: 180 gross, 3rd of month
for (let i = 0; i < 12; i++) {
  addPurchase({ date: fyDate(i, 3), account: '5002', amount: 180, supplier: 'AWS', comment: 'Cloud hosting charges' });
}

// 5002 GitHub: 45 gross, 1st of month
for (let i = 0; i < 12; i++) {
  addPurchase({ date: fyDate(i, 1), account: '5002', amount: 45, supplier: 'GitHub', comment: 'GitHub Team subscription' });
}

// 5401 Screwfix misc: 18 gross, 22nd of month
for (let i = 0; i < 12; i++) {
  addPurchase({ date: fyDate(i, 22), account: '5401', amount: 18, supplier: 'Screwfix', comment: 'Miscellaneous supplies' });
}

// 5600 train tickets: 48 gross, 8th of month
for (let i = 0; i < 12; i++) {
  addPurchase({ date: fyDate(i, 8), account: '5600', amount: 48, supplier: 'National Rail', comment: 'Train ticket client meeting' });
}

// 5501 Royal Mail postage: 12 gross, 15th of month
for (let i = 0; i < 12; i++) {
  addPurchase({ date: fyDate(i, 15), account: '5501', amount: 12, supplier: 'Royal Mail', comment: 'Postage' });
}

// --- Quarterly recurring (4 each) ---

// 5201 EnergySupply utilities
const utilityAmounts = [360, 300, 420, 360];
const utilityMonths = [2, 5, 8, 11]; // Jun, Sep, Dec, Mar
for (let j = 0; j < 4; j++) {
  addPurchase({ date: fyDate(utilityMonths[j], 25), account: '5201', amount: utilityAmounts[j], supplier: 'EnergySupply', comment: 'Quarterly utility bill' });
}

// 5701 Xerox printer lease: Apr, Jul, Oct, Jan — 180 each
const xeroxMonths = [0, 3, 6, 9];
for (let j = 0; j < 4; j++) {
  addPurchase({ date: fyDate(xeroxMonths[j], 10), account: '5701', amount: 180, supplier: 'Xerox', comment: 'Printer lease payment' });
}

// 5000 TechParts materials: Apr 600, Jul 720, Oct 480, Jan 600
const techpartsAmounts = [600, 720, 480, 600];
const techpartsMonths = [0, 3, 6, 9];
for (let j = 0; j < 4; j++) {
  addPurchase({ date: fyDate(techpartsMonths[j], 10), account: '5000', amount: techpartsAmounts[j], supplier: 'TechParts', comment: 'Hardware components for resale' });
}

// 5000 ComponentsDirect: May 480, Aug 360, Nov 540, Feb 420
const compAmounts = [480, 360, 540, 420];
const compMonths = [1, 4, 7, 10];
for (let j = 0; j < 4; j++) {
  addPurchase({ date: fyDate(compMonths[j], 15), account: '5000', amount: compAmounts[j], supplier: 'ComponentsDirect', comment: 'Electronic components' });
}

// --- Semi-annual / annual ---

// 5700 Hiscox insurance: Apr 1,440 — exempt
addPurchase({ date: '2025-04-01', account: '5700', amount: 1440, supplier: 'Hiscox', comment: 'Professional indemnity insurance', taxCode: 'E', taxRate: 0 });

// 5500 Google Ads: May 600, Oct 1,800
addPurchase({ date: '2025-05-10', account: '5500', amount: 600, supplier: 'Google Ads', comment: 'PPC advertising campaign' });
addPurchase({ date: '2025-10-10', account: '5500', amount: 1800, supplier: 'Google Ads', comment: 'PPC advertising campaign Q3' });

// 5500 TechExpo: Oct 1,200
addPurchase({ date: '2025-10-15', account: '5500', amount: 1200, supplier: 'TechExpo', comment: 'Exhibition stand and materials' });

// 5500 LinkedIn Ads: Jul 480, Jan 480
addPurchase({ date: '2025-07-05', account: '5500', amount: 480, supplier: 'LinkedIn', comment: 'Sponsored content campaign' });
addPurchase({ date: '2026-01-05', account: '5500', amount: 480, supplier: 'LinkedIn', comment: 'Sponsored content campaign' });

// 5301 ToolHire: Jul 480, Feb 360
addPurchase({ date: '2025-07-12', account: '5301', amount: 480, supplier: 'ToolHire', comment: 'Equipment hire for installation' });
addPurchase({ date: '2026-02-12', account: '5301', amount: 360, supplier: 'ToolHire', comment: 'Equipment hire for installation' });

// 5400 PC Repair Shop: Aug 240, Feb 360
addPurchase({ date: '2025-08-18', account: '5400', amount: 240, supplier: 'PC Repair Shop', comment: 'Laptop screen repair' });
addPurchase({ date: '2026-02-18', account: '5400', amount: 360, supplier: 'PC Repair Shop', comment: 'Desktop motherboard replacement' });

// 5300 ParcelForce: May 180, Nov 240
addPurchase({ date: '2025-05-20', account: '5300', amount: 180, supplier: 'ParcelForce', comment: 'Equipment delivery' });
addPurchase({ date: '2025-11-20', account: '5300', amount: 240, supplier: 'ParcelForce', comment: 'Equipment delivery' });

// 5300 DHL: Jul 120, Jan 180
addPurchase({ date: '2025-07-20', account: '5300', amount: 120, supplier: 'DHL', comment: 'International courier' });
addPurchase({ date: '2026-01-20', account: '5300', amount: 180, supplier: 'DHL', comment: 'International courier' });

// 5300 Royal Mail courier: Sep 96, Mar 144
addPurchase({ date: '2025-09-10', account: '5300', amount: 96, supplier: 'Royal Mail', comment: 'Special delivery courier' });
addPurchase({ date: '2026-03-10', account: '5300', amount: 144, supplier: 'Royal Mail', comment: 'Special delivery courier' });

// 5800 Jones Solicitors: Sep 960
addPurchase({ date: '2025-09-15', account: '5800', amount: 960, supplier: 'Jones Solicitors', comment: 'Contract review and legal advice' });

// 5801 Code Club UK donation: Dec 500 — OS
addPurchase({ date: '2025-12-15', account: '5801', amount: 500, supplier: 'Code Club UK', comment: 'Charitable donation', taxCode: 'OS', taxRate: 0 });

// 5802 J. Smith Consulting goodwill: Jul 3,000 — OS
addPurchase({ date: '2025-07-01', account: '5802', amount: 3000, supplier: 'J. Smith Consulting', comment: 'Goodwill amortisation', taxCode: 'OS', taxRate: 0 });

// 5100 Director fees non-PAYE: Dec 5,000 — OS
addPurchase({ date: '2025-12-31', account: '5100', amount: 5000, supplier: 'Director', comment: 'Director fees (non-PAYE)', taxCode: 'OS', taxRate: 0 });

// 5101 Casual worker: Aug 800 — OS
addPurchase({ date: '2025-08-20', account: '5101', amount: 800, supplier: 'Casual worker', comment: 'Temporary labour', taxCode: 'OS', taxRate: 0 });

// --- Additional monthly variety ---

// 5601 BP fuel: 180 gross, 5th of month
for (let i = 0; i < 12; i++) {
  addPurchase({ date: fyDate(i, 5), account: '5601', amount: 180, supplier: 'BP', comment: 'Fuel for company vehicle' });
}

// 5600 Premier Inn hotel: Jun 180, Oct 120, Feb 240
addPurchase({ date: '2025-06-18', account: '5600', amount: 180, supplier: 'Premier Inn', comment: 'Hotel for London client meeting' });
addPurchase({ date: '2025-10-18', account: '5600', amount: 120, supplier: 'Premier Inn', comment: 'Hotel for Birmingham meeting' });
addPurchase({ date: '2026-02-18', account: '5600', amount: 240, supplier: 'Premier Inn', comment: 'Hotel for two-day workshop' });

// 5600 Trainline: May 60, Aug 48, Nov 72, Feb 36
addPurchase({ date: '2025-05-06', account: '5600', amount: 60, supplier: 'Trainline', comment: 'Advance train ticket' });
addPurchase({ date: '2025-08-06', account: '5600', amount: 48, supplier: 'Trainline', comment: 'Advance train ticket' });
addPurchase({ date: '2025-11-06', account: '5600', amount: 72, supplier: 'Trainline', comment: 'Advance train ticket' });
addPurchase({ date: '2026-02-06', account: '5600', amount: 36, supplier: 'Trainline', comment: 'Advance train ticket' });

// 5401 Toolstation: Apr 42, Jun 30, Aug 48, Oct 36, Dec 24, Feb 18
const toolstationData = [
  [0, 42], [2, 30], [4, 48], [6, 36], [8, 24], [10, 18]
];
for (const [mi, amt] of toolstationData) {
  addPurchase({ date: fyDate(mi, 14), account: '5401', amount: amt, supplier: 'Toolstation', comment: 'Assorted fixings and parts' });
}

// 5501 WHSmith: May 18, Jul 24, Sep 12, Nov 30, Jan 18, Mar 24
const whsmithData = [
  [1, 18], [3, 24], [5, 12], [7, 30], [9, 18], [11, 24]
];
for (const [mi, amt] of whsmithData) {
  addPurchase({ date: fyDate(mi, 16), account: '5501', amount: amt, supplier: 'WHSmith', comment: 'Magazines and stationery' });
}

// 5000 ElectroParts: Jun 360, Sep 240, Dec 480, Mar 300
const electroData = [
  [2, 360], [5, 240], [8, 480], [11, 300]
];
for (const [mi, amt] of electroData) {
  addPurchase({ date: fyDate(mi, 18), account: '5000', amount: amt, supplier: 'ElectroParts', comment: 'Specialist electronic components' });
}

// 5000 CableCo: May 240, Aug 180, Nov 300, Feb 240
const cableData = [
  [1, 240], [4, 180], [7, 300], [10, 240]
];
for (const [mi, amt] of cableData) {
  addPurchase({ date: fyDate(mi, 20), account: '5000', amount: amt, supplier: 'CableCo', comment: 'Cabling and connectors' });
}

// 5002 DigitalOcean: Apr, Jun, Aug, Oct, Dec, Feb — 36 each
const doMonths = [0, 2, 4, 6, 8, 10];
for (const mi of doMonths) {
  addPurchase({ date: fyDate(mi, 5), account: '5002', amount: 36, supplier: 'DigitalOcean', comment: 'Cloud VPS hosting' });
}

// 5301 Hilti hire: May 240, Sep 360, Jan 180
addPurchase({ date: '2025-05-08', account: '5301', amount: 240, supplier: 'Hilti', comment: 'Power tool hire' });
addPurchase({ date: '2025-09-08', account: '5301', amount: 360, supplier: 'Hilti', comment: 'Power tool hire' });
addPurchase({ date: '2026-01-08', account: '5301', amount: 180, supplier: 'Hilti', comment: 'Power tool hire' });

// 5400 Office Maintenance: Apr 120, Jul 180, Oct 96, Jan 144
const offMaintData = [
  [0, 120], [3, 180], [6, 96], [9, 144]
];
for (const [mi, amt] of offMaintData) {
  addPurchase({ date: fyDate(mi, 20), account: '5400', amount: amt, supplier: 'Office Maintenance Ltd', comment: 'Premises maintenance and repairs' });
}

// 5600 Uber: 24 gross each month, 14th
for (let i = 0; i < 12; i++) {
  addPurchase({ date: fyDate(i, 14), account: '5600', amount: 24, supplier: 'Uber', comment: 'Taxi to client site' });
}

// 5601 Halfords: May 48, Sep 72, Jan 36, Mar 60
const halfordsData = [
  [1, 48], [5, 72], [9, 36], [11, 60]
];
for (const [mi, amt] of halfordsData) {
  addPurchase({ date: fyDate(mi, 22), account: '5601', amount: amt, supplier: 'Halfords', comment: 'Vehicle maintenance supplies' });
}

// 5501 Vistaprint: Jun 96, Dec 120
addPurchase({ date: '2025-06-10', account: '5501', amount: 96, supplier: 'Vistaprint', comment: 'Business cards and flyers' });
addPurchase({ date: '2025-12-10', account: '5501', amount: 120, supplier: 'Vistaprint', comment: 'Business cards and flyers' });

// 5700 Simply Business contents: Oct 360 — exempt
addPurchase({ date: '2025-10-01', account: '5700', amount: 360, supplier: 'Simply Business', comment: 'Contents insurance renewal', taxCode: 'E', taxRate: 0 });

// --- Fixed asset purchases (5900) ---
addPurchase({ date: '2025-05-15', account: '5900', amount: 1800, supplier: 'Dell', comment: 'New laptop for development', docRef: 'PUR-FA-001' });
addPurchase({ date: '2025-10-25', account: '5900', amount: 36000, supplier: 'Ford', comment: 'Ford Transit Custom van', docRef: 'PUR-FA-002' });
addPurchase({ date: '2025-07-15', account: '5900', amount: 1200, supplier: 'IKEA', comment: 'Office furniture', docRef: 'PUR-FA-003' });

// --- CIS sub-contractor (5001) ---
addPurchase({
  date: '2025-06-15', account: '5001', amount: 5000, supplier: 'BuildTech Solutions', comment: 'Sub-contractor network installation',
  docRef: 'PUR-CIS-001', cisDeduction: 1000, cisRate: 0.20,
});
addPurchase({
  date: '2025-11-15', account: '5001', amount: 3000, supplier: 'BuildTech Solutions', comment: 'Sub-contractor cabling works',
  docRef: 'PUR-CIS-002', cisDeduction: 600, cisRate: 0.20,
});

// --- Loan interest (5803) ---
const loanIntData = [
  [2, 250], [5, 208], [8, 167], [11, 125]
];
for (let j = 0; j < loanIntData.length; j++) {
  const [mi, amt] = loanIntData[j];
  addPurchase({
    date: fyLastDay(mi), account: '5803', amount: amt, supplier: 'Directors loan', comment: 'Directors loan interest',
    docRef: `PUR-INT-${String(j + 1).padStart(3, '0')}`, taxCode: 'OS', taxRate: 0,
  });
}

// --- More monthly variety to approach 360 ---

// 5601 Jet garage: 96 gross, 18th of each month
for (let i = 0; i < 12; i++) {
  addPurchase({ date: fyDate(i, 18), account: '5601', amount: 96, supplier: 'Jet', comment: 'Fuel for company vehicle' });
}

// 5401 Wilko supplies: 15 gross, 25th of each month
for (let i = 0; i < 12; i++) {
  addPurchase({ date: fyDate(i, 25), account: '5401', amount: 15, supplier: 'Wilko', comment: 'Cleaning and kitchen supplies' });
}

// 5002 Cloudflare: 24 gross, 1st of each month
for (let i = 0; i < 12; i++) {
  addPurchase({ date: fyDate(i, 1), account: '5002', amount: 24, supplier: 'Cloudflare', comment: 'CDN and DNS services' });
}

// 5501 Zoom subscription: 18 gross, 1st of each month
for (let i = 0; i < 12; i++) {
  addPurchase({ date: fyDate(i, 1), account: '5501', amount: 18, supplier: 'Zoom', comment: 'Video conferencing subscription' });
}

// 5600 Costa Coffee (client meetings): 12 gross, 14th of each month
for (let i = 0; i < 12; i++) {
  addPurchase({ date: fyDate(i, 14), account: '5600', amount: 12, supplier: 'Costa Coffee', comment: 'Client meeting refreshments' });
}

// 5401 Argos misc: 22 gross, 3rd of each month
for (let i = 0; i < 12; i++) {
  addPurchase({ date: fyDate(i, 3), account: '5401', amount: 22, supplier: 'Argos', comment: 'Miscellaneous office items' });
}

// 5600 Greggs (working lunch): 8 gross, 21st of each month
for (let i = 0; i < 12; i++) {
  addPurchase({ date: fyDate(i, 21), account: '5600', amount: 8, supplier: 'Greggs', comment: 'Working lunch' });
}

// ---------------------------------------------------------------------------
// MILEAGE entries (purchases with measurable fields)
// ---------------------------------------------------------------------------

const mileageData = [
  { mi: 0,  miles: 85,  dest: 'Manchester',  amount: 38.25 },
  { mi: 1,  miles: 120, dest: 'Birmingham',  amount: 54.00 },
  { mi: 2,  miles: 200, dest: 'London',      amount: 90.00 },
  { mi: 3,  miles: 45,  dest: 'Leeds',       amount: 20.25 },
  { mi: 4,  miles: 85,  dest: 'Manchester',  amount: 38.25 },
  { mi: 5,  miles: 160, dest: 'Bristol',     amount: 72.00 },
  { mi: 6,  miles: 95,  dest: 'Sheffield',   amount: 42.75 },
  { mi: 7,  miles: 180, dest: 'London',      amount: 81.00 },
  { mi: 8,  miles: 110, dest: 'Various',     amount: 49.50 },
  { mi: 9,  miles: 85,  dest: 'Manchester',  amount: 38.25 },
  { mi: 10, miles: 70,  dest: 'Nottingham',  amount: 31.50 },
  { mi: 11, miles: 130, dest: 'Various',     amount: 58.50 },
];

for (const m of mileageData) {
  addPurchase({
    date: fyDate(m.mi, 25), account: '5601', amount: m.amount,
    supplier: 'Mileage claim', comment: `Business mileage to ${m.dest}`,
    docType: 'mileage-log', taxCode: 'OS', taxRate: 0,
    measurableQuantity: m.miles, unitOfMeasure: 'miles',
    measurableDescription: `${m.dest} round trip`,
  });
}

// ---------------------------------------------------------------------------
// BANK entries
// ---------------------------------------------------------------------------

function addBank(opts) {
  const entry = {
    sourceJournalID: 'bank',
    postingDate: opts.date,
    accountMainID: opts.bankAccountID,
    amount: opts.amount,
    detailComment: opts.detail,
    lineItemComment: opts.comment,
    documentType: opts.docType || 'bank-statement',
    documentReference: opts.docRef,
    taxCode: opts.taxCode || 'OS',
    taxRate: opts.taxRate != null ? opts.taxRate : 0,
    'diya-gl:bankCode': opts.bankCode,
    'diya-gl:bankAccountID': opts.bankAccountID,
  };
  if (opts.docRef === undefined) delete entry.documentReference;
  entries.push(entry);
}

// --- Current account (1200) ---

// Opening balance
addBank({ date: '2025-04-01', bankAccountID: '1200', amount: 25000, detail: 'Opening balance', comment: 'Current account opening balance', bankCode: 'BC', docRef: 'BNK-0001' });

// Debtor receipts — Acme Corp DR: 8,000/month, 20th
for (let i = 0; i < 12; i++) {
  addBank({ date: fyDate(i, 20), bankAccountID: '1200', amount: 8000, detail: 'Acme Corp', comment: 'Customer receipt', bankCode: 'DR', docRef: `BNK-DR-${String(i + 1).padStart(3, '0')}` });
}

// TechStart Ltd DR: 2,400/month, 25th
for (let i = 0; i < 12; i++) {
  addBank({ date: fyDate(i, 25), bankAccountID: '1200', amount: 2400, detail: 'TechStart Ltd', comment: 'Customer receipt', bankCode: 'DR', docRef: `BNK-DR-${String(i + 13).padStart(3, '0')}` });
}

// Other customers DR: varying 3000-5000, 28th
const otherDRAmounts = [3200, 3800, 4500, 3600, 4200, 3000, 5000, 4100, 3500, 4800, 3900, 4400];
for (let i = 0; i < 12; i++) {
  addBank({ date: fyDate(i, 28), bankAccountID: '1200', amount: otherDRAmounts[i], detail: 'Various customers', comment: 'Aggregate customer receipts', bankCode: 'DR', docRef: `BNK-DR-${String(i + 25).padStart(3, '0')}` });
}

// Opening debtors collected
addBank({ date: '2025-04-10', bankAccountID: '1200', amount: 7200, detail: 'Acme Corp', comment: 'Opening debtor receipt', bankCode: 'DR', docRef: 'BNK-DR-037' });
addBank({ date: '2025-04-15', bankAccountID: '1200', amount: 1200, detail: 'Beta Systems', comment: 'Opening debtor receipt', bankCode: 'DR', docRef: 'BNK-DR-038' });
addBank({ date: '2025-04-25', bankAccountID: '1200', amount: 2400, detail: 'Gamma Ltd', comment: 'Opening debtor receipt', bankCode: 'DR', docRef: 'BNK-DR-039' });

// Van sale proceeds
addBank({ date: '2025-10-15', bankAccountID: '1200', amount: 15000, detail: 'Private buyer', comment: 'Van sale proceeds', bankCode: 'DR', docRef: 'BNK-DR-040' });

// Grant received
addBank({ date: '2025-08-05', bankAccountID: '1200', amount: 2500, detail: 'Innovate UK', comment: 'Grant received', bankCode: 'RV', docRef: 'BNK-RV-001' });

// Directors loan in
addBank({ date: '2026-01-15', bankAccountID: '1200', amount: 5000, detail: 'Director loan', comment: 'Directors loan advance', bankCode: 'DL', docRef: 'BNK-DL-IN-001' });

// Payments — Rent: 1st of month, CR, 1,200 x 12
for (let i = 0; i < 12; i++) {
  addBank({ date: fyDate(i, 1), bankAccountID: '1200', amount: 1200, detail: 'WorkSpace Ltd', comment: 'Office rent payment', bankCode: 'CR', docRef: `BNK-CR-${String(i + 1).padStart(3, '0')}` });
}

// Accountancy: last day of month, CR, 300 x 12
for (let i = 0; i < 12; i++) {
  addBank({ date: fyLastDay(i), bankAccountID: '1200', amount: 300, detail: 'Smith & Co', comment: 'Accountancy fee payment', bankCode: 'CR', docRef: `BNK-CR-${String(i + 13).padStart(3, '0')}` });
}

// Wages net: last working day, W, 5,652/month
for (let i = 0; i < 12; i++) {
  // Use 28th as approximate last working day (before month end)
  addBank({ date: fyDate(i, 28), bankAccountID: '1200', amount: 5652, detail: 'Payroll', comment: 'Monthly net wages (all staff)', bankCode: 'W', docRef: `BNK-W-${String(i + 1).padStart(3, '0')}` });
}

// PAYE/NI to HMRC: 19th of month, RP, 1,501/month
for (let i = 0; i < 12; i++) {
  addBank({ date: fyDate(i, 19), bankAccountID: '1200', amount: 1501, detail: 'HMRC', comment: 'Monthly PAYE/NI payment', bankCode: 'RP', docRef: `BNK-RP-${String(i + 1).padStart(3, '0')}` });
}

// VAT payments
addBank({ date: '2025-07-07', bankAccountID: '1200', amount: 3800, detail: 'HMRC', comment: 'VAT payment Q1 Apr-Jun', bankCode: 'RP', docRef: 'BNK-RP-VAT-001' });
addBank({ date: '2025-10-07', bankAccountID: '1200', amount: 3200, detail: 'HMRC', comment: 'VAT payment Q2 Jul-Sep', bankCode: 'RP', docRef: 'BNK-RP-VAT-002' });
// Q3 refund (big vehicle purchase)
addBank({ date: '2026-01-07', bankAccountID: '1200', amount: 1500, detail: 'HMRC', comment: 'VAT refund Q3 Oct-Dec', bankCode: 'RV', docRef: 'BNK-RV-VAT-003' });
addBank({ date: '2026-04-01', bankAccountID: '1200', amount: 2800, detail: 'HMRC', comment: 'VAT payment Q4 Jan-Mar', bankCode: 'RP', docRef: 'BNK-RP-VAT-004' });

// CT payment: Oct 1, RP, 4,500
addBank({ date: '2025-10-01', bankAccountID: '1200', amount: 4500, detail: 'HMRC', comment: 'Corporation Tax prior year', bankCode: 'RP', docRef: 'BNK-RP-CT-001' });

// Directors loan repayment: 1st of month, DL, 1,000 x 12
for (let i = 0; i < 12; i++) {
  addBank({ date: fyDate(i, 1), bankAccountID: '1200', amount: 1000, detail: 'Director', comment: 'Directors loan repayment', bankCode: 'DL', docRef: `BNK-DL-${String(i + 1).padStart(3, '0')}` });
}

// Loan interest: quarterly
const bankIntData = [
  ['2025-06-30', 250], ['2025-09-30', 208], ['2025-12-31', 167], ['2026-03-31', 125]
];
for (let j = 0; j < bankIntData.length; j++) {
  addBank({ date: bankIntData[j][0], bankAccountID: '1200', amount: bankIntData[j][1], detail: 'Directors loan interest', comment: 'Quarterly loan interest payment', bankCode: 'B', docRef: `BNK-B-INT-${String(j + 1).padStart(3, '0')}` });
}

// Bank charges
addBank({ date: '2025-05-25', bankAccountID: '1200', amount: 25, detail: 'HSBC', comment: 'Bank charges', bankCode: 'B', docRef: 'BNK-B-001' });
addBank({ date: '2025-11-25', bankAccountID: '1200', amount: 25, detail: 'HSBC', comment: 'Bank charges', bankCode: 'B', docRef: 'BNK-B-002' });

// Dividends: Jul 15, Oct 15, Jan 15, Mar 31
addBank({ date: '2025-07-15', bankAccountID: '1200', amount: 3000, detail: 'Dividend', comment: 'Quarterly dividend payment', bankCode: 'DV', docRef: 'BNK-DV-001' });
addBank({ date: '2025-10-15', bankAccountID: '1200', amount: 3000, detail: 'Dividend', comment: 'Quarterly dividend payment', bankCode: 'DV', docRef: 'BNK-DV-002' });
addBank({ date: '2026-01-15', bankAccountID: '1200', amount: 3000, detail: 'Dividend', comment: 'Quarterly dividend payment', bankCode: 'DV', docRef: 'BNK-DV-003' });
addBank({ date: '2026-03-31', bankAccountID: '1200', amount: 6000, detail: 'Dividend', comment: 'Final dividend payment', bankCode: 'DV', docRef: 'BNK-DV-004' });

// Vehicle purchase: Oct 25, CR, 36,000
addBank({ date: '2025-10-25', bankAccountID: '1200', amount: 36000, detail: 'Ford', comment: 'Ford Transit Custom purchase', bankCode: 'CR', docRef: 'BNK-CR-FA-001' });

// Transfer to savings: Mar 15, X, 5,000
addBank({ date: '2026-03-15', bankAccountID: '1200', amount: 5000, detail: 'Internal transfer', comment: 'Transfer to savings account', bankCode: 'X', docRef: 'BNK-X-001' });

// Credit card payments from current: Apr 30 500, Jul 31 300, Oct 31 500, Jan 31 300
const ccPayData = [
  ['2025-04-30', 500], ['2025-07-31', 300], ['2025-10-31', 500], ['2026-01-31', 300]
];
for (let j = 0; j < ccPayData.length; j++) {
  addBank({ date: ccPayData[j][0], bankAccountID: '1200', amount: ccPayData[j][1], detail: 'Credit card payment', comment: 'Pay credit card balance', bankCode: 'X', docRef: `BNK-X-CC-${String(j + 1).padStart(3, '0')}` });
}

// Supplier payments (misc): 5th of month, CR, varying
const miscCRAmounts = [2200, 2800, 2500, 2300, 2600, 2100, 3000, 2400, 2700, 2500, 2900, 2300];
for (let i = 0; i < 12; i++) {
  addBank({ date: fyDate(i, 5), bankAccountID: '1200', amount: miscCRAmounts[i], detail: 'Various suppliers', comment: 'Aggregate supplier payments', bankCode: 'CR', docRef: `BNK-CR-MISC-${String(i + 1).padStart(3, '0')}` });
}

// CIS to HMRC
addBank({ date: '2025-07-19', bankAccountID: '1200', amount: 1000, detail: 'HMRC', comment: 'CIS deduction remittance', bankCode: 'RP', docRef: 'BNK-RP-CIS-001' });
addBank({ date: '2025-12-19', bankAccountID: '1200', amount: 600, detail: 'HMRC', comment: 'CIS deduction remittance', bankCode: 'RP', docRef: 'BNK-RP-CIS-002' });

// --- Savings account (1210) ---
addBank({ date: '2025-04-01', bankAccountID: '1210', amount: 5000, detail: 'Opening balance', comment: 'Savings account opening balance', bankCode: 'BC', docRef: 'BNK-SAV-001' });
addBank({ date: '2026-03-15', bankAccountID: '1210', amount: 5000, detail: 'Internal transfer', comment: 'Transfer from current account', bankCode: 'X', docRef: 'BNK-SAV-002' });
addBank({ date: '2025-09-30', bankAccountID: '1210', amount: 125, detail: 'HSBC Savings', comment: 'Savings interest', bankCode: 'RV', docRef: 'BNK-SAV-003' });
addBank({ date: '2026-03-31', bankAccountID: '1210', amount: 150, detail: 'HSBC Savings', comment: 'Savings interest', bankCode: 'RV', docRef: 'BNK-SAV-004' });

// --- Cash account (1220) ---
addBank({ date: '2025-04-01', bankAccountID: '1220', amount: 500, detail: 'Opening balance', comment: 'Cash float opening balance', bankCode: 'BC', docRef: 'BNK-CASH-001' });
addBank({ date: '2025-06-10', bankAccountID: '1220', amount: 100, detail: 'Cash top-up', comment: 'Cash float replenishment', bankCode: 'X', docRef: 'BNK-CASH-002' });
addBank({ date: '2025-04-10', bankAccountID: '1220', amount: 15, detail: 'Corner shop', comment: 'Milk and tea', bankCode: 'CR', docRef: 'BNK-CASH-003' });
addBank({ date: '2025-06-10', bankAccountID: '1220', amount: 25, detail: 'WH Smith', comment: 'Envelopes and stamps', bankCode: 'CR', docRef: 'BNK-CASH-004' });
addBank({ date: '2025-09-05', bankAccountID: '1220', amount: 18, detail: 'Corner shop', comment: 'Kitchen supplies', bankCode: 'CR', docRef: 'BNK-CASH-005' });
addBank({ date: '2025-12-10', bankAccountID: '1220', amount: 50, detail: 'Various', comment: 'Christmas team refreshments', bankCode: 'CR', docRef: 'BNK-CASH-006' });
addBank({ date: '2026-03-20', bankAccountID: '1220', amount: 12, detail: 'Newsagent', comment: 'Newspapers for reception', bankCode: 'CR', docRef: 'BNK-CASH-007' });

// --- Credit card (1230) ---
addBank({ date: '2025-06-18', bankAccountID: '1230', amount: 180, detail: 'Premier Inn', comment: 'Hotel on credit card', bankCode: 'CR', docRef: 'BNK-CC-001' });
addBank({ date: '2025-10-18', bankAccountID: '1230', amount: 120, detail: 'Trainline', comment: 'Train ticket on credit card', bankCode: 'CR', docRef: 'BNK-CC-002' });
addBank({ date: '2026-02-18', bankAccountID: '1230', amount: 240, detail: 'Premier Inn', comment: 'Hotel on credit card', bankCode: 'CR', docRef: 'BNK-CC-003' });
addBank({ date: '2025-05-20', bankAccountID: '1230', amount: 35, detail: 'HSBC', comment: 'Credit card annual fee', bankCode: 'B', docRef: 'BNK-CC-004' });
// Payments from current account (recorded on CC side)
addBank({ date: '2025-04-30', bankAccountID: '1230', amount: 500, detail: 'Payment from current', comment: 'Credit card payment received', bankCode: 'X', docRef: 'BNK-CC-005' });
addBank({ date: '2025-07-31', bankAccountID: '1230', amount: 300, detail: 'Payment from current', comment: 'Credit card payment received', bankCode: 'X', docRef: 'BNK-CC-006' });
addBank({ date: '2025-10-31', bankAccountID: '1230', amount: 500, detail: 'Payment from current', comment: 'Credit card payment received', bankCode: 'X', docRef: 'BNK-CC-007' });
addBank({ date: '2026-01-31', bankAccountID: '1230', amount: 300, detail: 'Payment from current', comment: 'Credit card payment received', bankCode: 'X', docRef: 'BNK-CC-008' });

// ---------------------------------------------------------------------------
// PAYROLL entries
// ---------------------------------------------------------------------------

const employees = [
  { id: 'EMP001', name: 'Alice Johnson', account: '5101', gross: 3500, tax: 530, eeNI: 200, erNI: 382.50, net: 2770 },
  { id: 'EMP002', name: 'Bob Williams', account: '5101', gross: 2200, tax: 270, eeNI: 96, erNI: 187.50, net: 1834 },
  { id: 'EMP003', name: 'Carol Smith', account: '5100', gross: 1048, tax: 0, eeNI: 0, erNI: 7.20, net: 1048 },
];

for (let i = 0; i < 12; i++) {
  const date = fyLastDay(i);
  const monthStr = FY_MONTH_NAMES[i];
  for (const emp of employees) {
    entries.push({
      sourceJournalID: 'payroll',
      postingDate: date,
      accountMainID: emp.account,
      amount: emp.gross,
      detailComment: emp.name,
      lineItemComment: `Salary ${monthStr}`,
      documentType: 'payslip',
      documentReference: `PAY-${emp.id}-${date.slice(0, 7)}`,
      taxCode: 'OS',
      taxRate: 0,
      'diya-gl:employeeID': emp.id,
      'diya-gl:grossPay': emp.gross,
      'diya-gl:incomeTax': emp.tax,
      'diya-gl:employeeNI': emp.eeNI,
      'diya-gl:employerNI': emp.erNI,
      'diya-gl:netPay': emp.net,
    });
  }
}

// ---------------------------------------------------------------------------
// JOURNAL entries
// ---------------------------------------------------------------------------

function addJournal(opts) {
  entries.push({
    sourceJournalID: 'journal',
    postingDate: opts.date,
    accountMainID: opts.account,
    amount: opts.amount,
    detailComment: opts.detail,
    lineItemComment: opts.comment,
    documentType: opts.docType || 'journal',
    documentReference: opts.docRef,
    taxCode: opts.taxCode || 'OS',
    taxRate: opts.taxRate != null ? opts.taxRate : 0,
    debitCreditCode: opts.dc,
    lineNumber: opts.lineNumber,
  });
}

// Opening balance journal OB-001
const obLines = [
  { ln: 1,  account: '1200', dc: 'D', amount: 25000, comment: 'Current account opening balance' },
  { ln: 2,  account: '1210', dc: 'D', amount: 5000, comment: 'Savings account opening balance' },
  { ln: 3,  account: '1220', dc: 'D', amount: 500, comment: 'Cash account opening balance' },
  { ln: 4,  account: '0040', dc: 'D', amount: 30000, comment: 'Motor vehicle cost' },
  { ln: 5,  account: '0040', dc: 'C', amount: 9828, comment: 'Motor vehicle accumulated depreciation' },
  { ln: 6,  account: '0030', dc: 'D', amount: 3000, comment: 'Computer equipment cost' },
  { ln: 7,  account: '0030', dc: 'C', amount: 270, comment: 'Computer equipment accumulated depreciation' },
  { ln: 8,  account: '1100', dc: 'D', amount: 10000, comment: 'Opening stock' },
  { ln: 9,  account: '1300', dc: 'D', amount: 10800, comment: 'Trade debtors (Acme 7200 + Beta 1200 + Gamma 2400)' },
  { ln: 10, account: '2500', dc: 'C', amount: 20000, comment: 'Directors loan' },
  { ln: 11, account: '2100', dc: 'C', amount: 2400, comment: 'Trade creditors' },
  { ln: 12, account: '2200', dc: 'C', amount: 1500, comment: 'VAT liability' },
  { ln: 13, account: '2300', dc: 'C', amount: 4500, comment: 'Corporation Tax liability' },
  { ln: 14, account: '3000', dc: 'C', amount: 100, comment: 'Share capital' },
  { ln: 15, account: '3100', dc: 'C', amount: 45702, comment: 'Retained earnings (balancing figure)' },
];

for (const l of obLines) {
  addJournal({
    date: '2025-04-01', account: l.account, amount: l.amount,
    detail: 'Opening balances', comment: l.comment,
    docRef: 'OB-001', dc: l.dc, lineNumber: l.ln,
  });
}

// Stock closing balance adjustment JNL-001
addJournal({
  date: '2026-03-31', account: '1100', amount: 4000,
  detail: 'Stock adjustment', comment: 'Stock reduction (10000 opening - 6000 closing)',
  docRef: 'JNL-001', dc: 'C', lineNumber: 1,
});
addJournal({
  date: '2026-03-31', account: '5000', amount: 4000,
  detail: 'Stock adjustment', comment: 'Cost of goods sold stock adjustment',
  docRef: 'JNL-001', dc: 'D', lineNumber: 2,
});

// ---------------------------------------------------------------------------
// Sort and assign entry numbers
// ---------------------------------------------------------------------------

const journalOrder = { journal: 0, sales: 1, purchases: 2, bank: 3, payroll: 4 };

entries.sort((a, b) => {
  // Sort by date first
  if (a.postingDate < b.postingDate) return -1;
  if (a.postingDate > b.postingDate) return 1;
  // Then by journal type
  const ja = journalOrder[a.sourceJournalID] ?? 99;
  const jb = journalOrder[b.sourceJournalID] ?? 99;
  if (ja !== jb) return ja - jb;
  // Then by documentReference (for stable ordering within same date/journal)
  const ra = a.documentReference || '';
  const rb = b.documentReference || '';
  if (ra < rb) return -1;
  if (ra > rb) return 1;
  // Then by lineNumber if present (for journal entries)
  const la = a.lineNumber || 0;
  const lb = b.lineNumber || 0;
  return la - lb;
});

// Assign sequential TXN numbers
for (let i = 0; i < entries.length; i++) {
  entries[i].entryNumber = `TXN-${String(i + 1).padStart(4, '0')}`;
}

// ---------------------------------------------------------------------------
// Write output
// ---------------------------------------------------------------------------

const outDir = path.join(__dirname, '..', 'examples', 'precision-code-ltd');
fs.mkdirSync(outDir, { recursive: true });

const outPath = path.join(outDir, 'lines.jsonl');
const lines = entries.map(e => JSON.stringify(e));
fs.writeFileSync(outPath, lines.join('\n') + '\n');

// ---------------------------------------------------------------------------
// Sanity check totals
// ---------------------------------------------------------------------------

const counts = {};
for (const e of entries) {
  counts[e.sourceJournalID] = (counts[e.sourceJournalID] || 0) + 1;
}

// Count mileage entries separately
let mileageCount = 0;
for (const e of entries) {
  if (e.measurableQuantity != null) mileageCount++;
}

console.log('--- Precision Code Ltd lines.jsonl generated ---');
console.log(`Output: ${outPath}`);
console.log(`Total entries: ${entries.length}`);
console.log('');
console.log('Breakdown by sourceJournalID:');
for (const [k, v] of Object.entries(counts).sort()) {
  console.log(`  ${k}: ${v}`);
}
console.log(`  mileage (subset of purchases): ${mileageCount}`);
console.log('');

// Validate expected ranges
const checks = [
  ['sales', counts.sales || 0, 110, 'Sales entries should be ~110+'],
  ['purchases', counts.purchases || 0, 300, 'Purchase entries should be ~300+'],
  ['bank', counts.bank || 0, 150, 'Bank entries should be ~150+'],
  ['payroll', counts.payroll || 0, 36, 'Payroll entries should be 36'],
  ['journal', counts.journal || 0, 17, 'Journal entries should be ~17'],
];

let ok = true;
for (const [label, actual, min, msg] of checks) {
  const pass = actual >= min;
  console.log(`${pass ? 'PASS' : 'WARN'}: ${msg} (got ${actual})`);
  if (!pass) ok = false;
}
console.log(`${mileageCount === 12 ? 'PASS' : 'WARN'}: Mileage entries should be 12 (got ${mileageCount})`);
console.log('');

if (entries.length >= 715) {
  console.log(`PASS: Total ${entries.length} >= 715 target`);
} else {
  console.log(`WARN: Total ${entries.length} < 715 target`);
  ok = false;
}

if (ok) {
  console.log('\nAll checks passed.');
} else {
  console.log('\nSome checks below target — review the spec.');
}
