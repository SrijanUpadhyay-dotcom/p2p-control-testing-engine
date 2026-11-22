import { html } from 'htm/preact';
import { useState, useRef } from 'preact/hooks';
import { zipSync, strToU8 } from 'fflate';
import { EXTRACTS, RULES } from '../../engine/index.js';
import { templateFiles, DEMO_FILE_NAMES } from '../../demo/generator.js';
import { Icon } from '../components.js';
import { download } from '../download.js';

const feeds = (id) => RULES.filter((r) => r.needs.includes(id)).map((r) => r.id).join(' ');

export function Intake({ st, up, a }) {
  const [over, setOver] = useState(false);
  const [sel, setSel] = useState('invoices');
  const fileRef = useRef();
  const loaded = Object.values(st.extracts);
  const total = loaded.reduce((s, p) => s + p.count, 0);
  const warn = loaded.filter((p) => p.quality === 'WARN').length;
  const fail = loaded.filter((p) => p.quality === 'FAIL').length;
  const cur = st.extracts[sel];
  const def = EXTRACTS.find((e) => e.id === sel);

  const onDrop = (e) => { e.preventDefault(); setOver(false); if (e.dataTransfer?.files?.length) a.addFiles([...e.dataTransfer.files]); };
  const templates = () => {
    const t = templateFiles();
    const files = Object.fromEntries(Object.entries(t).map(([id, text]) => [DEMO_FILE_NAMES[id], strToU8(text)]));
    files['README.txt'] = strToU8('One CSV per extract. Keep the header row; column names can differ – the engine maps common SAP and business names automatically and lets you correct the mapping.\nDates: DD.MM.YYYY, DD-MM-YYYY, YYYY-MM-DD or DD-Mon-YYYY. Amounts: plain numbers or Indian grouping (15,38,400.00).\n');
    download({ name: 'p2p-cte_templates.zip', mime: 'application/zip', bytes: zipSync(files) });
  };

  return html`<main class="page">
    <section class="head">
      <div><h1>Data intake</h1><p>Load SAP extracts for the period. Every file is mapped to SAP fields and checked for completeness and accuracy before any test runs, so results can be relied on.</p></div>
      <label class="field" style="min-width:280px">Entity under review<input class="inp" value=${st.entity} onInput=${(e) => up({ entity: e.target.value })} placeholder="Company name" /></label>
    </section>

    <section class="card pad stack" aria-labelledby="up-h">
      <h2 id="up-h" class="h2">Upload extracts</h2>
      <div class=${'drop' + (over ? ' over' : '')} onDragOver=${(e) => { e.preventDefault(); setOver(true); }} onDragLeave=${() => setOver(false)} onDrop=${onDrop}>
        <div style="display:flex;align-items:center;gap:16px">
          <div class="icon-box"><${Icon} name="upload" size=${26} color="var(--amber)" /></div>
          <div style="display:flex;flex-direction:column;gap:4px">
            <span style="font-size:16px;font-weight:600">Drop SAP extracts here</span>
            <span class="muted" style="font-size:13px">CSV or XLSX · one file per extract, or one workbook with a sheet per extract · the extract type is detected from the headers</span>
          </div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:10px">
          <button class="btn" onClick=${() => fileRef.current.click()}>Browse files</button>
          <button class="btn" onClick=${templates}>Download templates</button>
          <button class="btn primary" onClick=${() => a.loadDemo()}>Load demo dataset</button>
        </div>
        <input ref=${fileRef} type="file" multiple accept=".csv,.txt,.xlsx" class="sr" aria-label="Choose files" onChange=${(e) => { a.addFiles([...e.target.files]); e.target.value = ''; }} />
      </div>
      <p class="muted" style="margin:0;font-size:12px"><span style="color:var(--green)">●</span> Processed in your browser. No data leaves this device.</p>
      ${st.unassigned.length > 0 && html`<div class="stack" style="gap:8px">
        <span class="h2" style="color:var(--amber)">Files that need an extract type</span>
        ${st.unassigned.map((u, i) => html`<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center">
          <span class="mono" style="font-size:13px">${u.fileName}</span>
          <select class="inp" style="width:auto;min-width:220px" onChange=${(e) => e.target.value && a.assign(i, e.target.value)} aria-label=${'Extract type for ' + u.fileName}>
            <option value="">Choose extract…</option>
            ${EXTRACTS.filter((e) => !st.extracts[e.id]).map((e) => html`<option value=${e.id}>${e.name}</option>`)}
          </select>
        </div>`)}
      </div>`}
    </section>

    <section class="card" aria-labelledby="ex-h" style="overflow:hidden">
      <div class="card-head"><h2 id="ex-h" class="h2">Extracts · ${loaded.length} of ${EXTRACTS.length} loaded</h2>
        <span class="muted" style="font-size:13px">${total.toLocaleString('en-IN')} records loaded${loaded.length ? ` · ${loaded.length - warn - fail} clean${warn ? ` · ${warn} warning` : ''}${fail ? ` · ${fail} failing` : ''}` : ''}</span></div>
      <div class="tbl-wrap"><table class="tbl" style="min-width:1040px">
        <thead><tr><th>Extract</th><th>SAP source</th><th>File</th><th class="num">Records</th><th>Fields mapped</th><th>Quality</th><th>Feeds</th><th><span class="sr">Actions</span></th></tr></thead>
        <tbody>${EXTRACTS.map((e) => {
          const p = st.extracts[e.id];
          const req = e.fields.filter((f) => f.required);
          return html`<tr class=${'click' + (sel === e.id ? ' sel' : '')} onClick=${() => setSel(e.id)}>
            <td style="font-weight:600">${e.name}${!e.tested ? html`<span class="muted" style="font-weight:400"> · reference</span>` : ''}</td>
            <td class="mono muted" style="font-size:12px">${e.source}</td>
            <td class="mono" style="font-size:12px">${p ? p.fileName : html`<span class="muted">not loaded</span>`}</td>
            <td class="num">${p ? p.count.toLocaleString('en-IN') : '—'}</td>
            <td class="mono">${p ? `${req.filter((f) => p.mapping[f.f]).length}/${req.length}` : '—'}</td>
            <td>${p ? html`<span class=${'chip ' + p.quality}>${p.quality === 'PASS' ? 'Clean' : p.quality === 'WARN' ? 'Warning' : 'Fails'}</span>` : html`<span class="chip L">Missing</span>`}</td>
            <td class="mono" style="color:var(--amber);font-size:12px">${feeds(e.id) || '—'}</td>
            <td>${p && html`<button class="btn link small" onClick=${(ev) => { ev.stopPropagation(); a.remove(e.id); }} aria-label=${'Remove ' + e.name}>Remove</button>`}</td>
          </tr>`;
        })}</tbody>
      </table></div>
    </section>

    ${cur ? html`<div class="row">
      <section class="card grow" aria-labelledby="map-h" style="overflow:hidden">
        <div class="card-head"><h2 id="map-h" class="h2">Field mapping · ${def.name}</h2><span class="muted" style="font-size:12px">${cur.fileName}</span></div>
        <div class="tbl-wrap"><table class="tbl" style="min-width:560px">
          <thead><tr><th>SAP field</th><th>Meaning</th><th>Your column</th><th>Sample</th><th>Match</th></tr></thead>
          <tbody>${def.fields.map((f) => {
            const col = cur.mapping[f.f];
            const i = col === undefined ? -1 : cur.header.indexOf(col);
            const sample = i >= 0 ? (st.sources[sel]?.rows[1] || [])[i] : '';
            const how = cur.how?.[f.f];
            return html`<tr>
              <td class="mono" style="color:var(--amber)">${f.f}${f.required ? '' : html`<span class="muted"> ·opt</span>`}</td>
              <td class="t2">${f.label}</td>
              <td><select class="inp compact" value=${col || ''} onChange=${(e) => a.remap(sel, f.f, e.target.value)} aria-label=${'Column for ' + f.f}>
                <option value="">— not mapped —</option>
                ${cur.header.map((h) => html`<option value=${h}>${h}</option>`)}
              </select></td>
              <td class="mono t2" style="font-size:12px">${String(sample ?? '')}</td>
              <td>${col ? html`<span class=${'chip ' + (how === 'exact' || !how ? 'PASS' : 'WARN')}>${how === 'exact' ? 'Exact' : how === 'alias' ? 'Auto · alias' : how === 'label' ? 'Auto · label' : 'Manual'}</span>` : f.required ? html`<span class="chip FAIL">Required</span>` : html`<span class="muted">—</span>`}</td>
            </tr>`;
          })}</tbody>
        </table></div>
      </section>
      <section class="card pad side stack" aria-labelledby="dq-h">
        <h2 id="dq-h" class="h2">Data quality · completeness & accuracy</h2>
        <div class="grid-auto" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr))">
          <label class="field">Record count per source report<input class="inp mono" inputmode="numeric" value=${st.expected[sel]?.count || ''} onChange=${(e) => a.setExpected(sel, { count: e.target.value })} placeholder="e.g. 17500" /></label>
          ${def.amountField && html`<label class="field">Control total per GL / report (₹)<input class="inp mono" inputmode="decimal" value=${st.expected[sel]?.total || ''} onChange=${(e) => a.setExpected(sel, { total: e.target.value })} placeholder="optional" /></label>`}
        </div>
        ${st.demo && html`<p class="muted" style="margin:0;font-size:12px">Demo: control figures are pre-filled to stand in for the source report.</p>`}
        ${cur.checks.map((c) => html`<div style="display:flex;gap:12px;align-items:flex-start;padding-bottom:10px;border-bottom:1px solid var(--line-soft)">
          <span class=${'chip ' + c.result} style="min-width:46px;text-align:center">${c.result}</span>
          <div style="display:flex;flex-direction:column;gap:3px"><span style="font-weight:600">${c.name}</span><span class="muted" style="font-size:13px">${c.detail}</span></div>
        </div>`)}
        <span class="mono muted" style="font-size:11px;word-break:break-all">SHA-256 ${cur.sha256}</span>
      </section>
    </div>` : html`<div class="card empty">Load the ${def?.name || 'extract'} file to see its mapping and data quality checks.</div>`}

    <div class="sticky-bar">
      <span class="t2">${loaded.length ? (fail ? html`<span style="color:var(--red);font-weight:600">${fail} extract(s) fail checks</span> · fix the mapping or file before testing` : warn ? html`<span style="color:var(--amber);font-weight:600">${warn} warning</span> · tests can run; affected records are excluded and logged` : 'All loaded extracts are clean') : 'Load the extracts to continue'}</span>
      <button class="btn primary" disabled=${!loaded.length} onClick=${() => a.go('tests')}>Continue to test library →</button>
    </div>
  </main>`;
}
