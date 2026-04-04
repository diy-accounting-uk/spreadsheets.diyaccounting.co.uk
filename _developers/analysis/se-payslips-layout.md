# SE Payslips.xlsx Template Layout Analysis

Template: `app/templates/se/Payslips.xlsx`

## Sheet Names (16 sheets)

| Index | Sheet Name | Purpose |
|-------|-----------|---------|
| 1 | Employee | Employee details and business details data entry |
| 2 | Apr | April payroll (4 weekly + 1 monthly, 67 rows) |
| 3 | May | May payroll (4 weekly + 1 monthly, 67 rows) |
| 4 | Jun | June payroll (5 weekly + 1 monthly, 77 rows) |
| 5 | Jul | July payroll (4 weekly + 1 monthly, 67 rows) |
| 6 | Aug | August payroll (4 weekly + 1 monthly, 67 rows) |
| 7 | Sep | September payroll (5 weekly + 1 monthly, 77 rows) |
| 8 | Oct | October payroll (4 weekly + 1 monthly, 67 rows) |
| 9 | Nov | November payroll (4 weekly + 1 monthly, 67 rows) |
| 10 | Dec | December payroll (5 weekly + 1 monthly, 77 rows) |
| 11 | Jan | January payroll (4 weekly + 1 monthly, 67 rows) |
| 12 | Feb | February payroll (4 weekly + 1 monthly, 67 rows) |
| 13 | Mar | March payroll (6 weekly + 1 monthly, 87 rows) |
| 14 | Payslips | Payslip generator (lookup-based, reads from monthly sheets) |
| 15 | Payment | HMRC payment summary (12 months) |
| 16 | Admin | Date/week/month lookup table (366 days, rows 2-366) |

---

## 1. Employee Sheet Layout

### Business Details (rows 3-9)

| Cell | Merged Range | Label | Purpose | Data Entry |
|------|-------------|-------|---------|------------|
| D5 | D5:F5 | Business name | Employer/business name | YES |
| D6 | D6:F6 | Address line 1 | Business address | YES |
| D7 | D7:F7 | City | Business city | YES |
| D9 | (no merge) | Post code | Business postcode | YES |

Note: H5:O7 is also merged (used for instructions/guide text area).

### Employee 1 (rows 13-36)

**Header**: A13 = "EMPLOYEE DETAILS 01"

| Cell | Merged Range | Label (column A/C/I) | Purpose | Data Entry |
|------|-------------|----------------------|---------|------------|
| D15 | D15:F15 | Employee surname | Surname | YES |
| D16 | D16:F16 | Employee forename(s) | Forename(s) | YES |
| M15 | M15:O15 | National Insurance number | NI number | YES |
| D24 | (no merge) | Starting date | Employment start date (Excel serial date) | YES |
| D26 | (no merge) | All Week/Month/Basis | Leaving date (Excel serial date) | YES |
| D28 | (no merge) | Paid monthly or weekly? | "M" or "W" | YES |
| D29 | (no merge) | Payroll number | Employee payroll reference number | YES |
| D30 | (no merge) | Director flag / NIC category | "D" for director, or NIC table letter (A, B, etc.) | YES |
| F24 | (no merge) | Starting date (as date serial) | Start date for date-range checks | YES |
| F26 | (no merge) | Leaving date (as date serial) | Leaving date for date-range checks | YES |

**Optional bank details** (column C labels with "* Bank details are optional"):

| Cell | Label | Purpose | Data Entry |
|------|-------|---------|------------|
| D17 | *Account number | Employee bank account number | YES (optional) |
| D19 | *Bank name | Employee bank name | YES (optional) |
| D21 | *Sort code | Employee bank sort code | YES (optional) |

**Year-to-date / carry-forward cells** (referenced by monthly sheet formulas):

| Cell | Purpose | Data Entry |
|------|---------|------------|
| D34 | YTD gross wages carry-forward | YES (manual) |
| D35 | YTD income tax carry-forward | YES (manual) |
| H34 | YTD date marker (start period date) | YES (manual) |
| H35 | YTD date marker (monthly period) | YES (manual) |

### Employee 2 (rows 39-62)

**Header**: A39 = "EMPLOYEE DETAILS 02"

