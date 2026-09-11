<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->
<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->

# PLAN: Test strategy

The default test command must be both cheap and complete. Those are only in tension while the
default is a fixed set of files. Make the default a function of the diff and the tension goes away:
a one-file change gets a one-minute run, a generator change gets the LibreOffice tier whether or not
anyone remembered to ask for it.

Every recommendation below is a mechanism. None of them is a rule an agent has to recall.

---

## 1. What `npm test` should be

`npm test` becomes a wrapper, `scripts/test-scope.mjs`, that reads the diff against the merge base
with `origin/main`, maps changed paths to gates, runs them in cost order, and prints one verdict
line from exit codes.

```
npm test                  # escalate on the diff (the default an agent types)
npm test -- --all         # everything runnable locally
npm test -- --base HEAD~1 # a different comparison point
npm test -- --plan        # print the plan and the estimate, run nothing
```

### Tiers

| Tier | Contents | When it runs | Cost |
|---|---|---|---|
| 0 gates | `extract-scenarios` sync check, `parity:diya-gl`, `prettier --check` | always | ~2m |
| 1 unit | vitest files reached from the diff through the import graph, LibreOffice files excluded | always | seconds to 3m |
| 2 calc | the LibreOffice-gated files for the products the diff reaches | generator, template, tax data, fixture or engine change | today 6-14m per product; ~1m BST or Taxi, ~3m SE, ~4m Ltd once section 5 lands |
| 3 browser | the Playwright specs for the pages the diff reaches | `diya-gl/`, `web/**/public/**` change | 30-65s per spec. Ltd is 9 specs, Taxi 7, SE 4, BST 2, shared 18 |
| 4 infra | `./mvnw verify`, `cdk:synth` | `cdk-spreadsheets/`, `pom.xml`, `infra/` change | ~2m |

Tier 0 always runs because it is flat-cost and because one of this session's three CI reds lived
there, behind a command no vitest run reaches. Tiers 1-4 are selected, not skipped: a tier is absent
only because nothing in the diff reaches it.

### Target wall clock

| Change | Tiers | Target |
|---|---|---|
| Docs, workflow, script | 0 (+4 if infra) | under 2m |
| One page or one browser asset | 0, 1, 3 | under 4m |
| One product's generator or tax data | 0, 1, 2 (that product), 3 (that product) | under 8m |
| `app/lib/generator.js`, the shared engine, `spreadsheet-runner.js` | 0, 1, 2 (all four), 3 | under 20m |
| `--all` | everything but the full browser suite | under 20m |

The last row is the ceiling, and it is roughly what CI already achieves in `app-test` (19m). If the
default ever costs an hour again it is because tier 2 regressed, not because the design asks for
too much.

### Routing map

The wrapper carries this table. It is data, kept beside the script so a new gate is a table row.

| Changed path | Adds |
|---|---|
| `app/lib/generator.js`, `app/lib/spreadsheet-runner.js`, `app/lib/engine*` | tier 2 for all four products, roundtrip verify, parity |
| `app/products/<p>.js`, `app/lib/anchors/<p>.js` | tier 1 including `<p>-anchors`, tier 2 for `<p>`, parity, roundtrip verify, tier 3 for `<p>`. This row alone covers all three of this session's CI reds |
| `app/lib/**` (other) | tier 1 import-graph closure |
| `app/data/*.toml` | tier 2 for the products that read the file, parity |
| `app/data/render-unrepresentable/*.json`, `app/bin/report.js` output shape | tier 3 render-coverage specs for that product |
| `packages/**`, template xlsx | tier 2 for that product, roundtrip verify |
| `examples/**`, `app/test/fixtures/**` | tier 0 sync gate, tier 2 for that product |
| `app/bin/report.js`, `app/bin/export.js`, `app/bin/verify-*.js` | parity, roundtrip verify, tier 1 |
| `diya-gl/**` | parity, `smoke:diya-gl`, tier 3 diya-gl specs |
| `web/**/public/**.js` | tier 3 specs matching the page |
| `web/**/*.html`, `redirects.toml` | tier 3 content spec, `build:redirects` |
| `cdk-spreadsheets/**`, `pom.xml`, `infra/**` | tier 4 |
| `.github/workflows/**` | `lint:workflows` |

