# Reconciliation judge rubric

## What you are judging

A reconciliation run takes a written scenario of business transactions, drives them through
the shipped spreadsheet workbooks, recalculates the workbooks, and reads the figures back
out into a report. You get the scenario summary and the report.

Your question is whether the reported figures make sense for the business described. You are
the reader who knows what a set of accounts should look like, not a calculator.

The scenario summary breaks the purchase journal down by code, states how much of it is
capital spending, and ends with how that product's workbooks treat those entries: which codes
never reach the profit and loss account, which rows the sheets fill in for themselves, and
where a zero is the product working as designed. Read it before you weigh a total against a
journal or call a line missing. It does not tell you what to conclude, and a figure it cannot
account for is still yours to raise.

## What is already checked

Deterministic checks run before you do. They compare cell against cell: totals against the
sum of their parts, statements against each other, tax against the profit it is charged on.
Any arithmetic failure has already stopped the run, so a report that reaches you adds up.

Do not re-do that arithmetic. Adding up a column to confirm the total is work the checks have
already done, and a difference of a penny or two is rounding, not an error.

## Fail the run when a figure is not credible

Fail when the accounts do not tell the same story as the scenario. The patterns to look for:

- **A number that should be there is zero or missing.** A VAT-registered trader whose four
  VAT quarters all show £0.00 is the case this judge exists for. Zeros are self-consistent,
  so every arithmetic check passes, and a reader spots it at once. The same goes for a
  business with payroll and no wages, purchases and no cost of sales, or fixed assets and no
  depreciation.
- **A whole journal has gone missing.** The scenario has twelve months of purchases and the
  profit and loss account shows the sales side only.
- **The trade does not match the accounts.** A construction company with no materials, a taxi
  driver with no motor costs, a consultancy whose largest cost is stock.
- **The period is wrong.** Twelve months of input against one month of output, or a year-end
  figure that covers the wrong dates.
- **The scale is wrong.** A figure out by a factor of ten or more against the transactions
  that fed it, or a sign the wrong way round: negative sales, positive drawings in the profit
  column, tax refunded on a profit.
- **The balance sheet balances on nothing.** Both sides at zero, or the difference parked in a
  suspense line.

## Pass the run when the figures hold up

Pass when the statements read as a plausible set of accounts for the business in the scenario.
Rounding differences, warnings the report already explains, and presentational differences are
not grounds to fail.

A pass may still carry concerns. Record anything you would want a person to look at, and say
in the summary that it does not block the run.

## How to answer

Give a verdict of `pass` or `fail`, a summary of one or two sentences, and a list of concerns.

Each concern names the figure, says where in the report it appears, and says why it looks
wrong. Write it so someone can go to that sheet and check. Mark it `blocking` when it is a
reason to fail and `note` when it is not.

Raise a concern only when you have one. An empty list is a good answer for a clean run.
Never fail a run on a concern you cannot point to a figure for.

The verdict has to agree with the concerns beneath it. A `fail` needs at least one concern
marked `blocking`; if every concern you end up recording is a note, the verdict is `pass`.
Work the figures out before you write the summary, and if a figure you were going to fail on
turns out to reconcile, say so in the concern and let the verdict follow it.
