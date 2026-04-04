# Cell-to-XBRL Mapping: DIY Accounting Products

Maps workbook sheet/cell references in the 4 DIY Accounting products to diya-gl schema properties and XBRL taxonomy concepts.

**Taxonomy sources:**
- **FRS 102** (UK GAAP): FRC taxonomy for statutory accounts filed at Companies House / HMRC
- **CT Computations**: HMRC CT dimensional taxonomy for Corporation Tax computations
- **DPL**: HMRC Detailed Profit & Loss taxonomy (for detailed P&L in accounts or computations)
- **SA103S**: HMRC Self Assessment short self-employment supplement (boxes map to SA103S form)
- **CT600**: HMRC Company Tax Return form (box numbers map to CT600 XML schema)

**Namespace prefixes used below:**
| Prefix | Namespace / Standard |
|--------|---------------------|
| `uk-gaap:` | UK GAAP taxonomy (pre-FRS 102) |
| `uk-direp:` | UK Directors' Report taxonomy |
| `frs102:` | FRS 102 / FRC taxonomy |
| `ct-comp:` | HMRC CT Computation taxonomy |
| `dpl:` | HMRC Detailed Profit & Loss taxonomy |
| `sa:` | HMRC Self Assessment (SA103S box references) |
| `ct600:` | CT600 form box references |
| `bus:` | XBRL GL business module / common data |

---

## 1. Limited Company (Ltd)

The Ltd product is the primary XBRL consumer -- Companies House filing requires iXBRL accounts, and HMRC requires iXBRL computations with the CT600.

### 1.1 Business Details (OpenAccounts sheet)

| Sheet | Cell | DIY Label | diya-gl Property | XBRL Concept (FRS 102 / CT) | iXBRL Element |
|-------|------|-----------|-----------------|---------------------------|---------------|
| OpenAccounts | E2 | Company Name | `entityInformation.organizationIdentifier` | `bus:EntityCurrentLegalOrRegisteredName` | `<ix:nonFraction name="bus:EntityCurrentLegalOrRegisteredName">` |
| OpenAccounts | E3 | Company Number | `diya-gl:companyNumber` | `bus:UKCompaniesHouseRegisteredNumber` | `<ix:nonNumeric name="bus:UKCompaniesHouseRegisteredNumber">` |
| OpenAccounts | E4 | Address | `gl-bus:organizationAddress` | `bus:AddressLine1` / `bus:PostalCodeZip` | `<ix:nonNumeric name="bus:AddressLine1">` |
| OpenAccounts | E6 | UTR | `gl-taf:taxRegistrationNumber` | `bus:UTR` (CT600 key) | CT600 XML `<Key Type="UTR">` |

### 1.2 Management P&L (MnthP&L sheet) -- Detailed P&L

These map to the DPL (Detailed Profit & Loss) taxonomy when included in the CT filing, and to FRS 102 statutory accounts tags for the published P&L.

