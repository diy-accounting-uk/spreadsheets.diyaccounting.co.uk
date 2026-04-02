# DIY Accounting Global Ledger Lines Schema

## Adapted from XBRL Global Ledger Taxonomy Framework 2015 (Recommendation)

**Source specification:** http://www.xbrl.org/int/gl/2015-03-25/gl-framework-REC-2015-03-25.html
**GL modules referenced:** COR (core), BUS (business), MUC (multicurrency), USK (UK/Saxonic), TAF (tax audit)
**Adaptation licence:** XBRL GL taxonomy is © XBRL International Inc., licenced for derivative works
with attribution (see Section 1.0 of the GL Framework). This schema uses GL *semantics*
(element names, types, enumerations) in a JSON/TOML surface syntax — it does not reproduce
or modify the taxonomy XSD files.

---

## 1. Design Principles

1. **GL element names are used verbatim** as JSON property names in camelCase, matching
   the taxonomy's own naming convention (e.g. `gl-cor:postingDate` → `postingDate`).
2. **GL namespace prefixes are dropped** in the flat JSONL form. Where a field originates
   from a non-core module, the source module is documented but not encoded in the key name.
3. **GL's nested tuple structure is flattened** for single-entry products (Basic Sole Trader,
   Self Employed, Taxi Driver). For double-entry products (Company Accounts), the
   `entryDetail` array is preserved to hold multiple posting lines per journal entry.
4. **GL enumerations are reused** where they exist (e.g. `debitCreditCode`, `documentType`,
   `entriesType`). DIY Accounting-specific values are namespaced with `diy:` prefix.
5. **Types follow JSON conventions**: dates are ISO 8601 strings, amounts are numbers
   (not strings), currencies are ISO 4217 codes.

---

## 2. JSONL Transaction Record Schema

