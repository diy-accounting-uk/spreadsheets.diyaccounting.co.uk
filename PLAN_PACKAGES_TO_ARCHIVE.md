# PLAN: fully formed packages move to the archive repository

Status: **specified; Phase 0 met, one unit delivered.** The rest is unstarted and this
document is the spec.

- **Done:** `ARCHIVE_PACKAGES_TOKEN` exists as an Actions secret on this repo, and the
  archive repo is not flagged archived. The dead `scripts/build-packages.cjs` is deleted
  and its two live doc references corrected.
- **Not started:** everything else. No tooling, no workflow changes, nothing published,
  `packages/` still tracked.

## User assertions (verbatim)

> fully formed packages from generated spreadsheets moved into the archive repository

Supporting requirement, from `../PLAN_MIGRATION_FOLLOWUPS.md`:

> **Spreadsheets generated artefacts out of git** (S3 or GitHub Releases) so the
> per-product generate workflows can run on push again without the mass-commit
> pattern that contributed to the flagging incident.

Two things follow and both are binding. The destination is
`diy-accounting-uk/diy-accounting-archive`, not S3 and not a bucket. And whatever
carries the packages there must not reproduce the mass-commit pattern, in this repo
or in the archive repo.

## Current state (verified 2026-08-25)

**Weight in git.**

| Measure | Value |
|---|---|
| Files tracked under `packages/` | 1,559 |
| Blob size of those files | 494 MB |
| Working tree `packages/` | 497 MB |
| Total files tracked in the repo | 2,312 |
| `.git` | 1.2 GB |
| Commits that touch `packages/` | 139 |

So `packages/` is 67% of tracked files and about 99% of tracked bytes.

**Package inventory**, 118 directories:

| Product | Directories | Approx size each |
|---|---|---|
| Company (Ltd) | 90 | 5.0 MB |
| Self Employed | 7 | 3.5 MB |
| Basic Sole Trader | 7 | 2.6 MB |
| Taxi Driver | 7 | 2.7 MB |
| Payslip 05 | 7 | 344 KB |

**Generation.** Four workflows: `generate-bst.yml`, `generate-ltd.yml`,
`generate-se.yml`, `generate-taxi.yml`. All four are enabled but all four have their
`push:` trigger commented out, with the same comment: the workflow self-commits 50 to
300 generated Excel files per run, and combined with a daily schedule that produced
the bot-authored mass-file-change volume that contributed to the 2026-05 flagging
incident. Only `generate-ltd.yml` still has a schedule, monthly on the 25th, kept
partly to hold the repo above GitHub's 60-day inactivity threshold. The others run on
`workflow_dispatch` or `workflow_call` only.

Each of the four ends in a `commit` job that does `git add packages/ reports/ examples/`
and pushes to the current ref, with a `git pull --rebase` and a retry loop.

**Consumers of `packages/` inside this repo:**

| Consumer | What it does with the tree |
|---|---|
| `app/bin/build-packages.js` | Scans `packages/`, zips each dir into `target/zips/`, writes `catalogue.toml` |
| `app/lib/package-builder.js` | Pure functions: dir-name parsing, catalogue TOML. No I/O, no path knowledge |
| `app/bin/reconcile.js` | Reads `packages/<dir>/*.xlsx`, runs scenarios, writes `reports/*.md` |
| `scripts/build-packages.cjs` | A stale byte-for-byte duplicate of `app/bin/build-packages.js` |
| `.github/workflows/test.yml` | `packages/**` appears twice in the `paths:` trigger; `behaviour-test` runs `build:packages -- --years 2` |
| `app/test/vat-quarter-dropdown.test.js` | Walks `packages/*/Vatreturns.xlsx` and `packages/*/Vat.xlsx` via JSZip, plus the sibling `Financialaccounts.xlsx` |

Nothing outside this repository consumes `packages/`.

**Deploy path.** `deploy.yml` runs `npm run build:packages` (which is
`app/bin/build-packages.js`), then `aws s3 sync target/zips/ s3://<bucket>/zips/ --delete`.
`catalogue.toml` is written into the CDK doc root and shipped with the static site.
Both `catalogue.toml` and `target/zips/` are already gitignored, so the site's runtime
inputs are already built, never committed. A separate `reconciliation-check` job reads
the committed `reports/*.md` and blocks the deploy on `ANOMALYDETECTED`.

**The archive repository.** `diy-accounting-uk/diy-accounting-archive`, public, 779 MB
`.git`, 8,612 tracked files including 821 under its own pre-migration `packages/`. Its
GitHub `archived` flag is deliberately off. It has no deploy workflow, has `test.yml`
and its own `generate-bst.yml` enabled, and has no releases at all. Its `CLAUDE.md`
says "do not develop here" and its `NEXT.md` says "None open."

### Three findings that change the shape of the problem

**1. `scripts/build-packages.cjs` is dead.** It duplicates `app/bin/build-packages.js`
line for line. `package.json` points every script at `app/bin/`. No workflow invokes
the `.cjs`. Only three documents still name it: `README.md` line 59,
`.claude/skills/package-updates/SKILL.md` line 292, and two archived plans under
`_developers/`. It gets deleted here rather than ported.

