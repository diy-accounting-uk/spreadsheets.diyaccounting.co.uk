# PLAN: VAT return export for Submit pairing

Status: **not started.** This document is the only record of this work; it is not tracked in
`NEXT.md`. It is the spreadsheets half of the Submit backlog's item B16; the Submit half (an
import that accepts this export) stays in that repository's backlog.

## User assertion (verbatim)

> file a VAT return from a DIY spreadsheet without re-keying: the spreadsheets product needs a
> CSV/digital-link export of the VATQtr boxes that Submit can import.

## What it is

Each VAT-registered package (Limited Company `Vatreturns.xlsx`, Self Employed `Vat.xlsx`)
carries five return forms, `VATQtr1`–`VATQtr5`, each computing the nine boxes of a UK VAT
return from the Vatinterface for the period its `G5` names. Today a customer reads those
boxes off the sheet and types them into Submit. The export makes that a digital link: a
file Submit can import, whose nine boxes equal the sheet's, for the period the customer
chooses.

## Scope

- An export per return form: period start, period end, and boxes 1–9 as the sheet computes
  them (box 1 output VAT, 2 acquisitions, 3 total, 4 input VAT, 5 net, 6 sales net, 7
  purchases net, 8 supplies to EU, 9 acquisitions from EU), with the package's VAT
  registration number and business name from `Admin`.
- Format: CSV first (one row per return, a header row naming the boxes), with the field
  names Submit's import will use; a JSON twin if Submit prefers it. The two products share
  one format.
- Where it runs: `app/bin/export.js` gains a `--vat-returns` mode that reads a package (the
  reader already resolves the Vatinterface and the return forms for the reconciliation
  checks), and the same code path is exposed for the customer through the site or the
  package itself (a decision to take with the Submit half: a download from the package's
  reconciliation page, or an upload of the workbook to Submit which runs the export
  server-side).

## Test

An export whose nine boxes equal the VATQtr sheet's for every return form of every
VAT-registered fixture, asserted by the reconciliation checks that already read those boxes
(`VAT Q<n>: box <b>` in `ltd.js` and `se.js`), plus a JSZip breakability proof that a
corrupted box changes the exported row and nothing else.

## Dependencies

- The Submit import (B16's other half) fixes the field names; agree them before the CSV
  header is final.
- The fifth return's period is now a true fifth quarter (wave 3); the export takes the period
  from `G5`, so no assumption about the stagger is needed.
