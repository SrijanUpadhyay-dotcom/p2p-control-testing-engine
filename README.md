# P2P Control Testing Engine

**Continuous controls monitoring for procure-to-pay.** Load SAP-style extracts, run seven rule-based tests from a P2P risk and control matrix over the **full population**, review every exception in an audit workflow, and export working papers, a report, draft observations and an evidence pack.

Runs entirely in the browser. No server, no account, no data leaves the device.

**Live demo:** https://srijanupadhyay-dotcom.github.io/p2p-control-testing-engine/ (built-in fictional demo data, or upload your own extracts)

> **Licence: source-available, all rights reserved.** You may read this code and use the official hosted version to evaluate it, with the demo data or your own data (processed only in your browser). Running your own copy, client or commercial use, and copying or modifying the code need prior written permission from Srijan Upadhyay. See [LICENSE](LICENSE) and [How to get permission](#permission).

> **Status:** v1.0 prototype, built as a self-learning project. The demo dataset is fictional (Sabarmati Autoparts Ltd, FY 2023-24). Results are rule-based exceptions for an auditor to review, not audit opinions.

---

## Why

Manual control testing samples 25 items per control. This engine tests every record against the same rules and shows what sampling misses. On the demo data:

| | Manual sampling (companion full pack) | Engine |
|---|---|---|
| Controls tested | 3 | 7 |
| Items examined | 75 | 38,912 |
| Exceptions found | 2 | 13 (including both of the 2) |

## The workflow

| Step | What happens |
|---|---|
| **00 Start** | Startup sequence, then sign in with a name and role (Preparer or Reviewer). Start with demo data, upload your own extracts, or reopen a saved run. |
| **01 Data intake** | Drag in CSV or XLSX extracts. The extract type is detected from the headers, columns are mapped to SAP fields (exact, alias or manual), and data quality checks run: record count and control total against the source report, period coverage, key uniqueness, readable values, blanks. Each file is fingerprinted with SHA-256. |
| **02 Test library** | Seven tests mapped to the RCM (risk, assertion, COSO principle). Edit parameters such as DOA limits, the MSME 45-day limit, RBI bank rate or the duplicate window. |
| **03 Results** | Records tested, exceptions, severity, value flagged, a sub-process × severity heatmap, results by control, MSME s.43B(h) and interest exposure. |
| **04 Exception review** | Filter by status, severity, control, sub-process, assertion, owner and amount; search; group; bulk-assign. Each exception shows the evidence the rule used, why it scored what it did, and a disposition (status, owner, root cause, note, management action plan) with an activity log. |
| **05 Report & export** | Confirmed exceptions become draft observations (condition, criteria, cause, effect, recommendation, action plan). Preparer and reviewer sign-off (different people). Export XLSX, PDF, DOCX, CSV, JSON and a ZIP evidence pack. |

## The seven tests

| ID | Test | Rule (summary) | Risk |
|---|---|---|---|
| C02 | Bank change paid before verification | Bank or payment-term change confirmed by the changer or an unauthorised user; bank change without vendor letter or logged call-back; payment between change and confirmation | R02 High |
| C06 | PO released as per DOA | Release codes below what the DOA requires for the final value; goods received before release; value increase not re-released; creator released | R05 High |
| C09 | After-the-fact and split POs | Invoice dated before its PO; standard POs to one vendor and material group inside the window that each sit within a DOA limit but together cross it | R05 High |
| C13 | Blocked invoice released without support | MRBR release with no buyer confirmation or corrected GRN dated on or before release, by an unauthorised user, or by the poster | R09 High |
| C14 | Duplicate invoices | Same vendor and amount; invoice numbers equal after removing separators and leading zeros (INV/123 = INV-123); within ± window | R10 Medium |
| C18 | MSME dues beyond 45 days | Micro/Small vendor invoice paid after the limit from acceptance (MSMED s.16 interest), or unpaid beyond the limit at year-end (s.43B(h) disallowance) | R14 High |
| C20 | Segregation of duties | User holds both sides of a P2P conflict pair (e.g. XK02 + F110, ME21N + MIGO) through any combination of roles | R15 High |

Full logic, parameters, severity scoring and data formats: [docs/METHODOLOGY.md](docs/METHODOLOGY.md).

## Quick start

**Try it:** open the live demo and choose *Try with demo data*.

**Build from source** requires the Author's permission (see [LICENSE](LICENSE)). With permission, using Node 20+:

```bash
npm install
npm test        # engine tests: volumes, every planted exception, data quality, exports
npm run build   # → dist/index.html (single self-contained file)
npm run demo    # regenerate data/demo/*.csv and templates/*.csv
```

**Use your own data** (free for evaluation on the hosted version): download the templates from the Data intake screen (or `templates/`), export the matching reports from SAP (or any ERP) into CSV/XLSX, and drop them in. Column names do not need to match exactly; mapping can be corrected on screen.

## Repository layout

```
src/engine/        Pure, framework-free engine (runs in browser and Node)
  schema.js        Seven extract definitions, SAP field names, aliases
  intake.js        Header detection, column mapping, normalisation, data quality
  rules/           One file per test (C02 … C20) + library index
  scoring.js       Transparent 0–100 severity score
  observations.js  Draft observations from confirmed exceptions
  run.js           Run orchestration and the run record
  xlsx.js          Minimal XLSX reader/writer (no SheetJS dependency)
src/export/        Working paper, report, observations, CSV, JSON, evidence pack
src/demo/          Seeded, deterministic demo-data generator with planted exceptions
src/ui/            Preact + htm interface
test/              node:test suite
data/demo/         Demo extracts as CSV (what the generator produces)
templates/         Header-only templates for your own extracts
docs/              Methodology
```

Runtime dependencies: `preact` (MIT), `htm` (Apache-2.0), `fflate` (MIT); see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). `npm audit`: 0 vulnerabilities at release.

