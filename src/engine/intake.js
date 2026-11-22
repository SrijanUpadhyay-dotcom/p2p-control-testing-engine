// Intake: map file columns to canonical fields, normalise values, run data quality checks.
import { EXTRACT_BY_ID } from './schema.js';
import { parseDate, parseAmount, flag, normKey } from './util.js';

/** Suggest a mapping { canonicalField: sourceHeader } for one extract. */
export function autoMap(extractId, headers) {
  const def = EXTRACT_BY_ID[extractId];
  const mapping = {};
  const how = {};
  const used = new Set();
  const norm = headers.map((h) => normKey(h));
  for (const fd of def.fields) {
    const exact = norm.findIndex((h, i) => !used.has(i) && h === normKey(fd.f));
    if (exact >= 0) { mapping[fd.f] = headers[exact]; how[fd.f] = 'exact'; used.add(exact); continue; }
    const alias = norm.findIndex((h, i) => !used.has(i) && fd.aliases.includes(h));
    if (alias >= 0) { mapping[fd.f] = headers[alias]; how[fd.f] = 'alias'; used.add(alias); continue; }
    const label = norm.findIndex((h, i) => !used.has(i) && h === normKey(fd.label));
    if (label >= 0) { mapping[fd.f] = headers[label]; how[fd.f] = 'label'; used.add(label); }
  }
  return { mapping, how };
}

/** Guess which extract a file is, from its headers. Returns best id and score. */
export function detectExtract(headers, candidates) {
  let best = null, bestScore = 0;
  for (const id of candidates) {
    const def = EXTRACT_BY_ID[id];
    const { mapping } = autoMap(id, headers);
    const req = def.fields.filter((f) => f.required);
    const score = req.filter((f) => mapping[f.f]).length / req.length;
    if (score > bestScore) { bestScore = score; best = id; }
  }
  return { id: best, score: bestScore };
}

/**
 * Convert raw rows (array of arrays incl. header row) into typed records using a mapping.
 * Returns { records, issues } where issues counts parse problems per field.
 */
export function normalise(extractId, table, mapping) {
  const def = EXTRACT_BY_ID[extractId];
  const [header, ...body] = table;
  const idx = {};
  for (const fd of def.fields) {
    const src = mapping[fd.f];
    idx[fd.f] = src === undefined ? -1 : header.indexOf(src);
  }
  const issues = {};
  const blank = {};
  const records = [];
  body.forEach((row, r) => {
    if (!row || row.every((c) => c === '' || c === null || c === undefined)) return;
    const rec = { _row: r + 2 };
    for (const fd of def.fields) {
      const i = idx[fd.f];
      const raw = i >= 0 ? row[i] : undefined;
      const empty = raw === undefined || raw === null || String(raw).trim() === '';
      let val = null;
      if (!empty) {
        if (fd.type === 'date') val = parseDate(raw);
        else if (fd.type === 'amount') val = parseAmount(raw);
        else if (fd.type === 'flag') val = flag(raw);
        else val = String(raw).trim();
        if (val === null) (issues[fd.f] ||= []).push(r + 2);
      } else if (i >= 0) {
        (blank[fd.f] ||= []).push(r + 2);
      }
      rec[fd.f] = val;
    }
    records.push(rec);
  });
  return { records, issues, blank };
}

/**
 * Data quality checks per extract. `expected` holds optional user-entered control figures:
 * { count, total } taken from the source report / GL.
 */