| Sheet | Cell | DIY Label | diya-gl Property | XBRL Concept | iXBRL Element |
|-------|------|-----------|-----------------|-------------|---------------|
| MnthP&L | B4 | Product A -- Consultancy | `accounts.sales.4000` | `dpl:TurnoverGrossOperatingRevenue` + `Item 1` | `<ix:nonFraction name="dpl:TurnoverGrossOperatingRevenue">` |
| MnthP&L | B5 | Product B -- Software | `accounts.sales.4001` | `dpl:TurnoverGrossOperatingRevenue` + `Item 2` | `<ix:nonFraction name="dpl:TurnoverGrossOperatingRevenue">` |
| MnthP&L | B6 | Product C -- Training | `accounts.sales.4002` | `dpl:TurnoverGrossOperatingRevenue` + `Item 3` | `<ix:nonFraction name="dpl:TurnoverGrossOperatingRevenue">` |
| MnthP&L | B7 | Other Direct Income | `accounts.sales.4003` | `dpl:OtherOperatingIncome` | `<ix:nonFraction name="dpl:OtherOperatingIncome">` |
| MnthP&L | B8 | Grants Received | `accounts.sales.4004` | `dpl:GovernmentGrantIncome` | `<ix:nonFraction name="dpl:GovernmentGrantIncome">` |
| MnthP&L | B9 | **Sales Turnover** | `gl-cor:amount (salesTurnover)` | `frs102:TurnoverRevenue` | `<ix:nonFraction name="frs102:TurnoverRevenue">` |
| MnthP&L | B11 | Materials / Stock | `accounts.purchases.5000` | `dpl:RawMaterialsConsumables` | `<ix:nonFraction name="dpl:RawMaterialsConsumables">` |
| MnthP&L | B12 | Sub-Contractors | `accounts.purchases.5001` | `dpl:OtherEmploymentCosts` + `Item 1` | `<ix:nonFraction name="dpl:OtherEmploymentCosts">` |
| MnthP&L | B13 | Other Direct Costs | `accounts.purchases.5002` | `dpl:OtherCosts` (Cost of sales dimension) | `<ix:nonFraction name="dpl:OtherCosts">` |
| MnthP&L | B14 | Cost of Sales | `gl-cor:amount (costOfSales)` | `frs102:CostOfSales` | `<ix:nonFraction name="frs102:CostOfSales">` |
| MnthP&L | B16 | **Gross Profit** | `gl-cor:amount (grossProfit)` | `frs102:GrossProfit` | `<ix:nonFraction name="frs102:GrossProfit">` |
| MnthP&L | B18 | Directors Wages | `accounts.purchases.5100` | `dpl:WagesAndSalaries` + `Item 1` | `<ix:nonFraction name="dpl:WagesAndSalaries">` |
| MnthP&L | B19 | Employee Wages | `accounts.purchases.5101` | `dpl:WagesAndSalaries` + `Item 2` | `<ix:nonFraction name="dpl:WagesAndSalaries">` |
| MnthP&L | B20 | Premises | `accounts.purchases.5200` | `dpl:RentRatesAndServicesCosts` | `<ix:nonFraction name="dpl:RentRatesAndServicesCosts">` |
| MnthP&L | B21 | Light, Heat, Power | `accounts.purchases.5201` | `dpl:UtilitiesCosts` | `<ix:nonFraction name="dpl:UtilitiesCosts">` |
| MnthP&L | B22 | Distribution | `accounts.purchases.5300` | `dpl:FreightAndHaulageCosts` | `<ix:nonFraction name="dpl:FreightAndHaulageCosts">` |
| MnthP&L | B23 | Equipment Hire | `accounts.purchases.5301` | `dpl:OperatingLeaseExpenditure` | `<ix:nonFraction name="dpl:OperatingLeaseExpenditure">` |
| MnthP&L | B24 | Repairs & Maintenance | `accounts.purchases.5400` | `dpl:OtherRepairsAndMaintenanceCosts` | `<ix:nonFraction name="dpl:OtherRepairsAndMaintenanceCosts">` |
| MnthP&L | B25 | Consumables | `accounts.purchases.5401` | `dpl:OtherOperationalAndAdministrationCosts` + `Item 1` | `<ix:nonFraction name="dpl:OtherOperationalAndAdministrationCosts">` |
| MnthP&L | B26 | Advertising | `accounts.purchases.5500` | `dpl:AdvertisingPromotionsAndMarketingCosts` | `<ix:nonFraction name="dpl:AdvertisingPromotionsAndMarketingCosts">` |
| MnthP&L | B27 | General Admin | `accounts.purchases.5501` | `dpl:OtherOperationalAndAdministrationCosts` + `Item 2` | `<ix:nonFraction name="dpl:OtherOperationalAndAdministrationCosts">` |
| MnthP&L | B28 | Travel & Hotel | `accounts.purchases.5600` | `dpl:TravelAndSubsistenceCosts` | `<ix:nonFraction name="dpl:TravelAndSubsistenceCosts">` |
| MnthP&L | B29 | Motor Vehicle | `accounts.purchases.5601` | `dpl:Vehicles` | `<ix:nonFraction name="dpl:Vehicles">` |
| MnthP&L | B30 | Insurance | `accounts.purchases.5700` | `dpl:InsuranceCosts` | `<ix:nonFraction name="dpl:InsuranceCosts">` |
| MnthP&L | B31 | Leasing | `accounts.purchases.5701` | `dpl:LeasesAndHirePurchaseContractsFinanceCharges` | `<ix:nonFraction name="dpl:LeasesAndHirePurchaseContractsFinanceCharges">` |
| MnthP&L | B32 | Legal & Professional | `accounts.purchases.5800` | `dpl:AuditAndAccountancyTaxServices` | `<ix:nonFraction name="dpl:AuditAndAccountancyTaxServices">` |
| MnthP&L | B33 | Charitable Donations | `accounts.purchases.5801` | `dpl:CharitableDonations` (not in DPL; use extension) | -- |
| MnthP&L | B34 | Goodwill | `accounts.purchases.5802` | `frs102:AmortisationOfIntangibleAssets` | `<ix:nonFraction name="frs102:AmortisationOfIntangibleAssets">` |
| MnthP&L | B35 | Depreciation | `gl-cor:amount (depreciation)` | `frs102:DepreciationOfTangibleFixedAssets` | `<ix:nonFraction name="frs102:DepreciationOfTangibleFixedAssets">` |
| MnthP&L | B36 | Depreciation (2) | `gl-cor:amount (depreciation2)` | `frs102:DepreciationOfTangibleFixedAssets` + `Item 1` | `<ix:nonFraction name="frs102:DepreciationOfTangibleFixedAssets">` |
| MnthP&L | B37 | Loss on Disposal | `gl-cor:amount (lossOnDisposal)` | `frs102:LossOnDisposalOfTangibleFixedAssets` | `<ix:nonFraction name="frs102:LossOnDisposalOfTangibleFixedAssets">` |
| MnthP&L | B38 | Bank Interest | `gl-cor:amount (bankInterest)` | `dpl:BankCharges` | `<ix:nonFraction name="dpl:BankCharges">` |
| MnthP&L | B39 | HP Interest | `gl-cor:amount (hpInterest)` | `dpl:LeasesAndHirePurchaseContractsFinanceCharges` + `Item 1` | `<ix:nonFraction name="dpl:LeasesAndHirePurchaseContractsFinanceCharges">` |
| MnthP&L | B40 | Other Expenses | `accounts.purchases (other)` | `dpl:OtherCosts` | `<ix:nonFraction name="dpl:OtherCosts">` |
| MnthP&L | B41 | Total Admin Expenses | `gl-cor:amount (totalAdmin)` | `frs102:AdministrativeExpenses` | `<ix:nonFraction name="frs102:AdministrativeExpenses">` |
| MnthP&L | B43 | **Operating Profit** | `gl-cor:amount (operatingProfit)` | `frs102:OperatingProfit` | `<ix:nonFraction name="frs102:OperatingProfit">` |
| MnthP&L | B44 | Interest Received | `gl-cor:amount (interestReceived)` | `frs102:OtherInterestReceivableAndSimilarIncome` | `<ix:nonFraction name="frs102:OtherInterestReceivableAndSimilarIncome">` |
| MnthP&L | B45 | **Profit Before Tax** | `gl-cor:amount (profitBeforeTax)` | `frs102:ProfitLossOnOrdinaryActivitiesBeforeTax` | `<ix:nonFraction name="frs102:ProfitLossOnOrdinaryActivitiesBeforeTax">` |

### 1.3 Corporation Tax (CorporationTax sheet)

These map to the HMRC CT Computation taxonomy and CT600 form boxes.

| Sheet | Cell | DIY Label | diya-gl Property | XBRL / CT600 Concept | iXBRL Element |
|-------|------|-----------|-----------------|---------------------|---------------|
| CorporationTax | K5 | Operating Profit | `gl-cor:amount (ct600.box145)` | `ct-comp:ProfitLossPerAccounts` / CT600 box 145 | `<ix:nonFraction name="ct-comp:ProfitLossPerAccounts">` |
| CorporationTax | K12 | Add back: Depreciation | `gl-cor:amount (ct600.addBack)` | `ct-comp:AdjustmentsDepreciation` | `<ix:nonFraction name="ct-comp:AdjustmentsDepreciation">` |
| CorporationTax | K22 | Less: Capital Allowances | `tax.capitalAllowances (ct600)` | `ct-comp:TotalCapitalAllowances` | `<ix:nonFraction name="ct-comp:TotalCapitalAllowances">` |
| CorporationTax | K28 | **Profit Chargeable to CT** | `gl-cor:amount (ct600.box315)` | `ct-comp:AdjustedProfitForThePeriod` / CT600 box 315 | `<ix:nonFraction name="ct-comp:AdjustedProfitForThePeriod">` |
| CorporationTax | K35 | **Corporation Tax** | `gl-cor:taxAmount (ct600.box430)` | CT600 `CorporationTax` / box 430 | CT600 XML `<CorporationTax>` |
| CorporationTax | K39 | Tax Outstanding | `gl-cor:taxAmount (ct600.box515)` | CT600 `TaxPayable` / box 515 | CT600 XML `<TaxPayable>` |

