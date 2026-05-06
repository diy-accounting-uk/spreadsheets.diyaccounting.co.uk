---
title: Payslip User Guide
---

# DIY Accounting Payslip Generator User Guide

The DIY Accounting payslip generator is designed for customers who would like a payslip generation facility but use a separate tax calculator such as HMRC's Basic PAYE Tools. For customers with a DIY Accounting business accounts system such as Self Employed or Company Accounts, the payslip generator feeds through into the business accounts via the Wages Interface sheet. A Payment sheet is included to track payments to HMRC.

Complete Employee details below and add calculated tax and wages to the monthly sheets (Apr, May, etc.), then switch to the Payslips sheet to generate payslips by selecting W (weekly) or M (monthly) and the week or month number.

It is strongly recommended that the payroll package is backed up at least once each week. Email the payroll workbook to your personal email address each week.

## Contents

- [Common Problems with Downloading](#common-problems-with-downloading)
- [Employee Details Worksheet](#employee-details-worksheet)
- [Weekly / Monthly Worksheets](#weekly--monthly-worksheets)
- [Payslips](#payslips)
- [Revenue Payments](#revenue-payments)
- [Statutory Payments](#statutory-payments)
- [Protection and Parameters](#protection-and-parameters)
- [Linking Payroll to Accounts](#linking-payroll-to-accounts)
- [Contact Information](#contact-information)

## Common Problems with Downloading

When downloading the files do not open the files before saving to your DIY Accounting folder. Opening a file first before saving creates temporary links between the files. If this temporary file is then saved the temporary links are also saved effectively breaking the links to the other files.

**TO AVOID THE PROBLEM: SAVE ALL FILES DIRECTLY TO THE PAYROLL OR ACCOUNTS FOLDER WITHOUT OPENING THE FILES FIRST**

## Employee Details Worksheet

### Business Details

A small section located at the top of the employee data sheet. Complete this section with the name and address of your business. These appear on the employee's payslips.

### Employee Details

The name and National Insurance number appear on the employee's payslips. The start and end date are used to calculate which employee's details appear on the monthly tax calculation sheets. The selection of monthly or weekly payments determines where on the monthly payroll sheets the employee name appears.

### Entering Employee Data

The details for each employee are recorded in sections each of which has been pre-allocated a fixed employee number. Do not change this number as the system uses the payroll number to locate the employee details in many areas of the system.

**Employee 01:**

| Cell | Entry |
|------|-------|
| **D15-D20** | Enter employee name |
| **D24** | Enter 06/04 of the current year for existing employees at the start of the financial year. Enter the actual starting date for new employees who join during the year. |
| **D26** | Enter the leaving date when an employee leaves |
| **D28** | Enter **W** if paid weekly or **M** if paid monthly. Always enter **M** for Directors. |
| **D29** | No Entry Required -- Employee Payroll Number is preset and fixed |
| **D30** | For limited company use only -- Enter **D** for directors |
| **M15** | Enter the employee's National Insurance number |

## Weekly / Monthly Worksheets

The worksheets on which to record the gross pay are in 12 monthly sections from Apr to Mar. Entries are required in each of the white cells and these should be obtained from your tax calculator such as HMRC's Basic PAYE Tools.

Select the month and scroll down to either the week (the last section on each sheet) or the month.

Enter the following:

| Item | Column | Notes |
|------|--------|-------|
| NIC Table | C | Letter code for National Insurance calculation (usually A) |
| Tax Code | D | The PAYE tax code (e.g. 1257L) |
| Statutory pay type | G | If sick pay or maternity pay has been paid, select the applicable code |
| Statutory pay amount | H | The amount of statutory pay |
| Basic hours | I | Only needed if basic wage is calculated from hours worked |
| Hourly rate | J | Only needed if basic wage is calculated from hours worked |
| Basic wages | K | Either calculated from hours x rate or entered directly |
| Overtime, Bonus or Gratuities | L | Additional pay on top of basic wages |
| Income Tax | N | PAYE tax deducted from gross wages -- obtain from tax calculator |
| Employees National Insurance | O | NI deducted from gross wages -- obtain from tax calculator |
| Student Loans | P | Any student loans deducted from gross wages |
| Other Deductions | Q | Any other deduction from gross pay |
| Employer's National Insurance | T | NI payments the employer is liable for -- obtain from tax calculator |

If an employee is employed in a particular week and their name does not appear then check the starting and leaving dates on the employee details as these control the appearance of an employee.

## Payslips

A single sheet is used to access payslips for each week by entering either W or M in cell F3 and by entering the week or month number in cell F4.

Payslips are automatically updated from the payroll workbook for both weekly paid and monthly paid employees.

Make all changes to payslips by changing the payroll file not the payslips file. Changing the payslips directly will overwrite formula.

Payslips contain all legal requirements including the Employer's name, Employee's name and details of all payments and deductions to be made for the pay period and year to date, showing the employees tax code and national insurance table letter.

## Revenue Payments

The revenue returns workbook contains a payments worksheet that automatically determines the HM Revenue & Customs liability for income tax and national insurance on a month by month basis.

Should statutory payments have been made during the year then these will also be collected and recorded on this record and deducted from the amount to be paid.

## Statutory Payments

Statutory payments are not calculated automatically by the program. These calculations can be input into HMRC's Basic PAYE Tools to calculate the amounts to be paid.

### Statutory Sick Pay

SSP is payable from the 4th day of sickness onwards with the 3 waiting days also taken into account when there are connected periods of sickness within 8 weeks. The daily rate is the weekly rate divided by the number of qualifying days in the week.

### Statutory Maternity Pay

Women expecting a baby are entitled to a maximum of 26 weeks SMP. The weekly amount payable is 90% of the employee's average weekly earnings for the first 6 weeks and 90% of average weekly earnings thereafter subject to a maximum of the current SMP limit.

### Statutory Paternity Pay

SPP is paid for a maximum of 2 weeks to qualifying employees.

### Statutory Adoption Pay

Employees adopting a child are entitled to 26 weeks SAP where their average weekly earnings exceed the threshold levels.

## Protection and Parameters

The payroll data entry spreadsheets have not been protected. A manual entry in any cell containing a formula will overwrite that formula. Only enter data in cells that do not contain formulae.

Create a back-up copy of your spreadsheets for use as a test model and also provide a source from which any formula driven cells subsequently overwritten may be replaced.

After all the transactions for an individual month have been completed, protect the worksheet to avoid inadvertent corruption of the information. In the case of sales and purchase spreadsheets protection also provides a Vat audit trail.

### Mending Broken Links

If the links between the spreadsheets become corrupted these can be automatically corrected by Excel. First unprotect any protected sheets in the workbook, then re-open the workbook. Click Update, then Click Edit Links. Highlight the links to be corrected and click the same file in your accounts folder.

## Linking Payroll to Accounts

The payroll software can be used stand alone or integrated into either the DIY Accounting Self Employed Accounting Software or the Company Software.

Each of the Accounting Software packages contain a payroll file. To integrate the payroll into the Accounting Software which would then automatically update wages costs, simply save the payroll software into the same folder as the DIY Accounting Accounting Software, overwriting the sample Payroll package provided.

## Contact Information

Our website is the first place to look for any information: http://www.diyaccounting.co.uk/

DIY Accounting's spreadsheet packages are maintained and supported under an Open Source model. In return for allowing anyone access to our source files, we find an indefinite low-cost home at GitHub.

Please raise a question in our discussion forum here: https://github.com/support-at-diyaccounting/spreadsheets.diyaccounting.co.uk/discussions

Or donate to help keep the packages updated here: https://www.paypal.com/donate/?hosted_button_id=XTEQ73HM52QQW