| Cell | Merged Range | Label | Purpose | Data Entry |
|------|-------------|-------|---------|------------|
| D41 | D41:F41 | Employee surname | Surname | YES |
| D42 | D42:F42 | Employee forename(s) | Forename(s) | YES |
| M41 | M41:O41 | National Insurance number | NI number | YES |
| D50 | (no merge) | Starting date | Employment start date | YES |
| D52 | (no merge) | Leaving date | Leaving date | YES |
| D54 | (no merge) | Paid monthly or weekly? | "M" or "W" | YES |
| D55 | (no merge) | Payroll number | Payroll reference | YES |
| D56 | (no merge) | Director flag / NIC | "D" or NIC letter | YES |
| F50 | (no merge) | Start date (serial) | Date-range check | YES |
| F52 | (no merge) | Leaving date (serial) | Date-range check | YES |
| D60 | (no merge) | YTD gross wages | Carry-forward | YES |
| D61 | (no merge) | YTD income tax | Carry-forward | YES |
| H60 | (no merge) | YTD date marker | Start period | YES |
| H61 | (no merge) | YTD date marker | Monthly period | YES |

### Employee 3 (rows 65-88)

**Header**: A65 = "EMPLOYEE DETAILS 03"

| Cell | Merged Range | Label | Purpose | Data Entry |
|------|-------------|-------|---------|------------|
| D67 | D67:F67 | Employee surname | Surname | YES |
| D68 | D68:F68 | Employee forename(s) | Forename(s) | YES |
| M67 | M67:O67 | National Insurance number | NI number | YES |
| D76 | (no merge) | Starting date | Start date | YES |
| D78 | (no merge) | Leaving date | Leaving date | YES |
| D80 | (no merge) | Paid monthly or weekly? | "M" or "W" | YES |
| D81 | (no merge) | Payroll number | Payroll reference | YES |
| D82 | (no merge) | Director flag / NIC | "D" or NIC letter | YES |
| F76 | (no merge) | Start date (serial) | Date-range check | YES |
| F78 | (no merge) | Leaving date (serial) | Date-range check | YES |
| D86 | (no merge) | YTD gross wages | Carry-forward | YES |
| D87 | (no merge) | YTD income tax | Carry-forward | YES |
| H86 | (no merge) | YTD date marker | Start period | YES |
| H87 | (no merge) | YTD date marker | Monthly period | YES |

### Employee 4 (rows 91-114)

**Header**: A91 = "EMPLOYEE DETAILS 04"

| Cell | Merged Range | Label | Purpose | Data Entry |
|------|-------------|-------|---------|------------|
| D93 | D93:F93 | Employee surname | Surname | YES |
| D94 | D94:F94 | Employee forename(s) | Forename(s) | YES |
| M93 | M93:O93 | National Insurance number | NI number | YES |
| D102 | (no merge) | Starting date | Start date | YES |
| D104 | (no merge) | Leaving date | Leaving date | YES |
| D106 | (no merge) | Paid monthly or weekly? | "M" or "W" | YES |
| D107 | (no merge) | Payroll number | Payroll reference | YES |
| D108 | (no merge) | Director flag / NIC | "D" or NIC letter | YES |
| F102 | (no merge) | Start date (serial) | Date-range check | YES |
| F104 | (no merge) | Leaving date (serial) | Date-range check | YES |
| D112 | (no merge) | YTD gross wages | Carry-forward | YES |
| D113 | (no merge) | YTD income tax | Carry-forward | YES |
| H112 | (no merge) | YTD date marker | Start period | YES |
| H113 | (no merge) | YTD date marker | Monthly period | YES |

### Employee 5 (rows 117-140)

**Header**: A117 = "EMPLOYEE DETAILS 05"

| Cell | Merged Range | Label | Purpose | Data Entry |
|------|-------------|-------|---------|------------|
| D119 | D119:F119 | Employee surname | Surname | YES |
| D120 | D120:F120 | Employee forename(s) | Forename(s) | YES |
| M119 | M119:O119 | National Insurance number | NI number | YES |
| D128 | (no merge) | Starting date | Start date | YES |
| D130 | (no merge) | Leaving date | Leaving date | YES |
| D132 | (no merge) | Paid monthly or weekly? | "M" or "W" | YES |
| D133 | (no merge) | Payroll number | Payroll reference | YES |
| D134 | (no merge) | Director flag / NIC | "D" or NIC letter | YES |
| F128 | (no merge) | Start date (serial) | Date-range check | YES |
| F130 | (no merge) | Leaving date (serial) | Date-range check | YES |
| D138 | (no merge) | YTD gross wages | Carry-forward | YES |
| D139 | (no merge) | YTD income tax | Carry-forward | YES |
| H138 | (no merge) | YTD date marker | Start period | YES |
| H139 | (no merge) | YTD date marker | Monthly period | YES |