Product inference: a path or filename carrying `bst`, `se`, `ltd`, `taxi` narrows tier 2 and tier 3
to that product. A shared module narrows to nothing, so it takes all four. Unknown paths take
tier 0 plus the import-graph closure, never nothing.

### What makes the expensive tier happen

Four layers, each one closing a hole the layer above leaves.

1. **The default is the escalation.** The command an agent reaches for first, `npm test`, is the one
   that decides. There is no cheaper thing to type and no exception to forget.
2. **A tracked pre-push hook.** `.githooks/pre-push` runs `node scripts/test-scope.mjs --base
   origin/main` with `SKIP_LIBREOFFICE` stripped from its environment. Push is the one chokepoint
   every branch passes through on its way to CI, and it is where the scope must be the branch's
   whole diff rather than whatever the agent last edited.
   **Blocker to fix first:** this repo's `core.hooksPath` is set in `.git/config` to
   `/Users/antony/projects/diy-accounting-limited/diy-accounting/.git/hooks`, which does not exist,
   so every git hook in this repo and all its worktrees is currently a silent no-op. Repoint it at
   the tracked `.githooks` directory. Worktrees share the repo config, so one setting covers them
   all.
3. **`postinstall` sets `core.hooksPath=.githooks`.** A fresh clone or a new worktree gets the gate
   without anyone configuring it.
4. **Briefs stop naming test commands.** A brief that says "run `npm test` and `test:ltd-only`"
   caps the scope at whatever its author imagined. A brief that says "run `npm test`" cannot. This
   is the change that would have caught all three of this session's CI reds, because the wrapper
   would have added the parity gate, the anchors file and the Ltd browser specs that no brief named.

`SKIP_LIBREOFFICE=1` stays as a debug-loop escape hatch and loses its ability to lie: with it set the
wrapper prints `VERDICT: PARTIAL (libreoffice skipped)` instead of `GREEN`, and the pre-push hook
clears it from the environment so it cannot reach the push gate.

### Script audit

| Script | Verdict |
|---|---|
| `test` | becomes the wrapper |
| `test:unit` | vestigial, a byte-for-byte duplicate of `test`; delete |
| `test:fast` | delete the name. A cheaper default that an agent can type is the whole problem. `SKIP_LIBREOFFICE=1 npm test` remains available and now reports `PARTIAL` |
| `test:bst-only`, `test:se-only`, `test:ltd-only`, `test:taxi-only`, `test:reconciliation-only` | vestigial single-file aliases that read as product coverage and are not. `test:ltd-only` runs one of the nine Ltd calc files. Delete; the blast-radius command replaces them |
| `test:browser` | load-bearing (it carries the five build steps the specs need); keep, and let tier 3 call it with a spec filter |
| `test:spreadsheetsBehaviour-local` | load-bearing, gates the deployed-site contract, 1m in CI; keep |
| `test:spreadsheetsBehaviour-ci`, `-prod` | load-bearing post-deploy; keep |
| `parity:diya-gl` | load-bearing, promote into tier 0 |
| `parity:refresh` | load-bearing regeneration step; keep, and have the wrapper name it in the failure message when parity fails |

---

## 2. Why local is 3.8x CI, and the fix

| Run | Command | Workers | Duration |
|---|---|---|---|
| Local, 16 cores | `npx vitest run --project unit-tests --fileParallelism=false` | 1 | **4385s (73m)**, 153 files, 9444 tests |
| CI `app-test`, 4 vCPU | `npm test` | ~3 (vitest default) | **19m**, same tier |

3.8x, and the whole difference is local. Vitest attributed 99% of the local run to test bodies and
1% to imports, so the time is `soffice` process time, not module loading. That leaves exactly two
levers: run more of it at once, or run less of it.

