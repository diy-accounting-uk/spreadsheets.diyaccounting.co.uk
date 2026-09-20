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
homepage. The move is a `git mv`; the pages already reach every asset by relative path (`assets/`,
`engine/`, `products/`, `sw.js`). The four offline runners (`target/runners/`, built by
`scripts/build-runner.mjs`) upload to the new site's bucket under `/runners/`. Three files the pages
reach with `../` today are re-homed, and three more are copied for the pages that follow:
`lib/analytics.js`, `lib/consent-banner.js`, `lib/ecommerce-events.js`, `spreadsheets.css`,
`favicon.ico` and `favicon.svg` are copied into `web/diya-gl.co.uk/public/` by
`scripts/build-diya-gl-bundle.mjs` (generated, gitignored, one source). The two published JSON
Schemas are copied to `web/diya-gl.co.uk/public/schema/` the same way: the resource loader, the
service worker's precache list and every book validation name `/schema/`, so the new host serves
that root too. `DONATE_PAGE_LINK` in `shell.js` becomes the absolute
`https://spreadsheets.diyaccounting.co.uk/donate.html`. `sw.js`'s `SCOPE_PATH` and the manifest's
`start_url` and `scope` become `/`.

**What stays on spreadsheets.** `download.html`'s DIYA-GL section (lines 131-160) shrinks to one
paragraph and one link: "View and edit your books in DIYA-GL, free in your browser, with a 24h
sandbox when you sign in", the badge reading "24h sandbox", the link `https://diya-gl.co.uk/`. The
format spec page `diya-gl.html` moves to `https://diya-gl.co.uk/spec.html` (DG-1l): the builder
`app/bin/build-diya-gl-spec.js` writes it there with the new canonical URL and with every link in
the emitted page re-pointed: the stylesheet, favicons and the two lib scripts read the copies in the
new root, the four product links go relative, and the rest of the site nav goes absolute on
`spreadsheets.diyaccounting.co.uk`. The npm README (`diya-gl/README.md` line 66), the
reconciliation pages (`build-reconciliation-pages.js` line 973), `index.html` line 300 and both
sitemaps point at it, and spreadsheets' `redirects.toml` 301s the old path. `redirects.toml` gains a target `diya-gl`
(ci `ci.diya-gl.co.uk`, prod `diya-gl.co.uk`) and retargets the `/books/` prefix and a new
`/diya-gl/` prefix onto it, so every old link and PWA path lands on the new site. `donate.html`, the
packages, the knowledge base and the reconciliation pages stay.

**The homepage.** `index.html` is the Ltd page's markup with a home strip above the topbar: the four
product links, the sign-in button, one sentence per tier (free in your browser, 24h sandbox,
resident account), and a "Take it offline" row for the four runners. With no `example` in the URL
the page loads `ltd-brickwork-pro-vat` at `view=year`, `month=2025-04`, through the deep-link path
`shell.js` already has (`parseDeepLinkParams`, `bootFromDeepLink`, `applyDeepLinkViewAndMonth`,
lines 224-286): the body carries `data-default-example`, `data-default-view` and
`data-default-month`, and `parseDeepLinkParams` falls back to them when the URL names no example.
Two call sites follow from that fallback: `init()` branches on `deepLink.example` to decide whether
to check for a saved book, so it checks in both branches; and `syncDeepLinkUrl()` skips the rewrite
when the example came from the attributes, so the homepage URL stays clean. The load uses
`skipAutosave: true` as deep links do, so a reader's own working book in IndexedDB is untouched; the
existing continue-offer shows as a banner over the example instead of on the empty state. The
figures are the engine's own: the fixture is `assets/examples/brickwork-pro/ltd-vat/` (`book.toml`,
`lines.jsonl`), extracted from `examples/precision-code-ltd/` by `app/bin/extract-scenarios.js`,
recalculated in the browser by `engine/diya-gl-engine.js`. The four product pages drop `<meta
name="robots" content="noindex">`; the new site gets its own `sitemap.xml` from
`app/bin/build-sitemaps.js` and a committed `robots.txt`.

**Branding.** `diya-gl.css` as it is: the teal `#158484` on `#f7fafa`, Arial, floating white panels,
the `DIYA-GL` mark. The home strip uses the same tokens and no new ones.

**DNS, certificate, CDK, deploy.**

| Step | Where | What |
| --- | --- | --- |
| Zones | `../root.diyaccounting.co.uk` | Two `PublicHostedZone`s (`diya-gl.co.uk`, `diya-gl.com`) in `RootDnsStack`, alias records `@`, `www`, `ci` in each, pointing at the prod and ci distributions below; the `root-route53-record-delegate` role's policy extended to both zones; `deploy.yml` looks up `{env}-spreadsheets-DiyaGlSiteStack`'s `DistributionDomainName` the way it does for `SpreadsheetsStack` (its lines 265-295) |
| Registrar | operator, management account | Route53 Domains still points both names at the registration's default name servers; after the first root deploy the operator runs `aws route53domains update-domain-nameservers --region us-east-1` once per name; a second root deploy after the site stacks exist writes the aliases with the new zones' NS set |
| Certificate | this repo, `.github/workflows/request-diya-gl-cert.yml` | The `request-holding-cert.yml` pattern: `acm request-certificate` in us-east-1 for `diya-gl.co.uk` with SANs `www.diya-gl.co.uk`, `ci.diya-gl.co.uk`, `diya-gl.com`, `www.diya-gl.com`, `ci.diya-gl.com`; validation CNAMEs written through the delegate role into whichever of the two zones each name belongs to; the ARN goes into a repository variable `DIYA_GL_CERTIFICATE_ARN` |
| Stack | this repo, `infra/.../stacks/DiyaGlSiteStack.java` | `{env}-spreadsheets-DiyaGlSiteStack`: S3 origin with OAC, one CloudFront distribution, domain names ci `ci.diya-gl.co.uk`, `ci.diya-gl.com`; prod `diya-gl.co.uk`, `www.diya-gl.co.uk`, `diya-gl.com`, `www.diya-gl.com`; its own response-headers policy from `infra/main/resources/diya-gl-security-headers.json`; its own redirect function; `DistributionDomainName` and `OriginBucketName` outputs. `SpreadsheetsEnvironment` synthesises it when `DIYA_GL_CERTIFICATE_ARN` is set, as it gates `HoldingStack` on its certificate |
| Deploy | `.github/workflows/deploy.yml` | A deploy step after `SpreadsheetsStack`, gated on the variable like the holding step (lines 313-331); runners upload to the new bucket as well; the spreadsheets upload goes when `download.html` stops linking them (DG-1e); the behaviour job gets `DIYA_GL_BASE_URL` (ci `https://ci.diya-gl.co.uk`, prod `https://diya-gl.co.uk`) beside `SPREADSHEETS_BASE_URL` |
| `.com` | the redirect function | `web/diya-gl.co.uk/redirects.toml` and a generalised `scripts/build-spreadsheets-redirects.cjs` (a `--site` argument): any host ending `diya-gl.com` 301s to the same path on `diya-gl.co.uk` (`ci.diya-gl.com` to `ci.diya-gl.co.uk`), and `www.diya-gl.co.uk` to the apex; both `.com` aliases sit on the same distribution, so one certificate and one function cover it |
| CSP | `diya-gl-security-headers.json` | `default-src 'self'`; `script-src 'self' 'unsafe-inline' https://www.googletagmanager.com`; `connect-src 'self'` plus the GA hosts, `https://submit.diyaccounting.co.uk`, `https://prod-auth.diyaccounting.co.uk`; `form-action 'self'`; `frame-ancestors 'none'`; no PayPal. `web/browser-tests/serve.js` reads it for the second root |
| Cognito | `../submit.diyaccounting.co.uk/infra/.../IdentityStack.java` `buildBooksUrls` | Callback and logout URLs for `https://diya-gl.co.uk/`, `/index.html`, the four pages, and the same under `https://ci.diya-gl.co.uk` (prod lists the ci host as it does today for `ci-spreadsheets`, so the ci behaviour run can sign in); `SubmitApplication.booksAllowedOrigins` (lines 173-179) adds the two origins, which also feeds `BILLING_RETURN_URL_ORIGINS`. The old spreadsheets-host entries and both path prefixes stay until DG-1j passes, then go (DG-1k) |
| Which Submit | `web/diya-gl.co.uk/public/cloud-config.js` | Every host talks to Submit prod, as today (decision 1): the committed `cloud-config.js` keeps its one set of values; the ci behaviour job keeps minting its test user through the prod role in `SUBMIT_TEST_USER_ROLE_ARN` and targets `ci.diya-gl.co.uk` through `DIYA_GL_BASE_URL` |
| Analytics | operator, GA4 admin | The measurement id `G-X4ZPD99X2K` stays; the web data stream's cross-domain list and referral exclusions gain `diya-gl.co.uk` |

**Tests.** Thirty-nine of the 40 `web/browser-tests/diya-gl-*.browser.test.js` files load
`/diya-gl/<page>.html` from the spreadsheets root; they move to `/<page>.html` on the new root
`serve.js` serves. `diya-gl-runner.browser.test.js` opens `target/runners/diya-gl-bst.html` over
`file://` and is unaffected by the move. `scripts/test-scope.mjs` gains a route for
`web/diya-gl.co.uk/public/`: the existing `browser asset` row matches those paths already but
narrows to one spec by filename, because it reads the page directory out of `/public/<dir>/` and the
new root has none. The five DIYA-GL cases in `behaviour-tests/spreadsheets.behaviour.test.js` (the four
example loads from line 963 and the cloud sign-in case at line 1409) read `DIYA_GL_BASE_URL`. A new homepage browser case asserts the example loads, the year
view is on, `2025-04` is open and the figures render.

### (b) The 24h sandbox

**The rule.** A signed-in save is kept for 24 hours after the last save of that book. The clock is
in the metadata sidecar, the routes enforce it, and an S3 lifecycle rule is the janitor.

**Submit's storage (`DiyaGlStack`, `DataStack`, the four handlers).** Today `diyaGlPut.js` writes
`metadata.json` with `entitlementAtPut` and no expiry, `DIYA_GL_ENTITLEMENT_ENFORCED` is `"false"`
on every environment, and the `DataStack` bucket (lines 907-928) has two lifecycle rules,
`abort-incomplete-uploads` and `expire-noncurrent-versions` (30 days). The change:

