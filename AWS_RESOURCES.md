# AWS Resources — Spreadsheets Account (064390746177)

## Managed by This Repo (per environment)

Resources below exist for both `ci` and `prod` environments. Replace `{env}` with `ci` or `prod`.

| Resource | Name / ID | Purpose |
| -------- | --------- | ------- |
| CloudFormation | `prod-spreadsheets-HoldingStack` | CDK-managed stack (UPDATE_COMPLETE) |
| CloudFormation | `ci-spreadsheets-HoldingStack` | CDK-managed stack (UPDATE_COMPLETE) |
| CloudFormation | `prod-spreadsheets-SpreadsheetsStack` | CDK-managed stack (UPDATE_COMPLETE) |
| CloudFormation | `ci-spreadsheets-SpreadsheetsStack` | CDK-managed stack (UPDATE_COMPLETE) |
| CloudFront dist | `E2TBOSOQKMVM6Q` / `dk6ghpplfgq9t.cloudfront.net` | ci-spreadsheets.diyaccounting.co.uk |
| CloudFront dist | `EIWDNO6M6DL7R` / `d10s0isuhkjtrs.cloudfront.net` | spreadsheets.diyaccounting.co.uk, prod-spreadsheets.diyaccounting.co.uk |
| CloudFront dist | `E3THUGJQKYPCVQ` / `d26g1o8ushc3wo.cloudfront.net` | ci-holding.spreadsheets.diyaccounting.co.uk |
| CloudFront dist | `EO2VDDIEW3GCI` / `dmau7qqynspz9.cloudfront.net` | holding.spreadsheets.diyaccounting.co.uk |
| S3 bucket | `ci-spreadsheets-holdingst-cispreadsheetsholdingori-nowwxddiuuer` | Static site content origin |
| S3 bucket | `ci-spreadsheets-spreadshe-cispreadsheetsoriginbuck-mbkz8lqgzamk` | Static site content origin |
| S3 bucket | `prod-spreadsheets-holding-prodspreadsheetsholdingo-rfz0tnwewbfd` | Static site content origin |
| S3 bucket | `prod-spreadsheets-spreads-prodspreadsheetsoriginbu-qjetba5uusfd` | Static site content origin |
| Lambda | `prod-spreadsheets-Holding-CustomS3AutoDeleteObject-OEo5s3...` | Lambda function for auto-deleting objects in prod-spreadsheets-holding-prodspreadsheetsholdingo-rfz0tnwewbfd S3 bucket. |
| Lambda | `ci-spreadsheets-HoldingSt-CustomCDKBucketDeploymen-4uDy4l...` | CDK custom resource handler |
| Lambda | `prod-spreadsheets-Spreads-CustomS3AutoDeleteObject-Olawhw...` | Lambda function for auto-deleting objects in prod-spreadsheets-spreads-prodspreadsheetsoriginbu-qjetba5uusfd S3 bucket. |
| Lambda | `prod-spreadsheets-Spreads-CustomCDKBucketDeploymen-P9xSRc...` | CDK custom resource handler |
| Lambda | `ci-spreadsheets-Spreadshe-CustomCDKBucketDeploymen-nEV7ko...` | CDK custom resource handler |
| Lambda | `prod-spreadsheets-Holding-CustomCDKBucketDeploymen-w2mrOB...` | CDK custom resource handler |
| Lambda | `ci-spreadsheets-Spreadshe-CustomS3AutoDeleteObject-OwadI2...` | Lambda function for auto-deleting objects in ci-spreadsheets-spreadshe-cispreadsheetsoriginbuck-mbkz8lqgzamk S3 bucket. |
| Lambda | `ci-spreadsheets-HoldingSt-CustomS3AutoDeleteObject-TM8zyp...` | Lambda function for auto-deleting objects in ci-spreadsheets-holdingst-cispreadsheetsholdingori-nowwxddiuuer S3 bucket. |
| IAM roles (6) | `{env}-spreadsheets-SpreadsheetsStack-*` | CDK custom resource execution roles |
| CloudWatch log group | `/aws/lambda/ci-spreadsheets-HoldingSt-AWS679f53fac002430cb0da5-D7BiqZ4JGeHV` | CloudFront access logs |
| CloudWatch log group | `/aws/lambda/ci-spreadsheets-HoldingSt-CustomCDKBucketDeploymen-4uDy4l5v8apF` | CloudFront access logs |
| CloudWatch log group | `/aws/lambda/ci-spreadsheets-HoldingSt-CustomS3AutoDeleteObject-TM8zypZbiew9` | CloudFront access logs |
| CloudWatch log group | `/aws/lambda/ci-spreadsheets-Spreadshe-AWS679f53fac002430cb0da5-grVpjMJAGjgy` | CloudFront access logs |
| CloudWatch log group | `/aws/lambda/ci-spreadsheets-Spreadshe-CustomCDKBucketDeploymen-nEV7kohLPwOg` | CloudFront access logs |
| CloudWatch log group | `/aws/lambda/ci-spreadsheets-Spreadshe-CustomS3AutoDeleteObject-OwadI2UVa2nv` | CloudFront access logs |
| CloudWatch log group | `/aws/lambda/prod-spreadsheets-Holding-AWS679f53fac002430cb0da5-9YA7IUhKfE0A` | CloudFront access logs |
| CloudWatch log group | `/aws/lambda/prod-spreadsheets-Holding-CustomCDKBucketDeploymen-w2mrOBj1NRQT` | CloudFront access logs |
| CloudWatch log group | `/aws/lambda/prod-spreadsheets-Holding-CustomS3AutoDeleteObject-OEo5s319nOjs` | CloudFront access logs |
| CloudWatch log group | `/aws/lambda/prod-spreadsheets-Spreads-AWS679f53fac002430cb0da5-RQFgCuyInf46` | CloudFront access logs |
| CloudWatch log group | `/aws/lambda/prod-spreadsheets-Spreads-CustomCDKBucketDeploymen-P9xSRcUGsFjB` | CloudFront access logs |
| CloudWatch log group | `/aws/lambda/prod-spreadsheets-Spreads-CustomS3AutoDeleteObject-OlawhwDAzQol` | CloudFront access logs |
| CloudWatch log group | `distribution-ci-spreadsheets-holding-logs` | CloudFront access logs |
| CloudWatch log group | `distribution-ci-spreadsheets-logs` | CloudFront access logs |
| CloudWatch log group | `distribution-prod-spreadsheets-holding-logs` | CloudFront access logs |
| CloudWatch log group | `distribution-prod-spreadsheets-logs` | CloudFront access logs |