**2. Payslip 05 is not produced by `generate.js`.** There is no payslip product module
and no payslip template directory. The seven Payslip 05 package dirs are created by a
bash step inside `generate-se.yml` ("Create Payslip 05 packages") which copies
`Payslips.xlsx` and `Payslip User Guide.pdf` out of each Self Employed dir. Verified:
the Apr27 Payslip 05 `Payslips.xlsx` is md5-identical to the Apr27 SE one. Payslip 05
is a live catalogue product on the public site. Any design that publishes only what
`generate.js` writes drops a saleable product, so Payslip 05 rides with Self Employed
throughout this plan.

**3. `examples/*-latest` is the same problem at 1% of the size.** The same `commit` job
that pushes `packages/` also pushes `examples/<product>-latest/` (6.4 MB of generated
xlsx, rewritten every run). It is generated output committed to git, on the same
cadence, from the same job. Nothing reads it except two unit tests that already guard
with `it.skipIf(!hasBstLatest)`. It is folded into this change rather than left behind
as a smaller version of the thing being fixed. `examples/precision-code-ltd/` is hand
authored input data and stays in git untouched.

## What a fully formed package is

A fully formed package is one directory under `packages/`, named to the
`app/bin/build-packages.js` convention, containing every file a customer receives.
Nothing is assembled later. The zip of that directory is the product.

**Directory name**, from `app/lib/package-builder.js`:

```
GB Accounts {product} {YYYY-MM-DD} ({Mmmyy}) Excel 2007
```

matched by `PACKAGE_RE = /^GB Accounts (.+?) (\d{4}-\d{2}-\d{2}) \((\w+)\) (Excel \d{4})$/`.
The date is the year-end. The short label is month abbreviation plus two-digit year.
`{prefix}`, `{format}` come from `app/templates/meta.toml`; `{name}` and the pattern
itself come from each product's `meta.toml` `[output] dir_pattern`.

There is a second form, `ANY_RE`, for `GB Accounts Company {YYYY}-{YYYY} (Any) Excel 2007`,
where one directory fans out into monthly variants at zip time. No `(Any)` directory
exists today; Ltd generation writes 90 explicit month-end directories instead. That
code path is unexercised. Leave it in place, do not build on it.

**Directory contents, per product** (verified against the Apr27 / Mar27 packages):

| Product | Files |
|---|---|
| Basic Sole Trader | `Financialaccountsto{DDMMYY}.xlsx`, `Basic Sole Trader User Guide.pdf` |
| Taxi Driver | `Financialaccountsyearto{DDMMYY}.xlsx`, `Taxi Driver User Guide.pdf` |
| Self Employed | `Financialaccounts.xlsx`, `Sales.xlsx`, `Purchases.xlsx`, `Bank.xlsx`, `Cash.xlsx`, `Vat.xlsx`, `Payslips.xlsx`, `Fixedassets.xlsx`, `Salesinvoice.xlsx`, `Self Employed User Guide.pdf`, `Payslip User Guide.pdf` |
| Company | `Financialaccounts.xlsx`, `Sales.xlsx`, `Purchases.xlsx`, `Currentaccount.xlsx`, `Savingaccount.xlsx`, `Cashaccount.xlsx`, `Creditcardaccount.xlsx`, `Vatreturns.xlsx`, `Payslips.xlsx`, `Fixedassets.xlsx`, `Salesinvoice.xlsx`, `Companysecretary.xlsx`, `expensesform.xlsx`, `Dividend Voucher.docx`, `Company Accounts User Guide.pdf`, `Payslip User Guide.pdf` |
| Payslip 05 | `Payslips.xlsx`, `Payslip User Guide.pdf` (copied from the matching SE dir) |

The xlsx list for multi-file products is `[template] files` in that product's
`meta.toml`; the PDFs are `[output] guide_filename` and `[output] payslip_guide_filename`,
rendered by `app/lib/guide.js` from the product's markdown guide.

**Fully formed therefore means:** all template files written and transformed for the
target year-end, month tabs renamed, external link sheet names rewritten, both PDF
guides rendered. A directory generated with `--skip-guide` is not fully formed and
must never be published.

## Design

### Decision 1: the archive repo receives GitHub Releases, never commits

Each package is published as a **release asset on
`diy-accounting-uk/diy-accounting-archive`**. One release per product per publishing
run. Assets are one zip per fully formed package, plus a self-describing
`manifest.toml`.

Release assets live outside git object storage. Publishing 90 Ltd zips adds nothing to
the archive repo's `.git`, creates no commit, and produces one release event rather
than a 90-file bot commit. That is the whole point: it satisfies "moved into the
archive repository" while removing the exact pattern that caused the flagging incident,
rather than relocating it.

**Tag scheme:** `packages-<product>-<YYYYMMDD-HHMMSS>`, e.g. `packages-ltd-20260825-041732`.
UTC, taken from the workflow run start. Immutable. Releases are never deleted and never
have assets replaced; a correction is a new release.

