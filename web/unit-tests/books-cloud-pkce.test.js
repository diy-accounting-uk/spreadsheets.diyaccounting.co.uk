// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

// cloud-config.js and cloud.js are classic browser scripts (no
// import/export) loaded via <script src> on the four books pages, so each
// publishes its result on window. Run them in a sandbox the same way a
// browser would, providing only the globals a browser actually carries.
const CONFIG_SRC = readFileSync(resolve(process.cwd(), "web/spreadsheets.diyaccounting.co.uk/public/books/cloud-config.js"), "utf8");

function runCloudConfig(hostname) {
  const sandbox = {
    window: {
      location: { hostname: hostname, protocol: "https:", search: "", pathname: "/books/bst.html", origin: "https://" + hostname },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(CONFIG_SRC, sandbox);
  return sandbox.window.DIYA_GL_CLOUD_CONFIG;
}

describe("cloud-config.js's environment resolver", () => {
  it("maps the production host to the prod api and hosted UI", () => {
    const config = runCloudConfig("spreadsheets.diyaccounting.co.uk");
    expect(config.apiBase).toBe("https://submit.diyaccounting.co.uk/api/v1");
    expect(config.hostedUi).toBe("https://prod-auth.diyaccounting.co.uk");
    expect(config.clientId).toBeNull();
  });

  it("maps every other host to ci, including ci-spreadsheets, localhost and a random test port", () => {
    for (const hostname of ["ci-spreadsheets.diyaccounting.co.uk", "localhost", "127.0.0.1"]) {
      const config = runCloudConfig(hostname);
      expect(config.apiBase).toBe("https://ci-submit.diyaccounting.co.uk/api/v1");
      expect(config.hostedUi).toBe("https://ci-auth.diyaccounting.co.uk");
      expect(config.clientId).toBeNull();
    }
  });

  it("folds a test client id set before it runs into the resolved config, leaving the rest of ci untouched", () => {
    const sandbox = {
      window: {
        DIYA_GL_CLOUD_TEST_CLIENT_ID: "test-books-client",
        location: { hostname: "127.0.0.1", protocol: "http:", search: "", pathname: "/books/bst.html", origin: "http://127.0.0.1" },
      },
    };
    vm.createContext(sandbox);
    vm.runInContext(CONFIG_SRC, sandbox);
    const config = sandbox.window.DIYA_GL_CLOUD_CONFIG;
    expect(config.clientId).toBe("test-books-client");
    expect(config.apiBase).toBe("https://ci-submit.diyaccounting.co.uk/api/v1");
  });
});