CI's `app-test` job runs `npm test` verbatim (`.github/workflows/test.yml`, the `app-test` job,
step "Run tests"), with `libreoffice-calc` installed by an earlier step and `SKIP_LIBREOFFICE`
unset. There is no `--fileParallelism=false` anywhere in that file. CI runs the same 44 LibreOffice
files in parallel, and has been green doing it.

**The serial rule is over-applied.** The profile-lock hazard it was written for is already fixed in
the code: `runSpreadsheet` and `runMultiFileSpreadsheet` each build a work directory under `tmpdir()`
with a random suffix and pass `-env:UserInstallation="file://<workdir>/lo_profile"` to every
`soffice` invocation, so concurrent instances share nothing. What remains is resource contention,
which is a bounded-concurrency problem, not a serialise-everything problem.

The measured safe concurrency and the method are in section 8.

The same question is open one tier along. `playwright.config.js` pins both projects to
`workers: 1`, and `browser-test` is CI's longest job at 36 minutes for 457 tests. The behaviour
project needs `workers: 1`, since it drives one deployed environment. The `browser-tests` project
serves a static local server and may not. Measuring it is cheap: run one product's specs at
`--workers=1` and `--workers=4` and compare, the same method as section 8.

**Fix:** set the cap in `vitest.config.js`, not on the command line, so it is the default everywhere
and no one has to pass a flag:

```js
maxWorkers: Number(process.env.VITEST_MAX_WORKERS || 4),
```

CI keeps roughly the concurrency it already has. Local drops from 15 workers to 4, and from 1 worker
to 4 whenever someone was following the serial rule. Delete `--fileParallelism=false` from CLAUDE.md
and from every brief; it is now wrong in both directions.

---

## 3. The blast-radius command

```
node scripts/blast-radius.mjs [--base <ref>] [--json]
```

One command, no judgement, prints the test files and specs to run.

How it works:

1. `git diff --name-only $(git merge-base HEAD <base>) HEAD` plus `git diff --name-only` and
   `git ls-files --others --exclude-standard`, so uncommitted and untracked work counts.
2. Build the ESM import graph across `app/**`, `web/**`, `diya-gl/**` by parsing `from "..."` and
   `import("...")` specifiers, invert it, and walk transitively from each changed module to every
   test file that reaches it.
3. Match changed non-JS files (xlsx, toml, json, html, fixtures) by basename against every test
   file's literal strings, which is how fixture and template dependencies show up.
4. Apply the section 1 routing table for the gates no import graph can see: parity, roundtrip
   verify, browser specs.
5. Print, grouped by tier, with a cost estimate per group.

Guessing gave 2 files where `grep -rl` gave 17. The import graph gives the 17 without anyone
choosing, and the routing table adds the parity and browser gates that the 17 still miss.

**It belongs in `package.json`**, as `"blast-radius": "node scripts/blast-radius.mjs"`, for the
times an agent wants the list without running it. The wrapper in section 1 calls the same module
directly, so there is one implementation and the npm script is a thin view of it.

---

## 4. Where the cheap tier is blind

Four gates were named as the ones a product change silently breaks. Only two of them are actually
tier blindness. The other two are blast-radius failures, which is a different bug with a different
fix, and worth separating because the fixes do not substitute for each other.

