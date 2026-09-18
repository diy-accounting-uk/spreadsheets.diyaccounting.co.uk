<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->
<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->
# PLAN: DIYA-GL home on diya-gl.co.uk, the 24h sandbox, the resident account

Refines the board rows DG-1, DG-2 and DG-3 into one design and one task list. Builds on
`PLAN_DIYA_GL_LAUNCH.md` (§3 to §5, the 2026-09-04 decisions, LP-15 to LP-21) and cites it by
section. State lines are as of 2026-09-18.

## User assertions (verbatim)

1. (2026-09-18) "Move these from the download page into a new domain homepage on diya-gl.co.uk with the same branding as https://spreadsheets.diyaccounting.co.uk/diya-gl/bst.html / https://spreadsheets.diyaccounting.co.uk/diya-gl/ltd.html and move all those pages over too as well as the sign in"
2. (2026-09-18) "Add a max 1 day retention for saved data with sign in and use labelling withnto "24h sandbox" a (and align the mentions of "wip" to "24hy sandbox")"
3. (2026-09-18) "Add paid feature for persistent account"
4. (2026-09-18) "Please use a fable sub-agent to refine these three DG-1 DG-2 DG-3 with a solution that factors in integration with submit's bundle system and also the paid version should be ci only, and I think the default view should be this https://spreadsheets.diyaccounting.co.uk/diya-gl/ltd.html?example=ltd-brickwork-pro-vat&view=year&month=2025-04 right into complex accounts on the home page with real data and calcs. put this all in it's own PLAN_*.doc Also with that consider the pricing strategy I have here (free in browser with 24 cloud sandbox, paid monthly 99p persistence) and what are the alternatives? Also consider the offline varient ```Or download one product as a single file: open it from your own disk, no server and no upload, ever. Run Basic Sole Trader offline / Run Self Employed offline / Run Taxi Driver offline / Run Limited Company offline``` is that healthy, should be add in browser storeage for users with no account?"

## Design

### (a) The diya-gl.co.uk site

**What moves.** The whole of `web/spreadsheets.diyaccounting.co.uk/public/diya-gl/` becomes the
document root of a second site, `web/diya-gl.co.uk/public/`, served at the root of the new host:
`https://diya-gl.co.uk/ltd.html`, `/bst.html`, `/se.html`, `/taxi.html`, with `index.html` the
homepage. The move is a `git mv`; the pages already reach every asset by relative path
(`assets/`, `engine/`, `products/`, `sw.js`). The four offline runners (`target/runners/`, built by
`scripts/build-runner.mjs`) upload to the new site's bucket under `/runners/`. Three files the pages
reach with `../` today are re-homed: `lib/analytics.js` and `lib/consent-banner.js` are copied into
`web/diya-gl.co.uk/public/lib/` by `scripts/build-diya-gl-bundle.mjs` (generated, gitignored, one
source), `favicon.ico` is copied the same way, and `DONATE_PAGE_LINK` in `shell.js` becomes the
absolute `https://spreadsheets.diyaccounting.co.uk/donate.html`. `sw.js`'s `SCOPE_PATH` and the
manifest's `start_url` and `scope` become `/`.

**What stays on spreadsheets.** `download.html`'s DIYA-GL section (lines 131-160) shrinks to one
paragraph and one link: "View and edit your books in DIYA-GL, free in your browser, with a 24h
sandbox when you sign in", the badge reading "24h sandbox", the link `https://diya-gl.co.uk/`. The
format spec page `diya-gl.html` moves to `https://diya-gl.co.uk/spec.html` (DG-1l): the builder
`app/bin/build-diya-gl-spec.js` writes it there with the new canonical URL, the npm README
(`diya-gl/README.md` line 66), the reconciliation pages (`build-reconciliation-pages.js` line 973),
`index.html` line 300 and both sitemaps point at it, and spreadsheets' `redirects.toml` 301s the old
path. `redirects.toml` gains a target `diya-gl` (ci `ci.diya-gl.co.uk`, prod `diya-gl.co.uk`) and
retargets the `/books/` prefix and a new `/diya-gl/` prefix onto it, so every old link and PWA path
lands on the new site. `donate.html`, the packages, the knowledge base and the reconciliation pages
stay.

**The homepage.** `index.html` is the Ltd page's markup with a home strip above the topbar: the four
product links, the sign-in button, one sentence per tier (free in your browser, 24h sandbox, resident
account), and a "Take it offline" row for the four runners. With no `example` in the URL the page
loads `ltd-brickwork-pro-vat` at `view=year`, `month=2025-04`, through the deep-link path
`shell.js` already has (`parseDeepLinkParams`, `bootFromDeepLink`, `applyDeepLinkViewAndMonth`,
lines 224-286): the body carries `data-default-example`, `data-default-view` and
`data-default-month`, and `parseDeepLinkParams` falls back to them when the URL names no example.
The load uses `skipAutosave: true` as deep links do, so a reader's own working book in IndexedDB is
untouched; the existing continue-offer shows as a banner over the example instead of on the empty
state. The figures are the engine's own: the fixture is `assets/examples/brickwork-pro/ltd-vat/`
(`book.toml`, `lines.jsonl`), extracted from `examples/precision-code-ltd/` by
`app/bin/extract-scenarios.js`, recalculated in the browser by `engine/diya-gl-engine.js`. The four
product pages drop `<meta name="robots" content="noindex">`; the new site gets its own `sitemap.xml`
and `robots.txt` from `app/bin/build-sitemaps.js`.

**Branding.** `diya-gl.css` as it is: the teal `#158484` on `#f7fafa`, Arial, floating white panels,
the `DIYA-GL` mark. The home strip uses the same tokens and no new ones.

**DNS, certificate, CDK, deploy.**

