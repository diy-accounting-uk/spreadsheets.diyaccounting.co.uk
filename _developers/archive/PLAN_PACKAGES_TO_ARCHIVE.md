# PLAN: fully formed packages move to the archive repository

An operator takes a **cut** of the generated packages and lands it in
`diy-accounting-uk/diy-accounting-archive` as one reviewed commit. A skill drives it,
not a workflow. Nothing runs on a schedule and nothing is bot-authored.

## User assertions (verbatim)

> fully formed packages from generated spreadsheets moved into the archive repository

> we do NOT need to automate this through the CI workflows

Two things follow and both are binding. The destination is
`diy-accounting-uk/diy-accounting-archive`. And nothing may reproduce the mass-commit
pattern, in this repo or in the archive repo.

## Inventory (verified 2026-08-30)

| Measure | Value |
|---|---|
| Package directories under `packages/` | 118 |
| Files in them | 1,559 |
| Bytes | 515.9 MB |
| Unique files by content | 481 |
| Unique bytes | 115.6 MB |
| Same tree committed to a scratch archive repo, after `git gc` | **41 MB** |

Products: Company 90, Basic Sole Trader 7, Self Employed 7, Taxi Driver 7, Payslip 05 7.
Year-ends span 2020-04-30 to 2027-09-30.