Each line in `sales.jsonl` or `purchases.jsonl` is a single JSON object conforming to
this schema. The schema is expressed as JSON Schema (draft 2020-12) for machine validation.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://spreadsheets.diyaccounting.co.uk/schema/diya-gl-lines-v1.json",
  "title": "DIY Accounting GL-aligned Transaction",
  "description": "A single financial transaction record. Field names are adapted from the XBRL Global Ledger Taxonomy Framework 2015 (gl-cor, gl-bus, gl-muc, gl-taf, gl-usk modules).",
  "type": "object",
  "required": ["postingDate", "amount", "accountMainID", "sourceJournalID"],
  "additionalProperties": false,
  "properties": {

    "_comment": {
      "description": "Mapping reference comments are inline below. Each property documents its GL source as gl-{module}:{elementName}."
    },

    "entryNumber": {
      "type": "string",
      "description": "Unique transaction identifier within this book. gl-cor:entryNumber. Generated on extract if absent."
    },

    "lineNumber": {
      "type": "integer",
      "minimum": 1,
      "description": "Line number within a multi-line journal entry. gl-cor:lineNumber. Only used in double-entry (Company Accounts) where entryDetail is an array."
    },

    "sourceJournalID": {
      "type": "string",
      "enum": ["sales", "purchases", "bank", "journal", "payroll", "petty-cash"],
      "description": "Identifies which journal/daybook this transaction belongs to. gl-cor:sourceJournalID."
    },

    "enteredDate": {
      "type": "string",
      "format": "date",
      "description": "Date the transaction was entered/keyed. gl-cor:enteredDate. ISO 8601."
    },

    "enteredBy": {
      "type": "string",
      "description": "User or system that entered the transaction. gl-cor:enteredBy."
    },

    "postingDate": {
      "type": "string",
      "format": "date",
      "description": "The tax-relevant date of the transaction. gl-cor:postingDate. ISO 8601. This is the date used to assign the transaction to a month/period."
    },

    "accountMainID": {
      "type": "string",
      "description": "Nominal/account code from the chart of accounts defined in book.toml. gl-cor:accountMainID within gl-cor:account tuple."
    },

    "accountMainDescription": {
      "type": "string",
      "description": "Human-readable account name. gl-cor:accountMainDescription. Optional — can be resolved from book.toml chart."
    },

    "accountSubID": {
      "type": "string",
      "description": "Sub-account or department code. gl-cor:accountSubID within gl-cor:accountSub tuple. Optional."
    },

    "accountSubDescription": {
      "type": "string",
      "description": "Sub-account description. gl-cor:accountSubDescription. Optional."
    },

    "debitCreditCode": {
      "type": "string",
      "enum": ["D", "C"],
      "description": "Debit or Credit indicator. gl-cor:debitCreditCode. Only used in double-entry products. D=Debit, C=Credit per GL enumeration."
    },

    "amount": {
      "type": "number",
      "minimum": 0,
      "description": "Transaction amount, always positive. Sign is determined by debitCreditCode (double-entry) or by sourceJournalID context (single-entry: sales=receipt, purchases=payment). gl-cor:amount. Penny precision (2 decimal places for GBP)."
    },

    "amountCurrency": {
      "type": "string",
      "pattern": "^[A-Z]{3}$",
      "default": "GBP",
      "description": "ISO 4217 currency code. gl-muc:amountCurrency. Defaults to GBP."
    },

    "documentType": {
      "type": "string",
      "enum": [
        "invoice",
        "credit-note",
        "receipt",
        "bank-statement",
        "journal",
        "payslip",
        "mileage-log",
        "other"
      ],
      "description": "Type of source document. Adapted from gl-cor:documentType enumeration. GL defines: invoice, credit_memo, debit_memo, receipt, order, voucher, check, journal, other. We simplify and add UK-specific types."
    },

    "documentReference": {
      "type": "string",
      "description": "Invoice number, receipt reference, or other source document identifier. gl-cor:documentReference."
    },

    "documentNumber": {
      "type": "string",
      "description": "Internal document number if different from documentReference. gl-cor:documentNumber. Typically used for auto-numbered sequences."
    },

    "documentDate": {
      "type": "string",
      "format": "date",
      "description": "Date on the source document (may differ from postingDate). gl-cor:documentDate. ISO 8601."
    },

    "detailComment": {
      "type": "string",
      "description": "Primary description — customer/supplier name or transaction narrative. gl-cor:detailComment. This is the main human-readable identifier."
    },

    "lineItemComment": {
      "type": "string",
      "description": "Secondary description — what was sold/bought. Separate from detailComment to distinguish payee from goods/services. Adapted from gl-cor:detailComment (GL uses the same element; we split for clarity)."
    },

    "postingStatus": {
      "type": "string",
      "enum": ["posted", "draft", "voided"],
      "description": "Status of the entry. gl-cor:postingStatus. GL defines: complete, incomplete, voided."
    },

    "taxCode": {
      "type": "string",
      "enum": ["S", "R", "Z", "E", "OS", "RC", "NA"],
      "description": "UK VAT code. Derived from gl-taf tax concepts. S=Standard 20%, R=Reduced 5%, Z=Zero, E=Exempt, OS=Outside Scope, RC=Reverse Charge, NA=Not Applicable (non-VAT-registered)."
    },

    "taxAmount": {
      "type": "number",
      "minimum": 0,
      "description": "VAT amount. gl-cor:taxAmount within gl-cor:taxes tuple. Always positive. Zero for non-VAT-registered."
    },

    "taxRate": {
      "type": "number",
      "minimum": 0,
      "maximum": 1,
      "description": "VAT rate as decimal (0.20 = 20%). gl-taf:taxRate. Used to verify taxAmount = amount * taxRate / (1 + taxRate) for VAT-inclusive, or amount * taxRate for VAT-exclusive."
    },

    "taxPointDate": {
      "type": "string",
      "format": "date",
      "description": "VAT tax point date if different from postingDate. gl-taf:taxPointDate. ISO 8601."
    },

    "taxDescription": {
      "type": "string",
      "description": "Human-readable tax description. gl-cor:taxDescription."
    },

    "paymentMethod": {
      "type": "string",
      "enum": [
        "bank-transfer",
        "cash",
        "cheque",
        "debit-card",
        "credit-card",
        "direct-debit",
        "standing-order",
        "online-payment",
        "other"
      ],
      "description": "How payment was made/received. gl-bus:paymentMethod. GL defines generic values; we use UK-common terms."
    },

    "measurableQuantity": {
      "type": "number",
      "description": "Quantity for non-monetary measures (miles driven, hours worked, units bought). gl-bus:measurableQuantity within gl-bus:measurable tuple."
    },

    "measurableUnitOfMeasure": {
      "type": "string",
      "enum": ["miles", "km", "hours", "units", "litres", "other"],
      "description": "Unit for measurableQuantity. gl-bus:measurableUnitOfMeasure."
    },

    "measurableDescription": {
      "type": "string",
      "description": "Description of what is being measured. gl-bus:measurableQualifier."
    }
  }
}
```

---

## 3. Double-Entry Journal Record Schema (Company Accounts extension)

For Company Accounts, a journal entry wraps multiple `entryDetail` lines.
This preserves GL's `entryHeader` → `entryDetail[]` nesting:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://spreadsheets.diyaccounting.co.uk/schema/gl-journal-entry-v1.json",
  "title": "DIY Accounting GL-aligned Journal Entry (double-entry)",
  "description": "A complete journal entry with balanced debit/credit lines. Maps to gl-cor:entryHeader containing gl-cor:entryDetail children.",
  "type": "object",
  "required": ["entryNumber", "sourceJournalID", "postingDate", "entryDetail"],
  "properties": {
    "entryNumber":    { "type": "string" },
    "sourceJournalID": { "type": "string" },
    "postingDate":    { "type": "string", "format": "date" },
    "enteredDate":    { "type": "string", "format": "date" },
    "enteredBy":      { "type": "string" },
    "detailComment":  { "type": "string" },
    "documentType":   { "type": "string" },
    "documentReference": { "type": "string" },
    "documentDate":   { "type": "string", "format": "date" },

    "entryDetail": {
      "type": "array",
      "minItems": 2,
      "description": "Array of posting lines. gl-cor:entryDetail. Debits must equal Credits for a balanced entry.",
      "items": {
        "type": "object",
        "required": ["accountMainID", "debitCreditCode", "amount"],
        "properties": {
          "lineNumber":          { "type": "integer", "minimum": 1 },
          "accountMainID":       { "type": "string" },
          "accountMainDescription": { "type": "string" },
          "debitCreditCode":     { "type": "string", "enum": ["D", "C"] },
          "amount":              { "type": "number", "minimum": 0 },
          "amountCurrency":      { "type": "string", "default": "GBP" },
          "taxCode":             { "type": "string" },
          "taxAmount":           { "type": "number" },
          "detailComment":       { "type": "string" },
          "paymentMethod":       { "type": "string" },
          "measurableQuantity":  { "type": "number" },
          "measurableUnitOfMeasure": { "type": "string" }
        }
      }
    }
  }
}
```

