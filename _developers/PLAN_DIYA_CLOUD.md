# PLAN: DIYA Cloud -- Browser-Based Cloud Accounting Service

A browser UI / Node.js backend (Lambda) service that provides a cloud-based interface to the DIY Accounting packages. Uses DIYA GL for persistence (related documents in a zip stored in S3). The backend is a full General Ledger with trial balance, but users interact through BST, SE, or Ltd views with screens based on those packages.

## User Assertions (non-negotiable)

1. Frontend renders at https://submit.diyaccounting.co.uk/spreadsheets.html (logged-in area), part of the submit.diyaccounting.co.uk repository
2. This repository (diy-accounting) outputs a packaged JS library exposing the CLI to generate DIY spreadsheet files and import DIYA GL at generation time
3. submit.diyaccounting.co.uk uses the packaged library for any spreadsheet or GL manipulation -- no duplication of business logic
4. Backend is Node.js Lambda functions with DIYA GL persistence as zip files in S3
5. Users interact through BST, SE, or Ltd views -- they never see raw GL data
6. Package list page shows uploaded packages with name, date, filename; tolerates duplicates
7. Financial summary page shows DIY Accounting-like page views with navigation to all views
8. Summary sheets have links for VAT filing and deep links into DIY Submit

## 1. Architecture Overview

### 1.1 Repository Responsibilities

```
diy-accounting (this repo)                   submit.diyaccounting.co.uk
+-----------------------------------+        +-----------------------------------+
| Packaged JS library               |        | Frontend (spreadsheets.html)      |
|                                   |  used  |   - React/Preact SPA area         |
| Exports:                          | -----> |   - Package list page             |
|   - generate(product, yearEnd,    |   by   |   - Financial summary page        |
|       options)                    |        |   - Transaction entry views       |
|   - importGL(glZip) -> package    |        |                                   |
|   - exportGL(package) -> glZip    |        | Backend (Lambda + API Gateway)    |
|   - trialBalance(glData)          |        |   - CRUD APIs for packages        |
|   - reconcile(glData, product)    |        |   - Uses packaged library         |
|                                   |        |   - S3 persistence (GL zips)      |
| DIYA GL format:                   |        |   - Cognito authentication        |
|   - book.toml + lines.jsonl       |        |                                   |
|   - Schema: _developers/schema/   |        | AWS Account: submit-ci / prod     |
|     diya-gl-book-v1.schema.json   |        |   367191799875 / 972912397388     |
|     diya-gl-lines-v1.schema.json  |        +-----------------------------------+
+-----------------------------------+
```

### 1.2 Data Flow

```
User browser
    |
    | HTTPS (Cognito auth)
    v
CloudFront -> API Gateway -> Lambda
                                |
                                | (1) Read/write GL zip from S3
                                | (2) Use diy-accounting library to:
                                |     - Parse GL (book.toml + lines.jsonl)
                                |     - Compute trial balance
                                |     - Generate BST/SE/Ltd views
                                |     - Export spreadsheet files
                                v
                            S3 bucket
                            (GL zip per package)
```

### 1.3 AWS Account Placement

The cloud service lives in the **submit** AWS accounts (submit-ci: 367191799875, submit-prod: 972912397388), not the spreadsheets account. This is because:

- Authentication (Cognito) already exists in submit
- API Gateway and Lambda infrastructure already exists in submit
- The spreadsheets account (064390746177) is a static site with no compute

The packaged library is built in this repo (diy-accounting, spreadsheets account CI) and consumed as an npm dependency by submit.diyaccounting.co.uk.

## 2. DIYA GL Data Model

### 2.1 Storage Format

Each user package is a zip file in S3 containing:

```
package-{uuid}.zip
  |-- book.toml          # Chart of accounts, entity info, tax config
  |-- lines.jsonl         # All transactions (one JSON object per line)
  |-- metadata.json       # Package metadata (name, product type, dates)
```

