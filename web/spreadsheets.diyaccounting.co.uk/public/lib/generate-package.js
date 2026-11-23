// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

// The Generate option beside the company lookup on the download page. For the company and the
// year end the reader chose, the page asks DIY Accounting Submit's public register route for
// what Companies House holds, builds the Company package in the browser and offers the zip.
// The engine and the Company templates load only when the reader chooses Generate. This page
// never calls Companies House, and it copies from the answer only the fields the package uses:
// the company, the registered office, the officers' names, roles and appointment dates, and the
// last filed accounts.

var GENERATE_ENGINE_URL = "/generate/engine/diya-gl-engine.js";
var GENERATE_ASSET_ROOT = "/generate/assets";
var GENERATE_SCHEMA_ROOT = "/schema";
var GENERATE_LOAD_SIZE = "about 5 MB";

function GenerateError(message) {
  this.message = message;
}

function registerFailureMessage(status) {
  if (status === 404) return "Companies House has no company with that number.";
  if (status === 413) {
    return "The last filed accounts of this company are too large for this page to read. Download the package for the year end from the list instead.";
  }
  if (status === 429) return "Companies House is busy. Try again in a few minutes. You can still download a package from the list.";
  return "The package builder is not available now. You can still download a package from the list.";
}

function notTwelveMonthsMessage(start, end) {
  return (
    "No package is built for the period " +
    formatIsoDate(start) +
    " to " +
    formatIsoDate(end) +
    ". A package holds twelve monthly sheets, a year of payroll and a year of tax rates, so it needs twelve whole months, from the first of a month. " +
    "Choose a year end from the list for a package of twelve months, or open a book for this period in DIYA-GL."
  );
}

// A resource loader for the engine: the Company data and templates under the site's own folder.
function generateResourceLoader() {
  function urlFor(path) {
    return path.indexOf("schema/") === 0 ? GENERATE_SCHEMA_ROOT + "/" + path.slice("schema/".length) : GENERATE_ASSET_ROOT + "/" + path;
  }
  function get(path) {
    return fetch(urlFor(path)).then(function (response) {
      if (!response.ok) throw new Error('cannot read resource "' + path + '": ' + urlFor(path) + " returned " + response.status);
      return response;
    });
  }
  return {
    readText: function (path) {
      return get(path).then(function (response) {
        return response.text();
      });
    },
    readBinary: function (path) {
      return get(path)
        .then(function (response) {
          return response.arrayBuffer();
        })
        .then(function (buffer) {
          return new Uint8Array(buffer);
        });
    },
  };
}

// The reader's company and year end to a built package, or to the reason there is none.
// Resolves to { kind: "package", zip, filename, book, lastAccounts, differences }
// or { kind: "no-package", message } and rejects with a GenerateError.
function generatePackageFromRegister(companyNumber, yearEnd, say) {
  var answer;
  var engine;
  var resources = generateResourceLoader();
  say("Asking Companies House through DIY Accounting Submit...");
  return fetchCompanyRegister(companyNumber)
    .catch(function (error) {
      throw new GenerateError(registerFailureMessage(error instanceof RegisterCallError ? error.status : 0));
    })
    .then(function (found) {
      answer = found;
    })
    .then(function () {
      say("Loading the package builder (" + GENERATE_LOAD_SIZE + ", once)...");
      return import(GENERATE_ENGINE_URL).catch(function () {
        throw new GenerateError(registerFailureMessage(0));
      });
    })
    .then(function (loaded) {
      engine = loaded;
      return engine.loadSchemasFrom(resources);
    })
    .then(function () {
      say("Building the package...");
      return buildBookFromRegisterAnswer(engine, answer, yearEnd, resources).then(function (built) {
        var start = built.result.book.documentInfo.periodCoveredStart;
        var end = built.result.book.documentInfo.periodCoveredEnd;
        if (!engine.isTwelveWholeMonths(start, end)) {
          return { kind: "no-package", message: notTwelveMonthsMessage(start, end), companyNumber: companyNumber, yearEnd: yearEnd };
        }
        return engine.savePackageZip(built.result.book, built.result.lines, { resources: resources }).then(function (saved) {
          return {
            kind: "package",
            zip: saved.zip,
            filename: saved.filename,
            book: built.result.book,
            lastAccounts: built.lastAccounts,
            filed: built.filed,
            unreadable: built.unreadable,
            differences: built.result.differences,
          };
        });
      });
    })
    .catch(function (error) {
      if (error instanceof GenerateError) throw error;
      if (error && error.name === "RegisterBookError") throw new GenerateError(error.message);
      throw new GenerateError(
        "The package could not be built from what Companies House holds. You can still download a package from the list.",
      );
    });
}

