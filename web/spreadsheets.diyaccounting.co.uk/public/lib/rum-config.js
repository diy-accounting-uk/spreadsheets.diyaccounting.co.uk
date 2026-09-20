// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

// The committed copy carries no config, so a local server or a browser test starts no RUM
// client. SpreadsheetsStack overwrites this file in the bucket at deploy time with the app
// monitor id, identity pool and guest role.
window.__RUM_CONFIG__ = null;
