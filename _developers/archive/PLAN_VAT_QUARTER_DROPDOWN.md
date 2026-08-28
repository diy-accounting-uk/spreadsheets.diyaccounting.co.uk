# PLAN: VAT quarter-end dropdown does not roll with the package year

Status: **all four surfaces fixed, deployed, and live-verified** (2026-08-24: surfaces 1–3 via PR #2 + regeneration + deploy; surface 4 via PR #4 + regeneration + the 08:36 push-triggered deploy; live Aug27 artefact verified on both the dropdown-list and closed-workbook link-update paths). The guard test now covers the 4th chain link (`9e9cb12a`), and the monthly `generate-ltd` schedule has run, which settles determinism. Remaining: the operator's six-donor decision.

## User assertions (verbatim)

From Philippe Clavier (CMC Ltd, `phclavier@yahoo.co.uk`), support@ 2026-07-14,
after a first report on 2026-07-13. Unanswered at time of writing.

> Good morning,
> After further attempts, the dates drop down menu in VATQtr1 does NOT contain
> "June 2026" but if I select "June 2025", the right numbers from Sales &
> Purchases appear. At the moment i don't seem able to correct this, and
> obviously can't submit a VAT return with 2025 on it???
> Many thanks
> Philippe Clavier
> CMC Ltd

Customer context: DIY Accounting customer since 2013; PayPal purchase of
Company Accounts on 2026-07-07.

## Diagnosis

`VATQtr1..5!G5` ("VAT Period ends") is a data-validation list cell (identical in
all VAT workbooks):

```xml
<dataValidation type="list" allowBlank="1" showInputMessage="1"
                showErrorMessage="1" sqref="G5">
  <formula1>$K$2:$K$15</formula1>
</dataValidation>
```

`K2:K15` are **formula cells with frozen cached values**, not literals. Shipped
bytes in every workbook (Ltd shown; SE references `[1]Admin!$B$5..$B$19` directly):

```xml
<c r="K2" s="69"><f>Vatinterface!B6</f><v>45777</v></c>
...
<c r="K15" s="69"><f>Vatinterface!B19</f><v>46173</v></c>
```

The 14 cached serials are 45777..46173 = 2025-04-30 .. 2026-05-31 — the Mar26
template's snapshot — and are identical in every VAT workbook in the catalogue
(script-verified: exactly one distinct K-list across all of them).

Every figure on the return is driven by `G5` — 8 cells per quarter sheet
(`G7 G9 G15 G21 G23 B19 E19 B21`), e.g.
`G7 = LOOKUP(G$5, Vatinterface!B1:B20, Vatinterface!C1:C20)`.

### Root cause

`app/lib/generator.js`, the `// VAT quarter default dates` block (line 642,
added in `b5d1ff15`, 2026-04-01) writes **`G5` only**
(`setCellValue(sheetXml, "G5", serial)`), never the `K2:K15` cached values,
never the `Vatinterface!B` cached values, never the `externalLink1.xml` Admin
cache. `b5d1ff15` verified Mar26 byte-for-byte and passed because Mar26's five
quarter defaults (Jun25/Sep25/Dec25/Mar26/Apr26) all fall inside the frozen
snapshot. Every quarter-end after 2026-05-31 falls outside it.

What the customer sees: `fullCalcOnLoad="1"` recalculates K2:K15 on open from
`Vatinterface!B`, which reads the `externalLink1.xml` Admin cache — also frozen
at the Mar26 snapshot. For March-year packages the recalculated list equals the
shipped one (Apr25..May26): Philippe's Mar27 package (his 2026-07-13 mail: FY
starts April, year 26-27, Q1 just completed) shows Jun25 but not Jun26, exactly
as reported. For non-March Ltd packages the remapped references slide the
window (e.g. Jun26 shows Jul25..Jun26) and references past cached row `B38`
resolve to 0, rendered as 1900-epoch garbage rows in the dropdown.
`showErrorMessage="1"` means a valid date cannot be typed in manually — there
is no in-product workaround.

### Blast radius

Catalogue at `aee30466` (current main): **90 Company `Vatreturns.xlsx` + 7 Self
Employed `Vat.xlsx` = 97 VAT workbooks, 485 quarter sheets, 408 sheets whose
default `G5` is absent from the shipped `K2:K15` list.** (Earlier counts
reconciled: 87 was Company-only; 94 = 87 + 7 SE, where the same check gives
393/470 — script-verified against the shipped XML; +3 Company dirs and +15
missing defaults came from the 2026-08-23 baseline run, see Rollout.)