| Piece | Change |
| --- | --- |
| Sidecar | `retention: "sandbox" \| "resident"` and `expiresAt: <ISO> \| null`, written on every put; sandbox `expiresAt = updatedAt + 24h`; the `entitlementAtPut` field stays |
| Put route | `entitlementFor(sub)` decides retention: active `resident-diya-gl` bundle gives `resident`; anything else gives `sandbox`. The `403 subscription-required` gate and `DIYA_GL_ENTITLEMENT_ENFORCED` go: a sandbox save is always allowed. Each version object and the sidecar carry the S3 tag `retention=<value>` (`Tagging` on `PutObject`, so the put Lambda gains `s3:PutObjectTagging`); when a book's retention changes at a save, the route re-tags its kept versions (at most `DIYA_GL_VERSIONS_KEPT`, 30) |
| List route | Reads `entitlementFor(sub)` once and returns it at the top level as `entitlement: {reason, expiry, residentTier}`; the list Lambda gains `BUNDLE_DYNAMODB_TABLE_NAME`, `DIYA_GL_BUNDLE_ID`, `DIYA_GL_RESIDENT_TIER` and a `dynamodb:Query` grant on the bundles table, none of which it has today; each book carries `retention` and `expiresAt`; a sandbox book past `expiresAt` is left out |
| Get route | A version of a sandbox book past `expiresAt` answers `404 book-expired`; a resident book under a lapsed subscription is read through the same `entitlementFor` call, so the version Lambda takes the same three variables and the same grant |
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
with the 403. `diya-gl-cloud.browser.test.js` gains the expiry text and loses the `403
subscription-required` test (line 557); a ci behaviour case saves a book and asserts the list's
`expiresAt` is within a minute of `updatedAt + 24h`.

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
The runner build embeds the site's current `DIYA_GL_BUILD_STAMP` in each runner as its own stamp.
Each runner then loads `https://diya-gl.co.uk/build-stamp.js` by a plain script tag (a script tag
from `file://` is not subject to CORS) and, when the site's stamp differs from the embedded one,
shows one line offering the newer file. Offline the script never loads and the line never shows. The
four sentences on `download.html` go with DG-1.

**Browser storage today.** `autosave.js` keeps one IndexedDB record (`diya-books-autosave`, store
`workingBook`, key `current`: book, lines, source, savedAt), written at every state commit by
`shell.js` `autosaveCurrentBook` (line 1268), offered back on the next visit by `checkForSavedBook`
(line 197), cleared by New (line 1043). Deep-link and example loads skip it. `localStorage` holds
the theme, the all-categories preference and the two donation-prompt flags. `sessionStorage` holds
the cloud session and the PKCE transients. No expiry; the browser's own limits apply (Safari
evicts script-writable storage after seven days without a visit; "clear site data" removes it;
private windows drop it on close).

**Recommendation.** Keep the one slot and make it visible; do not build a second book library in the
browser. The account panel gains an "On this device" row: the working book's name, "saved 2 hours
ago", a Clear action, and the sentence "kept on this device until you clear your browser data;
download the file to keep it for good". The panel mounts only where `cloud.js`'s `isEnabled()`
passes, so a `file://` runner shows no row. `shell.js` calls `navigator.storage.persist()` once
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
| DG-1a | Root repo: hosted zones for `diya-gl.co.uk` and `diya-gl.com`, aliases, delegate role, lookups | 1 | — | Sonnet | `../root.diyaccounting.co.uk/infra/main/java/co/uk/diyaccounting/root/stacks/RootDnsStack.java`, `RootEnvironment.java`, `cdk-root/cdk.json`, `.github/workflows/deploy.yml`, `infra/test/java/co/uk/diyaccounting/root/stacks/RootDnsStackTest.java` (new), `CLAUDE.md` (~6 files) |
| DG-1c | The certificate request workflow for the diya-gl hosts | 1 | — | Haiku | `.github/workflows/request-diya-gl-cert.yml` (new) (~1 file) |
| DG-1d | `DiyaGlSiteStack`: bucket, distribution, headers, redirect function, deploy step | 1 | — | Sonnet | `infra/main/java/co/uk/diyaccounting/spreadsheets/stacks/DiyaGlSiteStack.java` (new), `infra/main/java/co/uk/diyaccounting/spreadsheets/SpreadsheetsEnvironment.java`, `infra/main/resources/diya-gl-security-headers.json` (new), `cdk-spreadsheets/cdk.json`, `pom.xml`, `infra/test/java/co/uk/diyaccounting/spreadsheets/stacks/DiyaGlSiteStackTest.java` (new), `.github/workflows/deploy.yml` (~7 files) |
| DG-1e | Move the DIYA-GL pages to `web/diya-gl.co.uk/public` and re-home the builds, redirects, links and path constants | 1 | DG-1d | Sonnet | `web/diya-gl.co.uk/public/**` (moved), `scripts/build-diya-gl-bundle.mjs`, `scripts/build-runner.mjs`, `scripts/build-donate-page.mjs`, `scripts/build-spreadsheets-redirects.cjs`, `web/diya-gl.co.uk/redirects.toml` (new), `web/diya-gl.co.uk/public/robots.txt` (new), `web/spreadsheets.diyaccounting.co.uk/redirects.toml`, `public/download.html`, `app/bin/build-sitemaps.js`, `app/lib/sitemap-builder.js`, `web/browser-tests/serve.js`, `scripts/test-scope.mjs`, `app/test/test-scope-routing.test.js`, ten node-side tests holding the old path constant, `.github/workflows/deploy.yml`, `.github/workflows/test.yml`, `.gitignore`, `.prettierignore`, `eslint.security.config.js`, `CLAUDE.md` (~40 files) |
| DG-1f | The browser and behaviour tests on the new site root | 1 | DG-1e, DG-1d | Haiku | `web/browser-tests/diya-gl-*.browser.test.js` (39 of 40), `web/browser-tests/r-sources.js`, `site-ecommerce-events.browser.test.js`, `spreadsheets-content.browser.test.js`, `web/unit-tests/seo-validation.test.js`, `behaviour-tests/spreadsheets.behaviour.test.js`, `package.json` (~45 files) |
| DG-1g | The homepage: the Ltd example at year view 2025-04, the product nav, the tier strip, the runner row | 1 | DG-1e | Opus | `web/diya-gl.co.uk/public/index.html` (new), `shell.js`, `diya-gl.css`, the four pages (noindex), `scripts/build-diya-gl-bundle.mjs`, `app/lib/sitemap-builder.js`, `playwright.config.js`, `web/browser-tests/diya-gl-home.browser.test.js` (new) (~11 files) |
| DG-1h | Submit repo: the DIYA-GL app client's callback URLs and the allowed origins for the new hosts | 1 | — | Sonnet | `../submit.diyaccounting.co.uk/infra/main/java/co/uk/diyaccounting/submit/stacks/IdentityStack.java`, `SubmitApplication.java`, `infra/test/java/co/uk/diyaccounting/submit/stacks/IdentityStackTest.java` (~3 files) |
| DG-1i | The deploy's behaviour job on the new host: `DIYA_GL_BASE_URL` per environment, the sign-in case on `ci.diya-gl.co.uk` against Submit prod | 1 | DG-1e, DG-1f, DG-1h | Haiku | `.github/workflows/deploy.yml`, `web/diya-gl.co.uk/public/cloud-config.js` (its header comment), `CLAUDE.md` (~3 files) |
| DG-1l | The format spec page moves to `https://diya-gl.co.uk/spec.html`: builder, canonical URL, links, sitemaps, redirect | 1 | DG-1e | Sonnet | `app/bin/build-diya-gl-spec.js`, `web/diya-gl.co.uk/public/spec.html` (moved from `public/diya-gl.html`), `diya-gl/README.md`, `diya-gl/package.json`, `app/bin/build-reconciliation-pages.js`, `web/spreadsheets.diyaccounting.co.uk/public/reconciliation/releases.html` (rebuilt), `public/index.html`, `app/lib/sitemap-builder.js`, `app/test/sitemap-builder.test.js`, `app/test/diya-gl-spec-page.test.js`, `app/test/licence-headers.test.js`, `.prettierignore`, `LICENSING.md`, `web/spreadsheets.diyaccounting.co.uk/redirects.toml`, the four `.github/workflows/generate-*.yml` (~18 files) |
| DG-1b | Cut-over runbook: root deploy, registrar name servers, certificate workflow, `DIYA_GL_CERTIFICATE_ARN`, site stacks in both environments, second root deploy; the session runs each step, the operator says go on each write | 1 | DG-1a, DG-1c, DG-1d, DG-1e | Sonnet | — (workflow dispatches, one Route 53 Domains write per name, one repository variable) |
| DG-1m | Operator: GA4 admin, `diya-gl.co.uk` in the stream's cross-domain list and referral exclusions | 1 | — | operator | — |
| DG-1j | Cut-over probes on `https://diya-gl.co.uk/` and the old links: a prod behaviour run on the new host plus the redirect and file cases | 1 | DG-1b, DG-1d, DG-1f, DG-1g, DG-1i, DG-1l | Haiku | `behaviour-tests/spreadsheets.behaviour.test.js` (~1 file) |
| DG-1k | Submit repo: drop the spreadsheets-host callback URLs and origins after the cut-over | 1 | DG-1j | Haiku | `../submit.diyaccounting.co.uk/infra/main/java/co/uk/diyaccounting/submit/stacks/IdentityStack.java`, `infra/main/java/co/uk/diyaccounting/submit/SubmitApplication.java`, `infra/test/java/co/uk/diyaccounting/submit/stacks/IdentityStackTest.java` (~3 files) |
| DG-2a | Submit repo: retention in the storage routes (sandbox 24h, resident), tags, the lifecycle rule, the tier switch | 2 | — | Opus design, then Sonnet | `../submit.diyaccounting.co.uk/app/functions/diyaGl/diyaGlPut.js`, `diyaGlListGet.js`, `diyaGlVersionGet.js`, `app/data/s3DiyaGlRepository.js`, `app/services/diyaGlEntitlement.js`, `infra/main/java/co/uk/diyaccounting/submit/stacks/DiyaGlStack.java`, `DataStack.java`, `SubmitApplication.java`, `app/unit-tests/functions/diyaGlPut.test.js`, `diyaGlListGet.test.js`, `diyaGlVersionGet.test.js`, `diyaGlCorsHeaders.test.js`, `app/unit-tests/services/diyaGlEntitlement.test.js`, `app/system-tests/diyaGlStorage.system.test.js`, `behaviour-tests/diyaGlSubscription.behaviour.test.js`, `infra/test/java/co/uk/diyaccounting/submit/stacks/DataStackTest.java`, `DiyaGlStackTest.java` (~17 files) |
| DG-2b | The 24h sandbox on the pages: labels, expiry per book, the 403 path removed, the ci behaviour case | 2 | DG-2a, DG-1e | Sonnet | `web/diya-gl.co.uk/public/cloud.js`, `diya-gl.css`, `web/browser-tests/diya-gl-cloud.browser.test.js`, `behaviour-tests/spreadsheets.behaviour.test.js` (~4 files) |
| DG-3a | Submit repo: checkout refuses a bundle not listed in the current environment | 3 | — | Sonnet | `../submit.diyaccounting.co.uk/app/functions/billing/billingCheckoutPost.js`, `app/services/productCatalog.js`, `app/unit-tests/functions/billingCheckoutPost.test.js`, `app/unit-tests/services/productCatalog.test.js` (~4 files) |
| DG-3b | The upgrade offer beside the sandbox label and the lapsed state, behind the tier flag; the resident loop in Submit's behaviour test | 3 | DG-2b | Sonnet | `web/diya-gl.co.uk/public/cloud.js`, `web/browser-tests/diya-gl-cloud.browser.test.js`, `../submit.diyaccounting.co.uk/behaviour-tests/diyaGlSubscription.behaviour.test.js` (~3 files) |
| DG-3c | Submit repo: the daily sweeper for lapsed subscribers' resident books (30-day grace) | 3 | DG-2a | Sonnet | `../submit.diyaccounting.co.uk/app/functions/diyaGl/diyaGlLapseSweep.js` (new), `app/data/dynamoDbBundleRepository.js`, `infra/main/java/co/uk/diyaccounting/submit/stacks/DiyaGlStack.java`, `app/unit-tests/functions/diyaGlLapseSweep.test.js` (new), `infra/test/java/co/uk/diyaccounting/submit/stacks/DiyaGlStackTest.java` (~5 files) |
| DG-4 | The "On this device" row, `storage.persist()`, the three-tier wording | 1 | DG-2b, DG-1g | Sonnet | `web/diya-gl.co.uk/public/cloud.js`, `shell.js`, `web/browser-tests/diya-gl-cloud.browser.test.js` (~3 files) |
| DG-5 | `runners.json` with size and stamp, the homepage runner row reading it, the newer-file notice in each runner | 1 | DG-1g | Sonnet | `scripts/build-runner.mjs`, `web/diya-gl.co.uk/public/index.html`, `web/diya-gl.co.uk/public/diya-gl.css`, `web/browser-tests/diya-gl-runner.browser.test.js` (~4 files) |
| DG-6 | The `sandbox_expired_seen` event: sent once when a signed-in reader's list comes back shorter than their last one | 2 | DG-2b | Sonnet | `web/diya-gl.co.uk/public/diya-gl-events.js`, `cloud.js`, `web/browser-tests/diya-gl-cloud.browser.test.js` (~3 files) |

