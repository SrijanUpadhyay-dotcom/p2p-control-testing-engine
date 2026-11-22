// Orchestrates a run: index data, execute selected rules, score, build the run record.
import { RULES, RULE_BY_ID, RULE_LIBRARY_VERSION } from './rules/index.js';
import { scoreException } from './scoring.js';
import { RISKS } from './rcm.js';
import { parseAmount } from './util.js';

export const DEFAULT_OWNERS = { C02: 'Finance Controller', C06: 'Purchase Head', C09: 'Purchase Head', C13: 'AP Lead', C14: 'AP Lead', C18: 'Finance Controller', C20: 'IT Head' };
export const STATUSES = ['New', 'In review', 'Confirmed', 'False positive', 'Remediated'];
export const ROOT_CAUSES = ['Process not followed', 'Control design gap', 'System configuration', 'Data or master-data error', 'Override / pressure', 'Other'];

function buildIndex(data) {
  const group = (rows, key) => {
    const m = new Map();
    for (const r of rows || []) { const k = r[key]; if (k === null || k === undefined) continue; if (!m.has(k)) m.set(k, []); m.get(k).push(r); }
    return m;
  };
  return {
    paymentsByInvoice: group(data.payments, 'BELNR'),
    paymentsByVendor: group(data.payments, 'LIFNR'),
    invoicesByPO: group(data.invoices, 'EBELN')
  };
}

export function countTested(data) {
  const users = new Set((data.user_access || []).map((r) => r.BNAME)).size;
  return (data.vendor_changes?.length || 0) + (data.purchase_orders?.length || 0) + (data.invoices?.length || 0) +
    (data.mrbr_releases?.length || 0) + (data.payments?.length || 0) + users;
}

/**
 * @param {object} o
 * @param {object} o.data      { extractId: records[] }
 * @param {object} o.period    { from, to } ISO dates
 * @param {object} o.params    { ruleId: { key: value } }
 * @param {string[]} o.selected rule ids to run
 * @param {number|string} o.threshold reporting threshold (₹)
 */
export function runTests({ data, period, params, selected, threshold, runId, user, datasets = [], quality = [] }) {
  const started = new Date().toISOString();
  const vendors = new Map((data.vendors || []).map((v) => [v.LIFNR, v]));
  const ctx = { data, period, vendors, idx: buildIndex(data) };
  const thr = parseAmount(threshold) ?? 10000;
  const results = [];
  const exceptions = [];
  for (const rule of RULES) {
    if (!selected.includes(rule.id)) continue;
    const missing = rule.needs.filter((n) => !data[n] || !data[n].length);
    if (missing.length) { results.push({ id: rule.id, name: rule.name, skipped: true, reason: `Missing extract: ${missing.join(', ')}`, population: 0, count: 0, value: 0 }); continue; }
    const res = rule.run(ctx, params[rule.id] || {});
    const sev = { High: 0, Medium: 0, Low: 0 };
    let value = 0;
    for (const ex of res.exceptions) {
      const s = scoreException(ex, rule, thr);
      sev[s.severity]++;
      value += ex.amount || 0;
      exceptions.push({
        ...ex,
        control: rule.id,
        controlName: rule.name,
        risk: rule.risk,
        riskRating: RISKS[rule.risk]?.rating,
        subprocess: rule.subprocess,
        assertion: rule.assertion,
        coso: rule.coso,
        score: s.score,
        severity: s.severity,
        scoreParts: s.parts,
        belowThreshold: ex.amount !== null && ex.amount !== undefined && ex.amount < thr,
        status: 'New',
        owner: DEFAULT_OWNERS[rule.id] || '',
        rootCause: '',
        note: '',
        log: [{ at: started, by: 'engine', text: `Flagged by rule ${rule.id} (${RULE_LIBRARY_VERSION})` }]
      });
    }
    results.push({ id: rule.id, name: rule.name, population: res.population, populationLabel: popLabel(rule), count: res.exceptions.length, value, severity: sev, summary: res.summary || null, notes: res.notes || [] });
  }
  exceptions.forEach((e, i) => { e.id = 'EX-' + String(i + 1).padStart(4, '0'); });
  return {
    schema: 'p2p-cte/run@1',
    id: runId || 'RUN-' + started.slice(0, 10).replace(/-/g, '') + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(),
    startedAt: started,
    finishedAt: new Date().toISOString(),
    ruleLibrary: RULE_LIBRARY_VERSION,
    period,
    threshold: thr,
    params: Object.fromEntries(selected.map((id) => [id, params[id] || {}])),
    selected,
    recordsTested: countTested(data),
    datasets,
    quality,
    results,
    exceptions,
    signoff: { preparer: user && user.role === 'Preparer' ? { name: user.name, org: user.org || '', at: null } : null, reviewer: null },
    events: [{ at: started, by: user?.name || 'unknown', text: `Run started by ${user?.name || 'unknown'} (${user?.role || '—'})` }]
  };
}

function popLabel(rule) {
  return { C02: 'changes', C06: 'POs', C09: 'POs', C13: 'releases', C14: 'invoices', C18: 'MSME invoices', C20: 'users' }[rule.id] || 'records';
}

export { RULES, RULE_BY_ID };