Currently-sold packages, quarters missing from the shipped list (script output):

| Package | Missing |
|---|---|
| Company May26 | Q5 |
| Company Jun26 – Aug26 | Q4, Q5 |
| Company Sep26 – Nov26 | Q3, Q4, Q5 |
| Company Dec26 – Feb27 | Q2–Q5 |
| Company Mar27 – Sep27 | Q1–Q5 (all) |
| Self Employed Apr27 | Q1–Q5 (all) |

Historic packages (Apr20–Dec25, SE Apr21–Apr25) are also affected but not sold.

### Second surface of the same fault (part of this item, not a separate one)

The cached `Vatinterface!B` values and the `xl/externalLinks/externalLink1.xml`
Admin cache are frozen at the 2025-26 snapshot in every shipped package, from
the same failure to roll dates with the package. Until Excel updates links
against the customer's `Financialaccounts.xlsx`, `LOOKUP` with a `G5` above the
top of the vector returns the last row instead of an error, so the workbook
shows a plausible wrong return with no warning. Fix it in the same change; this
item stays open until it closes.

### Third surface: the Vatinterface row remap contradicts the generated Admin sheet

`rewriteVatinterfaceFormulas()` (generator.js:724) remaps `[1]Admin!$B$6..$B$36`
to `adminStartRow = ((M-1)%12)*2+2` per year-end month M. That replicates the
original hand-built packages, where the Admin B-column was calendar-fixed and
the `=F21` anchor cell **moved** with the year-end (archive Jun23
Financialaccounts: `B38=<f>F21</f>`, `B12` caches May22). The generated
Financialaccounts keeps the Mar26 template's Admin unchanged apart from the
`F21` literal: the anchor stays at **`B32=<f>F21</f>`** for every year-end
(verified in Jun26 and Mar27 packages), so the recalculated Admin B-column is
year-end-relative — `B{r} = yearEnd + (r-32)/2 months`, the template rows
`B6..B36` are correct for **every** year-end, and the remapped rows are wrong
by (M-3) months. Consequence: in a non-March package whose links have updated,
the Vatinterface date column shifts against its data columns and the return
shows wrong figures silently. The remap must be removed, not fed; the cache fix
below writes values consistent with the `B32` anchor.

### Fourth surface: Financialaccounts' own Admin caches poison link update

Verified on the live Aug27 package (2026-08-24, after surfaces 1–3 deployed):
Vatreturns.xlsx ships fully correct and chain-consistent, but a spreadsheet app
"updating links" reads the STORED cached values of the closed
Financialaccounts.xlsx — it never recalculates a closed workbook. Generated Ltd
Financialaccounts roll `Admin!F21` (literal year-end) but leave the `Admin!B`
column's cached values at the Mar26 snapshot (`B32` formula `=F21` caches
2026-03-31). Link update pours the stale window into Vatreturns; fullCalcOnLoad
rebuilds `K2:K15` from it; the dropdown shows Apr25..May26 while `G5` keeps its
shipped literal. "Self-heals on link update" is therefore wrong in the common
case — link update *propagates* staleness. Fix: roll the `Admin!B` cached
values inside Financialaccounts at generation (same year-end-relative rule,
same `setCellCachedValue`, Mar26 idempotent). The guard test grows a fourth
link — Vatreturns externalLink cache ≡ Financialaccounts stored `Admin!B` —
in a follow-up PR after the next regeneration. Item stays open until all four
surfaces close.

## Fix specification

All XML surgery follows `SKILL_EXCEL.md`: regex cell edits via `matchCell`,
zip entries rewritten with their original `date`, DEFLATE level 6,
`stabilizeDirDates` (already in `generateSpreadsheet`). Scope: `ltd` and `se`
products only (no other product has VATQtr sheets).

1. **`app/lib/generator.js` — new helper `setCellCachedValue(xml, cellRef, value)`**:
   like `setCellValue` but preserves the cell's `<f>…</f>` and replaces only the
   `<v>…</v>` body; throws if the cell or its `<v>` is not found. Writing an
   unchanged value must be byte-identical (it is: same open tag, same formula,
   `<v>${value}</v>` with integer serials).

