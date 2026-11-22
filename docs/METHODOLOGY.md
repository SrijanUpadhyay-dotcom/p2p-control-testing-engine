# Methodology

This document is the reference for how the engine reads data, tests it and scores what it finds. Rule library: **P2P-IN v1.0**.

## 1. Data intake

### Extracts

| Extract | Typical SAP source | Key | Used by |
|---|---|---|---|
| Vendor master (reference) | LFA1, LFB1, MSME fields | LIFNR | C18 |
| Vendor master change log | S_ALR_87012089, CDHDR/CDPOS, FK08 | CHANGENR | C02 |
| Purchase orders | ME2N, EKKO/EKPO, release history | EBELN | C06, C09 |
| Vendor invoices | MIRO, RBKP/RSEG | BELNR + GJAHR | C09, C14, C18 |
| Blocked invoice releases | MRBR release log | BELNR | C13 |
| Payments | F110, REGUH/REGUP, BSAK | VBLNR + BELNR | C02, C18 |
| User access | SUIM, AGR_USERS, AGR_1251 | BNAME + AGR_NAME | C20 |

Field-level definitions (canonical name, meaning, type, whether required, accepted header aliases) are in `src/engine/schema.js`. Templates with the canonical headers are in `templates/`.

### Detection and mapping

1. Each uploaded table (CSV, or each sheet of an XLSX) is compared with every extract definition not yet loaded. The extract whose required fields are best covered is chosen if at least 60% of them map; otherwise the user assigns it.
2. Columns map in this order: exact SAP field name → known alias → field label. The user can override any mapping; changes re-run the checks.
3. Values are normalised: dates (DD.MM.YYYY, DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD, DD-Mon-YYYY, YYYYMMDD, Excel serials) to ISO; amounts (Indian or international grouping, ₹/INR/Rs., brackets or trailing minus for negatives) to numbers; flags (Y/N, Yes/No, True/False, 1/0, X) to booleans.

### Data quality checks

| Check | Result |
|---|---|
| Required fields present | FAIL if any required field is unmapped |
| Record count agrees to source report | PASS/FAIL against the count the user enters; INFO if none entered |
| Control total agrees | PASS/FAIL against the GL / report total entered; INFO if none |
| Key uniqueness | FAIL on repeated keys |
| Values readable | FAIL if dates, amounts or flags cannot be parsed |
| No blanks in required fields | WARN; affected rows are excluded from tests that need the field and the exclusion is logged |
| Period coverage | WARN if a month in the period has no records or records fall outside the period |

Each file is fingerprinted with SHA-256 so a result can be tied to the exact input.

## 2. Tests

Defaults reflect FY 2023-24 Indian rules and the demo company's DOA. All parameters are editable on the Test library screen and recorded in the run.

### C02 – Bank change paid before verification (R02, Occurrence, COSO P10)
For every change in the change log:
- the FK08 confirmer must exist, differ from the changer and be on the authorised list (default `RMEHTA;ABHATT`);
- for bank fields (`BANKN`, `BANKL+BANKN`): vendor letter with bank proof on file, call-back logged, and no payment to the vendor dated on or after the change and before confirmation.
Amount = first payment to the vendor after the change.

### C06 – PO released as per DOA (R05, Occurrence, COSO P11)
Required release codes by final PO value (cumulative): ≤ PM limit → PM; ≤ PH limit → PH; ≤ CFO limit → PH + CFO; above → PH + CFO + MD (defaults ₹5 lakh / ₹25 lakh / ₹1 crore). Also: final release on or before first goods receipt; a value increase after release must be re-released; the creator may not release.

### C09 – After-the-fact and split POs (R05, Occurrence, COSO P16)
- *After-the-fact:* any invoice against the PO dated before the PO.
- *Split:* standard POs (rate-contract call-off types excluded, default `ZRC`) to one vendor for one material group, each within a DOA limit, within the window (default 7 days) of the first, whose total crosses that limit. Limits tested: ₹5 lakh, ₹25 lakh, ₹1 crore.

