<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->
<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->

# Security

## Reporting a vulnerability

Tell us privately first. Please do not open an issue, a discussion or a pull request for a security problem, and please do not post it publicly before we have had a chance to fix it.

There are two private routes:

- **GitHub private vulnerability reporting**, which is enabled on this repository. Open the Security tab and choose "Report a vulnerability". The report stays between you and us until we publish an advisory.
- **Email** to support@diyaccounting.co.uk, with "Security" in the subject line.

Either route reaches us. Use whichever suits you.

## What to include

- What the problem is, and what someone gains by exploiting it.
- Steps to reproduce it. A short script, a saved request or a sample file helps most.
- The version, tag or commit you tested, and the page address if it is on the site.
- Your setup, as far as it matters: operating system, Node version, browser, image tag.
- How you would like to be credited, or that you would rather not be named.

If a spreadsheet or a DIYA-GL file triggers the problem, send the file. Take out any real personal or financial data first.

Please test against your own copy. Do not run load tests or automated scanners against the live site, and do not read or change data that is not yours.

## What we do

We acknowledge every report within three working days. After that we tell you whether we can reproduce it and what we plan to do about it. We fix confirmed problems as quickly as the severity deserves, and we keep you posted while we work.

When the fix ships we publish a GitHub security advisory and credit you, unless you asked us not to. If we decide a report is not a vulnerability, we tell you why.

We are a small company, so expect a person rather than a rota.

We do not run a bug bounty and we do not pay for reports.

## Scope

This policy covers:

- this repository
- the site at spreadsheets.diyaccounting.co.uk and the files it serves, including the spreadsheet packages
- the npm package `@diy-accounting-uk/diya-gl`
- the container image `ghcr.io/diy-accounting-uk/diya-gl`

Our other repositories and sites carry their own security policy. Report a problem to the one that hosts it. If you cannot tell which that is, email us and we will pass it on.
