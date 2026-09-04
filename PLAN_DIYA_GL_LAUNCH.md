# PLAN: diya-gl launch — the free face, the tech community, the paid tier

The BST books page shipped on 2026-09-03 (PR #57) and proved the thing this plan sells: a
full year of a sole trader's accounts fits in a 15 KB zip, recalculates in a browser or on a
command line without Excel or a server, and produces the same bytes on every surface. This
document turns that into a product line with a revenue stream, checks the operator's sketch
against the market and the arithmetic, and lays out a launch sequence with gates.

## User assertions (verbatim)

> I was thinking of launching a product here. Take the above into this conversation and help me propose a sound revenue stream for the DIY spreadsheets site. First publicity, the spreadsheets website has the local running version packages for non technical desktop users available on a donation basis like the spreadsheets and the distro they get includes the versioning and provenance you suggest above and just the extraction and templates for the chosen product and this can also generate the .xlsx version (packaging TBD) so that is the commercila public face, and it's also going to be possible to `npm run from a public package...` which can be launched to a tech community along with the diya-gl schema as a work to represent a useful and declared subset of accounting standards (even better if we could certify this compliance). Perhaps rust ports (against the same provence tests) and docker and brew coverage etc... Then.... the commerciual offering is a 99p/month spreadsheets subscription which is storage of their diya-gl zip, a profile and a cognito user (social federated auth via google) using the same cognito client as the submit account but through the additional spreadsheets domain. Then... the paid tier is a small conversion of free/donation users wanting cloud storage and online (desktop and mobile) as well as an audience from the npm package users wanting to send users to a white labelled online accounting service that integrates with MTD. Start writing a doc for this, think, do web searches, debunk, extend, plan.

> No, 99p / month is my ONLY actual customer success on submit, keep it: [...] no tiers, it's
> free offline or 99p / month cloud, no founder stuff, it's buildable in a day we could be live
> tonight if I felt like it.

## Thesis

Sell ownership, then convenience, then filing. The free face gives every UK sole trader a
set of accounts they own outright: a 15 KB file, a page that reads it, a tool that
recalculates it, and the spreadsheet they already trust generated from it. The tech
community gets the same engine as a package and a published format, which is the cheapest
credibility this company can buy. The paid tier stores that file, keeps its versions, and
syncs it between devices, priced so low that the question is not "is it worth it" but "why
not". Making Tax Digital for Income Tax is the reason a sole trader will need software at
all from April 2026, and Submit is already HMRC-recognised for VAT, so the filing tier is a
path this company can walk rather than a claim it has to make. The 99p headline survives
the arithmetic only when billed yearly, and the certification the operator wants does not
exist as such; the credible substitutes are HMRC recognition and published, reproducible
proof.

## 1. The market

**Size.** The UK had 5.7 million private sector businesses at the start of 2025, of which
about 3.2 million (57%) were sole proprietorships; at the start of 2024, 52% of the 5.5
million businesses were unregistered for VAT or PAYE, about 3 million businesses trading
below the registration thresholds ([money.co.uk, citing the Department for Business and
Trade's Business Population Estimates](https://www.money.co.uk/business/business-statistics),
read 2026-09-03). That unregistered half is the spreadsheets site's audience today and the
books page's audience tomorrow.

**The forcing event.** Making Tax Digital for Income Tax becomes mandatory for sole traders
and landlords with qualifying income over £50,000 from 6 April 2026, over £30,000 from April
2027, and over £20,000 from April 2028 ([GOV.UK: Find out if and when you need to use
Making Tax Digital for Income
Tax](https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax),
read 2026-09-03). Those in scope must keep digital records, send quarterly updates, and
file the final return through recognised software. A spreadsheet on its own stops being
enough for anyone above the threshold.

**What HMRC promises about free software.** The guidance says: "free products are available
for those with simple tax affairs but there may be limits on how the product can be used,
for example they could have a limited number of transactions" ([GOV.UK: Choose the right
software](https://www.gov.uk/guidance/choose-the-right-software-for-making-tax-digital-for-income-tax),
read 2026-09-03). HMRC's list carries more than 30 products with a free version, including
Sage Individual, Clear Books Free, QuickFile (free up to 1,000 ledger entries) and My Tax
Digital's bridging mode ([mtd.digital list](https://mtd.digital/mtd-income-tax/free-mtd-software/),
read 2026-09-03). Free is the floor of this market, so the free face has to be better than
free software, which is what "you own the file" is for.

