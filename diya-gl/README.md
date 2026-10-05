<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->
# @diy-accounting-uk/diya-gl

Run a UK sole trader's or company's accounts from the command line. A DIYA-GL™ book is a
book.toml and a lines.jsonl file, usually a few kilobytes, that hold a year of transactions
and the chart of accounts they post to. This package recalculates one, reads one out of an
Excel workbook, writes one back into a workbook, and serves one over MCP, all through the
same engine the [DIY Accounting Spreadsheets™ site](https://spreadsheets.diyaccounting.co.uk)
reconciles in CI.

Four products: Basic Sole Trader, Taxi Driver, Self Employed, Limited Company.

## Install

```
npm install -g @diy-accounting-uk/diya-gl
```

With Homebrew:

```
brew tap diy-accounting-uk/diya-gl
brew install diy-accounting-uk/diya-gl/diya-gl
```

Or run the image straight from GHCR, no install:

```
docker run --rm -v "$PWD":/data ghcr.io/diy-accounting-uk/diya-gl:latest \
  recalc --package bst --data /data/my-book --years se-2025-2026 --output-dir /data/out
```

## Use

```
diya-gl recalc --package bst --data my-book --years se-2025-2026 --output-dir out
diya-gl read-workbook --file my-workbook.xlsx --output-dir out
diya-gl write-workbook --data my-book --output-dir out
diya-gl link my-book
diya-gl new-book --product se --name "Lark Lane" --year-end 2027-04-05 --output-dir lark-lane
diya-gl view my-book
diya-gl mcp
```

Each subcommand is also its own command, if you only want one on your `PATH`:
`diya-gl-recalc`, `diya-gl-read-workbook`, `diya-gl-write-workbook`, `diya-gl-link`, `diya-gl-new-book`,
`diya-gl-view`, `diya-gl-mcp`.

- **recalc** takes a diya-gl book (`--data`) or a populated workbook (`--source-dir`,
  `--mode saved|recalculate`) and writes `report.json`: every figure, report section and
  compliance check the engine computes.
- **read-workbook** takes an `.xlsx`, a package zip, or a diya-gl zip or JSON file
  (`--file`), and writes `book.toml`, `lines.jsonl`, `report.json` and `bookchecks.json`.
- **write-workbook** takes a diya-gl book (`--data` or `--file`) and writes the Excel
  package its product composes onto its template — the same client-side path the DIYA-GL
  pages use, so it never needs LibreOffice. Add `--zip` for the package as one zip.
- **link** takes a book (a directory with `book.toml` and `lines.jsonl`, a diya-gl zip or a
  diya-gl JSON file) and prints the `https://diya-gl.co.uk/<product>.html#book=<data>` link that
  opens it, the whole book carried in the fragment so nothing is uploaded. `--base <url>`
  replaces the origin. The fragment length goes to stderr, with a warning past 64 KB (about
  2,000 lines), where chat, email and QR codes start to cut links off.
- **new-book** starts an empty book for a new business: `--product` (`bst`, `se`, `taxi` or
  `ltd`), `--name` and `--year-end` (YYYY-MM-DD), plus `--vat` for a VAT-registered Self
  Employed or Company book. It writes `book.toml` (the product's starting chart of accounts,
  the twelve months to the year end and that tax year's rates), an empty `lines.jsonl`,
  `report.json` and `bookchecks.json` into `--output-dir`, the current directory by default.
- **view** takes the same book sources as **link**, serves the full diya-gl pages on
  `127.0.0.1` (`--port <number>`, default a free port) and opens the book in your default
  browser (`--no-open` prints the address only). The pages are not in this package: the local
  server fetches each file from https://diya-gl.co.uk on first use and caches it under the
  system temporary directory, one directory per package version, so the first run needs the
  network and later runs of the same version reuse the cache. `--origin <url>` fetches from
  another site. The book stays in the browser (the part of the address after `#` is never sent
  anywhere). The server stays up until Ctrl-C. The workbook templates come from
  spreadsheets.diyaccounting.co.uk the first time a page action needs one.
- **mcp** runs a stdio [MCP](https://modelcontextprotocol.io) server with nine tools:
  `extract_book`, `new_book` (the empty book **new-book** writes), `report`, `edit_lines`,
  `save_workbook`, and four that read every detail of
  the loaded book: `lines` (filter and group every transaction, e.g. best customer or spend on
  fuel in June), `chart` (the accounts and the report rows each feeds), `book` (the business,
  period, tax settings and registers) and `checks` (every book check with the entryNumbers
  behind it). Point an MCP client at `diya-gl-mcp` (or `diya-gl mcp`) with no arguments.

## API

The package root exports three functions that turn a book into the figures HMRC's MTD APIs
take. Each takes the parsed book, its lines and a parameters object, and returns a promise.
Nothing is sent anywhere: the answer is the request body to send, plus what fed it.

Load a book first:

```js
import { readFileSync } from "node:fs";
import { parse } from "smol-toml";

function loadBook(dir) {
  const book = parse(readFileSync(`${dir}/book.toml`, "utf8"));
  const lines = readFileSync(`${dir}/lines.jsonl`, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  return { book, lines };
}
```

### `deriveVatReturn(book, lines, { periodEnd, periodStart?, periodKey? })`

The nine VAT return boxes for the three-month period ending `periodEnd` (YYYY-MM-DD), from a
Limited Company book that declares `diya-gl:vatRegistered = true`. `periodStart`, when given,
must open that quarter; `periodKey` is echoed back. The answer carries `boxes` (box1 to box9),
`hmrc` (the same figures under HMRC's field names, boxes 1 to 5 to the penny and 6 to 9 in
whole pounds), `months`, `dueDate`, `scheme`, and `lines`: the journal lines behind boxes 1, 4,
6 and 7, each with what it contributes. A book whose lines do not reconcile with its VAT
interface is refused.

```js
import { deriveVatReturn } from "@diy-accounting-uk/diya-gl";

const { book, lines } = loadBook("my-company-book");
const answer = await deriveVatReturn(book, lines, { periodStart: "2025-07-01", periodEnd: "2025-09-30" });
console.log(answer.hmrc); // { vatDueSales, vatDueAcquisitions, totalVatDue, ..., totalAcquisitionsExVAT }
```

### `deriveItsaQuarterlyUpdate(book, lines, { periodEndDate?, quarterlyPeriodType?, taxYear? })`

One period of HMRC's Self Employment Business API from a Self Employed book. In 2023-24 and
2024-25 each period carries its own figures; from 2025-26 each carries the running total from
6 April. `periodEndDate` picks the period among the year's four; without it every period is
answered. `quarterlyPeriodType` is `standard` (6 April quarters, the default) or `calendar`.
`taxYear` (as `2025-26`) overrides the year the book's dates imply. Each period lists the fields
the book cannot source under `omitted`; those are left out of the body, never sent as zero.

```js
import { deriveItsaQuarterlyUpdate } from "@diy-accounting-uk/diya-gl";

const { book, lines } = loadBook("my-self-employed-book");
const answer = await deriveItsaQuarterlyUpdate(book, lines, { periodEndDate: "2025-10-05" });
const [period] = answer.periods; // { periodDates, periodIncome, periodExpenses, ..., omitted, covers }
```

### `deriveItsaAnnualSubmission(book, lines, { taxYear? })`

The year's allowances and adjustments for the same API's annual submission, from a Self
Employed book, restricted to the fields HMRC accepts for that tax year. `taxYear` (as
`2025-26`) overrides the year the book's dates imply. The answer carries `allowances`,
`adjustments`, `omitted` and `warnings`.

```js
import { deriveItsaAnnualSubmission } from "@diy-accounting-uk/diya-gl";

const { book, lines } = loadBook("my-self-employed-book");
const answer = await deriveItsaAnnualSubmission(book, lines, { taxYear: "2025-26" });
console.log(answer.allowances.annualInvestmentAllowance);
```

## The format

A diya-gl book's fields are drawn from the XBRL Global Ledger Taxonomy Framework 2015 and
map onto HMRC's SA103S boxes. The two schemas that validate a book are published at
[`/schema/diya-gl-book-v2.schema.json`](https://spreadsheets.diyaccounting.co.uk/schema/diya-gl-book-v2.schema.json)
and
[`/schema/diya-gl-lines-v2.schema.json`](https://spreadsheets.diyaccounting.co.uk/schema/diya-gl-lines-v2.schema.json).
The full field mapping, the check catalogue and the reconciliation evidence behind them are
on the [format spec page](https://diya-gl.co.uk/spec.html).

## Provenance

Every book this package writes carries five stamps: the format version, this package's own
version and commit, a hash over the tax-year data applied, and each product's template hash
and reconciliation scorecard. Recalculating an old book either reproduces its `report.json`
byte for byte or names the stamp that differs. Every published release is cut from a commit
whose reconciliation checks passed; the scorecards are on the
[reconciled releases page](https://spreadsheets.diyaccounting.co.uk/reconciliation/releases.html).

## Licence

This package is licensed under the Apache License 2.0. Embed it, ship it, change it. See `LICENSE`
and `NOTICE`.

The diya-gl format itself is an open specification. The two JSON Schemas are Apache-2.0 and the
format text is CC BY 4.0, so you can implement the format in anything with attribution.

The workbook templates are not part of this package. `write-workbook` and the MCP `save_workbook`
tool fetch the template they need from
[spreadsheets.diyaccounting.co.uk](https://spreadsheets.diyaccounting.co.uk) the first time they run,
print the terms, and cache it for later runs. The templates are the company's own work, under the
PolyForm Internal Use License 1.0.0 with an additional grant: use them for your own accounts, or for
your clients' accounts if you are an accountant or a bookkeeper, and do not redistribute them.

This repository does not accept contributions.

Copyright (C) 2006-2026 DIY Accounting Limited.
