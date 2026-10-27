<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->
<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->

# iXBRL fixtures

Each file is an Inline XBRL accounts document. The tests read them by content, not by name.

| File | Source | Retrieved |
|---|---|---|
| `diya-2025-accounts.xhtml` | DIY Accounting Limited's accepted accounts for the year to 31 March 2025, from the Companies House register: `https://find-and-update.company-information.service.gov.uk/company/06846849/filing-history/MzQ5NzEyNDg2NmFkaXF6a2N4/document?format=xhtml&download=1` (78,227 bytes). FRS 105 micro-entity, FRC 2024 suite, prefix `uk-bus`, Format 2 profit and loss, three directors, both years. The register shows every name and the registered office it holds. | 2026-10-24 |
| `adp-small-full.xhtml` | Companies House Accounts Data Product, `Accounts_Bulk_Data-2026-10-23.zip` (`https://download.companieshouse.gov.uk/en_accountsdata.html`), entry `Prod223_4335_15582405_20260331.html`. Small company, full accounts, Format 1, a fixed asset note. | 2026-10-24 |
| `adp-small-filleted.xhtml` | The same download, `Prod223_4335_14998674_20260731.html`. Small company, profit and loss account not delivered. | 2026-10-24 |
| `adp-micro.xhtml` | The same download, `Prod223_4335_10091442_20260331.html`. Micro-entity. | 2026-10-24 |
| `adp-dormant.xhtml` | The same download, `Prod223_4335_10967746_20260930.html`. Dormant micro-entity. | 2026-10-24 |
| `adp-small-format2.xhtml` | The Accounts Data Product download of 23 October 2026 (`Accounts_Bulk_Data-2026-10-23.zip`), entry `Prod223_4335_11134922_20260131.html` (48,447 bytes), the shortest small company file that tags a Format 2 line and no cost of sales. The download of 24 October holds none. Small company, full accounts, FRS 102 2025 suite, Format 2 profit and loss, both years. It tags depreciation as `DepreciationAmortisationExpense`, other expenses as `OtherOperatingExpensesByNature` and profit before tax as `ProfitLossBeforeTax`. | 2026-10-27 |
| `builder-micro.xhtml` | `buildMicroEntityAccounts` in the submit repository (`app/services/microEntityAccountsIxbrl.js`) on the `micro-entity-accounts` case of `accountsDocumentCases()` (`app/test-helpers/accountsDocumentCases.js`), submit `main` at `66e045091`. | 2026-10-24 |
| `builder-micro-dormant.xhtml` | The same builder, `micro-entity-accounts-dormant` case. | 2026-10-24 |
| `builder-small.xhtml` | `buildSmallCompanyAccounts` on `SMALL_COMPANY_CASE_INPUT`, full accounts. The case's equity moves by 5,000 in a year with a profit after tax of 4,100. | 2026-10-24 |
| `builder-small-filleted.xhtml` | The same input with `filleted: true`. | 2026-10-24 |
| `builder-small-consistent.xhtml` | `buildSmallCompanyAccounts` on that input with current-year figures changed so the year's profit after tax explains the movement in equity: cash 10,600, corporation tax 969, other figures as `SMALL_COMPANY_CASE_INPUT`, interest receivable 100, profit before tax 5,100, tax 969, profit 4,131, prior-year profit and loss added. | 2026-10-24 |
| `uk-gaap-small-2015.xhtml` | DIY Accounting Limited's accounts for the year to 31 March 2015, from the Companies House register: `https://find-and-update.company-information.service.gov.uk/company/06846849/filing-history/MzEzNTM5MTQ0NmFkaXF6a2N4/document?format=xhtml&download=1` (96,301 bytes). Old UK GAAP 2009-09-01 suite, small company, three directors, both years. | 2026-10-27 |
| `uk-gaap-small-2016.xhtml` | The year to 31 March 2016: `https://find-and-update.company-information.service.gov.uk/company/06846849/filing-history/MzE1MDgyOTY2NmFkaXF6a2N4/document?format=xhtml&download=1` (106,141 bytes). The same suite, abbreviated accounts with no profit and loss account. | 2026-10-27 |
| `doctored-*.xhtml` | Copies of `diya-2025-accounts.xhtml` with one change each, written by a script that is not kept: `unbalanced` current assets 3,353 to 3,400; `other-company` company number 06846849 to 01234567; `no-prior-year` every `PY` and `PY_END` fact removed; `scale` turnover written as `7.639` with `scale="3"`; `sign` other operating expenses given `sign="-"`; `duplicate` a second turnover fact of 7,640; `unknown-format` turnover given `ixt2:numfoo`. | 2026-10-24 |

## Document sets

Each is cut from `builder-small.xhtml` by a script that is not kept.

| Fixture | Cut |
|---|---|
| `ixds-two-file/` | `accounts-1.xhtml` holds the header, contexts, units and balance sheet; `accounts-2.xhtml` holds the nine profit and loss facts and defines no context. |
| `ixds-two-file-disagree/` | The same split; `accounts-2.xhtml` also states `TurnoverRevenue` for the current year as 50,001. |
| `ch-welsh-package.zip` | `META-INF/reports.json`, `reports/english/accounts.xhtml` (the whole file) and `reports/welsh/accounts.xhtml` (the whole file plus `ReportPrincipalLanguage` on the `Welsh` member). |
| `ch-welsh-package-disagree.zip` | The same package with the Welsh turnover changed to 50,001. |
| `ch-two-instances.zip` | `reports/english/` holds two copies of the whole file. |
