<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->
<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->
The accuracy check in the Company Accounts package is Row 91 of the Trial Balance, and it should be zero. When it is not, an entry is missing, entered once instead of twice, or has replaced a formula. Work through the checks below in order. Each one narrows the difference.


**What the check does**
In the [Company Accounts](../products/company.html) package, the Trial Balance gathers every entry from sales, purchases and the bank workbooks. Row 91 shows the difference, and zero means the double entries agree. The package guide calls it the audit accuracy check.


**Check in this order**
1. Reconcile each bank workbook. In the Current Account, A3 holds the statement balance and A4 the reconciliation difference. A4 should be zero for every month before you look at the Trial Balance.
2. Check the opening balances. A company must enter its opening balance sheet at Financialaccounts, OpenAccounts, in Column E, with subtotals in Columns G to O, before it enters live transactions.
3. Check the opening fixed assets. Enter the original cost and the accumulated depreciation at OpenAccounts, then the details at Fixedassets, Schedule, in the existing fixed assets section.
4. Check that a transfer between two of your own accounts appears on both sides. The Current Account has transfer codes BS, BD and BC for savings, credit card and cash.
5. Check the dates. Enter dates as DD/MM/YY. A date such as 05.04.26 is not recognised.
6. Check the row limits. Sales and Purchases sum to Row 300, and the bank workbooks to Row 200. An entry below the limit is left out of the totals.


**Fixed assets and dividends**
Enter a fixed asset purchase on the Purchases workbook with code FA, then enter it again on Fixedassets, Schedule, in the New Assets section from Row 56. An asset on only one of them leaves a difference.

Enter the dividend you declare on Companysecretary, Boardmeeting. Enter the payment in the bank workbook with code DV. If the retained profit and the dividend figures differ, compare these two entries.


**Overwritten formulas**
Sales, Purchases and the bank workbooks are unprotected, so a typed figure replaces a formula. Compare the suspect cell with the same cell in a fresh download of the package. Copy the original formula back from that download.


**Self Employed**
The [Self Employed](../products/self-employed.html) package has a similar check for fixed assets. On Fixedassets, FAreconciliation, Row 15 is zero when every purchase and sale on the Schedule has been included.


**Still not zero**
Work down the list one month at a time. Enter a month, check the bank difference, then move on. A difference that appears in one month points at that month's entries. For linked files that show blanks, see [why linked workbooks show blank figures](linked-workbooks-show-blank-or-wrong-figures.html).