**What "HMRC recognised" means and how to get it.** Recognition is HMRC's production
approval for its APIs: register a production application on the Developer Hub, test in the
sandbox, return the Production Approvals Checklist, meet the minimum functionality standards
(for Income Tax that includes submitting quarterly updates for each mandated income source),
and pass HMRC's review of the testing and fraud-prevention headers ([HMRC service guide: how
to
integrate](https://developer.service.hmrc.gov.uk/guides/income-tax-mtd-end-to-end-service-guide/documentation/how-to-integrate.html),
read 2026-09-03). HMRC does not recommend products; listing means the process was passed.
Submit already holds recognition for VAT (its README says so, with the required "not
endorsed, approved or certified" wording). One hard fact governs the timeline: the service
guide as updated on 7 August 2026 states that HMRC "is no longer accepting production
credential access requests for new 2026–27 quarterly update products, as the market window
for these products has now closed" ([HMRC end-to-end service
guide](https://developer.service.hmrc.gov.uk/guides/income-tax-mtd-end-to-end-service-guide/),
read 2026-09-03 via search excerpt; confirm on the page before planning against it). The
earliest Income Tax listing this company can aim for is the 2027–28 product cycle, which is
also when the £30,000 threshold brings the bulk of this site's audience into scope.

**Can the schema be certified?** No body certifies an accounting data schema. The credible
claims are narrower and stronger:

- The line and book field names are drawn from the XBRL Global Ledger Taxonomy Framework
  2015, the XBRL Standards Board's recommendation of 25 March 2015 ([XBRL
  International](https://specifications.xbrl.org/work-product-index-xbrl-gl-xbrl-gl-2015.html),
  read 2026-09-03). That is a lineage, not a conformance mark; XBRL GL has no certification
  programme and thin adoption, and the schema's own description already says "adapted from".