**Asset naming.** GitHub rewrites spaces in release asset filenames. Do not rely on
that rewrite. Sanitise deterministically at upload:

```
asset = <dir name with every char outside [A-Za-z0-9._-] replaced by "_"> + ".zip"
```

The customer-facing name is the directory name, not the asset name. The S3 object and
the `catalogue.toml` `filename` field both use `<dir name>.zip`. The lock file (below)
carries both, so nothing has to reverse the sanitisation.

**Release body:** product, source commit SHA of the spreadsheets repo, package count,
total bytes, and the generating workflow run URL.

### Decision 2: the spreadsheets repo commits a lock file, and nothing else

`packages.lock.d/` at this repo root, one TOML file per product: `bst.toml`,
`ltd.toml`, `se.toml`, `taxi.toml`. Payslip 05 entries live in `se.toml`, because the
SE workflow produces them.

Separate files, not one shared file, so four workflows can land concurrently with no
merge conflict and no shared concurrency group.

```toml
# Written by .github/workflows/generate-ltd.yml. Do not edit by hand.
product = "ltd"
release_repo = "diy-accounting-uk/diy-accounting-archive"
release_tag = "packages-ltd-20260825-041732"
generated = "2026-08-25T04:17:32Z"
source_sha = "093178b0…"

[[packages]]
dir = "GB Accounts Company 2027-03-31 (Mar27) Excel 2007"
asset = "GB_Accounts_Company_2027-03-31__Mar27__Excel_2007.zip"
sha256 = "…"
bytes = 5242880
```

Entries carry only identity and integrity. Product name, date, short label and format
stay derived from `dir` by `parsePackageDir` exactly as today, so there is one source
of truth for that parsing.

**Commit shape and cadence.** One commit per generate run, touching at most four small
text files (`packages.lock.d/<product>.toml`, `reports/*.md`). A full Ltd run's lock
file is about 90 entries of four lines, roughly 20 KB of text. Compare with today: 50
to 300 binary Excel files, tens of megabytes.

**A no-op run commits nothing.** Zips are built with normalised mtimes so identical
content yields an identical sha256. The publish step compares the freshly computed
sha256 set against the current lock file. All matching means no release is created and
no commit is made. So a push-triggered run on an unrelated change is silent, and the
daily schedule that previously produced daily binary churn now produces nothing on a
quiet day.

**Determinism recipe**, used by `build-packages.js` before zipping each directory:

```bash
find "$dir" -exec touch -h -d "@${SOURCE_DATE_EPOCH}" {} +
( cd "$dir" && zip -r -X -D "$out" . -q -x "*/.git/*" "*.sh" )
```

`SOURCE_DATE_EPOCH` is the value already threaded through `generate.js --source-date-epoch`.
`-X` drops extra file attributes, `-D` drops directory entries, and the normalised
mtimes remove the last source of run-to-run byte drift.

### Decision 3: what stays in git

| Path | Decision | Reason |
|---|---|---|
| `packages/` | Untracked, gitignored | The 494 MB |
| `examples/*-latest/` | Untracked, gitignored, published as a release asset | Generated output on the same commit cadence |
| `examples/precision-code-ltd/`, `examples/brickwork-pro/`, `examples/sp-sixty-driving/` | Stays tracked | Hand-authored input data, small, not generated |
| `reports/*.md` | Stays tracked | 49 markdown files. `deploy.yml`'s `reconciliation-check` gate reads them from the checkout. Text, reviewable in a diff, not a mass-commit risk |
| `app/templates/**` | Stays tracked | Source, not artefact |
| `packages.lock.d/*.toml` | New, tracked | The pointer that makes any commit reproducible |

### Decision 4: deploy syncs the published zips, it does not rebuild them

Today `deploy.yml` re-zips `packages/` and syncs its own output to S3. Once the zips
are published artefacts, re-zipping creates a second set of bytes claiming to be the
same product. Instead the deploy downloads the published assets and syncs those. What
the customer downloads is then byte-identical to what the archive holds, and the sha256
in the lock file covers the whole path from generation to S3.

This splits the current `build-packages.js` into three tools with one job each:

| Tool | Direction | Used by |
|---|---|---|
| `app/bin/build-packages.js` | `packages/` tree → deterministic zips in `target/zips/` + `target/packages-manifest.toml` | Generate workflows only |
| `app/bin/fetch-packages.js` | lock files → `target/zips/` (and optionally an unpacked `packages/` tree) | Deploy, `prestart`, CI, developers |
| `app/bin/build-catalogue.js` | lock files → `web/…/public/catalogue.toml` | Deploy, `prestart` |

`app/lib/package-builder.js` is unchanged. `generateCatalogue()` already takes plain
records, and `parsePackageDir` already takes a directory name.

### Decision 5: the archive repository gains an active automated role

This is a real change to that repository's rules and must be written into its
`CLAUDE.md`.