| Step | Where | What |
| --- | --- | --- |
| Zones | `../root.diyaccounting.co.uk` | Two `PublicHostedZone`s (`diya-gl.co.uk`, `diya-gl.com`) in `RootDnsStack`, alias records `@`, `www`, `ci` in each, pointing at the prod and ci distributions below; the `root-route53-record-delegate` role's policy extended to both zones; `deploy.yml` looks up `{env}-spreadsheets-DiyaGlSiteStack`'s `DistributionDomainName` the way it does for `SpreadsheetsStack` (its lines 265-295) |
| Registrar | operator, management account | Route53 Domains still points both names at the registration's default name servers; after the root deploy the operator runs `aws route53domains update-domain-nameservers` once per name with the new zones' NS set |
| Certificate | this repo, `.github/workflows/request-diya-gl-cert.yml` | The `request-holding-cert.yml` pattern: `acm request-certificate` in us-east-1 for `diya-gl.co.uk` with SANs `www.diya-gl.co.uk`, `ci.diya-gl.co.uk`, `diya-gl.com`, `www.diya-gl.com`, `ci.diya-gl.com`; validation CNAMEs written through the delegate role into whichever of the two zones each name belongs to; the ARN goes into a repository variable `DIYA_GL_CERTIFICATE_ARN` |
| Stack | this repo, `infra/.../stacks/DiyaGlSiteStack.java` | `{env}-spreadsheets-DiyaGlSiteStack`: S3 origin with OAC, one CloudFront distribution, domain names ci `ci.diya-gl.co.uk`, `ci.diya-gl.com`; prod `diya-gl.co.uk`, `www.diya-gl.co.uk`, `diya-gl.com`, `www.diya-gl.com`; its own response-headers policy from `infra/main/resources/diya-gl-security-headers.json`; its own redirect function; `DistributionDomainName` and `OriginBucketName` outputs. `SpreadsheetsEnvironment` synthesises it when `DIYA_GL_CERTIFICATE_ARN` is set, as it gates `HoldingStack` on its certificate |
| Deploy | `.github/workflows/deploy.yml` | A deploy step after `SpreadsheetsStack`, gated on the variable like the holding step (lines 313-331); runners upload to the new bucket; the behaviour job gets `DIYA_GL_BASE_URL` (ci `https://ci.diya-gl.co.uk`, prod `https://diya-gl.co.uk`) beside `SPREADSHEETS_BASE_URL` |
| `.com` | the redirect function | `web/diya-gl.co.uk/redirects.toml` and a generalised `scripts/build-spreadsheets-redirects.cjs` (a `--site` argument): any host ending `diya-gl.com` 301s to the same path on `diya-gl.co.uk` (`ci.diya-gl.com` to `ci.diya-gl.co.uk`), and `www.diya-gl.co.uk` to the apex; both `.com` aliases sit on the same distribution, so one certificate and one function cover it |
| CSP | `diya-gl-security-headers.json` | `default-src 'self'`; `script-src 'self' 'unsafe-inline' https://www.googletagmanager.com`; `connect-src 'self'` plus the GA hosts, `https://submit.diyaccounting.co.uk`, `https://prod-auth.diyaccounting.co.uk`; `form-action 'self'`; `frame-ancestors 'none'`; no PayPal. `web/browser-tests/serve.js` reads it for the second root |
| Cognito | `../submit.diyaccounting.co.uk/infra/.../IdentityStack.java` `buildBooksUrls` | Callback and logout URLs for `https://diya-gl.co.uk/`, `/index.html`, the four pages, and the same under `https://ci.diya-gl.co.uk` (prod lists the ci host as it does today for `ci-spreadsheets`, so the ci behaviour run can sign in); `SubmitApplication.booksAllowedOrigins` (lines 173-179) adds the two origins, which also feeds `BILLING_RETURN_URL_ORIGINS`. The old spreadsheets-host entries stay one release, then go |
| Which Submit | `web/diya-gl.co.uk/public/cloud-config.js` | Every host talks to Submit prod, as today (decision 1): the committed `cloud-config.js` keeps its one set of values; the ci behaviour job keeps minting its test user through the prod role in `SUBMIT_TEST_USER_ROLE_ARN` and targets `ci.diya-gl.co.uk` through `DIYA_GL_BASE_URL` |
| Analytics | operator, GA4 admin | The measurement id `G-X4ZPD99X2K` stays; the web data stream's cross-domain list and referral exclusions gain `diya-gl.co.uk` |

**Tests.** The 40 `web/browser-tests/diya-gl-*.browser.test.js` files load `/diya-gl/<page>.html`
from the spreadsheets root; they move to `/<page>.html` on the second root `serve.js` serves.
`scripts/test-scope.mjs` maps `web/diya-gl.co.uk/` to the browser tier. The four DIYA-GL cases in
`behaviour-tests/spreadsheets.behaviour.test.js` (lines 977-1179) read `DIYA_GL_BASE_URL`. A new
homepage browser case asserts the example loads, the year view is on, `2025-04` is open and the
figures render.

### (b) The 24h sandbox

**The rule.** A signed-in save is kept for 24 hours after the last save of that book. The clock is
in the metadata sidecar, the routes enforce it, and an S3 lifecycle rule is the janitor.

**Submit's storage (`DiyaGlStack`, `DataStack`, the four handlers).** Today `diyaGlPut.js` writes
`metadata.json` with `entitlementAtPut` and no expiry, `DIYA_GL_ENTITLEMENT_ENFORCED` is `"false"` on
every environment, and the `DataStack` bucket (lines 907-928) has two lifecycle rules,
`abort-incomplete-uploads` and `expire-noncurrent-versions` (30 days). The change:

| Piece | Change |
| --- | --- |
| Sidecar | `retention: "sandbox" \| "resident"` and `expiresAt: <ISO> \| null`, written on every put; sandbox `expiresAt = updatedAt + 24h`; the `entitlementAtPut` field stays |
| Put route | `entitlementFor(sub)` decides retention: active `resident-diya-gl` bundle gives `resident`; anything else gives `sandbox`. The `403 subscription-required` gate and `DIYA_GL_ENTITLEMENT_ENFORCED` go: a sandbox save is always allowed. Each version object and the sidecar carry the S3 tag `retention=<value>` (`Tagging` on `PutObject`, so the put Lambda gains `s3:PutObjectTagging`); when a book's retention changes at a save, the route re-tags its kept versions (at most `DIYA_GL_VERSIONS_KEPT`, 30) |
| List route | Reads `entitlementFor(sub)` once and returns it at the top level as `entitlement: {reason, expiry, residentTier}`; each book carries `retention` and `expiresAt`; a sandbox book past `expiresAt` is left out |
| Get route | A version of a sandbox book past `expiresAt` answers `404 book-expired` |
| Lifecycle | One rule with `tagFilters retention=sandbox`: `expiration 2 days`, `noncurrentVersionExpiration 1 day`. S3 expiry runs on day boundaries, so the sidecar's `expiresAt`, not the rule, is the promise |
| Environment | `DIYA_GL_RESIDENT_TIER` on the put and list Lambdas, `enabled` unless `envName` is `prod` (a `DiyaGlStackProps` boolean set in `SubmitApplication`). When disabled the routes skip the bundle read, every save is sandbox, and `entitlement.reason` is `tier-disabled` |
| Tests | `diyaGlPut.test.js` (retention, tags, `expiresAt`, re-tag on change), `diyaGlListGet.test.js` (filter, top-level entitlement), `diyaGlVersionGet.test.js` (404), `DataStackTest` (the tag-keyed rule), `DiyaGlStackTest` (the env and the tagging permission) |

**The pages.** "Work in progress" appears in the site twice, both on `download.html` lines 132-134;
DG-1 replaces that section with the link-out above, and the badge reads "24h sandbox". On the new
site the label sits where `cloud.js` renders the account panel:

| Place | Text |
| --- | --- |
| Sign-in button title and `renderSignedOut` | "Sign in to save to a 24h sandbox: your books are kept for 24 hours after each save, on any device." |
| Each book row (`renderBookRow`) | "expires in 23h 10m" from `expiresAt`, or "kept until you delete it" for a resident book |
| The entitlement card (`renderEntitlement`) | `tier-disabled`: "24h sandbox". `no-subscription` / `expired`: the upgrade offer in (c). `active-subscription`: "Subscribed: kept until you delete it" with Manage subscription |
| The homepage tier strip | one line each: free in your browser; 24h sandbox with sign-in; resident account (only where `residentTier` is true) |

The `sawUnentitled403` path and the toast "Saving to your account needs the 99p subscription." go
with the 403. `diya-gl-cloud.browser.test.js` gains the expiry text and loses the 403 rows (lines
579-581); a ci behaviour case saves a book and asserts the list's `expiresAt` is within a minute of
`updatedAt + 24h`.

### (c) The resident account through Submit's bundle system

**What exists.** The bundle `resident-diya-gl` (`submit.catalogue.toml` lines 176-190; 99p, `gbp`,
`month`, `listedInEnvironments` excludes prod) with Stripe prices in test and live
(`STRIPE_PRICE_ID_RESIDENT_DIYA_GL` on both `.env.ci` and `.env.prod`); the activity
`diya-gl-storage` (line 466); `app/services/diyaGlEntitlement.js`, which reads the bundles table for
an active, unexpired `resident-diya-gl`; the checkout and portal routes accepting a DIYA-GL token
and a `returnTo` on the DIYA-GL origins (`billingCheckoutPost.js`, `billingReturnUrl.js`);
`cloud.js`'s Subscribe, checkout return and portal (lines 1129-1165); and
`behaviour-tests/diyaGlSubscription.behaviour.test.js` proving the loop on ci. LP-18 and LP-21 are
landed on both sides.

**How entitlement lifts the expiry.** The put route, at each save (section (b)). A resident book
has `expiresAt: null` and the tag `retention=resident`, which no lifecycle rule touches. When the
subscription lapses, the list route computes `expiresAt = bundle.expiry + 30 days` for the owner's
resident books and the get route enforces the same; the next save after the lapse writes them
back to sandbox and re-tags. Physical removal of a lapsed subscriber's untouched resident books is
a scheduled sweeper (DG-3c): a daily Lambda over the bundles table's `bundleId-expiry-index` for
`resident-diya-gl` rows past the grace, deleting those owners' resident books.

**ci-only.** Two mechanisms, both server-side:

1. `DIYA_GL_RESIDENT_TIER` (section (b)): prod's put route never reads the bundle and prod's list
   route reports `tier-disabled`, so no prod page offers an upgrade.
2. `billingCheckoutPost.js` refuses a bundle whose `listedInEnvironments` excludes
   `ENVIRONMENT_NAME` with `400 bundle-not-listed`. Today that list is enforced only by
   `bundles.html`'s client-side filter (line 620), and prod carries a live price id for
   `resident-diya-gl`, so a crafted POST on prod buys a bundle that prod would then grant nothing
   for. The check also covers `resident-ltd`, which is listed the same way. `productCatalog.js`
   gains `isBundleListedInEnvironment` beside `isActivityListedInEnvironment` (line 38).

Lifting the tier to prod later is two edits in one Submit PR: `prod` joins the bundle's
`listedInEnvironments`, and the boolean in `SubmitApplication` flips.

**The page's offer.** Where the sandbox label sits, when `entitlement.residentTier` is true and
`reason` is `no-subscription` or `expired`: "24h sandbox. Keep your books for 99p a month.
[Subscribe]". After Stripe returns with `?checkout=success`, the panel re-reads the list
(`processPendingCheckoutReturn`) and the card becomes "Subscribed: kept until you delete it" with
the existing Manage subscription. A lapsed subscriber sees "Your subscription ended <date>. These
books expire <date>. [Subscribe]". The offer ships behind the list's `residentTier` flag.

**Every host talks to Submit prod (decision 1).** `cloud-config.js` keeps today's prod values on
`diya-gl.co.uk` and `ci.diya-gl.co.uk` alike, and prod's tier switch is off, so no page shows a
Subscribe button until prod lifts the tier. The pages' offer, subscribed and lapsed cards are
proven by the cloud browser spec against a stubbed list. The resident loop end to end is proven by
Submit's own API-level behaviour test, `diyaGlSubscription.behaviour.test.js` on ci: sign in, save
(the put answers `retention: sandbox` with an `expiresAt`), subscribe with the Stripe test card,
save again (`retention: resident`, `expiresAt: null`).

### (d) Pricing