2. **`generateSpreadsheet` VAT block (line 642)** — after the existing `G5`
   writes, roll the whole date chain. Add `vatinterface = "xl/worksheets/sheet6.xml"`
   to `[sheets.vatreturns]` (ltd) and `[sheets.vat]` (se) in the two
   `meta.toml`s. Build an Admin B-value map:
   - Ltd: `adminB[r] = toExcelSerial(monthEnd(yearEnd + (r-32)/2 months))` for
     `r = 6, 8, …, 38` (use `endDate` already in scope; month arithmetic via
     `monthEnd` with proper year carry).
   - SE: `adminB[r] = toExcelSerial(generateAdminDates(startYear)[`B${r}`])` for
     the rows the cache holds (`B2, B3, B5..B16, B18, B19, B20`) — the same map
     `buildSeCellEdits` writes into the SE Financialaccounts Admin.

   Then, resolving each cell's own `<f>` reference (do not hardcode row lists):
   - **`xl/externalLinks/externalLink1.xml`**: replace every
     `<cell r="B{r}"><v>…</v></cell>` value with `adminB[r]`; throw if a cached
     row is not in the map. Verify via
     `xl/externalLinks/_rels/externalLink1.xml.rels` that the target is
     `Financialaccounts.xlsx`; throw otherwise.
   - **Vatinterface sheet**: for every cell whose formula is `[1]Admin!$B$r`
     (Ltd: `B4..B19` plus `C19`; SE: `B4..B19`), `setCellCachedValue` to
     `adminB[r]`. After the pass, throw if any `[1]Admin!$B$` reference remains
     whose row is outside the map.
   - **Each VATQtr sheet**: for `K2..K15`, resolve the formula
     (`Vatinterface!B{n}` → the Vatinterface value just written;
     `[1]Admin!$B$r` → `adminB[r]`) and `setCellCachedValue`.
   - **Assertion**: each computed `G5` serial must be a member of the 14 K
     values just written — throw if not. No fallback, no skip. (Holds by
     construction: K spans months 1–14 of the accounting year; Q1–Q4 are months
     3/6/9/12, Q5 is month 13, per lines 651–661.)

3. **`rewriteVatinterfaceFormulas` (generator.js:724)**: delete the
   `[1]Admin!$B$` rowMap remap (lines 728–742); keep the `[2]`/`[3]`
   Sales/Purchases tab renames with their own no-op guard. Update the sections
   describing the remap in `SKILL_EXCEL.md` ("Vatinterface Formula Rewriting")
   and `CONTEXT_LIMITED_COMPANY.md` (line ~314) in the same commit.

Expected emissions: Mar26 `Vatreturns.xlsx` and SE Apr26 `Vat.xlsx` are wholly
idempotent (every written value equals the shipped byte, the remap was already
a March no-op) — byte-identical output. Every other VAT workbook changes:
K/B/external cached values roll to its own year, and non-March Ltd Vatinterface
formulas revert to template rows `B6..B36` (+`B38`).

## Tests

New file `app/test/vat-quarter-dropdown.test.js`, picked up by the existing
vitest glob (`app/test/*.test.js`) and run by `npm test` — no wiring needed.
JSZip only (no LibreOffice), reusing `buildSheetMap`/`readCellValue` exports
from `app/lib/spreadsheet-runner.js` where useful. It walks
`packages/*/Vatreturns.xlsx` and `packages/*/Vat.xlsx` and asserts, per
workbook:

- each VATQtr sheet's `G5` validation is `type="list"` over `$K$2:$K$15`, and
  the `G5` cached serial is a member of the `K2:K15` cached serials;
- chain consistency: each `K` cell's cached value equals the cached value of
  the cell its formula names (`Vatinterface!B{n}` or `[1]Admin!$B$r`), each
  Vatinterface `[1]Admin!$B$r` cached value equals the `externalLink1.xml`
  cached `B{r}`, and every referenced external row exists in the cache.

This is red against today's catalogue and green after regeneration; it would
have caught `b5d1ff15`. A unit test in `generate.test.js` covers
`setCellCachedValue` (formula preserved, byte-stable on unchanged value, throws
on missing cell/`<v>`).

## Rollout