### 1.4 Published P&L (PubP&L sheet) -- Statutory Accounts

These are the FRS 102 statutory accounts tags filed at Companies House in iXBRL format.

| Sheet | Cell | DIY Label | diya-gl Property | XBRL Concept (FRS 102) | iXBRL Element |
|-------|------|-----------|-----------------|----------------------|---------------|
| PubP&L | C5 | Turnover | `gl-cor:amount (pubPL.turnover)` | `frs102:TurnoverRevenue` | `<ix:nonFraction name="frs102:TurnoverRevenue">` |
| PubP&L | C7 | Cost of Sales | `gl-cor:amount (pubPL.cos)` | `frs102:CostOfSales` | `<ix:nonFraction name="frs102:CostOfSales">` |
| PubP&L | C9 | **Gross Profit** | `gl-cor:amount (pubPL.gross)` | `frs102:GrossProfit` | `<ix:nonFraction name="frs102:GrossProfit">` |
| PubP&L | C11 | Admin Expenses | `gl-cor:amount (pubPL.admin)` | `frs102:AdministrativeExpenses` | `<ix:nonFraction name="frs102:AdministrativeExpenses">` |
| PubP&L | C13 | **Operating Profit** | `gl-cor:amount (pubPL.operating)` | `frs102:OperatingProfit` | `<ix:nonFraction name="frs102:OperatingProfit">` |
| PubP&L | C15 | Interest Receivable | `gl-cor:amount (pubPL.intRec)` | `frs102:OtherInterestReceivableAndSimilarIncome` | `<ix:nonFraction name="frs102:OtherInterestReceivableAndSimilarIncome">` |
| PubP&L | C17 | **Profit Before Tax** | `gl-cor:amount (pubPL.pbt)` | `frs102:ProfitLossOnOrdinaryActivitiesBeforeTax` | `<ix:nonFraction name="frs102:ProfitLossOnOrdinaryActivitiesBeforeTax">` |
| PubP&L | C19 | Tax on Profit | `gl-cor:taxAmount (pubPL.tax)` | `frs102:TaxOnProfitOnOrdinaryActivities` | `<ix:nonFraction name="frs102:TaxOnProfitOnOrdinaryActivities">` |
| PubP&L | C21 | **Profit After Tax** | `gl-cor:amount (pubPL.pat)` | `frs102:ProfitLossForFinancialYear` | `<ix:nonFraction name="frs102:ProfitLossForFinancialYear">` |

### 1.5 Published Balance Sheet (PubBalSht sheet) -- Statutory Accounts

| Sheet | Cell | DIY Label | diya-gl Property | XBRL Concept (FRS 102) | iXBRL Element |
|-------|------|-----------|-----------------|----------------------|---------------|
| PubBalSht | C5 | Fixed Assets (NBV) | `gl-cor:amount (pubBS.fixedAssets)` | `frs102:TangibleFixedAssets` | `<ix:nonFraction name="frs102:TangibleFixedAssets">` |
| PubBalSht | C9 | Stock | `accounts.assets.1100 (pubBS)` | `frs102:Stocks` | `<ix:nonFraction name="frs102:Stocks">` |
| PubBalSht | C10 | Debtors | `accounts.assets.1300 (pubBS)` | `frs102:Debtors` | `<ix:nonFraction name="frs102:Debtors">` |
| PubBalSht | C11 | Bank & Cash | `gl-cor:amount (pubBS.bankCash)` | `frs102:CashAtBankAndInHand` | `<ix:nonFraction name="frs102:CashAtBankAndInHand">` |
| PubBalSht | C13 | Creditors < 1 year | `gl-cor:amount (pubBS.creditors)` | `frs102:CreditorsDueWithinOneYear` | `<ix:nonFraction name="frs102:CreditorsDueWithinOneYear">` |
| PubBalSht | C15 | **Net Current Assets** | `gl-cor:amount (pubBS.netCurrent)` | `frs102:NetCurrentAssetsLiabilities` | `<ix:nonFraction name="frs102:NetCurrentAssetsLiabilities">` |
| PubBalSht | C17 | Creditors > 1 year | `gl-cor:amount (pubBS.longTermCred)` | `frs102:CreditorsDueAfterOneYear` | `<ix:nonFraction name="frs102:CreditorsDueAfterOneYear">` |
| PubBalSht | C19 | **Net Assets** | `gl-cor:amount (pubBS.netAssets)` | `frs102:NetAssetsLiabilities` | `<ix:nonFraction name="frs102:NetAssetsLiabilities">` |
| PubBalSht | C22 | Share Capital | `accounts.capital.3000 (pubBS)` | `frs102:CalledUpShareCapital` | `<ix:nonFraction name="frs102:CalledUpShareCapital">` |
| PubBalSht | C23 | Retained Earnings | `accounts.capital.3100 (pubBS)` | `frs102:ProfitAndLossAccount` | `<ix:nonFraction name="frs102:ProfitAndLossAccount">` |
| PubBalSht | C25 | **Shareholders Funds** | `gl-cor:amount (pubBS.equity)` | `frs102:ShareholdersEquity` | `<ix:nonFraction name="frs102:ShareholdersEquity">` |

---

## 2. Self Employed (SE)

Multi-file package (9 xlsx). The SE product maps to SA103S (Self Employment Short) for self-assessment filing. XBRL is not directly required (SA filing is not iXBRL), but the SA103S box numbers serve the same structured-data purpose.

### 2.1 Business Details

| Sheet | Cell | DIY Label | diya-gl Property | SA Concept | SA103S Box |
|-------|------|-----------|-----------------|-----------|------------|
| Business Details | C5 | Business Name | `entityInformation.organizationIdentifier` | Business name | Box 1 |

### 2.2 Profit & Loss Account (Financialaccounts.xlsx)