## Briefs

- **DG-1a**: in `../root.diyaccounting.co.uk`, on a branch `claude/dns-diya-gl` from `main`, one PR. `RootDnsStack.java`: after the root zone lookup (line 144), create two `PublicHostedZone`s, ids `DiyaGlCoUkZone` and `DiyaGlComZone`, zone names `diya-gl.co.uk` and `diya-gl.com`, unconditionally; output `DiyaGlCoUkNameServers` and `DiyaGlComNameServers` as `Fn.join(",", zone.getHostedZoneNameServers())`. Two new props on `RootDnsStackProps`, `ciDiyaGlCloudFrontDomain` and `prodDiyaGlCloudFrontDomain`, `@Value.Default` blank like the others. When `prodDiyaGlCloudFrontDomain` is non-blank, `Route53AliasUpsert.upsertAliasToCloudFront` for the apex (`relativeRecordName` null) and `www` in each zone (ids `DiyaGlCoUkApex`, `DiyaGlCoUkWww`, `DiyaGlComApex`, `DiyaGlComWww`); when `ciDiyaGlCloudFrontDomain` is non-blank, `ci` in each zone (`DiyaGlCoUkCi`, `DiyaGlComCi`). Each call makes an A and an AAAA custom resource, twelve in all. The delegate role (lines 254-269): its `ChangeResourceRecordSets`/`GetHostedZone` statement's resources become the root zone ARN plus `coUkZone.getHostedZoneArn()` and `comZone.getHostedZoneArn()`; a second statement grants `route53:ListHostedZonesByName` on `*` (Route 53 list actions take no resource ARN), because DG-1c resolves each zone by name under this role. Update the class comment's record list. `RootEnvironment.java`: read `CI_DIYA_GL_CLOUDFRONT_DOMAIN` and `PROD_DIYA_GL_CLOUDFRONT_DOMAIN` through `envOr` with context keys `ciDiyaGlCloudFrontDomain` and `prodDiyaGlCloudFrontDomain`, pass them through the constructor and builder; `cdk-root/cdk.json` gains both keys, blank. `.github/workflows/deploy.yml`: in the `Lookup spreadsheets CloudFront domains` step (lines 264-320), after the holding lookups (lines 301-314) and in their shape (always looked up, `2>/dev/null || echo ""`, no dispatch input), look up `ci-spreadsheets-DiyaGlSiteStack` and `prod-spreadsheets-DiyaGlSiteStack` `DistributionDomainName`, write outputs `ci-diya-gl-cloudfront-domain` and `prod-diya-gl-cloudfront-domain`, and pass them as `CI_DIYA_GL_CLOUDFRONT_DOMAIN` and `PROD_DIYA_GL_CLOUDFRONT_DOMAIN` in the `Deploy RootDnsStack (CDK)` step's `env` (lines 421-431) with an echo line each. `CLAUDE.md` Quick Reference: one line naming the two zones. New `RootDnsStackTest.java` in the shape of `CostReportingStackTest.java`: synth `RootDnsStack` with `hostedZoneId` `Z0315522208PWZSSBI9AL`, both diya-gl domains set to fake `cloudfront.net` names and `delegateAccountIds` `List.of("064390746177")`; assert `resourceCountIs("AWS::Route53::HostedZone", 2)` with `Name` `diya-gl.co.uk.` and `diya-gl.com.`, `resourceCountIs("Custom::AWS", 12)`, and an `AWS::IAM::Policy` whose statements include `route53:ListHostedZonesByName` on `*` and a `ChangeResourceRecordSets` statement with three resources; a second synth with both domains blank asserts `Custom::AWS` count 0. Acceptance: in `../root.diyaccounting.co.uk`, `./mvnw clean verify` green (the new test runs; `testSourceDirectory` is already `infra/test/java`) and `npm run cdk:synth` green; `test.yml` green on the branch (it runs on every branch push under `infra/**` and `.github/workflows/*.yml`). Deploy is `deploy.yml` by manual dispatch from `main` after merge (DG-1b).

- **DG-1c**: `.github/workflows/request-diya-gl-cert.yml` (new), a copy of `request-holding-cert.yml` with these edits. Name `request diya-gl cert`, `workflow_dispatch` only, `environment: prod`, the same two `configure-aws-credentials@v6` steps (`SPREADSHEETS_ACTIONS_ROLE_ARN`, then `SPREADSHEETS_DEPLOY_ROLE_ARN`). Request step: `aws acm request-certificate --domain-name diya-gl.co.uk --subject-alternative-names www.diya-gl.co.uk ci.diya-gl.co.uk diya-gl.com www.diya-gl.com ci.diya-gl.com --validation-method DNS --region us-east-1`. Validation step: poll `describe-certificate` until six non-null `ResourceRecord`s (the holding file waits for five, line 70); assume `arn:aws:iam::887764105431:role/root-route53-record-delegate` with session name `spreadsheets-diya-gl-cert`, exported into the step's shell only as the holding file does (lines 73-82); then for each of `diya-gl.co.uk` and `diya-gl.com`: `ZONE_ID=$(aws route53 list-hosted-zones-by-name --dns-name "$ZONE_NAME" --query "HostedZones[?Name=='${ZONE_NAME}.'].Id | [0]" --output text)`, fail with a message if it is empty or `None`, strip the `/hostedzone/` prefix, select the records with `jq --arg z "$ZONE_NAME" '[.[] | select(.Name | endswith("." + $z + ".")) | {Action:"UPSERT", ResourceRecordSet:{Name:.Name, Type:.Type, TTL:300, ResourceRecords:[{Value:.Value}]}}] | unique'`, and `change-resource-record-sets` into that zone. Wait step and print step as the holding file, the print naming the repository variable `DIYA_GL_CERTIFICATE_ARN`. The run needs the zones and the `ListHostedZonesByName` grant from DG-1a deployed; DG-1b runs it in that order. Acceptance: `actionlint .github/workflows/request-diya-gl-cert.yml` exits 0; `node -e "require('js-yaml').load(require('fs').readFileSync('.github/workflows/request-diya-gl-cert.yml','utf8'))"` exits 0 (js-yaml rejects duplicate keys); `npm test` green (the router picks `lint:workflows` for a workflow change).

