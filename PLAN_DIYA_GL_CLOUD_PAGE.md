# PLAN: sign-in and "save to my account" on the DIYA-GL pages

The four DIYA-GL pages hold a year of accounts in the browser and save a 15 KB zip to disk. The paid
tier signs the reader in on Submit's Cognito pool and puts that zip in their account. This is the
spreadsheets side: one new script, four small hooks in `shell.js`, a config file, some CSS and a
browser spec. The launch plan is `PLAN_DIYA_GL_LAUNCH.md`, row LP-17. The Submit side is that
repo's `PLAN_DIYA_GL_STORAGE.md` (LP-16) and its `IdentityStack` books client (LP-15); both are
pushed and waiting on H9.

## 1. What this rests on

Decided by the operator (launch plan, sections 5a and 5c): one Cognito pool, Submit's, with Google
federation; Submit's hosted sign-in page redirecting back here, nothing moves; computation stays in
the browser; 99p a month; a conflict shown rather than merged.

Built already, read from the pushed branches. The DIYA-GL app client: no secret, authorization-code
grant only, scopes `openid profile email`, callbacks and logout URLs `https://<host>/books/` and
`/books/{bst,se,taxi,ltd}.html` for `spreadsheets.diyaccounting.co.uk` (prod) and
`ci-spreadsheets.diyaccounting.co.uk` plus `http://localhost:3000` (ci); its id is the output
`BooksUserPoolClientId` and the SSM parameter `/submit/<env>/spreadsheets-books-app-client-id`. The
hosted UI is a custom domain per environment, `https://{ci,prod}-auth.diyaccounting.co.uk`. The four
routes sit under `/api/v1/books` behind a JWT authoriser whose audience is that client id.

Submit's own web app is not the model for the exchange: it posts the code to its own
`/api/v1/cognito/token` Lambda and keeps tokens in `localStorage`. This origin has no server, so it
exchanges the code directly against the pool's token endpoint with PKCE.

## 2. Decisions taken here

| # | Decision | Why |
|---|---|---|
| C1 | PKCE S256, code exchanged straight against `{hostedUi}/oauth2/token` from the page. | No server on this origin, no secret on the client. `crypto.subtle` is there on https and localhost. |
| C2 | All three tokens live in `sessionStorage`, not `localStorage`. | Closing the tab signs out. A 15 KB book is not worth a token that outlives the session. |
| C3 | The API is called with the **id token** as the bearer. | The authoriser validates `aud` against the books client id; a Cognito access token carries `client_id`, not `aud`, so only the id token passes. |
| C4 | The `redirect_uri` is `location.origin + location.pathname`, with no query. | Cognito matches callbacks exactly and the registered list has no query. The reader's deep link is put back after the exchange from `sessionStorage`. |
| C5 | `cloud.js` disables itself whenever `clientId` is null, the protocol is not https or localhost, or `crypto.subtle` is missing. | One switch turns the whole feature off: it merges dark before H9, and the LP-5 `file://` runner has no sign-in control at all. |
| C6 | The book's cloud identity (`bookId`, `latestETag`, `latestVersion`) lives in `sessionStorage`, not in the book. | Putting it in `book.toml` would change the bytes and break the byte-identity gates. A new tab that saves an already-stored book gets the near-duplicate prompt in journey 4 instead. |
| C7 | The put's `If-Match` comes from `metadata.latestETag` in the previous response body, not the `ETag` response header. | One less thing to depend on `Access-Control-Expose-Headers` for. The header is read only as a fallback. |
| C8 | Entitlement is read from the newest book's `entitlementAtPut.reason`, overridden by any 403 seen this session. | The only entitlement signals the four routes carry. No new route. |
| C9 | Sign-out clears the tab's tokens **and** ends the pool session through `{hostedUi}/logout`. | A local-only sign-out would silently sign the same reader back in on the next click. |
| C10 | The panel is a card anchored under the topbar on the right at 900px and up, and a bottom sheet with its own backdrop below that. | Same shape language as `.donation-prompt` and `.inspector-drawer`, which already own those two positions. |