| Sheet | Cell | DIY Label | diya-gl Property | SA / Tax Concept | SA103S Box |
|-------|------|-----------|-----------------|-----------------|------------|
| Profit & Loss Account | B5 | Product A -- Consultancy | `accounts.sales.4000` | Turnover component | -- |
| Profit & Loss Account | B6 | Product B -- Software | `accounts.sales.4001` | Turnover component | -- |
| Profit & Loss Account | B7 | Product C -- Training | `accounts.sales.4002` | Turnover component | -- |
| Profit & Loss Account | B8 | Other Income | `accounts.sales.4003` | Other business income | -- |
| Profit & Loss Account | B9 | **Sales Turnover** | `gl-cor:amount (salesTurnover)` | `sa:Turnover` | Box 10 |
| Profit & Loss Account | B11 | Grants Received | `accounts.sales.4004` | Government grants | -- |
| Profit & Loss Account | B14 | Materials / Stock | `accounts.purchases.5000` | Cost of goods bought for resale | Box 11 |
| Profit & Loss Account | B15 | Sub-Contractors | `accounts.purchases.5001` | Construction industry sub-contractors | Box 12 |
| Profit & Loss Account | B16 | Other Direct Costs | `accounts.purchases.5002` | Other direct costs | Box 13 |
| Profit & Loss Account | B17 | Cost of Sales | `gl-cor:amount (costOfSales)` | Total cost of goods | -- |
| Profit & Loss Account | B19 | **Gross Profit** | `gl-cor:amount (grossProfit)` | Gross profit | Box 14 |
| Profit & Loss Account | B21 | Wages & Salaries | `accounts.purchases.5101` | Employee costs | Box 16 |
| Profit & Loss Account | B22 | Light, Heat, Power | `accounts.purchases.5201` | Premises costs component | Box 17 |
| Profit & Loss Account | B23 | Repairs & Maintenance | `accounts.purchases.5400` | Repairs | Box 18 |
| Profit & Loss Account | B24 | General Admin | `accounts.purchases.5501` | Admin expenses | Box 20 |
| Profit & Loss Account | B25 | Motor Expenses | `accounts.purchases.5601` | Car, van, travel expenses | Box 19 |
| Profit & Loss Account | B26 | Travel & Subsistence | `accounts.purchases.5600` | Travel and subsistence | Box 19 |
| Profit & Loss Account | B27 | Advertising | `accounts.purchases.5500` | Advertising | Box 20 |
| Profit & Loss Account | B28 | Legal & Professional | `accounts.purchases.5800` | Legal and financial costs | Box 21 |
| Profit & Loss Account | B29 | Bad Debts | `accounts.sales.4005` | Bad debts | Box 22 |
| Profit & Loss Account | B30 | Depreciation | `gl-cor:amount (depreciation)` | Depreciation (add back for tax) | Box 23 |
| Profit & Loss Account | B31 | Other Expenses | `accounts.purchases (other)` | Other expenses | Box 24 |
| Profit & Loss Account | B32 | Charitable Donations | `accounts.purchases.5801` | -- (not deductible) | -- |
| Profit & Loss Account | B33 | Goodwill Amortisation | `accounts.purchases.5802` | Goodwill (add back for tax) | -- |
| Profit & Loss Account | B34 | Loss on Disposal | `gl-cor:amount (lossOnDisposal)` | Loss on disposal | -- |
| Profit & Loss Account | B35 | Total Admin Expenses | `gl-cor:amount (totalAdmin)` | Total allowable expenses | Box 25 |
| Profit & Loss Account | B37 | **Operating Profit** | `gl-cor:amount (operatingProfit)` | Net profit | Box 27 |
| Profit & Loss Account | B39 | **Profit Before Tax** | `gl-cor:amount (profitBeforeTax)` | Net profit | Box 27 |

### 2.3 Income Tax (Financialaccounts.xlsx)

| Sheet | Cell | DIY Label | diya-gl Property | Tax Concept | Notes |
|-------|------|-----------|-----------------|-----------|-------|
| Income Tax | E5 | Profit from Self Employment | `gl-cor:amount (profitSE)` | Taxable profit from self-employment | Feeds SA100 box 3 |
| Income Tax | E6 | Less: Personal Allowance | `tax.incomeTax.personalAllowance` | Personal allowance deduction | SA100 |
| Income Tax | E7 | Taxable Income | `gl-cor:amount (taxableIncome)` | Taxable income after allowance | SA100 |
| Income Tax | E8 | Tax at Basic Rate (20%) | `tax.incomeTax.basicRate` | Basic rate income tax | SA100 |
| Income Tax | E9 | Tax at Higher Rate (40%) | `tax.incomeTax.higherRate` | Higher rate income tax | SA100 |
| Income Tax | E10 | **Total Income Tax** | `tax.incomeTax (total)` | Total income tax due | SA100 |
| Income Tax | E11 | Less: CIS Deducted | `diya-gl:cisDeduction (total)` | CIS deductions (SA100 box 17) | SA100 |
| Income Tax | E15 | NI Class 4 (lower band) | `tax.nationalInsurance.class4MainRate` | NI Class 4 at main rate | SA100 |
| Income Tax | E16 | NI Class 4 (upper band) | `tax.nationalInsurance.class4UpperRate` | NI Class 4 at additional rate | SA100 |
| Income Tax | E18 | **Total Tax + NI** | `gl-cor:taxAmount (totalTaxNI)` | Total tax and NI liability | SA100 |

### 2.4 SE Short (SA103S) -- Self Assessment Form

| Sheet | Cell | DIY Label | diya-gl Property | SA103S Box | Description |
|-------|------|-----------|-----------------|-----------|-------------|
| SE Short | A7 | Business name | `entityInformation.organizationIdentifier` | Box 1 | Description of business |
| SE Short | D8 | Accounting date | `documentInfo.periodCoveredEnd` | Box 2 | End of accounting period |
| SE Short | D38 | Turnover | `gl-cor:amount (sa103s.turnover)` | Box 10 | Business income / turnover |
| SE Short | D46 | Cost of sales | `gl-cor:amount (sa103s.costOfSales)` | Box 11 | Cost of goods for resale or goods used |
| SE Short | D51 | Other direct costs | `gl-cor:amount (sa103s.otherDirect)` | Box 13 | Other direct costs |
| SE Short | D55 | Employee costs | `gl-cor:amount (sa103s.employeeCosts)` | Box 16 | Employee costs |
| SE Short | D60 | Premises costs | `gl-cor:amount (sa103s.premises)` | Box 17 | Premises costs |
| SE Short | D64 | Other expenses | `gl-cor:amount (sa103s.otherExpenses)` | Box 24 | Other allowable business expenses |
| SE Short | D71 | **Net profit/loss** | `gl-cor:amount (sa103s.netProfit)` | Box 27 | Net profit (loss) |
| SE Short | D80 | Capital allowances | `tax.capitalAllowances (sa103s)` | Box 29 | Total capital allowances |
| SE Short | D85 | AIA / WDA claimed | `tax.capitalAllowances.aia (sa103s)` | Box 30 | Annual Investment Allowance |
| SE Short | D94 | Other tax adjustments | `gl-cor:amount (sa103s.otherAdjust)` | Box 33 | Other tax adjustments |
| SE Short | D99 | **Taxable profit** | `gl-cor:amount (sa103s.taxableProfit)` | Box 35 | Net business profit for tax purposes |
| SE Short | A32 | VAT threshold note | `gl-cor:detailComment (sa103s.notes)` | -- | Advisory text |
| SE Short | D106 | **Net profit for tax calc** | `gl-cor:amount (sa103s.profitForTax)` | Box 35 | Final figure for income tax calculation |