**Schema references:**
- `_developers/schema/diya-gl-book-v1.schema.json` -- book.toml after TOML parse
- `_developers/schema/diya-gl-lines-v1.schema.json` -- each line in lines.jsonl

**Existing example:** `examples/precision-code-ltd/` contains a complete book.toml (chart of accounts for an IT consultancy) and 169-line lines.jsonl with sales, purchases, and bank transactions.

### 2.2 GL Line Format

Each line in lines.jsonl has these required fields (from the schema):

| Field | Type | Description |
|-------|------|-------------|
| `postingDate` | date string | Tax-relevant date (ISO 8601) |
| `amount` | number | Transaction amount (gross) |
| `accountMainID` | string | Nominal code from chart of accounts in book.toml |
| `sourceJournalID` | enum | Journal: sales, purchases, bank, journal, payroll, petty-cash |

Plus optional fields: `entryNumber`, `lineNumber`, `detailComment` (customer/supplier name), `lineItemComment` (description), `documentType`, `documentReference`, `taxCode`, `taxRate`, `paymentMethod`, `debitCreditCode`.

### 2.3 metadata.json (new, not in current schema)

```json
{
  "packageId": "uuid-v4",
  "packageName": "Precision Code Ltd 2025-26",
  "productType": "ltd",
  "yearEnd": "2026-03-31",
  "createdAt": "2026-04-01T10:00:00Z",
  "updatedAt": "2026-04-03T14:30:00Z",
  "uploadFileName": "Precision_Code_accounts.zip",
  "version": 1
}
```

### 2.4 S3 Key Structure

```
s3://{bucket}/users/{cognitoSub}/packages/{packageId}.zip
```

One zip per package. The Cognito subject ID scopes storage per user. No DynamoDB index needed initially -- list packages by S3 prefix scan with metadata extraction.

### 2.5 Product-Specific Account Mappings

The book.toml chart of accounts maps nominal codes to spreadsheet columns via the `diya-gl:column` extension. This mapping enables the library to convert between GL and spreadsheet formats:

**BST (single-file, 14 purchase codes):**
- Sales: amount + other_income columns (no code letter analysis)
- Purchases: single-letter codes (S, D, E, P, R, G, M, T, A, L, B, I, O, F) -> columns J-W

**SE (multi-file, sales codes + purchase codes):**
- Sales: code letters a, b, c, d, g, o -> columns O-U in Sales.xlsx
- Purchases: code letters s, d, e, p, r, g, m, t, a, l, b, i, o, f -> analysis columns

**Ltd (multi-file, 7 sales codes + 21 purchase codes):**
- Sales: codes a, b, c, d, g, o, fs -> columns O-U in Sales.xlsx
- Purchases: 21 codes (s, c, o, d, w, r, p, t, q, m, u, a, g, h, v, n, f, l, y, z, fa) -> columns O-AI in Purchases.xlsx

## 3. Packaged Library (diy-accounting repo)

### 3.1 What the Library Exposes

The library packages the existing generation and reconciliation logic as a reusable JS module:

```javascript
// Core generation (existing logic from app/products/*.js + app/lib/generator.js)
export function generate(product, yearEnd, options)
// Returns: { files: [{name, buffer}], warnings: [] }

// GL import: read a DIYA GL zip and produce a product package
export function importGL(glZipBuffer, targetProduct)
// Returns: { files: [{name, buffer}], glData: {book, lines}, warnings: [] }

// GL export: read an uploaded spreadsheet package and produce GL
export function exportGL(spreadsheetBuffers, sourceProduct)
// Returns: { book: {...}, lines: [...], warnings: [] }

// Trial balance: compute TB from GL data
export function trialBalance(book, lines)
// Returns: { accounts: [{code, name, debit, credit, balance}], totals: {debit, credit} }

// Financial summary: compute P&L, balance sheet, tax from GL data
export function financialSummary(book, lines, product)
// Returns: { profitAndLoss: {...}, balanceSheet: {...}, tax: {...}, vatReturns: [...] }

// Reconciliation checks
export function reconcile(book, lines, product, expectedValues)
// Returns: { checks: [{name, expected, actual, status}] }
```

