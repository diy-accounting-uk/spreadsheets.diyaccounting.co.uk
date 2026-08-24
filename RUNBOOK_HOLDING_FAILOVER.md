# Holding Failover Runbook

Procedure for moving live spreadsheets.diyaccounting.co.uk traffic onto a maintenance page and
back.

## What this repo's holding page is

`HoldingStack`, one per environment, both in the spreadsheets account (064390746177):

| Environment | Stack | Holding domain | `OriginFor` tag | Live domains it takes over |
|---|---|---|---|---|
| prod | `prod-spreadsheets-HoldingStack` | `holding.spreadsheets.diyaccounting.co.uk` | `holding.spreadsheets.diyaccounting.co.uk` | `spreadsheets.diyaccounting.co.uk`, `prod-spreadsheets.diyaccounting.co.uk` |
| ci | `ci-spreadsheets-HoldingStack` | `ci-holding.spreadsheets.diyaccounting.co.uk` | `ci-holding.spreadsheets.diyaccounting.co.uk` | `ci-spreadsheets.diyaccounting.co.uk` |

The page is titled "Maintenance – spreadsheets.diyaccounting.co.uk" with the heading "We'll be
right back". Every response carries a `Server: DIY-Accounting` header. A 403 or 404 on the
distribution also renders the holding page, so deep links fail over cleanly instead of showing an
S3 error.

The certificate is imported by ARN, one certificate covering both environments: domain
`holding.spreadsheets.diyaccounting.co.uk`, with SANs `ci-holding.spreadsheets.diyaccounting.co.uk`,
`spreadsheets.diyaccounting.co.uk`, `prod-spreadsheets.diyaccounting.co.uk` and
`ci-spreadsheets.diyaccounting.co.uk`. It is issued once by dispatching `request-holding-cert.yml`
(no inputs) — a bootstrap step, not a per-failover step. That workflow requests the certificate in
this account, assumes the management account's Route53 delegate role to write the DNS validation
records, waits for validation, then prints the certificate ARN to store as the repository variable
`SPREADSHEETS_HOLDING_CERTIFICATE_ARN`. Until that variable is set, `deploy.yml` skips
`HoldingStack` entirely rather than deploying with an invalid certificate.

This repo creates no Route53 records for the holding domains — those live in
`root.diyaccounting.co.uk`'s `RootDnsStack`, alongside the records this repo already depends on.

## When to fail over

Fail over when the site returns 5xx for more than five minutes, a deploy has left the origin
broken and rolling forward is not immediate, there is an active attack, or an AWS regional
incident is affecting the origin. Do not fail over for a slow site or a single failing route —
the holding page replaces the whole site, not one path.

## Who authorises

The operator. There is no standing delegation — nobody dispatches `deploy-holding.yml` without
the operator's direct instruction.

## How to fail over

Dispatch `deploy-holding.yml` on this repo:

- `target`: `holding`
- `environment-name`: `ci` or `prod` (or `(auto)`, which derives `prod` from `main` and `ci`
  otherwise)

The workflow strips the live aliases (e.g. `spreadsheets.diyaccounting.co.uk` and
`prod-spreadsheets.diyaccounting.co.uk` for prod) off the live `SpreadsheetsStack` distribution,
waits for that change to deploy, adds those same aliases to the `HoldingStack` distribution and
waits again, then assumes the management account's Route53 delegate role to UPSERT the live
domains' A/AAAA records as aliases to the holding distribution's CloudFront domain name. No DNS
TTL wait is involved — the alias record change is what a resolver sees on its next lookup.

## Expected time to take effect

10 to 20 minutes, dominated by the two `aws cloudfront wait distribution-deployed` calls (one per
distribution). Treat this as an observed range and correct it after the first real exercise.

## How to fail back

Dispatch `deploy-holding.yml` again with `target: restore` and the same `environment-name`. This
reverses both steps: the live aliases come off the holding distribution and go back onto the live
`SpreadsheetsStack` distribution, then the Route53 records are UPSERTed back to alias that
distribution's own CloudFront domain name.

Confirm the live aliases are back on the live distribution:

```bash
aws cloudfront get-distribution --id <spreadsheets-stack-distribution-id> \
  --query 'Distribution.DistributionConfig.Aliases.Items'
```

## How to verify while failed over

```bash
curl -sI https://spreadsheets.diyaccounting.co.uk/
```

Expect `200`, a `Server: DIY-Accounting` header, and a body that is the holding page, not the live
site.

## Rehearsal

Exercise the `ci` environment twice a year. Never rehearse against `prod`.

## Deploying while failed over

There is no guard against deploying this repo's `deploy.yml` while a failover is live.
`SpreadsheetsStack` declares its live domain names as a fixed property of its CloudFront
distribution, so a deploy does not silently undo the failover — it fails. CloudFront rejects the
attempt to put those aliases back on the live distribution while the holding distribution still
holds them, and the CDK deploy step for `SpreadsheetsStack` errors with a CNAME-already-exists
failure. Restore the failover first (`deploy-holding.yml` with `target: restore`), confirm the
live aliases are back on the live distribution, then redeploy.

`deploy.yml` also writes `/spreadsheets/<env>/last-known-good-deployment` (the commit SHA) to SSM
on every green deploy. This failover's restore path does not read that parameter — it always
restores the live distribution's own aliases, not a specific past deployment — so the parameter is
not part of this procedure today.

## Certificate coverage for new domains

Failover adds a live domain as an alias to the holding distribution, and CloudFront refuses an
alias the distribution's certificate does not cover. If a new live domain is added to this site,
it must be added to the holding certificate's subject alternative names before it can ever be
failed over. Re-run `request-holding-cert.yml` with the expanded SAN list, wait for validation,
and update the `SPREADSHEETS_HOLDING_CERTIFICATE_ARN` repository variable with the new ARN before
relying on failover for that domain.
