import { html } from 'htm/preact';
import { inr, lakh, fmtDate } from '../../engine/util.js';
import { SEV } from '../components.js';

const SUBS = ['Vendor master', 'Purchase orders', 'Invoice processing', 'Payments', 'SAP access'];
const shade = (n, k) => {
  if (!n) return { background: 'var(--inset)', color: 'var(--faint)' };
  if (k === 'High') return { background: n > 1 ? '#7A2A27' : '#4A1F1E', color: '#FFD6D2' };
  if (k === 'Medium') return { background: n > 1 ? '#6B4A12' : '#3D2C0C', color: '#FFE3B0' };
  return { background: '#2A3440', color: 'var(--text)' };
};

export function Results({ st, a }) {
  const run = st.run;
  if (!run) return html`<main class="page"><div class="card empty">No run yet. Load data and run the tests first.</div></main>`;
  const ex = run.exceptions;
  const count = (f) => ex.filter(f).length;
  const value = ex.reduce((s, e) => s + (e.amount || 0), 0);
  const ran = run.results.filter((r) => !r.skipped);
  const clean = ran.filter((r) => r.count === 0);
  const sev = { High: count((e) => e.severity === 'High'), Medium: count((e) => e.severity === 'Medium'), Low: count((e) => e.severity === 'Low') };
  const controlsHit = new Set(ex.map((e) => e.control)).size;
  const c18 = run.results.find((r) => r.id === 'C18');
  const manual = run.demo && run.exceptions.some((e) => e.key === 'CD004642') && run.exceptions.some((e) => /KUT\/23-24\/1473/.test(e.record));

  return html`<main class="page">
    <section class="head">
      <div><h1>Results</h1><p class="mono" style="font-size:12px">${run.id} · ${run.ruleLibrary} · full population · ${fmtDate(run.period.from)} → ${fmtDate(run.period.to)} · run by ${run.signoff.preparer?.name || run.events[0]?.by}</p></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn" onClick=${() => a.go('report')}>Export</button>
        <button class="btn primary" onClick=${() => a.reviewWith({})}>Review ${ex.length} exceptions →</button>
      </div>
    </section>

    <section aria-label="Key figures" class="grid-auto">
      <div class="kpi"><span class="kl">Records tested</span><span class="kv">${run.recordsTested.toLocaleString('en-IN')}</span><span class="ks">100% of population · ${run.datasets.length} extracts</span></div>
      <div class="kpi"><span class="kl">Exceptions</span><span class="kv" style="color:var(--red)">${ex.length}</span><span class="ks">across ${controlsHit} of ${ran.length} controls</span></div>
      <div class="kpi"><span class="kl">High severity</span><span class="kv" style="color:var(--red)">${sev.High}</span><span class="ks">${sev.Medium} medium · ${sev.Low} low</span></div>
      <div class="kpi"><span class="kl">Value flagged</span><span class="kv">${lakh(value)}</span><span class="ks">sum of amounts on flagged records</span></div>
      <div class="kpi"><span class="kl">Controls clean</span><span class="kv" style="color:var(--green)">${clean.length} / ${ran.length}</span><span class="ks">${clean.map((r) => r.id).join(', ') || 'none'}</span></div>
    </section>

    <div class="row" style="align-items:stretch">
      <section class="card pad grow stack" aria-labelledby="hm-h" style="flex-basis:520px">
        <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap"><h2 id="hm-h" class="h2">Heatmap · sub-process × severity</h2><span class="muted" style="font-size:12px">Select a cell to filter the review list</span></div>
        <div class="heat">
          <span></span><span class="kl" style="text-align:center">High</span><span class="kl" style="text-align:center">Medium</span><span class="kl" style="text-align:center">Low</span><span class="kl" style="text-align:right">Total</span>
          ${SUBS.map((s) => {
            const row = ['High', 'Medium', 'Low'].map((k) => count((e) => e.subprocess === s && e.severity === k));
            return html`<span class="t2" style="font-size:13px">${s}</span>
              ${row.map((n, i) => { const k = ['High', 'Medium', 'Low'][i]; return html`<button class="hm" style=${shade(n, k)} disabled=${!n} aria-label=${`${s} ${k}: ${n}`} onClick=${() => a.reviewWith({ subprocess: [s], severity: [k] })}>${n}</button>`; })}
              <span class="mono" style="text-align:right;font-weight:600">${row.reduce((x, y) => x + y, 0)}</span>`;
          })}
        </div>
        <p class="muted" style="margin:0;font-size:12px">Goods receipt has no automated test in v1.0; it is covered by the manual gate-to-GRN reconciliation (C10).</p>
      </section>
      <section class="card pad side stack" aria-labelledby="cmp-h" style="gap:16px">
        <h2 id="cmp-h" class="h2">${manual ? 'Sampling vs full population' : 'Coverage'}</h2>
        ${manual ? html`
          <div class="stack" style="gap:6px"><div style="display:flex;justify-content:space-between;font-size:13px"><span class="t2">Manual sampling · 3 controls</span><span class="mono">75 items · 2 exceptions</span></div>
          <div class="progress" style="height:10px"><div style="width:0.6%;min-width:4px;height:10px;background:var(--muted)"></div></div></div>
          <div class="stack" style="gap:6px"><div style="display:flex;justify-content:space-between;font-size:13px"><span class="t2">Engine · ${ran.length} controls</span><span class="mono">${run.recordsTested.toLocaleString('en-IN')} records · ${ex.length} exceptions</span></div>
          <div class="progress" style="height:10px"><div style="width:100%;height:10px"></div></div></div>
          <p class="t2" style="margin:0;font-size:13px;line-height:1.55">Both exceptions from the manual tests in the full pack (C02 sample 11, C13 sample 18) are among the ${ex.length}. The rest come from controls and records the sample did not reach.</p>`
        : html`<p class="t2" style="margin:0;font-size:13px;line-height:1.55">Every record in each population was tested. A manual test would typically sample 25 items per control.</p>`}
        ${c18?.summary && html`<div style="border-top:1px solid var(--line);padding-top:12px" class="stack">
          <span class="kl">MSME exposure (C18)</span>
          <div style="display:flex;justify-content:space-between;font-size:13px"><span class="t2">s.43B(h) disallowance at year-end</span><span class="mono">₹${inr(c18.summary.disallowance)}</span></div>
          <div style="display:flex;justify-content:space-between;font-size:13px"><span class="t2">MSMED interest (estimate)</span><span class="mono">₹${inr(c18.summary.interest)}</span></div>
        </div>`}
      </section>
    </div>

    <section class="card" aria-labelledby="ctl-h" style="overflow:hidden">
      <div class="card-head"><h2 id="ctl-h" class="h2">By control</h2><span class="muted" style="font-size:13px">The operating conclusion is the auditor's call after review</span></div>
      <div class="tbl-wrap"><table class="tbl" style="min-width:1060px">
        <thead><tr><th>Control</th><th>Test</th><th class="num">Population</th><th class="num">Exceptions</th><th>Rate</th><th>Severity</th><th class="num">Value flagged (₹)</th><th>Result</th><th><span class="sr">Open</span></th></tr></thead>
        <tbody>${run.results.map((r) => html`<tr>
          <td class="mono" style="color:var(--amber)">${r.id}</td>
          <td style="font-weight:600">${r.name}${r.notes?.length ? html`<div class="muted" style="font-weight:400;font-size:12px">${r.notes.join(' ')}</div>` : ''}</td>
          <td class="num t2">${r.skipped ? '—' : `${r.population.toLocaleString('en-IN')} ${r.populationLabel}`}</td>
          <td class="num" style="font-weight:600">${r.skipped ? '—' : r.count}</td>
          <td class="mono t2">${r.skipped || !r.population ? '—' : ((r.count / r.population) * 100).toFixed(r.count / r.population < 0.01 ? 2 : 1) + '%'}</td>
          <td>${r.skipped ? '' : html`<span class="chip H">H ${r.severity.High}</span> <span class="chip M">M ${r.severity.Medium}</span> <span class="chip L">L ${r.severity.Low}</span>`}</td>
          <td class="num">${r.skipped ? '—' : r.id === 'C20' ? 'n/a' : inr(r.value)}</td>
          <td>${r.skipped ? html`<span class="chip L">Skipped</span>` : r.count ? html`<span class="chip H">Exceptions</span>` : html`<span class="chip PASS">No exceptions</span>`}</td>
          <td style="text-align:right">${!r.skipped && r.count > 0 && html`<button class="btn link small" onClick=${() => a.reviewWith({ control: [r.id] })}>Review →</button>`}</td>
        </tr>`)}</tbody>
      </table></div>
    </section>
  </main>`;
}