**What is new:** the archive repo is the artefact registry for the live catalogue. The
spreadsheets repo's generate workflows create releases on it automatically. It is no
longer only history.

**What is unchanged:** do not develop product code there. Nothing deploys from there.
Its `packages/` tree, its 821 pre-migration files and its commit history are left
exactly as they are; this plan adds nothing to its git history.

**New invariants for that repo:**

- Automation writes **releases only**. Nothing in this design ever commits to it.
- Releases tagged `packages-*` are permanent. Deleting one breaks every spreadsheets
  commit whose lock file names it.
- The GitHub `archived` flag stays off. An archived repository rejects release
  creation.
- Its `test.yml` and `generate-bst.yml` keep exercising its own committed data. They
  are unrelated to this and are not touched.

**Prerequisite the operator must perform.** `GITHUB_TOKEN` cannot write to another
repository. The spreadsheets repo needs a secret granting `contents: write` on the
archive repo, named `ARCHIVE_PACKAGES_TOKEN`.

- Recommended: a **fine-grained personal access token**, resource owner
  `diy-accounting-uk`, repository access limited to `diy-accounting-archive` alone,
  permission **Contents: Read and write** and nothing else, 1-year expiry.
- Alternative: a GitHub App installed on both repositories, minting a short-lived token
  per run. Stronger (no long-lived credential, no expiry cliff) and more setup. Worth
  moving to if token rotation becomes a nuisance.

Either way only the operator can create it. Nothing else in this plan can be verified
end to end until it exists.

### Alternatives considered

**Commit the packages to the archive repo instead of releasing them.** Rejected. It
moves the mass-commit pattern to a second repository rather than removing it, and grows
an already 779 MB `.git`. The flagging heuristic is about bot-authored mass-file-change
commits, and it does not care which repo they land in.

**An S3 bucket in the spreadsheets account (064390746177).** Works, and the deploy
already has credentials there. Rejected as the primary: the operator named the archive
repo, and a public GitHub release also gives unauthenticated download for local
developers with no AWS role, plus a browsable permanent record. Keep as the fallback if
release asset volume becomes awkward: a full Ltd release is 90 assets and roughly
450 MB.

**Git LFS.** Rejected. Still one pointer commit per changed file per run, so the commit
shape is unchanged. Adds paid bandwidth and storage at 497 MB across many versions, and
adds an LFS dependency to every clone and every CI job.

## Consumer-by-consumer changes

### `app/bin/build-packages.js`

Becomes generate-side only. Keeps the `packages/` scan, the WIP skip, the `PACKAGE_RE`
/ `ANY_RE` dispatch and the `--years` filter. Changes:

- Zip deterministically per Decision 2 (normalise mtimes, add `-D`).
- Stop writing `catalogue.toml`. Write `target/packages-manifest.toml` instead, in the
  lock-file shape of Decision 2 minus `release_tag` (the publish step fills that in).
- Compute and record sha256 and byte length per zip.
- Accept `--product <bst|ltd|se|taxi>` so a per-product run manifests only its own
  directories. Without it, manifest everything found.
- Keep the hard failure when `packages/` is missing. Update the message to name
  `npm run packages:fetch`.

### `app/lib/package-builder.js`

No change.

### `app/bin/fetch-packages.js` (new)

```
node app/bin/fetch-packages.js [--product <p>|all] [--years N] [--tree] [--force]
```

1. Read every `packages.lock.d/*.toml`, or just the named product's.
2. Apply the `--years` cutoff against the date parsed out of each `dir`, same rule as
   `build-packages.js` uses today.
3. For each entry: if `target/package-cache/<sha256>.zip` exists and hashes correct,
   use it. Otherwise download
   `https://github.com/<release_repo>/releases/download/<release_tag>/<asset>`.
   The archive repo is public, so no token is needed. Cache by sha256.
4. Verify sha256. A mismatch is a hard failure naming the entry, the expected hash and
   the URL. No retry against a different tag, no fallback to a stale cache.
5. Copy each verified zip to `target/zips/<dir>.zip` (the un-sanitised name).
6. With `--tree`, also unzip into `packages/<dir>/`.
7. A release tag that 404s is a hard failure naming the tag, the lock file and the URL.

`--force` bypasses the cache. Downloads run with modest concurrency (4 at a time is
enough; the assets are 344 KB to 5 MB).

### `app/bin/build-catalogue.js` (new)

Reads the lock files, applies `--years`, parses each `dir` with `parsePackageDir`,
builds records `{product, date, shortLabel, format, filename: "<dir>.zip"}`, calls the
existing `generateCatalogue()` and writes `web/spreadsheets.diyaccounting.co.uk/public/catalogue.toml`.
No filesystem scan, no zipping. Fails hard if a lock file lists a `dir` that
`parsePackageDir` rejects.

### `app/bin/reconcile.js`

One line. The message at line 65, `"No packages/ directory. Run 'npm run build' first."`,
becomes `"No packages/ directory. Run 'npm run packages:fetch -- --tree' first (or 'npm run generate')."`.
Everything else is unchanged: in the generate workflows the tree exists in the same job
that just wrote it.