- **DG-1d**: `DiyaGlSiteStack.java` (new) in the shape of `SpreadsheetsStack.java`: props `envName`, `certificateArn`, `docRootPath`, `domainNames`; resource prefix `envName + "-diya-gl"`; the same tags with `Stack` `DiyaGlSiteStack` and `BillingPurpose` `diya-gl-static-site`; certificate by ARN; origin bucket with `BLOCK_ALL`, `DESTROY`, `autoDeleteObjects`, the OAC bucket policy; a private `loadSecurityHeaders()` reading `/diya-gl-security-headers.json`; the response headers policy built exactly as lines 190-257 with name `<prefix>-headers`; the redirect function read from `<docRoot>/../redirect-function.js` when the file exists (lines 261-283), so `web/diya-gl.co.uk/redirect-function.js` once DG-1e's builder writes it, comment `301 redirects for diya-gl.com and www.diya-gl.co.uk`; the access-log delivery (lines 295-348); the distribution with `defaultRootObject("index.html")`, IPv6 and SNI; `BucketDeployment` of the doc root with `prune(false)` (the runners sync into `/runners/` separately), `retainOnDelete(true)`, `distributionPaths(List.of("/*"))`; outputs `DistributionDomainName`, `DistributionId`, `OriginBucketName`. `infra/main/resources/diya-gl-security-headers.json` (new): the spreadsheets file with the PayPal and `api.github.com`/`avatars.githubusercontent.com` entries removed and `frame-src` dropped, so `script-src 'self' 'unsafe-inline' https://www.googletagmanager.com`, `style-src 'self' 'unsafe-inline'`, `img-src 'self' data:` plus the GA hosts, `connect-src 'self'` plus the GA hosts, `https://submit.diyaccounting.co.uk` and `https://prod-auth.diyaccounting.co.uk` (the two hosts in `cloud-config.js`), `form-action 'self'`, `frame-ancestors 'none'`; the other keys unchanged. `SpreadsheetsEnvironment.java`: read `DIYA_GL_CERTIFICATE_ARN` (context `diyaGlCertificateArn`, default blank), `DIYA_GL_DOC_ROOT_PATH` (context `diyaGlDocRootPath`, default `../web/diya-gl.co.uk/public`) and `DIYA_GL_DOMAIN_NAMES` (context `diyaGlDomainNames`, comma list; blank means the per-environment set: ci `ci.diya-gl.co.uk`, `ci.diya-gl.com`; prod `diya-gl.co.uk`, `www.diya-gl.co.uk`, `diya-gl.com`, `www.diya-gl.com`); a `public final DiyaGlSiteStack diyaGlSiteStack` synthesised as `envName + "-spreadsheets-DiyaGlSiteStack"` only when the ARN is non-blank, null otherwise with an `infof`, exactly as `holdingStack` (lines 108-128). `cdk-spreadsheets/cdk.json`: the three context keys beside the holding ones, `diyaGlCertificateArn` blank so `npm run cdk:synth` skips the stack until the doc root exists. `pom.xml`: `org.junit:junit-bom:6.1.3` (`pom`, `import`) in `dependencyManagement`, `junit-jupiter` and `junit-jupiter-api` at `test` scope, `<testSourceDirectory>infra/test/java</testSourceDirectory>` beside `sourceDirectory`, and `infra/test/java/**/*.java` in the spotless includes, all copied from `../root.diyaccounting.co.uk/pom.xml` (lines 18-27, 84-95, 113-116, 301). `DiyaGlSiteStackTest.java` (new): create a temp directory with `public/index.html` and a sibling `redirect-function.js` (`function handler(event) { return event.request; }`), synth the stack for `prod` with the six names and for `ci` with the two; assert `AWS::CloudFront::Distribution` `DistributionConfig.Aliases` equals each list, `AWS::CloudFront::ResponseHeadersPolicy` `SecurityHeadersConfig.ContentSecurityPolicy.ContentSecurityPolicy` contains `https://submit.diyaccounting.co.uk` and does not contain `paypal`, `resourceCountIs("AWS::CloudFront::Function", 1)`, and the bucket's `PublicAccessBlockConfiguration` blocks all four. `.github/workflows/deploy.yml`: `web/diya-gl.co.uk/**` in the push `paths` (lines 21-45); after `Deploy HoldingStack (CDK)` (lines 313-331) a step `Deploy DiyaGlSiteStack (CDK)` with `if: ${{ vars.DIYA_GL_CERTIFICATE_ARN != '' }}`, stack `${env}-spreadsheets-DiyaGlSiteStack`, `--outputs-file ../cdk-spreadsheets.out/cdk-outputs-diya-gl.json`, env `ENVIRONMENT_NAME`, `DIYA_GL_CERTIFICATE_ARN: ${{ vars.DIYA_GL_CERTIFICATE_ARN }}`, `DIYA_GL_DOC_ROOT_PATH: '../web/diya-gl.co.uk/public'`; after `Upload offline runners to S3` (lines 340-345) a step `Upload offline runners to the diya-gl site` with the same `if`, bucket from `jq -r ".\"${STACK_NAME}\".OriginBucketName" cdk-spreadsheets.out/cdk-outputs-diya-gl.json`, `aws s3 sync target/runners/ "s3://${BUCKET_NAME}/runners/" --delete`; `Show stack outputs` prints `cdk-outputs-diya-gl.json` when it exists. The existing runner upload to the spreadsheets bucket stays until DG-1e drops the download page's runner links. Acceptance: `./mvnw clean verify` green with `DiyaGlSiteStackTest` in the surefire report; `npm run cdk:synth` green; `DIYA_GL_CERTIFICATE_ARN=arn:aws:acm:us-east-1:064390746177:certificate/placeholder DIYA_GL_DOC_ROOT_PATH=../web/spreadsheets.diyaccounting.co.uk/holding npm run cdk:synth` lists `ci-spreadsheets-DiyaGlSiteStack`; `npm test` green (the router runs the infra tier for `infra/`, `pom.xml` and `cdk.json`, and `lint:workflows` for the workflow). The deploy step first runs when DG-1b sets the variable, which needs DG-1e's tree.

