# GITHUB_SETUP.md — what a fresh GitHub repo needs

This document captures the GitHub-side configuration this repo depends on. If you're setting it up in a new GitHub account or org, this is the checklist.

## What this repo deploys

The spreadsheets download site and package-generation pipeline. CDK (Java) deploys an S3 + CloudFront static site to one AWS account:

| Account | AWS Account ID | Profile |
|---|---|---|
| `spreadsheets` | 064390746177 | `spreadsheets` |

Live site: https://spreadsheets.diyaccounting.co.uk

## AWS-side prerequisites

The AWS account needs a GitHub OIDC provider and two IAM roles:

| Role | Trusted by | Purpose |
|---|---|---|
| `spreadsheets-github-actions-role` | GitHub OIDC | Workflow entry — allowed `sub` claim `repo:<org>/spreadsheets.diyaccounting.co.uk:*` |
| `spreadsheets-deployment-role` | `spreadsheets-github-actions-role` | CDK deploy role; assumed via STS chain |

(Both created by `submit.diyaccounting.co.uk/scripts/aws-accounts/bootstrap-account.sh` when the account was first set up.)

The OIDC `sub` claim format is `repo:<github-org-or-user>/spreadsheets.diyaccounting.co.uk:*`. This CDK does not manage the trust policy — if the GitHub org changes, update the trust on `spreadsheets-github-actions-role` directly with `aws iam update-assume-role-policy`.

## GitHub Environments

A `ci` environment is referenced by `deploy.yml`. Create it under **Settings → Environments**. No `prod` is needed (this repo deploys to one AWS account, not split).

## GitHub Actions Variables

Repo-level (referenced by all workflows):

| Variable | Value source |
|---|---|
| `SPREADSHEETS_ACTIONS_ROLE_ARN` | `aws --profile spreadsheets iam get-role --role-name spreadsheets-github-actions-role --query Role.Arn --output text` |
| `SPREADSHEETS_DEPLOY_ROLE_ARN` | `aws --profile spreadsheets iam get-role --role-name spreadsheets-deployment-role --query Role.Arn --output text` |
| `SPREADSHEETS_CERTIFICATE_ARN` | `aws --profile spreadsheets acm list-certificates --region us-east-1 --query "CertificateSummaryList[].CertificateArn | [0]" --output text` (single wildcard cert covering ci+prod aliases) |

The `deploy.yml` job declares `environment: ci`, so these vars resolve from the env scope first if set there, falling back to repo-level.

## GitHub Actions Secrets

None required. All authentication is via OIDC; no third-party tokens are used during deploy.

## Workflows

| File | Trigger | What it does |
|---|---|---|
| `test.yml` | push, schedule (3× daily), pull_request | Lint + format + Maven verify + CDK synth + tests |
| `deploy.yml` | push to main, schedule (daily), workflow_dispatch | Deploy `SpreadsheetsStack` to S3 + CloudFront |
| `generate-bst.yml`, `generate-ltd.yml`, `generate-se.yml`, `generate-taxi.yml` | schedule (daily, staggered), workflow_dispatch | Regenerate the per-product Excel package outputs and self-commit them under `packages/`. Push triggers were disabled 2026-05-07 to reduce the volume of bot-authored mass-file-change commits — see the comment at the top of each generate workflow. |
| `update.yml` | push (workflow file only), schedule (daily 02:17 UTC), workflow_dispatch | Bumps `package-lock.json`, `package.json`, `pom.xml` and self-commits |
| `init.yml` | workflow_dispatch only | Orchestrator — clean + regenerate + commit + dispatch test/deploy |

## Sequence to bring a new repo online

1. Create the repo on GitHub. Push code.
2. Update OIDC trust on `spreadsheets-github-actions-role` to include `repo:<new-org>/spreadsheets.diyaccounting.co.uk:*` (via the AWS console or `aws iam update-assume-role-policy`).
3. Create the `ci` GitHub Environment.
4. Set the three `SPREADSHEETS_*` variables (env-level on `ci`, or repo-level).
5. Push a trivial commit on a feature branch — `test.yml` should pass (proves OIDC).
6. Open a PR, merge to `main` — `deploy.yml` runs and deploys to spreadsheets account.
7. Verify https://spreadsheets.diyaccounting.co.uk responds and the generated `catalogue.toml` is current.
8. (Optional) Re-enable scheduled generators by manually dispatching them or waiting for their daily cron.

## Local scripts (developer-machine only)

| Script | Purpose |
|---|---|
| `scripts/update-tax-data.sh` | Scrape HMRC pages and call `gh copilot` to generate missing `app/data/*.toml` files. Reads HMRC pages, extracts via LLM, writes locally. **Review and commit manually.** Replaces a previous CI workflow that did the same thing — running an LLM call inside Actions and self-committing the output is the kind of automation pattern that triggers GitHub's abuse heuristics; run it locally instead. |
| `scripts/hmrc-rate-urls.cjs` | Helper used by the above to enumerate HMRC URLs for a given base year. |

## How to obtain values quickly

```bash
# Role ARNs
aws --profile spreadsheets iam list-roles \
  --query "Roles[?contains(RoleName, 'github-actions') || contains(RoleName, 'deployment')].[RoleName,Arn]" \
  --output table

# Cert ARN (us-east-1, required for CloudFront)
aws --profile spreadsheets acm list-certificates --region us-east-1 \
  --query "CertificateSummaryList[].[DomainName,CertificateArn]" --output table

# Verify OIDC trust on the role
aws --profile spreadsheets iam get-role --role-name spreadsheets-github-actions-role \
  --query 'Role.AssumeRolePolicyDocument'
```
