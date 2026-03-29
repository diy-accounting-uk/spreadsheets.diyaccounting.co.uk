# DIY Accounting Basic Sole Trader User Guide

Thank you for using DIY Accounting as your accounting system.

Entering the data is no more complicated than entering your financial information in 2 lists:

- Enter sales receipts on the sales spreadsheet.
- Enter purchases on the purchase spreadsheet.

The spreadsheets were designed from the standard accounting format used for existing clients to make financial transactions fast, easy to enter and understand. Formula driven so that minimum data is entered with automated analysis producing monthly profit & loss accounts, live debtor and creditor reports, self-assessment tax returns.

## Contents

- [Getting Started](#getting-started)
- [Preparing to Get Started](#preparing-to-get-started)
- [Protection and Parameters](#protection-and-parameters)
- [Sales Spreadsheet](#sales-spreadsheet)
- [Purchases Spreadsheet](#purchases-spreadsheet)
- [Stock](#stock)
- [Bank Account Transactions](#bank-account-transactions)
- [Financial Accounts](#financial-accounts)
- [Taxation](#taxation)
- [Contact Information](#contact-information)
- [Glossary: Purchase Column Headings](#glossary-purchase-column-headings)

## Getting Started

This section details the steps required to install and run DIY Accounting Basic Sole Trader.

### Download and Install

1. Go to the download page on the DIY Accounting website.
2. Download the package for your version of Excel.
3. Save the zip file to a location on your computer, ideally in your Documents folder.
4. Extract the contents of the zip file to a new folder by right clicking on the zip file and selecting "Extract All".
5. Open the extracted folder — you will find the spreadsheet file and this guide.

### Open the Spreadsheet

1. Open the financial accounts spreadsheet file.
2. If prompted about macros or protected view, click "Enable Editing" and/or "Enable Content".
3. The **Home** sheet provides navigation links to all worksheets.
4. Click any link on the Home sheet to navigate to that worksheet.

### First Sales and Purchases

To get started with your first month of accounting:

1. Navigate to the **SalesApr** sheet (or the first month of your tax year).
2. Enter your sales transactions following the column guide below.
3. Navigate to the **PurchasesApr** sheet.
4. Enter your purchase transactions following the column guide below.
5. Check the **Profit & Loss Acc** sheet — your entries should appear automatically.

### First Stocktake

If your business carries physical stock, go to the **PurchasesStock** sheet and enter your opening stock value. See the [Stock](#stock) section for details.

### Month End

At the end of each month:

1. Review your bank statements and ensure all transactions are recorded.
2. Check the **Debtors & Creditors** sheet for outstanding amounts.
3. Review the **Profit & Loss Acc** sheet for the monthly result.
4. Protect completed monthly sheets to prevent accidental changes.

## Preparing to Get Started

Before starting entries to the worksheets there is a small amount of customisation to be carried out in relation to updating of accounting information from your previous accounting year if applicable.

### Fixed Assets

The fixed asset schedule is located on the financial accounts spreadsheet. Where the business has fixed assets acquired prior to the start of the financial year that have been subject to capital tax allowances the fixed asset schedule should be updated.

In the first section of the fixed assets schedule (assets existing at the start of the tax year) record assets purchased prior to the tax year start showing the asset description, purchase invoice details, location (optional) and the date purchased.

Enter the net written down value after previous tax allowances have been claimed. This is not the depreciated value of the asset — it is the value of the asset for which capital allowances have not yet been claimed.

If a vehicle is also used for personal in addition to business purposes then enter the percentage of private use based upon mileage covered in column M. This "private use percentage" has the effect of reducing the level of capital allowances claimed by the percentage entered in column M.

## Protection and Parameters

### Worksheet Protection

Financial Accounts spreadsheets are protected to preserve the formulae. With the exception of the Admin sheet a protection password was not used.

To unprotect a sheet, go to the menu bar:

- Click **Tools > Protection > Unprotect Sheet** (or **Review > Unprotect Sheet** in modern Excel)

The financial accounts Admin sheet contains the tax rules and dates for the financial year and is password protected to preserve those rules and avoid corruption. The password is not provided because no changes or entries are required to the Admin sheet.

The data entry spreadsheets Sales and Purchases have not been protected. A manual entry in any cell containing a formula will overwrite that formula. Only enter data in cells that do not contain formulae.

Create a back-up copy of your spreadsheets for use as a test model and also provide a source from which any formula driven cells subsequently overwritten may be replaced.

### Formulae Parameters

Preset formulae have been entered in both the sales and purchase spreadsheets down to row 204. This allows up to 200 sales and purchase transactions to be entered and analysed which is sufficient for most small and medium sized businesses.

If the number of sales or purchase transactions exceeds 200 in any month the formulae will require extending to the additional rows used. To extend the formula driven cells click each formula bearing cell in the row, place the cursor on the bottom right hand corner of the cell, a + appears, click and drag the + down to the required row number. Note do NOT click and drag formula cells ACROSS the page as this destroys the formulae.

### Column Totals

There is no need to change the formula in row 1 which totals each column as this has been preset on both the sales and purchase spreadsheets to add up all cells in each column down to row 999.

### Printing Parameters

Printing areas of the sales and purchase spreadsheets have been restricted to the first 68 rows. This prevents many sheets of blank pages being printed if rows below 68 are not used.

To change the printing area to suit your own requirements:

- Go to the menu option: Click **File > Page setup > Sheet**
- In the "Print area" box delete 68 and enter the number of rows to be printed

## Sales Spreadsheet

Transactions to be recorded are from the start to the end of the tax year. Record transactions 1–5 April in March.

### Data Entry

The columns for entering details of your sales are A–G (Plus L and M in respect of sub contractors only).

- **Column A** — Enter the date of the sales transaction
- **Column B** — Enter the customer name or source of sale e.g. a retail business with 2 shops might wish to simply record Shop A or Shop B
- **Column C** — Enter your reference number of the transaction or sales invoice number
- **Column D** — Enter the method of payment the customer used to pay for the goods or service. Complete this column only when the money from the sales source has been received
- **Column E** — Enter the mileage incurred in connection with the sale. Should a "sales mileage" be completed without a sale enter the date and nature of the journey on a separate line. Note you may only claim mileage allowances if you are not claiming motoring costs such as the vehicle cost, repairs, tax, insurance, or fuel. If you wish to claim vehicle expenses leave this column blank
- **Column F** — Enter the gross sales value of the transaction
- **Column G** — Enter other income such as business start up grants. Note do not include any amounts recorded in this column in column F as they do not form part of business turnover and are accounted for separately on the self assessment tax return
- **Column J** — Sub contractors only: enter income tax deducted by contractors on CIS certificate
- **Column K** — Sub contractors only: enter reference number from CIS certificate

### Formulae Driven Automated Columns

No entries required in these columns:

- **Column H** — Unpaid sales automatically shown if column D is left blank
- **Column I** — Number of day's unpaid automatically produced if unpaid sales in column K

### What Happens to the Information Entered?

Row 1 totals each column down to row 300. The totals of each sheet are then collected by the financial accounting spreadsheet to produce the monthly profit and loss account and self assessment tax return. The sales mileage if recorded is also automatically transferred to the purchases spreadsheet which adds the sales mileage to the purchase mileage and calculates the mileage allowance.

## Purchases Spreadsheet

Transactions to be recorded are from the start to the end of the tax year. Record transactions 1–5 April in March.

### Data Entry

The columns for entering details of your purchases are A–G and AA.

- **Column A** — Enter the date of the purchase transaction
- **Column B** — Enter the supplier's name or source of purchase
- **Column C** — Enter your reference number of the transaction or purchase invoice number
- **Column D** — Enter the method of payment used to pay the supplier for the goods or service. Complete this column only when the transaction is paid for
- **Column E** — Enter a single letter to identify the type of expenditure in the expense code column to automatically update the expense analysis. Eligible letters and definitions of column headings are shown in glossary of column headings and can be automatically entered by clicking the correct letter from the drop down boxes contained in the purchase column E for your convenience. Entry of this expense code is mandatory, if omitted Cell E1 will display the total value of the error as will row 3 of the profit and loss account
- **Column F** — Enter the mileage incurred in connection with the purchase. Should a journey be completed without a purchase enter the date and nature of the journey on a separate line excluding sales mileage that can be entered on the sales spreadsheet. Note you may only claim mileage allowances if you are not claiming motoring costs such as the vehicle cost, repairs, tax, insurance, or fuel. If you wish to claim vehicle expenses leave this column blank
- **Column G** — Enter the gross purchase value of the transaction including VAT
- **Column X** — A concise description of the fixed asset. This description will be useful when completing the fixed asset register which is within the purchases workbook on a separate worksheet
- **Column Y** — For subcontractors only: enter the income tax deducted from the purchase invoice
- **Column Z** — For subcontractors only: enter the certificate number

### Formulae Driven Automated Columns

No entries required in these columns:

- **Column H** — Automatically shows unpaid purchases if column D payment method is left blank. Entering the payment method in column D blanks this entry
- **Column I** — Automatically calculates the number of days the purchase has been outstanding
- **Columns J–X** — The letters entered in column E automatically update the expense analysis

### Mileage Allowances

Purchase and sales mileage, if recorded, are calculated and included as a business expense on row 4. No entry is required on this row which has been automated. The formulae in respect of mileage allowances automatically calculate the amount in accordance with current HMRC rates of 45p for the first 10,000 miles and 25p per mile thereafter.

Claiming mileage allowance rather than the costs of the vehicles often works out more unless the vehicle is only lightly used and also avoids the vehicle becoming a tax liability to the self employed since owning a vehicle and using it for both personal and business use generates a tax benefit which increases your personal tax liability.

## Stock

The Stock worksheet is only applicable to those businesses that carry physical stock of goods for resale.

Cell C5 — Enter the physical value of stock on hand at the start of the tax year (opening stock).

Stock values are used to adjust the value of stock purchases to the cost of sales:

> Opening Stock + Stock Purchases – Closing Stock = Cost of Goods Sold

This calculation is automated on the financial accounts workbook.

The formulae on this worksheet then assume the same stock value at the end of each month. Entering different stock values each month will increase the accuracy of the monthly profit and loss account and is only required as an option and personal preference of the business owner.

Cell C30 — Enter the closing stock value at the end of the financial year in to enable the automated formulae to accurately calculate the annual net profit or loss.

## Bank Account Transactions

The accounting system works without a dedicated business bank account. It is appropriate to use the system whether business bank accounts exist or not.

Information from business bank accounts or personal bank accounts used for all or occasional business bank transactions is incorporated into the workbooks to include bank based charges and also to update the payments received and made to enhance the control of both debtors and creditors.

Review business and personal bank accounts.

Enter on the purchase worksheet for that month all business expenses that have been paid directly from the account that has not already been entered. For example, bank interest, bank charges, and the interest element of leasing or financing charges that may not have already been entered. Direct debit payments for which a purchase invoice has not been received.

If you have not already done so update the purchase worksheet column D "payment method" to ensure all transactions that have been paid have also been recorded on the worksheet. Entering cheque numbers helps provide better tracking of payments.

Repeat the same review procedure for any sales receipts that may not already have been entered on the sales worksheets including sales and bank interest received.

## Financial Accounts

### Fixed Assets

Fixed items are physical items used by the business over a period of more than one year. Depreciation spreads the financial effect on profits over the life of the asset but does not have an effect on the business tax as depreciation is disallowed as an expense. Instead the business receives tax allowances on the cost of assets to set against its profit.

When the fixed asset schedule is completed the capital allowances are automatically calculated and update the profit tax return. Capital allowances on vehicles are automatically reduced by the personal use %.

100% of the cost of the asset can be set off against profits in the year purchased which is called Annual Investment Allowance. The remaining value of the asset and other written down values are then written off against future years profits at 18% of the book value remaining.

Businesses should set a consistent policy in the treatment of fixed assets and it is suggested that only long term assets (used more than one year) and costing over £100 should be classified as "fixed".

#### Data Entry — Purchases Worksheet

Enter F in the expense code column of the purchases worksheet. Column X — Fixed assets automatically updates with the cost of the asset. Column Z — Enter asset description. Update the fixed asset schedule each month.

#### Data Entry — Financial Accounts Fixed Asset Worksheet

Enter new acquisitions in the additions section of the schedule which is shaded in green.

- **Column A** — Enter date the asset was purchased
- **Column B** — Enter the asset description by copying the description already entered on the purchases worksheet. Vehicles should show the make and model number, engine capacity, registration number and date first registered to correctly identify the item. Note vehicles costing under £12,000 are included as general items in the first section. Vehicles costing over £12,000 go in the section below as capital allowances are restricted on these vehicles to £3,000 p.a.
- **Column C** — Enter the purchase invoice number, obtained from the monthly purchase worksheet
- **Column D** — Enter purchase cost of asset
- **Column E** — Enter the asset location to enable physical tracking of the item. This is optional

If an asset is sold or scrapped record the transaction on the sales spreadsheet. On the fixed asset schedule complete the yellow shaded area:

- **Column L** — Enter the date the asset was sold or otherwise disposed of
- **Column M** — Enter the amount received for the asset

#### Formulae Driven Automated Columns

No Entries required:

- **Column G** — Entries are required for assets existing at the start of the tax year as explained in the "Preparing to get started" section. No entries are required for assets purchased during the current financial year
- **Column H** — Automatically calculates the first year allowance of new purchases
- **Column I** — Automatically calculates the writing down allowance of existing assets
- **Column J** — Automatically calculates the Net Written Down value of asset
- **Column O** — New additions entered automatically. Sale of assets requires manual entry
- **Column P** — Automatically calculates any additional capital allowances resulting from a sale
- **Column N** — Automatically calculates any balancing charge if the asset was sold at a price higher than the written down value

### Profit and Loss Account

No entries are required. All the financial information is generated automatically from the sales, purchases and payroll sheets each month to produce a monthly profit and loss account and the annual result to date.

Its usefulness is to enable progress to a successful financial result to be monitored and should banks or other institutions request up to date accounts then you have exactly that at the touch of a print button.

### Debtors & Creditors

No entries required. This report extracts from the sales and purchase spreadsheets the amounts still outstanding either from customers who haven't yet paid or suppliers awaiting payment. This report will only be accurate if the method of payment column has been maintained up to date.

### Self Employment Tax Return (Short)

No entries are required. All the information is updated automatically from the worksheets.

This return is provided to assist in the completion of the year end self employed section of the tax return. All box references on this document are the same as the actual tax return.

### Draft Tax Calculation

This section is provided as a Guide only to the income tax impact of the business profit. The actual tax payable is dependent on both individual tax allowances and income from other sources.

## Taxation

### Expense Guidance Notes

The HMRC rules for employees/directors claiming expenses are quite strict since they recognise this area as a potential source of tax avoidance.

#### To Comply with HMRC Criteria

- Every expense item should ideally be receipted, with limited company expenses, particularly by directors, receipts should be attached to an expense sheet and countersigned
- Mileage records have to be maintained showing date of journey, reason for journey and mileage covered
- Expenses covering non-employees have to be excluded
- Personal expenses on company credit cards are excluded
- Round sum allowances excluding permitted amounts are extremely frowned upon
- Only the business element of landline and mobile phone bills may be reclaimed
- Only the business element of household bills may be claimed
- Amounts relating to a different business may not be claimed

### Mileage Allowances

Everyone can claim as an alternative to vehicle running costs mileage allowances of 45p for the first 10,000 miles and 25p per mile thereafter. The formulae in the spreadsheets automatically calculate these rates. You may not claim mileage allowance and vehicle running costs.

Should you choose to claim the mileage allowance then keep good records of mileage covered, purpose of journey. You might consider entering the mileage against sales or purchase invoices which naturally provides the date and purpose of the journey.

### Travel & Subsistence Allowances

- You may claim a lunch allowance of £5 or the receipted amount if larger, provided there is only yourself present at lunch and you are away from your normal workplace for more than 5 hours
- You may claim a dinner allowance of £10 or the receipted amount if larger, provided there is only yourself present at dinner and you are away from your normal workplace for more than 10 hours
- If you stay away from home overnight you may claim a subsistence allowance of £5 per night to cover incidental expenditure, all other expenditure being receipted. This allowance is increased to £10 if the overnight stay is out of the UK
- If you stay at a friend or relatives house instead of a hotel you may claim an allowance of £25 per night

### Household Expenses

You may claim a proportion of household expenses appropriate to the area of your home used for business purposes. If you claim domestic expenses then specific rooms should be designated as business only. For example, if you reside in a 3 bed-roomed house with a lounge and dining room, ignoring the kitchen and bathroom you have 5 rooms. If one bedroom is used as a store room and the dining room used exclusively as an office then 2 rooms are designated as business use. It would be appropriate for 2/5 of domestic costs to be claimed as a business expense. Use a single room exclusively for business purposes and you could claim 1/5 of the domestic bills.

Domestic bills would be heat & power costs — gas & electricity, rent, general & water rates. If you own the property you can claim mortgage interest (not the capital element) although this is not advised as should you claim mortgage interest HMRC can claim the same proportion of any profit made on that property as a taxable profit when sold.

### Partner Assistance

Generally HMRC do not like claims being made by self-employed businesses in respect of partners' wages and normally seek to identify if this claim was real or merely tax avoidance. If partners' wages are claimed as a business expense you should be able to produce evidence that the amount claimed has actually been paid, e.g. pay by cheque to your partners' bank account. The amount paid should be consistence with the amount of work done. For a claim to succeed the partner should have performed specific duties such as the business bookkeeping, placing advertisements, answering sales calls, quoting for work, invoicing clients, delivering goods and services, etc. Stating the partner duties as "Girl (or Man) Friday" would not be acceptable.

## Contact Information

Our website is the first place to look for any information: https://spreadsheets.diyaccounting.co.uk/

DIY Accounting's spreadsheet packages are maintained and supported under an Open Source model. In return for allowing anyone access to our source files, we find an indefinite low-cost home at GitHub. We continue to keep the website up with downloads for up-to-date packages. This model relies upon community support (an online forum) and accepting donations instead of retaining paid staff and charging a fee.

Please raise a question in our discussion forum here: https://github.com/antonycc/diy-accounting/discussions

Or donate to help keep the packages updated here: https://www.paypal.com/donate/?hosted_button_id=XTEQ73HM52QQW

## Glossary: Purchase Column Headings

| Category | Expense Code | Purchases Column | Description |
|----------|-------------|-----------------|-------------|
| Stock purchases | S | J | Costs of goods purchased for resale including raw material used to produce products for resale. Note: Haulage contractors and taxi drivers should include vehicle or mileage allowances in this column rather than motor expenses. |
| Other direct costs | D | K | Discounts allowed commissions' payable, carriage costs. In manufacturing include costs of production, direct labour costs, machine hire small tools and consumables. |
| Employee costs | E | L | Salaries, wages, bonuses casual staff. Do not include your own wages and national insurance costs. |
| Premises costs | P | M | Rent, business rates, water rates, light, heat, power, property insurance and security. Include any amounts of this nature for "use of home" in this column. |
| Repairs and Maintenance | R | N | Repairs and renewals including general maintenance of business premises and machinery. |
| General Administrative expenses | G | O | Telephone, postage, stationery, printing costs and general office expenses. |
| Motor Expenses | M | P | Petrol, diesel, repairs and servicing, insurance, vehicle licence, hire and leasing charges, parking charges, AA/RAC membership. |
| Travel and subsistence | T | Q | All travel costs including rail, air, taxis excluding motor expenses. Hotel accommodation and subsistence are allowed, meals except on overnight trips are not. |
| Advertising and promotion | A | R | Advertising, promotions, mail shots and entertainment costs. |
| Legal and professional | L | S | Accountants, solicitors, surveyors, architects, professional indemnity insurance. |
| Bad Debts | B | T | Specific sales included in turnover that is considered at the year end will never be paid. |
| Bank Interest and other finance charges | I | U | Interest and charges on finance payments and bank loans/overdrafts excluding repayment of capital. Include lease payments and credit card charges in this column. |
| Other Expenses | O | V | Business expenses not included elsewhere. |
| Fixed Assets | F | W | Land and buildings, vehicles, plant and equipment, fixtures and fittings, computer equipment purchased by the business with a life expectancy exceeding 12 months. |
