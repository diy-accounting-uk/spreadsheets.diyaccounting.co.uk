# PLAN: the licensing and copyright uplift

Status: draft for the operator's approval. Nothing here is dispatched until the operator says go.
The cross-repository section is filled from a read-only audit of all five repositories.

## User assertions (verbatim)

- "The spreadsheets are the original work, what we have now in the generator is a templated version
  of a hand build spreadsheets package, you can tell this because the templates have all sorts of
  wierd shit in. This should be protected within the extend of AGPL and I want a general uplift on
  licensing and copywright before I increase exposure."
- "do I have to invite contibutions, I don't really want them. The source is viewable (open) but
  otherwise restricted."
- "I would like anyone to be able to download spreadsheets or use the hosted solution, but I don't
  want to someone to distribute the spreadsheets themselves or run my websites on their own brand."
- "so it's ok if the public hostname prod remains diyaccounting.co.uk so hosting unmodified would
  mean either being under my dns or violating my making a change but running localhost is fine."
- "I want people to be able to run the npm and docker locally for their own accounts, I would also
  like other people to be able to use the diya-gl specification freely."
- "My goal here is to maximse DIY Accounting Submit users, which then has paid tiers so this is
  valuable "bank exporters, agents and accountants' tools" anyone wiuth diya-gl will soon be able to
  file via DIY Accounting Submit and a forthcoming mcp extended by a bank would then have a way for
  customers to file via DIY Accounting Submit via the diy shipped bits in the foundational mcp."
- "Yes write PLAN_LICENSING_UPLIFT.md then review considering the scope of all of these
  repositories ... and feed back into this chat and PLAN_LICENSING_UPLIFT.md the full license
  uplift."

## The model

Three layers, chosen so the engine travels as far as possible (every embedded copy is a book that
files through Submit) while the original work and the hosted brand stay the company's.

| Layer | What it covers | Licence | Effect |
| --- | --- | --- | --- |
| The specification | The diya-gl format text (`diya-gl.html` and its builder), the two JSON schemas | CC BY 4.0 for the text; Apache-2.0 for the schemas | Anyone implements the format in anything, with attribution. |
| The engine | `diya-gl/` (npm package, CLI, MCP server, Docker image) and the engine modules under `app/lib` that the package bundles | Apache-2.0 | Embeddable anywhere without legal review; the patent grant and the NOTICE file keep the company's attribution in every copy. |
| The original work and the hosted product | The spreadsheets and their packages, `app/templates/`, the generator and build scripts, the web pages and site, the infrastructure | PolyForm Internal Use 1.0.0 plus one additional grant | Download and use for your own accounts, or your clients' accounts if you are an accountant. No redistribution. No hosting, and no hosting of a modified version under another name. Running on localhost is permitted use. |

The additional grant, one sentence, permits an accountant or bookkeeper to use the spreadsheets to
prepare accounts for their clients. It is bespoke and a solicitor reads it before it publishes
(H-LU-2). The recommendation that accountants are permitted users rests on each client being a
prospective Submit user; the operator confirms it at H-LU-1.

Copyright line everywhere: `Copyright (C) 2006-2026 DIY Accounting Limited`. The site says
"since 2006"; no individual is named in the notices.

The protection of the funnel is not in the engine's licence. Filing lands on Submit's servers, which
alone hold the HMRC credentials, the recognition and the billing. The engine's licence is chosen to
travel; the spreadsheets' licence is chosen to stay.

What the change does not do: versions of the npm package, the images and the packages already
distributed under the AGPL (npm 1.0.0 to 1.0.3, the images pushed with them, every zip downloaded
before the next generate run) keep the AGPL for those copies. New versions carry the new terms.
Moving the engine from AGPL to Apache-2.0 relaxes; moving the spreadsheets to PolyForm restricts,
and takes effect from the first generate run and deploy after this plan lands.

Words: the site, the package READMEs and the launch posts say "free to use, source available, open
specification". They never say "open source".

## Decisions the operator confirms at H-LU-1

1. The three layers as tabled.
2. Accountants preparing clients' accounts are permitted users of the spreadsheets.
3. No contributions are accepted; the README says so; no CLA or DCO is needed.
4. The copyright span 2006-2026 and the company as the only named holder.

## Task list

Machine rows are Sonnet unless stated. `LU-3` and `LU-6` share files with nothing else and run at
once; `LU-4` and `LU-5` follow `LU-1`. Every row lands by PR; `LU-5`'s regenerated packages land by
the operator's generate dispatches (H-LU-3).