The operator's strategy: free in the browser, a 24h cloud sandbox with sign-in, 99p a month for a
resident account. `PLAN_DIYA_GL_LAUNCH.md` §3 has the fee table (99p monthly keeps 77.5p, fee share
21.7%; 99p billed yearly keeps £11.50, 3.2%), the churn and conversion ranges (3-5% monthly churn,
2-5% freemium conversion), and the revenue at 10,000 free users (200-500 subscribers, £1,860-£4,650
a year). §4 puts infrastructure at about 23p per subscriber per month. §5's ladder is two rungs
and the 2026-09-04 decisions fixed the price. The 24h sandbox is the new piece: it turns sign-in
from a paywall into a try, and the paid tier becomes a time rung, with no feature held back.

| Alternative | For | Against, in §3-§5's numbers |
| --- | --- | --- |
| 99p a month billed yearly (£11.88) | keeps £11.50 against £9.30 for twelve monthly charges; churn is annual | §3 decided monthly and "no annual plan"; a year's commitment before trust lowers conversion; at 500 subscribers the fee difference is about £1,100 a year |
| A one-off per tax year (£4.99 keeps £4.71) | matches how a sole trader thinks about a year's accounts; no card on file | no recurring base; renewal friction every April; the storage promise has an end date, which is the opposite of "kept until you delete it" |
| Longer free retention (7 or 30 days) at the same 99p | fewer readers lose a book to the clock; less support | the free rung becomes enough for most; the 24h rule is the conversion lever; storage cost is noise either way (§4) |
| Donation-only, persistence as a thank-you (12 months resident for any donation over £5) | one ask instead of two; the donation page converts about 8% of those who reach it (§3) | no recurring revenue; Payment Links carry no user, so the grant is manual (the SB-1 note in the launch plan); the subscription plumbing already exists and would sit idle |
| A per-product price (Ltd £2.99, sole trader 99p) | a company has more at stake; £2.99 keeps £2.75 (8.2% fee share) | two prices contradict "no tiers, one price"; the storage cost does not differ by product |
| A book-count cap instead of a time cap (one book free forever, 99p for more) | a time limit reads as punitive to some readers | the cap is arbitrary and the account then competes with the on-device slot in (e); it removes the reason to sign in at all for most |

**Recommendation.** Keep the operator's strategy. The 24h clock runs from the last save, so a
reader who keeps working is never cut off mid-year, and the on-device slot in (e) covers the
no-account reader. Two things would change it, both measured by the LP-9 events (`cloud_sign_in`,
`cloud_save`, `cloud_billing`) plus one new event, `sandbox_expired_seen`, sent when a signed-in
reader's list comes back shorter than their last one:

- If sign-in to first save converts well but save to `subscribe-started` is under 2% after 500
  sign-ins, the clock is not the lever: test a 7-day sandbox before touching the price.
- If `subscribe-started` to `checkout=success` is under half, the monthly card is the friction:
  test the yearly charge as a second button, not a second tier.

### (e) The offline runners and browser storage

**The runners.** Four single-file HTML pages built by `scripts/build-runner.mjs` from the same
bundle the site serves, uploaded to `/runners/` on each deploy. Measured on 2026-09-18 in
`target/runners/`: BST 2.9 MB, Taxi 2.6 MB, SE 5.4 MB, Ltd 8.2 MB; the launch plan's §5a estimate
was 1.2 to 4 MB. Each carries the five provenance stamps. There is no update path beyond
downloading again, and the download page shows no version. `cloud.js` is off under `file://`
(`isEnabled`, lines 26-34), so a runner never signs in. The PWA from LP-6 (`sw.js`, `pwa.js`,
`manifest.webmanifest`) already gives the four pages offline use after one online visit, with
the shell, engine, schemas, tax data and one example per product precached, and updates itself on
the next online visit. The two overlap on "works offline" and differ on ownership: the PWA's cache
is the browser's to evict; the runner is a file the reader can copy, back up and open in ten years.

Healthy, as the file half of the ownership promise, on three conditions. The homepage shows the
runners in one row with each file's size and version stamp, from a `runners.json` the build writes.
Each runner loads `https://diya-gl.co.uk/build-stamp.js` by a plain script tag (a script tag from
`file://` is not subject to CORS) and, when the site's stamp differs from its own, shows one line
offering the newer file. The four sentences on `download.html` go with DG-1.

**Browser storage today.** `autosave.js` keeps one IndexedDB record (`diya-books-autosave`, store
`workingBook`, key `current`: book, lines, source, savedAt), written at every state commit by
`shell.js` `autosaveCurrentBook` (line 1268), offered back on the next visit by `checkForSavedBook`
(line 197), cleared by New (line 1043). Deep-link and example loads skip it. `localStorage` holds
the theme, the all-categories preference and the two donation-prompt flags. `sessionStorage` holds
the cloud session and the PKCE transients. No expiry; the browser's own limits apply (Safari
evicts script-writable storage after seven days without a visit; "clear site data" removes it;
private windows drop it on close).

**Recommendation.** Keep the one slot and make it visible; do not build a second book library in
the browser. The account panel gains an "On this device" row: the working book's name, "saved
2 hours ago", a Clear action, and the sentence "kept on this device until you clear your browser
data; download the file to keep it for good". `shell.js` calls `navigator.storage.persist()` once
after the first autosave, which asks Chromium and Firefox not to evict the store. The three tiers
then read side by side on the homepage strip and in the panel:

| Tier | Where | Kept | Devices |
| --- | --- | --- | --- |
| On this device, no account | the browser | until you clear browser data; the downloaded file is the durable copy | this one |
| 24h sandbox, signed in | the cloud | 24 hours after each save | any |
| Resident, 99p a month | the cloud | until you delete it | any |

A multi-book library in the browser would give a no-account reader most of what the account gives,
with none of its durability, and would split the product in two. The file download is the
no-account reader's durable path; it exists today.

## Decisions taken (operator, 2026-09-19)

1. **Submit environment.** Every host talks to Submit prod, as today; the resident tier is proven by Submit's own API-level behaviour test; no page shows a Subscribe button until prod lifts the tier.
2. **Lapse grace.** 30 days: a lapsed subscriber's resident books expire 30 days after the bundle's expiry.
3. **The format spec page.** Moves to `https://diya-gl.co.uk/spec.html` now (DG-1l).
4. **Analytics.** The existing GA4 property, with `diya-gl.co.uk` added to its stream and referral exclusions.