### `scripts/build-packages.cjs` — done

Deleted, with `README.md` and `.claude/skills/package-updates/SKILL.md` repointed at
`app/bin/build-packages.js`. When the new tools land, those two references move again to
`app/bin/fetch-packages.js` and `app/bin/build-catalogue.js`. The `_developers/` archived
plans still mention it and are left alone; they are history.

### `app/test/vat-quarter-dropdown.test.js`

This is the awkward one. The sweep walks every `packages/*/Vatreturns.xlsx` and
`packages/*/Vat.xlsx` plus each sibling `Financialaccounts.xlsx`: 97 workbooks across
97 directories. Hydrating that in `test.yml` on every push would mean downloading
roughly 470 MB per run to guard artefacts that push did not change.

**What it reads instead, and where that comes from:** the same tree, at the moment it
is actually written. The four generate workflows already run `npm test` immediately
after generating into `packages/`. That is the point the guard protects, and there the
tree is present with no download at all.

The change is a two-mode contract:

- Discovery finds no populated `packages/` → the whole per-workbook `describe` block is
  skipped, following the `it.skipIf(!hasBstLatest)` precedent already in
  `app/test/xlsx-reader.test.js`.
- `REQUIRE_PACKAGES=1` in the environment → an empty discovery is a hard failure, with
  the existing message.

Then:

- The four generate workflows set `REQUIRE_PACKAGES=1` on their post-generation
  `npm test`. The sweep runs against the freshly generated catalogue and blocks the
  publish.
- `test.yml`'s `app-test` job leaves it unset. The sweep skips. Push stays fast.
- A new `catalogue-guard` job in `test.yml`, on the daily schedule and on
  `workflow_dispatch` only (never on push, never on PR), runs
  `node app/bin/fetch-packages.js --tree` then `REQUIRE_PACKAGES=1 npm test`. The
  published catalogue gets swept once a day against the lock files that are actually
  live.

Update the file header comment to describe both modes. Do not name this plan file in
it.

### `.github/workflows/test.yml`

- Remove both `- 'packages/**'` lines from the `paths:` trigger. They are duplicated
  today and become dead. Add `- 'packages.lock.d/**'`.
- `behaviour-test`: replace `npm run build:packages -- --years 2` with
  `npm run packages:fetch -- --years 2` then `npm run build:catalogue -- --years 2`.
  The existing `ln -sfn ../../../target/zips …` symlink still works because
  `fetch-packages.js` populates `target/zips/`.
- Add the `catalogue-guard` job described above.
- Roundtrip jobs: see the `--output-dir` defect below.

### `.github/workflows/deploy.yml`

- Add `- 'packages.lock.d/**'` to the `paths:` push trigger, so refreshing the catalogue
  deploys it.
- Replace the "Build packages (zips + catalogue)" step with two:
  `node app/bin/fetch-packages.js` then `node app/bin/build-catalogue.js`. No `--years`;
  the deploy publishes the whole catalogue as it does today.
- The `aws s3 sync target/zips/ … --delete` step is unchanged. It now syncs the
  downloaded published zips rather than freshly built ones.
- `reconciliation-check` is unchanged. `reports/` stays in git.

### `.github/workflows/generate-{bst,ltd,se,taxi}.yml`

Each gets the same treatment.

1. **Restore the `push:` trigger.** Uncomment it verbatim, paths unchanged. Replace the
   "push trigger disabled" comment with one sentence explaining what makes it safe now:
   the run publishes a release and commits one lock file, and commits nothing when the
   content is unchanged. Do not delete the record of why it was off; move it to the
   commit message.
2. **New `publish` job**, between `reconcile-extra` and `commit`, gated on
   reconciliation success:
   - download the `<product>-packages` artifact into `packages/`
   - `node app/bin/build-packages.js --product <p>` → `target/zips/` + manifest
   - compare each sha256 with `packages.lock.d/<p>.toml`. All identical → set an output
     `changed=false` and stop.
   - otherwise `gh release create packages-<p>-$(date -u +%Y%m%d-%H%M%S) --repo diy-accounting-uk/diy-accounting-archive --title … --notes …`
     then upload every zip plus `manifest.toml`, using `GH_TOKEN: ${{ secrets.ARCHIVE_PACKAGES_TOKEN }}`
   - also upload `examples-<p>.tar.gz` containing `examples/<p>-latest/`
   - write the new `packages.lock.d/<p>.toml` and upload it as a workflow artifact
3. **`commit` job**, now conditional on `publish.outputs.changed == 'true'`:
   - drop `packages/` and `examples/` from the `git add`
   - `git add packages.lock.d/<p>.toml reports/`
   - commit message: `Publish <Product> packages <tag>`
   - keep the existing `git pull --rebase` and retry loop
4. `generate-ltd.yml` keeps its monthly schedule. It now no-ops silently when the
   catalogue has not moved.
5. The Payslip 05 step in `generate-se.yml` is unchanged and runs before `publish`, so
   Payslip 05 zips ride in the SE release and appear in `se.toml`.

