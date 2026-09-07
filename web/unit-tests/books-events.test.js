// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2025-2026 DIY Accounting Ltd

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

// books-events.js is a classic browser script (no import/export) loaded via
// <script src="books-events.js"> on the four books pages, so it publishes
// its builders on `window`. Run it in a sandbox and read them back off that
// global, the same way a browser would.
let buildBookLoadedEvent;
let buildBookSavedEvent;
let buildDonationPromptEvent;

beforeAll(() => {
  const src = readFileSync(resolve(process.cwd(), "web/spreadsheets.diyaccounting.co.uk/public/books/books-events.js"), "utf8");
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  buildBookLoadedEvent = sandbox.window.buildBookLoadedEvent;
  buildBookSavedEvent = sandbox.window.buildBookSavedEvent;
  buildDonationPromptEvent = sandbox.window.buildDonationPromptEvent;
});

describe("buildBookLoadedEvent", () => {
  it("names the event book_loaded and carries the product", () => {
    const event = buildBookLoadedEvent("bst", "example");
    expect(event.name).toBe("book_loaded");
    expect(event.params.product).toBe("bst");
  });

  it("keeps an example, a new book and a plain JSON source as they arrive", () => {
    expect(buildBookLoadedEvent("bst", "example").params.source).toBe("example");
    expect(buildBookLoadedEvent("ltd", "new").params.source).toBe("new");
    expect(buildBookLoadedEvent("se", "json").params.source).toBe("json");
  });

  it("collapses a workbook, a package zip and a package set to xlsx", () => {
    expect(buildBookLoadedEvent("bst", "workbook").params.source).toBe("xlsx");
    expect(buildBookLoadedEvent("se", "package-zip").params.source).toBe("xlsx");
    expect(buildBookLoadedEvent("ltd", "package-set").params.source).toBe("xlsx");
  });

  it("collapses a diya-gl zip and a zipped diya-gl JSON to zip", () => {
    expect(buildBookLoadedEvent("bst", "diya-gl-zip").params.source).toBe("zip");
    expect(buildBookLoadedEvent("bst", "json-zip").params.source).toBe("zip");
  });
});

describe("buildBookSavedEvent", () => {
  it("names the event book_saved and carries the product and format", () => {
    const event = buildBookSavedEvent("taxi", "diya-gl-zip");
    expect(event.name).toBe("book_saved");
    expect(event.params).toEqual({ product: "taxi", format: "diya-gl-zip" });
  });
});

describe("buildDonationPromptEvent", () => {
  it("carries the prompt id and the shown action", () => {
    const event = buildDonationPromptEvent("figures", "shown");
    expect(event.name).toBe("donation_prompt");
    expect(event.params).toEqual({ prompt: "figures", action: "shown" });
  });

  it("carries the prompt id and the followed action", () => {
    const event = buildDonationPromptEvent("save", "followed");
    expect(event.params).toEqual({ prompt: "save", action: "followed" });
  });
});