---

## 3. Basic Sole Trader (BST)

Single-file workbook. Maps to SA103S like the SE product but with a simpler structure.

### 3.1 Business Details

| Sheet | Cell | DIY Label | diya-gl Property | SA Concept | SA103S Box |
|-------|------|-----------|-----------------|-----------|------------|
| Business Details | C5 | Business Name | `entityInformation.organizationIdentifier` | Business name | Box 1 |
| Business Details | C7 | Description | `entityInformation.organizationDescription` | Business description | Box 1 (description) |
| Business Details | C8 | Address | `gl-bus:organizationAddress` | Business address | -- |
| Business Details | C10 | Town | `gl-bus:organizationAddress (town)` | Business town | -- |
| Business Details | C12 | Postcode | `gl-bus:organizationAddress (postcode)` | Business postcode | -- |

### 3.2 Profit & Loss Account (Profit & Loss Acc sheet)

| Sheet | Cell | DIY Label | diya-gl Property | SA / Tax Concept | SA103S Box |
|-------|------|-----------|-----------------|-----------------|------------|
| Profit & Loss Acc | C4 | Sales Turnover | `gl-cor:amount (salesTurnover)` | `sa:Turnover` | Box 10 |
| Profit & Loss Acc | C5 | Other Income | `gl-cor:amount (otherIncome)` | Other business income | Box 15 |
| Profit & Loss Acc | C6 | Cost of Sales (stock + direct) | `gl-cor:amount (costOfSales)` | Cost of goods | Box 11 |
| Profit & Loss Acc | C7 | Direct Costs | `gl-cor:amount (directCosts)` | Other direct costs | Box 13 |
| Profit & Loss Acc | C9 | **Gross Profit** | `gl-cor:amount (grossProfit)` | Gross profit | Box 14 |
| Profit & Loss Acc | C11 | Employee Costs | `accounts.purchases.5101` | Employee costs | Box 16 |
| Profit & Loss Acc | C12 | Premises Costs | `accounts.purchases.5200` | Premises costs | Box 17 |
| Profit & Loss Acc | C13 | Repairs & Maintenance | `accounts.purchases.5400` | Repairs | Box 18 |
| Profit & Loss Acc | C14 | General Admin | `accounts.purchases.5501` | Admin expenses | Box 20 |
| Profit & Loss Acc | C15 | Motor Expenses | `accounts.purchases.5601` | Motor expenses | Box 19 |
| Profit & Loss Acc | C16 | Travel & Subsistence | `accounts.purchases.5600` | Travel and subsistence | Box 19 |
| Profit & Loss Acc | C17 | Advertising | `accounts.purchases.5500` | Advertising | Box 20 |
| Profit & Loss Acc | C18 | Legal & Professional | `accounts.purchases.5800` | Legal and financial costs | Box 21 |
| Profit & Loss Acc | C19 | Bad Debts | `accounts.purchases.5801 (badDebts)` | Bad debts | Box 22 |
| Profit & Loss Acc | C20 | Interest & Finance | `accounts.purchases.5803` | Interest on business loans | Box 23 |
| Profit & Loss Acc | C21 | Other Expenses | `accounts.purchases (other)` | Other expenses | Box 24 |
| Profit & Loss Acc | C22 | Total Expenses | `gl-cor:amount (totalExpenses)` | Total allowable expenses | Box 25 |
| Profit & Loss Acc | C24 | **Net Profit** | `gl-cor:amount (netProfit)` | Net profit | Box 27 |
| Profit & Loss Acc | C26 | Capital Allowances | `tax.capitalAllowances` | Capital allowances | Box 29 |
| Profit & Loss Acc | C28 | Taxable Profit | `gl-cor:amount (taxableProfit)` | Net business profit for tax | Box 35 |
| Profit & Loss Acc | C30 | Income Tax | `tax.incomeTax` | Income tax on profit | SA100 |
| Profit & Loss Acc | C32 | Tax at basic rate | `tax.incomeTax.basicRate` | Basic rate tax amount | SA100 |
| Profit & Loss Acc | C33 | NI Class 4 | `tax.nationalInsurance.class4` | NI Class 4 contributions | SA100 |
| Profit & Loss Acc | C35 | Net Income After Tax | `gl-cor:amount (netIncome)` | Take-home after tax | -- |

### 3.3 Monthly Sales (Profit & Loss Acc sheet, row 4, columns D-O)

| Sheet | Cell | DIY Label | diya-gl Property | SA Concept |
|-------|------|-----------|-----------------|-----------|
| Profit & Loss Acc | D4 | Apr | `gl-cor:amount (monthlySales.apr)` | Monthly turnover breakdown |
| Profit & Loss Acc | E4 | May | `gl-cor:amount (monthlySales.may)` | Monthly turnover breakdown |
| Profit & Loss Acc | F4 | Jun | `gl-cor:amount (monthlySales.jun)` | Monthly turnover breakdown |
| Profit & Loss Acc | G4 | Jul | `gl-cor:amount (monthlySales.jul)` | Monthly turnover breakdown |
| Profit & Loss Acc | H4 | Aug | `gl-cor:amount (monthlySales.aug)` | Monthly turnover breakdown |
| Profit & Loss Acc | I4 | Sep | `gl-cor:amount (monthlySales.sep)` | Monthly turnover breakdown |
| Profit & Loss Acc | J4 | Oct | `gl-cor:amount (monthlySales.oct)` | Monthly turnover breakdown |
| Profit & Loss Acc | K4 | Nov | `gl-cor:amount (monthlySales.nov)` | Monthly turnover breakdown |
| Profit & Loss Acc | L4 | Dec | `gl-cor:amount (monthlySales.dec)` | Monthly turnover breakdown |
| Profit & Loss Acc | M4 | Jan | `gl-cor:amount (monthlySales.jan)` | Monthly turnover breakdown |
| Profit & Loss Acc | N4 | Feb | `gl-cor:amount (monthlySales.feb)` | Monthly turnover breakdown |
| Profit & Loss Acc | O4 | Mar | `gl-cor:amount (monthlySales.mar)` | Monthly turnover breakdown |