Baseline facts: the generate workflows had all triggers disabled 2026-05-07
(mass-commit flagging incident); `workflow_dispatch` was re-enabled on the
remote and a baseline `generate-ltd` run against the unfixed generator
completed 2026-08-23, self-committing `aee30466` to main. Its diff: 51 files
added (three new dirs — Company Jul27/Aug27/Sep27, 39 xlsx, born with the
frozen dropdown: verified Sep27 ships `K2=45777`, `G5=46387`), 187 modified —
174 package guide PDFs and 13 `examples/ltd-latest` files, **zero package xlsx
modified**. Workbook generation is therefore proven deterministic and the
byte-identical criterion is sound; PDF guides and examples churn on every run
and are excluded from it.

Publication path (operator decision, 2026-08-24, cycle proven with the
baseline generate + manual deploy run 32675858310): **generate and deploy run
from `main`**. The generate bot's `GITHUB_TOKEN` push cannot trigger
`deploy.yml`, so deploy is dispatched manually after regeneration. The
catalogue guard test therefore lands in a second PR after regeneration, so
`main`'s suite is green at every commit.

1. `git fetch && git merge --ff-only origin/main`; branch
   `claude/vat-quarter-dropdown`.
2. **PR 1 — generator fix**: generator.js changes, meta.toml, docs, unit tests
   (suite green; the catalogue guard test is NOT in this PR). Byte-identity of
   Mar26/SE-Apr26 proven locally before the PR. Operator merges.
3. Dispatch `generate-ltd` and `generate-se` on `main`: the fixed generator
   regenerates the catalogue and self-commits to main (`workflow_dispatch`
   enabled on both).
4. Verify the regenerated catalogue on main (Verification criteria below).
5. Operator dispatches `deploy.yml` (manual, as proven): Maven verify,
   `build-packages.js` → zips + `catalogue.toml`, CDK deploy,
   `aws s3 sync target/zips/ --delete`, smoke test.
6. Post-deploy: download an affected zip from the live site (Mar27 Company),
   unzip and confirm `K2:K15` = Apr26..May27 in the shipped artefact; run
   `npm run test:spreadsheetsBehaviour-prod`.
7. **PR 2 — catalogue guard test** (`app/test/vat-quarter-dropdown.test.js`),
   green against the regenerated catalogue. Operator merges. This is the
   permanent regression guard; it stays red-capable for any future stale year.
8. Dispatch `generate-ltd` once more against main: it must commit nothing for
   xlsx (determinism check of the fixed generator).

## Customer remediation

Interim workaround (operator-verified 2026-08-24, pending the surface-4
regeneration): open `Financialaccounts.xlsx` first — its Admin dates
recalculate from the correct year-end — then open `Vatreturns.xlsx`; the
dropdown covers the right period. Saving Financialaccounts once makes the
correction stick for future opens.

Philippe was never blocked from filing. He replied on 2026-08-24: "All was
fine when I submitted end of July." He filed before the deadline, the draft
reply is obsolete and will not be sent.

The bug was real and worth fixing on its own merits. But this plan should not
be read as a customer having been unable to file, because that did not happen.

Six Company Accounts donors since April 2026 fall in the affected window;
notifying them is the operator's call and is the only item left here.

Corpus sweep (mail-support since 2026-05-01; hybrid queries: "VAT period ends
drop down", "drop down menu dates", "June 2026 VAT", "can't submit VAT return
date", "VAT return shows zero quarter", "VATQtr", "dropdown does not contain
the month"): the only match for this symptom is Philippe's own thread
(2026-07-13 and 2026-07-14). No other customer has reported it.

## Verification criteria

- Regenerated Mar26 `Vatreturns.xlsx` and SE Apr26 `Vat.xlsx` are byte-identical
  to their `aee30466` versions (`git diff` empty for those paths after step 3).
- Mar27 `VATQtr1` dropdown source `K2:K15` = 2026-04-30..2027-05-31, contains
  2026-06-30, and `G5` defaults to it.
- Jun26 `Vatreturns.xlsx`: Vatinterface references are back to
  `[1]Admin!$B$6..$B$38`; `externalLink1.xml` `B6..B38` = 2025-05-31..2026-09-30;
  `K2:K15` = 2025-07-31..2026-08-31; all five `G5` defaults are members.
- `app/test/vat-quarter-dropdown.test.js` reports 0 failures across all VAT
  workbooks in the catalogue (97 at `aee30466`, plus any year-ends the cutoff
  has since admitted).
- Step 7's workflow run commits no xlsx changes.
- Live-site zip and `test:spreadsheetsBehaviour-prod` checks in Rollout step 6
  pass.