## Design principles

- **Every number is traceable.** Each exception carries the facts the rule used; each run records rule version, parameters and SHA-256 of every input file.
- **The engine flags; the auditor concludes.** Cause and management action plan are always auditor input. Exports are marked DRAFT until a reviewer signs off.
- **Segregation in the tool itself.** Preparer and reviewer must be different people; dispositions lock after review.
- **Local by default.** Files are parsed in the browser; nothing is uploaded.

## Limits (v1.0)

- Works on extracts, not a live ERP connection. Scheduling and connectors are future work.
- Indian regulatory parameters as in force in FY 2023-24 (GST, TDS, MSMED Act, s.43B(h)); change parameters for other periods.
- Goods receipt has no automated test yet (covered by the manual C10 reconciliation in the RCM).
- Sign-in is a name and role for the run record, not authentication.

## Background

This engine automates part of a self-built P2P internal controls project: a process walkthrough, risk and control matrix (15 risks, 20 controls), manual testing of three key controls and a deficiency report, set in a fictional company. Control IDs, risks and the demo data match that pack.

## Licence

Copyright © 2026 Srijan Upadhyay. **All rights reserved.** This is source-available software, not open source.

| Without permission | Needs written permission |
|---|---|
| Read the code in this repository | Run, install or host your own copy |
| Evaluate it on the official hosted version, with demo data or your own data | Use it in client engagements, paid services or audit opinions |
| | Copy, modify, or reuse the rules, scoring model or methodology |
| | Distribute it, offer it as a service, or use it commercially |

Full terms: [LICENSE](LICENSE). Bundled third-party components keep their own licences: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

<a id="permission"></a>
### How to get permission

Open an issue titled **"Permission request"** in this repository, or message Srijan Upadhyay on LinkedIn, with:
- who you are and your organisation;
- what you want to do (for example evaluate on internal data, run for a client, adapt the rules);
- how long you need it for.

Permission is given only in writing and may be limited in scope.

Created by **Srijan Upadhyay**. Built with AI assistance (Claude); design, rules and audit logic reviewed by the author.
