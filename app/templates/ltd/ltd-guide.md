---
title: Company Accounts User Guide
---
<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->
<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->

# DIY Accounting Company Accounts User Guide

Thank you for using DIY Accounting as your limited company accounting system.

**Note:** This package supports the **small profits Corporation Tax rate** (19%) for companies with taxable profits up to £50,000. Companies with profits above £50,000 should seek professional advice regarding marginal relief and the main CT rate (25%).

Written upon Excel spreadsheets, the Limited Company accounting system is based upon double entry accounting principles which has been automated through use of Excel formulae, significantly reducing the need for bookkeeping or accounting knowledge with all double entries automated.

Entering the data is no more complicated than entering your financial information in 3 lists:

- Enter sales receipts on the **Sales** spreadsheet
- Enter purchases on the **Purchases** spreadsheet
- Enter cash and bank transactions on the preset **Cash and Bank** spreadsheets

The package produces automated monthly profit and loss accounts, live debtor and creditor reports, automated VAT returns, and a set of annual accounts ready for publication and submission to Companies House and HMRC.

## Contents

- [Preparing to Get Started](#preparing-to-get-started)
- [Value Added Tax](#value-added-tax)
- [Protection and Parameters](#protection-and-parameters)
- [Sales Spreadsheet](#sales-spreadsheet)
- [Purchases Spreadsheet](#purchases-spreadsheet)
- [Expenses Claim Form](#expenses-claim-form)
- [Cash and Bank Spreadsheets](#cash-and-bank-spreadsheets)
- [Fixed Assets](#fixed-assets)
- [VAT Returns](#vat-returns)
- [Payroll Integration](#payroll-integration)
- [Financial Accounts](#financial-accounts)
- [Submission Documents](#submission-documents)
- [Sales Invoice](#sales-invoice)
- [Contact Information](#contact-information)

## Preparing to Get Started

### Package Contents

| File | Purpose |
|------|---------|
| **Sales.xlsx** | Monthly sales records with opening/closing debtors |
| **Purchases.xlsx** | Monthly purchase records with opening/closing creditors |
| **Currentaccount.xlsx** | Current account bank reconciliation |
| **Savingaccount.xlsx** | Savings account reconciliation |
| **Cashaccount.xlsx** | Cash account reconciliation |
| **Creditcardaccount.xlsx** | Credit card reconciliation |
| **Financialaccounts.xlsx** | Trial balance, P&L, balance sheet, corporation tax, CT600 |
| **Vatreturns.xlsx** | Five quarterly VAT returns |
| **Payslips.xlsx** | Payroll payslip generator |
| **Fixedassets.xlsx** | Fixed asset schedule, depreciation, capital allowances |
| **Companysecretary.xlsx** | Board minutes, directors register, members register |
| **Salesinvoice.xlsx** | Sales invoice template |
| **expensesform.xlsx** | Monthly expense claim forms |
| **Dividend Voucher.docx** | Dividend voucher template |

### Corporate Details

Enter the company name, director name, registered office and number at Financialaccounts > OpenAccounts.

![Open Accounts -- enter corporate details and opening balance sheet](screenshots/open-accounts.png)

Limited companies are required to keep a set of statutory books at Companysecretary. The Companysecretary > Boardmeeting worksheet is where the dividend declared for the current financial year is entered.

### Previous Year Accounts

As all companies are required to produce a Balance Sheet each year, opening balances need to be entered before live transactions. Enter balance sheet details at Financialaccounts > OpenAccounts in Column E and subtotals in Columns G to O.

### Opening Fixed Assets

Enter original cost and accumulated depreciation totals at Financialaccounts > OpenAccounts, then detailed information at Fixedassets > Schedule in the EXISTING FIXED ASSETS section.

### Back Up

Back up files regularly by emailing them to yourself weekly. Store in a separate mail folder for easy retrieval.

## Value Added Tax

**VAT registered business:** No adjustment entries required. VAT is automatically collected at 20%.

**Non VAT registered:** Go to Sales Spreadsheet Column G Row 2 Cell G2 and enter 0. The Purchases spreadsheet automatically adopts the same rate.

**Flat Rate VAT:** Go to Sales Spreadsheet Column G Row 4 Cell G4 and enter the flat rate percentage.

**VAT Cash Accounting Scheme:** Enter transactions in the month they are paid, not when invoiced.

## Protection and Parameters

**Date format:** Enter dates as DD/MM/YY. The format dd.mm.yy is not recognised.

### Worksheet Protection

| Level | Description |
|-------|-------------|
| Unprotected | Sales, Purchases, Cash and Bank, Fixed Assets, Company Secretary |
| Protected | Financial Accounts Trial Balance, Corporation Tax, CT600 |
| Password Protected | Financial Accounts Admin (dates and tax rules) |

### Formulae Parameters

| Workbook | Row limit |
|----------|-----------|
| Sales | Row 300 |
| Purchases | Row 300 |
| Cash and Bank | Row 200 |

## Sales Spreadsheet

Record income from all sources, except bank interest received, in the Sales workbook.

![Sales Apr sheet -- enter sales transactions with date, customer, code letter, and gross value](screenshots/sales-apr.png)

### Data Entry

| Column | Entry |
|--------|-------|
| **A** | Date of sale (DD/MM/YY) |
| **B** | Customer name |
| **C** | Invoice number |
| **D** | Description (optional) |
| **E** | Code letter (see below) |
| **F** | Gross amount including VAT |
| **G** | No entry -- VAT calculated automatically |
| **H** | No entry -- net amount calculated |
| **J** | How paid (Cash, Cheque, etc.) |
| **K** | Amount received |

### Sales Code Letters

| Code | Meaning |
|------|---------|
| **A** | Sales turnover Product A |
| **B** | Sales turnover Product B |
| **C** | Sales turnover Product C |
| **D** | Other Direct Income |
| **G** | Investment Grants |
| **O** | Bad Debt written off (6+ months outstanding) |
| **FS** | Value of Fixed Assets Sold |

### Opening and Closing Debtors

**OpeningDebtors**: enter outstanding invoices from the previous year. **ClosingDebtors**: at year end, copy items still outstanding from each month.

## Purchases Spreadsheet

Record expenses from all sources, except bank interest and charges, in the Purchases workbook.

![Purchases Apr sheet -- enter purchase transactions with date, supplier, code letter, and gross value](screenshots/purchases-apr.png)

### Data Entry

| Column | Entry |
|--------|-------|
| **A** | Date of purchase |
| **B** | Supplier name |
| **C** | Invoice number |
| **D** | Description (optional) |
| **E** | Code letter (see below) |
| **F** | Gross amount including VAT |
| **G** | No entry -- VAT calculated |
| **H** | No entry -- net amount calculated |
| **J** | How paid |
| **K** | Amount paid |

### Purchase Code Letters

| Code | Meaning |
|------|---------|
| **S** | Direct materials for resale |
| **C** | Sub-contractor services |
| **O** | Other direct costs |
| **D** | Directors wages (not in PAYE) |
| **W** | Employee wages (not in PAYE) |
| **R** | Premises rent and rates |
| **P** | Light, heating, power |
| **T** | Distribution and transport |
| **Q** | Equipment, tools, plant hire |
| **M** | Repairs and maintenance |
| **U** | Consumable materials |
| **A** | Advertising and promotion |
| **E** | Business entertainment (added back in the corporation tax computation) |
| **G** | General admin (telephone, postage, stationery) |
| **H** | Travel and hotel expenses |
| **V** | Motor vehicle expenses |
| **N** | Insurance costs |
| **F** | Leasing charges |
| **L** | Legal and professional fees |
| **Y** | Charitable donations |
| **Z** | Goodwill |
| **FA** | Fixed asset purchases |

## Expenses Claim Form

Twelve monthly expense claim forms are included in expensesform.xlsx. Enter mileage, expense type, total claimed, and VAT. The form calculates mileage allowance at the HMRC rate for cars and vans: 45p a mile for the first 10,000 business miles for an accounting period that ends before 1 April 2026, and 55p for one that ends from 1 April 2026; 25p a mile after that. The workbook uses one rate for the whole period, set by the financial year in which the period ends. To claim the months that end before 6 April 2026 at 45p, type 0.45 in cell C30 on sheet Month 01, then type 0.55 in cell C30 on the sheet of the first month from April 2026. The note under the mileage line on each sheet names both sheets. Business miles driven on 1 to 5 April 2026 belong to the April 2026 sheet, which claims 55p, but the rate on those five days was 45p: reduce that month's claim by 10p for each of those miles. This applies to every period that holds April 2026, including a year that starts on 1 April 2026.

## Cash and Bank Spreadsheets

Four account workbooks are provided: Currentaccount, Savingaccount, Creditcardaccount, Cashaccount.

![Current Account -- bank reconciliation with receipts and payments](screenshots/bank-current.png)

### Bank Reconciliation

| Cell | Entry |
|------|-------|
| **A1** | Opening bank balance (first month only) |
| **A2** | Closing balance (auto-calculated) |
| **A3** | Statement balance from bank |
| **A4** | Reconciliation difference (auto-calculated) |

### Current Account Receipt Codes

| Code | Meaning |
|------|---------|
| **BS** | Transfer from Savings |
| **BD** | Transfer from Credit Card |
| **BC** | Transfer from Cash |
| **DR** | Receipts from debtors |
| **K** | Bank interest received |
| **LDR** | Long term debtor repayment |
| **LCR** | Long term creditor received |
| **RV** | HMRC VAT refund |
| **RC** | HMRC CIS refund |
| **DL** | Directors loan credit |
| **X** | Contra (same month receipt and payment) |

### Current Account Payment Codes

| Code | Meaning |
|------|---------|
| **BS** | Transfer to Savings |
| **BD** | Transfer to Credit Card |
| **BC** | Transfer to Cash |
| **CR** | Payments to creditors |
| **W** | Net wages paid |
| **J** | Bank interest charged |
| **B** | Bank charges |
| **LDR** | Long term debtor payment |
| **LCR** | Long term creditor repayment |
| **RP** | HMRC PAYE payment |
| **RV** | HMRC VAT payment |
| **RC** | HMRC CIS payment |
| **RT** | HMRC Corporation Tax payment |
| **DV** | Dividend payment |
| **DL** | Directors loan payment |
| **X** | Contra |

Savings, Credit Card, and Cash accounts follow the same pattern with account-specific transfer codes.

## Fixed Assets

![Fixed Assets Schedule -- asset categories with depreciation and capital allowances](screenshots/fixed-assets.png)

### Depreciation Rates

| Category | Rate |
|----------|------|
| Land & Buildings | 0% |
| Plant & Machinery | 10% |
| Fixtures & Fittings | 20% |
| Computer Equipment | 33% |
| Motor Vehicles | 25% |

### Fixed Asset Additions

Enter purchases on the Purchases spreadsheet with code **FA**, then also enter them on Fixedassets > Schedule. The section headed NEW FIXED ASSETS Bought This Year starts at Row 59. It has one block for each kind of asset:

| Asset bought in the year | Block on Fixedassets > Schedule | Rows |
|--------------------------|---------------------------------|------|
| Land and property | Land & Property | 61 to 63 |
| Plant and machinery | Plant & Machinery | 67 to 74 |
| Fixtures and fittings | Fixtures & Fittings | 78 to 82 |
| Computers | Computers | 86 to 93 |
| Car | Motor Vehicles - Cars | 97 to 101 |
| Van or lorry | Motor Vehicles - Vans & Lorries | 103 to 107 |

A car goes on the Cars rows and never on a Plant row. A Plant row claims 100% of the cost in the year of purchase as the Annual Investment Allowance. Cars do not qualify for that allowance ([GOV.UK: business cars](https://www.gov.uk/capital-allowances/business-cars)). A car owned before the start of the year goes in the EXISTING FIXED ASSETS section, under Motor Vehicles - Cars, rows 44 to 48. A van or a lorry is not a car for capital allowances, and nor is a motorcycle bought from 6 April 2009. Put a van or a lorry on the Vans & Lorries rows ([GOV.UK: what counts as a car](https://www.gov.uk/capital-allowances/business-cars)).

### Capital Allowances

Annual Investment Allowance, writing down allowances, and balancing charges are calculated from the Schedule, using the rates on the Admin sheet.

The Cars rows claim the main rate of writing down allowance on the cost of the car. The main rate is 14% for Corporation Tax from 1 April 2026 and 18% before ([GOV.UK: business cars](https://www.gov.uk/capital-allowances/business-cars)). Column M, the private use share, reduces the claim. For a car the company provides to a director or an employee, leave column M at 0. GOV.UK says the company can claim on the full cost.

The rate for a car depends on its CO2 emissions. Check the figure for your car, then find the case:

| Car bought from April 2021 | Allowance on GOV.UK | What the workbook does |
|----------------------------|---------------------|------------------------|
| New or second hand, CO2 emissions 50g/km or less, or a second hand electric car | Main rate | Claims the main rate. Type nothing more. |
| New or second hand, CO2 emissions over 50g/km | 6% special rate | Claims the main rate. Reduce the claim as shown below. |
| New and unused, CO2 emissions 0g/km or electric, bought before April 2027 | 100% first-year allowance | Claims the main rate. Add the rest as shown below. |

Source: [GOV.UK: business cars](https://www.gov.uk/capital-allowances/business-cars) and [GOV.UK: 100% first-year allowances](https://www.gov.uk/capital-allowances/first-year-allowances).

**A car over 50g/km (6%).** In column M of the car's row, type `=1-6/14` when the main rate on the Admin sheet is 14%. Type `=1-6/18` when it is 18%. The claim in column R is then 6% of the cost, and column S carries the rest forward. Next year, type the same formula in column M of the car's row in the existing section.

**A new zero-emission car (100%).** The Cars rows have no first-year allowance column. Add the rest of the cost to the capital allowances in your Company Tax Return. Next year, enter 0 as the tax written down value in column O of the car's row in the existing section.

**A period that includes 1 April 2026.** GOV.UK says to work out a hybrid rate for that accounting period ([GOV.UK: rates and pools](https://www.gov.uk/work-out-capital-allowances/rates-and-pools)). The Admin sheet holds one main rate.

If an earlier year has a car on a Plant row, see [where does a car go in the fixed assets workbook](https://spreadsheets.diyaccounting.co.uk/articles/where-does-a-car-go-in-the-fixed-assets-workbook.html).

## VAT Returns

![VAT Return -- automated quarterly return from Sales and Purchases](screenshots/vat-return.png)

No entries required. Five automated returns provided. To generate: go to VATQtr1, click Cell G5, select the quarter-end date from the dropdown.

## Payroll Integration

The Financialaccounts file contains a WagesInterface for manual entry. The Payslips file provides automatic integration when saved to the same folder.

### Wages Interface

| Column | Entry |
|--------|-------|
| **C** | Gross Wages (Employees and Directors separately) |
| **D** | Income Tax deducted |
| **E** | National Insurance deducted |
| **F** | Other Deductions |
| **G** | Net Wages (auto-calculated) |
| **H** | Employers National Insurance |
| **I** | Statutory Deductions recoverable from HMRC |

## Financial Accounts

### Stock Control

Cells H4 N4 T4 preset to 0% (disabled). Enter actual stock percentage to enable. Cell AB30 for year-end physical stock value.

### Trial Balance

No entries required. Check Row 91 for zero (audit accuracy check). All data flows automatically from the prime entry worksheets.

### Monthly P&L (MnthP&L)

No entries required. Auto-generated from the Trial Balance each month.

### Published P&L (PubP&L)

No entries required. Statutory format for Companies House and HMRC submission.

### Published Balance Sheet (PubBalSht)

No entries required except Director Signature. Must be signed by a named director before submission.

### Published Notes (PubNotes)

No entries required. Notes detailing fixed assets, directors emoluments, dividends, and corporation tax.

### Corporation Tax

No entries required. Corporation Tax for small companies is calculated at the small profits rate (19%). The net bank interest is automatically grossed up for CT purposes.

### CT600

No entries required. Excel copy of the official CT600 tax return, auto-populated from the Corporation Tax sheet.

## Submission Documents

### Companies House (online)

Use the CorporationTax and CT600 sheets in Financialaccounts.xlsx to review your CT600 data before filing online.

### Companies House (paper)

Submit: Report (title page), PubP&L, PubBalSht (signed), PubNotes.

### HMRC (paper)

Submit the above 4 documents plus Corporation Tax calculation and CT600.

## Sales Invoice

The Salesinvoice workbook is independent. Set up Business Details, Customer Details, Product Details, then use Invoice Database to generate invoices.

## Contact Information

Our website: http://www.diyaccounting.co.uk/

These spreadsheets are free to use, and the source is available to read. Use them for your own accounts, or for your clients' accounts if you are an accountant or bookkeeper. Please do not redistribute them. Point people at the download page instead. Copyright (C) 2006-2026 DIY Accounting Limited. Licensed under the PolyForm Internal Use License 1.0.0 with an additional grant for accountants. Downloads: https://spreadsheets.diyaccounting.co.uk/. Source: https://github.com/diy-accounting-uk/spreadsheets.diyaccounting.co.uk.

Discussion forum: https://github.com/diy-accounting-uk/spreadsheets.diyaccounting.co.uk/discussions

Donate: https://www.paypal.com/donate/?hosted_button_id=XTEQ73HM52QQW