### C13 – Blocked invoice released without support (R09, Accuracy, COSO P10)
Each MRBR release must be by an authorised releaser (default `JPATEL`) who did not post the invoice, with a buyer confirmation or corrected GRN dated on or before the release. Amount = the variance released.

### C14 – Duplicate invoices (R10, Occurrence, COSO P10)
Group invoices by vendor + normalised invoice number + gross amount. Normalisation: upper-case, remove every non-alphanumeric character, drop leading zeros of digit runs. A group of two or more within the window (default ±30 days) is one exception. Amount = gross × (copies − 1).

### C18 – MSME dues beyond 45 days (R14, Completeness, COSO P10)
For invoices from vendors whose MSME category is in the covered list (default Micro; Small — Medium enterprises are outside s.43B(h)):
- paid after the limit (default 45 days) from the date of acceptance → exception with MSMED Act s.16 interest estimate;
- unpaid at period end beyond the limit → exception and s.43B(h) disallowance equal to the amount.
Interest = amount × ((1 + 3 × bank rate / 12)^(days late ÷ 30.42) − 1), i.e. three times the RBI bank rate with monthly rests (default bank rate 6.75%). Invoices whose payment line has no value date are excluded and logged.

### C20 – Segregation of duties (R15, all assertions, COSO P11)
Each user's T-codes are the union across all their roles. A user who holds any T-code from both sides of a pair is one exception per pair:

| Pair | Side A | Side B |
|---|---|---|
| SoD-01 | XK01, XK02 | F110 |
| SoD-02 | XK02 | FK08 |
| SoD-03 | ME21N | ME29N |
| SoD-04 | ME21N | MIGO |
| SoD-05 | MIGO | MIRO |
| SoD-06 | MIRO | MRBR |
| SoD-07 | MIRO | F110 |

## 3. Severity score (0–100)

| Component | Points |
|---|---|
| Inherent risk of the control's risk | High 40 · Medium 25 · Low 10 |
| Amount | ≥ ₹10 lakh 30 · ≥ ₹5 lakh 22 · ≥ ₹1 lakh 15 · ≥ reporting threshold 8 · below 0 · access exceptions (no amount) 20 |
| Fraud-indicator test (C02, C14, C20) | +15 |
| Money already paid out | +10 |

Severity: **High ≥ 70**, **Medium 50–69**, **Low < 50**. Each exception shows its breakdown under *Why score*.

## 4. Review and sign-off

Statuses: New → In review → Confirmed / False positive (reason required) → Remediated. Every change is logged with user and time. Confirmed and remediated exceptions become draft observations; cause and management action plan come only from reviewer input. Preparer and reviewer must be different names; after reviewer sign-off dispositions lock and exports drop the DRAFT mark.

## 5. Demo data

`src/demo/generator.js` builds a deterministic dataset (seed `20240331`) for a fictional listed auto-components company: 410 vendors, 64 sensitive vendor changes (the population used in the companion full pack), 6,214 POs, 17,500 invoices, 312 blocked-invoice releases, 14,776 payment lines and 46 users with 212 role assignments. Regular records are built so they do not break any rule; 13 exceptions are planted on purpose, plus three payment lines with a blank value date for the data quality warning. `test/engine.test.mjs` asserts both.

| Control | Planted |
|---|---|
| C02 | 1 – bank change CD004642 confirmed without letter or call-back, ₹4,62,180 paid |
| C06 | 0 |
| C09 | 2 after-the-fact POs, 1 split pair |
| C13 | 1 – KUT/23-24/1473 released on "rate revised per discussion" |
| C14 | 2 – TFW/1182 vs TFW-1182; RL 0457 vs RL0457 |
| C18 | 3 paid late (days 49, 52, 61), 1 unpaid at year-end (day 58) |
| C20 | 2 – XK01/XK02 + F110; ME21N + MIGO |