**No trigger loop.** The push `paths:` filters name `app/data/*`, `app/templates/*`,
`app/products/*.js` and the workflow file. The commit touches
`packages.lock.d/` and `reports/`, neither of which is in any generate workflow's
paths list. Confirm this by reading each `paths:` block before enabling, not by
assuming.

### `package.json`

```json
"packages:fetch":  "node app/bin/fetch-packages.js",
"build:catalogue": "node app/bin/build-catalogue.js",
"build:packages":  "node app/bin/build-packages.js",
"prestart":        "node app/bin/fetch-packages.js --years 2 && node app/bin/build-catalogue.js --years 2 && ln -sfn ../../../target/zips web/spreadsheets.diyaccounting.co.uk/public/zips",
"regenerate":      "rm -rf packages && node app/bin/generate.js"
```

### `.gitignore`

Add `/packages/` and `/examples/bst-latest/`, `/examples/ltd-latest/`,
`/examples/se-latest/`, `/examples/taxi-latest/`. Do not use a broader `examples/`
pattern; the hand-authored fixture directories stay tracked.

## The developer experience

**Clean checkout, no `packages/`.** `npm start` works: `prestart` fetches the last two
years of zips (about 25 packages, roughly 60 MB) and builds the catalogue, then the
local server serves the download page against them.

**Working on workbooks.** `npm run packages:fetch -- --tree` gives the full unpacked
catalogue, roughly 500 MB, cached by sha256 in `target/package-cache/` so a second run
is free. `npm run packages:fetch -- --tree --product ltd --years 2` gives the subset
most work needs.

**Regenerating locally.** `npm run regenerate` is unchanged and still writes a real
tree into `packages/`. Nothing tries to commit it.

**Reconciling locally.** `npm run packages:fetch -- --tree` then
`npm run reconciliation`, or regenerate first.

## The `generate.js --output-dir` defect

`app/bin/generate.js` line 46 sets `const OUTPUT_DIR = resolve(ROOT, "packages")` as a
module constant. `generateProduct()` writes every package into it. `--output-dir` is
parsed at line 219 but only reaches line 333, `finalOutputDir`, which redirects the
**recalculated save** at the end of the `--data` injection path. The generated package
itself always lands in the repo-root `packages/`.

Consequences today: `test.yml`'s six roundtrip steps all pass `--output-dir target/…-pkg`
and all silently write real package directories into `packages/` as well. In CI that
just dirties a checkout nothing commits. Locally it overwrites a developer's tree
without saying so, and two concurrent runs race on the same paths.

It gets worse once `packages/` is untracked, which is why it belongs here rather than
in a separate task. A roundtrip run on a clean checkout would leave a partial
`packages/` of two or three directories, and `build-catalogue.js` would not notice, but
`reconcile.js` and the VAT sweep both discover by scanning that directory and would
happily treat the fragment as the catalogue.

**Fix.** Thread the resolved output root through instead of reading the module
constant:

- `parseArgs` already returns `outputDir`. In `main()`, compute
  `const outputRoot = outputDirOverride ? resolve(outputDirOverride) : OUTPUT_DIR;`
- Pass `outputRoot` into `generateProduct()` via its `opts` object and use it at line 92
  (`const outDir = resolve(outputRoot, dirName)`).
- Use `outputRoot` for the `mkdirSync` and the `console.log("Output:  ", …)`.
- In the `--data` block, `pkgDir` becomes `resolve(outputRoot, lastResult.dirName)`;
  `finalOutputDir` keeps its current meaning.

**Verification:** `node app/bin/generate.js --package bst --years se-2025-2026 --year-end 2026-04-05 --output-dir target/t --skip-guide`
on a tree with no `packages/` must leave no `packages/` behind, and
`target/t/GB Accounts Basic Sole Trader 2026-04-05 (Apr26) Excel 2007/` must contain the
workbook. Byte-identity: generating the same year-end with and without `--output-dir`
must produce identical files, so the fix cannot have changed any transform.

Nothing else changes. `test.yml`'s roundtrip steps already pass `--output-dir` and start
working as written.

## The history rewrite — a separate, optional decision

**Untracking `packages/` does not shrink `.git`.** `git rm -r --cached packages/` plus a
gitignore stops the growth. The 1.2 GB stays, because every historical blob is still
reachable. Every clone still pays it.

Reclaiming it means rewriting history. That is severable from everything above, and
nothing above depends on it.

**What it costs.**

- `git filter-repo --path packages/ --invert-paths --path examples/bst-latest --path examples/ltd-latest --path examples/se-latest --path examples/taxi-latest --invert-paths`
  over a fresh mirror clone, then force-push every branch and tag.
- Expected result: roughly 1.2 GB down to well under 100 MB.
- Every commit SHA after the first `packages/` commit changes. All 139
  package-touching commits are rewritten, and so is everything after them.
- Branch protection on `main` must be lifted for the force-push and restored after.
- Every existing clone becomes unmergeable and must be re-cloned. There are eight
  `claude/*` branches on the remote; each is either rewritten with the rest or
  abandoned.
