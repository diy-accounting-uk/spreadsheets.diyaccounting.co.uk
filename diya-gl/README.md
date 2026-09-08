# @diy-accounting-uk/diya-gl

Run a UK sole trader's or company's accounts from the command line. A diya-gl book is a
book.toml and a lines.jsonl file, usually a few kilobytes, that hold a year of transactions
and the chart of accounts they post to. This package recalculates one, reads one out of an
Excel workbook, writes one back into a workbook, and serves one over MCP, all through the
same engine the [DIY Accounting spreadsheets site](https://spreadsheets.diyaccounting.co.uk)
reconciles in CI.

Four products: Basic Sole Trader, Taxi Driver, Self Employed, Limited Company.

## Install

```
npm install -g @diy-accounting-uk/diya-gl
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
diya-gl mcp
```

Each subcommand is also its own command, if you only want one on your `PATH`:
`diya-gl-recalc`, `diya-gl-read-workbook`, `diya-gl-write-workbook`, `diya-gl-mcp`.

- **recalc** takes a diya-gl book (`--data`) or a populated workbook (`--source-dir`,
  `--mode saved|recalculate`) and writes `report.json`: every figure, report section and
  compliance check the engine computes.
- **read-workbook** takes an `.xlsx`, a package zip, or a diya-gl zip or JSON file
  (`--file`), and writes `book.toml`, `lines.jsonl`, `report.json` and `bookchecks.json`.
- **write-workbook** takes a diya-gl book (`--data` or `--file`) and writes the Excel
  package its product composes onto its template — the same client-side path the site's
  books page uses, so it never needs LibreOffice. Add `--zip` for the package as one zip.
- **mcp** runs a stdio [MCP](https://modelcontextprotocol.io) server with four tools:
  `extract_book`, `report`, `edit_lines`, `save_workbook`. Point an MCP client at
  `diya-gl-mcp` (or `diya-gl mcp`) with no arguments.

## The format

A diya-gl book's fields are drawn from the XBRL Global Ledger Taxonomy Framework 2015 and
map onto HMRC's SA103S boxes. The two schemas that validate a book are published at
[`/schema/diya-gl-book-v2.schema.json`](https://spreadsheets.diyaccounting.co.uk/schema/diya-gl-book-v2.schema.json)
and
[`/schema/diya-gl-lines-v2.schema.json`](https://spreadsheets.diyaccounting.co.uk/schema/diya-gl-lines-v2.schema.json).
The full field mapping, the check catalogue and the reconciliation evidence behind them are
on the [format spec page](https://spreadsheets.diyaccounting.co.uk/diya-gl.html).

## Provenance

Every book this package writes carries five stamps: the format version, this package's own
version and commit, a hash over the tax-year data applied, and each product's template hash
and reconciliation scorecard. Recalculating an old book either reproduces its `report.json`
byte for byte or names the stamp that differs. Every published release is cut from a commit
whose reconciliation checks passed; the scorecards are on the
[reconciled releases page](https://spreadsheets.diyaccounting.co.uk/reconciliation/releases.html).

## License

AGPL-3.0-only. Copyright (C) 2026 DIY Accounting Ltd.