### 3.2 Packaging Decisions

| Option | Pros | Cons |
|--------|------|------|
| **ES modules (recommended)** | Native Node.js 18+ (Lambda runtime), tree-shakeable | Requires `"type": "module"` or `.mjs` |
| CommonJS | Universal compatibility | Legacy, no tree-shaking |
| Dual (ESM + CJS) | Maximum compatibility | Dual-package hazard, extra build step |

**Recommended approach:** ES modules with esbuild bundling.

```
diy-accounting/
  dist/
    diy-accounting.mjs      # Bundled ES module (esbuild)
    diy-accounting.d.ts      # TypeScript declarations (for IDE support)
  package.json               # "exports" field pointing to dist/
```

**Build command** (add to package.json scripts):
```bash
esbuild app/lib/index.js --bundle --platform=node --target=node18 --format=esm --outfile=dist/diy-accounting.mjs
```

### 3.3 Consumption by submit.diyaccounting.co.uk

The submit repo consumes the library as a **file dependency** or **GitHub Packages** dependency:

```json
// submit.diyaccounting.co.uk/package.json
{
  "dependencies": {
    "@diyaccounting/spreadsheets": "github:antonycc/diy-accounting#dist"
  }
}
```

Alternative: publish to GitHub Packages npm registry, or use a workspace symlink during development.

### 3.4 Library Entry Point (new file)

Create `app/lib/index.js` that re-exports the public API from existing modules:

```javascript
// app/lib/index.js -- public API for the packaged library
export { generate } from './generator.js';
export { importGL, exportGL } from './gl-converter.js';      // new module
export { trialBalance, financialSummary } from './gl-engine.js'; // new module
export { reconcile } from '../../app/bin/reconcile.js';
```

New modules to create:
- `app/lib/gl-converter.js` -- converts between DIYA GL format and spreadsheet cell writes/reads
- `app/lib/gl-engine.js` -- pure computation: trial balance, P&L, balance sheet, tax calculations from GL data (no Excel dependency)

## 4. Backend API (submit.diyaccounting.co.uk Lambdas)

### 4.1 API Endpoints

All endpoints require Cognito authentication. The user's `cognitoSub` is extracted from the JWT.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/packages` | List all packages for the authenticated user |
| POST | `/api/packages` | Create a new blank package |
| POST | `/api/packages/upload` | Upload an existing spreadsheet package (converts to GL) |
| GET | `/api/packages/{id}` | Get package metadata |
| GET | `/api/packages/{id}/summary` | Get financial summary (P&L, BS, tax) |
| GET | `/api/packages/{id}/trial-balance` | Get trial balance |
| GET | `/api/packages/{id}/view/{viewName}` | Get a specific view (e.g., sales-apr, profit-loss) |
| PUT | `/api/packages/{id}/transactions` | Add/update transactions |
| GET | `/api/packages/{id}/download/{format}` | Download as BST, SE, or Ltd spreadsheet |
| DELETE | `/api/packages/{id}` | Delete a package |
| GET | `/api/packages/{id}/vat-periods` | Get available VAT filing periods |

### 4.2 Lambda Architecture

```
api/
  packages/
    listPackages.js         # GET /api/packages
    createPackage.js        # POST /api/packages
    uploadPackage.js        # POST /api/packages/upload
    getPackage.js           # GET /api/packages/{id}
    getSummary.js           # GET /api/packages/{id}/summary
    getTrialBalance.js      # GET /api/packages/{id}/trial-balance
    getView.js              # GET /api/packages/{id}/view/{viewName}
    updateTransactions.js   # PUT /api/packages/{id}/transactions
    downloadPackage.js      # GET /api/packages/{id}/download/{format}
    deletePackage.js        # DELETE /api/packages/{id}
    getVatPeriods.js        # GET /api/packages/{id}/vat-periods
```

