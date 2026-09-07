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
let buildCloudSignInEvent;
let buildCloudSaveEvent;
let buildCloudConflictEvent;

beforeAll(() => {
  const src = readFileSync(resolve(process.cwd(), "web/spreadsheets.diyaccounting.co.uk/public/books/books-events.js"), "utf8");
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  buildBookLoadedEvent = sandbox.window.buildBookLoadedEvent;
  buildBookSavedEvent = sandbox.window.buildBookSavedEvent;
  buildDonationPromptEvent = sandbox.window.buildDonationPromptEvent;
  buildCloudSignInEvent = sandbox.window.buildCloudSignInEvent;
  buildCloudSaveEvent = sandbox.window.buildCloudSaveEvent;
  buildCloudConflictEvent = sandbox.window.buildCloudConflictEvent;
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

describe("buildCloudSignInEvent", () => {
  it("names the event cloud_sign_in and carries the step", () => {
    expect(buildCloudSignInEvent("started")).toEqual({ name: "cloud_sign_in", params: { step: "started" } });
    expect(buildCloudSignInEvent("returned")).toEqual({ name: "cloud_sign_in", params: { step: "returned" } });
    expect(buildCloudSignInEvent("failed")).toEqual({ name: "cloud_sign_in", params: { step: "failed" } });
  });
});

describe("buildCloudSaveEvent", () => {
  it("names the event cloud_save and carries the product and the outcome", () => {
    expect(buildCloudSaveEvent("ltd", "created")).toEqual({ name: "cloud_save", params: { product: "ltd", outcome: "created" } });
    expect(buildCloudSaveEvent("bst", "updated")).toEqual({ name: "cloud_save", params: { product: "bst", outcome: "updated" } });
    expect(buildCloudSaveEvent("se", "conflict")).toEqual({ name: "cloud_save", params: { product: "se", outcome: "conflict" } });
    expect(buildCloudSaveEvent("taxi", "unentitled")).toEqual({ name: "cloud_save", params: { product: "taxi", outcome: "unentitled" } });
    expect(buildCloudSaveEvent("bst", "failed")).toEqual({ name: "cloud_save", params: { product: "bst", outcome: "failed" } });
  });
});

describe("buildCloudConflictEvent", () => {
  it("names the event cloud_conflict and carries the resolution", () => {
    expect(buildCloudConflictEvent("shown")).toEqual({ name: "cloud_conflict", params: { resolution: "shown" } });
    expect(buildCloudConflictEvent("new-book")).toEqual({ name: "cloud_conflict", params: { resolution: "new-book" } });
    expect(buildCloudConflictEvent("reloaded")).toEqual({ name: "cloud_conflict", params: { resolution: "reloaded" } });
    expect(buildCloudConflictEvent("cancelled")).toEqual({ name: "cloud_conflict", params: { resolution: "cancelled" } });
  });
});
