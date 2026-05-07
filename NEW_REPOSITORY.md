# NEW_REPOSITORY.md — migration record

> This repository was migrated from `antonycc/diy-accounting` to **`support-at-diyaccounting/spreadsheets.diyaccounting.co.uk`** on **2026-05-06** after the suspension of `antonycc`. The repo was **renamed** as part of the migration (the local working-tree directory is still `diy-accounting/`).

## What happened

- The personal account `antonycc` was first org-flagged on 2026-05-03 and fully suspended on 2026-05-06.
- A new GitHub Pro account `support-at-diyaccounting` was created and authenticated.
- The repo was renamed to align with its purpose: this is the live spreadsheets download site (`https://spreadsheets.diyaccounting.co.uk`) and the package-generation pipeline.
- Cross-repo migration plan: see `PLAN_GITHUB_MIGRATION.md` and `PLAN_FLAGGED.md` in the parent workspace (`/Users/antony/projects/diy-accounting-limited/`).
- This repo manages the **spreadsheets AWS account (064390746177)** — S3 + CloudFront for `spreadsheets.diyaccounting.co.uk` plus generated package builds.

## How this repo was created in the new home

```bash
gh repo create support-at-diyaccounting/spreadsheets.diyaccounting.co.uk \
  --public \
  --description "Spreadsheets download site and package pipeline (S3 + CloudFront)"

git -C diy-accounting remote add newhome \
  git@github.com:support-at-diyaccounting/spreadsheets.diyaccounting.co.uk.git
git -C diy-accounting push newhome --all
git -C diy-accounting push newhome --tags
```

## Branch decision: history was truncated

The previous `antonycc/diy-accounting` `origin/main` had **66 bot-authored commits** dated 2026-04-06 → 2026-04-21:
- 54 cosmetic xlsx/pdf regenerations (`Generate {Self Employed,BST,Taxi Driver,Ltd Company} packages from app/data and app/templates`)
- 12 dependency-bump commits (`Update formatting and dependencies` — touched `package-lock.json` / `package.json` / `pom.xml`)

These were discarded for the migration. The new repo's `main` is at **`11cde9f4`** — the `Merge pull request #90 from antonycc/fidelity` commit, which is the last human-authored merge before the bot run started. The 14 local feature branches (including `deepfidelity`, `fidelity`, `reconcile`, `claude/ltd-generation`, `claude/se-generation-plan`, etc.) were all pushed.

The bot workflows are still in `.github/workflows/` and will repopulate the dependency bumps and example-output binaries on schedule once Actions are enabled in the new repo.

## What was migrated

- **14 branches**: `main` (truncated to `11cde9f4`), `deepfidelity`, `fidelity`, `reconcile`, `all-years`, `claude/ltd-generation`, `claude/se-generation-plan`, `claude/taxi-driver-generation`, `cleanup`, `fewer-files`, `fewer-files-docs`, `generator-spike`, `se-guide`, `spreadsheetsascdk`.
- **0 tags**.
- **All repository content** including CDK Java, package generators, example outputs, web assets.

## Code rewrites in this branch

This branch (`claude/migrate-to-support-at-diyaccounting`) updates stale `antonycc` references. Replacement rules applied:

| Old reference | New reference |
|---|---|
| `antonycc/diy-accounting` | `support-at-diyaccounting/spreadsheets.diyaccounting.co.uk` (the rename) |
| `antonycc/root.diyaccounting.co.uk` | `support-at-diyaccounting/root.diyaccounting.co.uk` |
| `antonycc/submit.diyaccounting.co.uk` | `support-at-diyaccounting/submit.diyaccounting.co.uk` |
| `antonycc/www.diyaccounting.co.uk` | `support-at-diyaccounting/www.diyaccounting.co.uk` |
| `@antonycc/spreadsheets-diyaccounting-co-uk` (npm scope) | `@support-at-diyaccounting/spreadsheets-diyaccounting-co-uk` |
| `@antonycc/diy-accounting/<sub>` (CDK tags) | `@support-at-diyaccounting/spreadsheets.diyaccounting.co.uk/<sub>` |