Each Lambda function:
1. Authenticates via Cognito JWT (API Gateway authorizer)
2. Reads/writes the GL zip from/to S3
3. Uses the diy-accounting library for all business logic
4. Returns JSON responses

### 4.3 S3 Bucket

**Decision needed:** New dedicated bucket or reuse existing?

**Recommended:** New S3 bucket in the submit account, managed by CDK in submit.diyaccounting.co.uk.

```
s3://submit-{env}-gl-packages/
  users/{cognitoSub}/packages/{packageId}.zip
```

Bucket policy: Lambda execution role has read/write access. No public access. Server-side encryption (SSE-S3). Lifecycle rule: incomplete multipart uploads cleaned after 1 day.

### 4.4 Authentication

Reuse the existing Cognito user pool in submit.diyaccounting.co.uk (already in `AuthStack`). The spreadsheets.html page is already in the logged-in area, so the user will have a valid Cognito session.

### 4.5 API Gateway

**Decision needed:** REST API or HTTP API?

| Feature | REST API | HTTP API |
|---------|----------|----------|
| Cost | Higher | ~70% cheaper |
| Cognito authorizer | Built-in | JWT authorizer (works) |
| Request validation | Yes | No |
| Usage plans/throttling | Yes | Basic |
| Already in submit | Yes (existing) | No |

**Recommended:** HTTP API (cost-effective, JWT authorizer supports Cognito). If the existing submit API Gateway is REST, add routes to it to avoid a second API Gateway.

## 5. Frontend (submit.diyaccounting.co.uk)

### 5.1 Page: spreadsheets.html (existing)

The page at `web/public/spreadsheets.html` currently shows a product catalogue. The cloud accounting UI renders when the user is logged in, replacing or augmenting the static content.

**Approach:** Progressive enhancement. If not logged in, show the existing product catalogue. If logged in, show the cloud accounting interface (package list).

### 5.2 Package List Page

Renders when the user navigates to spreadsheets.html while authenticated.

```
+----------------------------------------------------------+
| My Accounting Packages                        [+ New] [Upload] |
+----------------------------------------------------------+
| Precision Code Ltd 2025-26                               |
|   Uploaded: 3 Apr 2026  |  File: accounts_2025-26.zip   |
|   [Open]  [Download as: BST | SE | Ltd]                 |
+----------------------------------------------------------+
| Basic Web Designer 2025-26                               |
|   Created: 1 Apr 2026   |  Blank package                |
|   [Open]  [Download as: BST | SE | Ltd]                 |
+----------------------------------------------------------+
```

**List behavior:**
- Sorted by package name (primary), then date uploaded (secondary, newest first)
- Tolerates duplicates: same package name can appear multiple times with different dates/filenames
- Each item shows: package name (heading), date uploaded/created, original upload filename
- Actions: Open (navigate to summary), Download (select format), Delete

### 5.3 Financial Summary Page

Clicking "Open" on a package navigates to the summary page.

```
+----------------------------------------------------------+
| Precision Code Ltd 2025-26               [Back to list]  |
| Product: Ltd  |  Year-end: 31 Mar 2026                   |
+----------------------------------------------------------+
| PROFIT & LOSS SUMMARY                                    |
|   Sales Turnover          44,700                         |
|   Cost of Sales           (7,600)                        |
|   Gross Profit            37,100                         |
|   Admin Expenses         (34,576)                        |
|   Operating Profit         2,524                         |
|   Corporation Tax           (480)                        |
|   Net Profit               2,044                         |
+----------------------------------------------------------+
| NAVIGATION                                               |
|   [Sales]  [Purchases]  [Bank]  [Fixed Assets]          |
|   [P&L Detail]  [Balance Sheet]  [Trial Balance]         |
|   [VAT Returns]  [Payslips]  [Company Secretary]         |
+----------------------------------------------------------+
| FILINGS                                                  |
|   VAT Q1 (Apr-Jun 2025): [File via DIY Submit]          |
|   VAT Q2 (Jul-Sep 2025): [File via DIY Submit]          |
|   VAT Q3 (Oct-Dec 2025): [File via DIY Submit]          |
|   VAT Q4 (Jan-Mar 2026): [File via DIY Submit]          |
+----------------------------------------------------------+
```

