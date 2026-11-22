// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

// The company lookup beside the year-end list on the download page. The reader types a company
// name or number, picks a match, and sees the periods that have no accounts filed. Choosing a
// period selects its year end in the list. The answer comes from DIY Accounting Submit's public
// company-deadlines route; this page never calls Companies House.

// The index in the product's period list of the package for this year end, or -1.
function packageIndexForYearEnd(productPeriods, yearEnd) {
  for (var i = 0; i < (productPeriods || []).length; i++) {
    if (productPeriods[i].date === yearEnd) return i;
  }
  return -1;
}

function lookupFailureMessage(status) {
  if (status === 429) return "Companies House is busy. Try again in a few minutes. You can still choose a year end from the list.";
  return "The company lookup is not available now. You can still choose a year end from the list.";
}

// Wires the lookup. getProductPeriods returns the packages of the selected product;
// selectPackage takes an index into that list and selects it in the year-end list;
// periodChosen takes the company and the year end the reader chose, or null when the results go.
function initCompanyLookup(getProductPeriods, selectPackage, periodChosen) {
  var query = document.getElementById("company-query");
  var searchButton = document.getElementById("company-search-btn");
  var status = document.getElementById("company-status");
  var matches = document.getElementById("company-matches");
  var periodsBox = document.getElementById("company-periods");
  var latest = 0;

  function say(message) {
    status.textContent = message;
  }

  function clearResults() {
    matches.replaceChildren();
    periodsBox.replaceChildren();
    periodChosen(null);
  }

  function fail(error) {
    clearResults();
    say(lookupFailureMessage(error instanceof CompanyLookupError ? error.status : 0));
  }

  function showPeriods(answer) {
    clearResults();
    var periods = unfiledPeriods(answer, new Date().toISOString().slice(0, 10));
    var heading = document.createElement("h3");
    heading.textContent = answer.companyName + " (" + answer.companyNumber + ")";
    periodsBox.append(heading);
    if (periods.length === 0) {
      say("Companies House holds no unfiled accounts period for " + answer.companyName + ". Choose a year end from the list.");
      return;
    }
    var list = document.createElement("ul");
    list.className = "company-list";
    list.setAttribute("aria-label", "Periods with accounts not yet filed");
    periods.forEach(function (period) {
      var packageIndex = packageIndexForYearEnd(getProductPeriods(), period.end);
      var item = document.createElement("li");
      var button = document.createElement("button");
      button.type = "button";
      button.className = "company-choice";
      var words = document.createElement("span");
      words.textContent = periodWords(period);
      button.append(words);
      if (period.overdue) button.append(mark("company-mark company-mark-overdue", "Overdue"));
      if (period.computed) button.append(mark("company-mark", "Computed as the twelve months after the period before"));
      var packageMark = packageIndex >= 0 ? "Package ready to download" : "No package built yet";
      button.append(mark("company-mark " + (packageIndex >= 0 ? "company-mark-ready" : "company-mark-none"), packageMark));
      button.addEventListener("click", function () {
        if (packageIndex >= 0) selectPackage(packageIndex);
        periodChosen(answer, period.end);
        say(
          "Year end " +
            formatIsoDate(period.end) +
            ". " +
            (packageIndex >= 0
              ? "Selected in the year-end list. A package is ready to download."
              : "No package is built for this year end yet."),
        );
      });
      item.append(button);
      list.append(item);
    });
    periodsBox.append(list);
    say("Choose a period to select its year end.");
  }

  function showMatches(items) {
    clearResults();
    if (!items || items.length === 0) {
      say("No company matches that name or number.");
      return;
    }
    var list = document.createElement("ul");
    list.className = "company-list";
    list.setAttribute("aria-label", "Matching companies");
    items.forEach(function (match) {
      var item = document.createElement("li");
      var button = document.createElement("button");
      button.type = "button";
      button.className = "company-choice";
      button.textContent = match.companyName + " (" + match.companyNumber + (match.companyStatus ? ", " + match.companyStatus : "") + ")";
      button.addEventListener("click", function () {
        var ticket = ++latest;
        say("Looking up " + match.companyName + "...");
        fetchCompanyDeadlines("number", match.companyNumber).then(
          function (answer) {
            if (ticket === latest) showPeriods(answer);
          },
          function (error) {
            if (ticket === latest) fail(error);
          },
        );
      });
      item.append(button);
      list.append(item);
    });
    matches.append(list);
    say(items.length + (items.length === 1 ? " company matches." : " companies match.") + " Choose one.");
  }

  function search() {
    var text = query.value.trim();
    if (text.length < COMPANY_MIN_QUERY_LENGTH) {
      clearResults();
      say("Type at least " + COMPANY_MIN_QUERY_LENGTH + " characters of the company name or number.");
      return;
    }
    var ticket = ++latest;
    say("Searching...");
    fetchCompanyDeadlines("q", text).then(
      function (answer) {
        if (ticket === latest) showMatches(answer.items);
      },
      function (error) {
        if (ticket === latest) fail(error);
      },
    );
  }

  function mark(className, text) {
    var element = document.createElement("span");
    element.className = className;
    element.textContent = text;
    return element;
  }

  searchButton.addEventListener("click", search);
  query.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      search();
    }
  });
}
