# HMRC form layouts for a sole trader's books page

Research cut, 4 September 2026. Every box list below is transcribed from the HMRC PDF or
HMRC's own published CSV, not from a secondary site. Where a source is secondary it says so
on the row.

**Version year in force.** The latest published Self Assessment forms are the **2026** forms,
covering the tax year 6 April 2025 to 5 April 2026 (2025-26). Paper filing deadline
31 October 2026, online 31 January 2027. There is no 2027 (2026-27) form yet; HMRC publishes
those the following April. So "current year" and "2025-26" are the same set of PDFs today.

Local copies of every PDF and the mapping CSV are in `./hmrc/` beside this file.

---

## 1. SA103S — Self-employment (short), 2026 (tax year 2025-26)

Source: `SA103S-2026.pdf`, HMRC 12/25, pages SES 1 and SES 2.
Notes: `SA103S_Notes_2026.pdf`.

Use these pages when turnover was under £90,000 (or would have been over a full year).

### Business details (page SES 1)

| Box | Label | Notes |
| --- | --- | --- |
| 1 | Description of business | |
| 2 | Postcode of your business address | |
| 3 | If your business name, description, address or postcode have changed in the last 12 months, put 'X' in the box and give details in the 'Any other information' box of your tax return | Tick |
| 4 | If you are a foster carer or shared lives carer, put 'X' in the box | Tick |
| 5Q | Did this business start after 5 April 2025? You must put 'X' in one box | Yes / No |
| 5 | If you answered 'Yes' in box 5Q, enter the date the business started DD MM YYYY | |
| 6Q | Did this business cease before 6 April 2026? You must put 'X' in one box | Yes / No |
| 6 | If you answered 'Yes' in box 6Q, enter the final date of trading DD MM YYYY | |
| 7 | Date your books or accounts are made up to, between 31 March and 5 April 2026, or the final date of trading | |
| 8 | If you've used traditional accounting rather than cash basis to calculate your income and expenses, put 'X' in the box | Tick. Cash basis is the default |

### Business income

Section heading on the form reads "Business income - if your annual business turnover was
below £90,000".

| Box | Label | Notes |
| --- | --- | --- |
| 9 | Your turnover, the takings, fees, sales or money earned by your business | |
| 10 | Any other business income not included in box 9 | |
| 10.1 | Trading income allowance | Up to £1,000. If claimed, boxes 11 to 20 and 23 to 25.2 are left blank |

### Allowable business expenses

Form text: "If your annual turnover was below £90,000 you may just put your total expenses in
box 20, rather than filling in the whole section."

| Box | Label | Notes |
| --- | --- | --- |
| 11 | Costs of goods bought for resale or goods used | |
| 12 | Car, van and travel expenses, after private use proportion | |
| 13 | Wages, salaries and other staff costs | |
| 14 | Rent, rates, power and insurance costs | |
| 15 | Repairs and maintenance of property and equipment | |
| 16 | Accountancy, legal and other professional fees | |
| 17 | Interest and bank and credit card financial charges | |
| 18 | Phone, fax, stationery and other office costs | |
| 19 | Other allowable business expenses. Client entertaining costs are not an allowable expense | |
| 20 | Total allowable expenses | **Total of boxes 11 to 19** |

Under-£90,000 rule, stated in the notes at "Boxes 11 to 20": fill in boxes 11 to 19 and put
the total in box 20; if turnover was below £90,000 you *may* just put the total in box 20.
It is permission, not a requirement. If box 10.1 is claimed, do not complete boxes 11 to 20.

### Net profit or loss

| Box | Label | Notes |
| --- | --- | --- |
| 21 | Net profit, if your business income is more than your expenses | **box 9 + box 10 minus box 20**, if positive |
| 22 | Or, net loss, if your expenses exceed your business income | **box 20 minus (box 9 + box 10)**, if positive |

### Tax allowances for certain buildings, vehicles and equipment (capital allowances)

Form text: "Do not include the cost of these in your business expenses." Notes: if box 10.1
is claimed, do not complete boxes 23 to 25.2.

| Box | Label | Notes |
| --- | --- | --- |
| 23 | Annual Investment Allowance | |
| 24 | Allowance for small balance of unrelieved expenditure | |
| 24.1 | Zero-emission car allowance | |
| 25 | Other capital allowances | |
| 25.1 | The Structures and Buildings Allowance | |
| 25.2 | Freeport and Investment Zones Structures and Buildings Allowance | |
| 26 | Total balancing charges, for example where you have disposed of items for more than their tax value | Addition, not an allowance |

### Calculating your taxable profits

| Box | Label | Notes |
| --- | --- | --- |
| 27 | Goods and/or services for your own use | |
| 28 | Net business profit for tax purposes | **box 21 + box 26 + box 27 minus (boxes 22 to 25.2)**, if positive. If box 10.1 completed: **box 21 + box 26 + box 27 minus box 10.1** |
| 29 | Loss brought forward from earlier years set off against this year's profits, up to the amount in box 28 | |
| 30 | Any other business income not included in box 9 or box 10 | |

### Total taxable profits or net business loss

| Box | Label | Notes |
| --- | --- | --- |
| 31 | Total taxable profits from this business | **box 28 + box 30 minus box 29**, if positive. Feeds SA110 working sheet box D1 |
| 32 | Net business loss for tax purposes | **boxes 22 to 25.2 minus (box 21 + box 26 + box 27)**, if positive |

### Losses, Class 2 and Class 4 NICs and CIS deductions

