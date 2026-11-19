// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// vitest-error-reporter.mjs -- a vitest reporter that prints the errors the
// tap-flat reporter hides: a failed beforeAll or afterAll hook, a file that
// fails to import, and an unhandled error. tap-flat shows the tests of such
// a file as skipped and never prints the cause, while vitest still exits 1.
// The router runs this reporter beside tap-flat. It prints nothing on a pass.

const STACK_LINES = 5;

export function formatError(error) {
  const message = error?.stack || error?.message || String(error);
  return message
    .split("\n")
    .slice(0, STACK_LINES)
    .map((line) => `    ${line}`)
    .join("\n");
}

export function collectErrors(testModules, unhandledErrors) {
  const found = [];
  for (const mod of testModules) {
    for (const error of mod.errors?.() ?? []) found.push({ where: mod.moduleId, kind: "file-level error (hook or import)", error });
  }
  for (const error of unhandledErrors ?? []) found.push({ where: "outside any test", kind: "unhandled error", error });
  return found;
}

export default class ErrorOnlyReporter {
  onTestRunEnd(testModules, unhandledErrors) {
    const found = collectErrors(testModules, unhandledErrors);
    if (!found.length) return;
    const lines = [`# vitest reported ${found.length} error(s) outside any test; tap-flat shows these tests as ok # SKIP`];
    for (const { where, kind, error } of found) {
      lines.push(`# ${kind}: ${where}`, formatError(error));
    }
    console.error(lines.join("\n"));
  }
}
