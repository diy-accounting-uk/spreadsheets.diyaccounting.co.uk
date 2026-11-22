// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

// web/diya-gl.co.uk/public/company-book.js
//
// "New book from a company" on the Ltd page. The reader types a company name or number, picks a
// match, picks a period, and the page builds the book from what Companies House holds. The
// lookup and the register answer come from DIY Accounting Submit's public routes through
// lib/company-register.js; this page never calls Companies House and holds no shareholders, and
// no date of birth, nationality or address of a person. The shell opens the built book.

(function (global) {
  "use strict";

  function lookupFailureMessage(status) {
    if (status === 404) return "Companies House has no company with that number.";
    if (status === 429) return "Companies House is busy. Try again in a few minutes.";
    return "The company lookup is not available now. You can still start a new book with the form.";
  }

  function registerFailureMessage(status) {
    if (status === 404) return "Companies House has no company with that number.";
    if (status === 413) {
      return "The last filed accounts of this company are too large for this page to read. You can start a new book and type the opening balances.";
    }
    if (status === 429) return "Companies House is busy. Try again in a few minutes.";
    return "The company book is not available now. You can still start a new book with the form.";
  }

  var BUILD_FAILURE_MESSAGE = "The book could not be built from what Companies House holds. You can still start a new book with the form.";

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  /**
   * @param {HTMLElement} root - the empty container the page left for the action
   * @param {Object} options
   * @param {function(Object): Promise} options.openBook - opens the built book (what sniffRegisterBook returns) in the page
   * @param {{companyNumber: string, yearEnd: string|null}|null} options.start - a company a link named
   */
  function mount(root, options) {
    var query = element("input");
    query.type = "text";
    query.id = "company-book-query";
    query.autocomplete = "off";
    var label = element("label", "", "Company name or number");
    label.htmlFor = query.id;
    var field = element("div", "editable-field");
    field.append(label, query);
    var searchButton = element("button", "btn btn-primary", "Find company");
    searchButton.type = "button";
    var search = element("div", "company-book-search");
    search.append(field, searchButton);
    var status = element("p", "company-book-status");
    status.id = "company-book-status";
    status.setAttribute("role", "status");
    var results = element("div");
    root.replaceChildren(search, status, results);

    var latest = 0;

    function say(message, isError) {
      status.textContent = message;
      status.classList.toggle("upload-error", Boolean(isError));
    }

    function mark(className, text) {
      return element("span", "company-book-mark " + className, text);
    }

    function listOf(label) {
      var list = element("ul", "company-book-list");
      list.setAttribute("aria-label", label);
      return list;
    }

    function choice(list, onClick) {
      var item = element("li");
      var button = element("button", "btn company-book-choice");
      button.type = "button";
      button.addEventListener("click", onClick);
      item.append(button);
      list.append(item);
      return button;
    }

    function lookupFailed(error) {
      results.replaceChildren();
      say(lookupFailureMessage(error instanceof CompanyLookupError ? error.status : 0), true);
    }

    function openCompanyBook(companyNumber, yearEnd) {
      var ticket = ++latest;
      say("Asking Companies House through DIY Accounting Submit...");
      fetchCompanyRegister(companyNumber)
        .catch(function (error) {
          throw new Error(registerFailureMessage(error instanceof RegisterCallError ? error.status : 0));
        })
        .then(function (answer) {
          if (ticket !== latest) return null;
          say("Building the book...");
          return global.DiyaGlLoader.sniffRegisterBook(answer, yearEnd).catch(function (error) {
            throw new Error(error && error.name === "RegisterBookError" ? error.message : BUILD_FAILURE_MESSAGE);
          });
        })
        .then(function (sniffed) {
          if (!sniffed || ticket !== latest) return null;
          return options.openBook(sniffed).then(function (snapshot) {
            if (!snapshot && ticket === latest) say("The book could not be opened. The reason is shown below.", true);
          });
        })
        .catch(function (error) {
          if (ticket === latest) say(error.message, true);
        });
    }

    function showPeriods(answer) {
      results.replaceChildren();
      var periods = unfiledPeriods(answer, new Date().toISOString().slice(0, 10));
      results.append(element("h3", "", answer.companyName + " (" + answer.companyNumber + ")"));
      if (periods.length === 0) {
        say("Companies House holds no unfiled accounts period for " + answer.companyName + ".");
        return;
      }
      var list = listOf("Periods with accounts not yet filed");
      periods.forEach(function (period) {
        var button = choice(list, function () {
          openCompanyBook(answer.companyNumber, period.end);
        });
        button.append(element("span", "", periodWords(period)));
        if (period.overdue) button.append(mark("company-book-mark-overdue", "Overdue"));
        if (period.computed) button.append(mark("", "Computed as the twelve months after the period before"));
      });
      results.append(list);
      say("Choose a period to open its book.");
    }

    function lookUpNumber(companyNumber, name) {
      var ticket = ++latest;
      say("Looking up " + (name || companyNumber) + "...");
      fetchCompanyDeadlines("number", companyNumber).then(
        function (answer) {
          if (ticket === latest) showPeriods(answer);
        },
        function (error) {
          if (ticket === latest) lookupFailed(error);
        },
      );
    }

    function showMatches(items) {
      results.replaceChildren();
      if (!items || items.length === 0) {
        say("No company matches that name or number.");
        return;
      }
      var list = listOf("Matching companies");
      items.forEach(function (match) {
        var button = choice(list, function () {
          lookUpNumber(match.companyNumber, match.companyName);
        });
        button.textContent = match.companyName + " (" + match.companyNumber + (match.companyStatus ? ", " + match.companyStatus : "") + ")";
      });
      results.append(list);
      say(items.length + (items.length === 1 ? " company matches." : " companies match.") + " Choose one.");
    }

    function runSearch() {
      var text = query.value.trim();
      if (text.length < COMPANY_MIN_QUERY_LENGTH) {
        results.replaceChildren();
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
          if (ticket === latest) lookupFailed(error);
        },
      );
    }

    searchButton.addEventListener("click", runSearch);
    query.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        runSearch();
      }
    });

    if (options.start) {
      query.value = options.start.companyNumber;
      if (options.start.yearEnd) openCompanyBook(options.start.companyNumber, options.start.yearEnd);
      else lookUpNumber(options.start.companyNumber);
    } else {
      query.focus();
    }
  }

  global.DiyaGlCompanyBook = { mount: mount };
})(window);