Form text: if you've made a loss (box 32), fill in boxes 33 to 35 as appropriate. Class 2
small profits threshold for 2025-26 is £6,845.

| Box | Label | Notes |
| --- | --- | --- |
| 33 | Loss from this tax year set off against other income for 2025-26 | |
| 34 | Loss to be carried back to previous years and set off against income (or capital gains) | |
| 35 | Total loss to carry forward after all other set-offs, including unused losses brought forward | |
| 36 | If your total profits for 2025-26 are less than £6,845 and you choose to pay Class 2 NICs voluntarily, put 'X' in the box | Tick |
| 37 | If you're exempt from paying Class 4 NICs, put 'X' in the box | Tick |
| 38 | Total Construction Industry Scheme (CIS) deductions taken from your payments by contractors, CIS subcontractors only | |

The form ends at box 38. There is no "any other information" box on SA103S.

### Partial-completion shortcuts named in the SA103S notes

- Evidence of self-employment (for example a Maternity Allowance claim): box 1 only.
- Tax-Free Childcare claim: boxes 1, 9, 10.1, 21, 28 and 31.
- CIS subcontractor reclaiming deducted tax: boxes 1 to 8 and box 38.

### Boxes that are totals of others (SA103S)

Boxes 20, 21, 22, 28, 31 and 32. Every one of these is a formula the page can compute.

---

## 2. SA103F — Self-employment (full), 2026 (tax year 2025-26)

Source: `SA103F-2026.pdf`, HMRC 12/25, pages SEF 1 to SEF 6.
Notes: `SA103F_Notes_2026.pdf`.

Use these pages when turnover was £90,000 or more, or when the accounting period needs
adjusting, among other triggers listed in the notes.

### Business details (page SEF 1)

| Box | Label | Notes |
| --- | --- | --- |
| 1 | Business name, unless it's in your own name | |
| 2 | Description of business | |
| 3 | First line of your business address, unless you work from home | |
| 4 | Postcode of your business address | |
| 5 | If the details in boxes 1, 2, 3 or 4 have changed in the last 12 months, put 'X' in the box and give details in the 'Any other information' box | Tick |
| 6Q | Did this business start after 5 April 2025? You must put 'X' in one box | Yes / No |
| 6 | If you answered 'Yes' in box 6Q, enter the date the business started DD MM YYYY | |
| 7Q | Did this business cease after 5 April 2025 but before 6 April 2026? You must put 'X' in one box | Yes / No |
| 7 | If you answered 'Yes' in box 7Q, enter the final date of trading DD MM YYYY | |
| 8 | Date your books or accounts start, the beginning of your accounting period DD MM YYYY | |
| 9 | Date your books or accounts are made up to or the end of your accounting period DD MM YYYY | |
| 10 | If you used traditional accounting rather than cash basis to calculate your income and expenses, put 'X' in the box | Tick |

### Other information

| Box | Label | Notes |
| --- | --- | --- |
| 11, 12 | Not in use | Printed on the form as "Boxes 11 and 12 are not in use" |
| 13 | If special arrangements apply, put 'X' in the box | Tick |
| 14 | If you provided the information about your 2025-26 profit on last year's tax return, put 'X' in the box | Tick |

### Business income

| Box | Label | Notes |
| --- | --- | --- |
| 15 | Your turnover, the takings, fees, sales or money earned by your business | |
| 16 | Any other business income not included in box 15 | |
| 16.1 | Trading income allowance | Up to £1,000 |

### Business expenses (page SEF 2) — the two-column block

The form prints two columns. The left column, boxes 17 to 30, is **total expenses**. The
right column, boxes 32 to 45, is **disallowable expenses** and carries no printed labels of
its own: the form says "Use this column if the figures in boxes 17 to 30 include disallowable
amounts", so box 32 pairs with box 17, box 33 with box 18, and so on down the column.

| Total exp. box | Label | Disallowable box |
| --- | --- | --- |
| 17 | Cost of goods bought for resale or goods used | 32 |
| 18 | Construction industry, payments to subcontractors | 33 |
| 19 | Wages, salaries and other staff costs | 34 |
| 20 | Car, van and travel expenses | 35 |
| 21 | Rent, rates, power and insurance costs | 36 |
| 22 | Repairs and maintenance of property and equipment | 37 |
| 23 | Phone, fax, stationery and other office costs | 38 |
| 24 | Advertising and business entertainment costs | 39 |
| 25 | Interest on bank and other loans | 40 |
| 26 | Bank, credit card and other financial charges | 41 |
| 27 | Irrecoverable debts written off | 42 |
| 28 | Accountancy, legal and other professional fees | 43 |
| 29 | Depreciation and loss or profit on sale of assets | 44 |
| 30 | Other business expenses | 45 |
| **31** | **Total expenses** | **46 Total disallowable expenses** |

Box 31 is the total of boxes 17 to 30. Box 46 is the total of boxes 32 to 45.

Under-£90,000 rule, from the SA103F notes: "If your annual turnover is below £90,000, and you
are not in the Managing Serious Defaulters (MSD) programme, add up your expenses and put the
total in box 31 (and your total disallowable expenses in box 46 if appropriate) rather than
giving a detailed breakdown". If you are in the MSD programme you must fill in all the boxes.
The same permission is stated on the form itself above the expenses column.

### Net profit or loss (page SEF 3)

