// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// books/autosave.js
//
// The working book's only persistence: an IndexedDB record of { book, lines,
// source, savedAt } written on every state commit (a workbook loads, an
// example loads, a new book is created). Nothing here ever leaves the
// browser -- no fetch, no network call -- this is the client-side half of
// the no-upload promise, not an exception to it.
//
// Every call is wrapped so a blocked, disabled or missing IndexedDB (private
// browsing, a locked-down browser policy, a corrupt store) degrades to
// no-autosave: save/load/clear all resolve to a safe empty value instead of
// throwing, so the page works the same with or without a working store --
// autosave is a convenience, never a dependency the page can break on.

(function (global) {
  "use strict";

  var DB_NAME = "diya-books-autosave";
  var DB_VERSION = 1;
  var STORE_NAME = "workingBook";
  var RECORD_KEY = "current";
  var OPEN_TIMEOUT_MS = 2000;

  var dbPromise = null;

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve) {
      if (!global.indexedDB) {
        resolve(null);
        return;
      }
      var settled = false;
      function finish(db) {
        if (settled) return;
        settled = true;
        resolve(db);
      }
      var timer = global.setTimeout(function () {
        finish(null);
      }, OPEN_TIMEOUT_MS);
      try {
        var request = global.indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = function () {
          try {
            if (!request.result.objectStoreNames.contains(STORE_NAME)) {
              request.result.createObjectStore(STORE_NAME);
            }
          } catch (e) {
            // If the store can't be created, onsuccess/onerror below still
            // decides the outcome -- nothing to do here but not crash.
          }
        };
        request.onsuccess = function () {
          global.clearTimeout(timer);
          finish(request.result);
        };
        request.onerror = function () {
          global.clearTimeout(timer);
          finish(null);
        };
        request.onblocked = function () {
          global.clearTimeout(timer);
          finish(null);
        };
      } catch (e) {
        global.clearTimeout(timer);
        finish(null);
      }
    });
    return dbPromise;
  }

  /**
   * Persist the working book. Resolves true on a confirmed write, false if
   * the store is unavailable or the write failed -- never rejects.
   * @param {{book: object, lines: object[], source: {kind: string, label: string}, savedAt: string}} record
   */
  function saveWorkingBook(record) {
    return openDb()
      .then(function (db) {
        if (!db) return false;
        return new Promise(function (resolve) {
          try {
            var tx = db.transaction(STORE_NAME, "readwrite");
            tx.objectStore(STORE_NAME).put(record, RECORD_KEY);
            tx.oncomplete = function () {
              resolve(true);
            };
            tx.onerror = function () {
              resolve(false);
            };
            tx.onabort = function () {
              resolve(false);
            };
          } catch (e) {
            resolve(false);
          }
        });
      })
      .catch(function () {
        return false;
      });
  }

  /**
   * Read the working book back. Resolves the stored record, or null if none
   * is saved or the store is unavailable -- never rejects.
   */
  function loadWorkingBook() {
    return openDb()
      .then(function (db) {
        if (!db) return null;
        return new Promise(function (resolve) {
          try {
            var tx = db.transaction(STORE_NAME, "readonly");
            var request = tx.objectStore(STORE_NAME).get(RECORD_KEY);
            request.onsuccess = function () {
              resolve(request.result === undefined ? null : request.result);
            };
            request.onerror = function () {
              resolve(null);
            };
          } catch (e) {
            resolve(null);
          }
        });
      })
      .catch(function () {
        return null;
      });
  }

  /**
   * Clear the working book. Resolves true on a confirmed delete (or if there
   * was nothing to delete), false if the store is unavailable -- never
   * rejects.
   */
  function clearWorkingBook() {
    return openDb()
      .then(function (db) {
        if (!db) return false;
        return new Promise(function (resolve) {
          try {
            var tx = db.transaction(STORE_NAME, "readwrite");
            tx.objectStore(STORE_NAME).delete(RECORD_KEY);
            tx.oncomplete = function () {
              resolve(true);
            };
            tx.onerror = function () {
              resolve(false);
            };
          } catch (e) {
            resolve(false);
          }
        });
      })
      .catch(function () {
        return false;
      });
  }

  global.DiyaBooksAutosave = {
    saveWorkingBook: saveWorkingBook,
    loadWorkingBook: loadWorkingBook,
    clearWorkingBook: clearWorkingBook,
  };
})(window);