The archive repo already holds three package trees, all unpacked: `packages/` (821 files,
the pre-migration generated catalogue), `packages-archive/` (7,352 files, the
pre-migration proprietary source, grouped `GB Accounts <tax year>/`), and
`packages-generated/` (12 files, that repo's own BST generation output).

## What a cut is

Every **fully formed** package directory under `packages/` at one commit of this repo.
All products, all years. The whole catalogue is the unit, because a partial cut leaves
the archive with a half-recorded year.

A directory is fully formed when all four hold:

1. Its name parses with `parsePackageDir` and names a product in `PRODUCTS`.
2. It has no `DO NOT USE - WORK IN PROGRESS.txt`.
3. It contains at least one PDF — a `--skip-guide` run leaves none.
4. Its file list matches the other directories of the same product, comparing shapes
   with digits masked (`Financialaccountsto050421.xlsx` → `Financialaccountsto######.xlsx`).

Rule 4 derives the expected file list from the catalogue itself, so it needs no doc and
cannot drift. A directory that fails any rule is named, excluded, and the cut carries on.

**A cut is identified by the source commit SHA.** `--apply` refuses to run when
`git status --porcelain packages/` is non-empty, because then no SHA describes the
content that would be copied.

## Source: the unpacked tree, not the zips

The cut copies `packages/`, not `target/zips/`.

- Git dedupes and deltas the unpacked files: 515.9 MB of working tree becomes 41 MB of
  git objects. 118 zips would be 118 opaque blobs with no sharing between them, adding
  roughly 500 MB per cut.
- `target/zips/` is gitignored derived output that `deploy.yml` rebuilds on every deploy.
  There is no canonical zip byte stream worth preserving.
- Both existing archive package trees are unpacked, so a cut reads with the same tools as
  the rest of that repo.

## Destination layout

```
packages-published/
  MANIFEST.toml
  GB Accounts 2020-21/
    GB Accounts Basic Sole Trader 2021-04-05 (Apr21) Excel 2007/
    GB Accounts Company 2020-04-30 (Apr20) Excel 2007/
    …
  GB Accounts 2021-22/
  …
```

A new top-level directory. Not `packages-archive/`: that tree is the hand-maintained
pre-migration source, and its `GB Accounts 2026-27/` already holds a work-in-progress
`GB Accounts Company 2027-03-31 (Mar27) Excel 2007`, so the paths would collide outright.
`packages/` and `packages-generated/` are taken by that repo's own content.

The `GB Accounts <tax year>/` grouping follows the convention `packages-archive/` already
uses. A year-end before 6 April belongs to the tax year ending on that 5 April, so
`2027-03-31`, `2027-04-05` and `2026-12-31` all land in `GB Accounts 2026-27`.

Today's 118 packages fall out as 16 per tax year for 2020-21 through 2026-27, and 6
Company month-ends in 2027-28.

**`packages-published/MANIFEST.toml`** carries provenance, one entry per package:

```toml
[[packages]]
dir = "GB Accounts Company 2027-03-31 (Mar27) Excel 2007"
tax_year = "2026-27"
product = "Company"
files = 16
bytes = 4587520
digest = "1ff479773944…"
source_sha = "c66f415a…"
cut = "2026-08-30"
```

`digest` is the sha256 of the sorted `<sha256 of file>  <relative path>` lines for that
directory, so it ignores mtimes and read order. `source_sha` is per package, so a cut
that refreshes one product leaves the other entries pointing at the commit that really
produced them.

## Idempotency

Paths are stable, so a re-cut overwrites in place and git shows only what changed. A
package whose digest already matches is not copied and the manifest is not rewritten for
it — re-running an unchanged cut leaves the archive working tree clean.

A package directory that is updated is mirrored exactly: files removed upstream are
removed here, so a renamed workbook cannot linger and break the digest. A package that
has disappeared from `packages/` altogether is reported and **left in place** — the
archive keeps history.

## The helper

`scripts/archive-packages.js`. Dry run by default; it writes nothing without `--apply`,
and it never runs `git add`, `commit` or `push`.

```
node scripts/archive-packages.js                     # dry run, whole catalogue
node scripts/archive-packages.js --tax-year 2026-27  # dry run, one tax year
node scripts/archive-packages.js --product Company   # dry run, one product
node scripts/archive-packages.js --apply             # copy; the operator commits
node scripts/archive-packages.js --verify            # re-check the archive against its manifest
node scripts/archive-packages.js --archive <path>    # non-default archive checkout
```

It resolves the archive at `../diy-accounting-archive`, checks the remote really is
`diy-accounting-uk/diy-accounting-archive`, and fails if it is not.

## How the operator verifies a cut

Before committing, in the archive repo:

1. `node …/archive-packages.js --verify` — every copied directory hashes to its manifest
   entry. Proved breakable: appending one byte to one workbook makes it name that package
   and exit 1.
2. `git status --short packages-published | head` and `git diff --stat` — the changed file
   count matches the dry run's add + update columns, and nothing outside
   `packages-published/` moved.
3. `git diff -- packages-published/MANIFEST.toml` — the `source_sha` lines that changed
   are the ones expected.
4. Open one workbook from a changed package and confirm it loads.

## What stays in this repo

`packages/` stays tracked. Nothing in `.github/workflows/*`, `app/bin/build-packages.js`
or the deploy path changes. Every reader below takes the working tree as it is:

| Reader | What it does with `packages/` |
|---|---|
| `app/bin/build-packages.js` | Scans it, zips each dir to `target/zips/`, writes `catalogue.toml` |
| `app/bin/reconcile.js` | Reads `packages/<dir>/*.xlsx`, writes `reports/*.md` |
| `app/bin/verify-stability.js` | `--all packages/` finds the latest package per product |
| `app/test/formula-presence-guard.test.js` | Walks every `packages/*/*.xlsx`; asserts the directory count |
| `app/test/vat-quarter-dropdown.test.js` | Walks `packages/*/Vatreturns.xlsx` and `Vat.xlsx`; asserts the count |
| `app/test/vatinterface-month-links.test.js` | Same sweep, skips when empty |
| `app/test/generate.test.js` | Asserts `git status --short packages/` is unchanged after `--output-dir` |
| `.github/workflows/deploy.yml` | `npm run build:packages`, then `aws s3 sync target/zips/` |
| `.github/workflows/test.yml` | `packages/**` in `paths:` (twice); `build:packages -- --years 2` |
| `.github/workflows/generate-{bst,ltd,se,taxi}.yml` | `rm -rf packages`, generate, artifact round-trip, `git add packages/` |
| `.github/workflows/init.yml` | `git rm -rf --ignore-unmatch packages/` |

Untracking `packages/` needs three things this plan does not build: a way for
`deploy.yml` to obtain the tree it syncs to S3, a way for the three catalogue-sweep tests
to obtain it in CI, and a replacement for `generate.test.js`'s git-status assertion, which
becomes a check that cannot fail once the path is ignored.

The generate workflows keep committing `packages/` exactly as they do today, so restoring
their `push:` triggers is untouched by this plan.

## Steps to the end state

1. Land `scripts/archive-packages.js`, `.claude/skills/archive-packages/SKILL.md`, the
   `CLAUDE.md` skills line, and this plan.
2. `npm ci`, then dry-run the whole catalogue and read the excluded list. It should be
   empty; anything listed is a generation bug to fix before cutting.
3. First cut, one tax year at a time, oldest first: `--tax-year 2020-21 --apply`, verify,
   commit, then the next. Eight commits of roughly 200 files each, each one reviewable.
   The whole set costs the archive repo about 41 MB.
4. Push the eight commits to the archive repo's `main`.
5. Record the new `packages-published/` role in the archive repo's `CLAUDE.md`: it holds
   cuts of the live catalogue, taken by hand from the spreadsheets repo; do not develop
   there and do not edit `MANIFEST.toml` by hand.
6. Delete the `ARCHIVE_PACKAGES_TOKEN` Actions secret from this repo. No workflow reads
   it and the manual path needs no cross-repo credential.

After that, a cut is one dry run, one `--apply`, one verify and one commit — run when a
tax year's packages are finished, or whenever the operator wants the catalogue recorded.

## Alternatives rejected

**GitHub Release assets on the archive repo, written by the generate workflows.** The
previous shape of this plan. It needs a cross-repo token, a `publish` job in four
workflows, and a lock file committed here — the automation the operator took out of scope.
A manual cut needs no credential beyond the operator's own git access.

**Commit the zips instead of the tree.** Rejected on the numbers above: no sharing between
zip blobs, roughly 500 MB per cut against 41 MB.

**Write into `packages-archive/GB Accounts <tax year>/`.** Rejected: it would mix generated
output into the pre-migration proprietary source, and the 2026-27 paths already collide.

**Untrack `packages/` now.** Rejected: eleven readers take the working tree, and three of
them run in the deploy and test workflows with no other source.