## 3. The journeys

### 3.1 Signed out
1. `cloud-config.js` resolves the environment from `location.hostname`; `cloud.js` mounts. If C5
   disables it, nothing renders and the save menu keeps its two items. Stop.
2. The topbar shows `#account-btn` — a person glyph, `aria-label="Sign in to save to your account"`,
   label text "Sign in" at 561px and up, icon only below, the `.btn-label` rule the other topbar
   buttons follow.
3. Clicking it opens the panel: one line, "Save your books to your DIYA-GL account and open them on any
   device.", and one button, "Sign in".
4. The save menu carries a third item, "Save to my account". Clicking it while signed out opens the
   panel at step 3 rather than starting a save.

### 3.2 Sign-in redirect and return
1. "Sign in" generates a 64-byte `code_verifier` (base64url), its S256 `code_challenge`, a random
   `state` and a random `nonce`, writes `verifier`, `state`, `nonce` and `returnTo` (`location.href`,
   deep link and all) to `sessionStorage`, and fires `cloud_sign_in` with `step: "started"`.
2. `window.location.assign()` goes to
   `{hostedUi}/oauth2/authorize?response_type=code&client_id=…&redirect_uri=…&scope=openid+profile+email&state=…&nonce=…&code_challenge=…&code_challenge_method=S256`.
   A plain navigation, not a form post, so `form-action` needs no change.
3. The reader signs in with Google on Submit's hosted page and comes back to the same DIYA-GL page
   with `?code=…&state=…` (or `?error=…&error_description=…`).
4. `cloud.js` runs at script-eval time, before `shell.js`'s `DOMContentLoaded` handler. It reads and
   removes `code`, `state`, `error` and `error_description` from the URL with `history.replaceState`,
   restoring `returnTo`, so `parseDeepLinkParams()` never sees an OAuth parameter and the reader's
   `?example=…&view=…` link survives the round trip.
5. A `state` that does not match the stored one, or a missing verifier, shows "Sign-in could not be
   verified. Please try again." in the panel, clears the three keys, fires `cloud_sign_in` with
   `step: "failed"`, and stops. An `error` parameter shows `error_description` the same way.
6. The exchange: `POST {hostedUi}/oauth2/token`, `Content-Type: application/x-www-form-urlencoded`,
   body `grant_type=authorization_code&client_id=…&code=…&redirect_uri=…&code_verifier=…`. No
   `Authorization` header — the client has no secret.
7. On 200, the `nonce` claim in the id token is checked against the stored one, then `idToken`,
   `accessToken`, `refreshToken`, `expiresAt` (`Date.now() + expires_in * 1000`) and `user`
   (`{sub, email}` off the id token) go to `sessionStorage`; the four transient keys are deleted;
   `cloud_sign_in` fires with `step: "returned"`; the panel opens on the signed-in state.
8. On any other status, step 5's failure path, with the body's `error_description` when there is one.

### 3.3 Token expiry and refresh
1. Every API call goes through one wrapper, which refreshes first if `expiresAt - Date.now() < 60_000`.
2. Refresh is `POST {hostedUi}/oauth2/token` with `grant_type=refresh_token&client_id=…&refresh_token=…`.
   A 200 replaces `idToken`, `accessToken` and `expiresAt`, keeping the old refresh token when the
   response carries none.
3. A 401 from the API triggers one refresh and one retry of that call.
4. A failed refresh, or a second 401, clears every token key and shows the signed-out panel with
   "Your session ended. Sign in again." Nothing is retried after that; the local book is untouched.

### 3.4 Signed in
1. The topbar button reads "Account" and carries the reader's email as its `title`.
2. Opening the panel calls `GET {apiBase}/books`. While it is in flight the panel shows "Loading
   your books…"; on failure, the message and a "Retry" button.
