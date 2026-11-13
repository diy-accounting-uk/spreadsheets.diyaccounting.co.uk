<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->
<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->
The workbooks in a DIY Accounting package read figures from each other. If they show blanks or wrong figures, the files are usually not all in one folder, or Excel has not updated the links between them. Put every file from the zip in one new folder, open the files from there and choose to update the links.


**Why the workbooks link to each other**
A package such as [Self Employed](../products/self-employed.html) or [Company Accounts](../products/company.html) is a set of workbooks: sales, purchases, bank, VAT returns, fixed assets and the financial accounts. You enter data in some of them. The financial accounts read the totals from the others. A workbook finds the others by file name, so it needs them beside it.


**Check the files first**
1. Download the zip again from the [download page](../download.html) if you are unsure what you have.
2. Extract all of the zip into a new folder in Documents. Do not run the files from inside the zip.
3. Keep every file in that one folder, with its original name.
4. Do not open a file before you have saved it into that folder. The package guide warns that this creates temporary links between the files.
5. Open the workbook you want from the new folder.


**Allow the links to update**
When Excel opens a workbook that links to other files, it can ask whether to update the links. Choose to update. A file that came from the internet or an email can open in Protected View. Choose Enable Editing first, then update the links.

Excel for Mac can also ask for permission to reach the folder that holds the linked files. Grant it, and keep all the files in the same folder. For the programs that run the packages on a Mac, see [using our packages on a Mac](using-our-packages-on-a-mac.html).


**You moved or renamed the folder**
A link remembers where the other file was. If you moved a file, or renamed it, the link can point at the old place. In Excel, open Data, then Edit Links, then choose Change Source and pick the file in its new place. It is quicker to put the original files back in one folder.


**Figures are wrong, not blank**
The main entry workbooks are unprotected, so a figure typed into a cell replaces the formula in it. If one total looks wrong, check that cell. Keep a clean copy of the package from the download page, so you can copy the original formula back.

If the year-end accuracy check does not reach zero, read [why the year-end accuracy check does not show zero](year-end-accuracy-check-does-not-show-zero.html).