### Employee Block Pattern (offset from block start row)

Each employee block is 26 rows. The pattern relative to the block header row:

| Offset | Employee 1 | Employee 2 | Employee 3 | Employee 4 | Employee 5 | Field |
|--------|-----------|-----------|-----------|-----------|-----------|-------|
| +0 | 13 | 39 | 65 | 91 | 117 | Section header |
| +2 | D15 | D41 | D67 | D93 | D119 | Surname |
| +3 | D16 | D42 | D68 | D94 | D120 | Forename(s) |
| +2 | M15 | M41 | M67 | M93 | M119 | NI Number |
| +11 | D24 | D50 | D76 | D102 | D128 | Start date |
| +13 | D26 | D52 | D78 | D104 | D130 | Leaving date |
| +11 | F24 | F50 | F76 | F102 | F128 | Start date (serial) |
| +13 | F26 | F52 | F78 | F104 | F130 | Leaving date (serial) |
| +15 | D28 | D54 | D80 | D106 | D132 | M/W (monthly/weekly) |
| +16 | D29 | D55 | D81 | D107 | D133 | Payroll number |
| +17 | D30 | D56 | D82 | D108 | D134 | Director/NIC flag |
| +21 | D34 | D60 | D86 | D112 | D138 | YTD gross wages |
| +22 | D35 | D61 | D87 | D113 | D139 | YTD income tax |
| +21 | H34 | H60 | H86 | H112 | H138 | YTD date (start) |
| +22 | H35 | H61 | H87 | H113 | H139 | YTD date (monthly) |

**Maximum employees: 5**

---

## 2. Monthly Sheets (Apr-Mar) Layout

Each month sheet has up to two payroll sections:
- **Weekly payroll**: up to 4 or 5 weekly sections (rows 8-46), each with 5 employee rows
- **Monthly payroll**: 1 section (rows 48-56), with 5 employee rows

### Weekly Section Structure (example: Apr, Week 1 = rows 8-16)

Header rows: 8-9 (date info, week number)
Data rows: 11-15 (one row per employee, Employee 1-5)
Total row: 16

**Column headers (row 3)**:

| Column | Header (row 3) | Description |
|--------|----------------|-------------|
| B | (no header, merged B3:B6) | Director flag ("D") -- not in row 3 headers |
| C | NIC Table | NI category letter (A, B, etc.) |
| D | Tax Code | Employee tax code |
| E | Pay No | Payroll reference number |
| F | Employee Name | Employee surname |
| G | SSP | Statutory pay type indicator ("SSP"/"SMP"/"SPP"/"SAP") |
| H | Statutory Pay Recovered | Statutory pay amount |
| I | Basic hours | Hours worked |
| J | Hourly rate | Pay rate per hour |
| K | Basic wages | Calculated: I * J |
| L | Overtime Bonus Gratuities | Additional pay |
| M | GROSS WAGES | Total gross (formula: H + K + L) |
| N | Income Tax | PAYE tax deducted |
| O | Employees National Insurance | Employee NI deducted |
| P | Amount Due Income Tax | Student loan deduction (label misleading) |
| Q | Other Deductions | Other deductions |
| R | NET PAY | Net pay (formula: M - N - O - P - Q) |
| S | Employers National Insurance | Employer NI contribution (ssi=27) |
| T | (no explicit header) | Employer NI (separate column, summed to T1) |

**Weekly data entry cells per employee (e.g. Employee 1, Week 1 = row 11)**:

| Cell | Column Header | Auto/Manual | Source |
|------|--------------|-------------|--------|
| B11 | Director flag | FORMULA | `=Employee!D$30` (director indicator) |
| C11 | NIC Table | DATA ENTRY (val=107, acts as placeholder) | Manual entry |
| D11 | Tax Code | NOT IN XML | Manual entry |
| E11 | Pay No | FORMULA | `=IF(Employee!D$28="m"," ",...Employee!D$29)` |
| F11 | Employee Name | FORMULA | `=IF(E11=" "," ",...Employee!D$15)` |
| G11 | SSP/SMP/SPP/SAP | DATA ENTRY | Manual: enter "SSP", "SMP", "SPP", or "SAP" |
| H11 | Statutory Pay | NOT IN XML | Manual entry (statutory pay amount) |
| I11 | Basic hours | DATA ENTRY | Manual entry |
| J11 | Hourly rate | DATA ENTRY | Manual entry |
| K11 | Basic wages | FORMULA | `=I11*J11` |
| L11 | Overtime/Bonus | DATA ENTRY | Manual entry |
| M11 | GROSS WAGES | FORMULA | `=IF(E11=" "," ",IF((H11+K11+L11)>0,H11+K11+L11," "))` |
| N11 | Income Tax | DATA ENTRY | Manual entry (PAYE amount) |
| O11 | Employee NI | DATA ENTRY | Manual entry |
| P11 | Student Loan | DATA ENTRY | Manual entry |
| Q11 | Other Deductions | DATA ENTRY | Manual entry |
| R11 | NET PAY | FORMULA | `=IF(M11=" "," ",IF(M11=0," ",M11-SUM(N11:Q11)))` |
| S11 | Employer NI | DATA ENTRY | Manual entry |
| T11 | Employer NI | NOT IN XML | Manual entry |

**Weekly section rows per block (10-row pattern, repeating every 10 rows):**
- Week 1: header row 9, data rows 11-15, total row 16
- Week 2: header row 19, data rows 21-25, total row 26
- Week 3: header row 29, data rows 31-35, total row 36
- Week 4: header row 39, data rows 41-45, total row 46
- Week 5 (Jun/Sep/Dec only): header row 49, data rows 51-55, total row 56
- Week 6 (Mar only): header row 59, data rows 61-65, total row 66

Employee rows within each weekly block: row offset +2 through +6 from header.
- Employee 1 = header + 2
- Employee 2 = header + 3
- Employee 3 = header + 4
- Employee 4 = header + 5
- Employee 5 = header + 6

### Monthly Section Structure

The monthly section starts after the last weekly section:
- 4-week months (Apr/May/Jul/Aug/Oct/Nov/Jan/Feb): header row 49, data rows 51-55, total row 56
- 5-week months (Jun/Sep/Dec): header row 59, data rows 61-65, total row 66
- 6-week month (Mar): header row 69, data rows 71-75, total row 76

**Monthly data entry cells (same columns as weekly)**:

| Cell | Purpose | Auto/Manual |
|------|---------|-------------|
| E51 | Pay No | FORMULA (checks D$28="w" to exclude weekly employees) |
| F51 | Employee Name | FORMULA |
| G51 | SSP type | DATA ENTRY |
| H51 | Statutory Pay | NOT IN XML |
| I51 | Basic hours | DATA ENTRY |
| J51 | Hourly rate | DATA ENTRY |
| K51 | Basic wages | FORMULA (=I51*J51) |
| L51 | Overtime/Bonus | DATA ENTRY |
| M51 | GROSS WAGES | FORMULA |
| N51 | Income Tax | DATA ENTRY |
| O51 | Employee NI | DATA ENTRY |
| P51 | Student Loan | DATA ENTRY |
| Q51 | Other Deductions | DATA ENTRY |
| R51 | NET PAY | FORMULA |
| S51 | Employer NI | DATA ENTRY |
| T51 | Employer NI | NOT IN XML |

### Monthly Totals (Row 1-2)

Row 1 contains the monthly totals that are read by the Wagesinterface sheet in Financialaccounts.xlsx. Key cells:

**Shared formula group (M1:R1, si="0")** -- pattern: `col16 + col26 + col36 + col46 + col56`:

| Cell | Formula | Purpose |
|------|---------|---------|
| G1 | `=SUM(AD60:AG60)+SUM(AE62:AG62)` | Total statutory pay recovered |
| M1 | `=M16+M26+M36+M46+M56` | **Total gross wages** (shared formula master) |
| N1 | `=N16+N26+N36+N46+N56` | **Total income tax** (shared ref si=0) |
| O1 | `=O16+O26+O36+O46+O56` | **Total employee NI** (shared ref si=0) |
| P1 | `=P16+P26+P36+P46+P56` | **Total student loan** (shared ref si=0) |
| Q1 | `=Q16+Q26+Q36+Q46+Q56` | **Total other deductions** (shared ref si=0) |
| R1 | `=R16+R26+R36+R46+R56` | **Total net pay** (shared ref si=0) |
| T1 | `=T16+T26+T36+T46+T56` | **Total employer NI** |

**Other row 1-2 cells:**