3. Empty: "No books in your account yet." plus "Save this book to my account" when a book is loaded.
4. Otherwise one row per book, newest `updatedAt` first: the title; the product and period
   (`periodCoveredStart` to `periodCoveredEnd`, "period not set" when null); "version N, saved
   <updatedAt, local>"; the size in KB; `provenance.engineVersion` in small print. Each row carries
   **Open**, **Versions** and **Delete**.
5. **Open** calls `GET {apiBase}/books/{bookId}/versions/latest`, decodes `zipBase64` into a `File`
   named `<title>.zip` and hands it to `window.DiyaGlBooksPage.loadFile()` — the same sniffing,
   product switching, `book_loaded` event and toast an uploaded file gets. The response's `bookId`,
   `metadata.latestETag` and `metadata.latestVersion` become the tab's cloud link (C6). Opening over
   an edited book asks first: "Opening replaces the book on this page. Your unsaved changes are not
   in your account yet." with Open and Cancel.
6. **Versions** expands the row into `metadata.versions`, oldest last, each `version, size, createdAt`
   with its own Open, which calls the same route with the version number.
7. **Delete** asks "Delete <title> and all N versions from your account? This cannot be undone.",
   then calls `DELETE {apiBase}/books/{bookId}` and re-lists.
8. Below the list, the entitlement card (C8): "Subscribed" when the newest `entitlementAtPut.reason`
   is `active-subscription`; "Storage is 99p a month" with a **Subscribe** button when it is
   `no-subscription` or `expired`, or after any 403 this session; nothing at all when the reason is
   `not-enforced` or unknown. **Subscribe** calls `startSubscription()` (section 6).

### 3.5 Save to my account
1. The save menu's third item calls `saveCurrentBook()`.
2. It asks `shell.js` for `buildArtifact("diya-gl-zip")`, the same bytes the download writes.
3. Title is `book.entityInformation.organizationIdentifier`, product is
   `window.DiyaGlBooksPage.productId()`, the two dates come from `book.documentInfo`, and
   `provenance` is the five `diya-gl:*` keys off `documentInfo` mapped to the API's names.
4. With no cloud link for this tab (C6), it first looks for a near-duplicate in the list — same
   product, same title, same two dates. A hit asks: "This looks like <title>, already in your account
   as version N. Update it, or save as a new book?" Update takes that `bookId` and its `latestETag`;
   New book generates a fresh `crypto.randomUUID()`.
5. `PUT {apiBase}/books/{bookId}` with `If-Match: "<latestETag>"` on an existing book and no
   `If-Match` on a new one.
6. On 200: the tab's cloud link updates from `metadata`, the list refreshes, the toast reads "Saved
   to your account as version N.", `cloud_save` fires with `created` or `updated`.
7. On any error, the toast and panel show section 5's message for that status, `cloud_save` fires
   with the matching outcome, and the local book is untouched.

### 3.6 Conflict
1. A 412 means the account's copy moved on. Nothing is merged, ever, and nothing is overwritten.
2. The panel shows a conflict card, "This book changed somewhere else.", with two rows: "On this
   page — edited <the tab's last edit time>, not in your account" and "In your account — version
   <latestVersion>, saved <updatedAt>", the second read back through a fresh list call.
3. Three buttons: **Save as a new book** (a fresh `bookId`, put with no `If-Match`), **Open the
   account's copy** (journey 3.4 step 5, same unsaved-changes wording), **Cancel** (the card closes,
   the page is exactly as it was). `cloud_conflict` fires with `shown`, then `new-book`, `reloaded`
   or `cancelled`.
4. A 409 `write-conflict` shows the same card with "Another save landed at the same moment. Try
   again." and a **Try again** button in place of the three.

### 3.7 Sign out
1. "Sign out" sits at the foot of the panel.
2. It clears every `diya-gl.cloud.*` key from `sessionStorage`, closes the panel, then navigates to
   `{hostedUi}/logout?client_id=…&logout_uri=<origin + pathname>`, which returns to the same page
   signed out. The loaded book stays loaded; nothing local is deleted.

