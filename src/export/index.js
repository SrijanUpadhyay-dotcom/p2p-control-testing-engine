// Export builders. Each returns { name, mime, bytes|text }.
import { zipSync, strToU8 } from 'fflate';
import { toCSV, fmtDate, inr } from '../engine/util.js';
import { writeXLSX } from '../engine/xlsx.js';
import { RULE_BY_ID } from '../engine/rules/index.js';
import { observationsFor } from '../engine/observations.js';
import { SCORE_MODEL } from '../engine/scoring.js';

const stamp = (run) => run.id;
const signLine = (run) => `Prepared: ${run.signoff.preparer?.name || '—'}${run.signoff.preparer?.at ? ' (' + run.signoff.preparer.at.slice(0, 10) + ')' : ''} · Reviewed: ${run.signoff.reviewer?.name ? run.signoff.reviewer.name + ' (' + run.signoff.reviewer.at.slice(0, 10) + ')' : 'pending'}`;
export const isDraft = (run) => !run.signoff.reviewer;

export function scopeExceptions(run, scope) {
  return scope === 'confirmed' ? run.exceptions.filter((e) => e.status === 'Confirmed' || e.status === 'Remediated') : run.exceptions;
}

const EX_COLS = ['id', 'control', 'controlName', 'risk', 'subprocess', 'assertion', 'severity', 'score', 'record', 'party', 'vendor', 'amount', 'moneyOut', 'status', 'owner', 'rootCause', 'note', 'reasons', 'condition'];

export function exceptionsCSV(run, scope, { mask } = {}) {
  const rows = scopeExceptions(run, scope).map((e) => ({ ...e, reasons: e.reasons.join('; '), condition: mask ? maskText(e.condition) : e.condition, moneyOut: e.moneyOut ? 'Y' : 'N' }));
  return { name: `${stamp(run)}_exceptions.csv`, mime: 'text/csv', text: toCSV(rows, EX_COLS) };
}

export function runJSON(run, scope) {
  const out = { ...run, exceptions: scopeExceptions(run, scope), exportedAt: new Date().toISOString(), status: isDraft(run) ? 'DRAFT' : 'REVIEWED' };
  return { name: `${stamp(run)}_run.json`, mime: 'application/json', text: JSON.stringify(out, null, 2) };
}

const maskText = (s) => String(s || '').replace(/\b(\d{4})\d{5,}(\d{2})\b/g, '$1••••$2');

export function dataQualityCSV(run) {
  const rows = run.datasets.flatMap((d) => d.checks.map((c) => ({ extract: d.name, file: d.fileName, records: d.count, sha256: d.sha256, check: c.name, result: c.result, detail: c.detail })));
  return { name: `${stamp(run)}_data_quality.csv`, mime: 'text/csv', text: toCSV(rows, ['extract', 'file', 'records', 'sha256', 'check', 'result', 'detail']) };
}

