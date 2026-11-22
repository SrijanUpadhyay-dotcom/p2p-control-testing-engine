import { html } from 'htm/preact';
import { useState, useRef } from 'preact/hooks';
import { Shield, Icon } from '../components.js';
import { RoleFields } from './signin.js';

const STEPS = [
  ['01', 'Data intake', 'Upload SAP extracts, map columns to SAP fields, pass completeness and accuracy checks.'],
  ['02', 'Test library', 'Choose tests and set parameters such as DOA limits and the MSME 45-day rule.'],
  ['03', 'Results', 'See exceptions by control and sub-process across the full population.'],
  ['04', 'Exception review', 'Filter, assign, investigate and confirm or dismiss each exception.'],
  ['05', 'Report and export', 'Draft observations, sign off, and download working papers and the evidence pack.']
];

export function Start({ st, a }) {
  const [v, set] = useState(st.user || { name: '', org: '', role: 'Preparer' });
  const [busy, setBusy] = useState(false);
  const fileRef = useRef();
  const ok = v.name.trim().length >= 2;
  const begin = async (path) => {
    if (!ok) { a.toast('Enter your name to start'); return; }
    a.setUser({ ...v, name: v.name.trim() });
    if (path === 'demo') { setBusy(true); await a.loadDemo(); setBusy(false); }
    else if (path === 'upload') a.go('intake');
    else fileRef.current.click();
  };
  const openFile = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try { a.openRun(JSON.parse(await f.text())); } catch { a.toast('That file is not a valid run file'); }
    e.target.value = '';
  };
  return html`<div style="min-height:100vh;display:flex;flex-direction:column">
    <header class="top"><div class="wrap"><div class="top-row">
      <div class="brand"><div class="logo"><${Shield} /></div><span class="brand-name">P2P Control Testing Engine</span><span class="brand-sub">v1.0</span></div>
      <span class="mono muted" style="font-size:12px">Runs in your browser · © Srijan Upadhyay</span>
    </div></div></header>
    <main class="wrap" style="flex:1;padding-top:48px;padding-bottom:48px;display:flex;flex-wrap:wrap;gap:48px;align-items:flex-start">
      <section style="flex:999 1 480px;min-width:0;display:flex;flex-direction:column;gap:28px">
        <div style="display:flex;flex-direction:column;gap:14px">
          <span class="mono" style="font-size:12px;color:var(--amber);letter-spacing:.08em">PROCURE-TO-PAY · CONTINUOUS CONTROLS MONITORING</span>
          <h1 style="margin:0;font-size:clamp(30px,5vw,44px);line-height:1.1;font-weight:600">Test every P2P transaction against your controls.</h1>
          <p class="t2" style="margin:0;font-size:17px;line-height:1.6;max-width:620px">Load SAP extracts, run seven rule-based tests from a P2P risk and control matrix over the full population, review each exception, and export audit-ready working papers.</p>
        </div>
        <ol class="timeline" aria-label="How a session runs">
          ${STEPS.map(([n, t, d]) => html`<li><span class="dot">${n}</span><div style="display:flex;flex-direction:column;gap:3px;padding-left:8px"><span style="font-weight:600;font-size:15px">${t}</span><span class="muted" style="font-size:13px">${d}</span></div></li>`)}
        </ol>
      </section>
      <section class="card pad" aria-labelledby="si-h" style="flex:1 1 380px;max-width:460px;display:flex;flex-direction:column;gap:18px">
        <div><h2 id="si-h" style="margin:0;font-size:20px;font-weight:600">Start a session</h2>
        <p class="muted" style="margin:6px 0 0;font-size:13px">No account needed. Your name and role go on the run record and sign-offs, and stay in this browser.</p></div>
        <${RoleFields} v=${v} set=${set} />
        <div class="stack" style="gap:10px">
          <span class="h2">Choose how to begin</span>
          <button class="path rec" onClick=${() => begin('demo')} disabled=${busy}>
            <span class="icon-box" style="width:40px;height:40px"><${Icon} name="play" color="var(--amber)" /></span>
            <span style="display:flex;flex-direction:column;gap:3px"><span style="font-weight:600">${busy ? 'Loading demo data…' : 'Try with demo data'} <span class="mono" style="font-size:11px;color:var(--amber);margin-left:6px">RECOMMENDED</span></span><span class="muted" style="font-size:12px">Fictional company, FY 2023-24, about 39,000 records with planted exceptions</span></span>
          </button>
          <button class="path" onClick=${() => begin('upload')}>
            <span class="icon-box" style="width:40px;height:40px"><${Icon} name="upload" /></span>
            <span style="display:flex;flex-direction:column;gap:3px"><span style="font-weight:600">Upload your own extracts</span><span class="muted" style="font-size:12px">CSV or XLSX in the template format; nothing leaves your browser</span></span>
          </button>
          <button class="path" onClick=${() => begin('open')}>
            <span class="icon-box" style="width:40px;height:40px"><${Icon} name="folder" /></span>
            <span style="display:flex;flex-direction:column;gap:3px"><span style="font-weight:600">Open a saved run</span><span class="muted" style="font-size:12px">Load a run file (.json) to review or sign off</span></span>
          </button>
          <input ref=${fileRef} type="file" accept=".json,application/json" class="sr" onChange=${openFile} aria-label="Open run file" />
          ${st.run && html`<button class="btn link" style="align-self:flex-start" onClick=${() => { if (ok) a.setUser({ ...v, name: v.name.trim() }); a.go('results'); }}>Continue ${st.run.id} →</button>`}
        </div>
      </section>
    </main>
    <footer style="border-top:1px solid var(--line)"><div class="wrap" style="padding-top:16px;padding-bottom:16px;display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;font-size:12px;color:var(--muted)">
      <span>© 2026 Srijan Upadhyay · all rights reserved · use beyond this demo needs permission · demo data is fictional</span>
      <span>A prototype, not a substitute for professional audit judgement</span>
    </div></footer>
  </div>`;
}