### 3.8 The same page on a phone
- At 899px and below in portrait the panel is a bottom sheet — `left: 0; right: 0; bottom: 0;
  max-height: 70vh; overflow-y: auto`, the `.inspector-drawer` shape — over its own
  `#account-backdrop`, not the shared `#drawer-backdrop`, so the checks drawer and the panel never
  fight over one element.
- At 560px and below the topbar button hides its `.btn-label`, like every other topbar button.
- The mobile action bar's Save opens the same save menu, so no separate mobile control is needed.
- Rows stack: title, then the meta line, then the three buttons at the 36px touch height
  `.donation-prompt-actions .btn` already sets.

## 4. The modules

### 4.1 `public/books/cloud-config.js`
A committed classic script, loaded before `cloud.js` on the four pages. It publishes
`window.DIYA_GL_CLOUD_CONFIG` = one of two entries, chosen by `location.hostname`:
`spreadsheets.diyaccounting.co.uk` gets prod, everything else (`ci-spreadsheets…`, `localhost`,
`127.0.0.1`, and the browser tests' own random port) gets ci.

| Key | prod | ci |
|---|---|---|
| `apiBase` | `https://submit.diyaccounting.co.uk/api/v1` | `https://ci-submit.diyaccounting.co.uk/api/v1` |
| `hostedUi` | `https://prod-auth.diyaccounting.co.uk` | `https://ci-auth.diyaccounting.co.uk` |
| `clientId` | `null` until H9 | `null` until H9 |

The client id is a public OAuth identifier, so it is committed rather than injected. `deploy.yml`
gets no new step: the spreadsheets deploy role cannot read Submit's SSM across accounts, and a
GitHub repository variable would only move the same paste somewhere less visible. Once H9 deploys,
one commit fills both ids, read with
`aws --profile submit-ci ssm get-parameter --name /submit/ci/spreadsheets-books-app-client-id` and
the submit-prod equivalent. Until then C5 keeps every cloud control off the page, in every
environment, including the local test server.

### 4.2 `public/books/cloud.js`
A classic script, no module syntax, publishing `window.DiyaGlBooksCloud`:

| Export | Does |
|---|---|
| `isEnabled()` | C5's switch. `shell.js` asks before adding the save-menu item. |
| `mount()` | Called at the end of `shell.js`'s `init()`. Renders the topbar button, binds the panel. |
| `openPanel()` / `closePanel()` | The panel, in whichever of section 3's states applies. |
| `saveCurrentBook()` | Journey 3.5. |
| `startSubscription()` | Section 6's one function: Submit's checkout route. |
| `signIn()` / `signOut()` | Journeys 3.2 and 3.7. |

Internally: `pkce.js`-style helpers (`randomUrlSafe(bytes)`, `challengeFor(verifier)`) kept as
exported-on-window functions so the unit tests can reach them; `tokens` (the `sessionStorage`
reader, writer and clearer); `api` (the fetch wrapper of 3.3 with the four route calls); `panel`
(render and bind). It imports nothing and dispatches no custom events — `shell.js` calls into it,
never the reverse, and the analytics go out through `books-events.js` builders.

At script-eval time, before `shell.js` runs, it does one thing besides defining itself: journey
3.2's step 5 URL cleanup, so no OAuth parameter ever reaches the deep-link parser.

### 4.3 The hooks in `shell.js`
Four edits, named by function:

| Hook | Function | Change |
|---|---|---|
| H-1 | `init()` | after `bindGlobalControls()`, `if (window.DiyaGlBooksCloud) window.DiyaGlBooksCloud.mount();` |
| H-2 | `saveMenuItems()` and `openSaveMenu()` | a third item `{label: "Save to my account", format: "cloud"}` when `window.DiyaGlBooksCloud && window.DiyaGlBooksCloud.isEnabled()`; the click handler routes `format === "cloud"` to `window.DiyaGlBooksCloud.saveCurrentBook()` instead of `runSave` |
| H-3 | `runSave()` | split: a new `buildSaveArtifactFor(current, format)` holds the import, the `buildBookChecksForZip` call and `buildSaveArtifact`, returning the artifact; `runSave` becomes that plus `downloadArtifact`, the event and the toast, unchanged in behaviour |
| H-4 | `window.DiyaGlBooksPage` | gains `buildArtifact(format)` (through H-3), `currentBook()` (`currentBookAndLines`), `loadFile(file)` (`loadFromAnySource`), `productId()` (`active.id`), `isEdited()` and `trackEvent(name, params)` |

Nothing in `shell.js` knows what the cloud does with any of it.

### 4.4 The four pages
Each of `bst.html`, `se.html`, `taxi.html`, `ltd.html` gains one button in `.app-topbar`, between
`#theme-toggle` and `#drawer-toggle-btn`:

```html
<button type="button" id="account-btn" class="icon-btn account-btn hidden" title="Account" aria-label="Sign in to save to your account" aria-expanded="false">
  &#128100;<span class="btn-label">Sign in</span>
</button>
```

and two script tags before `shell.js`: `cloud-config.js` then `cloud.js`. Because
`scripts/build-books-bundle.mjs` builds the precache list from each page's own `<script src>` tags,
both files join the service worker's cache with no change to `build-stamp.js` or `sw.js`.

### 4.5 `public/books/books.css`
One new section, "Account panel", after the donation-prompt section. `.account-panel` is fixed at
`top: calc(var(--topbar-h) + var(--tabstrip-h) + 0.75rem)`, `right: 1rem`, `z-index: 60`,
`width: min(360px, calc(100vw - 2rem))`, `max-height: calc(100vh - var(--topbar-h) - 2rem)`,
`overflow-y: auto`, over the same `--paper-raised` / `--rule-faint` / `--radius-lg` / `--shadow-md`
set the donation prompt uses. With it: `.account-panel-head`, `.account-row`, `.account-row-meta`,
`.account-row-actions`, `.account-versions`, `.account-entitlement`, `.account-conflict`,
`.account-empty`, `.account-error`, `#account-backdrop`, and the
`@media (max-width: 899px) and (orientation: portrait)` block of 3.8. No new custom properties.

## 5. The API as the client uses it

`{apiBase}` and `{hostedUi}` come from 4.1. Every books call carries `Authorization: Bearer <idToken>`.

| Use | Request | Body out | 200 body |
|---|---|---|---|
| List | `GET {apiBase}/books` | — | `{books: [metadata, …]}` newest first |
| Open | `GET {apiBase}/books/{bookId}/versions/{latest\|n}` | — | `{metadata, version, etag, zipBase64}` |
| Save | `PUT {apiBase}/books/{bookId}`, `Content-Type: application/json`, `If-Match: "<latestETag>"` on an existing book only | `{title, product, periodCoveredStart, periodCoveredEnd, provenance, zipBase64}` | `{metadata}`, plus an `ETag` header |
| Delete | `DELETE {apiBase}/books/{bookId}` | — | `{bookId, deletedObjects}` |
| Exchange | `POST {hostedUi}/oauth2/token`, form-urlencoded | `grant_type=authorization_code&client_id&code&redirect_uri&code_verifier` | `{id_token, access_token, refresh_token, expires_in}` |
| Refresh | `POST {hostedUi}/oauth2/token`, form-urlencoded | `grant_type=refresh_token&client_id&refresh_token` | `{id_token, access_token, expires_in}` |

`provenance` is `{formatVersion, engineVersion, taxDataHash, templateHash, reconciledCommit}`, each
read from `book.documentInfo["diya-gl:<name>"]` and sent as `null` when absent.

The metadata fields the panel reads: `bookId`, `title`, `product`, `latestVersion`, `latestETag`,
`latestSize`, `updatedAt`, `periodCoveredStart`, `periodCoveredEnd`, `versions[]`
(`{version, etag, size, createdAt}`), `provenance.engineVersion`, `entitlementAtPut.reason`.

Errors arrive as `{message, code}`. Every one of them leaves the local book exactly as it was.

| Status | `code` | What the reader sees |
|---|---|---|
| 400 | `invalid-book-id`, `invalid-request` | "That book could not be saved: <message>." A bug in this page; the toast says so and asks for a reload. |
| 401 | — | Journey 3.3: one refresh and one retry, then the signed-out panel with "Your session ended." |
| 403 | `subscription-required` | The entitlement card flips to "Storage is 99p a month" with **Subscribe**; the toast says "Saving to your account needs the 99p subscription." |
| 403 | `book-limit-reached` | "Your account holds 20 books, the most it keeps. Delete one to save another." with the list open. |
| 404 | `book-not-found`, `version-not-found` | "That book is no longer in your account." and the list refreshes. |
| 409 | `write-conflict` | Journey 3.6 step 5. |
| 412 | `etag-mismatch` | Journey 3.6, the conflict card. Never a merge, never an overwrite. |
| 413 | `book-too-large` | "This book is larger than the 2 MB an account holds. The download still works." |
| 422 | `not-a-diya-gl-package` | "The saved file was not a diya-gl package." A bug in this page; the same reload wording as 400. |
| 500 | `storage-error` | "Your account could not be reached. Your book is safe on this page — try the download." with **Retry**. |
| network failure | — | The same wording as 500. |

## 6. Billing through Submit's checkout route

The panel calls one function, `startSubscription()`: `POST {apiBase}/billing/checkout` with the id
token for the `resident-diya-gl` bundle, read `{url}` from the response, `location.assign(url)`. Submit's
server sets `metadata.hashedSub`, which is what `getUserBundles` reads. Cost on this side: the four
lines in that function. Cost on Submit's side: the checkout route must accept the DIYA-GL audience.

The navigation is `location.assign`, so `form-action` in the CSP is untouched, and the return from
Stripe lands on whatever URL Stripe is configured with; the panel re-reads entitlement from the
next list call (C8).

## 7. Security and headers

**CSP.** `infra/main/resources/security-headers.json` carries one policy string for both
environments, and `web/browser-tests/serve.js` serves the same file, so the four hosts go in
together. `connect-src` gains
`https://submit.diyaccounting.co.uk https://ci-submit.diyaccounting.co.uk https://prod-auth.diyaccounting.co.uk https://ci-auth.diyaccounting.co.uk`.
Nothing else changes: the authorize and logout redirects are top-level navigations, which
`form-action` does not govern and `default-src` does not block; no iframe is used, so `frame-src`
stays as it is; the hosted UI is a page of its own, not an embed.

**Service worker.** `sw.js` already returns early for any request whose origin is not the page's own
and for any method that is not GET, so every books-API and token call bypasses it untouched. No
change to `sw.js` or `pwa.js`. The redirect back from the hosted UI is a same-origin navigation, so
it takes the network-first path and falls back to the cached page offline, which is correct — the
exchange then fails with the section 5 network wording.

**Tokens.** `sessionStorage` is reachable by any script on this origin, so the exposure is the same
XSS that already reaches the loaded book. Against that: the tokens die with the tab (C2), the
refresh token never leaves `sessionStorage`, no token is ever written into the URL, the panel never
renders a token, and sign-out ends the pool session as well as the tab's copy (C9). The pages' CSP
has no `'unsafe-eval'` and the DIYA-GL pages load no third-party script inside `/books/`.

**The `file://` runner.** `scripts/build-runner.mjs` adds both files to its `SKIP_SCRIPT_SRC` set,
so the runner never carries them; C5 is the second guard, since on `file://` the protocol is not
https and `crypto.subtle` is gone, so even an inlined `cloud.js` renders nothing.

**Measurement.** Three builders join `books-events.js`, beside LP-9's three. `cloud.js` sends them
through `shell.js`'s own guarded `trackEvent`, which H-4 adds to `window.DiyaGlBooksPage`, so a
cloud event goes out by exactly the path a save or a donation prompt already does and stays a silent
no-op when consent has not been given.

| Builder | Event | Params |
|---|---|---|
| `buildCloudSignInEvent(step)` | `cloud_sign_in` | `step`: `started`, `returned`, `failed` |
| `buildCloudSaveEvent(product, outcome)` | `cloud_save` | `product`; `outcome`: `created`, `updated`, `conflict`, `unentitled`, `failed` |
| `buildCloudConflictEvent(resolution)` | `cloud_conflict` | `resolution`: `shown`, `new-book`, `reloaded`, `cancelled` |

## 8. Tests

**`web/browser-tests/books-cloud.browser.test.js`**, over `startStaticServer`, with the ci hosts
allowed by the CSP and every call to them fulfilled by `page.route`. Each case first sets
`window.DIYA_GL_CLOUD_CONFIG.clientId` through an `addInitScript`, so the spec runs before H9 fills
the committed config.

| Case | Stubbed | Asserts |
|---|---|---|
| the signed-out page offers sign-in | — | `#account-btn` visible, the panel's one button, the save menu's third item opening the panel |
| a disabled config hides everything | `clientId: null` | no `#account-btn`, a two-item save menu, no console error |
| the redirect carries PKCE | `oauth2/authorize` fulfilled with a 302 back to the page | the authorize URL's `code_challenge_method=S256`, `redirect_uri` with no query, a `state` matching `sessionStorage` |
| sign-in return exchanges the code | `oauth2/token` returns a fake id token | `?code`/`?state` gone from the URL, the deep link restored, the panel signed in, `cloud_sign_in` twice on `dataLayer` |
| a mismatched state is refused | a 302 back with a wrong `state` | the failure message, no call to `oauth2/token`, `cloud_sign_in` with `step: "failed"` |
| the list renders | `GET /books` with two books | two rows, newest first, with version, date and period |
| open loads the book | `GET …/versions/latest` with a real fixture zip | the year view renders that book, `book_loaded` on `dataLayer` |
| save creates and updates | `PUT` returning `latestVersion` 1 then 2 | the first put carries no `If-Match`, the second carries the first response's `latestETag`; `cloud_save` `created` then `updated` |
| a 412 shows the conflict card | `PUT` → 412 | the card, both timestamps, three buttons; **Save as a new book** puts a fresh UUID with no `If-Match`; `cloud_conflict` `shown` then `new-book`; the local book unchanged |
| a 403 offers the subscription | `PUT` → 403 `subscription-required` | the entitlement card, the toast, `cloud_save` with `unentitled`, no book lost |
| a 401 refreshes once, then signs out | `GET /books` → 401, `oauth2/token` → 200 then 400 | one refresh and one retry, then the signed-out panel with the session-ended message |
| sign-out clears and leaves | — | no `diya-gl.cloud.*` key left, the navigation to `{hostedUi}/logout` with `logout_uri` |
| the worker does not intercept the API | the page reloaded with `sw.js` registered | the stubbed `GET /books` still reached the route handler |

**Unit tests.** `web/unit-tests/books-events.test.js` gains the three builders' cases in its
existing `vm` sandbox style. A new `web/unit-tests/books-cloud-pkce.test.js` runs `cloud.js` in the
same sandbox with a `crypto` stub: the verifier is 43 to 128 base64url characters and differs each
call; `challengeFor` reproduces a known SHA-256 vector as unpadded base64url; `cloud-config.js`
maps the prod host to prod and every other host to ci.

**The ci behaviour case.** One case in `behaviour-tests/spreadsheets.behaviour.test.js`, guarded by
`SPREADSHEETS_BASE_URL` naming the ci host: open `/books/bst.html`, click sign in, land on
`ci-auth.diyaccounting.co.uk`, sign in with `TEST_AUTH_USERNAME` / `TEST_AUTH_PASSWORD` /
`TEST_AUTH_TOTP_SECRET` (new repository secrets, the same values Submit's suites use), return, load
an example, save to the account, see the row, open it, delete it, sign out. It needs the pool's
native login form enabled for the books client for the length of the run — Submit's
`scripts/toggle-cognito-native-auth.js` does exactly this for the main client and must learn the
books client's name. That is open question 1, and this step is the last one in section 9, marked as
waiting on H9.

## 9. Build order for the Sonnet builder

Each step is one commit with its own acceptance check. Steps 1 to 8 land dark: C5 keeps every
control off the page until step 9 fills the client ids.

| # | Step | Files | Accepted when |
|---|---|---|---|
| 1 | ✓ The config and the switch | `public/books/cloud-config.js`, `public/books/cloud.js` (only `isEnabled`, `mount` as a no-op, the URL cleanup), `web/unit-tests/books-cloud-pkce.test.js` (the resolver cases) | `npm test` green; the four pages load unchanged |
| 2 | ✓ The three event builders | `public/books/books-events.js`, `web/unit-tests/books-events.test.js` | the three builders' unit cases pass |
| 3 | ✓ The CSP hosts | `infra/main/resources/security-headers.json` | `npm run test:browser` still green; the four hosts are in `connect-src` |
| 4 | ✓ PKCE, the redirect and the exchange | `cloud.js`, `web/unit-tests/books-cloud-pkce.test.js` | the PKCE unit cases pass |
| 5 | ✓ The shell hooks and the topbar button | `public/books/shell.js` (H-1 to H-4), the four `*.html`, `public/books/books.css` | `npm run test:browser` green — the existing save, donation and measurement specs still pass with `runSave` split. Deviation: no `books.css` change was needed yet -- `#account-btn` reuses the existing `.icon-btn`/`.btn-label` rules and stays `hidden` until step 6/7 add the panel styling. |
| 6 | ✓ The panel: sign in, list, open, sign out | `cloud.js`, `books.css` | the browser spec's sign-in, list, open and sign-out cases pass. Deviation: landed in the same commit as step 7 -- the panel render/state machine and the save/conflict/entitlement flow share `renderPanel()`/`panelState` closely enough that splitting them after the fact risked more than it saved. |
| 7 | ✓ Save, conflict, entitlement | `cloud.js`, `books.css`, `web/browser-tests/books-cloud.browser.test.js` complete | every case in section 8's table passes. Deviation: the 401 case exercises the plan's own stated rule (one refresh, one retry, a second 401 or a failed refresh both end the session) rather than the test table's literal "oauth2/token -> 200 then 400" sequence, which would need a second refresh attempt the rule does not call for. The near-duplicate prompt (3.5 step 4) has no dedicated case -- not in section 8's table -- but the code path exists (`renderDuplicate`). |
| 8 | ✓ The runner exclusion | `scripts/build-runner.mjs` | `books-runner.browser.test.js` green; the built runner carries no `cloud` script |
| 9 | The client ids | `public/books/cloud-config.js` | landed: both ids from the IdentityStack outputs (prod 1c8hjrjp5g5ipm8o47t6qkks4r, ci 53op0ccvcaseceue5t8kfr1vq1); the test override pins or nulls the id |
| 10 | The ci behaviour case | `behaviour-tests/spreadsheets.behaviour.test.js`, the three repository secrets | **waits on H9 and open question 1.** `npm run test:spreadsheetsBehaviour-ci` green |

Before any push: `npm test` and `npm run test:browser`. Steps 3 and 5 touch files the whole suite
reads, so those two run the full browser suite, not the cloud spec alone.

## 10. Open questions

1. **How the ci behaviour case signs in.** The books client deliberately omits the native Cognito
   login form, and CI cannot drive Google's own sign-in. Either Submit's
   `scripts/toggle-cognito-native-auth.js` learns to toggle the books client too, so the ci run
   enables the form for its own duration and disables it after — **recommended**, it reuses a
   working script and a durable test user, and the form is off outside the run — or the ci
   behaviour case is dropped and the browser spec's stubs stay the only coverage of sign-in, which
   leaves the real redirect, the real authoriser and the real CORS untested until a person clicks
   through. The first needs a one-line change in the Submit repo, in LP-15's own file.
