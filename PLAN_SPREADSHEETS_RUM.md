<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->
<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->
# PLAN: CloudWatch RUM on spreadsheets.diyaccounting.co.uk

Submit's operations dashboard has a page-experience panel that reads `AWS/RUM` by
`application_name`; this site has no app monitor, so the panel does not cover it.

## Request (verbatim, from the submit session's inbox message, 2026-09-20T18:12:16Z)

> Add CloudWatch RUM to spreadsheets.diyaccounting.co.uk so the page-experience panel covers it.
>
> 1. In `SpreadsheetsStack.java`, add a `CfnAppMonitor` plus a Cognito identity pool and guest role, on the pattern of submit's `infra/main/java/co/uk/diyaccounting/submit/stacks/ObservabilityStack.java` lines 300-345: `CfnIdentityPool` (unauthenticated identities allowed), a `Role` assumed by `cognito-identity.amazonaws.com` via `FederatedPrincipal` scoped to that pool with `sts:AssumeRoleWithWebIdentity`, policy action `rum:PutRumEvents`, a `CfnIdentityPoolRoleAttachment` attaching that role as `unauthenticated`, then the `CfnAppMonitor` itself with `appMonitorConfiguration` carrying `sessionSampleRate`, `allowCookies`, `enableXRay`, `guestRoleArn`, `identityPoolId`, and `telemetries` including `"performance"` (that's what feeds `WebVitalsCumulativeLayoutShift`, `WebVitalsLargestContentfulPaint`, `WebVitalsInteractionToNextPaint`).
> 2. Add the `cwr` loader from submit's `web/public/submit.js` `maybeInitRum` to `web/spreadsheets.diyaccounting.co.uk/public/lib/analytics.js` (loaded by all 147 pages), gated the same way submit gates it (consent check, `window.__RUM_CONFIG__`, one-time init guard).
> 3. In `infra/main/resources/security-headers.json`, add to `script-src`: `https://client.rum.us-east-1.amazonaws.com`; to `connect-src`: `https://dataplane.rum.eu-west-2.amazonaws.com` and `https://cognito-identity.eu-west-2.amazonaws.com`. Quoted exactly from submit's `EdgeStack.java` lines 793 and 877, both CSPs read: `script-src 'self' 'unsafe-inline' https://client.rum.us-east-1.amazonaws.com https://www.googletagmanager.com;` and `connect-src 'self' https://dataplane.rum.eu-west-2.amazonaws.com https://cognito-identity.eu-west-2.amazonaws.com https://sts.eu-west-2.amazonaws.com ...` (submit also carries `https://sts.eu-west-2.amazonaws.com` there; add it too, same RUM guest-role STS assume-role-with-web-identity call needs it).
>
> Nothing needed back from submit: the operations dashboard reads `AWS/RUM` by `application_name`, not by ARN. Name the app monitor `spreadsheets-web`, or reply in `~/.claude/inboxes/submit.md` with whatever name you chose.

## Design

- **Region.** `SpreadsheetsStack` deploys in `us-east-1`, so the app monitor, identity pool and
  guest role live there and the CSP hosts are the `us-east-1` ones:
  `https://client.rum.us-east-1.amazonaws.com` (script-src, the client library),
  `https://dataplane.rum.us-east-1.amazonaws.com`, `https://cognito-identity.us-east-1.amazonaws.com`
  and `https://sts.us-east-1.amazonaws.com` (connect-src). The request's `eu-west-2` hosts are
  Submit's region, not this site's.
- **Name.** `spreadsheets-web` on prod; `ci-spreadsheets-web` on ci, so the two monitors do not
  collide in one account. The dashboard reads prod's name. `domainList`: the environment's site
  domain names (prod `spreadsheets.diyaccounting.co.uk`, `prod-spreadsheets.diyaccounting.co.uk`;
  ci `ci-spreadsheets.diyaccounting.co.uk`).
- **Config reaches the pages through the bucket, not through 147 edited pages.** The stack adds a
  second `BucketDeployment` (`prune(false)`, `retainOnDelete(true)`) whose source is
  `Source.data("lib/rum-config.js", ...)` carrying `window.__RUM_CONFIG__ = {appMonitorId,
  region, identityPoolId, guestRoleArn, sessionSampleRate}` with the CDK tokens for the monitor
  id (`CfnAppMonitor.getAttrId()`), the pool ref and the role ARN; CDK resolves tokens in
  `Source.data` at deploy time. `analytics.js` loads `/lib/rum-config.js` as a plain script tag
  it injects itself, then runs the `cwr` loader on `window.__RUM_CONFIG__`; a missing file (local
  server, a browser test) leaves `__RUM_CONFIG__` undefined and the loader returns. No page edits.
- **Consent.** The same `consent.analytics` key `analytics.js` already reads: RUM initialises only
  after consent is granted, and `consent-banner.js`'s grant path calls the init once. Telemetries
  `performance`, `errors`, `http`; `sessionSampleRate` 1.0; `allowCookies` true; `enableXRay` true.
- **Tests.** `DiyaGlSiteStackTest`'s sibling: a `SpreadsheetsStackTest` asserting one
  `AWS::RUM::AppMonitor` named per environment with `performance` in its telemetries, one
  identity pool with unauthenticated identities allowed, and the guest role's `rum:PutRumEvents`.
  The browser suite's CSP test (`web/browser-tests/serve.js` reads `security-headers.json`) keeps
  passing; `web/unit-tests` gets a case that `analytics.js` does not call the loader without
  consent.

## Task list

| # | Task | Precursors | Model | Files |
| --- | --- | --- | --- | --- |
| RUM-1 | The app monitor, identity pool, guest role and config deployment in `SpreadsheetsStack`; the `cwr` loader in `analytics.js`; the CSP hosts; the stack test | — | Sonnet | `infra/main/java/co/uk/diyaccounting/spreadsheets/stacks/SpreadsheetsStack.java`, `infra/main/resources/security-headers.json`, `infra/test/java/co/uk/diyaccounting/spreadsheets/stacks/SpreadsheetsStackTest.java` (new), `web/spreadsheets.diyaccounting.co.uk/public/lib/analytics.js`, `web/spreadsheets.diyaccounting.co.uk/public/lib/consent-banner.js`, a `web/unit-tests` case (~6 files) |