| Cell | Formula | Purpose |
|------|---------|---------|
| J1 | `=M16+M26+M36+M46+M56` | Gross wages (duplicate of M1, different merge area) |
| J2 | `=M65` | Director gross wages |
| N2 | `=N65` | Director income tax |
| S1 | (empty, style only) | Unused |

**IMPORTANT for shared formula parsing**: M1:R1 use XML `<f t="shared" ref="M1:R1" si="0">`. Only M1 contains the explicit formula text. N1-R1 have `<f t="shared" si="0"/>` -- the formula must be derived by shifting the column reference from the master cell M1.

### Year-to-Date Columns (U-AA)

| Column | Purpose |
|--------|---------|
| U | YTD Gross wages |
| V | (intermediate calc) |
| W | YTD Income tax |
| X | YTD Employee NI |
| Y | YTD Student loan |
| Z | YTD Other deductions |
| AA | YTD Net pay |

### Statutory Pay Recovery Columns (AD-AG)

| Column | Purpose |
|--------|---------|
| AD | SSP recovered |
| AE | SMP recovered |
| AF | SPP recovered |
| AG | SAP recovered |

### Director Wages Section (rows 59-65)

Rows 59-65 handle director wages separately, with formulas checking `IF(B51="D",...)` to extract director-only amounts.

---

## 3. Payslips Sheet Layout

The Payslips sheet is a **payslip generator** that uses INDIRECT formulas to dynamically look up data from any monthly sheet based on user selections.

**User input cells:**
| Cell | Purpose | Values |
|------|---------|--------|
| F3 | Weekly or Monthly | "W" or "M" |
| F4 | Week/Month number | 1-53 (weekly) or 1-12 (monthly) |

**How it works:**
- H3 = `LOOKUP(F4, Admin!C/D columns, Admin!A column)` - resolves to the month sheet name (e.g. "Apr")
- H4 = calculated start row in that month sheet
- All payslip fields use `INDIRECT($H$3 & "!col" & $H$4 + offset)` to read from the correct row

**Employee data displayed on payslips (5 payslip blocks, one per employee):**

| Payslip Field | Source Cell | Employee Sheet Reference |
|--------------|------------|-------------------------|
| Business name | J4 | Employee!$D$5 |
| Employee surname | C7 | Employee!$D$15 (Emp1), $D$41 (Emp2), etc. |
| Employee forename | H7 | Employee!$D$16 (Emp1), $D$42 (Emp2), etc. |
| Address | M7 | Employee!$D$6 |
| City | N8 | Employee!$D$7 |
| Postcode | C9 | Employee!$D$9 |
| NI number | M9 | Employee!$M$15 (Emp1), $M$41 (Emp2), etc. |
| Payroll number | C10 | Employee!$D$29 (Emp1), $D$55 (Emp2), etc. |

Payslip blocks for employees 2-5 start at rows 19, 33, 47, 61 respectively.

---

## 4. Payment Sheet Layout

The Payment sheet shows the monthly HMRC payment summary for 12 months.

**Column headers (row 2):**
| Column | Header | Source |
|--------|--------|--------|
| C | Total Amount Payable | Date from Admin |
| D | Payment Date | Employer NI + Employee NI from month sheet |
| E | Payment Method | Income Tax from month sheet |
| F | Amount Paid | Statutory pay recovered |
| G | Amount Outstanding | SMP/SPP/SAP recovery |
| H | NI reduction (mariners) | Student loan from month sheet |
| I | Employees | Calculated total payable |

**Monthly rows (4-15, one per month Apr-Mar):**

| Row | Month | Key Formula Pattern |
|-----|-------|-------------------|
| 4 | Apr | D4=`Apr!T1+Apr!O1`, E4=`Apr!N1`, F4=`Apr!AD60+AE60+AF60+AG60` |
| 5 | May | Same pattern for May |
| ... | ... | ... |
| 15 | Mar | Same pattern for Mar |

**Payment data entry cells per row:**
| Cell | Purpose | Auto/Manual |
|------|---------|-------------|
| C(row) | Payment due date | FORMULA (from Admin) |
| D(row) | Total NI due | FORMULA |
| E(row) | Income tax due | FORMULA |
| F(row) | Statutory pay recovered | FORMULA |
| G(row) | Statutory NIC compensation | FORMULA |
| H(row) | Student loan deductions | FORMULA |
| I(row) | Total payable (= D+E-F-G+H) | FORMULA |
| L(row) | Amount paid | DATA ENTRY |
| N(row) | Amount outstanding | FORMULA (= I - L running total) |

