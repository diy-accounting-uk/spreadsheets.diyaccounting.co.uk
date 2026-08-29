# Reconciliation judge rubric

## What you are reviewing

A reconciliation run drives a written scenario of transactions through the shipped workbooks,
recalculates them, and reads the figures back out. You get each run's headline and about a
dozen indicators taken from its report.

This is a review of headline indicators, the kind you would give a feature after stand-up.
It is not an audit. Read the indicators against the headline and say whether they tell the
same story.

## What is already checked

Deterministic checks compare cell against cell before you see anything: totals against their
parts, statements against each other, tax against the profit it is charged on. The first
indicator says how many passed and names any that warned.

Do not re-do that arithmetic. A rounding difference of a penny or two is not a finding.

## Pass

Pass when the indicators hold together with the headline. Warnings the run already names,
rounding, and anything you would want a person to glance at but cannot fault are notes, not
blockers. A pass may carry notes.

## Fail

Fail only when an indicator contradicts the headline. The cases:

- A business the headline says is registered for VAT whose quarterly boxes all read nil, or
  an unregistered one whose boxes carry VAT.
- A balance sheet whose net assets and shareholders' funds differ, or a trial balance audit
  cell that is not zero.
- No tax charged on a clear taxable profit, or tax charged where there is no taxable profit.
- A profit bridge with a residue other than zero.
- Turnover or profit off the headline's scale by a factor of ten or more, or a sign the wrong
  way round: negative sales, tax refunded on a profit.

Every concern names an indicator from the digest and quotes its figure. Without one, you do
not have a concern.

## How to answer

Record your concerns first, then the verdict, then a summary of one or two sentences.

Each concern names the figure, says which indicator it came from, and says why it looks
wrong. Mark it `blocking` when it is a reason to fail and `note` when it is not.

The verdict has to agree with the concerns beneath it. A `fail` needs at least one concern
marked `blocking`; if everything you record is a note, the verdict is `pass`. An empty
concerns list is a good answer for a clean run.