| Gate | Where it lives | Does `test:fast` catch it | Diagnosis | Fix |
|---|---|---|---|---|
| Parity fixtures | `diya-gl/parity.sh`, against `examples/parity/<product>/{report.json,bookchecks.json}`. CI job `pack-diya-gl` | No, and no vitest file diffs against those fixtures at all | Real tier blindness, and cheap to close: the script needs no LibreOffice and takes 1-2 minutes | Tier 0, always |
| `isLtdInputCell` and the anchors test | `app/lib/anchors/ltd.js:612`, exercised by `app/test/ltd-anchors.test.js` | **Yes.** The anchors file is a plain vitest file with no `describeCalc` and no `SKIP_LIBREOFFICE` gate | Not tier blindness. The agent's guessed radius of 2 files simply missed it. `grep -rl` gave 17 | The blast-radius command in section 3 |
| Roundtrip budget | `app/data/roundtrip-budget.json` read by `app/bin/verify-roundtrip.js`. CI jobs `roundtrip-{bst,taxi,se,ltd}` | No. `verify-stability.test.js` is entirely LibreOffice-gated, and `verify-roundtrip.test.js`'s two end-to-end blocks are `skipIf(!hasLibreOffice())` | Partly tier blindness, partly a coverage hole: **`budgetBreaches()` is never called by any test.** The gate that decides pass or fail exists only as a CLI invocation in four CI jobs | Unit-test `budgetBreaches()` against synthetic counts. Seconds, tier 1, and it catches the comparison logic. The real numbers stay a tier 2 / CI concern |
| Render-key coverage | `data-r-key` attributes, asserted by `diya-gl-render-coverage.browser.test.js` and `diya-gl-ltd-render-coverage.browser.test.js` against `report.js`'s S2 key set and `app/data/render-unrepresentable/<product>.json` | No. Different command, different Playwright project, different CI job | Real, and irreducible in one half: the keys are built at runtime by the page's JS, so enumerating what renders needs a DOM | Tier 3 routes the two specs whenever the diff touches a product's report shape or its page. Add a node-only companion check that every key declared in `render-unrepresentable/<product>.json` still exists in S2, which catches stale declarations in seconds |

Two corrections to what tier 0 should contain.

**`reconciliation-check` does not belong in it.** The CI job greps committed `reports/*.md` for
`ANOMALYDETECTED`. Those reports are written by the separate `generate-*` workflows, not by
`test.yml`, so the job re-checks whatever happened to be committed and says nothing about the
current diff. A generator regression leaves it green until a `generate-*` run commits a bad report.
Leave it in CI as the cheap stale-report check it is; keep it out of the local default, where it
would be pure theatre.

**The `extract-scenarios` sync gate does.** `node app/bin/extract-scenarios.js && git diff
--exit-code app/test/fixtures/ examples/` is pure node, takes seconds, and catches hand-edited
generated fixtures. It is currently a step inside the `app-test` job and not reachable by any npm
script. Give it one: `"gate:fixtures"`.

One incidental finding, one line because it changes nothing today: `isLtdInputCell` has no
production caller. `app/lib/overtype-sidecar.js` wires up BST's `isBstInputCell` only, and nothing
passes the Ltd predicate as an override. It is a predicate proved solely by its own test.

---

## 5. What the 44 LibreOffice files buy

The cost-benefit question has one clean example. The 73-minute serial run ended with two failures,
both in `app/test/ltd-reconciliation-checks.test.js`. They were real and they were worth catching: a
change to the Ltd rate cells made the statutory comparison sensitive to the day split, so two JSZip
corruption tests correctly gained an entry in their expected failure set. The outcome of 73 minutes
was two lines in two expected arrays.

That is not an argument for deleting the file. It is an argument that the unit of escalation must be
the product, not the suite, and that the per-product cost has to come down far enough that running
it is cheaper than reasoning about it. Section 2's concurrency cap is the first lever. The second is
below.

### The cost model is soffice launches, not test counts

One `xslRoundtrip` is two `soffice` launches. `runSpreadsheet` is one roundtrip.
`runMultiFileSpreadsheet` is one per leaf, one for the hub, then up to four settle rounds guarded by
a cache signature. Per-recalculation anchors, from `verify-stability.test.js`'s own measurements:

| Product | Files | One recalculation |
|---|---|---|
| BST, Taxi | 1 | ~14s |
| SE | 9 | ~82s |
| Ltd | 13 | ~134s |

`it()` count tells you nothing. `ltd-reconciliation-checks.test.js` has 129 `it`s and costs one Ltd
recalculation, because every breakability check corrupts a cached `<v>` in a JSZip copy of the
already-recalculated package and re-runs pure JS. The files that actually multiply are the five
band sweeps, where the recalculation sits inside `it.each` instead of `beforeAll`:
`bst-income-tax-bands`, `se-income-tax-bands`, `se-profit-forecast-bands`, `taxi-income-tax-bands`,
`taxi-wages-forecast-bands`. Each looks trivial and costs 98-115s.

