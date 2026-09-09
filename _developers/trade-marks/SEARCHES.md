<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->
<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->

# Trade mark searches

Free clearance searches for the four marks, run on 2026-09-09, before any filing. Classes checked:
9 (downloadable software and data files), 42 (software as a service and hosting), 35 (accounting
and bookkeeping services).

## Tool access: what worked and what did not

Both search tools are JavaScript applications that render results in the browser after a form
submission. Neither exposes a URL that returns results as fetchable text, and neither has a public
API:

- **UK IPO search** (`https://trademarks.ipo.gov.uk/ipo-tmtext`): fetching the page returns
  HTTP 403 Forbidden. Tried twice on 2026-09-09.
- **TMview** (`https://www.tmdn.org/tmview/`): fetching the page returns no text content — an empty
  shell that only populates once its JavaScript runs. Tried on 2026-09-09.

Neither tool could be searched from here. Every search below is left for the operator to run by
hand, with the exact query string to paste. No result is recorded because none was obtained; this
file does not guess at hit counts.

## Searches to run: UK IPO search (trademarks.ipo.gov.uk)

Go to `https://trademarks.ipo.gov.uk/ipo-tmtext`, choose a word search, and run each query below
restricted to classes 9, 42 and 35. Record for each: the number of hits, and for every hit that
could conflict, the mark, the owner, the classes and the status (pending, registered, expired).

| # | Query | Classes | Result |
| --- | --- | --- | --- |
| 1 | `DIY ACCOUNTING` | 9, 42, 35 | not run — operator |
| 2 | `DIYA-GL` | 9, 42, 35 | not run — operator |
| 3 | `DIYA GL` | 9, 42, 35 | not run — operator |
| 4 | `DIYAGL` | 9, 42, 35 | not run — operator |

## Searches to run: TMview (tmdn.org/tmview)

Go to `https://www.tmdn.org/tmview/`, search each query below across all territories with the
United Kingdom in scope (TMview also surfaces EU and international registrations that could
conflict once EU/US filings are considered), restricted to classes 9, 42 and 35.

| # | Query | Classes | Result |
| --- | --- | --- | --- |
| 1 | `DIY ACCOUNTING` | 9, 42, 35 | not run — operator |
| 2 | `DIYA-GL` | 9, 42, 35 | not run — operator |
| 3 | `DIYA GL` | 9, 42, 35 | not run — operator |
| 4 | `DIYAGL` | 9, 42, 35 | not run — operator |

## What to look for

A hit conflicts if it is a live UK (or, for TMview, EU/international designating the UK) mark in
class 9, 42 or 35 that is the same word, or close enough in sound or meaning to cause confusion,
covering software, SaaS, hosting, accounting or bookkeeping. A dead mark (expired, withdrawn,
refused) does not block a new filing but is worth noting if it shows the term was tried before.

Before filing any of the four applications (H-LU-4), run these eight searches and fill in this
table with the real results.