- **DG-1e**: merge the batch branch first; `serve.js` reads the headers file DG-1d creates and `deploy.yml` is shared with it. `git mv web/spreadsheets.diyaccounting.co.uk/public/diya-gl web/diya-gl.co.uk/public`, then re-home everything that named the old path.

  **The bundle build** (`scripts/build-diya-gl-bundle.mjs`). `DIYA_GL_DIR` (line 39) becomes `web/diya-gl.co.uk/public`; `PUBLIC_DIR` stays the spreadsheets root, because the script still reads `lib/` and the schemas from there. Add a copy step that writes, all gitignored, into the new root: `lib/analytics.js`, `lib/consent-banner.js`, `lib/ecommerce-events.js`, `spreadsheets.css`, `favicon.ico` and `favicon.svg` (the last three are for DG-1l's spec page and DG-5's runner row; the new site's `default-src 'self'` CSP blocks a cross-origin stylesheet or script, so each has to be a local copy). The two published JSON Schemas copy into `web/diya-gl.co.uk/public/schema/`: `bundle-resources.js` resolves `schema/<file>` to `/schema/<file>`, `sw.js` precaches both, and every book load validates against them, so the new host has to serve that root or every page fails on load. `SCHEMA_DIR` keeps pointing at the spreadsheets copy as the source.

  **The precache manifest.** `buildPrecacheManifest()` builds `/diya-gl/${p}` and `urlToPath()` reverses it; both become `/${p}`. The current manifest carries `"/diya-gl/../lib/analytics.js"` because the page tag is `../lib/analytics.js`; once the tags are rewritten to `lib/analytics.js` the entry is `/lib/analytics.js`, and `pageReferences()` needs no change. `PAGES` gains nothing here; DG-1g adds `index.html` to it.

  **The moved tree.** Four pages: `../lib/` to `lib/`, `../favicon.ico` to `favicon.ico`. `sw.js`: `SCOPE_PATH` to `/` (the `/schema/` clause in the fetch handler then never fires and goes with it) and the file-header comment. `manifest.webmanifest`: `start_url`, `scope` and the icon `src` to `/` and `/icon.svg`. `bundle-resources.js`: the `assetRoot` default from `/diya-gl/assets` to `/assets`. `shell.js`: `DONATE_PAGE_LINK` (line 3082) to `https://spreadsheets.diyaccounting.co.uk/donate.html`, and the scope comment at line 27.

  **The runner build** (`scripts/build-runner.mjs`). `DIYA_GL_DIR` (line 53) and `BASE_PATH` (line 65) follow; `BASE_PATH` becomes `/`. `SKIP_SCRIPT_SRC` holds `"../lib/analytics.js"` and `"../lib/consent-banner.js"` and matches by exact string, so it silently stops skipping once the tags change and inlines Google's tag manager into an offline file: change both entries to `lib/analytics.js` and `lib/consent-banner.js`. `rewriteSiteLinks()` points at `https://spreadsheets.diyaccounting.co.uk/diya-gl/${product}.html`; it becomes `https://diya-gl.co.uk/${product}.html`, and its second replacement (`href="../donate.html"`) matches nothing in the page markup today and goes.

  **The donate build** (`scripts/build-donate-page.mjs`). `DIYA_GL_CONFIG_PATH` (line 37) points at the new root.

  **Redirects.** `scripts/build-spreadsheets-redirects.cjs` gains a `--site <name>` argument: it reads `web/<site-dir>/redirects.toml`, writes `web/<site-dir>/redirect-function.js`, and carries a per-site hosts map. The spreadsheets map gains a `diya-gl` target (ci `ci.diya-gl.co.uk`, prod `diya-gl.co.uk`). `web/diya-gl.co.uk/redirects.toml` (new) holds the `.com`-to-`.co.uk` and `www`-to-apex host rules. Spreadsheets' `redirects.toml` retargets `/books/` and adds `/diya-gl/`, both `to = "/"` with `target = "diya-gl"`, so `app/lib/app-resources.js`'s published template source (`https://spreadsheets.diyaccounting.co.uk/diya-gl/assets/`, line 40) keeps resolving for installed npm versions through one 301. `package.json`'s `build:redirects` runs both sites.

  **Sitemaps and robots.** `app/lib/sitemap-builder.js` gains a second exported builder for the diya-gl site; `app/bin/build-sitemaps.js` writes `web/diya-gl.co.uk/public/sitemap.xml` as well. `robots.txt` is a committed static file, not generated, so commit `web/diya-gl.co.uk/public/robots.txt` naming `https://diya-gl.co.uk/sitemap.xml`.

  **`download.html`.** Lines 131-160 (the `download-section` holding the "Work in progress" badge, the four page links and the four runner links) become the paragraph, the "24h sandbox" badge and the single link `https://diya-gl.co.uk/` from Design (a). The four runner links leave this page; DG-5 re-homes them and the `runner_download` event with them.

  **The path constants.** Ten node-side test files hold `web/spreadsheets.diyaccounting.co.uk/public/diya-gl` as a literal and go red the moment the move lands, so they move in this commit: `app/test/diya-gl-se-disallowable-memo.test.js`, `diya-gl-product-manifest.test.js`, `bst-form-layouts.test.js`, `ltd-diya-gl-new-book.test.js`, `diya-gl-page-upload.test.js`, `taxi-diya-gl-manifest.test.js`, `taxi-takings-view.test.js`, `taxi-form-layouts.test.js`, `web/unit-tests/diya-gl-cloud-pkce.test.js`, `web/unit-tests/diya-gl-events.test.js`. Ignore lists follow too: `.gitignore` (the five `public/diya-gl/` lines plus `donate-config.js`, and new entries for the new root's `engine/`, `assets/`, `examples.js`, `build-stamp.js`, `donate-config.js`, `lib/`, `schema/`, `spreadsheets.css`, `favicon.*`, `sitemap.xml` and `redirect-function.js`), `.prettierignore` (the `engine/` and `assets/` lines) and `eslint.security.config.js` (line 57).

  **The router.** `scripts/test-scope.mjs`'s existing `browser asset` row matches `^web/[^/]+/public/.*\.(js|css)$` and captures a page directory from `/public/<dir>/`; under the new root the scripts sit directly in `public/`, so that capture fails and a `shell.js` change selects one spec by filename. Add a row above it: paths matching `^web/diya-gl\.co\.uk/public/` add `browser: "diya-gl"`, narrowing to `browser: "product"` for `public/products/(bst|se|ltd|taxi)`. `web/diya-gl.co.uk/redirects.toml` already matches the `page content` row; its `build:redirects` extra now covers both sites. Add the new row's cases to `app/test/test-scope-routing.test.js`.

  **The test server.** `web/browser-tests/serve.js` hardwires `infra/main/resources/security-headers.json`. Give `startStaticServer(rootDir, headersPath)` a second argument defaulting to that file. Each spec already starts its own ephemeral-port server and passes its own root, so no second port is configured anywhere; DG-1f points the new root's specs at DG-1d's `diya-gl-security-headers.json`.

  **Workflows.** `deploy.yml`'s push `paths:` filter gains `web/diya-gl.co.uk/**`. `deploy.yml` and `test.yml` run the redirect build for both sites. `test.yml`'s `behaviour test (local)` job starts a second `http-server` on `web/diya-gl.co.uk/public` at port 3001 beside the existing one; `package.json`'s `start`/`prestart` gain the same (DG-1f owns `package.json`, so leave a `DIYA_GL_BASE_URL=http://localhost:3001` line in the workflow step and let DG-1f wire the scripts).

  **`CLAUDE.md`.** The "Web Content" section names both document roots; "Build Commands" names the two-site redirect build.

  Acceptance: `npm test` green. The move escalates the router (the changed set reaches `package.json` only through DG-1f, but `scripts/test-scope.mjs` itself changes, forcing the representative calc set), so expect gates, unit, calc-representative, browser and infra to run. The browser and behaviour specs DG-1f owns stay red and are listed by path in the commit message as the diff's known remainder.

- **DG-1f**: point every spec at the new root. Merge the batch branch into the worktree first, because every file here depends on DG-1e's move and DG-1d's headers file.

  **The 39 server-backed specs.** Each holds `const publicDir = path.join(process.cwd(), "web/spreadsheets.diyaccounting.co.uk/public")` (or `PUBLIC_DIR`, or a `ROOT`-relative form) and addresses pages as `${baseUrl}/diya-gl/<page>.html`. The constant becomes `web/diya-gl.co.uk/public` and the URLs lose the `/diya-gl/` segment. Each spec's `startStaticServer(publicDir)` call gains DG-1d's headers file as its second argument: `startStaticServer(publicDir, path.join(process.cwd(), "infra/main/resources/diya-gl-security-headers.json"))`. `diya-gl-runner.browser.test.js` opens the runner over `file://` and changes nothing. Three specs need more than a path swap: `diya-gl-pwa.browser.test.js` asserts `start_url` and `scope` are `/diya-gl/` (lines 45-46) and requests `/diya-gl/manifest.webmanifest`; `diya-gl-bundle-gate.browser.test.js` names `diya-gl/engine/diya-gl-engine.js` and `diya-gl/probe.js` in seven places; `diya-gl-headlines.browser.test.js` runs its own inline server over the same `publicDir`.

  **`r-sources.js`** carries six `page: "diya-gl/<product>.html"` entries (lines 86-133).

  **`spreadsheets-content.browser.test.js`** builds `booksDir` as `path.join(publicDir, "diya-gl")` (line 12); it becomes the new root, with `publicDir` left as the spreadsheets root for the pages it still reads.

  **`site-ecommerce-events.browser.test.js`**: the `runner_download` case (line 114) clicks `#runner-bst-link` on `download.html`, which DG-1e removed. Delete that case; DG-5 adds the equivalent on the new homepage. The `download.html` view_item and begin_checkout cases stay.

  **`diya-gl-bst.browser.test.js`**: the "Spreadsheets download.html — DIYA-GL entry panel" describe (line 571 on) asserts the old panel's heading, its "Nothing is uploaded" text and `#diya-gl-bst-link`'s `href="diya-gl/bst.html"`. Rewrite it against DG-1e's replacement section: the "24h sandbox" badge and one link to `https://diya-gl.co.uk/`.

  **`seo-validation.test.js`** runs three describes over a single `site` object (lines 9-12). Parameterise over two: the spreadsheets root and `{ dir: "web/diya-gl.co.uk/public", domain: "https://diya-gl.co.uk" }`.

  **`behaviour-tests/spreadsheets.behaviour.test.js`** gains `const diyaGlBaseUrl = (process.env.DIYA_GL_BASE_URL || "https://ci.diya-gl.co.uk").replace(/\/+$/, "")` beside the existing `spreadsheetsBaseUrl` (line 19). Five cases use it, not four: the four page loads at lines 963, 1023, 1095 and 1165 (their `booksUrl` lines are 977, 1037, 1109 and 1179) and the cloud sign-in case at line 1409, whose `booksUrl` is at line 1483. The sign-in case's host guard (`isCiHost`, line 1425) currently tests `spreadsheetsHostname === "ci-spreadsheets.diyaccounting.co.uk"`; it becomes the diya-gl ci host read off `diyaGlBaseUrl`, and the skip message at line 1427 names `DIYA_GL_BASE_URL`.

  **`package.json`**: the three `test:spreadsheetsBehaviour-{local,ci,prod}` scripts each gain `DIYA_GL_BASE_URL` (local `http://localhost:3001`, ci `https://ci.diya-gl.co.uk`, prod `https://diya-gl.co.uk`). `prestart` and `start` gain a second `http-server` over `web/diya-gl.co.uk/public -p 3001`.

  Acceptance: `npm test -- --all` green, including the full browser suite and the local behaviour run against both servers.

- **DG-1g**: `web/diya-gl.co.uk/public/index.html` is `ltd.html`'s markup with three data attributes on `<body>` (`data-default-example="ltd-brickwork-pro-vat"`, `data-default-view="year"`, `data-default-month="2025-04"`) and a home strip above `.app-topbar`: the four product links, the tier strip (the three lines from Design (e)'s table, the resident line rendered only when the account list reports `residentTier`, hidden otherwise) and the runner row (plain links to `runners/diya-gl-<product>.html` until DG-5 gives them sizes and stamps). Style it in `diya-gl.css` with the existing tokens (`--rule` `#158484`, `--paper` `#f7fafa`, `--paper-raised`, `--font-ui`); add no new ones.

  **`shell.js`.** `parseDeepLinkParams()` (line 224) falls back to `document.body.dataset.defaultExample`, `defaultView` and `defaultMonth` when the URL names no `example`. Three consequences follow from the code as it stands and each needs handling:

  1. `init()` (lines 120-125) branches `if (deepLink.example) bootFromDeepLink(...) else checkForSavedBook()`. With the fallback in place the homepage always takes the first branch and never checks for a saved book, so the continue offer disappears. Call `checkForSavedBook()` in both branches.
  2. `renderContinueOffer()` is emitted only from `renderEmptyState()`, which `render()` reaches only when `!state.loaded` (lines 556-562). The banner over a loaded example is a new render path in the loaded branch, guarded on `state.savedBook` being set and the loaded book having come from the default example.
  3. `syncDeepLinkUrl()` runs on every render (line 577) and would rewrite the homepage's address bar to `/?example=ltd-brickwork-pro-vat&view=year&month=2025-04`. Record that the example came from the data attributes rather than the URL, and skip the sync in that case, so `https://diya-gl.co.uk/` stays clean until the reader changes a view.

  `bootFromDeepLink` and `applyDeepLinkViewAndMonth` need no change: `loadExample(..., { skipAutosave: true })` already leaves the reader's own IndexedDB record alone, and `applyLoadedSnapshot` already lands on `view=year` with `snapshot.months[0].key` open, which for this fixture (`periodCoveredStart = 2025-04-01`) is `2025-04`.

  **The four pages** drop `<meta name="robots" content="noindex" />` (line 13 in each). `app/lib/sitemap-builder.js`'s diya-gl builder (added by DG-1e) lists the five pages. `scripts/build-diya-gl-bundle.mjs`'s `PAGES` constant gains `index.html`, so the homepage and its tags enter the precache manifest and the build stamp.

  **`playwright.config.js`**'s `browser-tests` project lists every spec by name; add `"**/diya-gl-home.browser.test.js"` or the new spec never runs.

  Acceptance: `npm test`, with the new `web/browser-tests/diya-gl-home.browser.test.js` asserting, on `${baseUrl}/index.html` with no query string: `#app-title` contains "BrickWork Pro Ltd"; the year view is the active view; `2025-04` is the open month and its entries are showing; the `.year-totals` cell keyed `MnthP&L!B9` parses to a number above zero; and the address bar carries no query string after load. The existing `diya-gl-ltd-deep-links.browser.test.js` cases still pass, proving the URL path still wins over the attributes.

- **DG-1h**: in `../submit.diyaccounting.co.uk`. `IdentityStack.buildBooksUrls(envName)` (line 493) builds one URL per host per prefix from `DIYA_GL_PATH_PREFIXES` (`/books/`, `/diya-gl/`) and `BOOKS_PAGE_NAMES`. Add the new hosts with a single path prefix of `/`, so each contributes `/`, `/index.html` and the four pages: on `prod`, `https://diya-gl.co.uk` and `https://ci.diya-gl.co.uk`; on every other environment, `https://ci.diya-gl.co.uk`. Keep every existing spreadsheets-host entry (DG-1k removes them after the cut-over). The new hosts take no `/books/` or `/diya-gl/` prefix, so the loop needs a per-host prefix list rather than one shared constant. `SubmitApplication.booksAllowedOrigins` (line 173) adds `https://diya-gl.co.uk` and `https://ci.diya-gl.co.uk` on prod and `https://ci.diya-gl.co.uk` elsewhere, keeping the current entries; that value feeds `DIYA_GL_ALLOWED_ORIGINS` on the four DIYA-GL Lambdas and, through `billingReturnUrlOrigins` (line 179), `BILLING_RETURN_URL_ORIGINS` on the checkout and portal routes, so the new hosts also become valid `returnTo` origins, which DG-3b needs. Tests: `IdentityStackTest.ciBooksClientCallbackAndLogoutUrlsCoverTheCiHostAndLocalhost` (line 113) and `prodBooksClientCallbackAndLogoutUrlsCoverTheProdAndCiSpreadsheetsHosts` (line 152) both use `Match.arrayEquals`, so both expected lists take the new URLs in the order `buildBooksUrls` emits them. Acceptance: from `../submit.diyaccounting.co.uk`, `./mvnw clean verify` green, and `npm test` green; one Submit PR, branch `claude/dg-1h-callbacks`, merged through `/auto-merge` and deployed by Submit's `deploy.yml`.

- **DG-1i**: merge the batch branch first; DG-1e and DG-1f both touch files here.

  `deploy.yml`'s "Run spreadsheets behaviour tests" step (line 455) calls `npm run test:spreadsheetsBehaviour-${{ environment-name }}`, and DG-1f put `DIYA_GL_BASE_URL` inside those npm scripts, so the step needs only an explicit `DIYA_GL_BASE_URL: ${{ needs.params.outputs.environment-name == 'prod' && 'https://diya-gl.co.uk' || 'https://ci.diya-gl.co.uk' }}` in its `env:` block beside the three `TEST_AUTH_*` values, so the workflow states the host it is proving rather than inheriting it. Nothing else in that job changes: the test user is already minted in the prod pool (`node ensure-cognito-test-user.js "prod" spreadsheetsBehaviour`, line 425) through `SUBMIT_TEST_USER_ROLE_ARN`, and the native-auth toggle already names `--client diya-gl` on prod (lines 453 and 481).

  `web/diya-gl.co.uk/public/cloud-config.js`'s header comment names the two hosts it serves (`diya-gl.co.uk` and `ci.diya-gl.co.uk`) and that both talk to Submit's released environment, which is what the committed `apiBase`, `hostedUi` and `clientId` already point at.

  `CLAUDE.md`'s repository-variables table gains `DIYA_GL_CERTIFICATE_ARN`, and the `SUBMIT_TEST_USER_ROLE_ARN` row names the diya-gl ci host as the one the sign-in case runs against. The Testing section names `DIYA_GL_BASE_URL` beside `SPREADSHEETS_BASE_URL`.

  Acceptance: the ci deploy's behaviour job green with the "Cloud sign-in: save, list, open, delete and sign out of the DIYA-GL account" case running rather than skipped, on `https://ci.diya-gl.co.uk` against `https://submit.diyaccounting.co.uk/api/v1`. The case skips loudly and names what is missing, so a skipped run in the job log is a failure of this row.

- **DG-1l**: merge the batch branch first. `git mv web/spreadsheets.diyaccounting.co.uk/public/diya-gl.html web/diya-gl.co.uk/public/spec.html`.

  **The builder** (`app/bin/build-diya-gl-spec.js`). `OUT_PATH` (line 37) writes into the new root as `spec.html`; `CANONICAL_URL` (line 39) becomes `https://diya-gl.co.uk/spec.html`. `PUBLIC_DIR` (line 32) stays the spreadsheets root, because the builder still reads the schemas and `reconciliation/*.json` from there. Every relative link in the emitted markup resolves against the old root and has to be re-pointed; the new site's `default-src 'self'` CSP forbids a cross-origin stylesheet or script, so assets are local copies and page links are absolute:

  | Lines | Today | Becomes |
  | --- | --- | --- |
  | 618-619, 626, 636-637 | `favicon.svg`, `favicon.ico`, `spreadsheets.css`, `lib/analytics.js`, `lib/consent-banner.js` | the same relative names, served from the copies DG-1e's bundle build puts in the new root |
  | 421-423 | `schema/diya-gl-*.json`, `schema/diya-gl-docs.md` | the same relative names, served from the new root's `schema/` copy |
  | 561-564 | `diya-gl/bst.html` and the three siblings | `bst.html`, `se.html`, `taxi.html`, `ltd.html` (same site now) |
  | 453, 459, 543, 554, 575, 578-579, 640-648, 657, 675-676 | `reconciliation/…`, `index.html`, `download.html`, `knowledge-base.html`, `community.html`, `donate.html` | absolute `https://spreadsheets.diyaccounting.co.uk/…` |

  **The links in.** `diya-gl/README.md` line 66 and `diya-gl/package.json` line 7 (`homepage`) both name `https://spreadsheets.diyaccounting.co.uk/diya-gl.html`. `app/bin/build-reconciliation-pages.js` line 973 emits `<a href="../diya-gl.html#versioning">`, which becomes the absolute `https://diya-gl.co.uk/spec.html#versioning`; run `npm run build:reconciliation-pages` in the same commit so the committed `reconciliation/releases.html` (line 61) carries the new link rather than waiting for the next generate run. `web/spreadsheets.diyaccounting.co.uk/public/index.html` line 300 points at the new host.

  **Sitemaps.** `app/lib/sitemap-builder.js` line 18 drops the spec page from the spreadsheets sitemap; DG-1e's diya-gl builder lists `https://diya-gl.co.uk/spec.html`. `app/test/sitemap-builder.test.js` line 30 follows.

  **Tests and ignore lists.** `app/test/diya-gl-spec-page.test.js` reads the published page at `PUBLIC_DIR/diya-gl.html` (lines 15-17) and compares it byte for byte with `buildDiyaGlSpecHtml()`; point it at the new path. `app/test/licence-headers.test.js`'s `EXCLUDED_FILES` (line 52) and `.prettierignore` both name the generated page. `LICENSING.md` line 56 names it in the licence-layer table.

  **The redirect.** Spreadsheets' `redirects.toml` gains `[[redirect]]` with `from = "/diya-gl.html"`, `to = "/spec.html"`, `target = "diya-gl"`. That target only exists once DG-1e's hosts map carries it.

  **The generate workflows.** All four of `generate-bst.yml` (line 441), `generate-taxi.yml` (398), `generate-se.yml` (464) and `generate-ltd.yml` (497) `git add … web/spreadsheets.diyaccounting.co.uk/public/diya-gl.html`. Left alone, a generate run rebuilds the spec page at its new path and never commits it. Each line takes the new path.

  Acceptance: `npm test` green, with `diya-gl-spec-page.test.js` reading `web/diya-gl.co.uk/public/spec.html` and still matching the builder byte for byte, and `seo-validation.test.js` (DG-1f's two-site version) finding the spec URL in the diya-gl sitemap and not in the spreadsheets one.

- **DG-1b**: the cut-over runbook, run by the session from a chat once DG-1a and DG-1c are merged; steps 6 to 8 wait for DG-1d and DG-1e on `main`. Each read and each wait is the session's; each write below is shown verbatim and waits for the operator's go before it runs. 1. (ask) `gh workflow run deploy.yml --repo diy-accounting-uk/root.diyaccounting.co.uk --ref main` and wait for it; the run's `Show stack outputs` prints `DiyaGlCoUkNameServers` and `DiyaGlComNameServers`. 2. (read) `aws --profile management route53domains get-domain-detail --region us-east-1 --domain-name diya-gl.co.uk --query Nameservers` to see the registration's current set (Route 53 Domains answers in us-east-1 only). 3. (ask) `aws --profile management route53domains update-domain-nameservers --region us-east-1 --domain-name diya-gl.co.uk --nameservers Name=<ns1> Name=<ns2> Name=<ns3> Name=<ns4>` with the four names from `DiyaGlCoUkNameServers`, then the same for `diya-gl.com` with `DiyaGlComNameServers`; `dig NS diya-gl.co.uk +short` shows the new set within minutes. 4. (ask) `gh workflow run request-diya-gl-cert.yml --repo diy-accounting-uk/spreadsheets.diyaccounting.co.uk --ref main`; it validates through the new zones, so step 3 comes first; the last step prints the ARN. 5. (ask) `gh variable set DIYA_GL_CERTIFICATE_ARN --repo diy-accounting-uk/spreadsheets.diyaccounting.co.uk --body "<arn>"`. 6. (ask) `gh workflow run deploy.yml --repo diy-accounting-uk/spreadsheets.diyaccounting.co.uk --ref main -f environment-name=ci` and, when green, the same with `-f environment-name=prod`; each creates its `DiyaGlSiteStack`. 7. (ask) `gh workflow run deploy.yml --repo diy-accounting-uk/root.diyaccounting.co.uk --ref main` again; this time the lookups find both `DiyaGlSiteStack`s and the twelve alias records are written; `curl -sI https://ci.diya-gl.co.uk/` returns 200 once the records resolve. 8. (read) Acceptance: `dig +short A diya-gl.co.uk` and `dig +short A ci.diya-gl.co.uk` answer; `curl -sI https://diya-gl.co.uk/` and `https://ci.diya-gl.co.uk/` return 200 with `content-security-policy` present; `aws --profile spreadsheets acm describe-certificate --region us-east-1 --certificate-arn <arn> --query Certificate.Status` is `ISSUED`. The management-profile steps need the SSO session (`aws sso login --sso-session diyaccounting`).

- **DG-1m**: the operator, in GA4 admin for property `G-X4ZPD99X2K`: add `diya-gl.co.uk` to the web data stream's cross-domain list and to the referral exclusions. No precursor; it can be done before the host resolves. Acceptance: the two lists show the domain.

- **DG-1j**: the cut-over probes, as behaviour cases in `behaviour-tests/spreadsheets.behaviour.test.js` run against prod (`npm run test:spreadsheetsBehaviour-prod`) after the prod deploys of the spreadsheets `main` and the second root deploy. 1. `https://diya-gl.co.uk/` opens the Ltd example, year view, April 2025, with figures (the DG-1g homepage case, on prod). 2. `https://diya-gl.com/`, `https://www.diya-gl.co.uk/ltd.html`, `https://www.diya-gl.com/bst.html` and `https://ci.diya-gl.com/` each answer 301 with `location` `https://diya-gl.co.uk/`, `https://diya-gl.co.uk/ltd.html`, `https://diya-gl.co.uk/bst.html`, `https://ci.diya-gl.co.uk/`. 3. `https://spreadsheets.diyaccounting.co.uk/diya-gl/bst.html`, `.../books/bst.html` and `.../diya-gl.html` each 301 to the new host (`/bst.html`, `/bst.html`, `/spec.html`). 4. `https://diya-gl.co.uk/runners/diya-gl-bst.html`, `/sitemap.xml` and `/robots.txt` return 200. 5. The cloud sign-in case runs on `https://diya-gl.co.uk/ltd.html` as it does on ci (every host talks to Submit prod, and `SUBMIT_TEST_USER_ROLE_ARN` mints the user). 6. `https://spreadsheets.diyaccounting.co.uk/download.html` shows the one DIYA-GL paragraph and its link. 7. The page's `dataLayer` holds a `config` for `G-X4ZPD99X2K` and a `page_view` whose `page_location` host is `diya-gl.co.uk`, asserted the way `site-ecommerce-events.browser.test.js` reads `window.dataLayer`. Cases 2 to 4, 6 and 7 are unconditional; 1 and 5 are the existing cases on the new base URL. A failed case reopens the row that owns it (2 and 3: DG-1e; 4: DG-1d or DG-1l; 5: DG-1h/DG-1i; 1: DG-1g). Acceptance: the prod run green; DG-1k starts.

- **DG-1k**: in `../submit.diyaccounting.co.uk`, on a branch `claude/diya-gl-drop-spreadsheets-hosts` from `main`, one PR. `IdentityStack.java` `buildBooksUrls` (line 493 today; DG-1h reshapes it first): remove every entry whose host is `https://spreadsheets.diyaccounting.co.uk` or `https://ci-spreadsheets.diyaccounting.co.uk`, and with them the `/books/` and `/diya-gl/` prefixes (`DIYA_GL_PATH_PREFIXES`, line 491) and the comment block at lines 484-488, since the new hosts serve the pages at `/`; the `http://localhost:3000` entries stay on the port and paths DG-1h set for the new root. `SubmitApplication.java` lines 173-175: `booksAllowedOrigins` loses the two spreadsheets origins on both branches; `billingReturnUrlOrigins` (line 179) follows without an edit. `IdentityStackTest.java`: the two callback tests (lines 112-148 and 150-186) list only the diya-gl and localhost URLs. Acceptance: in Submit, `./mvnw clean verify` green and `npm test` green; the PR's deploy to ci, then the merge's deploy to prod; after it, sign-in on `https://diya-gl.co.uk/ltd.html` still round-trips and `aws --profile submit-prod cognito-idp describe-user-pool-client --user-pool-id <id> --client-id <id> --query UserPoolClient.CallbackURLs` lists no `spreadsheets.diyaccounting.co.uk` entry.

- **DG-2a**: in `../submit.diyaccounting.co.uk`. Opus designs the contract over `diyaGlPut.js`, `diyaGlListGet.js`, `diyaGlVersionGet.js`, `s3DiyaGlRepository.js` and `diyaGlEntitlement.js`; Sonnet builds it with the tests below.

  `diyaGlEntitlement.entitlementFor(sub)` today returns `{allowed, reason, bundleId, expiry, checkedAt}` and short-circuits to `reason: "not-enforced"` unless `DIYA_GL_ENTITLEMENT_ENFORCED === "true"`. Replace that switch with `DIYA_GL_RESIDENT_TIER`: when it is not `"true"` the function returns `{retention: "sandbox", reason: "tier-disabled", residentTier: false, bundleId: null, expiry: null, checkedAt}` without reading the bundles table. When it is `"true"` it reads the `resident-diya-gl` bundle as now and returns `residentTier: true` with `retention: "resident"` and `reason: "active-subscription"` for an active, unexpired bundle, or `retention: "sandbox"` with `reason: "no-subscription"` or `"expired"`. The `allowed` field goes; nothing keeps it.

  `diyaGlPut.js`: drop the `403 subscription-required` gate (lines 249-257) and the `http403ForbiddenResponse` import stays only for `book-limit-reached`. Every save writes the sidecar fields `retention` and `expiresAt` (`retention: "sandbox"` gives `expiresAt = updatedAt + 24h`; `"resident"` gives `null`), keeping `entitlementAtPut`. `putVersion` and `writeMetadata` in `s3DiyaGlRepository.js` take a `retention` argument and pass `Tagging: "retention=" + retention` on `PutObject`. When a book's retention changes at a save, re-tag its kept version objects and the sidecar with `PutObjectTagging` (at most `DIYA_GL_VERSIONS_KEPT`, 30), which needs a new `tagObject(key, retention)` export in the repository and `s3:PutObjectTagging` on the put Lambda.

  `diyaGlListGet.js`: call `entitlementFor(user.sub)` once and return it at the top level as `entitlement: {reason, expiry, residentTier}` beside `books`; each book carries its sidecar `retention` and `expiresAt`; a sandbox book whose `expiresAt` has passed is left out. When the entitlement reads `expired` and the book is resident, the route reports `expiresAt = Date.parse(bundle.expiry) + 30 days`. The list Lambda does not read DynamoDB today, so `DiyaGlStack` gives it `BUNDLE_DYNAMODB_TABLE_NAME`, `DIYA_GL_BUNDLE_ID`, `DIYA_GL_RESIDENT_TIER` and `bundlesTable.grant(this.diyaGlListGetLambda, "dynamodb:Query")`.

  `diyaGlVersionGet.js`: a version of a sandbox book past the sidecar's `expiresAt` answers `404 book-expired`. For a book whose sidecar says `retention: "resident"`, the route calls `entitlementFor` and applies the same lapse rule, so it needs the same three environment variables and the same `dynamodb:Query` grant.

  `DiyaGlStack.java`: `DiyaGlStackProps` gains `Boolean residentTierEnabled()`; `SubmitApplication` sets it to `!"prod".equals(envName)` at the `new DiyaGlStack(...)` call (line 474). The put Lambda's env (line 205 on) loses `DIYA_GL_ENTITLEMENT_ENFORCED` and gains `DIYA_GL_RESIDENT_TIER`, and the put Lambda gains a policy statement for `s3:PutObjectTagging` on `booksObjectsArnPattern`.

  `DataStack.java`: the diya-gl bucket (line 910) gains a third `LifecycleRule`, id `expire-sandbox`, with `tagFilters(Map.of("retention", "sandbox"))`, `expiration(Duration.days(2))` and `noncurrentVersionExpiration(Duration.days(1))`. The two existing rules stay.

  Tests: `diyaGlPut.test.js` (a sandbox save's `retention`, `expiresAt` and `Tagging`; a resident save's `expiresAt: null`; the re-tag when retention changes; the `403 subscription-required` case at line 287 goes); `diyaGlListGet.test.js` (the top-level `entitlement`, an expired sandbox book left out, the lapse expiry for a resident book); `diyaGlVersionGet.test.js` (`404 book-expired`); `diyaGlEntitlement.test.js` (the three reasons under the new flag); `diyaGlCorsHeaders.test.js` and `diyaGlStorage.system.test.js` (both clear `DIYA_GL_ENTITLEMENT_ENFORCED` in setup; switch to `DIYA_GL_RESIDENT_TIER`, and the system test asserts `expiresAt` on a sandbox put); `behaviour-tests/diyaGlSubscription.behaviour.test.js` loses its `entitlementEnforced` branch (lines 58, 124-134) with the 403; `DataStackTest.java` (the tag-keyed rule); `DiyaGlStackTest.thePutFunctionGetsQuotaAndEntitlementEnvironmentVariables` (line 93) swaps the variable, plus a case for the tagging permission and one for the list and version Lambdas' bundle access.

  Acceptance: from `../submit.diyaccounting.co.uk`, `npm test` green (it runs the unit and system tiers, `app/system-tests/diyaGlStorage.system.test.js` included) and `./mvnw clean verify` green; one Submit PR through `/auto-merge` and its `deploy.yml`.

- **DG-2b**: `cloud.js` and `diya-gl.css` live at `web/diya-gl.co.uk/public/` once DG-1e has moved them, and at `web/spreadsheets.diyaccounting.co.uk/public/diya-gl/` until then; take whichever the tree holds. In `cloud.js`: `syncAccountButton` (lines 494-496) sets the button title and aria-label to "Sign in to save to a 24h sandbox: your books are kept for 24 hours after each save, on any device.", and `renderSignedOut` (line 658) opens with the same sentence. `renderBookRow` (line 536) adds a line to `.account-row-meta` from the book's `expiresAt`: "expires in Nh Mm", "expires in Mm" under an hour, and "kept until you delete it" when `retention` is `"resident"`. `currentEntitlementReason` and `sawUnentitled403` (lines 626-637) go; `renderEntitlement` takes the list's top-level `entitlement` object, which `fetchAllBooks` (line 812) now returns alongside `books`, and `fetchBooksList` (line 821) carries into `panelState`. `tier-disabled` renders "24h sandbox"; `active-subscription` renders "Subscribed: kept until you delete it" with the existing Manage subscription button. `no-subscription` and `expired` render "24h sandbox" until DG-3b adds the offer. The `403 subscription-required` branch in the save path (lines 1049-1055) and its toast go, and so does the `sawUnentitled403 = false` reset at line 1064. `diya-gl.css` gets a rule for the expiry line beside `.account-row-meta` (line 2038) and `.account-entitlement` (line 2057).

  Tests: in `web/browser-tests/diya-gl-cloud.browser.test.js` the stubbed list responses (`unsubscribedBook()` at line 633, `subscribedBook()` at line 638) carry `retention`, `expiresAt` and a top-level `entitlement`; the "a 403 subscription-required offers the subscription and loses no book" case (line 557) goes; new rows cover the expiry text on a sandbox book, "kept until you delete it" on a resident one, and the `tier-disabled` card. In `behaviour-tests/spreadsheets.behaviour.test.js`, the "Cloud sign-in: save, list, open, delete and sign out of the DIYA-GL account" case (line 1409) asserts the saved book's `expiresAt` is within a minute of `updatedAt + 24h` and that the list's `entitlement.reason` is `tier-disabled`, which is what Submit prod answers with the tier off. That assertion reads Submit prod, so DG-2b merges after DG-2a is merged and deployed to Submit prod. `behaviour-tests/spreadsheets.behaviour.test.js` is also DG-1f's file, so the two rows serialise on it.

  Acceptance: `npm test` green in this repo, and `npm run test:spreadsheetsBehaviour-ci` green (it targets `https://ci-spreadsheets.diyaccounting.co.uk`, or the new host once DG-1i lands).

- **DG-3a**: in `../submit.diyaccounting.co.uk`. `productCatalog.js` gains `isBundleListedInEnvironment(bundle, environmentName)` beside `isActivityListedInEnvironment` (line 38), with the same semantics over the bundle's `listedInEnvironments` array: absent or empty means every environment, otherwise the name must be in the list. `billingCheckoutPost.js` loads the catalogue with `loadCatalogFromRoot()`, reads the bundle with `getCatalogBundleById(catalog, bundleId)` after `bundleId` is resolved (line 87), and answers `400` with `{code: "bundle-not-listed"}` when the bundle is missing from the catalogue or not listed for `process.env.ENVIRONMENT_NAME`, before any Stripe call. The checkout Lambda already carries `ENVIRONMENT_NAME` (`BillingStack.java` line 193) and the image already carries `web/public/submit.catalogue.toml` (Dockerfile line 37), so no infrastructure changes. Today the environment list is enforced only by `bundles.html`'s client-side filter (lines 619-624), and `.env.prod` carries a live price id for both `resident-diya-gl` (line 125) and `resident-ltd` (line 123), so a crafted POST on prod buys a bundle prod grants nothing for.

  Tests: `billingCheckoutPost.test.js` sets `process.env.ENVIRONMENT_NAME` per case and covers `resident-diya-gl` and `resident-ltd` refused on `prod` with `400 bundle-not-listed` and no `checkout.sessions.create` call, both accepted on `ci`, and `resident-pro` (no `listedInEnvironments`) accepted on `prod`. `productCatalog.test.js` covers the new helper's three cases beside the activity ones (line 175).

  Acceptance: from `../submit.diyaccounting.co.uk`, `npm test` green; one Submit PR through `/auto-merge` and its `deploy.yml`.

- **DG-3b**: two commits in two repos, this one first. In `cloud.js`, `renderEntitlement` renders from the list's top-level `entitlement` and only when `entitlement.residentTier` is true: `no-subscription` gives "24h sandbox. Keep your books for 99p a month." with the existing Subscribe button, which calls `startSubscription` (line 1132, posting `bundleId: "resident-diya-gl"` and `returnTo: redirectUri()`); `expired` gives "Your subscription ended <date>. These books expire <date>." from `entitlement.expiry` and that date plus 30 days, with the same Subscribe button; `active-subscription` keeps DG-2b's subscribed card with Manage subscription. With `residentTier` false the card stays DG-2b's plain "24h sandbox" and no Subscribe button renders anywhere, which is what every host sees while Submit prod has the tier off. `processPendingCheckoutReturn` (line 1306) already re-reads the list through `fetchBooksList`, so the subscribed card follows from the next list call.

  Tests here: `diya-gl-cloud.browser.test.js` covers the offer, the lapsed card with both dates, the subscribed card, and the flag off rendering no Subscribe button; the existing subscribe and portal cases (lines 643, 723) keep working against the new stub shape.

  In `../submit.diyaccounting.co.uk`, `behaviour-tests/diyaGlSubscription.behaviour.test.js` gains two assertions around its existing flow: the first put before checkout answers `retention: "sandbox"` with a non-null `expiresAt`, and the put after the Stripe test card returns answers `retention: "resident"` with `expiresAt: null`. That test runs on ci only (`deploy.yml` job `web-test-diya-gl-subscription`, gated on `environment-name == 'ci'`), which is where the tier is on.

  Acceptance: `npm test` green here; from `../submit.diyaccounting.co.uk`, `npm run test:diyaGlSubscriptionBehaviour-ci` green; one Submit PR for its half, through `/auto-merge` and its `deploy.yml`.

- **DG-3c**: in `../submit.diyaccounting.co.uk`. `dynamoDbBundleRepository.js` gains `listLapsedBundleOwners(bundleId, beforeIso)`, modelled on `countActiveAllocations` (line 378): a paged `QueryCommand` on `bundleId-expiry-index` with `KeyConditionExpression: "bundleId = :bundleId AND expiry < :before"`, returning each row's `hashedSub`. The index is `KEYS_ONLY` over `bundleId` and `expiry` with the table's `hashedSub` and `bundleId` keys, so the query returns the owner prefix directly; `hashedSub` is what `s3DiyaGlRepository.resolveOwnerPrefix` produces for a live caller, so it is the S3 prefix without further work.

  `app/functions/diyaGl/diyaGlLapseSweep.js` (new) exports `handler`: it computes `beforeIso = now - DIYA_GL_LAPSE_GRACE_DAYS days` (default 30), calls `listLapsedBundleOwners(process.env.DIYA_GL_BUNDLE_ID || "resident-diya-gl", beforeIso)`, and for each owner calls `listBooks(ownerPrefix)` and `deleteBook(ownerPrefix, bookId)` from `s3DiyaGlRepository.js` for every book whose sidecar says `retention: "resident"`, logging a count. A sandbox book is left to the lifecycle rule. Model the Lambda's shape on `app/functions/security/scanRate404Detect.js`, which exports a plain `handler(event)` with no API wrapper.

  `DiyaGlStack.java`: when `props.residentTierEnabled()` is true, build the sweeper with the non-API `Lambda` construct (`constructs/Lambda.java`, `LambdaProps`), function name `props.resourceNamePrefix() + "-diya-gl-lapse-sweep"` and handler `app/functions/diyaGl/diyaGlLapseSweep.handler`, with `DIYA_GL_BUCKET_NAME`, `BUNDLE_DYNAMODB_TABLE_NAME`, `DIYA_GL_BUNDLE_ID`, `DIYA_GL_LAPSE_GRACE_DAYS=30` and `ENVIRONMENT_NAME`; grant it `s3:ListBucket` on the bucket, `s3:GetObject` and `s3:DeleteObject` on `booksObjectsArnPattern`, and `bundlesTable.grant(sweeper, "dynamodb:Query")`; schedule it with an `events.Rule` at `Schedule.rate(Duration.days(1))` targeting `LambdaFunction`, as `ScanDetectionStack` does at line 224. `DiyaGlStack` is deployment-scoped (`{deployment}-app-DiyaGlStack`), so each ci deployment runs its own sweeper over the shared environment bucket; the deletes are idempotent, so the overlap changes nothing.

  Tests: `app/unit-tests/functions/diyaGlLapseSweep.test.js` (new) mocks `@aws-sdk/client-dynamodb` and `@aws-sdk/client-s3` and covers a lapsed owner's resident books deleted, a sandbox book left alone, an owner inside the grace untouched, and a paged query. `DiyaGlStackTest.java` covers the schedule, the function's environment, the `dynamodb:Query` grant, and that the sweeper is absent when `residentTierEnabled` is false; the existing `stackWiresFourLambdas` (line 52) and `onlyThePutFunctionGetsWriteAccessToTheBucket` (line 115) both count or scan every function in the template, so both follow the fifth Lambda.

  Acceptance: from `../submit.diyaccounting.co.uk`, `npm test` and `./mvnw clean verify` green; one Submit PR through `/auto-merge` and its `deploy.yml`.

- **DG-4**: `cloud.js` renders an "On this device" row at the top of the account panel, in `renderList` (line 607) and `renderSignedOut` (line 658) alike, from `window.DiyaGlAutosave.loadWorkingBook()`: the record's `source.label` as the name, its `savedAt` as "saved N ago", a Clear action calling `DiyaGlAutosave.clearWorkingBook()`, and the sentence "kept on this device until you clear your browser data; download the file to keep it for good". `loadWorkingBook` resolves a record or null and never rejects, so the row renders only when a record exists, and the panel renders first and fills the row when the promise resolves. `shell.js` already formats a relative time in `formatSavedAt` (line 898) for the continue offer; reuse it rather than writing a second formatter, exporting it on the `window.DiyaGlPage` surface (line 3224) if cloud.js cannot reach it. Clearing from the panel also clears `state.savedBook`, the same effect `handleDiscardSavedBook` (line 1042) has, so route the Clear action through the page surface rather than calling `clearWorkingBook` twice over.

  `shell.js` calls `navigator.storage.persist()` once per page, after the first `saveWorkingBook` that resolves true, from `autosaveCurrentBook` (line 1268); guard on `navigator.storage && navigator.storage.persist` and ignore the result. The homepage tier strip's first line, which DG-1g builds, reads the same as the row's sentence.

  `cloud.js` mounts only when `isEnabled()` (line 26) passes, which needs a client id and https or localhost, so the row appears wherever the account panel does and not in a `file://` runner.

  Tests: `web/browser-tests/diya-gl-cloud.browser.test.js` covers the row's presence with a seeded autosave record signed out and signed in, the Clear action emptying the row, and `navigator.storage.persist` called once, stubbed through `addInitScript`.

  Acceptance: `npm test` green in this repo.

- **DG-5**: merge the batch branch first.

  **The manifest.** `scripts/build-runner.mjs` writes `target/runners/runners.json` after the four HTML files: one entry per product with `product`, `file`, `bytes` (from `statSync` on the written file) and the stamps `provenanceStamps(product)` returns (`diya-gl:formatVersion`, `diya-gl:engineVersion`, `diya-gl:taxDataHash`, `diya-gl:templateHash`, `diya-gl:templateScorecard`, and `diya-gl:reconciledCommit` when the build has one). Measured sizes on 2026-09-18: BST 2.9 MB, Taxi 2.6 MB, SE 5.4 MB, Ltd 8.2 MB. `deploy.yml` already runs `aws s3 sync target/runners/ …`, so the manifest uploads with the files and needs no workflow change.

  **The newer-file notice.** The runner has no build stamp of its own today: `buildProvenanceStamp()` emits the engine's five provenance stamps, while the site's `build-stamp.js` sets `self.DIYA_GL_BUILD_STAMP` to a hash of the precached bytes, which is a different value. So the runner build reads `web/diya-gl.co.uk/public/build-stamp.js`, takes the `DIYA_GL_BUILD_STAMP` literal out of it, and embeds it in the runner as its own `window.DIYA_GL_RUNNER_STAMP`. Each runner then carries a plain `<script src="https://diya-gl.co.uk/build-stamp.js">` tag (a script tag from `file://` is not subject to CORS, and the fake `<base href>` does not affect an absolute URL) plus a small inline script that compares `window.DIYA_GL_BUILD_STAMP` with `window.DIYA_GL_RUNNER_STAMP` and, when they differ, shows one line above the footer offering the newer file at `https://diya-gl.co.uk/runners/diya-gl-<product>.html`. A script that never loads (no network) leaves `DIYA_GL_BUILD_STAMP` undefined and shows nothing, which is the offline case and needs no guard beyond the equality test.

  **The homepage row.** `index.html`'s runner row fetches `runners/runners.json` and prints, per product, the file size to one decimal place in MB and the engine version from the stamps. The links keep the `download` attribute. `download.html`'s old row fired GA4's `runner_download` through `lib/ecommerce-events.js` and `lib/download-page.js`; DG-1e copies `lib/ecommerce-events.js` into the new root, so bind the same event here from a small inline handler on `index.html` rather than porting `download-page.js` whole. Style the row in `diya-gl.css` with the existing tokens.

  Acceptance: `npm test`, with two new cases in `web/browser-tests/diya-gl-runner.browser.test.js`. The first parses `target/runners/runners.json` and asserts four entries, each with a `bytes` above zero matching the file on disk and the six stamp keys. The second opens `file://target/runners/diya-gl-bst.html` with `page.route` fulfilling `**/build-stamp.js` with a fabricated different stamp, and asserts the notice line appears with an `href` naming the BST runner on `diya-gl.co.uk`; a third run with the route fulfilling the runner's own stamp asserts no notice.

- **DG-6**: `diya-gl-events.js` gains a builder beside `cloud_save` (line 45): `{ name: "sandbox_expired_seen", params: { missing: <count> } }`. `cloud.js`, where the list response is rendered, keeps the last rendered book count for the session in `sessionStorage` beside the cloud session; when a fresh list for the same signed-in user carries fewer books and the reader deleted none since the last render, it sends the event once through the same `window.DiyaGlPage.trackEvent` path (line 186) and updates the stored count. A delete resets the stored count so the event never fires for the reader's own removal. Test: `diya-gl-cloud.browser.test.js` stubs two list responses, three books then two, and asserts one `sandbox_expired_seen` with `missing: 1`; a delete followed by a shorter list sends none. Acceptance: `npm test` green.

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