| # | Task | Precursors | Model | Files |
| --- | --- | --- | --- | --- |
| LU-1 | The licence files: root `LICENSE` becomes PolyForm Internal Use 1.0.0 with the additional grant; `diya-gl/LICENSE` (Apache-2.0) and `diya-gl/NOTICE`; a licence file beside the schemas; `LICENSING.md` at the root mapping every directory to its layer, with the source offer and the copyright line | H-LU-1 | Opus for the additional grant and `LICENSING.md`; Sonnet for the rest | `LICENSE`, `LICENSING.md`, `diya-gl/LICENSE`, `diya-gl/NOTICE`, the schemas' directory |
| LU-2 | Manifests and metadata: `license` in `diya-gl/package.json` (Apache-2.0) and the root `package.json` (`SEE LICENSE IN LICENSE`); the Dockerfile's licence label; the CDK tags if any name a licence; README badges; the tap's formula picks the licence up from npm on its own | LU-1 | Sonnet | `diya-gl/package.json`, `package.json`, `diya-gl/Dockerfile`, `infra/`, READMEs |
| LU-3 | Headers: every source file's `SPDX-License-Identifier` matches its layer (`Apache-2.0` under `diya-gl/` and the bundled engine modules; `LicenseRef-PolyForm-Internal-Use-1.0.0` elsewhere) and the copyright line reads `2006-2026 DIY Accounting Limited`; a unit test walks the tree and fails on a missing or mismatched header | H-LU-1 | Haiku for the sweep; Sonnet for the test | every `.js`, `.mjs`, `.cjs`, `.java`, `.sh`, `.toml` source file; `app/test/licence-headers.test.js` (new) |
| LU-4 | Distributed copies carry their terms: the npm tarball ships `LICENSE` and `NOTICE` (automatic once LU-1 lands); every spreadsheet zip gains `LICENCE.txt` and `README.txt` (product, year, licence, copyright, source and download addresses); the Docker image inherits the tarball's files; the engine bundle and the single-file runner start with a licence comment | LU-1 | Sonnet | `app/bin/build-packages.js`, `scripts/build-books-bundle.mjs`, `scripts/build-runner.mjs`, their tests |
| LU-5 | The workbooks state their copyright: the generator writes `dc:creator`, `dc:rights` and the company name into every workbook's core properties; each product's front sheet gains a licence and copyright line in the template; the reconciliation gates prove nothing else moved | LU-1 | Sonnet; the template edit follows the reconciliation-bug method | `app/lib/generator.js`, `app/templates/*/`, the fixtures' `report.json` if a cell moves |
| LU-6 | The public statement: the shared footer gains the licence and a source link on all site pages and the four DIYA-GL pages; the download page paragraph is rewritten; the spec page gets a licence section naming the three layers; every "open source" phrase goes | H-LU-1 | Sonnet | `web/spreadsheets.diyaccounting.co.uk/public/*.html`, `public/books/*.html`, `app/bin/build-diya-gl-spec.js`, `app/bin/build-reconciliation-pages.js` |
| LU-7 | The names and the door: `TRADEMARKS.md` (DIY Accounting and DIYA-GL are not licensed; no use to market modified versions); the README's "this repository does not accept contributions" line; `SECURITY.md` with the disclosure address | H-LU-1 | Opus for the trademark text | `TRADEMARKS.md`, `README.md`, `SECURITY.md` |
| LU-8 | The other repositories, per the audit below | LU-1 | per row | see "Across the repositories" |
| LU-9 | The first release under the new terms: the next prod deploy publishes the engine at its rolled version under Apache-2.0 and pushes the image; the generate dispatches (H-LU-3) rebuild every package with `LICENCE.txt` and the workbook properties; the releases page entry records the licence | LU-2, LU-4, LU-5, LU-6, H-LU-3 | Sonnet, verification only | none new |
| H-LU-1 | Approve this plan and confirm the four decisions | — | operator | this file |
| H-LU-2 | A solicitor reads the additional grant and the trademark notice before LU-9 | LU-1, LU-7 | operator | `LICENSE`, `TRADEMARKS.md` |
| H-LU-3 | Dispatch the four `generate-*` workflows after LU-5 merges, then the prod deploy | LU-5 | operator | GitHub Actions |

## Across the repositories

Pending: filled from the read-only audit of `spreadsheets.diyaccounting.co.uk`,
`submit.diyaccounting.co.uk`, `diy-accounting-archive`, `root.diyaccounting.co.uk` and
`www.diyaccounting.co.uk`.

## Verification

- `LU-3`'s header test is the durable gate: it runs in `npm run test:fast` and fails on any file
  outside its layer.
- `LU-4`: `npm pack --dry-run` in `diya-gl/` lists `LICENSE` and `NOTICE`; a built zip lists
  `LICENCE.txt` and `README.txt`; the bundle and runner begin with the licence comment.
- `LU-5`: a generated workbook's `docProps/core.xml` carries the rights and creator fields; the
  reconciliation gates on the four `generate-*` runs stay green.
- `LU-6`: the browser suite's footer assertions; a grep for "open source" across `public/` returns
  nothing.
- `LU-9`: `npm view @diy-accounting-uk/diya-gl license` answers `Apache-2.0` for the new version and
  `AGPL-3.0-only` for 1.0.3; the download page and the zip agree.
