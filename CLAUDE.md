# Claude Code Memory - DIY Accounting Spreadsheets

> **Shared conventions** (git workflow, AWS accounts, code quality, confirm behavior, security): See `../CLAUDE.md`

## Context Survival (CRITICAL — read this first after every compaction)

**After compaction or at session start:**

1. Read all `PLAN_*.md` files in the project root — these are the active goals
2. Run `TaskList` to see tracked tasks with status
3. Do NOT start new work without checking these first

**During work:**

- When the user gives a new requirement, add it to the relevant `PLAN_*.md` or create a new one
- Track all user goals as Tasks with status (pending -> in_progress -> completed)
- Update `PLAN_*.md` with progress before context gets large

**PLAN file pattern:**

- Active plans live at project root: `PLAN_<DESCRIPTION>.md`
- Each plan has user assertions verbatim at the top (non-negotiable requirements)
- Plans track problems, fixes applied, and verification criteria
- If no plan file exists for the current work, create one before starting
- Never nest plans in subdirectories — always project root

## Quick Reference

This repository manages the **spreadsheets AWS account** (064390746177) for spreadsheets.diyaccounting.co.uk:

- **S3 + CloudFront static site** for `spreadsheets.diyaccounting.co.uk`
- **SpreadsheetsStack**: S3 bucket, CloudFront distribution with OAC, CloudFront Function for URL redirects
- **Redirect engine**: CloudFront Function generated from `web/spreadsheets.diyaccounting.co.uk/redirects.toml`
- **Package pipeline**: Excel workbooks in `packages/` -> zips in `target/zips/` -> S3 sync
- **Donations**: Stripe Payment Links (buy.stripe.com) and PayPal donate form

**What this repo does NOT have**: Lambda, DynamoDB, Cognito, API Gateway, Docker, ngrok, HMRC. DNS records are managed by the root repo.

## Product Context and Skills Documentation

### Product Context Documents

- `CONTEXT_BASIC_SOLE_TRADER.md` — Basic Sole Trader (BST) product: single-file, sheet map, data flow, scenarios, CI pipeline
- `CONTEXT_TAXI.md` — Taxi Driver product: single-file, mileage comparison, date pre-filling, scenarios, CI pipeline
- `CONTEXT_SELF_EMPLOYED.md` — Self Employed (SE) product: multi-file, external links, recalculation pipeline, scenarios, CI pipeline
- `CONTEXT_LIMITED_COMPANY.md` — Limited Company (Ltd) product: multi-file, 15 xlsx, non-March transforms, all year-end months, scenarios, CI pipeline

### Skills Documentation

- `SKILL_EXCEL.md` — Excel XML manipulation techniques, xls roundtrip, external link caches, multi-file recalculation, testing approaches, known pitfalls
- `SKILL_PACKAGE_UPDATES.md` — Annual tax data update process, HMRC rate sources, TOML file structure, publishing workflow

Note: Read these documents when working on the relevant product or technique. They contain detailed sheet maps, formula references, and CI pipeline descriptions that are essential context.

## Git Workflow

See `../CLAUDE.md` for full rules. Branch naming: `claude/<short-description>`.

## Build Commands

```bash
npm install
node scripts/build-spreadsheets-redirects.cjs
node scripts/build-sitemaps.cjs
./mvnw clean verify
node scripts/build-packages.cjs
npm run cdk:synth
```

## Testing

```bash
npm test                                    # Unit tests (vitest) — SEO validation + smoke tests
npm run test:browser                        # Browser tests (Playwright) — HTML content validation
npm run test:spreadsheetsBehaviour-local    # Behaviour tests against local server (localhost:3000)
npm run test:spreadsheetsBehaviour-ci       # Behaviour tests against CI environment
npm run test:spreadsheetsBehaviour-prod     # Behaviour tests against production
```

Behaviour tests use the `SPREADSHEETS_BASE_URL` environment variable to target different environments. Output is automatically teed to `spreadsheetsBehaviour.log` in the project root.

## CDK Architecture

**Single CDK application** (`cdk-spreadsheets/`):

- Entry point: `SpreadsheetsEnvironment.java` -> `spreadsheets.jar`
- Stack: `{env}-spreadsheets-SpreadsheetsStack` (S3 + CloudFront + OAC + redirects)

**Java packages** (`co.uk.diyaccounting.spreadsheets`):

- `spreadsheets` — `SpreadsheetsEnvironment.java` (CDK app entry point)
- `spreadsheets.stacks` — `SpreadsheetsStack.java` (S3 + CloudFront + OAC + CloudFront Function)
- `spreadsheets.utils` — `Kind.java` (logging), `KindCdk.java` (CDK utilities)

## Web Content

Static site files live in `web/spreadsheets.diyaccounting.co.uk/public/`. This is the document root deployed to S3.

Key pages: `index.html` (product catalogue), `download.html` (zip downloads), `donate.html` (Stripe + PayPal), `knowledge-base.html`, `community.html`, `references.html`, `sources.html`.

Redirects are configured in `web/spreadsheets.diyaccounting.co.uk/redirects.toml` and compiled to a CloudFront Function by `scripts/build-spreadsheets-redirects.cjs`. The generated `redirect-function.js` is gitignored.

## Package Pipeline

Excel workbook source files live in `packages/` organised by product and tax year. The `scripts/build-packages.cjs` script:

1. Scans `packages/` directories for Excel workbooks
2. Creates zip archives in `target/zips/`
3. Generates `web/spreadsheets.diyaccounting.co.uk/public/catalogue.toml`

During deployment, zips are uploaded to S3 separately from the BucketDeployment (`prune(false)` prevents BucketDeployment from deleting them).

## Compliance

```bash
npm run compliance:ci-report-md    # Run all compliance checks and generate report (CI)
npm run compliance:prod-report-md  # Run all compliance checks and generate report (prod)
```

## Deployment

Deployments are triggered via GitHub Actions workflows:

| Workflow     | Purpose                                          | Trigger                       |
| ------------ | ------------------------------------------------ | ----------------------------- |
| `test.yml`   | Lint, format check, Maven verify, CDK synth      | Push, PRs, daily schedule     |
| `deploy.yml` | Deploy SpreadsheetsStack, upload zips, smoke test | Push to main, manual dispatch |

GitHub repository variables:

| Variable                       | Purpose                            |
| ------------------------------ | ---------------------------------- |
| `SPREADSHEETS_ACTIONS_ROLE_ARN` | OIDC auth for spreadsheets account |
| `SPREADSHEETS_DEPLOY_ROLE_ARN`  | CDK deploy in spreadsheets account |
| `SPREADSHEETS_CERTIFICATE_ARN`  | ACM certificate for CloudFront     |

## AWS CLI Access

Use SSO profiles:

```bash
aws sso login --sso-session diyaccounting
aws --profile spreadsheets cloudformation describe-stacks --region us-east-1
aws --profile spreadsheets cloudfront list-distributions
```

**Read-only AWS operations are always permitted.** Ask before any write operations.

## AWS Write Operations

See `../CLAUDE.md` — always ask before any mutating AWS operation.

## Confirm Means Stop and Wait

See `../CLAUDE.md` — present the command, STOP, wait for explicit approval before executing.

## Code Quality Rules

See `../CLAUDE.md` for shared rules. Spreadsheets-specific: only run `./mvnw spotless:apply` when specifically asked.

## Security Checklist

See `../CLAUDE.md` for shared rules. Spreadsheets-specific: OIDC trust policies scoped to this specific repository.