- Any URL or commit reference into old history breaks: PR bodies, plan documents,
  issue comments, and the `corpus-loom` index's commit records for the `spreadsheets`
  source, which needs a reindex afterwards.
- GitHub keeps old objects reachable for a while. Ask GitHub Support to run `gc` on the
  remote, or the browsable size will not drop immediately.

**What it risks losing.** Nothing, if sequenced correctly. The archive repo already
holds the pre-migration package history in its own `packages/` tree. The post-migration
package content lives in the new releases. The only thing existing solely in the
rewritten history is the intermediate states, which nothing consumes.

**Recommendation: do it, but not with the main change.** Sequence it as a distinct
phase, after the main change has run a full generate-publish-deploy cycle and been
stable for a week, and only on a day the operator confirms no open PRs and no other
session has work in flight in that tree. Before rewriting, `git clone --mirror` to a
bundle and attach it to a `pre-rewrite-<date>` release on the archive repo. That gives
a one-command path back.

The main change is worth landing on its own: it stops the growth, restores
push-triggered generation, and gives every commit a reproducible artefact pointer. The
rewrite only reclaims disk.

## Phases

Nothing in Phase 1 or 2 changes what is tracked in git. `packages/` stays tracked until
Phase 3, so there is never a moment where the catalogue has no source.

### Phase 0 — operator prerequisite: met

`ARCHIVE_PACKAGES_TOKEN` is an Actions secret on this repo, and the archive repo's
`archived` flag is off. Note the secret must live under **Actions**, not Agents — they are
separate namespaces and a workflow cannot read the latter.

### Phase 1 — tooling (no behaviour change)

1. `generate.js --output-dir` fix.
2. `build-packages.js` rework: deterministic zips, manifest instead of catalogue,
   `--product`.
3. `fetch-packages.js` and `build-catalogue.js`.
4. `package.json` scripts.
5. Delete `scripts/build-packages.cjs`; fix `README.md` and the package-updates skill.
6. `reconcile.js` message.

At the end of Phase 1 the repo still builds and deploys exactly as before, because
`deploy.yml` has not been touched yet.

### Phase 2 — publish, then consume

7. `vat-quarter-dropdown.test.js` two-mode contract.
8. Generate workflows: `publish` job, `commit` job narrowed, `REQUIRE_PACKAGES=1`.
   **Leave the `push:` trigger commented out for now.**
9. **Bootstrap run.** Dispatch all four generate workflows manually, in order:
   bst, taxi, se, ltd. Each creates its first release and commits its lock file. After
   this the four lock files describe the whole live catalogue and `packages/` is still
   tracked, so the two can be compared.
10. **Equivalence check** (blocking): for every package, the zip built from the tracked
    `packages/` tree must have the same sha256 as the published asset. Any mismatch
    stops the phase.
11. `deploy.yml` switched to fetch plus catalogue. Deploy to ci, run the behaviour
    tests, then deploy to prod. `catalogue.toml` and the S3 zip listing must match what
    was there before, entry for entry.

### Phase 3 — untrack, and turn push back on

12. `git rm -r --cached packages/ examples/{bst,ltd,se,taxi}-latest`; `.gitignore`
    update. One commit. The working tree keeps the files.
13. `test.yml`: paths trigger, `behaviour-test` steps, `catalogue-guard` job.
14. Uncomment the `push:` trigger in all four generate workflows.
15. Docs: `README.md`, `CLAUDE.md` (Package Pipeline section), `NEXT.md` (the
    "Discipline" note about committed packages stops being true), and the archive
    repo's `CLAUDE.md` and `NEXT.md`.

### Phase 4 — optional, on the operator's word

16. History rewrite per the section above.

## Verification criteria

**Fully formed.** Every directory in every published release matches its product's file
list in the table above. Both PDF guides present for SE and Ltd. Zero packages
generated with `--skip-guide` published: assert on file count per product in the
publish step.

**Byte equivalence at the cutover.** For all 118 packages, the zip built from the
tracked tree at the bootstrap commit has the same sha256 as the published asset.

**Catalogue equivalence.** `catalogue.toml` produced by `build-catalogue.js` from the
lock files is identical to the one produced by the old `build-packages.js` from the
tracked tree, apart from the `generated = ` date line and the header comment.

**S3 equivalence.** After the first lock-file-driven deploy, `aws --profile spreadsheets s3 ls s3://<bucket>/zips/`
lists the same object names and the same sizes as before the change.

**Live download.** Fetch one zip per product from
`https://spreadsheets.diyaccounting.co.uk/zips/…`, unzip, confirm the file list, and
confirm its sha256 matches the archive release asset.

**No-op is silent.** Push a whitespace-only change to `app/products/bst.js`. The
generate-bst run completes, reports `changed=false`, creates no release, and creates
no commit.

**A real change publishes exactly one commit.** Change a tax rate in `app/data/`.
The run creates one release and one commit touching `packages.lock.d/<p>.toml` and
`reports/`, and no binary file.