### The largest lever: two fixtures recalculated seventeen times

| Fixture | Recalculated independently by | Current | Shared |
|---|---|---|---|
| `se-scenario-advanced.toml` | 9 files: `se-admin-echo-checks`, `se-full-return-checks`, `se-payroll-calendar-checks`, `se-precision-code`, `se-profit-forecast-checks`, `se-purchases-mileage-route`, `se-reconciliation-checks`, `se-vat-localisation`, `payslips-payment-schedule` | ~738s | ~82s |
| `ltd-scenario-full.toml` | 6: `ltd-opening-balance`, `ltd-precision-code`, `ltd-reconciliation-checks`, `ltd-vat-localisation`, and `payslips-calendar-year-end` twice | ~804s | ~134s |
| `ltd-brickwork-pro-nonvat.toml` | 2: `ltd-brickwork-pro-nonvat`, `ltd-trial-balance-audit` | ~268s | ~134s |

Every one of these files recalculates and then only reads. The corruption checks already operate on
a JSZip copy of the saved package, so sharing the base recalculation changes nothing about what is
proven.

**Build a session-scoped recalculation cache**: key on fixture path plus product plus year-end,
write the recalculated package once to a shared scratch directory using the existing
`saveRecalculatedTo` option, and hand later requesters the file. Seventeen recalculations become
three. Estimated saving 20-25 minutes off the serial hour, and **no assertion is dropped**. This is
worth more than every file cut below put together, and it should be built first.

### Cut

| File or block | What is lost |
|---|---|
| `verify-roundtrip.test.js`, the "Export tuple against the original fixture" block (5 full `generate.js --data` builds, bst/taxi/se/ltd/ltd-may) | Nothing CI does not already do better. `roundtrip fidelity (<product>)` runs the same `generate` → `export` → `report` chain and diffs the whole report, where this block checks hand-picked score fields. Move it to a CI-only file rather than deleting it |
| `verify-stability.test.js` (~230s) | Nothing. It re-runs `verify-stability.js`, the exact script four CI jobs invoke, and covers one product fewer than CI does (no Taxi) |
| `se-workbook.test.js`, the final `describeCalc` block | Nothing. It shells out to the same `report.js --mode recalculate` plus `verify-roundtrip.js` pair CI runs, on one scenario |
| `bst-precision-code-reconciliation.test.js` | Nothing. Same fixture as `bst-precision-code.test.js` and a strict subset of its assertions, on its own separate recalculation. Fold anything valued into that file and delete this one |
| The five band sweeps, trimmed from 7-8 rows to the taper boundary plus a neighbour either side | Intermediate confirmation points, no distinct code path. Saves ~4 minutes. The better fix, later, is to write every row into distinct cells of one workbook and read all results from one recalculation, taking each file from ~100s to ~14s |

`bst-precision-code`, `se-precision-code`, `ltd-precision-code` and `taxi-sp-sixty` are each a
narrower version of their product's CI roundtrip job. They are the obvious next demotion, but with
the fixture cache in place their marginal cost is close to zero, so leave them until the cache is
measured.

### Keep

| File | Why nothing else covers it |
|---|---|
| `ltd-corporation-tax-checks` | FY splitting and marginal relief across leap years, straddling year-ends and profit levels. The JS engine computes FY splits independently, so it cannot prove the Excel formula |
| `ltd-vat-localisation`, `se-vat-localisation` | The straddling multi-return VAT cycle. Date-cycle behaviour with no JS reimplementation |
| `ltd-reconciliation-checks`, `se-reconciliation-checks` | The only proof that a named check reads the correct real cell off a real recalculated cross-file workbook. CI's report diff never localises a failure to a cell |
| The five band sweeps (trimmed) | The taper boundary that no shipped fixture's profit level reaches |
| `payslips-calendar-year-end`, `payslips-payment-schedule` | The June Ltd year-end and the payroll calendar against renamed month tabs. The dead `#REF!` cells these found were invisible on every previously recalculated package |
| `taxi-purchases-nag`, `taxi-vitaltax-checks`, `salesinvoice-product-details` | Narrow, cheap formula and text-layer regressions nothing else touches. `salesinvoice-product-details` is the model for the whole tier: 10 of its 12 tests are LibreOffice-free XML checks and only 2 need a recalculation |
| `ltd-prior-year-comparatives` | Sole test of the prior-year P&L column, and cheap because it recalculates the hub alone |
| `verify-roundtrip.test.js`, the "double roundtrip" block | No CI job runs two generate-and-export passes |

