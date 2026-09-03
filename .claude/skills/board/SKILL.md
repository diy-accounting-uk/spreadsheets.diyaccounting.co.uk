---
name: board
description: Render the open-work board — one table of every NEXT.md item that is in flight or open, plus anything finished in the current session, each with its source plan. Invoke when the operator asks for the board, the open items, or "what's in flight".
---

# board

Render the current work board from `NEXT.md` at the repo root. Read it fresh every time;
never render from memory of an earlier turn. There is no backlog file in this repo: the
plans of record (`PLAN_*.md` at the root) and `NEXT.md` are the only sources.

## Output shape

One table, then at most two closing lines.

| # | Item | Source | State | Status |

- `#`: the `NEXT.md` label where the entry carries one (a wave, a track id such as `T3`,
  a PR number); otherwise a running number in file order.
- `Item`: a short name, not the entry's full prose.
- `Source`: the plan the item comes from, as its file name (`PLAN_DIYA_GL_BST_CLI_MCP_WEB.md`),
  or `operator` for an instruction given in chat that no plan yet carries, or `none` for
  an item `NEXT.md` holds on its own. When a plan row is the direct result of an operator
  instruction, name the plan; the plan holds the assertion verbatim.
- `State`: exactly one of six values, hyphenated so it stays one token:
  - `done` — finished in the current session, and only then.
  - `in-flight` — being worked right now by an agent or the operator.
  - `ready-to-start` — never started; nothing prevents starting it, whoever the owner is.
  - `ready-to-resume` — started earlier (a branch, worktree, PR or partial commit exists,
    or `NEXT.md` says so), paused, and nothing prevents picking it up.
  - `blocked-to-start` — never started; waiting on a date, a prerequisite item, or a
    decision not yet made.
  - `blocked-to-resume` — started, paused, and something now prevents resuming: a
    prerequisite, a decision, or a conflict with work that landed since.

  Started means evidence, not intent: check `git branch -a`, `git worktree list` and
  `gh pr list` for the item's branch or PR before calling it resumable. Operator-owned
  work that could start today is `ready-to-start`, not blocked. Work the plan orders after
  another wave is `blocked-to-start` on that wave, and the status names it.
- `Status`: one clause, 12 words or fewer, current as of this render. Date-gated items
  name the date; blocked items name the blocker; in-flight items name the current step;
  done items name the commit. The narrative lives in `NEXT.md` and the plan, never here.

One row per distinct piece of work: a `NEXT.md` bullet that bundles several waves or
tracks becomes one row per wave, so an operator can see what can start or resume now.

## Rules

- Only work that is in flight, open, or finished in this session. Nothing done in an
  earlier session, decided against, or removed; `git log` holds those.
- Never annotate an item "deferred", "later", or similar. Status words describe state
  (open, in flight, blocked on X, operator-owned, date-gated), not priority.
- If a row cites a GitHub PR or issue known to be closed, drop the ref; run
  `gh pr list`/`gh issue list --state open` only when the answer would change a row.
- After the table: one line naming the plans `NEXT.md` lists as not tracked there, if
  any; and one sentence per item the session materially changed since `NEXT.md` was last
  written. No other commentary.
- **Write the statuses back.** After rendering, update any `NEXT.md` entry whose prose no
  longer matches the status just printed (same facts, fitted to the entry). A `done` row
  is removed from `NEXT.md`, not annotated. Commit the `NEXT.md`-only change to `main` (the
  docs exception allows a direct push) and push. Never add rendered status for items that
  are not on `NEXT.md`.