### 3.4 Income Tax (Income Tax sheet)

| Sheet | Cell | DIY Label | diya-gl Property | Tax Concept | Notes |
|-------|------|-----------|-----------------|-----------|-------|
| Income Tax | E5 | Profit from Self Employment | `gl-cor:amount (profitSE)` | Taxable profit from SE | SA100 |
| Income Tax | E6 | Less: Personal Allowance | `tax.incomeTax.personalAllowance` | Personal allowance | SA100 |
| Income Tax | E7 | Taxable Income | `gl-cor:amount (taxableIncome)` | Taxable income | SA100 |
| Income Tax | E8 | Tax at Basic Rate (20%) | `tax.incomeTax.basicRate` | Basic rate tax | SA100 |
| Income Tax | E9 | Tax at Higher Rate (40%) | `tax.incomeTax.higherRate` | Higher rate tax | SA100 |
| Income Tax | E10 | **Total Income Tax** | `tax.incomeTax (total)` | Total income tax | SA100 |
| Income Tax | E11 | Less: CIS Deducted | `diya-gl:cisDeduction (total)` | CIS deductions | SA100 box 17 |
| Income Tax | E15 | NI Class 4 (lower band) | `tax.nationalInsurance.class4MainRate` | NI Class 4 main rate | SA100 |
| Income Tax | E16 | NI Class 4 (upper band) | `tax.nationalInsurance.class4UpperRate` | NI Class 4 additional rate | SA100 |
| Income Tax | E18 | **Total Tax + NI** | `gl-cor:taxAmount (totalTaxNI)` | Total tax + NI liability | SA100 |

### 3.5 SE Short (SA103S) -- Self Assessment Form

| Sheet | Cell | DIY Label | diya-gl Property | SA103S Box | Description |
|-------|------|-----------|-----------------|-----------|-------------|
| SE Short | A7 | Business name | `entityInformation.organizationIdentifier` | Box 1 | Description of business |
| SE Short | D8 | Accounting date | `documentInfo.periodCoveredEnd` | Box 2 | End of accounting period |
| SE Short | D38 | Turnover | `gl-cor:amount (sa103s.turnover)` | Box 10 | Business income / turnover |
| SE Short | D46 | Cost of goods | `gl-cor:amount (sa103s.costOfGoods)` | Box 11 | Cost of goods |
| SE Short | D51 | Other direct costs | `gl-cor:amount (sa103s.otherDirect)` | Box 13 | Other direct costs |
| SE Short | D55 | Employee costs | `gl-cor:amount (sa103s.employeeCosts)` | Box 16 | Employee costs |
| SE Short | D60 | Premises costs | `gl-cor:amount (sa103s.premises)` | Box 17 | Premises costs |
| SE Short | D64 | Other expenses | `gl-cor:amount (sa103s.otherExpenses)` | Box 24 | Other expenses |
| SE Short | D71 | **Net profit/loss** | `gl-cor:amount (sa103s.netProfit)` | Box 27 | Net profit (loss) |
| SE Short | D80 | Capital allowances | `tax.capitalAllowances (sa103s)` | Box 29 | Total capital allowances |
| SE Short | D85 | AIA / WDA claimed | `tax.capitalAllowances.aia (sa103s)` | Box 30 | Annual Investment Allowance |
| SE Short | D94 | Other tax adjustments | `gl-cor:amount (sa103s.otherAdjust)` | Box 33 | Other tax adjustments |
| SE Short | D99 | **Taxable profit** | `gl-cor:amount (sa103s.taxableProfit)` | Box 35 | Net business profit for tax |
| SE Short | A32 | VAT threshold note | `gl-cor:detailComment (sa103s.notes)` | -- | Advisory text |
| SE Short | D106 | **Net profit for tax calc** | `gl-cor:amount (sa103s.profitForTax)` | Box 35 | Final figure for tax calc |

### 3.6 Stock (PurchasesStock sheet)

| Sheet | Cell | DIY Label | diya-gl Property | SA Concept | Notes |
|-------|------|-----------|-----------------|-----------|-------|
| PurchasesStock | D5 | Opening Stock | `accounts.assets.1100 (opening)` | Opening stock value | Feeds Cost of Sales |
| PurchasesStock | D7 | Stock at Cost | `accounts.assets.1100 (atCost)` | Stock purchases at cost | Purchases total |
| PurchasesStock | D30 | Closing Stock | `accounts.assets.1100 (closing)` | Closing stock value | Reduces Cost of Sales |

### 3.7 Debtors & Creditors

| Sheet | Cell | DIY Label | diya-gl Property | SA Concept |
|-------|------|-----------|-----------------|-----------|
| Debtors & Creditors | C5 | Opening Debtor 1 | `accounts.assets.1300 (opening[0])` | Accruals basis: opening trade debtors |
| Debtors & Creditors | C6 | Opening Debtor 2 | `accounts.assets.1300 (opening[1])` | Accruals basis: opening trade debtors |
| Debtors & Creditors | C7 | Opening Debtor 3 | `accounts.assets.1300 (opening[2])` | Accruals basis: opening trade debtors |
| Debtors & Creditors | F5 | Closing Debtor 1 | `accounts.assets.1300 (closing[0])` | Accruals basis: closing trade debtors |
| Debtors & Creditors | F6 | Closing Debtor 2 | `accounts.assets.1300 (closing[1])` | Accruals basis: closing trade debtors |
| Debtors & Creditors | F7 | Closing Debtor 3 | `accounts.assets.1300 (closing[2])` | Accruals basis: closing trade debtors |
| Debtors & Creditors | C12 | Opening Creditor 1 | `accounts.liabilities.2100 (opening[0])` | Accruals basis: opening trade creditors |
| Debtors & Creditors | C13 | Opening Creditor 2 | `accounts.liabilities.2100 (opening[1])` | Accruals basis: opening trade creditors |
| Debtors & Creditors | C14 | Opening Creditor 3 | `accounts.liabilities.2100 (opening[2])` | Accruals basis: opening trade creditors |
| Debtors & Creditors | C15 | Opening Creditor 4 | `accounts.liabilities.2100 (opening[3])` | Accruals basis: opening trade creditors |
| Debtors & Creditors | F12 | Closing Creditor 1 | `accounts.liabilities.2100 (closing[0])` | Accruals basis: closing trade creditors |
| Debtors & Creditors | F13 | Closing Creditor 2 | `accounts.liabilities.2100 (closing[1])` | Accruals basis: closing trade creditors |
| Debtors & Creditors | F14 | Closing Creditor 3 | `accounts.liabilities.2100 (closing[2])` | Accruals basis: closing trade creditors |
| Debtors & Creditors | F15 | Closing Creditor 4 | `accounts.liabilities.2100 (closing[3])` | Accruals basis: closing trade creditors |

