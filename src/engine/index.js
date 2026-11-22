// Public engine API. Pure functions; runs in the browser and in Node.
import { EXTRACTS, EXTRACT_BY_ID, PERIOD_DEFAULT } from './schema.js';
import { autoMap, detectExtract, normalise, qualityChecks, overallQuality } from './intake.js';
import { parseCSV, sha256Hex } from './util.js';
import { readXLSX } from './xlsx.js';
import { runTests, STATUSES, ROOT_CAUSES, DEFAULT_OWNERS, countTested } from './run.js';
import { RULES, RULE_BY_ID, RULE_LIBRARY_VERSION, defaultParams } from './rules/index.js';

export { EXTRACTS, EXTRACT_BY_ID, PERIOD_DEFAULT, autoMap, detectExtract, runTests, STATUSES, ROOT_CAUSES, DEFAULT_OWNERS, RULES, RULE_BY_ID, RULE_LIBRARY_VERSION, defaultParams, countTested, overallQuality };

/** Turn a file (name + bytes or text) into one or more tables: [{ sheet, rows }] */
export function readTables(name, content) {
  if (/\.xlsx$/i.test(name)) {
    const book = readXLSX(content);
    return Object.entries(book).map(([sheet, rows]) => ({ sheet, rows: rows.map((r) => r.map((c) => (c === undefined ? '' : c))) }));
  }
  const text = typeof content === 'string' ? content : new TextDecoder().decode(content);
  return [{ sheet: null, rows: parseCSV(text) }];
}

/** Prepare one extract: map, normalise, check. */
export async function prepareExtract({ id, fileName, rows, raw, mapping, period = PERIOD_DEFAULT, expected = {} }) {
  const header = rows[0] || [];
  const auto = autoMap(id, header);
  const map = mapping || auto.mapping;
  const { records, issues, blank } = normalise(id, rows, map);
  const checks = qualityChecks(id, records, map, period, expected, { issues, blank });
  const sha256 = await sha256Hex(raw ?? JSON.stringify(rows));
  return {
    id, name: EXTRACT_BY_ID[id].name, fileName, header, mapping: map, how: mapping ? {} : auto.how,
    records, checks, quality: overallQuality(checks), sha256,
    count: records.length
  };
}