### What this buys

The 73-minute run's whole yield was two lines in two expected-failure arrays in
`ltd-reconciliation-checks.test.js`, and they were correct findings. With the concurrency cap and
the fixture cache, a Ltd escalation is one shared recalculation plus reads, in single-digit minutes.
At that price nobody has to weigh whether the finding was worth it.

---

## 6. Making progress visible

Two separate failures, two separate fixes.

**Never read a verdict off the output.** A truncated `tail` hid a `3 failed` header and a run was
reported green twice. Exit codes do not truncate. The wrapper captures the status of every child
process and ends with one line:

```
VERDICT: RED  unit 41/41 ok, calc(ltd) 7/9 ok, browser(ltd) skipped  8m12s
```

Nothing downstream ever needs to parse test output, so the tail-truncation class of error stops
existing. The same applies to any hand-run command: check `$?`, not the last twenty lines.

**Use a streaming reporter.** Vitest's default reporter detects a non-TTY stdout and buffers
per-file lines until the end. Measured during section 8's runs: two minutes into a live 150-second
leg, with files already finished, the piped log held one line, the `RUN v5.0.0` banner. A stalled
run and a healthy one produce identical logs. Vitest 5 ships `tap-flat`, `verbose`, `dot` and
`github-actions`. For anything over a minute:

```
npx vitest run --reporter=tap-flat ... 2>&1 | tee /path/run.log
```

`tap-flat` emits one line per test as it completes and is line-buffered, so the log grows while the
run is alive. The alternative, when the TTY reporter's summary is wanted, is a pty:

```
script -q /dev/null npx vitest run ... 2>&1 | tee /path/run.log
```

The wrapper uses `tap-flat` and also prints a heartbeat every 30 seconds naming the tier in flight
and its elapsed time, so a background run reports liveness even when the child is quiet.

Playwright: `--reporter=line` streams. Never `tail` it; take the exit code.

---

## 7. Rejected options

| Option | Why not | What would change my mind |
|---|---|---|
| Keep a fast default and tell agents to escalate | This is the status quo and it is the stated problem. The exception is never remembered | Nothing. Discipline is not a mechanism |
| Keep a thorough default and accept the hour | Agents will find the cheaper command, and an hour-long default gets killed mid-run and reported from a partial log | Tier 2 dropping to a couple of minutes, at which point the diff-aware wrapper is still strictly better |
| CI as the only complete gate | Already true, already failing: three reds in a row, each one the previous fix's blast radius. A CI round trip costs 19-36 minutes of wall clock and an agent's attention | Nothing, but CI stays the backstop. The wrapper reduces the number of round trips, it does not replace them |
| Split `npm test` per product (`test:ltd`, `test:se`, …) | Puts the routing decision back on the agent, which is the decision that was wrong. Product boundaries also leak: a Ltd change reaches shared fixtures, the roundtrip budget and the browser render keys | Products that genuinely shared no code, which these do not |
| Tag tests with `@slow` and filter | Same failure as `test:fast`: it is a cheaper thing to type. Tags also drift from what a test actually costs | A tag derived automatically from measured duration rather than written by hand |
| Run the LibreOffice tier nightly only | Feedback arrives after the branch has merged, and this repo already has a nightly schedule that nobody reads promptly. Delay is what turned one Ltd defect into three CI reds | Tier 2 becoming genuinely unaffordable per-branch, which the section 8 concurrency number says it is not |
| Mock LibreOffice | A recalculation test whose recalculation is mocked asserts the mock. The whole value of the tier is that real Excel semantics differ from the JS engine's | Nothing |
| Let the agent reason about the gated tier instead of running it | Tried this session, and it has a measured error rate. An agent that could not run `ltd-reconciliation-checks.test.js` predicted its expected failure sets by reasoning against the JS mirror, got most right and two wrong, and the branch went red. Reasoning is a fair way to draft an expectation, never a way to confirm one | Nothing. The answer is to make the tier cheap enough to run, which is what sections 2 and 5 are for |
| Drop `--fileParallelism=false` and set no cap | Tempting, because section 8's 15-worker run was as fast and as green as the 4-worker one. But six files can only put six recalculations in flight, so that run never tested 15 concurrent `soffice`. An explicit cap also makes CI and local agree instead of each inheriting its own core count | A full-tier run at the default on this machine, staying green. Until then the cap costs nothing measurable and removes an untested variable |