---

## 4. Taxi Driver

Single-file workbook. Specialist sole trader product with mileage comparison (actual costs vs. HMRC approved mileage rates). Maps to SA103S like BST/SE.

### 4.1 Business Details

| Sheet | Cell | DIY Label | diya-gl Property | SA Concept | SA103S Box |
|-------|------|-----------|-----------------|-----------|------------|
| Business Details | C5 | Business Name | `entityInformation.organizationIdentifier` | Business name | Box 1 |
| Business Details | C7 | Description | `entityInformation.organizationDescription` | Business description | Box 1 |
| Business Details | C8 | Address | `gl-bus:organizationAddress` | Business address | -- |
| Business Details | C10 | Town | `gl-bus:organizationAddress (town)` | Business town | -- |
| Business Details | C12 | Postcode | `gl-bus:organizationAddress (postcode)` | Business postcode | -- |
| Business Details | O29 | UTR | `gl-taf:taxRegistrationNumber` | Unique Taxpayer Reference | SA100 |

### 4.2 Profit & Loss Account (Profit & Loss Acc sheet, column B)

| Sheet | Cell | DIY Label | diya-gl Property | SA / Tax Concept | SA103S Box |
|-------|------|-----------|-----------------|-----------------|------------|
| Profit & Loss Acc | B5 | Turnover (Total Fares) | `gl-cor:amount (salesTurnover)` | `sa:Turnover` | Box 10 |
| Profit & Loss Acc | B6 | Fuel | `accounts.purchases.5100 (fuel)` | Vehicle running costs | Box 19 |
| Profit & Loss Acc | B7 | Car Hire / Rental | `accounts.purchases.5200 (carHire)` | Vehicle running costs | Box 19 |
| Profit & Loss Acc | B8 | Repairs & Servicing | `accounts.purchases.5300 (repairs)` | Vehicle running costs | Box 18 |
| Profit & Loss Acc | B9 | Road Tax & Insurance | `accounts.purchases.5400 (taxIns)` | Vehicle running costs | Box 19 |
| Profit & Loss Acc | B10 | Total Vehicle Running Costs | `gl-cor:amount (vehicleCosts)` | Total vehicle costs | Box 19 (total) |
| Profit & Loss Acc | B11 | Capital Allowances | `tax.capitalAllowances` | Capital allowances | Box 29 |
| Profit & Loss Acc | B12 | Mileage Allowance | `tax.mileage (allowance)` | HMRC approved mileage rate | Box 19 (alternative) |
| Profit & Loss Acc | B13 | **Gross Profit** | `gl-cor:amount (grossProfit)` | Gross profit | Box 14 |
| Profit & Loss Acc | B14 | Employee Costs | `accounts.purchases.5500` | Employee costs | Box 16 |
| Profit & Loss Acc | B15 | Premises Costs | `accounts.purchases.5600` | Premises costs | Box 17 |
| Profit & Loss Acc | B16 | General Admin | `accounts.purchases.5700` | Admin expenses | Box 20 |
| Profit & Loss Acc | B17 | Advertising | `accounts.purchases.5800` | Advertising | Box 20 |
| Profit & Loss Acc | B18 | Legal & Professional | `accounts.purchases.5900` | Legal and financial costs | Box 21 |
| Profit & Loss Acc | B19 | Interest & Bank Charges | `accounts.purchases.6000` | Interest on business loans | Box 23 |
| Profit & Loss Acc | B20 | Bank Charges | `accounts.purchases.6100` | Bank charges | Box 23 |
| Profit & Loss Acc | B21 | Other Expenses | `accounts.purchases.6200` | Other expenses | Box 24 |
| Profit & Loss Acc | B22 | Total General Expenses | `gl-cor:amount (totalGeneral)` | Total allowable expenses | Box 25 |
| Profit & Loss Acc | B23 | **Net Profit** | `gl-cor:amount (netProfit)` | Net profit | Box 27 |
| Profit & Loss Acc | B24 | Taxable Profit | `gl-cor:amount (taxableProfit)` | Net business profit for tax | Box 35 |

### 4.3 Draft Tax Calculation

| Sheet | Cell | DIY Label | diya-gl Property | Tax Concept | Notes |
|-------|------|-----------|-----------------|-----------|-------|
| Draft Tax calculation | E5 | Profit from Self Employment | `gl-cor:amount (profitSE)` | Taxable profit from SE | SA100 |
| Draft Tax calculation | E6 | Less: Personal Allowance | `tax.incomeTax.personalAllowance` | Personal allowance | SA100 |
| Draft Tax calculation | E7 | Taxable Income | `gl-cor:amount (taxableIncome)` | Taxable income | SA100 |
| Draft Tax calculation | E8 | Tax at Basic Rate (20%) | `tax.incomeTax.basicRate` | Basic rate tax | SA100 |
| Draft Tax calculation | E9 | Tax at Higher Rate (40%) | `tax.incomeTax.higherRate` | Higher rate tax | SA100 |
| Draft Tax calculation | E10 | **Total Income Tax** | `tax.incomeTax (total)` | Total income tax | SA100 |
| Draft Tax calculation | E14 | NI Class 4 (lower band) | `tax.nationalInsurance.class4MainRate` | NI Class 4 main rate | SA100 |
| Draft Tax calculation | E15 | NI Class 4 (upper band) | `tax.nationalInsurance.class4UpperRate` | NI Class 4 additional rate | SA100 |
| Draft Tax calculation | E17 | **Total Tax + NI** | `gl-cor:taxAmount (totalTaxNI)` | Total tax + NI liability | SA100 |

---

## Appendix A: Taxonomy Reference Summary

### HMRC Taxonomy Namespaces

| Taxonomy | Namespace URI | Usage |
|----------|--------------|-------|
| FRS 102 (FRC) | `http://xbrl.frc.org.uk/FRS-102/2024-01-01/FRS-102` | Statutory accounts (P&L, Balance Sheet) |
| UK GAAP (legacy) | `http://www.xbrl.org/uk/gaap/core/2009-09-01` | Legacy statutory accounts |
| CT Computations | `http://www.hmrc.gov.uk/schemas/ct/comp/2024-01-01` | Corporation Tax computations |
| DPL (GAAP) | `http://www.hmrc.gov.uk/schemas/ct/dpl/2013-02-01/dpl-gaap` | Detailed Profit & Loss |
| CT600 | `http://www.govtalk.gov.uk/taxation/CT/5` | CT600 form XML |