### 5.4 View Pages

Each navigation link opens a view that mirrors the corresponding spreadsheet tab(s):

| View Name | Maps to Spreadsheet | Content |
|-----------|---------------------|---------|
| sales | Sales.xlsx / SalesApr..SalesMar | Monthly sales transactions with totals |
| purchases | Purchases.xlsx / PurchasesApr..PurchasesMar | Monthly purchase transactions with expense analysis |
| bank | Currentaccount.xlsx / Bank.xlsx | Bank receipts and payments |
| fixed-assets | Fixedassets.xlsx | Asset schedule, capital allowances |
| profit-loss | Profit & Loss Acc / MnthP&L | Monthly and annual P&L |
| balance-sheet | PubBalSht | Balance sheet |
| trial-balance | TrialBalance | Full trial balance |
| vat-returns | Vatreturns.xlsx / Vat.xlsx | Quarterly VAT summaries |
| payslips | Payslips.xlsx | Payroll calendar and payslips |
| company-secretary | Companysecretary.xlsx | Board minutes, registers (Ltd only) |
| income-tax | Income Tax / SE Short | Tax calculation (BST/SE only) |
| corporation-tax | CorporationTax / CT600 | CT calculation (Ltd only) |

### 5.5 VAT Filing Integration

VAT quarters are computed from the year-end date:
- **SE/BST:** Tax year end is always 5 April. VAT quarters: Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar
- **Ltd:** Year-end varies. Q1=months 1-3, Q2=months 4-6, Q3=months 7-9, Q4=months 10-12, Q5=month 13 (partial)

Each VAT period link deep-links to the submit.diyaccounting.co.uk submission form:

```
https://submit.diyaccounting.co.uk/vat-return.html
  ?packageId={id}
  &period=Q1
  &periodStart=2025-04-01
  &periodEnd=2025-06-30
```

The VAT return page reads the GL data for the specified period and pre-populates Box 1-9 values.

### 5.6 Transaction Entry

Users can enter transactions directly in the browser. The UI mirrors the spreadsheet data entry columns:

**Sales entry (matching Sales.xlsx columns):**
| Field | Column | Required |
|-------|--------|----------|
| Date | A | Yes |
| Customer | B | No |
| Reference | C | No |
| Description | D | No |
| Code | E/F | Yes (product code letter) |
| Gross amount | F/G | Yes |

**Purchase entry (matching Purchases.xlsx columns):**
| Field | Column | Required |
|-------|--------|----------|
| Date | A | Yes |
| Supplier | B | No |
| Reference | C | No |
| Description | D | No |
| Code | E/F | Yes (expense code letter) |
| Gross amount | F/G | Yes |

Transactions are saved to lines.jsonl in the GL zip. All computed values (VAT, net, analysis columns) are derived at read time by the GL engine -- no formula injection needed.

## 6. GL Engine (app/lib/gl-engine.js)

The GL engine is the core computation module. It replaces spreadsheet formulas with pure JavaScript calculations.

### 6.1 Trial Balance

```javascript
function trialBalance(book, lines) {
  // Group lines by accountMainID
  // For each account: sum debits and credits
  // Return sorted list with running balances
  // Verify: total debits === total credits
}
```

### 6.2 Profit & Loss

Computed from the trial balance by filtering accounts by type (sales, purchases, expenses) and applying the product-specific P&L structure:

- **BST:** Single P&L with 14 expense categories (codes S,D,E,P,R,G,M,T,A,L,B,I,O,F)
- **SE:** P&L with sales categories (A,B,C,D,G,O) + 14 expense categories + wages interface
- **Ltd:** MnthP&L with 7 sales categories + 21 expense categories + cost of sales breakdown

### 6.3 Tax Calculations

Uses the same logic already in `app/lib/reconcile.js` (for BST/SE income tax + NI) and `app/products/ltd.js` (for Ltd corporation tax):

- **BST/SE:** Income tax bands + NI Class 2/4 from `se-YYYY-YYYY.toml` rates
- **Ltd:** Corporation tax at small profits rate from `ltd-YYYY.toml` rates

### 6.4 VAT Calculations

Aggregate lines by VAT period:
- Filter lines within the period date range
- Sum output VAT (from sales lines with taxCode "S") -> Box 1
- Sum input VAT (from purchase lines with taxCode "S") -> Box 4
- Net VAT = Box 1 - Box 4 -> Box 5
- Net sales (ex VAT) -> Box 6
- Net purchases (ex VAT) -> Box 7

## 7. GL Converter (app/lib/gl-converter.js)

### 7.1 Import: Spreadsheet to GL

When a user uploads a spreadsheet package (xlsx files), the converter reads cell values and produces DIYA GL:

1. Detect product type from filenames (single file = BST, multi-file with Financialaccounts = SE or Ltd)
2. Read transaction rows from Sales/Purchases sheets (A=date, B=name, D/E=code, F/G=amount)
3. Map to GL lines with appropriate accountMainID from the chart of accounts
4. Generate book.toml with entity information extracted from Business Details sheet
5. Bundle as zip

### 7.2 Export: GL to Spreadsheet

When a user downloads a package in a specific format:

1. Load the appropriate template (BST/SE/Ltd) for the target year-end
2. Map GL lines to cell writes using the product's `cellWrites()` function signature
3. Inject cell values via the existing XML surgery pipeline
4. Return the generated xlsx file(s) as a zip

This reuses the existing generation pipeline (`app/lib/generator.js`, `app/products/*.js`) with GL data as the transaction source instead of TOML scenario files.

## 8. Implementation Phases

### Phase 1: Library Packaging (diy-accounting repo)

**Goal:** Package existing code as a reusable library that submit.diyaccounting.co.uk can consume.

| Task | Status | Notes |
|------|--------|-------|
| 1.1 Create `app/lib/index.js` entry point | pending | Re-exports from existing modules |
| 1.2 Add esbuild as dev dependency | pending | `npm install --save-dev esbuild` |
| 1.3 Add `build:lib` npm script | pending | esbuild bundle to `dist/` |
| 1.4 Create `app/lib/gl-engine.js` | pending | Trial balance, P&L, tax from GL data |
| 1.5 Create `app/lib/gl-converter.js` | pending | Import/export between GL and spreadsheet |
| 1.6 Unit tests for GL engine | pending | Use precision-code-ltd example data |
| 1.7 Unit tests for GL converter | pending | Round-trip: GL -> spreadsheet -> GL |
| 1.8 `package.json` exports field | pending | Point to `dist/diy-accounting.mjs` |
| 1.9 CI: add `build:lib` to test workflow | pending | Ensure library builds on every push |

### Phase 2: Backend API (submit.diyaccounting.co.uk)

**Goal:** Lambda endpoints for CRUD operations on GL packages.

| Task | Status | Notes |
|------|--------|-------|
| 2.1 Add S3 bucket to CDK stack | pending | `submit-{env}-gl-packages` |
| 2.2 Add diy-accounting library dependency | pending | package.json + Docker image |
| 2.3 Implement `listPackages` Lambda | pending | S3 prefix scan, extract metadata |
| 2.4 Implement `createPackage` Lambda | pending | Create blank GL zip with book.toml template |
| 2.5 Implement `uploadPackage` Lambda | pending | Accept xlsx, convert to GL via library |
| 2.6 Implement `getPackage` Lambda | pending | Return metadata.json |
| 2.7 Implement `getSummary` Lambda | pending | Use library financialSummary() |
| 2.8 Implement `downloadPackage` Lambda | pending | Use library generate() with GL data |
| 2.9 Add API Gateway routes | pending | HTTP API or extend existing REST API |
| 2.10 CDK: IAM roles for S3 access | pending | Lambda -> S3 read/write |
| 2.11 Integration tests | pending | Against local S3 (localstack or mocks) |