## Account-Level Resources

| Resource | ARN / Name | Purpose |
| -------- | ---------- | ------- |
| CloudFormation | `CDKToolkit` | CDK bootstrap stack |
| IAM role | `spreadsheets-deployment-role` | CDK deploy role |
| IAM role | `spreadsheets-github-actions-role` | OIDC auth for GitHub Actions |
| IAM OIDC provider | `token.actions.githubusercontent.com` | GitHub Actions OIDC |
| ACM certificate | `arn:aws:acm:us-east-1:064390746177:certificate/bc67c01c-ea52-4b11-8958-68e24bf23727` | TLS for CloudFront (ci-spreadsheets.diyaccounting.co.uk) |
| ACM certificate | `arn:aws:acm:us-east-1:064390746177:certificate/f392dab5-debd-43fa-9002-000a871bc9a1` | TLS for CloudFront (holding.spreadsheets.diyaccounting.co.uk) |
| S3 bucket | `cdk-hnb659fds-assets-064390746177-eu-west-2` | CDK asset staging (west-2) |
| S3 bucket | `cdk-hnb659fds-assets-064390746177-us-east-1` | CDK asset staging (east-1) |
| IAM roles (10) | `cdk-hnb659fds-*-064390746177-*` | CDK bootstrap roles |
| SSM parameter | `/cdk-bootstrap/hnb659fds/version` | CDK bootstrap version (30) |

## AWS Service-Linked Roles (auto-created, do not delete)

| Role | Service |
| ---- | ------- |
| `AWSServiceRoleForCloudFrontLogger` | Cloud Front Logger |
| `AWSServiceRoleForOrganizations` | Organizations |
| `AWSServiceRoleForResourceExplorer` | Resource Explorer |
| `AWSServiceRoleForSSO` | S S O |
| `AWSServiceRoleForSupport` | Support |
| `AWSServiceRoleForTrustedAdvisor` | Trusted Advisor |

## Intentional Non-CDK Resources

| Resource | Purpose |
| -------- | ------- |
| IAM role | `OrganizationAccountAccessRole` — cross-account admin access |
| SSO reserved roles (2) | `AWSReservedSSO_AdministratorAccess_1f02f32487badfde`, `AWSReservedSSO_ReadOnlyAccess_64e03b1c5755f3f4` |
| IAM role | `ci-spreadsheets-HoldingSt-AWS679f53fac002430cb0da5b-s1wt3TCj39lx` |
| IAM role | `ci-spreadsheets-HoldingSt-CustomCDKBucketDeployment-SB165e1Tlgud` |
| IAM role | `ci-spreadsheets-HoldingSt-CustomS3AutoDeleteObjects-8fRqUnwKrsw9` |
| IAM role | `prod-spreadsheets-Holding-AWS679f53fac002430cb0da5b-q6EF9N6V5qRS` |
| IAM role | `prod-spreadsheets-Holding-CustomCDKBucketDeployment-fl6qOXAliDaL` |
| IAM role | `prod-spreadsheets-Holding-CustomS3AutoDeleteObjects-UcU23mqbMPWi` |

---

*Generated by `node scripts/generate-aws-resources.js --profile spreadsheets`*