### Key CT Computation XBRL Tags (from HMRC Prescription of Computations)

| Computation Item | XBRL Tag |
|-----------------|-----------|
| Profit/(loss) before tax per statutory accounts | `ProfitLossPerAccounts` |
| Revised Figure Before Tax | `AdjustedProfitOrLossBeforeAccountingPeriodAdjustments` |
| Adjusted Profit for the Period | `AdjustedProfitForThePeriod` |
| Adjusted Loss of Period | `AdjustedLossOfPeriod` |
| Add back: Depreciation | `AdjustmentsDepreciation` |
| Add back: Directors remuneration | `AdjustmentsDirectorsRemuneration` |
| Add back: Donations | `AdjustmentsDonations` |
| Add back: Entertaining | `AdjustmentsEntertaining` |
| Add back: Capital Expenditure | `AdjustmentsCapitalExpenditure` |
| Add back: Accountancy, legal & professional fees | `AdjustmentsAccountancyLegalAndProfessionalFees` |
| Add back: Interest and other financial charges | `AdjustmentsInterestAndOtherFinancialCharges` |
| Add back: Motor, travel & subsistence | `AdjustmentsMotorTravelAndSubsistence` |
| Add back: Leased cars | `AdjustmentsLeasedCars` |
| Add back: Penalties or fines | `AdjustmentsPenaltiesAndFines` |
| Total Capital Allowances | `TotalCapitalAllowances` |
| Total Balancing Charges | `TotalBalancingCharges` |

### Key FRS 102 Statutory Accounts Tags

| Financial Statement Item | FRS 102 Element |
|--------------------------|----------------|
| Turnover | `TurnoverRevenue` |
| Cost of sales | `CostOfSales` |
| Gross profit | `GrossProfit` |
| Administrative expenses | `AdministrativeExpenses` |
| Operating profit | `OperatingProfit` |
| Interest receivable | `OtherInterestReceivableAndSimilarIncome` |
| Profit before tax | `ProfitLossOnOrdinaryActivitiesBeforeTax` |
| Tax on profit | `TaxOnProfitOnOrdinaryActivities` |
| Profit after tax | `ProfitLossForFinancialYear` |
| Tangible fixed assets | `TangibleFixedAssets` |
| Stocks | `Stocks` |
| Debtors | `Debtors` |
| Cash at bank and in hand | `CashAtBankAndInHand` |
| Creditors due within one year | `CreditorsDueWithinOneYear` |
| Net current assets | `NetCurrentAssetsLiabilities` |
| Creditors due after one year | `CreditorsDueAfterOneYear` |
| Net assets | `NetAssetsLiabilities` |
| Called up share capital | `CalledUpShareCapital` |
| Profit and loss account (reserves) | `ProfitAndLossAccount` |
| Shareholders equity | `ShareholdersEquity` |
| Depreciation | `DepreciationOfTangibleFixedAssets` |

### SA103S Box Numbers (Self-Employment Short)

| Box | Description | BST Cell | Taxi Cell | SE Cell |
|-----|------------|----------|----------|---------|
| 1 | Business name / description | Business Details!C5 | Business Details!C5 | Business Details!C5 |
| 2 | Accounting period end date | SE Short!D8 | -- | SE Short!D8 |
| 10 | Turnover | P&L Acc!C4 | P&L Acc!B5 | P&L Account!B9 |
| 11 | Cost of goods | SE Short!D46 | -- | SE Short!D46 |
| 13 | Other direct costs | SE Short!D51 | -- | SE Short!D51 |
| 14 | Gross profit | P&L Acc!C9 | P&L Acc!B13 | P&L Account!B19 |
| 16 | Employee costs | P&L Acc!C11 | P&L Acc!B14 | P&L Account!B21 |
| 17 | Premises costs | P&L Acc!C12 | P&L Acc!B15 | P&L Account!B22 |
| 18 | Repairs | P&L Acc!C13 | P&L Acc!B8 | P&L Account!B23 |
| 19 | Motor / travel | P&L Acc!C15+C16 | P&L Acc!B10 or B12 | P&L Account!B25+B26 |
| 20 | Admin / advertising | P&L Acc!C14+C17 | P&L Acc!B16+B17 | P&L Account!B24+B27 |
| 21 | Legal & professional | P&L Acc!C18 | P&L Acc!B18 | P&L Account!B28 |
| 22 | Bad debts | P&L Acc!C19 | -- | P&L Account!B29 |
| 23 | Interest / finance | P&L Acc!C20 | P&L Acc!B19+B20 | -- |
| 24 | Other expenses | P&L Acc!C21 | P&L Acc!B21 | P&L Account!B31 |
| 25 | Total allowable expenses | P&L Acc!C22 | P&L Acc!B22 | P&L Account!B35 |
| 27 | Net profit / loss | P&L Acc!C24 | P&L Acc!B23 | P&L Account!B39 |
| 29 | Capital allowances | P&L Acc!C26 | P&L Acc!B11 | SE Short!D80 |
| 30 | AIA / WDA | SE Short!D85 | -- | SE Short!D85 |
| 33 | Other tax adjustments | SE Short!D94 | -- | SE Short!D94 |
| 35 | Taxable profit | P&L Acc!C28 | P&L Acc!B24 | SE Short!D99 |

---

## Appendix B: HMRC Reference Documents

The following documents in `_developers/hmrc-references/` informed this mapping:

| Document | Content |
|----------|---------|
| `HMRC-XBRL-Tagging-Guide.pdf` | When/how/what to XBRL tag; minimum tagging lists; conversion software guidance |
| `HMRC-Detailed-PL-XBRL-Taxonomy-Guide.pdf` | DPL taxonomy usage rules; Activity/Expense type/Detailed analysis dimensions; tagging examples |
| `HMRC-CT-Computations-Format-v1.1.pdf` | Prescribed format for CT computations with XBRL tags; Accounts Adjustments (Parts 1-7); Capital Allowances |
| `HMRC-CT-Online-XBRL-Technical-Pack-2.0.pdf` | Technical guidance for iXBRL instance creation; taxonomy entry points; embedding in CT600 XML |
| `HMRC-XBRL-Style-Guide.pdf` | Inline XBRL formatting rules; number signs; scaling; hidden data items; entity identifiers |
| `ct600-xml-samples/` | Sample CT600 XML with iXBRL accounts and computations attachment points |
