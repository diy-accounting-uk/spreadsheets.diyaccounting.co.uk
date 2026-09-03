// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// web/browser-tests/serve.js
//
// One static server for every books browser spec, serving production's own
// security headers so a bundle that only passes under a permissive test
// server can't reach CI. The header values come from
// infra/main/resources/security-headers.json, the same file
// SpreadsheetsStack.java reads when it builds the CloudFront response
// headers policy -- one source, read at synth time and at test time.

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SECURITY_HEADERS_PATH = path.join(__dirname, "../../infra/main/resources/security-headers.json");

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".toml": "text/plain; charset=utf-8",
  ".jsonl": "text/plain; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function readSecurityHeaders() {
  const config = JSON.parse(fs.readFileSync(SECURITY_HEADERS_PATH, "utf-8"));
  const headers = {
    "Content-Security-Policy": config.contentSecurityPolicy,
    "Strict-Transport-Security": `max-age=${config.strictTransportSecurityMaxAgeSeconds}${config.strictTransportSecurityIncludeSubdomains ? "; includeSubDomains" : ""}`,
    "X-Frame-Options": config.frameOption,
    "Referrer-Policy": config.referrerPolicy,
    ...config.customHeaders,
  };
  if (config.contentTypeOptionsNosniff) headers["X-Content-Type-Options"] = "nosniff";
  if (config.xssProtection) headers["X-XSS-Protection"] = `1${config.xssProtectionModeBlock ? "; mode=block" : ""}`;
  return headers;
}

// Starts a static file server over rootDir with production's security
// headers set on every response. Returns { baseUrl, close } -- close tears
// the server down and resolves once it's fully stopped.
export function startStaticServer(rootDir) {
  const securityHeaders = readSecurityHeaders();
  const server = http.createServer((req, res) => {
    const requested = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const filePath = path.join(rootDir, requested);
    for (const [name, value] of Object.entries(securityHeaders)) {
      res.setHeader(name, value);
    }
    if (!filePath.startsWith(rootDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404).end("not found");
      return;
    }
    res.writeHead(200, { "content-type": CONTENT_TYPES[path.extname(filePath)] || "application/octet-stream" });
    res.end(fs.readFileSync(filePath));
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve({
        baseUrl,
        close: () => new Promise((resolveClose) => server.close(resolveClose)),
      });
    });
  });
}
