#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// view.js — open a book in the full diya-gl pages, served on 127.0.0.1 by a
// caching proxy that fetches each page file from diya-gl.co.uk on first use.
//
// Usage:
//   node app/bin/view.js examples/basic-taxi-driver
//   node app/bin/view.js my-book-diya-gl.zip --port 8080 --no-open
//
// The book is any source link.js reads: a directory holding book.toml and
// lines.jsonl, or a diya-gl zip, JSON or workbook file. The server stays up
// until Ctrl-C. Fetched files are cached under the system temporary directory,
// one directory per package version and origin host.

import { spawn } from "child_process";
import { existsSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { readBookFragment } from "./link.js";
import { FRAGMENT_KEY } from "../lib/diya-gl-link.js";
import { DEFAULT_ORIGIN, startViewServer } from "../lib/diya-gl-view-server.js";

const USAGE =
  "Usage: diya-gl view <book directory | diya-gl zip | diya-gl JSON file | workbook> [--port <number>] [--origin <url>] [--no-open]";

// The nearest package.json above this file: the package's own in dist/, the
// repository's in a checkout. Both carry the version the cache is keyed on.
function packageVersion() {
  let directory = dirname(fileURLToPath(import.meta.url));
  for (;;) {
    const candidate = join(directory, "package.json");
    if (existsSync(candidate)) return JSON.parse(readFileSync(candidate, "utf8")).version;
    const parent = dirname(directory);
    if (parent === directory) throw new Error("No package.json found above " + import.meta.url);
    directory = parent;
  }
}

function parseArgs(argv) {
  const args = argv.slice(2);
  let port = 0;
  let origin = DEFAULT_ORIGIN;
  let open = true;
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--port") {
      const value = args[++i];
      port = Number(value);
      if (!Number.isInteger(port) || port < 0 || port > 65535)
        throw new Error(`--port needs a number from 0 to 65535, got "${value}". ${USAGE}`);
    } else if (args[i] === "--origin") {
      origin = args[++i];
      let parsed;
      try {
        parsed = new URL(origin);
      } catch {
        throw new Error(`--origin needs an http or https URL, got "${origin}". ${USAGE}`);
      }
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
        throw new Error(`--origin needs an http or https URL, got "${origin}". ${USAGE}`);
    } else if (args[i] === "--no-open") {
      open = false;
    } else {
      positional.push(args[i]);
    }
  }
  if (positional.length !== 1) throw new Error(USAGE);
  return { source: positional[0], port, origin, open };
}

function openInBrowser(url) {
  const [command, args] =
    process.platform === "darwin"
      ? ["open", [url]]
      : process.platform === "win32"
        ? ["cmd", ["/c", "start", "", url]]
        : ["xdg-open", [url]];
  const child = spawn(command, args, { stdio: "ignore", detached: true });
  child.on("error", (error) => console.error(`Could not open a browser (${error.message}). Open the address above.`));
  child.unref();
}

async function main() {
  const { source, port, origin, open } = parseArgs(process.argv);
  const { product, fragment, length, warning } = await readBookFragment(source);
  const cacheDir = join(tmpdir(), "diya-gl-view", packageVersion(), new URL(origin).host.replace(/[^A-Za-z0-9.-]/g, "_"));
  const running = await startViewServer({ cacheDir, origin, port });
  const url = `http://${running.host}:${running.port}/${product}.html#${FRAGMENT_KEY}=${fragment}`;
  console.log(url);
  console.error(`Fragment length: ${length} characters`);
  if (warning) console.error(`Warning: ${warning}`);
  console.error(`Fetching pages from ${running.origin} on first use.`);
  console.error(`Cache directory: ${running.cacheDir}`);
  console.error("Serving on 127.0.0.1 until you press Ctrl-C.");
  if (open) openInBrowser(url);

  process.on("SIGINT", () => {
    running.close().then(() => process.exit(0));
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
