<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->
<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->

# First-use evidence

Evidence of first use for the four marks, gathered 2026-09-09, kept in one place for the Right
Start applications' acquired-distinctiveness argument (twenty years of trading as DIY Accounting)
and for the DIYA-GL and Submit filings' own history.

## Companies House

Fetched from
`https://find-and-update.company-information.service.gov.uk/search?q=DIY+Accounting+Limited`:

- **DIY ACCOUNTING LIMITED**, company number 06846849, incorporated 13 March 2009, active,
  registered at 37 Sutherland Avenue, Leeds, England, LS8 1BY.

One unrelated result is worth noting for the search pack, not for this evidence: QUBE ACCOUNTANTS
LIMITED (company number 14183161, incorporated 20 June 2022) previously traded as "DIY TAX AND
ACCOUNTING LIMITED". It is a different company with a different business; it shows only that a
similar name existed and was later dropped.

## Domains: Wayback Machine

Fetched from `https://archive.org/wayback/available?url=<host>&timestamp=19960101`, which returns
the closest snapshot to that date — the earliest one the Wayback Machine holds:

| Host | Earliest snapshot | Snapshot URL |
| --- | --- | --- |
| diyaccounting.co.uk | 28 October 2006 | `http://web.archive.org/web/20061028174546/http://www.diyaccounting.co.uk:80/` |
| spreadsheets.diyaccounting.co.uk | 15 March 2026 | `http://web.archive.org/web/20260315231239/https://spreadsheets.diyaccounting.co.uk/` |
| submit.diyaccounting.co.uk | 14 March 2026 | `http://web.archive.org/web/20260314093117/https://submit.diyaccounting.co.uk/` |

The CDX API (`http://web.archive.org/cdx/search/cdx?...`), which would list every snapshot rather
than just the closest one, could not be fetched from here — the tool reports it cannot reach
`web.archive.org` (as opposed to `archive.org`, which the `/wayback/available` endpoint above
answered from). To get the full snapshot list and confirm there is nothing earlier than 2006 for
the main domain, run this by hand:

```
http://web.archive.org/cdx/search/cdx?url=diyaccounting.co.uk&output=json&filter=statuscode:200&limit=5
```

## npm: `@diy-accounting-uk/diya-gl`

`npm view @diy-accounting-uk/diya-gl time --json`, run 2026-09-09:

| Version | Published |
| --- | --- |
| 1.0.0 | 2026-09-08T01:48:17Z |
| 1.0.1 | 2026-09-08T06:46:09Z |
| 1.0.2 | 2026-09-08T08:54:49Z |
| 1.0.3 | 2026-09-08T20:13:59Z |
| 1.0.4 | 2026-09-09T00:53:55Z |

Package `created`: 2026-09-08T01:48:17Z. Later versions may since have published; re-run the same
command for the current picture.

## GHCR: `ghcr.io/diy-accounting-uk/diya-gl`

Fetched from `https://github.com/diy-accounting-uk/diya-gl/pkgs/container/diya-gl` (the GitHub API
route needs a `read:packages` token this session does not have, so this came from the public
package page instead):

| Tag | Published (relative to fetch time, 2026-09-09) |
| --- | --- |
| 1.0.4 (latest) | about 1 hour ago |
| 1.0.3 | about 6 hours ago |
| 1.0.2 | about 17 hours ago |
| 1.0.1 | about 19 hours ago |

These line up with the npm publish times above. Re-fetch the page for exact timestamps and any
tags published since.

## First git commits naming each mark

`git log --diff-filter=A --format='%h %cs %s' -S'<term>'`, run against this worktree and read-only
against `/Users/antony/projects/diy-accounting-limited/submit.diyaccounting.co.uk` and
`/Users/antony/projects/diy-accounting-limited/diy-accounting-archive`, oldest commit adding the
term in each repository. Generated and packaged output directories (`packages/`, `node_modules/`,
`target/`, `reports/`, `coverage/`, `videos/`) were excluded from the search — the term's first
appearance in source is what matters, not a build artefact that happens to carry it.

| Term | Repository | Earliest commit | Date | Subject |
| --- | --- | --- | --- | --- |
| DIYA-GL | spreadsheets | `413c14e6` | 2026-04-02 | Add PLAN_DIYA_GL.md — full business activity model for Ltd testing |
| DIY Accounting Submit | submit | `29f3d050` | 2025-07-14 | Add API documentation and initial HTML setup for VAT submission |
| DIY Accounting Spreadsheets | submit | `d09f063f` | 2026-02-02 | fix: update accessibility reports, improve lightbox functionality, and refine configuration settings |

`diy-accounting-archive` has no commit naming any of the three terms — it predates this branding,
which matches its role as the pre-migration spreadsheets repository.

The earliest hit for "DIY Accounting Submit" and "DIY Accounting Spreadsheets" both sit in the
`submit` repository rather than the repository each product ships from now — its gateway and shared
content named both products before each got its own dedicated build. `DIY Accounting Submit`'s
first commit, 14 July 2025, is the oldest dated evidence gathered here for any of the four marks.
