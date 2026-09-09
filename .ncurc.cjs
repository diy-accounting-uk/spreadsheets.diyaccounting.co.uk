// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

// npm-check-updates configuration
// https://github.com/raineorshine/npm-check-updates#config-file

module.exports = {
  // Only follow the 'latest' dist-tag — avoids picking up 'next', 'beta',
  // accidental publishes (like aws-cdk@3.0.0), and pre-release tags.
  target: "latest",

  // Reject specific versions that are known-bad or unwanted.
  // Entries are package names (regex supported).
  // reject: [],

  // Filter results after version lookup — reject pre-release versions
  // that somehow made it onto the 'latest' tag.
  filterResults: function (name, { currentVersion, upgradedVersion }) {
    // Reject any version containing pre-release identifiers
    if (
      /-alpha|-(beta|rc|dev|canary|experimental|pre)\b/.test(upgradedVersion)
    ) {
      return false;
    }
    return true;
  },
};