**Validation rule (not expressible in JSON Schema alone):**
For each journal entry, `SUM(amount WHERE debitCreditCode="D")` must equal
`SUM(amount WHERE debitCreditCode="C")`.

---

## 4. book.toml Schema

The `book.toml` file maps to GL's `documentInfo` and `entityInformation` structures.

```toml
# ============================================================================
# book.toml — GL-aligned book metadata
# Maps to gl-cor:accountingEntries root structure
# ============================================================================

# --- gl-cor:documentInfo ---------------------------------------------------
[documentInfo]
# gl-cor:entriesType — what kind of data this book contains
# GL enumeration: journal | entries | account | balance | trial_balance |
#                 assets | tax_tables | versioning | master_file |
#                 trade_documents | profile_compliant | other
entriesType = "journal"

# gl-cor:language — ISO 639-1 language code
language = "en"

# gl-cor:creationDate — when this book file was created
creationDate = 2026-04-01

# gl-cor:periodCoveredStart / gl-cor:periodCoveredEnd
periodCoveredStart = 2025-04-06
periodCoveredEnd   = 2026-04-05

# gl-cor:defaultCurrency — ISO 4217
defaultCurrency = "GBP"


# --- gl-cor:entityInformation / gl-bus:organizationInformation -------------
[entityInformation]
# gl-bus:organizationIdentifier — entity name
organizationIdentifier = "Jane Smith Trading"

# gl-bus:organizationDescription — business description
organizationDescription = "Freelance web design"

# gl-taf:taxRegistrationNumber — HMRC UTR (optional)
taxRegistrationNumber = ""

# gl-taf:taxAuthorityIdentifier
taxAuthorityIdentifier = "HMRC"

# DIY Accounting extensions (prefixed diy:)
"diy:product" = "BasicSoleTrader"
"diy:vatRegistered" = false
"diy:basisOfAccounting" = "cash"   # cash | accrual
"diy:nino" = ""


# --- gl-cor:account (chart of accounts) -----------------------------------
# Each entry maps gl-cor:accountMainID → metadata
# accountMainDescription is the GL label
# diy:column is the spreadsheet column mapping (extract/build)
# gl-cor:accountType from GL enumeration:
#   account | bank | customer | vendor | employee | job |
#   statistical | measurable | other

# Sales accounts
[accounts.sales."4000"]
accountMainDescription = "Sales income"
accountType = "account"

# Purchase / expense accounts
[accounts.purchases."5000"]
accountMainDescription = "Cost of sales / materials"
accountType = "account"
"diy:column" = "E"

[accounts.purchases."5100"]
accountMainDescription = "Motor expenses"
accountType = "account"
"diy:column" = "F"

[accounts.purchases."5200"]
accountMainDescription = "Travel & subsistence"
accountType = "account"
"diy:column" = "G"

[accounts.purchases."5300"]
accountMainDescription = "Telephone"
accountType = "account"
"diy:column" = "H"

[accounts.purchases."5400"]
accountMainDescription = "Stationery & postage"
accountType = "account"
"diy:column" = "I"

[accounts.purchases."5500"]
accountMainDescription = "Advertising"
accountType = "account"
"diy:column" = "J"

[accounts.purchases."5600"]
accountMainDescription = "Insurance"
accountType = "account"
"diy:column" = "K"

[accounts.purchases."5700"]
accountMainDescription = "Repairs & maintenance"
accountType = "account"
"diy:column" = "L"

[accounts.purchases."5800"]
accountMainDescription = "Accountancy fees"
accountType = "account"
"diy:column" = "M"

[accounts.purchases."5900"]
accountMainDescription = "Other expenses"
accountType = "account"
"diy:column" = "N"

[accounts.purchases."7000"]
accountMainDescription = "Fixed asset purchases"
accountType = "account"
"diy:column" = "O"


# --- Tax configuration (from gl-taf + HMRC published rates) ----------------
# These are reference values, not GL elements per se, but they use
# gl-taf:taxRate and gl-taf:taxDescription semantics

[tax.incomeTax]
personalAllowance = 12570
basicRate = 0.20
basicRateLimit = 37700
higherRate = 0.40
higherRateThreshold = 50270
additionalRate = 0.45
additionalRateThreshold = 125140
personalAllowanceTaperThreshold = 100000

[tax.nationalInsurance]
class2WeeklyRate = 3.45
class2SmallProfitsThreshold = 6845
class4MainRate = 0.06
class4UpperRate = 0.02
class4LowerProfits = 12570
class4UpperProfits = 50270

[tax.vat]
standardRate = 0.20
reducedRate = 0.05
registrationThreshold = 90000

[tax.corporationTax]
smallProfitsRate = 0.19
smallProfitsLimit = 50000
mainRate = 0.25
mainRateThreshold = 250000
```