**Integrity is enforced.** Corrupt one sha256 in a lock file locally and run
`fetch-packages.js`. It fails, names the entry, and does not write to `target/zips/`.

**Clean checkout.** `git clone` into an empty directory, `npm ci`, `npm start`. The
download page lists the current catalogue and a zip downloads and opens.

**Test suite.** `npm test` passes on a clean checkout with no `packages/` (VAT sweep
skips). `REQUIRE_PACKAGES=1 npm test` fails on that same checkout, and passes after
`npm run packages:fetch -- --tree`.

**Roundtrip isolation.** `node app/bin/generate.js --package bst … --output-dir target/t --skip-guide`
on a checkout with no `packages/` leaves no `packages/` directory.

**Repo weight.** After Phase 3, `git ls-files | wc -l` is about 750, down from 2,312.
After Phase 4 (if run), a fresh `git clone` is under 100 MB.

**Push triggers.** After Phase 3, a push touching `app/templates/ltd/**` starts
`generate-ltd`, and that run's own commit does not start another one.

## Wave plan

Model tiers: **mechanical** means a fast cheap model can execute it from this document
with no design left. **Subtle** means it needs judgement about bytes, determinism or
failure modes.

### Wave 1 — parallel, no shared files

| Unit | Files owned | Tier | Why |
|---|---|---|---|
| **U1 tooling** — `build-packages.js` rework, `fetch-packages.js`, `build-catalogue.js`, `package.json` | `app/bin/build-packages.js`, `app/bin/fetch-packages.js` (new), `app/bin/build-catalogue.js` (new), `package.json` | **Subtle** | Zip determinism, sha256 verification, cache invalidation and hard-failure behaviour. Every later unit depends on the CLI contract this fixes |
| ~~**U2 dead code**~~ — **done**, merged | — | — | Deleted, docs repointed at `app/bin/build-packages.js` |
| **U3 output-dir** — the `generate.js` fix | `app/bin/generate.js` | **Subtle** | Touches the generation path. Must be proved byte-neutral, not just working |
| **U4 archive rules** — the archive repo's changed role | `../diy-accounting-archive/CLAUDE.md`, `../diy-accounting-archive/NEXT.md` | **Mechanical** | Decision 5 supplies the wording. Different repository, zero overlap |

U1 is the long pole. U2, U3 and U4 are independent of it and of each other.

### Wave 2 — after U1's CLI contract is merged

| Unit | Files owned | Tier | Why |
|---|---|---|---|
| **U5 generate workflows** — publish job, narrowed commit job, `REQUIRE_PACKAGES=1`, push trigger left off | `.github/workflows/generate-{bst,ltd,se,taxi}.yml` | **Subtle** | Cross-repo auth, the changed/unchanged gate, and the no-trigger-loop check. A mistake here is the exact failure this plan exists to prevent |
| **U6 VAT guard** — two-mode contract | `app/test/vat-quarter-dropdown.test.js` | **Mechanical** | Guard the discovery result, honour one env var. The assertions are untouched |
| **U7 reconcile message** | `app/bin/reconcile.js` | **Mechanical** | One string |
| **U8 deploy + test workflows** | `.github/workflows/deploy.yml`, `.github/workflows/test.yml` | **Subtle** | Deploy is the customer-facing path. The equivalence checks are the real work |

U5, U6, U7 and U8 own disjoint files and run in parallel. U6 must merge before U5's
workflows set `REQUIRE_PACKAGES=1`, or the generate runs fail on a flag the test does
not know; if they run concurrently, merge U6 first.

### Wave 3 — strictly serial, one at a time

| Step | Tier | Why serial |
|---|---|---|
| Bootstrap: dispatch bst, taxi, se, ltd | **Subtle** | Each writes a lock file to `main`. Watch each finish before the next |
| Equivalence checks (byte, catalogue, S3) | **Subtle** | The go/no-go for the whole change |
| ci deploy, behaviour tests, prod deploy | **Subtle** | Customer-facing |
| `git rm --cached` + `.gitignore` | **Mechanical** | Two commands, but it must come after the deploy is proven |
| Uncomment the four `push:` triggers | **Mechanical** | Four uncomments. Last, so a mistake earlier cannot fire four workflows |
| Docs sweep: `README.md`, `CLAUDE.md`, `NEXT.md` | **Mechanical** | Wording is settled by this document |

### Wave 4 — optional, gated on the operator

| Step | Tier | Why |
|---|---|---|
| Mirror bundle to a `pre-rewrite-<date>` archive release | **Mechanical** | Two commands, one upload |
| `git filter-repo`, force-push, restore branch protection, reindex `corpus-loom` | **Subtle** | Irreversible without the bundle. Needs the operator present |

### Needs an operator decision

1. **Whether to run Wave 4 at all**, and when. Recommended, a week after Wave 3, on a
   day with no open PRs. The plan is complete and correct without it; skipping it only
   means the repo stays 1.2 GB to clone.

`ARCHIVE_PACKAGES_TOKEN` was the other decision and is now settled.