---

## 8. Concurrency measurement

Six LibreOffice-gated files, 92 tests, run five times on this machine (16 cores, 64 GB). Same six
files each time: `bst-sp-sixty`, `bst-income-tax-checks`, `taxi-purchases-nag`,
`se-admin-echo-checks`, `se-profit-forecast-checks`, `bst-brickwork-pro-nonvat`.

| Setting | Workers | Duration | Result |
|---|---|---|---|
| `--fileParallelism=false` | 1 | 272s | 92 passed |
| `--maxWorkers=2` | 2 | 150s | 92 passed |
| `--maxWorkers=4` | 4 | 145s | 92 passed |
| `--maxWorkers=8` | 8 | 146s | 92 passed |
| default | 15 | 149s | 92 passed |

**The deadlock did not reproduce at any setting.** Every run passed all 92 tests, exit code 0, no
timeout. Concurrent `soffice` processes were confirmed live at full CPU during the parallel legs.
The mechanism the serial rule was written for is already fixed in `app/lib/spreadsheet-runner.js`:
both runners create a random work directory under `tmpdir()` and pass
`-env:UserInstallation="file://<workdir>/lo_profile"`, so concurrent instances share no profile.

**Safe concurrency: 6 proven, 4 recommended.** The honest bound from this experiment is 6, because
six files can only put six recalculations in flight however high the worker cap goes. That is also
why the curve is flat past two workers: with six files the critical path is the slowest single file,
not contention. Recommend `maxWorkers: 4` in `vitest.config.js` with a `VITEST_MAX_WORKERS`
override. Four sits above CI's effective 3 and inside the proven-safe 6, and vitest's default of
`Math.max(availableParallelism() - 1, 1)` would otherwise mean 3 on CI and 15 here.

The confirming measurement, once the cap and the fixture cache land: one full `npm test` at
`maxWorkers=4` with LibreOffice present. Target is at or under CI's 19 minutes, on faster hardware
with more workers.

---

## 9. Order of work

1. Set `maxWorkers: 4` in `vitest.config.js`. Delete the serial rule from `CLAUDE.md` and from the
   `do-next` brief guidance; it is now wrong in both directions.
2. Build the shared recalculation cache (section 5). Biggest saving, drops no assertion.
3. Write `scripts/blast-radius.mjs`, expose it as `npm run blast-radius`.
4. Write `scripts/test-scope.mjs` on top of it, point `npm test` at it, add `gate:fixtures`, delete
   the vestigial scripts from section 1.
5. Repoint `core.hooksPath` at a tracked `.githooks`, add the pre-push hook, add the `postinstall`
   line.
6. Make the cuts in section 5, then run one full `npm test` to confirm the target in section 8.
7. Unit-test `budgetBreaches()` and add the stale-declaration check for
   `render-unrepresentable/<product>.json`.
8. Replace the "name those in the brief" paragraph in `.claude/skills/do-next/SKILL.md` with the
   routing table. A brief should name `npm test` and nothing else.