---

## 5. Admin Sheet Layout

The Admin sheet is primarily a **date lookup table** for 366 days of the tax year.

### Column Structure (rows 1-381)

| Column | Header | Content |
|--------|--------|---------|
| A | M | Month code ("Apr", "May", etc.) |
| B | Date | Excel serial date (45753 = 06/04/2025 through 46117 = 05/04/2026) |
| C | Week number | Tax week (1-53) |
| D | Month number | Tax month (1-12) |
| E | D | Director week number |
| F | W | Week-within-month counter |
| G | Directors | Month name or director-related data |

### Key Reference Cells

| Cell | Formula | Value | Purpose |
|------|---------|-------|---------|
| B2 | (static) | 45753 | Tax year start date (06/04/2025) |
| I1 | `=B366` | 46117 | Tax year end date (05/04/2026) |
| H1 | `=B366` | 46117 | Tax year end date (duplicate) |
| J1 | `=TEXT(YEAR(I1)-1,"0") & "-" & TEXT(YEAR(I1)-2000,"0")` | "2025-26" | Tax year string |

### Tax Data Injected

The Admin sheet does NOT contain NI thresholds or tax rate tables directly. It is purely a date/week/month calendar lookup table. Tax calculations (PAYE, NI) are performed manually by the user and entered into the monthly sheets.

The LOOKUP formulas in the Employee sheet (e.g. `LOOKUP(D24, Admin!B:B, Admin!C:C)`) convert dates to week numbers and month numbers for payroll period identification.

### Month Boundary Rows

| Row Range | Month | Key Rows |
|-----------|-------|----------|
| 2-31 | Apr (Month 1) | B26=45777 (last day of Apr period) |
| 32-62 | May (Month 2) | |
| ... | ... | |
| 341-381 | Mar (Month 12) | B381=46132 |

---

## 6. Wagesinterface (Financialaccounts.xlsx) - External Link Analysis

The Wagesinterface sheet in `app/templates/se/Financialaccounts.xlsx` reads payroll totals from Payslips.xlsx via external link `[6]`.

### External Link Reference

External link 6 points to: `Payslips.xlsx` (same directory)

### Wagesinterface Column Layout

| Column | Header (row 2) | Content |
|--------|----------------|---------|
| C | Gross Wages paid | Monthly gross wages from Payslips |
| D | Income Tax deducted | Monthly PAYE from Payslips |
| E | Employees National Insurance deducted | Monthly employee NI from Payslips |
| F | Other Deductions | Student loan + other deductions from Payslips |
| G | Net Wages Paid | Calculated: C - (D + E + F) |
| H | Employers National Insurance | Monthly employer NI from Payslips |
| I | Recoverable Statutory Payments | Statutory pay recovered from Payslips |

### External Link Formulas (rows 4-15, one per month)