### Phase 3: Package List Page (submit.diyaccounting.co.uk)

**Goal:** Users can see, create, upload, and download packages.

| Task | Status | Notes |
|------|--------|-------|
| 3.1 Modify spreadsheets.html for auth-gated UI | pending | Show list when logged in, catalogue when not |
| 3.2 Package list component | pending | Fetch from GET /api/packages |
| 3.3 New blank package flow | pending | Product type selector + year-end picker |
| 3.4 Upload package flow | pending | File picker + product detection |
| 3.5 Download package flow | pending | Format selector (BST/SE/Ltd) |
| 3.6 Delete package confirmation | pending | Soft delete or hard delete? |
| 3.7 Browser tests | pending | Playwright tests for list interactions |

### Phase 4: Financial Summary Page (submit.diyaccounting.co.uk)

**Goal:** Users can view their accounting data in familiar spreadsheet-like views.

| Task | Status | Notes |
|------|--------|-------|
| 4.1 Summary dashboard component | pending | P&L overview, key figures |
| 4.2 Navigation to detail views | pending | Sales, Purchases, Bank, etc. |
| 4.3 Sales view (monthly transactions) | pending | Mirror Sales.xlsx layout |
| 4.4 Purchases view (monthly + analysis) | pending | Mirror Purchases.xlsx layout |
| 4.5 P&L detail view | pending | Monthly columns like MnthP&L |
| 4.6 Trial balance view | pending | Full account listing |
| 4.7 Balance sheet view | pending | Assets, liabilities, equity |
| 4.8 VAT returns view | pending | Quarterly summaries with Box 1-9 |
| 4.9 Product-specific views (BST/SE/Ltd) | pending | Income Tax (BST/SE), Corp Tax (Ltd) |
| 4.10 Browser tests | pending | Playwright tests for views |

### Phase 5: Transaction Entry (submit.diyaccounting.co.uk)

**Goal:** Users can enter and edit transactions directly in the browser.

| Task | Status | Notes |
|------|--------|-------|
| 5.1 Sales transaction entry form | pending | Date, customer, code, amount |
| 5.2 Purchase transaction entry form | pending | Date, supplier, code, amount |
| 5.3 Bank transaction entry form | pending | Receipts and payments |
| 5.4 Transaction validation | pending | Required fields, date range, valid codes |
| 5.5 Inline editing in list views | pending | Edit existing transactions |
| 5.6 Batch import from CSV | pending | Bulk transaction upload |
| 5.7 Auto-save / optimistic updates | pending | Save to S3 on change |

### Phase 6: Filing Integration (submit.diyaccounting.co.uk)

**Goal:** Deep links from package summary into VAT submission.

| Task | Status | Notes |
|------|--------|-------|
| 6.1 VAT period computation from year-end | pending | Q1-Q4/Q5 date ranges |
| 6.2 Deep link generation | pending | URL with packageId + period params |
| 6.3 VAT return page: read GL data | pending | Pre-populate Box 1-9 from GL |
| 6.4 Filing status tracking | pending | Show which periods have been filed |
| 6.5 Self Assessment links (BST/SE) | pending | Links to SE Short box values |
| 6.6 CT600 links (Ltd) | pending | Links to Corporation Tax return |

## 9. Technical Decisions

### 9.1 Decided

