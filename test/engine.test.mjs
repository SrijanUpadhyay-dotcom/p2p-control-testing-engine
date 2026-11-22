// Engine tests: run with `npm test` (Node 20+).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demoFiles, PLANTED, COUNTS } from '../src/demo/generator.js';
import { readTables, prepareExtract, runTests, defaultParams, RULES } from '../src/engine/index.js';
import { parseCSV, toCSV, parseDate, parseAmount, inr } from '../src/engine/util.js';
import { readXLSX, writeXLSX } from '../src/engine/xlsx.js';
import { normInvoiceNo } from '../src/engine/rules/c14-duplicates.js';
import { msmeInterest } from '../src/engine/rules/c18-msme.js';

const period = { from: '2023-04-01', to: '2024-03-31' };
let prepared, run;

async function demoRun() {
  if (run) return run;
  const files = demoFiles();
  prepared = {};
  for (const [id, text] of Object.entries(files)) {
    const [{ rows }] = readTables(id + '.csv', text);
    prepared[id] = await prepareExtract({ id, fileName: id + '.csv', rows, raw: text, period });
  }
  const data = Object.fromEntries(Object.entries(prepared).map(([k, v]) => [k, v.records]));
  run = runTests({ data, period, params: defaultParams(), selected: RULES.map((r) => r.id), threshold: 10000, user: { name: 'Test', role: 'Preparer' } });
  return run;
}

test('demo data has the documented volumes', async () => {
  await demoRun();
  assert.equal(prepared.purchase_orders.count, COUNTS.purchase_orders);
  assert.equal(prepared.invoices.count, COUNTS.invoices);
  assert.equal(prepared.mrbr_releases.count, COUNTS.mrbr_releases);
  assert.equal(prepared.vendor_changes.count, 64);
  assert.equal(prepared.vendors.count, COUNTS.vendors);
  assert.equal(prepared.user_access.count, COUNTS.roleRows);
  assert.equal(new Set(prepared.user_access.records.map((r) => r.BNAME)).size, COUNTS.users);
});

test('every rule finds exactly the planted exceptions', async () => {
  const r = await demoRun();
  for (const res of r.results) assert.equal(res.count, PLANTED[res.id], `${res.id}: expected ${PLANTED[res.id]}, got ${res.count} — ${r.exceptions.filter((e) => e.control === res.id).map((e) => e.record).join(' | ')}`);
});

test('planted exceptions carry the right facts', async () => {
  const r = await demoRun();
  const c02 = r.exceptions.find((e) => e.control === 'C02');
  assert.equal(c02.key, 'CD004642');
  assert.equal(c02.amount, 462180);
  const c13 = r.exceptions.find((e) => e.control === 'C13');
  assert.match(c13.record, /KUT\/23-24\/1473/);
  assert.equal(c13.amount, 38400);
  const c20 = r.exceptions.filter((e) => e.control === 'C20').map((e) => e.key).sort();
  assert.deepEqual(c20, ['DRAVAL-SoD-04', 'PSHAH-SoD-01']);
  const c18 = r.results.find((x) => x.id === 'C18');
  assert.equal(c18.summary.disallowance, 96300);
  assert.equal(c18.summary.excluded, 0);
});

test('data quality flags the three blank value dates and nothing else fails', async () => {
  await demoRun();
  const blanks = prepared.payments.checks.find((c) => c.id === 'blanks');
  assert.equal(blanks.result, 'WARN');
  assert.equal(blanks.affected.length, 3);
  for (const p of Object.values(prepared)) assert.ok(!p.checks.some((c) => c.result === 'FAIL'), p.id + ' has a FAIL');
});

test('invoices file is mapped through aliases', async () => {
  await demoRun();
  assert.equal(prepared.invoices.mapping.BELNR, 'Doc No');
  assert.equal(prepared.invoices.mapping.RMWWR, 'Gross Amt');
});

test('run is deterministic', async () => {
  const a = demoFiles(), b = demoFiles();
  assert.equal(a.invoices, b.invoices);
});

test('helpers', () => {
  assert.deepEqual(parseCSV('a,b\n"x,1","y""z"\n'), [['a', 'b'], ['x,1', 'y"z']]);
  assert.equal(toCSV([{ a: 'x,1' }], ['a']), 'a\n"x,1"\n');
  assert.equal(parseDate('03.01.2024'), '2024-01-03');
  assert.equal(parseDate('3-Jan-2024'), '2024-01-03');
  assert.equal(parseDate('2024-01-03'), '2024-01-03');
  assert.equal(parseDate('31/02/2024'), null);
  assert.equal(parseDate(45294), '2024-01-03');
  assert.equal(parseAmount('15,38,400.00'), 1538400);
  assert.equal(parseAmount('(1,000)'), -1000);
  assert.equal(inr(1538400), '15,38,400');
  assert.equal(normInvoiceNo('TFW/1182'), normInvoiceNo('TFW-1182'));
  assert.equal(normInvoiceNo('RL 0457'), normInvoiceNo('RL457'));
  assert.notEqual(normInvoiceNo('RL/23-24/0457'), normInvoiceNo('RL457'));
  assert.ok(Math.abs(msmeInterest(100000, 365, 6.75) - 100000 * (Math.pow(1 + 0.2025 / 12, 12) - 1)) < 1);
});

test('xlsx round trip', () => {
  const bytes = writeXLSX([{ name: 'Data', rows: [['A', 'B'], ['x & y', 12.5], ['<z>', 3]] }]);
  const book = readXLSX(bytes);
  assert.deepEqual(book.Data, [['A', 'B'], ['x & y', 12.5], ['<z>', 3]]);
});

test('exports build and are valid containers', async () => {
  const { workpaperXLSX, observationsDOCX, evidencePack, reportHTML, exceptionsCSV, runJSON } = await import('../src/export/index.js');
  const { unzipSync } = await import('fflate');
  const r = await demoRun();
  r.datasets = Object.values(prepared).map((p) => ({ id: p.id, name: p.name, fileName: p.fileName, count: p.count, sha256: p.sha256, checks: p.checks }));
  r.exceptions[0].status = 'Confirmed';
  r.exceptions[0].rootCause = 'Process not followed';
  const wp = workpaperXLSX(r, 'all');
  const book = readXLSX(wp.bytes);
  assert.ok(book.Summary && book.Exceptions && book['C02 test']);
  assert.equal(book.Exceptions.length, 5 + r.exceptions.length);
  const docx = unzipSync(observationsDOCX(r, 'confirmed').bytes);
  assert.ok(docx['word/document.xml']);
  const zip = unzipSync(evidencePack(r, 'all').bytes);
  assert.equal(Object.keys(zip).length, 7);
  assert.match(reportHTML(r, 'confirmed').text, /O1\./);
  assert.equal(exceptionsCSV(r, 'confirmed').text.trim().split('\n').length, 2);
  assert.equal(JSON.parse(runJSON(r, 'all').text).status, 'DRAFT');
});