| Box | Label | Notes |
| --- | --- | --- |
| 47 | Net profit, if your business income is more than your expenses | **box 15 + box 16 minus box 31**, if positive |
| 48 | Or, net loss, if your expenses are more than your business income | **box 31 minus (box 15 + box 16)**, if positive |

### Tax allowances for vehicles and equipment (capital allowances)

| Box | Label | Notes |
| --- | --- | --- |
| 49 | Annual Investment Allowance | AIA |
| 50 | Capital allowances at 18% on equipment, including cars with lower CO2 emissions | WDA main pool |
| 51 | Capital allowances at 6% on equipment, including cars with higher CO2 emissions | WDA special rate pool |
| 52 | Zero-emission goods vehicle allowance | FYA |
| 52.1 | Zero-emission car allowance | FYA |
| 53 | The Structures and Buildings Allowance | SBA |
| 53.1 | Freeport and Investment Zones Structures and Buildings Allowance | Enhanced SBA |
| 54 | Electric charge-point allowance | |
| 55 | 100% and other enhanced capital allowances | Includes FYA on plant and machinery |
| 56 | Allowances on sale or cessation of business use (where you've disposed of assets for less than their tax value) | Balancing allowance |
| 57 | Total capital allowances | **Total of boxes 49 to 56** |
| 58 | Not in use | Printed as "Box 58 is not in use" |
| 59 | Balancing charge on sales of assets or on the cessation of business use (including where Business Premises Renovation Allowance has been claimed), for example where you've disposed of assets for more than their tax value | Balancing **charge**, an addition |

Note: the form has no separate box for "first year allowance on plant and machinery"; that
sits inside box 55. The MTD API does now expose it as a distinct field (see section 6).

### Calculating your taxable profit or loss

| Box | Label | Notes |
| --- | --- | --- |
| 60 | Goods and services for your own use | |
| 61 | Total additions to net profit or deductions from net loss | **box 46 + box 59 + box 60** |
| 62 | Income, receipts and other profits included in business income or expenses but not taxable as business profits | |
| 63 | Total deductions from net profit or additions to net loss | **box 57 + box 62** |
| 64 | Net business profit for tax purposes | **box 47 + box 61 minus (box 48 + box 63)**, if positive |
| 65 | Net business loss for tax purposes | **box 48 + box 63 minus (box 47 + box 61)**, if positive |
| 66, 67 | Not in use | Printed as "Boxes 66 and 67 are not in use" |
| 68 | Adjustment where your accounting period ended before 31 March 2026 or where your accounting period was not 12 months long. Minus sign allowed | Signed field |
| 69, 70 | Not in use | Printed as "Boxes 69 and 70 are not in use". Box 69 was overlap relief, now spent |
| 71 | Adjustment for change of accounting practice | |
| 72 | Averaging adjustment (only for farmers, market gardeners and creators of literary or artistic works). Minus sign allowed | Signed field |
| 73 | Adjusted profit for 2025-26 | Working sheet in the notes |
| 73.1, 73.2 | Not in use | Printed as "Boxes 73.1 and 73.2 are not in use" |
| 73.3 | Spread of the transition profit treated as arising in this tax year | Basis-period reform spreading |
| 73.4 | Loss brought forward from earlier years set off against this year's spread of the transition profit, up to the amount in box 73.3 | |
| 74 | Loss brought forward from earlier years set off against this year's adjusted profit | |
| 75 | Any other business income not included in boxes 15, 16 or 60 | |
| 76 | Total taxable profits from this business | Working sheet in the notes. Do **not** include box 73.3. Feeds SA110 working sheet box D2 |
| 76.1 | Amount claimed under the foreign income and gains (FIG) regime | |

### Losses (page SEF 4)

| Box | Label | Notes |
| --- | --- | --- |
| 77 | Adjusted loss for 2025-26 | Working sheet in the notes |
| 77.1 | Adjustment to losses as a result of a claim under the foreign income and gains (FIG) regime | |
| 78 | Loss from this tax year set off against other income for 2025-26 | Sideways relief |
| 79 | Loss to be carried back to previous years and set off against income (or capital gains) | |
| 80 | Total loss to carry forward after all other set-offs, including unused losses brought forward | |

### CIS deductions and tax taken off (page SEF 5)

| Box | Label |
| --- | --- |
| 81 | Total Construction Industry Scheme (CIS) deductions taken from your payments by contractors, CIS subcontractors only |
| 82 | Other tax taken off trading income |

### Balance sheet (page SEF 5)

Optional. The form says "If you do not have a balance sheet, go to box 100."

| Box | Label | Group | Notes |
| --- | --- | --- | --- |
| 83 | Equipment, machinery and vehicles | Assets | |
| 84 | Other fixed assets | Assets | |
| 85 | Stock and work in progress | Assets | |
| 86 | Trade debtors | Assets | |
| 87 | Bank or building society balances | Assets | |
| 88 | Cash in hand | Assets | |
| 89 | Other current assets and prepayments | Assets | |
| 90 | Total assets | Assets | **Total of boxes 83 to 89** |
| 91 | Trade creditors | Liabilities | |
| 92 | Loans and overdrawn bank account balances | Liabilities | |
| 93 | Other liabilities and accruals | Liabilities | |
| 94 | Net business assets | Net | **box 90 minus (boxes 91 to 93)** |
| 95 | Balance at start of period | Capital account | |
| 96 | Net profit or loss | Capital account | **box 47 or box 48** |
| 97 | Capital introduced | Capital account | |
| 98 | Drawings | Capital account | |
| 99 | Balance at end of period | Capital account | Should equal box 94 |

### Class 2 and Class 4 NICs, and other information (page SEF 6)

| Box | Label | Notes |
| --- | --- | --- |
| 100 | If your total profits for 2025-26 are less than £6,845 and you choose to pay Class 2 NICs voluntarily, put 'X' in the box | Tick |
| 101 | If you're exempt from paying Class 4 NICs, put 'X' in the box | Tick |
| 102 | Adjustment to profits chargeable to Class 4 NICs | Feeds SA110 working sheet box D7 |
| 103 | Please give any other information in this space | Free text |

### Boxes that are totals of others (SA103F)

Boxes 31, 46, 47, 48, 57, 61, 63, 64, 65, 73, 76, 77, 90, 94, 96 and 99.

---

## 3. SA100 main return — the boxes a sole trader's page needs

Source: `SA100-2026.pdf`, HMRC 12/25. Kept deliberately short.

| Page | Box | Label | Why a sole trader page needs it |
| --- | --- | --- | --- |
| Front | — | UTR, NINO, employer reference, issue address | Identity block reprinted on every supplementary page |
| TR 1 | 1 | Your date of birth | Drives age-related reliefs and State Pension age for Class 4 |
| TR 1 | 2 | Your name and address | |
| TR 1 | 3 | Your phone number | |
| TR 1 | 4 | Your National Insurance number | |
| TR 2 | 2 | **Self-employment.** "If you worked for yourself (on your 'own account' or in self-employment) in the year to 5 April 2026 ... Do you need to fill in the 'Self-employment' pages?" Yes / No, plus a **Number** box for how many businesses | The tick box that says an SA103 is attached, and how many |
| TR 5 | 1 to 3 | Student Loan and Postgraduate Loan repayments | Feeds SA110 boxes 3 and 3.1 |
| TR 6 | — | "Finishing your tax return — Calculating your tax". Prose, not a numbered box: "If you want to calculate your tax, ask us for the 'Tax calculation summary' pages and notes." | This is the SA110 cross-reference. There is no box number for it |
| TR 6 | 1 | If you've had any 2025-26 Income Tax refunded or set off by us or Jobcentre Plus, enter the amount | |
| TR 6 | 2 | If you owe less than £3,000 for 2025-26 (excluding Class 2 NICs) ... put 'X' if you do not want it collected through your tax code | Tick |
| TR 8 | 20 | If this tax return contains provisional figures, put 'X' | Tick |
| TR 8 | 21 | If you're enclosing separate supplementary pages, put 'X' | Tick. Set when SA103 is attached |
| TR 8 | 22 | Declaration and signature | |

The SA100's own supplementary-page questions on TR 2 are numbered 1 to 8: 1 Employment,
2 Self-employment, 3 Partnership, and so on to 7 Capital Gains and 8 Residence. Only box 2
matters here.

Also worth noting for a books page: HMRC's own paper-return rules on the information sheet
are "enter your figures in whole pounds, ignore the pence; round down income and round up
expenses and tax paid; if a box does not apply, leave it blank".

---

## 4. VAT return — the nine boxes (VAT100 / MTD VAT return)

Source: VAT Notice 700/12, "How to fill in and submit your VAT Return", section 3
(paragraphs 3.2 to 3.10) and section 4.1. Current at the time of fetch.

| Box | Official heading | What it contains |
| --- | --- | --- |
| 1 | VAT due in the period on sales and other outputs | Output VAT charged on all goods and services supplied, including private use, sales of business assets, and reverse-charge output tax. Zero-rated exports carry no VAT so contribute nothing here |
| 2 | VAT due in the period on acquisitions of goods made in Northern Ireland from EU member states | Acquisition VAT on goods and related costs from VAT-registered EU suppliers. Nil for a GB-only business |
| 3 | Total VAT due | **box 1 + box 2** |
| 4 | VAT reclaimed in the period on purchases and other inputs (including acquisitions from the EU) | Deductible input VAT on purchases, imports, acquisitions, plus bad debt relief. Excludes goods for personal use and business entertainment |
| 5 | Net VAT to pay to HMRC or reclaim | **box 3 minus box 4**, as a positive figure. Positive result in box 3 means pay; a larger box 4 means reclaim |
| 6 | Total value of sales and all other outputs excluding any VAT | Net turnover: all business sales, zero-rated supplies, exports, and supplies to EU member states |
| 7 | The total value of purchases and all other inputs excluding any VAT | Net purchases including imports and EU acquisitions. Excludes wages, loans, dividends |
| 8 | Total value of all supplies of goods and related costs, excluding any VAT, to EU member states | Goods dispatched from Northern Ireland to the EU, including installed/assembled goods and distance sales |
| 9 | Total value of all acquisitions of goods and related costs, excluding any VAT, from EU member states | Goods acquired from EU suppliers into Northern Ireland |

Boxes 3 and 5 are the only calculated boxes. Boxes 2, 8 and 9 are Northern Ireland only.

### Flat Rate Scheme variation

| Box | Flat Rate Scheme rule |
| --- | --- |
| 1 | Apply the flat rate percentage for your trade sector to the total of all your supplies **including VAT**. The result goes in box 1. It is not the VAT you actually charged |
| 6 | Enter the turnover that you applied your flat rate percentage to, **including VAT**. Add the value of any capital goods sold on which input VAT was reclaimed |

Under the Flat Rate Scheme box 4 is normally nil, except for reclaimed input tax on qualifying
capital assets over £2,000. This matters for the SE (VAT registered) product: a flat-rate
books page cannot derive box 1 from the sales ledger's VAT column, it has to apply the sector
percentage to gross turnover.

---

## 5. SA110 tax calculation summary, and the SA302 calculation order

Source: `SA110-2026.pdf` (the form) and `SA110-Notes-2026.pdf` (the working sheet), HMRC 12/25.

### SA110 form boxes (2026)

| Page | Box | Label |
| --- | --- | --- |
| TC 1 | 1 | Total tax (may include Student Loan or Postgraduate Loan repayments), Class 2 NICs and Class 4 NICs **due** before any payments on account |
| TC 1 | 2 | Total tax (may include Student Loan or Postgraduate Loan repayments), Class 2 NICs and Class 4 NICs **overpaid** |
| TC 1 | 3 | Student Loan repayment due |
| TC 1 | 3.1 | Postgraduate Loan repayment due |
| TC 1 | 4 | Class 4 NICs due |
| TC 1 | 4.1 | Class 2 NICs due |
| TC 1 | 5 | Capital Gains Tax due |
| TC 1 | 6 | Pension charges due |
| TC 1 | 7 | Underpaid tax for earlier years included in your tax code for 2025-26 |
| TC 1 | 8 | Underpaid tax for 2025-26 included in your tax code for 2026-27 |
| TC 1 | 9 | Outstanding debt included in your tax code for 2025-26 |
| TC 1 | 10 | If you're claiming to reduce your 2026-27 payments on account, put 'X' in the box |
| TC 1 | 11 | Your first payment on account for 2026-27, including pence |
| TC 2 | 12 | Blind person's surplus allowance you can have |
| TC 2 | 13 | Married couple's surplus allowance you can have (born before 6 April 1935) |
| TC 2 | 14 | Increase in tax due because of adjustments to an earlier year |
| TC 2 | 15 | Decrease in tax due because of adjustments to an earlier year |
| TC 2 | 16 | Any 2026-27 repayment you're claiming now |
| TC 2 | 17 | Any other information |

Boxes 1 to 6 are entered in whole pounds and pence. Box 11 explicitly says "including pence".

### The calculation order (the SA302 layout)

HMRC's own working sheet runs in this order. A books page's tax computation should follow it
line for line. Section numbers and working-sheet box refs are HMRC's.

| Order | Section | Working sheet | What it produces |
| --- | --- | --- | --- |
| 1 | Section 1: Add together non-savings income and lump sum payments | ends at **A43** (total non-savings income) and **A44** (lump sums) | Self-employment profit enters here |
| 2 | Section 2: Add together savings income (excluding dividends) | **A64** | |
| 3 | Section 3: Add together dividends, and gains on life policies with tax treated as paid | **A77**, **A80** | |
| 3a | Section 3a: Status | | |
| — | | **A81 = A43 + A44 + A64 + A77 + A80** | **Total income** |
| 4 | Section 4: Calculate total allowances and deductions | **A121** adjusted net income, **A125** Personal Allowance (£12,570), **A126** Blind Person's Allowance (£3,130), **A128** total allowances, **A129** Marriage Allowance transferred out (£1,260), **A130** total deductions and allowances | |
| 5 | Section 5: Calculate taxable income | **A131 = A81 minus A130** | **Total taxable income** |
| 6 | Section 6: Allocate income to tax bands | | See band table below |
| 7 | Section 7: Calculate Income Tax due | | |
| 8 | Section 8: Calculate Income Tax due after tax adjustments | | |
| 9 | Section 9: Calculate tax due after Gift Aid payments | **A297** | |
| 10 | Section 10: Calculate tax taken off | **A327** total tax paid at source | |
| 11 | Section 11: Calculate the amount of tax due for 2025-26 | **A328** Income Tax due, **A329** Class 4 NICs (from D18), **A330** Class 2 NICs (from D19), **A331 = A328a + A329 + A330**, then A332 underpaid tax in code, A333/A334 loans, less A339 tax at source | A329 copies to SA110 box 4, A330 to box 4.1, A332 to box 7, A333 to box 3, A334 to box 3.1, A338 to box 8 |
| 12 | Section 12: Calculate the amount to pay by 31 January 2027 | **A346** to box 14, **A348** to box 15, **A349** to box 16, **A350** payments already made towards 2025-26 payments on account, **A351** other payments or credits | Payments on account |

Bands used in Section 6 for 2025-26 (from the SA110 notes rate table):

| Slice | Non-savings | Savings | Dividends |
| --- | --- | --- | --- |
| First £5,000 (starting rate for savings) | 20% | 0% | 8.75% |
| Next £32,700 (rest of the £37,700 basic rate band) | 20% | 20% | 8.75% |
| Next £87,440 (to £125,140) | 40% | 40% | 33.75% |
| Remaining taxable income | 45% | 45% | 39.35% |

Savings nil rate (£1,000 / £500 / nil) and dividend allowance (£500) are taxed at 0%.

### Section 15: Class 2 and Class 4 NICs

This is the part a sole trader books page must reproduce. Working sheet boxes D1 to D19.

| Box | Line | Source |
| --- | --- | --- |
| D1 | Profits from SA103S | SA103S **box 31** |
| D2 | Profits from SA103F | SA103F **box 76** |
| D2a | Transition profit | SA103F **box 73.3 minus box 73.4** |
| D3 to D5a | Lloyd's and partnership profits | |
| D6 | **Total profits for Class 4 NICs** | total of D1 to D5a |
| D7 | Adjustment from SA103F | SA103F **box 102** |
| D8 to D10 | Other adjustments | |
| D11 | **Total Class 4 NICs adjustments** | total of D7 to D10 |
| D12 | Total profit less adjustment | D6 minus D11 |
| D13 | **Profit on which Class 4 NICs is due** | D12 minus £12,570 |
| D14 | Amount in the main band | lower of D13 and £37,700 |
| D15 | Main-rate Class 4 | D14 x 6%, max £2,262.00 |
| D16 | Amount above the upper limit | D13 minus D14 |
| D17 | Additional-rate Class 4 | D16 x 2% |
| D18 | **Class 4 NICs due** | D15 + D17, copies to A329 then SA110 box 4 |
| D19 | **Class 2 NICs due** | £3.50 a week (£4.15 for share fishermen) for 2025-26. If profits (D12) are over £6,845, D19 = 0 and contributions are treated as paid. Below £6,845 you may elect to pay voluntarily. Copies to A330 then SA110 box 4.1 |
| D20 onwards | Regulation 100 annual maximum, for someone with both employment and self-employment | Caps total NICs |

So for 2025-26 the Class 4 profile is: 6% between £12,570 and £50,270, then 2% above, and
Class 2 is effectively zero for anyone over the £6,845 small profits threshold.

---

## 6. Structured data: the MTD ITSA API for self-employment

### HMRC's own box-to-API mapping

HMRC publishes a CSV mapping SA form boxes to API fields at
`hmrc/income-tax-mtd-changelog`, folder `mapping/csv`. The self-employment file is
**`sa103f_mapping_v3.csv`** and it carries **both** form numberings: the `HMRC Box Ref`
column shows `FSE<n>` for SA103F and `SSE<n>` for the matching SA103S box. A local copy is
at `./hmrc/sa103f_mapping_v3.csv`. This is the only published SA103-to-MTD mapping I found.

Three caveats on that file. It still lists FSE69 "Overlap relief used this year" as live even
though the 2026 form prints boxes 69 and 70 as not in use. A few box labels still quote
2022-23 dates. And its SSE column is incomplete: there is **no** SSE ref for SA103S boxes 4,
24, 25.1, 29, 30 or 31, and it maps SSE 25 to FSE 57 "Total capital allowances" when the 2026
SA103S prints box 25 as "Other capital allowances". Treat the field paths as authoritative and
the SA103S cross-references as needing a check against the form.

The API is **Self Employment Business (MTD)**, current version **5.0**, base path
`/individuals/business/self-employment/{nino}/{businessId}/...`. Its JSON schemas are
versioned by tax year, so a filing implementation has to pick the right shape:

| Endpoint | Tax years | Schema |
| --- | --- | --- |
| `POST .../period` (discrete period summary) | 2023-24 and 2024-25 | `createPeriodSummary/def2` |
| `PUT .../cumulative/{taxYear}` (cumulative period summary) | **2025-26 and after** | `createAmendCumulativePeriodSummary` |
| `PUT .../annual/{taxYear}` | 2023-24 and before / 2024-25 / 2025-26 / **2026-27 onwards** | `createAmendAnnualSubmission/def1` to `def4` |

For any year the Filing phase will actually target, the quarterly route is the **cumulative
period summary**, not the discrete period summary. The discrete endpoint stops at 2024-25.

### Quarterly update fields

`PUT /individuals/business/self-employment/{nino}/{businessId}/cumulative/{taxYear}` for
2025-26 onwards. `POST .../period` for 2023-24 and 2024-25. The field names below are
identical across both.

| API field | SA103F box | SA103S box |
| --- | --- | --- |
| `periodDates.periodStartDate` / `periodEndDate` | — | — |
| `periodIncome.turnover` | 15 | 9 |
| `periodIncome.other` | 16 | 10 |
| `periodIncome.taxTakenOffTradingIncome` | 82 | — |
| `periodExpenses.costOfGoods` | 17 | 11 |
| `periodExpenses.paymentsToSubcontractors` | 18 | — |
| `periodExpenses.wagesAndStaffCosts` | 19 | 13 |
| `periodExpenses.carVanTravelExpenses` | 20 | 12 |
| `periodExpenses.premisesRunningCosts` | 21 | 14 |
| `periodExpenses.maintenanceCosts` | 22 | 15 |
| `periodExpenses.adminCosts` | 23 | 18 |
| `periodExpenses.advertisingCosts` and `periodExpenses.businessEntertainmentCosts` | 24 | — |
| `periodExpenses.interestOnBankOtherLoans` | 25 | 17 |
| `periodExpenses.financeCharges` | 26 | — |
| `periodExpenses.irrecoverableDebts` | 27 | — |
| `periodExpenses.professionalFees` | 28 | 16 |
| `periodExpenses.depreciation` | 29 | — |
| `periodExpenses.otherExpenses` | 30 | 19 |
| `periodExpenses.consolidatedExpenses` | 31 | 20 |

`consolidatedExpenses` is the three-line route. Send it *instead of* the itemised
`periodExpenses` fields when turnover is under the VAT threshold. That is exactly the SA103S
"just put the total in box 20" permission, expressed as an API field.

The disallowable column maps one for one, same names with a `Disallowable` suffix, under
`periodDisallowableExpenses`:

| API field | SA103F box |
| --- | --- |
| `costOfGoodsDisallowable` | 32 |
| `paymentsToSubcontractorsDisallowable` | 33 |
| `wagesAndStaffCostsDisallowable` | 34 |
| `carVanTravelExpensesDisallowable` | 35 |
| `premisesRunningCostsDisallowable` | 36 |
| `maintenanceCostsDisallowable` | 37 |
| `adminCostsDisallowable` | 38 |
| `advertisingCostsDisallowable`, `businessEntertainmentCostsDisallowable` | 39 |
| `interestOnBankOtherLoansDisallowable` | 40 |
| `financeChargesDisallowable` | 41 |
| `irrecoverableDebtsDisallowable` | 42 |
| `professionalFeesDisallowable` | 43 |
| `depreciationDisallowable` | 44 |
| `otherExpensesDisallowable` | 45 |

Boxes 46, 47 and 48 have no API field. HMRC calculates them.

### Annual submission: "Create and Amend Self-Employment Annual Submission"

`PUT /individuals/business/self-employment/{nino}/{businessId}/annual/{taxYear}`

The table below is the **2026-27 onwards** schema (`def4`). SA103F box refs come from HMRC's
mapping CSV; the SA103S column is only filled where the CSV carries an SSE ref.

| API field | SA103F box | SA103S box |
| --- | --- | --- |
| `adjustments.includedNonTaxableProfits` | 62 | — |
| `adjustments.basisAdjustment` | 68 | — |
| `adjustments.accountingAdjustment` | 71 | — |
| `adjustments.averagingAdjustment` | 72 | — |
| `adjustments.outstandingBusinessIncome` | 75 | — |
| `adjustments.balancingChargeBpra`, `adjustments.balancingChargeOther` | 59 | 26 |
| `adjustments.goodsAndServicesOwnUse` | 60 | 27 |
| `adjustments.transitionProfitAmount`, `adjustments.transitionProfitAccelerationAmount` | 73.3 | — |
| `adjustments.adjustmentToProfitsForClass4` | 102 | — |
| `allowances.annualInvestmentAllowance` | 49 | 23 |
| `allowances.capitalAllowanceMainPool` | 50 | — |
| `allowances.capitalAllowanceSpecialRatePool` | 51 | — |
| `allowances.capitalAllowanceSingleAssetPool` | 50 or 51 | — |
| `allowances.zeroEmissionsCarAllowance` | 52.1 | 24.1 |
| `allowances.structuredBuildingAllowance[]` with `amount`, `firstYear.qualifyingDate`, `firstYear.qualifyingAmountExpenditure`, `building.name`, `building.number`, `building.postcode` | 53 | — |
| `allowances.enhancedStructuredBuildingAllowance[]` (same shape) | 53.1 | 25.2 |
| `allowances.enhancedCapitalAllowance` | 54 or 55 | — |
| `allowances.businessPremisesRenovationAllowance` | 55 | — |
| `allowances.firstYearAllowanceOnPlantAndMachinery` | 55 | — |
| `allowances.allowanceOnSales` | 56 | — |
| `allowances.tradingIncomeAllowance` | 16.1 | 10.1 |
| `nonFinancials.class4NicsExemptionReason` | 101 | 37 |

`tradingIncomeAllowance` is mutually exclusive with every other `allowances` field and with
itemised expenses, matching the SA103S notes rule.

The allowances and adjustments lists change by tax year. What moved:

| Field | 2023-24 and before | 2024-25 | 2025-26 | 2026-27 onwards |
| --- | --- | --- | --- | --- |
| `adjustments.overlapReliefUsed` (SA103F box 69) | yes | yes | yes | **gone** |
| `adjustments.transitionProfitAmount`, `transitionProfitAccelerationAmount` | no | **added** | yes | yes |
| `adjustments.adjustmentToProfitsForClass4` (box 102) | no | no | no | **added** |
| `allowances.zeroEmissionsGoodsVehicleAllowance` (box 52) | yes | yes | **gone** | gone |
| `allowances.electricChargePointAllowance` (box 54) | yes | yes | **gone** | gone |
| `allowances.firstYearAllowanceOnPlantAndMachinery` | no | no | no | **added** |

So a 2025-26 submission must not send `zeroEmissionsGoodsVehicleAllowance` or
`electricChargePointAllowance` even though SA103F still prints boxes 52 and 54, and
`adjustmentToProfitsForClass4` (box 102) is only accepted from 2026-27. The 2026-27 schema is
still marked `[Test only]` behind the `r21_adjustment_to_profits_for_class4_docs` flag, and
`firstYearAllowanceOnPlantAndMachinery` sits behind `r22_fya_docs`, so check availability
before relying on either.

### Boxes handled by other MTD APIs

| SA103F box | SA103S box | API | Field |
| --- | --- | --- | --- |
| 78 | 33 | Individual Losses | `typeOfLoss: self-employment`, `typeOfClaim: carry-sideways` |
| 81 | 38 | CIS Deductions | `periodData.deductionAmount` |
| 100 | 36 | Individuals Disclosures | `class2Nics.class2VoluntaryContributions` |

### Boxes with no API field at all

Business details (1 to 14), the whole balance sheet (83 to 99), box 79 (loss carried back),
box 73.4, and box 103. Every calculated box (31 where itemised, 46, 47, 48, 57, 61, 63, 64,
65, 73, 76, 77, 80) is marked "Not available. Calculated by HMRC". A books page can still show
those figures; it just cannot submit them.

The other relevant APIs for a filing phase are **Business Source Adjustable Summary (BSAS)**
v7.0, which produces the year-end statement and accepts accounting adjustments, and
**Business Income Source Summary (BISS)** v3.0, which retrieves the summary totals.

---

## 2026-27 changes

MTD for Income Tax started on 6 April 2026 for sole traders and landlords with qualifying
income over £50,000 in 2024-25. The threshold drops to £30,000 from 6 April 2027 (measured on
2025-26 income) and to £20,000 from 6 April 2028 (measured on 2026-27 income). Those in scope
now keep digital records and send a quarterly update for each self-employment and each
property business, on top of the annual return. The first quarterly update for the £50,000
cohort was due by 7 August 2026. Quarterly updates are cumulative summaries of income and
expenses, not tax returns, and one must be sent even for a quarter with no activity. The
quarterly update direction requires the same categories as Self Assessment: turnover and other
business income, then cost of goods bought for resale or goods used, construction industry
payments to subcontractors, wages salaries and other staff costs, car van and travel expenses,
rent rates power and insurance costs, repairs and maintenance of property and equipment, phone
fax stationery and other office costs, advertising, business entertainment costs, interest on
bank and other loans, bank credit card and other financial charges, accountancy legal and other
professional fees, and other business expenses. A person with turnover below the VAT
registration threshold (£90,000) may instead categorise records as just total income and total
expenses, which is the API's `consolidatedExpenses` route. Basis periods are already aligned to
the tax year, so from 2024-25 onward every sole trader reports the 6 April to 5 April year and
SA103F box 68 exists only to apportion a non-March accounting date.

---

## Sources

All fetched 4 September 2026. Local PDF copies in `./hmrc/`.

**SA103S, Self-employment (short)**
- Publication page: https://www.gov.uk/government/publications/self-assessment-self-employment-short-sa103s
- Form 2026 (2025-26): https://assets.publishing.service.gov.uk/media/69c12ae013101e9908704a53/SA103S-2026.pdf
- Notes 2026: https://assets.publishing.service.gov.uk/media/69ce15395cf899414a0bc69f/SA103S_Notes_2026.pdf

**SA103F, Self-employment (full)**
- Publication page: https://www.gov.uk/government/publications/self-assessment-self-employment-full-sa103f
- Form 2026 (2025-26): https://assets.publishing.service.gov.uk/media/69c2635b13101e9908704b36/SA103F_2026.pdf
- Notes 2026: https://assets.publishing.service.gov.uk/media/69c26565cfa346b9d4704b35/SA103F_Notes_2026.pdf

**SA100 main return**
- Form 2026: https://assets.publishing.service.gov.uk/media/69c14d07cfa346b9d4704a8d/SA100-2026.pdf
- Forms index: https://www.gov.uk/self-assessment-tax-return-forms

**SA110 tax calculation summary**
- Publication page: https://www.gov.uk/government/publications/self-assessment-tax-calculation-summary-sa110
- Form 2026: https://assets.publishing.service.gov.uk/media/69c4fc1123fcbcd838a6f6e8/SA110-2026.pdf
- Notes 2026 (the working sheet): https://assets.publishing.service.gov.uk/media/69c4fc274a06660f0854422a/SA110-Notes-2026.pdf

**VAT return**
- VAT Notice 700/12, How to fill in and submit your VAT Return: https://www.gov.uk/guidance/how-to-fill-in-and-submit-your-vat-return-vat-notice-70012

**MTD for Income Tax**
- Check if you're eligible: https://www.gov.uk/guidance/check-if-youre-eligible-for-making-tax-digital-for-income-tax
- Use MTD for Income Tax, send quarterly updates: https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax/send-quarterly-updates
- Quarterly update direction: https://www.gov.uk/government/publications/update-notice-for-making-tax-digital-for-income-tax/making-tax-digital-for-income-tax-update-notice
- Digital record-keeping direction: https://www.gov.uk/government/publications/digital-record-keeping-notice-for-making-tax-digital-for-income-tax/making-tax-digital-for-income-tax-digital-record-keeping-notice

**MTD APIs**
- Self Employment Business (MTD) 5.0: https://developer.service.hmrc.gov.uk/api-documentation/docs/api/service/self-employment-business-api/5.0
- OpenAPI source and request examples: https://github.com/hmrc/self-employment-business-api/tree/main/resources/public/api/conf/5.0
- Annual submission JSON schemas by tax year: https://github.com/hmrc/self-employment-business-api/tree/main/resources/public/api/conf/5.0/schemas/createAmendAnnualSubmission
- Cumulative period summary JSON schema (2025-26 and after): https://github.com/hmrc/self-employment-business-api/blob/main/resources/public/api/conf/5.0/schemas/createAmendCumulativePeriodSummary/request.json
- Box-to-API mapping CSVs: https://github.com/hmrc/income-tax-mtd-changelog/blob/main/mapping/mapping-csv-files.md
- SA103 mapping file used here: https://raw.githubusercontent.com/hmrc/income-tax-mtd-changelog/main/mapping/csv/sa103f_mapping_v3.csv
- Business Source Adjustable Summary (MTD) 7.0: https://developer.service.hmrc.gov.uk/api-documentation/docs/api/service/self-assessment-bsas-api/7.0
- Business Income Source Summary (MTD) 3.0: https://developer.service.hmrc.gov.uk/api-documentation/docs/api/service/self-assessment-biss-api/3.0

No secondary sites were used for any box list. The VAT box headings and the MTD quarterly
category list were read through a summarising fetch of the gov.uk pages rather than from a
downloaded PDF, so those two are the only entries not transcribed from a primary file held
locally.