| Decision | Choice | Rationale |
|----------|--------|-----------|
| GL format | DIYA GL (book.toml + lines.jsonl) | Already designed, schema exists, example data exists |
| Storage | Zip in S3 | Simple, single-object per package, no DB needed for data |
| Authentication | Cognito (existing) | Already in submit repo, users already have accounts |
| Library source | diy-accounting repo | Business logic stays with the spreadsheet code |
| Computation | Server-side (Lambda) | Keep library + LibreOffice on server, thin client |

### 9.2 To Decide

| Decision | Options | Notes |
|----------|---------|-------|
| Library packaging format | ESM (recommended) vs CJS vs dual | ESM is native to Node 18+ Lambda |
| Library distribution | GitHub Packages vs file dependency vs git submodule | GitHub Packages is cleanest for versioning |
| API Gateway type | HTTP API (recommended) vs REST API vs extend existing | Depends on existing submit API Gateway setup |
| Frontend framework | Vanilla JS + Web Components vs Preact vs React | Submit currently uses vanilla JS |
| S3 bucket | New dedicated vs reuse existing | Recommend new bucket for isolation |
| Package index | S3 prefix scan vs DynamoDB index | Start with S3, migrate to DynamoDB if list performance matters |
| Spreadsheet generation | Server-side only vs client-side option | Server-side initially (needs LibreOffice for recalc) |

## 10. Dependencies and Prerequisites

### 10.1 This Repo (diy-accounting)

- DIYA GL schema: already exists (`_developers/schema/diya-gl-*.schema.json`)
- Example data: already exists (`examples/precision-code-ltd/`)
- Generation pipeline: already exists (`app/lib/generator.js`, `app/products/*.js`)
- Reconciliation logic: already exists (`app/lib/reconcile.js`, `app/bin/reconcile.js`)
- Tax data: already exists (`app/data/se-*.toml`, `app/data/ltd-*.toml`)
- **New:** esbuild bundler, GL engine module, GL converter module, library entry point

### 10.2 Submit Repo (submit.diyaccounting.co.uk)

- Cognito user pool: already exists (`AuthStack`)
- API Gateway: already exists (need to verify type and add routes)
- Lambda infrastructure: already exists (Docker-based ARM64 Lambdas)
- spreadsheets.html: already exists (needs auth-gated enhancement)
- **New:** S3 bucket for GL packages, package Lambda functions, frontend components

### 10.3 Blocking Dependencies

| Phase | Blocked By | Notes |
|-------|-----------|-------|
| Phase 2 | Phase 1 complete | Lambda needs the library |
| Phase 3 | Phase 2 (list + create + upload + download endpoints) | Frontend needs API |
| Phase 4 | Phase 2 (summary + view endpoints) | Frontend needs API |
| Phase 5 | Phase 4 complete | Edit builds on view |
| Phase 6 | Phase 4 + existing VAT submission flow | Deep links need both |

## 11. Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| LibreOffice dependency for spreadsheet generation | Cannot generate xlsx in Lambda without LibreOffice | Use Lambda container image with LibreOffice layer, or generate xlsx via XML surgery only (no recalc) |
| Library size too large for Lambda | Deployment package exceeds limits | Use Lambda container images (10GB limit) or split into smaller functions |
| S3 zip read/write latency | Slow API responses for large packages | Cache extracted GL data in Lambda memory; typical GL zip is <100KB |
| Concurrent edits to same package | Data loss if two tabs edit simultaneously | Optimistic concurrency with version field in metadata.json |
| Spreadsheet import fidelity | Uploaded xlsx may have non-standard formatting | Validate on upload, warn about unsupported features |

## 12. Out of Scope (for now)

- Multi-user collaboration on the same package
- Real-time sync between browser tabs
- Mobile-optimized transaction entry
- Automated bank feed import (Open Banking)
- Making Tax Digital (MTD) for Income Tax Self Assessment (ITSA) -- future when HMRC mandates it
- Marginal relief for Corporation Tax (see PLAN_LTD_MARGINAL_RELIEF.md)
- Payslip generation within the cloud interface (complex PAYE calculations)