| Row | Month | C (Gross) | D (Tax) | E (Emp NI) | F (Deductions) | G (Net) | H (Er NI) | I (Stat Pay) |
|-----|-------|-----------|---------|------------|----------------|---------|-----------|-------------|
| 4 | Apr | `[6]Apr!$M$1` | `[6]Apr!$N$1` | `[6]Apr!$O$1` | `[6]Apr!$P$1+[6]Apr!$Q$1` | `C4-SUM(D4:F4)` | `[6]Apr!$T$1` | `[6]Apr!$G$1` |
| 5 | May | `[6]May!$M$1` | `[6]May!$N$1` | `[6]May!$O$1` | `[6]May!$P$1+[6]May!$Q$1` | `C5-SUM(D5:F5)` | `[6]May!$T$1` | `[6]May!$G$1` |
| 6 | Jun | `[6]Jun!$M$1` | `[6]Jun!$N$1` | `[6]Jun!$O$1` | `[6]Jun!$P$1+[6]Jun!$Q$1` | local calc | `[6]Jun!$T$1` | `[6]Jun!$G$1` |
| 7 | Jul | `[6]Jul!$M$1` | `[6]Jul!$N$1` | `[6]Jul!$O$1` | `[6]Jul!$P$1+[6]Jul!$Q$1` | local calc | `[6]Jul!$T$1` | `[6]Jul!$G$1` |
| 8 | Aug | `[6]Aug!$M$1` | `[6]Aug!$N$1` | `[6]Aug!$O$1` | `[6]Aug!$P$1+[6]Aug!$Q$1` | local calc | `[6]Aug!$T$1` | `[6]Aug!$G$1` |
| 9 | Sep | `[6]Sep!$M$1` | `[6]Sep!$N$1` | `[6]Sep!$O$1` | `[6]Sep!$P$1+[6]Sep!$Q$1` | local calc | `[6]Sep!$T$1` | `[6]Sep!$G$1` |
| 10 | Oct | `[6]Oct!$M$1` | `[6]Oct!$N$1` | `[6]Oct!$O$1` | `[6]Oct!$P$1+[6]Oct!$Q$1` | local calc | `[6]Oct!$T$1` | `[6]Oct!$G$1` |
| 11 | Nov | `[6]Nov!$M$1` | `[6]Nov!$N$1` | `[6]Nov!$O$1` | `[6]Nov!$P$1+[6]Nov!$Q$1` | local calc | `[6]Nov!$T$1` | `[6]Nov!$G$1` |
| 12 | Dec | `[6]Dec!$M$1` | `[6]Dec!$N$1` | `[6]Dec!$O$1` | `[6]Dec!$P$1+[6]Dec!$Q$1` | local calc | `[6]Dec!$T$1` | `[6]Dec!$G$1` |
| 13 | Jan | `[6]Jan!$M$1` | `[6]Jan!$N$1` | `[6]Jan!$O$1` | `[6]Jan!$P$1+[6]Jan!$Q$1` | local calc | `[6]Jan!$T$1` | `[6]Jan!$G$1` |
| 14 | Feb | `[6]Feb!$M$1` | `[6]Feb!$N$1` | `[6]Feb!$O$1` | `[6]Feb!$P$1+[6]Feb!$Q$1` | local calc | `[6]Feb!$T$1` | `[6]Feb!$G$1` |
| 15 | Mar | `[6]Mar!$M$1` | `[6]Mar!$N$1` | `[6]Mar!$O$1` | `[6]Mar!$P$1+[6]Mar!$Q$1` | local calc | `[6]Mar!$T$1` | `[6]Mar!$G$1` |

### Summary of External Link Cell References

The Wagesinterface reads these cells from each monthly sheet in Payslips.xlsx:

| Cell | Monthly Sheet | Purpose |
|------|--------------|---------|
| `$G$1` | Row 1, col G | Statutory pay recovered (`=SUM(AD60:AG60)+SUM(AE62:AG62)`) |
| `$M$1` | Row 1, col M | Total gross wages (`=M16+M26+M36+M46+M56`) -- shared formula master |
| `$N$1` | Row 1, col N | Total income tax (`=N16+N26+N36+N46+N56`) -- shared formula si=0 |
| `$O$1` | Row 1, col O | Total employee NI (`=O16+O26+O36+O46+O56`) -- shared formula si=0 |
| `$P$1` | Row 1, col P | Total student loan (`=P16+P26+P36+P46+P56`) -- shared formula si=0 |
| `$Q$1` | Row 1, col Q | Total other deductions (`=Q16+Q26+Q36+Q46+Q56`) -- shared formula si=0 |
| `$T$1` | Row 1, col T | Total employer NI (`=T16+T26+T36+T46+T56`) |

**Row 1 formulas on each monthly sheet** (shared formula group si="0", M1:R1):

| Cell | Formula Pattern | Purpose |
|------|----------------|---------|
| G1 | `=SUM(AD60:AG60)+SUM(AE62:AG62)` | Total statutory pay recovered |
| M1 | `=M16+M26+M36+M46+M56` | Total gross wages (all sections) |
| N1 | `=N16+N26+N36+N46+N56` | Total income tax |
| O1 | `=O16+O26+O36+O46+O56` | Total employee NI |
| P1 | `=P16+P26+P36+P46+P56` | Total student loan deductions |
| Q1 | `=Q16+Q26+Q36+Q46+Q56` | Total other deductions |
| R1 | `=R16+R26+R36+R46+R56` | Total net pay |
| T1 | `=T16+T26+T36+T46+T56` | Total employer NI |

Note: M1:R1 use `<f t="shared">` XML format, which means a simple cell parser that only looks for `<f>text</f>` will miss the formula on N1-R1 (only M1 has the explicit formula text as the shared formula master; N1-R1 reference `si="0"`).

---

## cellWrites() Reference for SE Product Module

### Employee Sheet - Business Details

