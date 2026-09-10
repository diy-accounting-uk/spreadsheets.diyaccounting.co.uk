<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->
<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->

# PARKED

Discoveries held out of the board while cool-down is on. One line each, enough to pick up later.
The operator triages this list when cool-down lifts: each line becomes a board row or is deleted.

- **The generate workflows can cancel each other through a shared group.** `generate-bst`,
  `generate-se`, `generate-taxi` and `generate-ltd` each carry `group: <product>-packages-${{ github.ref }}`
  with `cancel-in-progress: true`, and each is a callee of both `generate-all.yml` and `init.yml`.
  A reusable workflow evaluates its concurrency in the caller's context, so a delegated call and a
  standalone run of the same generator on the same ref share one group and one kills the other.
  Latent: nothing has failed, because the generators' push triggers are disabled and they run by
  dispatch or schedule. Submit hit the live version of this in their `test.yml` and fixed it by
  adding `github.workflow` to the group key. Their B93 and the `/watch` skill's fourth case.

- **Every prod deploy leaves main untested, and the loop does not terminate.** The publish job
  commits a version roll with the default `GITHUB_TOKEN`, which fires no workflow, so main's HEAD
  is always a bot commit with no runs after a successful prod deploy. Dispatching a deploy to close
  the gap publishes again and opens a new one. Measured: the deployed releases page reports 10
  releases while main records 11, so the published page trails npm by exactly one, permanently.
  Not a CI failure. Either accepted (the next real push carries it) or the publish job stops
  committing the roll.

- **`/watch` has a fourth not-a-failure case to add**, from Submit: a cancelled run can be a
  workflow cancelling itself, when a caller and its reusable callee share a concurrency group. The
  tell is a cancellation whose replacement you cannot find, followed seconds later by the same jobs
  running under a different workflow name. Wants adding to both repositories' copies of the skill.

- **The account button's accessible name.** An agent proposed setting `aria-label` on
  `#account-btn` to the signed-in email while the visible label reads "Account". That was dropped
  as unrelated scope and it is the wrong fix, but the underlying question is real: the accessible
  name and the visible label should agree.