## Task list

| # | Task | Phase | Precursors | Model | Files |
| --- | --- | --- | --- | --- | --- |
| DG-1a | Root repo: hosted zones for `diya-gl.co.uk` and `diya-gl.com`, aliases, delegate role, lookups | 1 | — | Sonnet | `../root.diyaccounting.co.uk/infra/.../RootDnsStack.java`, `RootEnvironment.java`, `.github/workflows/deploy.yml`, its test (~4 files) |
| DG-1c | The certificate request workflow for the diya-gl hosts | 1 | — | Haiku | `.github/workflows/request-diya-gl-cert.yml` (~1 file) |
| DG-1d | `DiyaGlSiteStack`: bucket, distribution, headers, redirect function, deploy step | 1 | — | Sonnet | `infra/.../stacks/DiyaGlSiteStack.java`, `SpreadsheetsEnvironment.java`, `infra/main/resources/diya-gl-security-headers.json`, `cdk-spreadsheets/cdk.json`, `.github/workflows/deploy.yml`, `infra/test/...` (~6 files) |
| DG-1e | Move the DIYA-GL pages to `web/diya-gl.co.uk/public` and re-home the builds, redirects and links | 1 | — | Sonnet | `web/diya-gl.co.uk/public/**` (moved), `scripts/build-diya-gl-bundle.mjs`, `scripts/build-runner.mjs`, `scripts/build-donate-page.mjs`, `scripts/build-spreadsheets-redirects.cjs`, `web/diya-gl.co.uk/redirects.toml`, `web/spreadsheets.diyaccounting.co.uk/redirects.toml`, `public/download.html`, `public/index.html`, `app/bin/build-sitemaps.js`, `app/lib/sitemap-builder.js`, `web/browser-tests/serve.js`, `playwright.config.js`, `scripts/test-scope.mjs`, `.github/workflows/deploy.yml`, `.github/workflows/test.yml`, `.gitignore`, `CLAUDE.md` (~24 files) |
| DG-1f | The browser and behaviour tests on the new site root | 1 | DG-1e | Haiku | `web/browser-tests/diya-gl-*.browser.test.js` (40), `web/browser-tests/site-ecommerce-events.browser.test.js`, `web/unit-tests/seo-validation.test.js`, `behaviour-tests/spreadsheets.behaviour.test.js`, `package.json` (~45 files) |
| DG-1g | The homepage: the Ltd example at year view 2025-04, the product nav, the tier strip, the runner row | 1 | DG-1e | Opus | `web/diya-gl.co.uk/public/index.html` (new), `shell.js`, `diya-gl.css`, the four pages (noindex), `app/lib/sitemap-builder.js`, `web/browser-tests/diya-gl-home.browser.test.js` (new) (~8 files) |
| DG-1h | Submit repo: the DIYA-GL app client's callback URLs and the allowed origins for the new hosts | 1 | — | Sonnet | `../submit.diyaccounting.co.uk/infra/.../IdentityStack.java`, `SubmitApplication.java`, `infra/test/.../IdentityStackTest.java` (~3 files) |
| DG-1i | The deploy's behaviour job on the new host: `DIYA_GL_BASE_URL` per environment, the sign-in case on `ci.diya-gl.co.uk` against Submit prod | 1 | DG-1e, DG-1h | Sonnet | `.github/workflows/deploy.yml`, `web/diya-gl.co.uk/public/cloud-config.js` (its header comment), `CLAUDE.md` (~3 files) |
| DG-1l | The format spec page moves to `https://diya-gl.co.uk/spec.html`: builder, canonical URL, links, sitemaps, redirect | 1 | DG-1e | Sonnet | `app/bin/build-diya-gl-spec.js`, `web/diya-gl.co.uk/public/spec.html` (moved from `public/diya-gl.html`), `diya-gl/README.md`, `app/bin/build-reconciliation-pages.js`, `public/index.html`, `app/lib/sitemap-builder.js`, `app/test/sitemap-builder.test.js`, `app/test/diya-gl-spec-page.test.js`, `app/test/licence-headers.test.js`, `LICENSING.md`, `web/spreadsheets.diyaccounting.co.uk/redirects.toml` (~11 files) |
| DG-1b | Operator: merge and deploy the root PR, point the registrar at the zones, run the certificate workflow, set `DIYA_GL_CERTIFICATE_ARN`, add the domain in GA4 | 1 | DG-1a, DG-1c | operator | — |
| DG-1j | Operator: cut-over check on `https://diya-gl.co.uk/` and the old links | 1 | DG-1b, DG-1d, DG-1f, DG-1g, DG-1i, DG-1l | operator | — |
| DG-1k | Submit repo: drop the spreadsheets-host callback URLs after the cut-over | 1 | DG-1j | Haiku | `../submit.diyaccounting.co.uk/infra/.../IdentityStack.java`, `IdentityStackTest.java` (~2 files) |
| DG-2a | Submit repo: retention in the storage routes (sandbox 24h, resident), tags, the lifecycle rule, the tier switch | 2 | — | Opus design, then Sonnet | `../submit.diyaccounting.co.uk/app/functions/diyaGl/diyaGlPut.js`, `diyaGlListGet.js`, `diyaGlVersionGet.js`, `app/data/s3DiyaGlRepository.js`, `app/services/diyaGlEntitlement.js`, `infra/.../DiyaGlStack.java`, `DataStack.java`, `SubmitApplication.java`, `app/unit-tests/functions/diyaGl*.test.js`, `infra/test/.../DataStackTest.java`, `DiyaGlStackTest.java` (~10 files) |
| DG-2b | The 24h sandbox on the pages: labels, expiry per book, the 403 path removed, the ci behaviour case | 2 | DG-2a | Sonnet | `web/diya-gl.co.uk/public/cloud.js`, `diya-gl.css`, `web/browser-tests/diya-gl-cloud.browser.test.js`, `behaviour-tests/spreadsheets.behaviour.test.js` (~4 files) |
| DG-3a | Submit repo: checkout refuses a bundle not listed in the current environment | 3 | — | Sonnet | `../submit.diyaccounting.co.uk/app/functions/billing/billingCheckoutPost.js`, `app/services/productCatalog.js`, `app/unit-tests/functions/billingCheckoutPost.test.js` (~3 files) |
| DG-3b | The upgrade offer beside the sandbox label and the lapsed state, behind the tier flag; the resident loop in Submit's behaviour test | 3 | DG-2b | Sonnet | `web/diya-gl.co.uk/public/cloud.js`, `web/browser-tests/diya-gl-cloud.browser.test.js`, `../submit.diyaccounting.co.uk/behaviour-tests/diyaGlSubscription.behaviour.test.js` (~3 files) |
| DG-3c | Submit repo: the daily sweeper for lapsed subscribers' resident books (30-day grace) | 3 | DG-2a | Sonnet | `../submit.diyaccounting.co.uk/app/functions/diyaGl/diyaGlLapseSweep.js` (new), `infra/.../DiyaGlStack.java`, `app/unit-tests/functions/diyaGlLapseSweep.test.js` (new), `DiyaGlStackTest.java` (~4 files) |
| DG-4 | The "On this device" row, `storage.persist()`, the three-tier wording | 1 | DG-2b, DG-1g | Sonnet | `web/diya-gl.co.uk/public/cloud.js`, `shell.js`, `web/browser-tests/diya-gl-cloud.browser.test.js` (~3 files) |
| DG-5 | `runners.json` with size and stamp, the homepage runner row reading it, the newer-file notice in each runner | 1 | DG-1g | Sonnet | `scripts/build-runner.mjs`, `web/diya-gl.co.uk/public/index.html`, `web/browser-tests/diya-gl-runner.browser.test.js` (~3 files) |