```javascript
{ sheet: 'Employee', cell: 'D5', value: businessName }       // Business name
{ sheet: 'Employee', cell: 'D6', value: addressLine1 }       // Address line 1
{ sheet: 'Employee', cell: 'D7', value: city }                // City
{ sheet: 'Employee', cell: 'D9', value: postcode }            // Post code
```

### Employee Sheet - Per Employee (Employee 1 example)

```javascript
{ sheet: 'Employee', cell: 'D15', value: surname }            // Employee surname
{ sheet: 'Employee', cell: 'D16', value: forename }           // Employee forename(s)
{ sheet: 'Employee', cell: 'M15', value: niNumber }           // NI number
{ sheet: 'Employee', cell: 'D24', value: startDate }          // Start date (Excel serial)
{ sheet: 'Employee', cell: 'F24', value: startDate }          // Start date (for range checks)
{ sheet: 'Employee', cell: 'D26', value: leavingDate }        // Leaving date (Excel serial)
{ sheet: 'Employee', cell: 'F26', value: leavingDate }        // Leaving date (for range checks)
{ sheet: 'Employee', cell: 'D28', value: 'M' }               // Monthly or Weekly ('M' or 'W')
{ sheet: 'Employee', cell: 'D29', value: payrollNumber }      // Payroll reference number
{ sheet: 'Employee', cell: 'D30', value: directorFlag }       // 'D' for director or NIC letter
```

### Employee Sheet - All 5 Employees Cell Map

| Field | Emp 1 | Emp 2 | Emp 3 | Emp 4 | Emp 5 |
|-------|-------|-------|-------|-------|-------|
| Surname | D15 | D41 | D67 | D93 | D119 |
| Forename | D16 | D42 | D68 | D94 | D120 |
| NI Number | M15 | M41 | M67 | M93 | M119 |
| Start Date | D24, F24 | D50, F50 | D76, F76 | D102, F102 | D128, F128 |
| Leaving Date | D26, F26 | D52, F52 | D78, F78 | D104, F104 | D130, F130 |
| Monthly/Weekly | D28 | D54 | D80 | D106 | D132 |
| Payroll Number | D29 | D55 | D81 | D107 | D133 |
| Director/NIC | D30 | D56 | D82 | D108 | D134 |
| YTD Gross | D34 | D60 | D86 | D112 | D138 |
| YTD Tax | D35 | D61 | D87 | D113 | D139 |
| YTD Date 1 | H34 | H60 | H86 | H112 | H138 |
| YTD Date 2 | H35 | H61 | H87 | H113 | H139 |

### Monthly Sheet - Per Employee Per Period (data entry cells)

For each monthly sheet (Apr-Mar), within each weekly or monthly section:

```javascript
// Weekly section: employee row = section_start + 2 + employee_index (0-4)
// Monthly section: employee row = 51 + employee_index (0-4)
// Columns that need data entry:
{ sheet: monthName, cell: `G${row}`, value: sspType }          // 'SSP'/'SMP'/'SPP'/'SAP' or empty
{ sheet: monthName, cell: `H${row}`, value: statutoryPay }     // Statutory pay amount
{ sheet: monthName, cell: `I${row}`, value: basicHours }       // Basic hours
{ sheet: monthName, cell: `J${row}`, value: hourlyRate }       // Hourly rate
{ sheet: monthName, cell: `L${row}`, value: overtimeBonus }    // Overtime/bonus
{ sheet: monthName, cell: `N${row}`, value: incomeTax }        // PAYE income tax
{ sheet: monthName, cell: `O${row}`, value: employeeNI }       // Employee NI
{ sheet: monthName, cell: `P${row}`, value: studentLoan }      // Student loan
{ sheet: monthName, cell: `Q${row}`, value: otherDeductions }  // Other deductions
{ sheet: monthName, cell: `S${row}`, value: employerNI }       // Employer NI
{ sheet: monthName, cell: `T${row}`, value: employerNI2 }      // Employer NI (alt column)
```

### Admin Sheet - Tax Year Data

The Admin sheet contains the date calendar for the tax year. Key cells to write:

```javascript
{ sheet: 'Admin', cell: 'B2', value: taxYearStartDate }       // Tax year start (Excel serial for 06/04/YYYY)
// Rows 3-381 follow with B(n) = B(n-1) + 1 (formula), C/D/E = week/month lookups
```

The Admin sheet is primarily formula-driven from B2. Changing B2 cascades through the entire calendar.
