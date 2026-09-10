// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import { webcrypto } from "node:crypto";

// cloud-config.js and cloud.js are classic browser scripts (no
// import/export) loaded via <script src> on the four books pages, so each
// publishes its result on window. Run them in a sandbox the same way a
// browser would, providing only the globals a browser actually carries.
const CONFIG_SRC = readFileSync(resolve(process.cwd(), "web/spreadsheets.diyaccounting.co.uk/public/diya-gl/cloud-config.js"), "utf8");
const CLOUD_SRC = readFileSync(resolve(process.cwd(), "web/spreadsheets.diyaccounting.co.uk/public/diya-gl/cloud.js"), "utf8");

function runCloudConfig(hostname) {
  const sandbox = {
    window: {
      location: { hostname: hostname, protocol: "https:", search: "", pathname: "/diya-gl/bst.html", origin: "https://" + hostname },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(CONFIG_SRC, sandbox);
  return sandbox.window.DIYA_GL_CLOUD_CONFIG;
}

describe("cloud-config.js", () => {
  it("resolves to Submit's prod api and hosted UI on the prod host, the ci host and localhost", () => {
    for (const hostname of ["spreadsheets.diyaccounting.co.uk", "ci-spreadsheets.diyaccounting.co.uk", "localhost", "127.0.0.1"]) {
      const config = runCloudConfig(hostname);
      expect(config.apiBase).toBe("https://submit.diyaccounting.co.uk/api/v1");
      expect(config.hostedUi).toBe("https://prod-auth.diyaccounting.co.uk");
      expect(config.clientId).toBe("1c8hjrjp5g5ipm8o47t6qkks4r");
    }
  });

  it("folds a test client id set before it runs into the resolved config, leaving the rest untouched", () => {
    const sandbox = {
      window: {
        DIYA_GL_CLOUD_TEST_CLIENT_ID: "test-diya-gl-client",
        location: { hostname: "127.0.0.1", protocol: "http:", search: "", pathname: "/diya-gl/bst.html", origin: "http://127.0.0.1" },
      },
    };
    vm.createContext(sandbox);
    vm.runInContext(CONFIG_SRC, sandbox);
    const config = sandbox.window.DIYA_GL_CLOUD_CONFIG;
    expect(config.clientId).toBe("test-diya-gl-client");
    expect(config.apiBase).toBe("https://submit.diyaccounting.co.uk/api/v1");
  });
});

// cloud.js's PKCE helpers, run with a real SHA-256 (node:crypto's webcrypto
// implements the same SubtleCrypto interface a browser does) but plain
// stand-ins for btoa/atob and location/history, which cloud.js also touches
// at eval time (the OAuth-return URL cleanup) before this file's own exports
// are read back.
function runCloudJs() {
  const sandbox = {
    window: {
      location: { hostname: "127.0.0.1", protocol: "https:", origin: "https://127.0.0.1", pathname: "/diya-gl/bst.html", search: "" },
      history: { replaceState: () => {} },
      crypto: webcrypto,
      btoa: (binary) => Buffer.from(binary, "binary").toString("base64"),
      atob: (base64) => Buffer.from(base64, "base64").toString("binary"),
    },
    TextEncoder,
    URLSearchParams,
  };
  vm.createContext(sandbox);
  vm.runInContext(CLOUD_SRC, sandbox);
  return sandbox.window.DiyaGlCloud;
}

describe("cloud.js's PKCE helpers", () => {
  it("generates a base64url verifier inside RFC 7636's 43-to-128 length range, differing each call", () => {
    const cloud = runCloudJs();
    const first = cloud.randomUrlSafe(64);
    const second = cloud.randomUrlSafe(64);
    expect(first).not.toBe(second);
    for (const verifier of [first, second]) {
      expect(verifier.length).toBeGreaterThanOrEqual(43);
      expect(verifier.length).toBeLessThanOrEqual(128);
      expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it("reproduces RFC 7636 Appendix B.1's known S256 challenge as unpadded base64url", async () => {
    const cloud = runCloudJs();
    const challenge = await cloud.challengeFor("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk");
    expect(challenge).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
});