export function qualityChecks(extractId, records, mapping, period, expected = {}, extra = {}) {
  const def = EXTRACT_BY_ID[extractId];
  const checks = [];
  const add = (id, name, result, detail, affected = []) => checks.push({ id, name, result, detail, affected });

  // 1. Required fields mapped
  const missing = def.fields.filter((f) => f.required && !mapping[f.f]).map((f) => f.f);
  add('fields', 'Required fields present', missing.length ? 'FAIL' : 'PASS',
    missing.length ? `Not mapped: ${missing.join(', ')}` : `${def.fields.filter((f) => f.required).length} required fields mapped`);

  // 2. Record count agrees to source report
  if (expected.count) {
    const ok = +expected.count === records.length;
    add('count', 'Record count agrees to source report', ok ? 'PASS' : 'FAIL',
      ok ? `${records.length.toLocaleString('en-IN')} records = source report` : `File has ${records.length}, source report says ${expected.count}`);
  } else {
    add('count', 'Record count agrees to source report', 'INFO', `${records.length.toLocaleString('en-IN')} records · enter the source report count to reconcile`);
  }

  // 3. Control total
  if (def.amountField) {
    const total = records.reduce((s, r) => s + (r[def.amountField] || 0), 0);
    if (expected.total) {
      const ok = Math.abs(total - +expected.total) < 1;
      add('total', 'Control total agrees', ok ? 'PASS' : 'FAIL', ok ? `₹${Math.round(total).toLocaleString('en-IN')} agrees` : `File ₹${Math.round(total).toLocaleString('en-IN')} vs control ₹${(+expected.total).toLocaleString('en-IN')}`);
    } else {
      add('total', 'Control total agrees', 'INFO', `File total ₹${Math.round(total).toLocaleString('en-IN')} · enter the GL / report total to reconcile`);
    }
  }

  // 4. Key uniqueness
  const seen = new Map();
  const dups = [];
  for (const r of records) {
    const k = def.key.map((f) => r[f]).join('|');
    if (seen.has(k)) dups.push(r._row); else seen.set(k, r._row);
  }
  add('keys', 'Key uniqueness', dups.length ? 'FAIL' : 'PASS',
    dups.length ? `${dups.length} repeated keys (${def.key.join(' + ')})` : `No repeated ${def.key.join(' + ')}`, dups);

  // 5. Values that could not be read + blanks in required fields
  const bad = [];
  for (const fd of def.fields) {
    const iss = (extra.issues || {})[fd.f] || [];
    if (iss.length) bad.push(`${iss.length} unreadable ${fd.f}`);
  }
  const blanks = [];
  const blankRows = [];
  for (const fd of def.fields.filter((f) => f.required)) {
    const b = (extra.blank || {})[fd.f] || [];
    if (b.length) { blanks.push(`${b.length} blank ${fd.f}`); blankRows.push(...b); }
  }
  add('values', 'Values readable', bad.length ? 'FAIL' : 'PASS', bad.length ? bad.join(' · ') : 'All dates, amounts and flags parsed');
  add('blanks', 'No blanks in required fields', blanks.length ? 'WARN' : 'PASS',
    blanks.length ? `${blanks.join(' · ')} · rows excluded from tests that need them` : 'No blanks in required fields', blankRows);

  // 6. Period coverage
  if (def.dateField && period) {
    const months = new Set();
    let outside = 0;
    for (const r of records) {
      const d = r[def.dateField];
      if (!d) continue;
      if (d < period.from || d > period.to) outside++;
      else months.add(d.slice(0, 7));
    }
    const want = monthsIn(period);
    const gaps = want.filter((m) => !months.has(m));
    const res = outside || gaps.length ? 'WARN' : 'PASS';
    add('period', 'Period coverage', res,
      res === 'PASS' ? `Records in all ${want.length} months; none outside the period`
        : [gaps.length ? `No records in ${gaps.join(', ')}` : '', outside ? `${outside} records outside the period` : ''].filter(Boolean).join(' · '));
  }
  return checks;
}

function monthsIn({ from, to }) {
  const out = [];
  let [y, m] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  while (y < ty || (y === ty && m <= tm)) { out.push(`${y}-${String(m).padStart(2, '0')}`); m++; if (m > 12) { m = 1; y++; } }
  return out;
}

export function overallQuality(checks) {
  if (checks.some((c) => c.result === 'FAIL')) return 'FAIL';
  if (checks.some((c) => c.result === 'WARN')) return 'WARN';
  return 'PASS';
}
