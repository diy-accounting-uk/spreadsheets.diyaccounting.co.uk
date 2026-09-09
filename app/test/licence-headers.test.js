// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// licence-headers.test.js — every comment-capable tracked file carries the
// SPDX identifier for its licensing layer and the company's copyright line.
// The layer follows the same three rules LICENSING.md states: diya-gl/ and
// the packaged engine's import closure (computed by engine-closure.mjs, the
// same module prepack.mjs uses to build the tarball) are Apache-2.0, the
// diya-gl format docs page is CC-BY-4.0, everything else is PolyForm.

import { describe, it, expect } from "vitest";
import { execFileSync } from "child_process";
import { readFileSync } from "fs";
import { basename, extname, resolve, dirname } from "path";
import { fileURLToPath } from "url";

import { engineClosure } from "../../diya-gl/scripts/engine-closure.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");

const APACHE = "Apache-2.0";
const CC_BY = "CC-BY-4.0";
const POLYFORM = "LicenseRef-PolyForm-Internal-Use-1.0.0";

const COPYRIGHT = "Copyright (C) 2006-2026 DIY Accounting Limited";

const CC_BY_PATH = "web/spreadsheets.diyaccounting.co.uk/public/schema/diya-gl-docs.md";

// Directories a header sweep never enters: build artefacts, vendored
// third-party trees, and HMRC material the company does not licence.
const EXCLUDED_PATH_PREFIXES = [
  "packages/",
  "_developers/hmrc-references/",
  "node_modules/",
  "reports/",
  "web/spreadsheets.diyaccounting.co.uk/public/reconciliation/",
];

// Individual files: licence texts themselves, third-party wrapper scripts,
// lock files, and files a build script writes its own header into.
const EXCLUDED_FILES = new Set([
  "mvnw",
  "mvnw.cmd",
  ".mvn/wrapper/maven-wrapper.properties",
  "LICENSE",
  "diya-gl/LICENSE",
  "NOTICE",
  "diya-gl/NOTICE",
  "package-lock.json",
  "diya-gl/package-lock.json",
  "web/spreadsheets.diyaccounting.co.uk/public/diya-gl.html",
  "web/spreadsheets.diyaccounting.co.uk/public/sitemap.xml",
  "web/spreadsheets.diyaccounting.co.uk/public/catalogue.toml",
]);

function isExcluded(path) {
  if (EXCLUDED_FILES.has(path)) return true;
  return EXCLUDED_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function trackedFiles(root) {
  return execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean);
}

function lineStyle(token) {
  return { prefix: `${token} `, suffix: "" };
}

function wrapStyle(open, close) {
  return { prefix: `${open} `, suffix: ` ${close}` };
}

// Which comment style a path takes, or null when the format cannot carry a
// header (the sweep leaves those files alone; LICENSING.md's directory map
// or an emitter attaches the licence for them instead).
function styleFor(path) {
  if (basename(path) === "Dockerfile") return { ...lineStyle("#"), skipShebang: true };
  switch (extname(path)) {
    case ".js":
    case ".mjs":
    case ".cjs":
    case ".java":
      return { ...lineStyle("//"), skipShebang: true };
    case ".sh":
    case ".toml":
    case ".yml":
    case ".yaml":
    case ".properties":
      return { ...lineStyle("#"), skipShebang: true };
    case ".css":
      return wrapStyle("/*", "*/");
    case ".html":
      return { ...wrapStyle("<!--", "-->"), skipDoctype: true };
    case ".svg":
    case ".xml":
      return { ...wrapStyle("<!--", "-->"), skipXmlDecl: true };
    case ".md":
      return { ...wrapStyle("<!--", "-->"), skipFrontMatter: true };
    default:
      return null;
  }
}

// The layer a path belongs to: the engine (Apache-2.0, travels with an
// embedded copy), the format spec's prose (CC-BY-4.0), or the original work
// and the hosted product (PolyForm).
function expectedLayer(path, closureSet) {
  if (path === CC_BY_PATH) return CC_BY;
  if (path.startsWith("diya-gl/")) return APACHE;
  if (path.startsWith("app/data/")) return APACHE;
  if (closureSet.has(path)) return APACHE;
  return POLYFORM;
}

// The two header lines, skipping whatever preamble the format requires
// before a comment can appear: a shebang, an XML declaration, an HTML
// doctype, or a Markdown front-matter block.
function headerLines(absPath, style) {
  const raw = readFileSync(absPath, "utf8").split(/\r?\n/).slice(0, 12);
  let i = 0;
  if (style.skipShebang && raw[0] && raw[0].startsWith("#!")) i = 1;
  if (style.skipXmlDecl && raw[i] && /^<\?xml\b/i.test(raw[i])) i += 1;
  if (style.skipDoctype && raw[i] && /^<!doctype\b/i.test(raw[i])) i += 1;
  if (style.skipFrontMatter && raw[0] === "---") {
    const close = raw.indexOf("---", 1);
    if (close !== -1) i = close + 1;
    while (raw[i] === "") i += 1;
  }
  return [raw[i], raw[i + 1]];
}

function parseSpdxLine(line, style) {
  if (typeof line !== "string") return null;
  if (!line.startsWith(style.prefix) || !line.endsWith(style.suffix)) return null;
  const inner = style.suffix ? line.slice(style.prefix.length, -style.suffix.length) : line.slice(style.prefix.length);
  const match = inner.match(/^SPDX-License-Identifier:\s*(\S+)$/);
  return match ? match[1] : null;
}

describe("licence headers", () => {
  it("every comment-capable tracked file carries its layer's SPDX identifier and the copyright line", () => {
    const closureSet = new Set(engineClosure(ROOT));
    const offenders = [];

    for (const path of trackedFiles(ROOT)) {
      if (isExcluded(path)) continue;
      const style = styleFor(path);
      if (!style) continue;

      const expectedId = expectedLayer(path, closureSet);
      const [spdxLine, copyrightLine] = headerLines(resolve(ROOT, path), style);
      const foundId = parseSpdxLine(spdxLine, style);
      const expectedCopyrightLine = `${style.prefix}${COPYRIGHT}${style.suffix}`;

      if (!foundId) {
        offenders.push(`${path}: missing SPDX-License-Identifier header`);
      } else if (foundId !== expectedId) {
        offenders.push(`${path}: header says ${foundId}, its layer expects ${expectedId}`);
      }
      if (copyrightLine !== expectedCopyrightLine) {
        offenders.push(
          `${path}: copyright line is ${JSON.stringify(copyrightLine ?? null)}, expected ${JSON.stringify(expectedCopyrightLine)}`,
        );
      }
    }

    expect(offenders).toEqual([]);
  });

  it("prepack.mjs ships exactly the closure engine-closure.mjs computes, not a separately maintained list", () => {
    const source = readFileSync(resolve(ROOT, "diya-gl", "scripts", "prepack.mjs"), "utf8");
    expect(source).toContain('from "./engine-closure.mjs"');
    expect(source).toMatch(/\bengineClosure\(/);
  });
});