---

## 5. GL Element Cross-Reference

Complete mapping from GL taxonomy elements to our JSON/TOML property names.

### 5.1 Core Module (gl-cor)

| GL Element                    | GL Type          | Our Property             | Our Type  | Location  |
|-------------------------------|------------------|--------------------------|-----------|-----------|
| `cor:accountingEntries`       | tuple (root)     | —                        | —         | implicit  |
| `cor:documentInfo`            | tuple            | `[documentInfo]`         | table     | book.toml |
| `cor:entriesType`             | enumeration      | `entriesType`            | string    | book.toml |
| `cor:language`                | string           | `language`               | string    | book.toml |
| `cor:creationDate`            | date             | `creationDate`           | date      | book.toml |
| `cor:periodCoveredStart`      | date             | `periodCoveredStart`     | date      | book.toml |
| `cor:periodCoveredEnd`        | date             | `periodCoveredEnd`       | date      | book.toml |
| `cor:defaultCurrency`         | string           | `defaultCurrency`        | string    | book.toml |
| `cor:entityInformation`       | tuple            | `[entityInformation]`    | table     | book.toml |
| `cor:entryHeader`             | tuple            | one JSONL line (flat) or object (nested) | object | .jsonl |
| `cor:entryNumber`             | string           | `entryNumber`            | string    | .jsonl    |
| `cor:sourceJournalID`         | string           | `sourceJournalID`        | string    | .jsonl    |
| `cor:enteredDate`             | date             | `enteredDate`            | string    | .jsonl    |
| `cor:enteredBy`               | string           | `enteredBy`              | string    | .jsonl    |
| `cor:entryDetail`             | tuple            | `entryDetail[]` (nested) or flattened | array/— | .jsonl |
| `cor:lineNumber`              | integer          | `lineNumber`             | integer   | .jsonl    |
| `cor:account`                 | tuple            | flattened to `accountMainID` + `accountMainDescription` | — | .jsonl |
| `cor:accountMainID`           | string           | `accountMainID`          | string    | .jsonl    |
| `cor:accountMainDescription`  | string           | `accountMainDescription` | string    | .jsonl    |
| `cor:accountSub`              | tuple            | flattened to `accountSubID` + `accountSubDescription` | — | .jsonl |
| `cor:accountSubID`            | string           | `accountSubID`           | string    | .jsonl    |
| `cor:accountSubDescription`   | string           | `accountSubDescription`  | string    | .jsonl    |
| `cor:debitCreditCode`         | enumeration      | `debitCreditCode`        | string    | .jsonl    |
| `cor:amount`                  | monetary         | `amount`                 | number    | .jsonl    |
| `cor:postingDate`             | date             | `postingDate`            | string    | .jsonl    |
| `cor:documentType`            | enumeration      | `documentType`           | string    | .jsonl    |
| `cor:documentReference`       | string           | `documentReference`      | string    | .jsonl    |
| `cor:documentNumber`          | string           | `documentNumber`         | string    | .jsonl    |
| `cor:documentDate`            | date             | `documentDate`           | string    | .jsonl    |
| `cor:postingStatus`           | enumeration      | `postingStatus`          | string    | .jsonl    |
| `cor:detailComment`           | string           | `detailComment`          | string    | .jsonl    |
| `cor:taxes`                   | tuple            | flattened to `taxCode` + `taxAmount` + `taxRate` | — | .jsonl |
| `cor:taxAmount`               | monetary         | `taxAmount`              | number    | .jsonl    |
| `cor:taxDescription`          | string           | `taxDescription`         | string    | .jsonl    |