- FRS 105 is the micro-entities financial reporting standard, applicable from 1 January
  2016 ([FRC](https://www.frc.org.uk/library/standards-codes-policy/accounting-and-reporting/uk-accounting-standards/frs-105/),
  read 2026-09-03). It governs company accounts, so it bears on the Limited Company product,
  and alignment is something to demonstrate with a mapping and a test, never to certify.
- HMRC recognition is the only third-party mark customers recognise, and it attaches to a
  filing product, which is Submit.

So "a useful and declared subset of accounting standards" should be worded as exactly that:
a declared subset, published with the mapping from every field to its XBRL GL element, from
every computed figure to its SA103S box, and with the reconciliation evidence that the
figures match the spreadsheets HMRC's own customers have filed from for twenty years. That
is a stronger claim than a badge nobody issues.

## 2. Competitors and price anchors

| Product | Sole-trader price | Free tier | Note |
| --- | --- | --- | --- |
| FreeAgent | included free with a Mettle or NatWest/RBS business account, one transaction a month required; "saving up to £150 per year" | yes, via the bank | [FreeAgent](https://www.freeagent.com/mettle/), read 2026-09-03 |
| QuickBooks Sole Trader | £10/month after £1/month for six months | no | [Startups.co.uk](https://startups.co.uk/accounting/quickbooks-cost/), read 2026-09-03 |
| Xero Ignite | £16/month, £2.40/month for six months on offer | no | [Xero UK](https://www.xero.com/uk/pricing-plans/ignite/), read 2026-09-03 |
| Sage Individual | free, MTD Income Tax for sole traders with basic needs | yes | [mtd.digital](https://mtd.digital/mtd-income-tax/free-mtd-software/), read 2026-09-03 |
| Coconut | from about £8/month; Full about £13.33/month billed annually | no | [Coconut pricing](https://www.getcoconut.com/pricing), read 2026-09-03 |
| ANNA | £0 pay-as-you-go; Business £19.90 + VAT | yes | [ANNA pricing](https://anna.money/pricing/), read 2026-09-03 |
| Pandle | free forever; Pro £5 + VAT | yes | [Pandle pricing](https://www.pandle.com/pricing/), read 2026-09-03 |
| Bokio UK | closed 7 July 2026 | was free | [accountingstack.co.uk](https://accountingstack.co.uk/accounting-software/reviews/bokio/), read 2026-09-03 |
| QuickFile, Clear Books Free, My Tax Digital | free (QuickFile to 1,000 entries; My Tax Digital bridging) | yes | [mtd.digital](https://mtd.digital/mtd-income-tax/free-mtd-software/), read 2026-09-03 |
| GnuCash, hledger, beancount, ledger-cli | free, open source, plain-text or desktop | yes | the tech community's own tools; none files MTD |

Three readings of that table:

1. **Free is crowded and bank-subsidised.** FreeAgent free with a Mettle account is the
   strongest offer a sole trader can get today, and it files MTD. A paid tier that competes
   on features against it loses. A tier that competes on ownership, portability and price
   does not have to.
2. **£10 to £16 a month is the paid floor for real software**, with £1 to £2.40
   introductory offers as the acquisition tool. A 99p headline is a tenth of that floor and
   signals "storage and convenience", which is the honest description of the tier.
3. **Bokio's closure is the cautionary tale.** Free-forever bookkeeping with a premium
   upsell did not sustain a UK operation. The difference here is a product with a
   twenty-year donation history and near-zero marginal cost per user, which the cost table
   below shows.

For the tech community the anchors are plain-text accounting tools. None of them speaks UK
tax, none files MTD, and all of them prize a documented, diffable format and a command-line
recalculation. The diya-gl zip, `npx diya-gl recalc`, and a published schema land squarely
in that world.

## 3. The 99p question, with numbers

**Stripe on a 99p monthly charge.** Stripe's UK standard card rate is 1.5% + 20p ([Stripe
fees UK 2026](https://www.wearefounders.uk/stripe-fees-uk-2026/), read 2026-09-03), and the
minimum charge in GBP is £0.30 ([Stripe: supported currencies, minimum charge
amounts](https://docs.stripe.com/currencies), read 2026-09-03). The company's VAT position
is assumed to be unregistered: the registration threshold is taxable turnover over £90,000
in twelve months ([GOV.UK: when to register for
VAT](https://www.gov.uk/vat-registration/when-to-register), read 2026-09-03), and the
spreadsheets site is donation-funded. If that assumption is wrong, every figure below is
divided by 1.2 first.

| Billing | Charge | Stripe fee | Kept | Kept per month | Fee share |
| --- | --- | --- | --- | --- | --- |
| 99p monthly | £0.99 | £0.215 | £0.775 | £0.78 | 21.7% |
| 99p a month billed yearly | £11.88 | £0.378 | £11.50 | £0.96 | 3.2% |
| £9.99 yearly | £9.99 | £0.350 | £9.64 | £0.80 | 3.5% |
| £2.99 monthly | £2.99 | £0.245 | £2.745 | £2.75 | 8.2% |
| £24 yearly | £24.00 | £0.560 | £23.44 | £1.95 | 2.3% |

Monthly 99p clears the 30p minimum and keeps 78p of every pound. That is the price: it is
the one price Submit's customers have actually paid, and the fee share is the cost of a
price people already understand. Premium UK cards cost 1.9% + 20p and EEA cards 2.5% + 20p
(same source), which moves the fee share past 25% on those cards.

**Churn and conversion.** Small-business SaaS runs 3% to 5% monthly churn ([Churnkey
benchmarks](https://churnkey.co/blog/whats-a-normal-churn-rate-in-saas), read 2026-09-03), so
a monthly plan loses a third to half its base a year before acquisition. Freemium converts
at 2% to 5% of active free users ([Monetizely freemium
benchmarks](https://www.getmonetizely.com/articles/freemium-conversion-rate-the-key-metric-that-drives-saas-growth-3588c),
read 2026-09-03). Donation pages for non-profits convert at about 8% of visitors who reach
the page ([Funraise donation page
benchmarks](https://www.funraise.org/tools/donation-page-conversion-rate-calculator), read
2026-09-03); that is a different audience and a different ask, so the plan uses the freemium
range and treats the site's own donation history as the better prior. The operator should
put the site's actual downloads-to-donations ratio into this section; it is the one number
this document cannot find online.

**Revenue at the freemium range.** With 10,000 active free users of the books page or the
local runner, 2% to 5% paying 99p a month is 200 to 500 subscribers and £1,860 to £4,650 a
year after fees. That funds hosting and support for the tier many times over (section 4)
and buys nothing else. The tier is a foundation and a data point.

**The offer.** Two things and nothing between them.

| Offer | Price | What it is |
| --- | --- | --- |
| Offline | £0, donation prompts | the site, the browser page, the local runner, the npm package, the format; the twenty-year model, ownership is the promise |
| Cloud | 99p a month, Stripe subscription, monthly billing | the file stored with versions, a profile, sign-in with Google through the spreadsheets domain, the same book on desktop and mobile |

Filing (quarterly updates through Submit when Income Tax recognition lands) is priced with
Submit when it exists; it is not a tier of this site. No founder offer, no annual plan, no
second price.

## 4. Costs and break-even

**Authentication.** Cognito's Essentials tier is $0.015 per monthly active user above
10,000 free per month; Lite is $0.0055 down to $0.0025 per MAU above the same 10,000 free;
Plus is $0.02 per MAU with no free tier; federated SAML/OIDC users get 50 free ([AWS
Cognito pricing](https://aws.amazon.com/cognito/pricing/) via [Frontegg's
summary](https://frontegg.com/guides/aws-cognito-pricing), read 2026-09-03). Google sign-in
through Cognito's social identity providers counts as a social MAU, inside the 10,000 free.
Submit's pool runs on Plus with threat protection and costs about $4 a month today for
about 50 MAU (`AWS_COSTS.md` in the Submit repository). Sharing that pool means the first
ten thousand spreadsheets users cost nothing in Cognito if the pool sits on Essentials or
Lite, and about 1.5p a user a month on Plus.

**Storage.** A book is 15 KB. Twelve versions a year is 180 KB per user per year; S3
standard storage at roughly $0.023 per GB-month makes that under a hundredth of a penny a
month per user, and CloudFront egress for a file that size is noise. Ten thousand users with
ten years of history is 18 GB.

**Payments.** Stripe's fee is the table in section 3. Stripe Billing for subscriptions adds
a percentage on top of card fees on its paid tiers; the starter tier is included with
standard pricing, and the plan assumes Payment Links plus the customer portal, which the
donation page already uses.

**Support.** The real cost. A storage tier's tickets are sign-in problems, lost files, and
"my figures changed", which the provenance stamps (section 6) answer by design. Budget one
hour of operator time per fifty subscribers per month until the first hundred, then
measure.

| Per subscriber per month | Cost |
| --- | --- |
| Cognito (Essentials, beyond the free 10,000) | about 1.1p |
| S3 and CloudFront | under 0.1p |
| Stripe, at 99p billed yearly | 3.2p |
| Total infrastructure | about 4.5p against 99p kept as 96p |

Break-even on infrastructure is a handful of subscribers. Break-even on the operator's time
is the only number that matters, and it is set by the support rate the first hundred
subscribers produce.

## 5. The offer ladder

### 5a. The free public face

The live page at `spreadsheets.diyaccounting.co.uk/books/bst.html` is already the free face:
loads a workbook, a package zip, a diya-gl zip or JSON by content; recalculates; shows the
ledger, the P&L, the SA103S-shaped form and the Income Tax computation; runs the engine and
book checks; exports the workbook, the package, the diya-gl zip and JSON; nothing leaves
the machine. The gaps between that and the operator's sketch:

**The local runner for non-technical desktop users.** Four packagings, weighed:

| Packaging | Size | Signing cost | Update path | Verdict |
| --- | --- | --- | --- | --- |
| Single-file HTML, opened by double-click | about 1 MB with the engine (539 KB measured), schemas and tax data inlined; about 4 MB if the 2.5 MB BST template is inlined for `.xlsx` export | none; browsers open local HTML without a signature | download the new file; the file carries its own version stamp | first, and the "distro" the operator describes |
| PWA (install from the live page) | the site's own assets, cached | none | automatic on next visit | second; gives an icon and offline use with no build |
| Tauri app | about 3 to 10 MB | Apple Developer Program $99 a year for notarisation; Windows OV certificate about $216 a year or Azure Artifact Signing $9.99 a month | an updater to build and maintain | later, if the file-association and menu-bar experience earns it |
| Electron app | 85 to 100+ MB | as Tauri | as Tauri | no; size without benefit |

Sizes and costs: Tauri "hello world" 3.2 MB against Electron 85 MB
([tech-insider.org](https://tech-insider.org/tauri-vs-electron-2026/), read 2026-09-03);
notarisation needs a paid Apple developer account at $99 a year ([Apple developer
forums](https://developer.apple.com/forums/thread/121113), read 2026-09-03); OV code signing
certificates at $215.99 a year, with lifetimes capped at one year from 15 February 2026
([SignMyCode](https://signmycode.com/ov-code-signing), read 2026-09-03); Azure Artifact
Signing, formerly Trusted Signing, $9.99 a month for up to 5,000 signatures
([Microsoft](https://azure.microsoft.com/en-us/products/artifact-signing), read 2026-09-03).

The single-file HTML runner needs one build step: inline the engine bundle, the two
schemas, the tax-year TOMLs and, for the product chosen, its template, into one page, and
stamp it. "Just the extraction and templates for the chosen product" is the build's input
list. The page already generates the `.xlsx` client-side, so the runner does too. The
operator's "packaging TBD" resolves to: HTML file now, PWA with it, Tauri only on demand.

**Donation prompts.** The page shows no ask today. The right moments are after a successful
save and after a year's figures first appear, each once, each dismissable, each pointing at
the existing Stripe links, with the 99p cloud offer beside them once it exists.

### 5b. The tech-community launch

**The package.** `@diy-accounting-uk/diya-gl` with three entry points: `recalc` (zip or
JSON in, `report.json` and `bookchecks.json` out), `read-workbook` (the BST extractor, Node
only), `write-workbook` (the generator over the template). `npx diya-gl recalc
my-books.zip` is the demo. Measured today the recalc path bundles at 468 KB minified, 145
KB gzipped; precompiling the validators (done for the browser this week) and leaving the
workbook reader out of the recalc entry lands near 250 KB. The MCP server already exists
(`diya-gl-bst`) and ships in the same package. The DIYA Cloud plan's assertion 2 asks this
repository for exactly this library; this is its first cut.

**The format.** Publish the two v2 schemas (already served from the site), the JSON Lines
convention, the zip layout, and a spec page that states the declared subset: the field
mapping to XBRL GL 2015, the box mapping to SA103S, the check catalogue, and the
reconciliation evidence. Version the format (`diya-gl-books` version 1 is already in the
JSON envelope); put the same version in `book.toml`.

**Docker and Homebrew.** A Docker image is `node:alpine` plus the package, a one-line
Dockerfile, useful for CI users. A Homebrew formula needs a tap and a release artefact; it is
a morning's work once the npm package is stable. Both follow the package; neither leads.

**A Rust port, funded (operator, 2026-09-04).** The provenance tests are the asset here:
the CI reconciliations, the byte-for-byte `report.json` on three fixtures, the check
catalogue and the roundtrip budgets give a port a complete oracle. What a port buys: a
single static binary with no runtime, a few megabytes, embeddable in other tools, and a
conversation with the plain-text accounting community that the npm package alone will not
start. What it costs, estimated from this repository's own last seven days (1,045 commits,
191 merges, sixteen coordinated tasks landed in one day on 2026-09-03 under the coordinator
model with a Fable coordinator and Sonnet/Opus workers): the recalculation core is about
4,800 lines of JavaScript (loader, canonical form, calculator, the tax modules, the check
catalogue, the report serializer, book checks, headlines, interchange); the workbook layer is
another 5,000 (the xlsx exporter, generator, template map, sidecar). A port of the core is
two to three coordinator days: a design wave (the type model, the rounding contract, which
must reproduce JavaScript's float arithmetic and the serializer's half-up canonicalisation
byte-for-byte, and the oracle harness that runs the binary over the three books and diffs
`report.json` and `bookchecks.json` against the JS), then concurrent code waves (loader and
canonical; calculator and tax; checks and serializer; the zip and JSON interchange with a
CLI), then a closing ladder that adds the Rust parity job to CI beside the JS scorecard. The
workbook layer is a second step of the same size once the core is proven, with the
template surgery as its one real risk. Four to six coordinator days in all, kept in step
with each tax year by the same oracle. The earlier estimate that it would consume the
year's engineering budget was wrong; the measured throughput says days. Its plan of record
is `PLAN_DIYA_GL_RUST.md`, drafted next.

**The launch itself.** A Show HN post and an AccountingWEB piece with the same three facts:
15 KB for a year of accounts, recalculates without Excel, byte-identical across CLI, MCP and
browser. The gate is in section 7.

### 5c. The paid tier

**Identity.** One Cognito user pool, Submit's, with Google federation. A user pool has one
hosted-UI domain; the spreadsheets site does not need a second domain, it needs an app
client on the same pool with a redirect back to `spreadsheets.diyaccounting.co.uk` and the
hosted sign-in page under Submit's domain. The user then has one identity for both products,
which is the whole point of sharing the pool. If the operator wants the sign-in page itself
under the spreadsheets domain, that is a second custom domain on the same pool, which
Cognito supports one of per pool, so it means moving Submit's, and this plan advises
against it.

**Storage and sync.** The DIYA Cloud plan already decided zip-in-S3 with Cognito, in the
submit-prod account, with a metadata sidecar for optimistic concurrency. This plan changes
two of its decisions: computation moves to the client (the browser engine exists and is
proven; Lambda is needed only for storage, listing and the metadata), and `.xlsx`
generation is client-side too (the page does it today), so no LibreOffice sits in any
Lambda. The API is small: list books, get a version, put a version, delete. Sync is
last-writer-wins with the version stamp, one writer per book, and a conflict shown rather
than merged; a merge story is a horizon.

**Mobile.** The page already has four layouts including mobile portrait with in-card month
editing. "Online on mobile" is the same page signed in, with the book fetched from storage
instead of a file. No app store is needed, which keeps the App Store's rules and cut out of
a 99p product.

**The path to MTD Income Tax.** The stored diya-gl book has every figure a quarterly update
needs, keyed to SA103S boxes. Submit holds the HMRC production credentials for VAT and the
fraud-prevention header work. The Income Tax path is: recognition for the 2027–28 cycle
(section 1), the quarterly update and final declaration endpoints in Submit, and a "send
this quarter" action on the books page for signed-in users. That is the Filing rung, priced
with Submit, and it is where the money is.

### 5d. White-label and referral

Two different ideas sit under this heading. A referral from npm users to an online MTD
service is cheap: the package's `--help` and the spec page link to the site, and the site
links to Submit. Do that at launch. A white-labelled service, where another company puts
its brand on the storage and filing tier, needs multi-tenant identity, branding, billing
and support for someone else's customers, and HMRC recognition per product. That is a
distraction until the Filing rung exists and has its own users. Phase two at the earliest,
and only if an accountant or a bank asks for it with a number attached.

## 6. Provenance and versioning as a feature

Every diya-gl zip carries, in `book.toml`'s document info and in `report.json`'s header:

| Stamp | Value | What it answers |
| --- | --- | --- |
| format version | `diya-gl-books` 1 | can this tool read this file |
| engine version | the npm package version, and the commit | which code produced these figures |
| tax-data version | the `app/data` year files' hash | which rates were applied |
| template version | the BST template's hash and its reconciled scorecard | which workbook this reproduces |
| reconciled commit | the commit whose CI reconciliations passed | the proof this release rests on |

A public **reconciled releases** page lists every release with those five values and links
to the CI scorecard: the LibreOffice recalculation agreement, the roundtrip budget at zero,
the check counts. Recalculating a 2026 file in 2030 either reproduces its `report.json`
byte-for-byte or names the stamp that differs.

What that buys: with accountants, a file they can verify without trusting the sender, and a
year-end pack that is the accounts themselves rather than a printout; with HMRC's
recognition process, evidence of digital-record integrity and of the figures' derivation,
which the Production Approvals Checklist asks about in its own words; with the tech
community, the thing they check first. It costs a build step and a page.

## 7. Launch sequence

| Phase | Builds | Prerequisite | Gate to the next phase | Effort |
| --- | --- | --- | --- | --- |
| 0. Provenance | the five stamps in the zip and `report.json`; the reconciled-releases page; the format version in `book.toml`; the npm package `@diy-accounting-uk/diya-gl` with `recalc`, published from a reconciled tag | PR #57 on main (done) | `npx diya-gl recalc` reproduces the page's `report.json` byte-for-byte on the three fixtures; the releases page shows one entry | two to three weeks |
| 1. The free face | the single-file HTML runner for BST built from the same bundle; the PWA manifest; two donation prompts on the page; the spec page for the format | phase 0 | 1,000 runner downloads or 2,000 page loads with a book loaded in the first month; a downloads-to-donations ratio measured; support tickets under one a day | two weeks |
| 2. Tech launch | Show HN and AccountingWEB; Docker image; the MCP server documented; Homebrew tap | phase 1 | 500 npm weekly downloads sustained for a month, or 300 GitHub stars; three external bug reports fixed | one week plus the follow-up |
| 3. Cloud, 99p a month | the app client on Submit's pool; S3 bucket and four Lambda routes in submit-prod (from the DIYA Cloud plan, phase 2, cut down); sign-in and "save to my account" on the page; Stripe Payment Link for £11.88 a year and the £29 founder offer; the customer portal | phase 1; a decision on the pool tier | 100 paying subscribers within three months of launch; monthly churn under 5%; tickets under one per twenty subscribers a month | four to six weeks |
| 4. The other products | SE, Taxi and Ltd on the page and in the package, in that order (their plans exist as successors of the BST plan) | phase 3 revenue covering the operator's time | each product reconciles in CI and loads on the page | per product, the BST spike's own record: about a week each with the learnings applied |
| 5. Filing | Income Tax recognition on the 2027–28 cycle; quarterly updates from the stored book via Submit; the Filing rung's price | phase 3; the HMRC window for 2027–28 products | production credentials granted; the first ten customers' quarterly updates accepted | the recognition process runs months; start it during phase 3 |

What to leave: Tauri (until the HTML runner's users ask for an app), white-label (until
Filing exists), a merge story for concurrent edits, and any second price.

## 8. Risks

- **HMRC's windows.** Recognition for a tax year closes months before the year starts; the
  2026–27 window has closed. Missing the 2027–28 window pushes Filing to 2028–29, when the
  £20,000 threshold lands and the free competitors have had two more years. Start the
  Developer Hub application during phase 3.
- **The bank-subsidised free competitor.** FreeAgent with Mettle files MTD for nothing. The
  answer is not features; it is that a Mettle customer who leaves Mettle loses FreeAgent,
  and a diya-gl user who leaves keeps a 15 KB file that everything else reads.
- **Support load on a 99p product.** One sign-in problem costs more than a year of one
  subscriber's fees. The gates in section 7 measure tickets per subscriber for that reason,
  and the tier ships with no email support promise, only the page's own help.
- **Trust in a self-hosted engine.** A wrong figure in someone's tax return is the worst
  outcome. Every release is cut from a reconciled commit with the scorecard published; the
  page says "check these against your return"; nothing files without Submit's recognised
  path.
- **The shared pool.** A change to Submit's Cognito configuration now affects spreadsheets
  users. Both products' behaviour tests sign in through the same pool in CI, so a break is
  caught before deploy.
- **Fixture and data drift.** This week's batch found three fixture defects and one
  writer-order defect by testing byte equality. The releases page makes every such drift
  visible; the discipline is to fix at source, never to allowlist.

## Decisions taken (operator, 2026-09-04)

1. **Cognito tier.** Keep Plus on the shared pool; about 1.5p per spreadsheets user per
   month, threat protection kept.
2. **Sign-in domain.** Submit's hosted sign-in page with a redirect to the spreadsheets
   site; nothing moves.
3. **Runner build.** From this repository's bundle, cut from a reconciled commit.
4. **Next product.** Self Employed.
5. **HMRC application.** Start the Developer Hub application for Income Tax during phase 3
   for the 2027–28 window, and ask HMRC for special consideration for 2026–27 if the
   product is solid by then: a non-zero chance at a low cost to ask.
6. **The Rust port.** Funded, as the tech-community launch's headline; the estimate is in
   section 5b and the plan of record is `PLAN_DIYA_GL_RUST.md`. The operator is
   researching Rust porting references, skills and MCP servers for the builder, which is
   Fable 5.1 as coordinator.
7. **VAT position.** Not VAT registered; the price stands as written.

## Open items

Tracked here, not on the board in `NEXT.md`, at the operator's request.

- **X1 — draft `PLAN_DIYA_GL_RUST.md`.** The port's design wave first: the type model, the
  float and half-up rounding contract that reproduces the JS serializer byte-for-byte, the
  module map, the oracle harness that diffs `report.json` and `bookchecks.json` against the
  JS over the three books, and the CI parity job; then the code waves and the closing
  ladder, sized from section 5b's estimate. Fable 5.1 coordinates; Sonnet and Opus workers.
- **H6 — the operator's research** into Rust porting references, skills and MCP servers for
  the port's builder. X1 does not wait on it.

## Where this changes the DIYA Cloud plan

`_developers/PLAN_DIYA_CLOUD.md` decided server-side computation in Lambda with LibreOffice
and a full general ledger. This plan keeps its storage, identity and account placement
decisions and changes three things on the strength of what shipped this week: computation
is client-side (the browser engine is the same code CI reconciles), `.xlsx` generation is
client-side (no LibreOffice anywhere in the service), and the front end is the existing
books page signed in, under the spreadsheets domain, rather than a new area of the Submit
site. Its phases 1 and 2 (the library and the storage API) are this plan's phases 0 and 3;
its phases 3 to 5 are absorbed by the page; its phase 6 is this plan's Filing rung.

## Sources

- GOV.UK, Find out if and when you need to use Making Tax Digital for Income Tax:
  https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax
  (read 2026-09-03)
- GOV.UK, Choose the right software for Making Tax Digital for Income Tax:
  https://www.gov.uk/guidance/choose-the-right-software-for-making-tax-digital-for-income-tax
  (read 2026-09-03)
- HMRC Developer Hub, Making Tax Digital for Income Tax end-to-end service guide:
  https://developer.service.hmrc.gov.uk/guides/income-tax-mtd-end-to-end-service-guide/
  and its "How to integrate" page (read 2026-09-03)
- GOV.UK, When to register for VAT: https://www.gov.uk/vat-registration/when-to-register
  (read 2026-09-03)
- money.co.uk, UK business statistics 2026 (citing DBT Business Population Estimates):
  https://www.money.co.uk/business/business-statistics (read 2026-09-03)
- Stripe, Supported currencies and minimum charge amounts: https://docs.stripe.com/currencies
  (read 2026-09-03)
- We Are Founders, Stripe fees UK 2026: https://www.wearefounders.uk/stripe-fees-uk-2026/
  (read 2026-09-03)
- AWS, Amazon Cognito pricing: https://aws.amazon.com/cognito/pricing/ and Frontegg's
  summary https://frontegg.com/guides/aws-cognito-pricing (read 2026-09-03)
- FreeAgent with Mettle: https://www.freeagent.com/mettle/ (read 2026-09-03)
- Startups.co.uk, QuickBooks cost: https://startups.co.uk/accounting/quickbooks-cost/ (read
  2026-09-03)
- Xero UK, Ignite plan: https://www.xero.com/uk/pricing-plans/ignite/ (read 2026-09-03)
- Coconut pricing: https://www.getcoconut.com/pricing (read 2026-09-03)
- ANNA pricing: https://anna.money/pricing/ (read 2026-09-03)
- Pandle pricing: https://www.pandle.com/pricing/ (read 2026-09-03)
- accountingstack.co.uk, Bokio review (closure):
  https://accountingstack.co.uk/accounting-software/reviews/bokio/ (read 2026-09-03)
- mtd.digital, free MTD software and HMRC's list:
  https://mtd.digital/mtd-income-tax/free-mtd-software/ (read 2026-09-03)
- Churnkey, normal churn rates in SaaS:
  https://churnkey.co/blog/whats-a-normal-churn-rate-in-saas (read 2026-09-03)
- Monetizely, freemium conversion rate benchmarks:
  https://www.getmonetizely.com/articles/freemium-conversion-rate-the-key-metric-that-drives-saas-growth-3588c
  (read 2026-09-03)
- Funraise, donation page conversion benchmarks:
  https://www.funraise.org/tools/donation-page-conversion-rate-calculator (read 2026-09-03)
- XBRL International, XBRL Global Ledger 2015:
  https://specifications.xbrl.org/work-product-index-xbrl-gl-xbrl-gl-2015.html (read
  2026-09-03)
- FRC, FRS 105:
  https://www.frc.org.uk/library/standards-codes-policy/accounting-and-reporting/uk-accounting-standards/frs-105/
  (read 2026-09-03)
- Apple developer forums, notarisation and the paid developer account:
  https://developer.apple.com/forums/thread/121113 (read 2026-09-03)
- SignMyCode, OV code signing certificates: https://signmycode.com/ov-code-signing (read
  2026-09-03)
- Microsoft, Azure Artifact Signing: https://azure.microsoft.com/en-us/products/artifact-signing
  (read 2026-09-03)
- tech-insider.org, Tauri vs Electron sizes: https://tech-insider.org/tauri-vs-electron-2026/
  (read 2026-09-03)
- This repository: `PLAN_DIYA_GL_BST_CLI_MCP_WEB.md`, `_developers/PLAN_DIYA_CLOUD.md`,
  `_developers/SPEC-basic-sole-trader-import-export.md`, the v2 schemas; the Submit
  repository's `README.md` (HMRC recognition for VAT) and `AWS_COSTS.md` (Cognito cost).
