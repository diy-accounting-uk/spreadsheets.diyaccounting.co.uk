<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->
<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->

# Operator tasks, 2026-09-10

Two tasks that only a person can do, written out so a Cowork session or a chat can draft them
without asking anything first. Each carries the facts, the source documents and what "done" is.

Neither is urgent in the sense of anything being broken. Both are the kind of thing that gets more
expensive by sitting.

---

## 1. Tell HMRC's Software Developer Support team the licence changed

**Plan row:** `H-LU-9` in `PLAN_DIYA_GL_LAUNCH.md`. **Cost:** nothing. **Impact:** medium.
**Owner:** operator, drafted by Cowork.

### Why this exists

When we applied for HMRC MTD production credentials we described the service as **AGPL-3.0 open
source**. That was true then. On 2026-09-09 the licence changed, so it is not true now, and HMRC
holds documents that say otherwise.

Whether this needs sending at all is a judgement the operator already made: if those descriptions
are treated as representations HMRC relied on, a one-paragraph update is owed. If not, the
documents get annotated and nothing is sent. **The decision was to send it.**

Nobody is chasing us for this. The reason to do it is that a regulator learning about a licence
change from somewhere else, later, costs goodwill that is slow to rebuild.

### The facts the email needs

| | |
| --- | --- |
| **To** | `SDSTeam@hmrc.gov.uk` — the address the original credentials request went to |
| **Salutation used before** | "Dear Software Developer Support Team," |
| **What changed** | The licence, on 2026-09-09 |
| **What it was** | AGPL-3.0, described as open source |
| **What it is now** | The service is **free to use**. Its source is available under the **PolyForm Internal Use License 1.0.0**, with an additional grant for accountants and bookkeepers |
| **What has NOT changed** | The `Gov-Vendor-License-IDs` header. We still issue no licence keys, so the header still carries no data. Our submission recorded it as "Open source software, no license keys issued" and the *behaviour* is identical — only the description of the licence moves |
| **What else has not changed** | The service itself, its availability, its price to the user, the API calls it makes, and the fraud-prevention headers |

### The source documents

Both in the Submit repository, and both already carry a licence note added on 2026-09-09 that says
the document is the record of what was sent and its wording therefore stands:

- `../submit.diyaccounting.co.uk/_developers/hmrc/HMRC_MTD_API_APPROVAL_SUBMISSION.md` — the
  approval submission. The note is at the top; the "open source" descriptions are at lines 146 and
  155 in the recorded text.
- `../submit.diyaccounting.co.uk/_developers/hmrc/HMRC_PRODUCTION_CREDENTIALS_EMAIL.md` — the
  credentials request, which is the model for tone and addressing.

The licence note in the first of those is close to the paragraph that needs sending. It was written
to sit in a historical document, so it needs turning outward: addressed to them, saying what
changed and that nothing they rely on moves.

### What good looks like

One short paragraph, plain, no apology and no legal throat-clearing. It states the change, states
that the header behaviour is unaffected, and offers to answer anything. It does not ask for
anything, because nothing is needed from them.

**Done is:** sent, and the two source documents annotated with the date it went and to whom.

---

## 2. Find out what recovering `diyaccounting.com` would take

**Plan:** `PLAN_DIYACCOUNTING_BRAND.md` part three, rows DC-1 to DC-3. **Cost:** nothing to ask.
**Impact:** low. **Owner:** operator, researched by Cowork.

### Why this exists

`diyaccounting.com` is held by someone else and listed at **USD 5,000**. We trade as DIY Accounting
on `diyaccounting.co.uk`.

**The asking price is far beyond what the name is worth to us. Even USD 1,000 would be too much.**
That is the frame: this is a question, not a purchase. If the answer is "there is no route at a
price worth paying", the plan has succeeded — the question stops being open.

### What to establish

**DC-1, answerable today, needs nothing from anyone:**

- Is the holding a parked listing or a site someone trades on? A parked name that has never
  resolved to a business is a different case from an operating one.
- How long has it been held, and has it ever resolved to anything?
- Has the listing sat unsold? An asking price is not a valuation.

**DC-2, waits on the trade mark filing (`H-LU-4`):**

- What does a UDRP complaint cost, what evidence does it need, and do our facts support one?
- A registered mark is what a complaint rests on. Without one there is little to argue from, which
  is exactly why this waits rather than running in parallel.
- A complaint costing more than the name is worth is not a route — it is a more expensive way of
  paying the asking price.

**DC-3:** write the answer down and close it, either way.

### What good looks like

A short written answer in `PLAN_DIYACCOUNTING_BRAND.md`, so that nobody revisits this next year
without knowing what was already established. **A finding of "not worth pursuing" is a complete
result**, not a failure.

---

## Not in this brief

`H-LU-5`, registering `diya-gl.co.uk` and `diya-gl.com`, is on the board in `NEXT.md` and in
`PLAN_DIYA_GL_LAUNCH.md` rather than
here: it is a few minutes in a console rather than something needing drafting. USD 25 a year, and
neither name needs a hosted zone — delete the one Route 53 creates within twelve hours and it costs
nothing.

`H-LU-4`, the trade mark filings, is now `PLAN_DIYACCOUNTING_BRAND.md` part two, with its pack in
`_developers/trade-marks/`. About £1,435, and the precursor to DC-2 above.