## Briefs

- **DG-1a**: in `../root.diyaccounting.co.uk`, `RootDnsStack` gains two `PublicHostedZone`s
  (`diya-gl.co.uk`, `diya-gl.com`) and, in each, `Route53AliasUpsert.upsertAliasToCloudFront` for the
  apex, `www` and `ci` names: apex and `www` to the prod distribution, `ci` to the ci one, from two new
  props `ciDiyaGlCloudFrontDomain` and `prodDiyaGlCloudFrontDomain` (blank skips, as the existing
  props do). The `root-route53-record-delegate` policy adds the two zones' ARNs. `RootEnvironment`
  reads `CI_DIYA_GL_CLOUDFRONT_DOMAIN` and `PROD_DIYA_GL_CLOUDFRONT_DOMAIN`; `deploy.yml` looks them
  up from `{env}-spreadsheets-DiyaGlSiteStack`'s `DistributionDomainName` in the spreadsheets account
  beside the existing lookups (lines 265-295), tolerating a missing stack. The zones' `NameServers`
  are stack outputs. Acceptance: `./mvnw clean verify` green with a test asserting the two zones and
  six alias records; the workflow's synth on the branch shows them.
- **DG-1c**: `.github/workflows/request-diya-gl-cert.yml`, `request-holding-cert.yml` copied and
  edited: domain `diya-gl.co.uk`, SANs `www.diya-gl.co.uk`, `ci.diya-gl.co.uk`, `diya-gl.com`,
  `www.diya-gl.com`, `ci.diya-gl.com`; the validation step resolves each record's zone with
  `route53 list-hosted-zones-by-name` under the delegate credentials and upserts into it; it waits
  for validation and prints the ARN to set as `DIYA_GL_CERTIFICATE_ARN`. Acceptance: `actionlint`
  and a strict YAML parse pass; the operator runs it in DG-1b.
- **DG-1d**: `DiyaGlSiteStack.java` modelled on `SpreadsheetsStack` (origin bucket, OAC, response
  headers from `diya-gl-security-headers.json`, the redirect function read from
  `web/diya-gl.co.uk/redirect-function.js`, `BucketDeployment` of `web/diya-gl.co.uk/public` with
  `prune(false)`, outputs `DistributionDomainName` and `OriginBucketName`); domain names from
  `envName` (ci `ci.diya-gl.co.uk`, `ci.diya-gl.com`; prod `diya-gl.co.uk`, `www.diya-gl.co.uk`,
  `diya-gl.com`, `www.diya-gl.com`); synthesised by `SpreadsheetsEnvironment` when
  `DIYA_GL_CERTIFICATE_ARN` is non-blank, with `cdk.json` context keys beside the holding ones.
  `deploy.yml`: a deploy step gated on `vars.DIYA_GL_CERTIFICATE_ARN != ''`, then
  `aws s3 sync target/runners/ s3://<its bucket>/runners/ --delete`. Acceptance: `./mvnw clean verify`
  with a stack test on the six domain names and the CSP header; `npm run cdk:synth` green.
- **DG-1e**: `git mv web/spreadsheets.diyaccounting.co.uk/public/diya-gl web/diya-gl.co.uk/public`.
  `build-diya-gl-bundle.mjs`: `DIYA_GL_DIR` to the new root; copy `lib/analytics.js`,
  `lib/consent-banner.js` and `favicon.ico` in from the spreadsheets public dir (gitignored). The
  four pages: `../lib/` to `lib/`, `../favicon.ico` to `favicon.ico`. `shell.js`: `DONATE_PAGE_LINK`
  to the absolute spreadsheets URL. `sw.js` `SCOPE_PATH` and the manifest's `start_url` and `scope`
  to `/`. `build-runner.mjs` and `build-donate-page.mjs`: their DIYA-GL paths. `serve.js` and
  `playwright.config.js`: a second root on a second port; `test-scope.mjs`: `web/diya-gl.co.uk/` in
  the browser tier's paths. `build-spreadsheets-redirects.cjs`: a `--site` argument with a hosts map
  per site; `web/diya-gl.co.uk/redirects.toml` with the `.com` and `www` host rules;
  spreadsheets' `redirects.toml` retargets `/books/` and adds `/diya-gl/` onto the `diya-gl` target.
  `download.html` lines 131-160 become the paragraph, badge and link in Design (a); `index.html`
  line 300 points at the new host. `build-sitemaps.js` writes
  `web/diya-gl.co.uk/public/sitemap.xml` and `robots.txt` too. `deploy.yml` and `test.yml` run the
  redirect build for both sites. Acceptance: `npm test` green except the browser and behaviour files
  DG-1f owns, which are listed as the diff's remainder in the commit message.