Files affected (14):
- `README.md`
- `_developers/PLAN_DIYA_CLOUD.md`
- `app/templates/{bst,ltd,se,taxi}/*.md`, `app/templates/meta.toml`
- `infra/main/java/co/uk/diyaccounting/spreadsheets/stacks/SpreadsheetsStack.java` — CDK stack tags
- `package.json`
- `web/spreadsheets.diyaccounting.co.uk/public/{community,download}.html`, `lib/community-page.js`

## What was deliberately NOT rewritten

- `_developers/archive/*.md` — historical records.
- `cdk-spreadsheets.out/*` — build artifacts.
- `package-lock.json`, `target/`, test output files (`axe-*.json`, html-report).

## What still needs setup before deploys work

### 1. AWS OIDC trust policy (BLOCKING for first deploy)

The IAM roles in account **064390746177 (spreadsheets)** have `sub` claim trust pinned to `repo:antonycc/diy-accounting:*`. They must be updated to **`repo:support-at-diyaccounting/spreadsheets.diyaccounting.co.uk:*`** (note the renamed repo) before workflows can authenticate.

Apply via CDK redeploy from local SSO:
```bash
aws sso login --sso-session diyaccounting
./mvnw clean verify
npm run cdk:deploy   # uses --profile spreadsheets
```

### 2. GitHub Actions Variables

Set on this repo via `gh variable set`:

| Variable | Value source |
|---|---|
| `SPREADSHEETS_ACTIONS_ROLE_ARN` | `aws --profile spreadsheets iam get-role --role-name spreadsheets-github-actions-role --query Role.Arn --output text` |
| `SPREADSHEETS_DEPLOY_ROLE_ARN` | `aws --profile spreadsheets iam get-role --role-name spreadsheets-deployment-role --query Role.Arn --output text` |
| `SPREADSHEETS_CERTIFICATE_ARN` | `aws --profile spreadsheets acm list-certificates --region us-east-1 --query "CertificateSummaryList[?DomainName=='spreadsheets.diyaccounting.co.uk'].CertificateArn" --output text` |

### 3. GitHub Actions Secrets

None required for the deploy pipeline. The package-generation workflows (`generate-{ltd,se,taxi,bst}.yml`) commit back to the repo using the default `GITHUB_TOKEN` — no PAT needed unless the repo is configured with branch protection that disallows bot pushes.

### 4. GitHub Environments

None required.

## Sequence to restore deploys

1. Merge this PR.
2. `aws sso login --sso-session diyaccounting`.
3. From local: deploy CDK to spreadsheets account — applies the new OIDC trust pin (note the new repo name `spreadsheets.diyaccounting.co.uk`, not `diy-accounting`).
4. Set the three variables listed above.
5. Push a trivial commit; verify `test.yml` and `deploy.yml` succeed.
6. Verify https://spreadsheets.diyaccounting.co.uk still serves correctly.
7. Optionally re-enable scheduled `generate-*` workflows to repopulate the daily example-package outputs.

## How to obtain values

### Role ARNs
```bash
aws --profile spreadsheets iam list-roles \
  --query "Roles[?contains(RoleName, 'github-actions') || contains(RoleName, 'deployment')].[RoleName,Arn]" \
  --output table
```

### Certificate ARN
```bash
aws --profile spreadsheets acm list-certificates --region us-east-1 \
  --query "CertificateSummaryList[].[DomainName,CertificateArn]" --output table
```

## Local working-tree note

The local clone is at `/Users/antony/projects/diy-accounting-limited/diy-accounting/` — the directory name still says `diy-accounting`. If you want to rename it locally too:
```bash
cd /Users/antony/projects/diy-accounting-limited
mv diy-accounting spreadsheets.diyaccounting.co.uk
```
But this is optional — git operations are unaffected by the local directory name.
