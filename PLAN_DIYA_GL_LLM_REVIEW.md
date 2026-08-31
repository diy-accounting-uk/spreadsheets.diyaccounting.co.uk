# PLAN: diya-gl LLM review — the model comments on the books

An extension of the BST books page (`PLAN_DIYA_GL_BST_SPIKE.md`): the page asks an LLM to
review the loaded accounts, comment, and propose fixes the user can select and apply. Split
into its own plan because it changes the page's trust claim, and that change has to be made
deliberately, not shipped inside a UI phase.

## User assertions (verbatim)

> feed in another idea [...] for a LLM review, we can find a compressed bedrock friendly format
> and send a request and use [bedrock-meter] to cap the spend on a public endpoint. The AI
> should review and comment on the accounts and propose fixes using a multi-turn and structure
> format so that the proposed fixes can be selected and the request submitted the yields a new
> compressed format diya-gl with the fixed.

> [bedrock-meter] is a LIBRARY used in the page, not a hosted endpoint the browser calls.

## The two things this changes, recorded first

**The trust claim.** The books page promises "Nothing is uploaded; the file never leaves your
machine." Any model call breaks that. So: the review is explicit opt-in per book, never a
default; the copy on the review control says plainly what is sent, to which model, and under
whose key; and the entry panel's no-upload promise gains the qualifier only when the review
feature ships, not before.

**Untrusted input reaches a model that proposes changes to tax figures.** An uploaded workbook
is attacker-controllable content — cell text, names, comments all flow into the compressed
format and from there into the prompt. Prompt injection is a first-class risk here, not a
footnote: a crafted workbook could try to steer the model into proposing fixes that misstate
tax. The guards below (schema validation, checks-must-still-pass) are load-bearing for exactly
this reason — a fix the model proposes is treated as hostile until it validates, previews, and
leaves the passing checks passing.

## Metering

The bedrock-meter library is bundled into the page. It wraps each Bedrock request, counts the
tokens spent, keeps the running total, and refuses further requests once the configured cap is
reached — the cap is enforced in-page by the library, and the spend state is shown beside the
review control so running out is never a surprise.

## The flow

- **Compressed format.** A Bedrock-friendly rendering of the book, small enough to review in
  one request: `documentInfo`/`entityInformation`, the monthly and category summaries the year
  table already computes, the check results, and individual lines only where a check flags them
  or a category is anomalous. Deterministic, versioned, round-trippable back to line edits.
- **Review turn.** The model reviews and comments on the accounts and proposes fixes in a
  structured response — a JSON list, each entry naming the lines it touches, the diya-gl edit
  it makes, and its reasoning. The page renders each comment with its proposed fix as a
  selectable item, in the same preview language the page's own helpers use.
- **Fix turn.** The selected fixes go back in a second request; the reply is a new
  compressed-format diya-gl carrying them. The page expands it to line edits, shows the diff as
  pencil annotations, and applies only on accept — through the same edit path as a hand edit,
  so recalculation, the checks panel and undo all cover it.
- **The guards (load-bearing).** A reply that fails schema validation is rejected with its
  reason shown. A fix that would take a passing check to failing is rejected the same way.
  Nothing applies without the user accepting the previewed diff.

`app/bin/judge-reconciliation.js` is the in-repo precedent for prompt shape and rubric tone;
the review prompt borrows its discipline (comment on what the figures show, never soften a
check).

## Sequencing

Starts only after the BST spike's phase 5 lands and its decision gate held. First step is the
compressed format and its round-trip test in Node — no page work and no model call until the
format is proven on the reconciliation scenarios.