### 5.2 Business Module (gl-bus)

| GL Element                        | Our Property                | Location |
|-----------------------------------|-----------------------------|----------|
| `bus:organizationIdentifier`      | `organizationIdentifier`    | book.toml |
| `bus:organizationDescription`     | `organizationDescription`   | book.toml |
| `bus:paymentMethod`               | `paymentMethod`             | .jsonl   |
| `bus:measurableQuantity`          | `measurableQuantity`        | .jsonl   |
| `bus:measurableUnitOfMeasure`     | `measurableUnitOfMeasure`   | .jsonl   |
| `bus:measurableQualifier`         | `measurableDescription`     | .jsonl   |
| `bus:accountType`                 | `accountType`               | book.toml |

### 5.3 Multicurrency Module (gl-muc)

| GL Element                        | Our Property                | Location |
|-----------------------------------|-----------------------------|----------|
| `muc:amountCurrency`              | `amountCurrency`            | .jsonl   |

*(Further gl-muc elements for exchange rates are not used in v1 — all transactions are GBP.)*

### 5.4 Tax Audit File Module (gl-taf)

| GL Element                        | Our Property                | Location |
|-----------------------------------|-----------------------------|----------|
| `taf:taxRegistrationNumber`       | `taxRegistrationNumber`     | book.toml |
| `taf:taxAuthorityIdentifier`      | `taxAuthorityIdentifier`    | book.toml |
| `taf:taxRate`                     | `taxRate`                   | .jsonl   |
| `taf:taxPointDate`                | `taxPointDate`              | .jsonl   |

### 5.5 UK/Saxonic Module (gl-usk)

The USK module provides additional concepts for UK-specific needs. We reference
its concepts but map them to simpler property names where the GL element name
is overly generic.

### 5.6 DIY Accounting Extensions (diy:)

Properties prefixed `diy:` are not in the GL taxonomy. They are product-specific
metadata needed for the spreadsheet mapping:

| Property                 | Description                                  | Location  |
|--------------------------|----------------------------------------------|-----------|
| `diy:product`            | DIY Accounting product identifier            | book.toml |
| `diy:vatRegistered`      | Whether the business is VAT registered       | book.toml |
| `diy:basisOfAccounting`  | cash or accrual                              | book.toml |
| `diy:nino`               | National Insurance Number                    | book.toml |
| `diy:column`             | Excel column letter for this account code    | book.toml |

---

## 6. Product Profiles and Schema Subsets

Not all fields are used by all products. Each product uses a subset:

| Field                    | BasicSoleTrader | SelfEmployed | TaxiDriver | CompanyAccounts |
|--------------------------|:-:|:-:|:-:|:-:|
| `entryNumber`            | ✓ | ✓ | ✓ | ✓ |
| `sourceJournalID`        | ✓ | ✓ | ✓ | ✓ |
| `postingDate`            | ✓ | ✓ | ✓ | ✓ |
| `accountMainID`          | ✓ | ✓ | ✓ | ✓ |
| `amount`                 | ✓ | ✓ | ✓ | ✓ |
| `detailComment`          | ✓ | ✓ | ✓ | ✓ |
| `documentReference`      | ✓ | ✓ | ✓ | ✓ |
| `documentType`           | ✓ | ✓ | ✓ | ✓ |
| `documentDate`           |   | ✓ |   | ✓ |
| `debitCreditCode`        |   |   |   | ✓ |
| `lineNumber`             |   |   |   | ✓ |
| `entryDetail[]`          |   |   |   | ✓ |
| `taxCode`                |   | ✓ |   | ✓ |
| `taxAmount`              |   | ✓ |   | ✓ |
| `taxRate`                |   | ✓ |   | ✓ |
| `taxPointDate`           |   | ✓ |   | ✓ |
| `paymentMethod`          |   | ✓ |   | ✓ |
| `amountCurrency`         |   |   |   | ✓ |
| `measurableQuantity`     |   |   | ✓ |   |
| `measurableUnitOfMeasure`|   |   | ✓ |   |
| `measurableDescription`  |   |   | ✓ |   |
| `postingStatus`          |   |   |   | ✓ |
| `accountSubID`           |   |   |   | ✓ |

---

## 7. Validation Rules

These rules go beyond JSON Schema and are enforced by the CLI `validate` command.

### 7.1 Universal Rules

1. **Date range**: `postingDate` must fall within `periodCoveredStart` and `periodCoveredEnd`
   from `book.toml`.
2. **Account existence**: `accountMainID` must exist in `book.toml` `[accounts.*]` tables.
3. **Amount precision**: `amount` and `taxAmount` must have at most 2 decimal places.
4. **Entry uniqueness**: `entryNumber` must be unique within each JSONL file.
5. **Required fields**: as per the `required` array in the JSON Schema.

### 7.2 VAT Rules (SelfEmployed, CompanyAccounts)

6. **Tax consistency**: if `taxCode` is `"S"`, then `taxRate` should be 0.20 and
   `taxAmount` should equal `round(amount * taxRate / (1 + taxRate), 2)` for
   VAT-inclusive amounts, or `round(amount * taxRate, 2)` for VAT-exclusive.
7. **VAT box derivation**: quarterly VAT return boxes 1–9 must be derivable from
   the transaction data grouped by `taxPointDate` (or `postingDate`) quarter.

### 7.3 Double-Entry Rules (CompanyAccounts)

8. **Balance**: for each journal entry (JSONL line with `entryDetail` array),
   `SUM(amount WHERE debitCreditCode="D")` = `SUM(amount WHERE debitCreditCode="C")`.
9. **Minimum lines**: each journal entry must have at least 2 `entryDetail` elements.

### 7.4 Mileage Rules (TaxiDriver)

10. **Mileage comparison**: where `measurableUnitOfMeasure` is `"miles"`, the CLI
    should compute both mileage allowance (HMRC rates) and actual vehicle costs
    and select the higher for the tax return.

---

## 8. Versioning

This schema is versioned as `v1`. The version is embedded in the JSON Schema `$id` URL.
Future versions will maintain backward compatibility by only adding optional fields.
The `diy:product` value in `book.toml` determines which subset of the schema is active.