- **DG-1f**: every `web/browser-tests/diya-gl-*.browser.test.js` loads `/<page>.html` from the
  second root; `site-ecommerce-events.browser.test.js`'s runner rows and the download-page rows in
  `diya-gl-bst.browser.test.js` (line 571 on) follow the new `download.html`; `seo-validation.test.js`
  covers both sitemaps; the four cases in `behaviour-tests/spreadsheets.behaviour.test.js` (lines
  977-1179) read `DIYA_GL_BASE_URL`; `package.json`'s behaviour scripts pass it per environment.
  Acceptance: `npm test -- --all` green.
- **DG-1g**: `index.html` is `ltd.html`'s body with `data-default-example="ltd-brickwork-pro-vat"`,
  `data-default-view="year"`, `data-default-month="2025-04"` on `<body>` and a home strip above the
  topbar: product links, the tier strip (three lines from Design (e)'s table; the resident line only
  when the list's `residentTier` is true, otherwise hidden), and the runner row (plain links until
  DG-5). `shell.js` `parseDeepLinkParams` falls back to the data attributes, `bootFromDeepLink` runs
  on them, and the saved-book offer renders as a banner when `state.savedBook` exists with a book
  loaded. The four pages drop `noindex`; `sitemap-builder.js` lists the five pages. Acceptance: a
  new `diya-gl-home.browser.test.js` asserts the example's business name, the year view, `2025-04`
  open with entries, and a non-zero P&L figure; the deep-link tests still pass.
- **DG-1h**: `IdentityStack.buildBooksUrls` adds, per host, `/`, `/index.html` and the four pages
  for `https://diya-gl.co.uk` and `https://ci.diya-gl.co.uk` on prod, `https://ci.diya-gl.co.uk` on
  every other environment, keeping the spreadsheets entries; `SubmitApplication.booksAllowedOrigins`
  adds the two origins on prod and the ci one elsewhere. Acceptance: `IdentityStackTest` lists the
  new URLs; `./mvnw clean verify` green; one Submit PR.
- **DG-1i**: `deploy.yml`'s behaviour job passes `DIYA_GL_BASE_URL` (ci `https://ci.diya-gl.co.uk`,
  prod `https://diya-gl.co.uk`) beside `SPREADSHEETS_BASE_URL`, minting the test user through the
  prod role in `SUBMIT_TEST_USER_ROLE_ARN` as today; `cloud-config.js`'s header comment names the
  two hosts and that both talk to Submit prod; `CLAUDE.md`'s variable table says the same.
  Acceptance: the ci behaviour sign-in case green on `ci.diya-gl.co.uk` against Submit prod.
- **DG-1l**: `git mv public/diya-gl.html web/diya-gl.co.uk/public/spec.html`;
  `build-diya-gl-spec.js` `OUT_PATH` and `CANONICAL_URL` to the new file and
  `https://diya-gl.co.uk/spec.html`; the links in `diya-gl/README.md` (line 66),
  `build-reconciliation-pages.js` (line 973, now absolute) and `index.html` (line 300);
  `sitemap-builder.js` lists it on the new site's sitemap and drops it from spreadsheets';
  spreadsheets' `redirects.toml` gains `[[redirect]] from = "/diya-gl.html" to = "/spec.html"
  target = "diya-gl"`; `sitemap-builder.test.js`, `diya-gl-spec-page.test.js`,
  `licence-headers.test.js` and `LICENSING.md` follow the path. Acceptance: `npm test` green;
  the spec page test reads the new path.
- **DG-1b**: operator steps, printed by the coordinator when DG-1a and DG-1c are merged: run the
  root `deploy.yml`; `aws --profile management route53domains update-domain-nameservers
  --domain-name diya-gl.co.uk --nameservers Name=<ns1> ...` and the same for `diya-gl.com`, with the
  four names from the zone outputs; run `request-diya-gl-cert.yml`; set `DIYA_GL_CERTIFICATE_ARN`
  add `diya-gl.co.uk` to the GA4 property's web data stream and its referral exclusions.
- **DG-1j**: operator check after the deploys: `https://diya-gl.co.uk/` opens the Ltd example at
  April 2025; `https://diya-gl.com/` and `https://www.diya-gl.co.uk/ltd.html` 301 to the apex;
  `https://spreadsheets.diyaccounting.co.uk/diya-gl/bst.html`, `/books/bst.html` and
  `/diya-gl.html` 301 to the new host; sign-in round-trips on both hosts.
- **DG-1k**: `buildBooksUrls` and `booksAllowedOrigins` lose the `spreadsheets.diyaccounting.co.uk`
  and `ci-spreadsheets` entries and the `/books/` prefix; `IdentityStackTest` follows.
- **DG-2a**: design wave (Opus) over `diyaGlPut.js`, `diyaGlListGet.js`, `diyaGlVersionGet.js`,
  `s3DiyaGlRepository.js` and `diyaGlEntitlement.js` for the contract in Design (b) and (c): the
  sidecar fields, the `Tagging` on `putVersion` and `writeMetadata`, the re-tag on a retention
  change, the list's top-level `entitlement` and its computed lapse expiry (30 days after the
  bundle's expiry), the get route's `404 book-expired`, `DIYA_GL_RESIDENT_TIER` replacing
  `DIYA_GL_ENTITLEMENT_ENFORCED` (`DiyaGlStack` gains `residentTierEnabled`, set in
  `SubmitApplication` to `!"prod".equals(envName)`), `s3:PutObjectTagging` on the put Lambda, and
  the tag-keyed lifecycle rule in `DataStack`. Then Sonnet builds it with the unit tests named in
  the task row and the stack tests. Acceptance: Submit's `npm test` and `./mvnw clean verify`
  green; the system test `diyaGlStorage.system.test.js` shows `expiresAt` on a sandbox put; one
  Submit PR.
- **DG-2b**: `cloud.js`: the texts in Design (b)'s table, `expiresAt` rendered as "expires in
  Nh Mm" (under an hour, "expires in Mm"), the resident row text, the `tier-disabled` card, the
  `sawUnentitled403` path and its toast removed; `diya-gl.css` for the expiry text. Tests: the
  cloud browser spec's stubbed list carries `retention`, `expiresAt` and `entitlement`; the ci
  behaviour case in Design (b). Acceptance: `npm test` green; the behaviour case green on ci.
