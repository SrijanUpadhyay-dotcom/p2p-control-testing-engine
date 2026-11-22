import { html } from 'htm/preact';
import { RULES, RULE_LIBRARY_VERSION, countTested } from '../../engine/index.js';
import { RISKS } from '../../engine/rcm.js';
import { Icon, SEV } from '../components.js';

export function Tests({ st, up, a }) {
  const data = Object.fromEntries(Object.entries(st.extracts).map(([k, v]) => [k, v.records]));
  const n = countTested(data);
  const runnable = (r) => r.needs.every((x) => st.extracts[x]);
  const toggle = (id) => up((s) => ({ selected: s.selected.includes(id) ? s.selected.filter((x) => x !== id) : [...s.selected, id] }));
  const setParam = (rid, key, val) => up((s) => ({ params: { ...s.params, [rid]: { ...s.params[rid], [key]: val } } }));
  const chosen = st.selected.filter((id) => runnable(RULES.find((r) => r.id === id)));
  const setPeriod = (k, v) => up((s) => ({ period: { ...s.period, [k]: v } }));

  return html`<main class="page">
    <section class="head">
      <div><h1>Test library</h1><p>Seven automated tests, each mapped to a control, risk, assertion and COSO principle in the P2P RCM. Parameters are set before the run and locked into the run record.</p></div>
      <button class="btn primary" disabled=${!chosen.length} onClick=${a.runNow}><${Icon} name="play" size=${16} />Run ${chosen.length} test${chosen.length === 1 ? '' : 's'} on ${n.toLocaleString('en-IN')} records</button>
    </section>

    <section class="card pad stack" aria-labelledby="set-h">
      <h2 id="set-h" class="h2">Run settings</h2>
      <div class="grid-auto">
        <label class="field">Period from<input class="inp mono" type="date" value=${st.period.from} onChange=${(e) => setPeriod('from', e.target.value)} /></label>
        <label class="field">Period to<input class="inp mono" type="date" value=${st.period.to} onChange=${(e) => setPeriod('to', e.target.value)} /></label>
        <label class="field">Coverage<select class="inp"><option>Full population (100%)</option></select></label>
        <label class="field">Reporting threshold (₹)<input class="inp mono" inputmode="numeric" value=${st.threshold} onInput=${(e) => up({ threshold: e.target.value })} /></label>
        <label class="field">Rule library<select class="inp"><option>${RULE_LIBRARY_VERSION} (FY 2023-24 law)</option></select></label>
      </div>
      <p class="muted" style="margin:0;font-size:12px">Exceptions below the threshold are still listed and scored lower. Run as: <strong class="t2">${st.user ? `${st.user.name} (${st.user.role})` : 'not signed in'}</strong>${st.user?.role !== 'Preparer' ? html` · <button class="btn link small" onClick=${() => up({ signIn: true })}>sign in as Preparer to run</button>` : ''}</p>
    </section>

    <section class="card" aria-labelledby="lib-h" style="overflow:hidden">
      <div class="card-head"><h2 id="lib-h" class="h2">Tests · ${chosen.length} selected</h2><span class="muted" style="font-size:13px">Defaults follow FY 2023-24 rules and the company DOA · edit any parameter</span></div>
      <div class="tbl-wrap"><table class="tbl" style="min-width:1180px">
        <thead><tr><th>Run</th><th>Test</th><th>Logic</th><th>Parameters</th><th>Risk</th><th>Assertion</th><th>COSO</th><th>Data</th></tr></thead>
        <tbody>${RULES.map((r) => {
          const ok = runnable(r);
          const rating = RISKS[r.risk]?.rating;
          return html`<tr style=${{ opacity: ok ? 1 : 0.5 }}>
            <td><input type="checkbox" checked=${ok && st.selected.includes(r.id)} disabled=${!ok} onChange=${() => toggle(r.id)} aria-label=${'Run ' + r.id} style="width:18px;height:18px" /></td>
            <td style="min-width:210px"><span class="mono" style="color:var(--amber);font-size:12px">${r.id} · ${r.type}</span><br /><span style="font-weight:600;font-size:14px">${r.name}</span></td>
            <td class="t2" style="max-width:340px;line-height:1.5">${r.logic}</td>
            <td style="min-width:230px"><div class="stack" style="gap:6px">${r.params.map((p) => html`<label class="field" style="font-size:11px">${p.label}
              <input class="inp compact" value=${st.params[r.id]?.[p.key] ?? p.default} disabled=${p.type === 'readonly'} onInput=${(e) => setParam(r.id, p.key, e.target.value)} /></label>`)}</div></td>
            <td><span class=${'chip ' + SEV[rating]}>${r.risk} ${rating}</span></td>
            <td class="t2">${r.assertion}</td>
            <td class="mono t2" style="font-size:12px">${r.coso}</td>
            <td class="mono muted" style="font-size:12px">${r.needs.map((x) => html`<div style=${{ color: st.extracts[x] ? 'var(--muted)' : 'var(--red)' }}>${x}${st.extracts[x] ? '' : ' ✕'}</div>`)}</td>
          </tr>`;
        })}</tbody>
      </table></div>
    </section>

    <section class="card pad stack" aria-labelledby="how-h">
      <h2 id="how-h" class="h2">What a run records</h2>
      <div class="grid-auto" style="grid-template-columns:repeat(auto-fit,minmax(230px,1fr))">
        ${[['Run ID & timestamp', 'Unique run reference, start and finish time, and who ran it.'], ['Dataset fingerprint', 'SHA-256 of each extract, so the same data can be shown to give the same result.'], ['Rule version & parameters', 'Library version and every parameter value used in this run.'], ['Data quality log', 'Checks passed, warnings, and any records excluded with the reason.']].map(([k, v]) => html`
          <div style="background:var(--inset);border:1px solid var(--line);border-radius:6px;padding:14px;display:flex;flex-direction:column;gap:6px"><span class="mono" style="color:var(--amber);font-size:12px">${k}</span><span class="t2" style="font-size:13px">${v}</span></div>`)}
      </div>
    </section>
  </main>`;
}
