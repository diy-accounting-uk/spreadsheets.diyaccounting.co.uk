---
name: archive-packages
description: Take a cut of the generated spreadsheet packages and land it in diy-accounting-archive as one reviewed commit. Invoke when the operator says "archive the packages", "take a cut", "record the catalogue in the archive repo", or after a tax year's packages are finished.
---

# archive-packages — copy a cut of the catalogue into the archive repository

A **cut** is every fully formed package directory under `packages/` at one commit of this
repo, copied into `diy-accounting-uk/diy-accounting-archive` under
`packages-published/GB Accounts <tax year>/`, with provenance in
`packages-published/MANIFEST.toml`.

An operator or a Claude session runs this by hand. No workflow does it, nothing is
scheduled, and no commit here is bot-authored. Design and the numbers behind it:
`PLAN_PACKAGES_TO_ARCHIVE.md`.

> **Invoke it by telling a session:** *"Follow the `archive-packages` skill"*, or "take a
> cut of the packages into the archive".

## When to run this

- A tax year's packages are finished and should be recorded.
- A product regenerated and its packages in the archive are stale.
- The operator asks to archive the packages or names this skill.

Do **not** run it to fix a broken generation. A cut records what `packages/` holds; if the
packages are wrong, fix the generator and regenerate first.

## Before you start

- `packages/` must be committed and clean. `--apply` refuses a dirty tree, because then no
  commit SHA describes what would be copied. Check with
  `git status --porcelain packages/`.
- The archive checkout at `../diy-accounting-archive` must be on `main`, up to date, and
  clean. Never work in it from a worktree of this repo — pass `--archive <path>` if the
  checkout is somewhere else.
- `npm ci` here, so the helper can read TOML.

## Procedure

1. **Dry run the whole catalogue.**

   ```bash
   node scripts/archive-packages.js
   ```

   Read the two things it prints before anything else:

   - **The excluded list.** A package is excluded when its name does not parse, it is
     marked work in progress, it has no PDF guide, or its file list differs from the other
     packages of its product. Each is a generation bug. **Stop and fix it** — do not cut
     around it.
   - **The per-tax-year table.** `add` is new to the archive, `update` is content that
     changed, `same` is already there. A cut with everything in `same` has nothing to do.

2. **Apply one tax year at a time.** Oldest first, so a mistake shows up on the least
   interesting year.

   ```bash
   node scripts/archive-packages.js --tax-year 2020-21 --apply
   ```

   `--product <name>` narrows it further when only one product moved. Both filters are for
   a partial refresh; the default is the whole catalogue.

3. **Verify before committing.** In the archive checkout:

   ```bash
   node ../spreadsheets.diyaccounting.co.uk/scripts/archive-packages.js --verify
   git status --short packages-published | head
   git diff --stat
   git diff -- packages-published/MANIFEST.toml
   ```

   - `--verify` rehashes every directory the manifest lists and must report every package
     matching. A mismatch names the package; investigate it, never commit through it.
   - The changed file count matches the dry run's `add` + `update` columns.
   - Nothing outside `packages-published/` has moved.
   - The `source_sha` lines that changed are the ones you expected.
   - Open one workbook from a changed package and confirm it loads.

4. **Commit in the archive repo.** One commit per tax year, message naming the source
   commit:

   ```bash
   git add packages-published
   git commit -m "Cut published packages for 2020-21 from spreadsheets <sha>"
   ```

5. **Loop** to the next tax year, then push the commits to the archive repo's `main`.

## Idempotency

Paths are stable, so re-running a cut overwrites in place. A package whose digest already
matches is skipped and the manifest is not rewritten for it, so an unchanged re-cut leaves
the archive working tree clean. That is the check that a cut landed correctly: run it
again and expect nothing.

An updated package directory is mirrored exactly, so a workbook renamed upstream is
removed here rather than left behind. A package that has vanished from `packages/` is
reported and left in place — the archive keeps history.

## What NOT to do

- Don't let the helper or a session commit or push on its own. It writes files; the
  operator reviews and commits.
- Don't hand-edit `packages-published/MANIFEST.toml`. `--verify` compares the tree against
  it, so an edited manifest turns the check into a lie.
- Don't delete anything under `packages-published/`. Superseded content is the point of an
  archive.
- Don't write into `packages-archive/`, `packages/` or `packages-generated/` in the archive
  repo. Those are that repo's own pre-migration content and the paths collide.
- Don't develop product code in the archive repo — see its `CLAUDE.md`.
- Don't cut from a dirty `packages/`, and don't work around the check by committing
  generated output you have not reviewed.
- Don't add a workflow, a schedule or a trigger that runs this. The mass-commit pattern is
  what this design exists to avoid.