- **DG-3a**: `productCatalog.js` gains `isBundleListedInEnvironment(bundle, environmentName)` with
  the activity helper's semantics; `billingCheckoutPost.js` loads the bundle by `bundleId` and
  answers `400 bundle-not-listed` when it is not listed for `ENVIRONMENT_NAME`; unit tests for
  `resident-diya-gl` and `resident-ltd` on prod and ci. Acceptance: Submit's `npm test` green; one
  Submit PR.
- **DG-3b**: `renderEntitlement` renders the offer, the subscribed card and the lapsed card from
  the list's top-level `entitlement`, only when `residentTier` is true; the checkout return
  re-reads the list; the browser spec covers the three states and the flag off. Submit's
  `diyaGlSubscription.behaviour.test.js` gains the two put assertions in Design (c): sandbox with
  `expiresAt` before subscribing, resident with `expiresAt: null` after. Acceptance: `npm test`
  green here; Submit's behaviour test green on ci; one Submit PR for its half.
- **DG-3c**: a scheduled Lambda in `DiyaGlStack` (daily) queries the bundles table's
  `bundleId-expiry-index` for `resident-diya-gl` rows whose `expiry` is older than the grace,
  resolves each owner's prefix and deletes their `retention=resident` books; unit test with the
  DynamoDB and S3 clients mocked; stack test for the schedule and the permissions. Acceptance:
  Submit's `npm test` and `./mvnw clean verify` green; one Submit PR.
- **DG-4**: `cloud.js` renders the "On this device" row from `DiyaGlAutosave.loadWorkingBook()`
  (name, savedAt as "saved N ago", Clear calling `clearWorkingBook`), signed in or out, with the
  sentence from Design (e); `shell.js` calls `navigator.storage.persist()` once after the first
  successful autosave, guarded; the homepage tier strip's first line matches. Acceptance: browser
  rows for the row's presence, the Clear action and the persist call (stubbed).
- **DG-5**: `build-runner.mjs` writes `target/runners/runners.json` (`product`, `file`, `bytes`,
  the five stamps) and inlines a script tag for `https://diya-gl.co.uk/build-stamp.js` that compares
  `DIYA_GL_BUILD_STAMP` with the runner's own and shows one line linking the newer file when they
  differ; `index.html` reads `runners/runners.json` to print size and version per link.
  Acceptance: `diya-gl-runner.browser.test.js` covers the manifest and the notice.

## Sources

- `NEXT.md` (the DG-1, DG-2, DG-3 rows); `PLAN_DIYA_GL_LAUNCH.md` §3, §4, §5a, §5c, "Decisions
  taken (operator, 2026-09-04)", the task list and briefs LP-6, LP-9, LP-15 to LP-18, LP-21,
  "Donations: the sandbox and the events", "Where this changes the DIYA-GL Cloud plan".
- This repo: `web/spreadsheets.diyaccounting.co.uk/public/download.html` (131-160),
  `public/index.html` (300), `public/diya-gl.html`, `public/robots.txt`, `app/bin/build-diya-gl-spec.js`
  (37-39), `app/bin/build-reconciliation-pages.js` (973), `diya-gl/README.md` (66),
  `public/lib/analytics.js`; `public/diya-gl/` (`ltd.html`, `shell.js` 180-335, 1092-1120, 1255-1275,
  3060-3100; `cloud.js` 1-80, 203-235, 536-660, 1125-1165; `cloud-config.js`; `save.js`;
  `autosave.js`; `examples.js`; `data.js` 522-560; `pwa.js`; `sw.js`; `manifest.webmanifest`;
  `diya-gl-events.js`; `donate-config.js`; `diya-gl.css` 1-45; `assets/`); `redirects.toml`;
  `scripts/build-spreadsheets-redirects.cjs`, `build-runner.mjs`, `build-diya-gl-bundle.mjs`,
  `build-donate-page.mjs`; `app/bin/build-sitemaps.js`, `app/lib/sitemap-builder.js`,
  `app/bin/extract-scenarios.js`; `infra/main/java/.../SpreadsheetsEnvironment.java`,
  `stacks/SpreadsheetsStack.java`, `stacks/HoldingStack.java`, `infra/main/resources/security-headers.json`,
  `cdk-spreadsheets/cdk.json`; `.github/workflows/deploy.yml`, `request-holding-cert.yml`,
  `test.yml`; `web/browser-tests/serve.js`, the `diya-gl-*` browser tests, `web/unit-tests/`;
  `behaviour-tests/spreadsheets.behaviour.test.js`; `target/runners/` (sizes); `package.json`.
- Submit: `infra/main/java/.../stacks/DiyaGlStack.java`, `DataStack.java` (900-930),
  `IdentityStack.java` (250-340, 480-520), `SubmitApplication.java` (165-185, 475-535),
  `SubmitSharedNames.java` (1185, 1368); `app/functions/diyaGl/diyaGlPut.js`, `diyaGlListGet.js`;
  `app/data/s3DiyaGlRepository.js`; `app/services/diyaGlEntitlement.js`, `productCatalog.js` (36-41);
  `app/functions/billing/billingCheckoutPost.js`, `billingReturnUrl.js`; `web/public/submit.catalogue.toml`
  (160-200, 455-480), `web/public/bundles.html` (612-632); `.env.ci`, `.env.prod`;
  `behaviour-tests/diyaGlSubscription.behaviour.test.js`; `infra/test/.../DiyaGlStackTest.java`,
  `IdentityStackTest.java`; `.claude/skills/stripe-catalogue-sync/SKILL.md`; `git log` for B55.
- Root: `infra/main/java/co/uk/diyaccounting/root/RootEnvironment.java`, `stacks/RootDnsStack.java`,
  `stacks/ApexStack.java` (150-200), `cdk-root/cdk.json`, `.github/workflows/deploy.yml` (160-295),
  `CLAUDE.md` (30-50, 112-130).
- www: `infra/main/java/.../GatewayStack.java` (243-255, the redirect function pattern).
