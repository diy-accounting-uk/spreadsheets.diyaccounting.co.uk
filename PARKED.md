<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->
<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->

# PARKED

Found during cool-down; for the operator to triage when it lifts.

- `app/data/releases.json` gives v1.2.41 and v1.2.42 the engine stamp `1.2.40+57de8f55b` and has no
  1.2.43 entry (the stale-stamp defect DG5 fixes going forward). Correcting them is a hand-edit of
  release history: each would become `<version>+<git log -1 --format=%h <tag> -- <engine closure files>>`,
  plus a new 1.2.43 record, then `node app/bin/build-reconciliation-pages.js` for the releases page.