export function workpaperXLSX(run, scope, opts = {}) {
  const exs = scopeExceptions(run, scope);
  const head = (t) => [[t], [`${run.id} · ${run.ruleLibrary} · period ${fmtDate(run.period.from)} to ${fmtDate(run.period.to)} · ${isDraft(run) ? 'DRAFT – not reviewed' : 'Reviewed'}`], [signLine(run)], []];
  const summary = {
    name: 'Summary', widths: [10, 42, 14, 12, 10, 10, 10, 18, 22], titleRows: [0], headerRows: [4],
    rows: [...head('P2P Control Testing Engine – results'),
      ['Control', 'Test', 'Population', 'Exceptions', 'High', 'Medium', 'Low', 'Value flagged (₹)', 'Result'],
      ...run.results.map((r) => [r.id, r.name, r.population, r.count, r.severity?.High ?? 0, r.severity?.Medium ?? 0, r.severity?.Low ?? 0, Math.round(r.value || 0), r.skipped ? 'Skipped – ' + r.reason : r.count ? 'Exceptions – auditor review' : 'No exceptions']),
      [], ['', 'Records tested', run.recordsTested], ['', 'Reporting threshold (₹)', run.threshold],
      ['', 'Exceptions are records that break a rule. They are not findings until reviewed.']]
  };
  const settings = {
    name: 'Run settings', widths: [26, 34, 90], titleRows: [0], headerRows: [4], wrapCols: [2],
    rows: [...head('Run record and parameters'), ['Item', 'Key', 'Value'],
      ['Run', 'ID', run.id], ['Run', 'Started', run.startedAt], ['Run', 'Rule library', run.ruleLibrary],
      ['Run', 'Period', `${run.period.from} to ${run.period.to}`], ['Run', 'Threshold (₹)', String(run.threshold)],
      ...Object.entries(run.params).flatMap(([id, ps]) => Object.entries(ps).map(([k, v]) => [`Parameter ${id}`, k, String(v)])),
      ...run.datasets.map((d) => ['Dataset', d.name, `${d.fileName} · ${d.count} records · SHA-256 ${d.sha256}`]),
      ...run.events.map((e) => ['Event', e.at, `${e.by}: ${e.text}`])]
  };
  const dq = {
    name: 'Data quality', widths: [26, 34, 10, 70], titleRows: [0], headerRows: [4], wrapCols: [3],
    rows: [...head('Data quality – completeness and accuracy'), ['Extract', 'Check', 'Result', 'Detail'],
      ...run.datasets.flatMap((d) => d.checks.map((c) => [d.name, c.name, c.result, c.detail]))]
  };
  const exSheet = {
    name: 'Exceptions', widths: [10, 7, 9, 7, 34, 34, 14, 12, 18, 24, 80], titleRows: [0], headerRows: [4], freeze: 5, wrapCols: [10],
    rows: [...head(`Exceptions (${scope === 'confirmed' ? 'confirmed only' : 'all statuses'})`),
      ['ID', 'Control', 'Severity', 'Score', 'Record', 'Party', 'Amount (₹)', 'Status', 'Owner', 'Root cause', 'Condition'],
      ...exs.map((e) => [e.id, e.control, e.severity, e.score, e.record, e.party, e.amount ?? '', e.status, e.owner, e.rootCause, opts.mask ? maskText(e.condition) : e.condition])]
  };
  const perTest = run.results.filter((r) => !r.skipped).map((r) => {
    const rule = RULE_BY_ID[r.id];
    const list = exs.filter((e) => e.control === r.id);
    return {
      name: `${r.id} test`, widths: [30, 100], titleRows: [0], headerRows: [], wrapCols: [1],
      rows: [...head(`${r.id} · ${r.name}`),
        ['Risk / assertion', `${rule.risk} · ${rule.assertion} · COSO ${rule.coso}`],
        ['Logic', rule.logic],
        ['Parameters', Object.entries(run.params[r.id] || {}).map(([k, v]) => `${k}=${v}`).join(' · ')],
        ['Population', `${r.population} ${r.populationLabel} (100% tested)`],
        ['Exceptions', `${r.count} · ₹${inr(r.value)} flagged`],
        ...(r.summary?.disallowance !== undefined ? [['s.43B(h) disallowance', `₹${inr(r.summary.disallowance)}`], ['MSMED interest (est.)', `₹${inr(r.summary.interest)}`]] : []),
        ...r.notes.map((n) => ['Note', n]),
        ['Conclusion', r.count ? 'Exceptions found – conclusion after auditor review of each item' : 'No exceptions in the population'],
        [],
        ['Exception', 'Detail'],
        ...list.flatMap((e) => [[`${e.id} · ${e.severity} ${e.score}`, `${e.record} · ${e.party} · status ${e.status}`], ...e.facts.map((f) => [`  ${f.k}`, `${f.bad ? '✗ ' : ''}${opts.mask ? maskText(f.v) : f.v}`])])]
    };
  });
  const obs = observationsFor(run, { includeAll: scope !== 'confirmed' });
  const obsSheet = {
    name: 'Observations', widths: [24, 100], titleRows: [0], headerRows: [], wrapCols: [1],
    rows: [...head('Draft observations'), ...obs.flatMap((o) => [[`${o.ref} · ${o.rating}`, o.title], ...o.sections.map((s) => [s.label, s.text]), []])]
  };
  const bytes = writeXLSX([summary, settings, dq, exSheet, ...perTest, obsSheet]);
  return { name: `${stamp(run)}_working_paper.xlsx`, mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', bytes };
}

const escH = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Self-contained report (HTML) — printed to PDF from the browser. */
export function reportHTML(run, scope, opts = {}) {
  const obs = observationsFor(run, { includeAll: scope !== 'confirmed' });
  const exs = scopeExceptions(run, scope);
  const draft = isDraft(run);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escH(run.id)} – P2P controls report</title>
<style>body{font:11pt/1.5 Arial,sans-serif;color:#111;margin:32px;max-width:900px}h1{font-size:20pt;margin:0 0 4px}h2{font-size:13pt;border-bottom:2px solid #111;padding-bottom:4px;margin-top:28px}h3{font-size:11.5pt;margin:18px 0 6px}table{border-collapse:collapse;width:100%;font-size:9.5pt}th,td{border:1px solid #999;padding:5px 7px;text-align:left;vertical-align:top}th{background:#eee}.meta{color:#444;font-size:9.5pt}.draft{color:#a00;font-weight:bold;border:2px solid #a00;padding:4px 10px;display:inline-block}.lab{width:22%;font-weight:bold;background:#f6f6f6}@media print{body{margin:12mm}}</style></head><body>
<h1>P2P controls testing report</h1>
<p class="meta">${escH(run.id)} · ${escH(run.ruleLibrary)} · period ${fmtDate(run.period.from)} to ${fmtDate(run.period.to)} · ${run.recordsTested.toLocaleString('en-IN')} records tested · ${escH(signLine(run))}</p>
${draft ? '<p class="draft">DRAFT – not yet reviewed</p>' : ''}
<h2>Summary</h2>
<table><tr><th>Control</th><th>Test</th><th>Population</th><th>Exceptions</th><th>High / Med / Low</th><th>Value flagged (₹)</th></tr>
${run.results.map((r) => `<tr><td>${r.id}</td><td>${escH(r.name)}</td><td>${r.population.toLocaleString('en-IN')} ${escH(r.populationLabel || '')}</td><td>${r.count}</td><td>${r.severity ? `${r.severity.High} / ${r.severity.Medium} / ${r.severity.Low}` : '—'}</td><td>${inr(r.value)}</td></tr>`).join('')}
</table>
<h2>Observations (${obs.length})</h2>
${obs.length ? obs.map((o) => `<h3>${o.ref}. ${escH(o.title)} – ${o.rating}</h3><table>${o.sections.map((s) => `<tr><td class="lab">${escH(s.label)}</td><td>${escH(opts.mask ? maskText(s.text) : s.text)}</td></tr>`).join('')}</table>`).join('') : '<p>No exceptions have been confirmed yet.</p>'}
<h2>Exceptions (${exs.length}, ${scope === 'confirmed' ? 'confirmed only' : 'all statuses'})</h2>
<table><tr><th>ID</th><th>Control</th><th>Severity</th><th>Record</th><th>Party</th><th>Amount (₹)</th><th>Status</th></tr>
${exs.map((e) => `<tr><td>${e.id}</td><td>${e.control}</td><td>${e.severity} ${e.score}</td><td>${escH(e.record)}</td><td>${escH(e.party)}</td><td>${e.amount == null ? '—' : inr(e.amount)}</td><td>${escH(e.status)}</td></tr>`).join('')}
</table>
<h2>Basis of preparation</h2>
<p>Data: ${run.datasets.map((d) => `${escH(d.name)} (${d.count.toLocaleString('en-IN')} records, SHA-256 ${d.sha256.slice(0, 16)}…)`).join('; ')}.</p>
<p>Severity score: risk rating (High ${SCORE_MODEL.risk.High}, Medium ${SCORE_MODEL.risk.Medium}) + amount band (up to ${SCORE_MODEL.amountBands[0].pts}) + fraud indicator (${SCORE_MODEL.fraudIndicator}) + money paid out (${SCORE_MODEL.moneyOut}). High ≥ ${SCORE_MODEL.severity.high}, Medium ≥ ${SCORE_MODEL.severity.medium}.</p>
<p class="meta">Generated by P2P Control Testing Engine © Srijan Upadhyay. Results are rule-based exceptions for auditor review, not audit opinions.</p>
</body></html>`;
  return { name: `${stamp(run)}_report.html`, mime: 'text/html', text: html };
}

const escX = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const para = (text, { bold = false, size = 21, color } = {}) => `<w:p><w:r><w:rPr>${bold ? '<w:b/>' : ''}<w:sz w:val="${size}"/>${color ? `<w:color w:val="${color}"/>` : ''}<w:rFonts w:ascii="Arial" w:hAnsi="Arial"/></w:rPr><w:t xml:space="preserve">${escX(text)}</w:t></w:r></w:p>`;

/** Editable observations draft (.docx), built directly as Office Open XML. */
export function observationsDOCX(run, scope, opts = {}) {
  const obs = observationsFor(run, { includeAll: scope !== 'confirmed' });
  const body = [
    para('P2P controls – draft observations', { bold: true, size: 32 }),
    para(`${run.id} · ${run.ruleLibrary} · period ${fmtDate(run.period.from)} to ${fmtDate(run.period.to)}`, { size: 18, color: '555555' }),
    para(signLine(run), { size: 18, color: '555555' }),
    ...(isDraft(run) ? [para('DRAFT – not yet reviewed', { bold: true, color: 'AA0000' })] : []),
    ...(obs.length ? obs.flatMap((o) => [para(''), para(`${o.ref}. ${o.title} – ${o.rating}`, { bold: true, size: 26 }), ...o.sections.flatMap((s) => [para(s.label, { bold: true }), para(opts.mask ? maskText(s.text) : s.text)])]) : [para('No exceptions have been confirmed yet.')])
  ].join('');
  const files = {
    '[Content_Types].xml': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
    '_rels/.rels': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
    'word/document.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr></w:body></w:document>`)
  };
  return { name: `${stamp(run)}_observations.docx`, mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', bytes: zipSync(files) };
}

export function evidencePack(run, scope, opts = {}) {
  const parts = [workpaperXLSX(run, scope, opts), reportHTML(run, scope, opts), observationsDOCX(run, scope, opts), exceptionsCSV(run, scope, opts), runJSON(run, scope), dataQualityCSV(run)];
  const files = {};
  for (const p of parts) files[p.name] = p.bytes || strToU8(p.text);
  files['README.txt'] = strToU8([
    `Evidence pack – ${run.id}`, `Rule library: ${run.ruleLibrary}`, `Period: ${run.period.from} to ${run.period.to}`, signLine(run), isDraft(run) ? 'Status: DRAFT – not reviewed' : 'Status: reviewed', '',
    'Source data fingerprints (SHA-256):', ...run.datasets.map((d) => `  ${d.fileName}  ${d.count} records  ${d.sha256}`), '',
    'Contents:', ...parts.map((p) => '  ' + p.name), '', 'Generated by P2P Control Testing Engine © 2026 Srijan Upadhyay. All rights reserved; use requires permission (see LICENSE).'
  ].join('\n'));
  return { name: `${stamp(run)}_evidence_pack.zip`, mime: 'application/zip', bytes: zipSync(files) };
}
