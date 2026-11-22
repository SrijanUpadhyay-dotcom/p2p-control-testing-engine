import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { observationsFor } from '../../engine/observations.js';
import { workpaperXLSX, reportHTML, observationsDOCX, exceptionsCSV, runJSON, evidencePack, isDraft } from '../../export/index.js';
import { download, printHTML } from '../download.js';
import { SEV } from '../components.js';

const FORMATS = [
  ['xlsx', 'XLSX', 'Excel working paper', 'Summary, run settings, data quality, exceptions and one sheet per test.'],
  ['pdf', 'PDF', 'Audit report', 'Print-ready report: opens the print dialog (choose "Save as PDF"). Inside Claude it is saved as HTML to print.'],
  ['docx', 'DOCX', 'Observations draft', 'Editable observation write-ups for the management letter.'],
  ['csv', 'CSV', 'Exception list', 'Every exception with its fields, for filtering elsewhere.'],
  ['json', 'JSON', 'Run file', 'The full run: reopen it here later, or import into GRC or BI tools.'],
  ['zip', 'ZIP', 'Evidence pack', 'All of the above plus data fingerprints, data quality log and README.']
];
const now = () => new Date().toISOString();

export function Report({ st, up, a }) {
  const run = st.run;
  const [on, setOn] = useState(new Set(['xlsx', 'pdf', 'csv']));
  const [scope, setScope] = useState('confirmed');
  const [mask, setMask] = useState(true);
  const [idx, setIdx] = useState(0);
  const [warnSign, setWarnSign] = useState(false);
  if (!run) return html`<main class="page"><div class="card empty">No run yet.</div></main>`;
  const obs = observationsFor(run);
  const o = obs[Math.min(idx, obs.length - 1)];
  const open = run.exceptions.filter((e) => e.status === 'New' || e.status === 'In review').length;
  const prep = run.signoff.preparer, rev = run.signoff.reviewer;
  const me = st.user;
  const canPrep = me && me.role === 'Preparer' && !prep?.at && !rev;
  const canRev = me && me.role === 'Reviewer' && prep?.at && !rev && me.name !== prep.name;

  const sign = (who) => {
    if (who === 'reviewer' && open && !warnSign) { setWarnSign(true); return; }
    setWarnSign(false);
    a.updateRun((r) => ({
      ...r,
      signoff: { ...r.signoff, [who]: { name: me.name, org: me.org || '', at: now() } },
      events: [...r.events, { at: now(), by: me.name, text: `Signed off as ${who}` }]
    }));
    a.toast(who === 'reviewer' ? 'Reviewed. Exports are no longer marked draft; dispositions are locked.' : 'Signed as preparer');
  };
  const exportNow = async () => {
    const opts = { mask };
    const build = { xlsx: () => workpaperXLSX(run, scope, opts), docx: () => observationsDOCX(run, scope, opts), csv: () => exceptionsCSV(run, scope, opts), json: () => runJSON(run, scope), zip: () => evidencePack(run, scope, opts) };
    // One file at a time: the host may ask the viewer to confirm each save.
    for (const k of ['xlsx', 'docx', 'csv', 'json', 'zip']) {
      if (!on.has(k)) continue;
      const res = await download(build[k]());
      if (res === 'declined' || res === 'unavailable') { a.toast(res === 'declined' ? 'Download cancelled' : 'Downloads are not available in this view'); return; }
      await new Promise((r) => setTimeout(r, 250));
    }
    if (on.has('pdf')) await printHTML(reportHTML(run, scope, opts));
    a.updateRun((r) => ({ ...r, events: [...r.events, { at: now(), by: me?.name || 'unknown', text: `Exported ${[...on].join(', ')} (${scope}${mask ? ', masked' : ''})${isDraft(r) ? ' – DRAFT' : ''}` }] }));
  };
  const toggle = (k) => { const n = new Set(on); n.has(k) ? n.delete(k) : n.add(k); setOn(n); };

  return html`<main class="page">
    <section class="head"><div><h1>Report & export</h1><p>Confirmed exceptions become draft observations. Export the working papers, the report, or the full evidence pack.</p></div>
      <button class="btn" onClick=${() => download(runJSON(run, 'all'))}>Save run (.json)</button></section>

    <div class="row">
      <div class="grow stack" style="gap:16px">
        <section class="card pad stack" aria-labelledby="ob-h" style="gap:14px">
          <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px">
            <h2 id="ob-h" class="h2">Draft observations · ${obs.length} from confirmed exceptions</h2>
            <span class="muted" style="font-size:12px">${open} exception(s) still New or In review are not included</span>
          </div>
          ${obs.length ? html`
            <div style="display:flex;flex-wrap:wrap;gap:8px">${obs.map((x, i) => html`<button class="btn small" style=${i === idx ? 'border-color:var(--amber);color:var(--amber)' : ''} onClick=${() => setIdx(i)}>${x.ref} · ${x.control} · ${x.rating}</button>`)}</div>
            <article style="border:1px solid var(--line);border-radius:6px;background:var(--inset);padding:20px" class="stack">
              <div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;align-items:baseline">
                <h3 style="margin:0;font-size:18px;font-weight:600">${o.ref}. ${o.title}</h3><span class=${'chip ' + SEV[o.rating]}>${o.rating}</span></div>
              ${o.sections.map((s) => html`<div class="obs-grid">
                <div style="display:flex;flex-direction:column;gap:4px"><span class="kl">${s.label}</span><span style=${{ fontSize: '11px', color: s.source === 'auditor' ? 'var(--amber)' : 'var(--muted)' }}>${{ data: 'from the data', rcm: 'from the RCM', auditor: 'auditor input' }[s.source]}</span></div>
                <p style=${{ margin: 0, fontSize: '14px', lineHeight: 1.6, color: s.missing ? 'var(--amber)' : 'var(--text)' }}>${s.text}</p>
              </div>`)}
              <button class="btn link small" style="align-self:flex-start" onClick=${() => { up({ focus: o.exceptionId }); a.go('review'); }}>Edit cause and action plan in review →</button>
            </article>` : html`<div class="empty" style="border:1px dashed var(--line);border-radius:6px">No confirmed exceptions yet. Confirm exceptions in <button class="btn link small" onClick=${() => a.go('review')}>Exception review</button> to draft observations.</div>`}
        </section>

        <section class="card pad stack" aria-labelledby="tr-h" style="gap:8px">
          <h2 id="tr-h" class="h2">Run audit trail</h2>
          ${[
            ['Run', `${run.id} · ${run.ruleLibrary} · started ${run.startedAt.replace('T', ' ').slice(0, 16)} UTC`],
            ['Data', `${run.datasets.length} extracts · ${run.recordsTested.toLocaleString('en-IN')} records tested · SHA-256 fingerprints recorded`],
            ['Quality', run.datasets.map((d) => `${d.name}: ${d.quality === 'PASS' ? 'clean' : d.quality.toLowerCase()}`).join(' · ')],
            ['Parameters', `threshold ₹${run.threshold.toLocaleString('en-IN')} · ` + Object.entries(run.params).map(([id, p]) => `${id} ${Object.values(p).join('/')}`).join(' · ')],
            ['Results', `${run.results.length} tests · ${run.exceptions.length} exceptions · ${run.exceptions.filter((e) => e.status === 'Confirmed').length} confirmed · ${run.exceptions.filter((e) => e.status === 'False positive').length} false positives`],
            ['Sign-off', `Prepared: ${prep?.at ? prep.name : 'pending'} · Reviewed: ${rev ? rev.name : 'pending'}`]
          ].map(([k, v]) => html`<div style="display:grid;grid-template-columns:120px minmax(0,1fr);gap:12px;font-size:13px;padding:6px 0;border-bottom:1px solid var(--line-soft)"><span class="mono muted" style="font-size:12px">${k}</span><span class="t2">${v}</span></div>`)}
          <details><summary class="muted" style="cursor:pointer;font-size:12px">All events (${run.events.length})</summary>
            ${run.events.slice().reverse().map((e) => html`<div style="display:flex;gap:10px;font-size:12px;padding:3px 0"><span class="mono muted" style="min-width:140px">${e.at.replace('T', ' ').slice(0, 16)}</span><span class="t2">${e.by}: ${e.text}</span></div>`)}
          </details>
        </section>
      </div>

      <div class="side stack" style="gap:16px;flex-basis:380px">
        <section class="card pad stack" aria-labelledby="exp-h">
          <h2 id="exp-h" class="h2">Export</h2>
          ${FORMATS.map(([k, ext, name, d]) => html`<label class=${'fmt' + (on.has(k) ? ' on' : '')}>
            <input type="checkbox" checked=${on.has(k)} onChange=${() => toggle(k)} style="width:18px;height:18px;margin-top:2px" />
            <span class="ext">${ext}</span>
            <span style="display:flex;flex-direction:column;gap:3px"><span style="font-weight:600">${name}</span><span class="muted" style="font-size:12px">${d}</span></span>
          </label>`)}
          <fieldset style="border:0;margin:0;padding:4px 0 0;display:flex;flex-direction:column;gap:6px">
            <legend class="kl" style="padding-bottom:4px">Include</legend>
            <label class="fo"><input type="radio" name="scope" checked=${scope === 'confirmed'} onChange=${() => setScope('confirmed')} />Confirmed exceptions only</label>
            <label class="fo"><input type="radio" name="scope" checked=${scope === 'all'} onChange=${() => setScope('all')} />All exceptions with status</label>
            <label class="fo"><input type="checkbox" checked=${mask} onChange=${() => setMask(!mask)} />Mask long account numbers</label>
          </fieldset>
          <button class="btn primary" disabled=${!on.size} onClick=${exportNow}>Download ${on.size} file${on.size === 1 ? '' : 's'}</button>
          ${isDraft(run) && html`<p class="muted" style="margin:0;font-size:12px">Exports are marked DRAFT until a reviewer signs off.</p>`}
        </section>

        <section class="card pad stack" aria-labelledby="so-h">
          <h2 id="so-h" class="h2">Sign-off</h2>
          ${[['Prepared by · Preparer', prep, 'preparer', canPrep], ['Reviewed by · Reviewer', rev, 'reviewer', canRev]].map(([label, who, key, can]) => html`
            <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:12px;padding:12px;background:var(--inset);border:1px solid var(--line);border-radius:6px">
              <span style="display:flex;flex-direction:column;gap:3px"><span class="kl">${label}</span>
                <span style="font-size:14px;font-weight:600">${who?.at ? who.name : key === 'preparer' && who ? who.name : 'Not yet signed'}</span>
                ${who?.at && html`<span class="mono muted" style="font-size:11px">${who.at.replace('T', ' ').slice(0, 16)} UTC${who.org ? ' · ' + who.org : ''}</span>`}</span>
              ${who?.at ? html`<span class="chip PASS">Signed</span>` : can ? html`<button class="btn small primary" onClick=${() => sign(key)}>Sign as ${key}</button>` : html`<button class="btn small" onClick=${() => up({ signIn: true })} disabled=${key === 'reviewer' && !prep?.at}>Sign in as ${key}</button>`}
            </div>`)}
          ${warnSign && html`<p style="margin:0;font-size:13px;color:var(--amber)">${open} exception(s) are still New or In review. Select "Sign as reviewer" again to sign anyway.</p>`}
          <p class="muted" style="margin:0;font-size:12px">Anyone can sign as preparer or reviewer; the same person cannot do both on one run. After reviewer sign-off, dispositions are locked.</p>
        </section>
      </div>
    </div>
  </main>`;
}
