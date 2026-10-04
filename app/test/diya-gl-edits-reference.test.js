// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// setLineReference: one line's documentReference set in place, directly and
// through the MCP edit_lines tool.

import { describe, it, expect } from "vitest";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { loadDiyaGlData } from "../lib/diya-gl-loader.js";
import { setLineReference } from "../lib/diya-gl-edits.js";
import { createMethods } from "../lib/mcp/server.js";
import { createSession, loadIntoSession } from "../lib/mcp/diya-gl-tools.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const { book, lines } = loadDiyaGlData(resolve(ROOT, "examples", "precision-code-ltd", "bst"));
const SALE = lines.find((line) => line.sourceJournalID === "sales" && line.documentReference);
const UNREFERENCED = lines.find((line) => line.documentReference === undefined);

describe("setLineReference", () => {
  it("sets the reference and leaves every other field and the line's position unchanged", () => {
    const edited = setLineReference(book, lines, { entryNumber: SALE.entryNumber, documentReference: "INV-NEW-1" });
    const index = lines.indexOf(SALE);
    expect(edited[index]).toEqual({ ...SALE, documentReference: "INV-NEW-1" });
    expect(edited.filter((_, i) => i !== index)).toEqual(lines.filter((_, i) => i !== index));
    expect(SALE.documentReference).not.toBe("INV-NEW-1");
  });

  it("adds a reference to a line that had none", () => {
    const edited = setLineReference(book, lines, { entryNumber: UNREFERENCED.entryNumber, documentReference: "RCPT-7" });
    expect(edited[lines.indexOf(UNREFERENCED)]).toEqual({ ...UNREFERENCED, documentReference: "RCPT-7" });
  });

  it("throws for an entry number no line carries", () => {
    expect(() => setLineReference(book, lines, { entryNumber: "TXN-9999", documentReference: "x" })).toThrow(
      "No line carries entryNumber TXN-9999",
    );
  });

  it("is a named edit of the MCP edit_lines tool", async () => {
    const session = createSession();
    loadIntoSession(session, book, lines);
    const methods = createMethods(session);
    const { tools } = await methods["tools/list"]();
    expect(tools.find((tool) => tool.name === "edit_lines").inputSchema.properties.edits.items.properties.edit.enum).toContain(
      "setLineReference",
    );
    const response = await methods["tools/call"]({
      name: "edit_lines",
      arguments: { edits: [{ edit: "setLineReference", params: { entryNumber: SALE.entryNumber, documentReference: "INV-NEW-2" } }] },
    });
    const result = response.structuredContent;
    expect(result.lines.map((line) => line.entryNumber)).toEqual(lines.map((line) => line.entryNumber));
    expect(result.lines.find((line) => line.entryNumber === SALE.entryNumber).documentReference).toBe("INV-NEW-2");
    expect(result.movedFigures).toEqual([]);
  });
});