// The lines that say what the package holds, each from the answer and the book.
function packageContents(result) {
  var lines = [];
  var book = result.book;
  lines.push("Company name, number and registered office, from Companies House.");
  var officers = (book.directors || []).length;
  lines.push(
    officers > 0
      ? "Directors and secretary: " + officers + ", in Companysecretary.xlsx."
      : "Directors and secretary: none on the register, so Companysecretary.xlsx names none.",
  );
  if (result.lastAccounts) {
    lines.push(
      "Opening balance sheet on the OpenAccounts sheet, from the accounts filed for the year ended " +
        formatIsoDate(result.lastAccounts.period.end) +
        ".",
    );
  } else if (result.unreadable) {
    lines.push("No opening balance sheet. The last filed accounts could not be read: " + result.unreadable);
  } else if (result.filed.status === "pdf") {
    lines.push(
      "No opening balance sheet. The accounts last filed, for the year ended " +
        formatIsoDate(result.filed.madeUpDate) +
        ", are a PDF, which holds no figures this page can read.",
    );
  } else {
    lines.push("No opening balance sheet. Companies House holds no accounts figures for this company.");
  }
  lines.push("Register of members: left for you. The public Companies House data lists no shareholders.");
  return lines;
}

// The builder's differences in plain words. The members' difference is said once, in the contents.
function packageDifferences(result) {
  return result.differences
    .filter(function (difference) {
      return difference.code !== "no-members";
    })
    .map(function (difference) {
      return difference.text;
    });
}

function initGeneratePackage() {
  var box = document.getElementById("company-generate");
  var prompt = document.getElementById("company-generate-prompt");
  var button = document.getElementById("company-generate-btn");
  var status = document.getElementById("company-generate-status");
  var resultBox = document.getElementById("company-generate-result");
  var chosen = null;
  var objectUrl = null;

  function say(message) {
    status.textContent = message;
  }

  function clearResult() {
    resultBox.replaceChildren();
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  }

  function list(label, items) {
    var heading = document.createElement("h4");
    heading.textContent = label;
    var element = document.createElement("ul");
    element.className = "generate-list";
    items.forEach(function (text) {
      var item = document.createElement("li");
      item.textContent = text;
      element.append(item);
    });
    resultBox.append(heading, element);
  }

  function showBookLink(result) {
    var link = document.createElement("a");
    link.id = "company-generate-book-link";
    link.href = newBookFromCompanyLink(window.location.hostname, result.companyNumber, result.yearEnd);
    link.textContent = "Open a DIYA-GL book for this period";
    status.append(" ", link);
  }

  function showPackage(result) {
    objectUrl = URL.createObjectURL(new Blob([result.zip], { type: "application/zip" }));
    var link = document.createElement("a");
    link.id = "company-generate-download";
    link.className = "btn-download btn-primary";
    link.href = objectUrl;
    link.download = result.filename;
    link.textContent = "Download " + result.filename;
    resultBox.append(link);
    list("What is in the package", packageContents(result));
    var differences = packageDifferences(result);
    if (differences.length > 0) list("Check these before you rely on the package", differences);
  }

  function choose(company, yearEnd) {
    clearResult();
    say("");
    chosen = company ? { number: company.companyNumber, name: company.companyName, yearEnd: yearEnd } : null;
    box.classList.toggle("hidden", !chosen);
    if (chosen) {
      prompt.textContent =
        "Generate a package for " +
        chosen.name +
        ", year ended " +
        formatIsoDate(chosen.yearEnd) +
        ", filled in from what Companies House holds. The page loads the package builder (" +
        GENERATE_LOAD_SIZE +
        ") when you choose Generate.";
    }
  }

  button.addEventListener("click", function () {
    if (!chosen) return;
    var request = chosen;
    clearResult();
    button.disabled = true;
    generatePackageFromRegister(request.number, request.yearEnd, say).then(
      function (result) {
        button.disabled = false;
        if (chosen !== request) return;
        if (result.kind === "no-package") {
          say(result.message);
          showBookLink(result);
          return;
        }
        say("The package is ready.");
        showPackage(result);
      },
      function (error) {
        button.disabled = false;
        if (chosen === request) say(error.message);
      },
    );
  });

  return { choose: choose };
}
