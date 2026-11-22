import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { STATUSES, ROOT_CAUSES } from '../../engine/index.js';
import { inr, toCSV } from '../../engine/util.js';
import { SEV, STATUS_CLASS } from '../components.js';
import { download } from '../download.js';

const FACETS = [
  ['status', 'Status', (e) => e.status, STATUSES],
  ['severity', 'Severity', (e) => e.severity, ['High', 'Medium', 'Low']],
  ['control', 'Control', (e) => e.control, null],
  ['subprocess', 'Sub-process', (e) => e.subprocess, null],
  ['assertion', 'Assertion', (e) => e.assertion, null],
  ['owner', 'Owner', (e) => e.owner, null]
];
const OWNERS = ['Finance Controller', 'Purchase Head', 'AP Lead', 'IT Head', 'Tax Manager', 'CFO'];
const now = () => new Date().toISOString();

export function Review({ st, up, a }) {
  const run = st.run;
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('none');
  const [minAmt, setMin] = useState('');
  const [maxAmt, setMax] = useState('');
  const [checked, setChecked] = useState(new Set());
  const [fpReason, setFp] = useState(null);
  if (!run) return html`<main class="page"><div class="card empty">No run yet.</div></main>`;
  const locked = !!run.signoff.reviewer;
  const f = st.filters || {};
  const setF = (k, v) => up((s) => { const cur = new Set(s.filters?.[k] || []); cur.has(v) ? cur.delete(v) : cur.add(v); return { filters: { ...s.filters, [k]: [...cur] } }; });
  const passes = (e, skip) => FACETS.every(([k, , get]) => k === skip || !(f[k]?.length) || f[k].includes(get(e))) &&
    (!q || `${e.id} ${e.record} ${e.party} ${e.condition} ${e.control}`.toLowerCase().includes(q.toLowerCase())) &&
    (!minAmt || (e.amount ?? 0) >= +minAmt) && (!maxAmt || (e.amount ?? 0) <= +maxAmt);
  const list = run.exceptions.filter((e) => passes(e)).sort((x, y) => y.score - x.score);
  const focus = run.exceptions.find((e) => e.id === st.focus) || list[0];
  const counts = (k, get) => { const m = {}; run.exceptions.filter((e) => passes(e, k)).forEach((e) => { m[get(e)] = (m[get(e)] || 0) + 1; }); return m; };
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, run.exceptions.filter((e) => e.status === s).length]));

  const patch = (ids, changes, text) => a.updateRun((r) => ({
    ...r,
    exceptions: r.exceptions.map((e) => ids.includes(e.id) ? { ...e, ...changes, log: [...e.log, { at: now(), by: st.user?.name || 'unknown', text }] } : e),
    events: [...r.events, { at: now(), by: st.user?.name || 'unknown', text: `${ids.length > 1 ? ids.length + ' exceptions' : ids[0]}: ${text}` }]
  }));
  const editField = (key, val) => a.updateRun((r) => ({ ...r, exceptions: r.exceptions.map((e) => (e.id === focus.id ? { ...e, [key]: val } : e)) }));

  const groups = group === 'none' ? [['', list]] : Object.entries(list.reduce((m, e) => { const k = { control: e.control + ' · ' + e.controlName, owner: e.owner || 'Unassigned', severity: e.severity, subprocess: e.subprocess }[group]; (m[k] ||= []).push(e); return m; }, {}));
  const exportSel = () => {
    const rows = run.exceptions.filter((e) => checked.has(e.id)).map((e) => ({ ...e, reasons: e.reasons.join('; ') }));
    download({ name: `${run.id}_selected_exceptions.csv`, mime: 'text/csv', text: toCSV(rows, ['id', 'control', 'severity', 'score', 'record', 'party', 'amount', 'status', 'owner', 'rootCause', 'reasons', 'condition']) });
  };
  const allChecked = list.length > 0 && list.every((e) => checked.has(e.id));

  return html`<main class="page" style="gap:16px">
    <section class="head" style="align-items:center">
      <div><h1>Exception review</h1><p style="font-size:13px">${run.exceptions.length} exceptions · ${STATUSES.map((s) => `${byStatus[s]} ${s.toLowerCase()}`).join(' · ')}${locked ? ' · locked after reviewer sign-off' : ''}</p></div>
      <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center">
        <label><span class="sr">Search exceptions</span><input class="inp" type="search" value=${q} onInput=${(e) => setQ(e.target.value)} placeholder="Search vendor, document, user…" style="width:260px;min-height:44px" /></label>
        <label class="field" style="flex-direction:row;align-items:center;gap:8px">Group by
          <select class="inp" style="min-height:44px;width:auto" value=${group} onChange=${(e) => setGroup(e.target.value)}>
            <option value="none">None</option><option value="control">Control</option><option value="subprocess">Sub-process</option><option value="owner">Owner</option><option value="severity">Severity</option>
          </select></label>
      </div>
    </section>

    <div class="row" style="gap:16px">
      <aside class="card facets" aria-label="Filters">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--line)">
          <span class="h2">Filters</span>
          <button class="btn link small" onClick=${() => { up({ filters: {} }); setQ(''); setMin(''); setMax(''); }}>Clear all</button>
        </div>
        ${FACETS.map(([k, label, get, order]) => {
          const c = counts(k, get);
          const opts = order ? order.filter((o) => run.exceptions.some((e) => get(e) === o) || (k === 'status')) : [...new Set(run.exceptions.map(get))].sort();
          return html`<div class="fg"><span class="fh">${label}</span>
            ${opts.map((o) => html`<label class="fo"><input type="checkbox" checked=${(f[k] || []).includes(o)} onChange=${() => setF(k, o)} />${o || '—'}<span class="c">${c[o] || 0}</span></label>`)}
          </div>`;
        })}
        <div class="fg" style="border-bottom:0"><span class="fh">Amount (₹)</span>
          <div style="display:flex;gap:8px">
            <label class="field" style="flex:1">Min<input class="inp compact" inputmode="numeric" value=${minAmt} onInput=${(e) => setMin(e.target.value)} placeholder="0" /></label>
            <label class="field" style="flex:1">Max<input class="inp compact" inputmode="numeric" value=${maxAmt} onInput=${(e) => setMax(e.target.value)} placeholder="any" /></label>
          </div></div>
      </aside>

      <section class="card grow" style="overflow:hidden;flex-basis:520px" aria-labelledby="tbl-h">
        <div class="card-head" style="background:var(--inset);padding:10px 14px">
          <h2 id="tbl-h" class="h2">${list.length} of ${run.exceptions.length} shown</h2>
          <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">
            <span class="muted" style="font-size:12px">${checked.size} selected:</span>
            <select class="inp compact" style="width:auto" disabled=${!checked.size || locked} onChange=${(e) => { if (e.target.value) { patch([...checked], { owner: e.target.value }, `owner set to ${e.target.value}`); e.target.value = ''; } }} aria-label="Assign owner to selected"><option value="">Assign owner…</option>${OWNERS.map((o) => html`<option>${o}</option>`)}</select>
            <select class="inp compact" style="width:auto" disabled=${!checked.size || locked} onChange=${(e) => { if (e.target.value) { patch([...checked], { status: e.target.value }, `status set to ${e.target.value}`); e.target.value = ''; } }} aria-label="Set status of selected"><option value="">Set status…</option>${STATUSES.filter((s) => s !== 'False positive').map((s) => html`<option>${s}</option>`)}</select>
            <button class="btn small" disabled=${!checked.size} onClick=${exportSel}>Export</button>
          </div>
        </div>
        <div class="tbl-wrap"><table class="tbl" style="min-width:680px">
          <thead><tr>
            <th><input type="checkbox" checked=${allChecked} onChange=${() => setChecked(allChecked ? new Set() : new Set(list.map((e) => e.id)))} aria-label="Select all shown" /></th>
            <th>ID</th><th>Control</th><th>Severity ↓</th><th>Record · party</th><th class="num">Amount (₹)</th><th>Status</th>
          </tr></thead>
          <tbody>${groups.map(([g, rows]) => html`
            ${g && html`<tr><td colspan="7" style="background:var(--inset);font-weight:600;font-size:12px;color:var(--text-2)">${g} · ${rows.length}</td></tr>`}
            ${rows.map((e) => html`<tr class=${'click' + (focus?.id === e.id ? ' sel' : '')} onClick=${() => up({ focus: e.id })}>
              <td class="bar-left" style=${{ '--c': { High: 'var(--red)', Medium: 'var(--amber)', Low: 'var(--faint)' }[e.severity] }} onClick=${(ev) => ev.stopPropagation()}>
                <input type="checkbox" checked=${checked.has(e.id)} onChange=${() => { const n = new Set(checked); n.has(e.id) ? n.delete(e.id) : n.add(e.id); setChecked(n); }} aria-label=${'Select ' + e.id} /></td>
              <td class="mono" style="color:var(--amber);white-space:nowrap">${e.id}</td>
              <td class="mono t2" style="font-size:12px">${e.control}</td>
              <td><span class=${'chip ' + SEV[e.severity]}>${e.severity} · ${e.score}</span></td>
              <td><div style="font-weight:500">${e.record}</div><div class="muted" style="font-size:12px">${e.party}</div></td>
              <td class="num">${e.amount == null ? '—' : inr(e.amount)}</td>
              <td><span class=${'chip ' + STATUS_CLASS[e.status]}>${e.status}</span></td>
            </tr>`)}`)}
            ${!list.length && html`<tr><td colspan="7" class="empty">No exceptions match these filters.</td></tr>`}
          </tbody>
        </table></div>
      </section>

      ${focus && html`<aside class="card detail" aria-labelledby="dr-h">
        <section class="stack" style="gap:8px">
          <div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><span class="mono" style="font-size:12px;color:var(--amber)">${focus.id} · ${focus.control} · ${focus.risk}</span><span class=${'chip ' + SEV[focus.severity]}>${focus.severity} · ${focus.score}</span></div>
          <h2 id="dr-h" style="margin:0;font-size:17px;font-weight:600;line-height:1.35">${focus.title}</h2>
          <span class="muted" style="font-size:12px">${focus.subprocess} · ${focus.assertion} · COSO ${focus.coso} · ${focus.party}</span>
        </section>
        <section class="stack" style="gap:6px">
          <span class="h2">Evidence from the data</span>
          ${focus.facts.map((x) => html`<div class="fact"><span class="muted">${x.k}</span><span class=${'v' + (x.bad ? ' bad' : '')}>${x.bad ? '✕ ' : ''}${x.v}</span></div>`)}
          <details style="margin-top:6px"><summary class="muted" style="cursor:pointer;font-size:12px">Why score ${focus.score}</summary>
            ${focus.scoreParts.map((p) => html`<div class="fact"><span class="muted">${p.k}</span><span class="v">+${p.pts}</span></div>`)}
          </details>
        </section>
        <section class="stack">
          <span class="h2">Disposition</span>
          <label class="field">Status<select class="inp" value=${focus.status} disabled=${locked} onChange=${(e) => { if (e.target.value === 'False positive') setFp(''); else patch([focus.id], { status: e.target.value }, `status ${focus.status} → ${e.target.value}`); }}>${STATUSES.map((s) => html`<option>${s}</option>`)}</select></label>
          ${fpReason !== null && html`<div class="stack" style="gap:8px;padding:10px;border:1px solid var(--amber-line);border-radius:6px">
            <label class="field">Why is this a false positive? (required)<textarea class="inp" value=${fpReason} onInput=${(e) => setFp(e.target.value)}></textarea></label>
            <div style="display:flex;gap:8px"><button class="btn small primary" disabled=${fpReason.trim().length < 5} onClick=${() => { patch([focus.id], { status: 'False positive', note: fpReason.trim() }, `marked false positive: ${fpReason.trim()}`); setFp(null); }}>Confirm false positive</button><button class="btn small" onClick=${() => setFp(null)}>Cancel</button></div>
          </div>`}
          <label class="field">Owner<select class="inp" value=${focus.owner} disabled=${locked} onChange=${(e) => patch([focus.id], { owner: e.target.value }, `owner set to ${e.target.value}`)}>${OWNERS.map((o) => html`<option>${o}</option>`)}</select></label>
          <label class="field">Root-cause category<select class="inp" value=${focus.rootCause} disabled=${locked} onChange=${(e) => patch([focus.id], { rootCause: e.target.value }, `root cause: ${e.target.value}`)}><option value="">Not yet known</option>${ROOT_CAUSES.map((o) => html`<option>${o}</option>`)}</select></label>
          <label class="field">Reviewer note (feeds the cause)<textarea class="inp" value=${focus.note} disabled=${locked} onInput=${(e) => editField('note', e.target.value)} onBlur=${() => focus.note && patch([focus.id], {}, 'note updated')}></textarea></label>
          <label class="field">Management action plan<textarea class="inp" value=${focus.actionPlan || ''} disabled=${locked} onInput=${(e) => editField('actionPlan', e.target.value)} placeholder="Owner, action, target date"></textarea></label>
          <div style="display:flex;flex-wrap:wrap;gap:8px">
            <button class="btn primary" disabled=${locked || focus.status === 'Confirmed'} onClick=${() => patch([focus.id], { status: 'Confirmed' }, 'confirmed as finding')}>Confirm as finding</button>
            <button class="btn" disabled=${locked} onClick=${() => setFp('')}>False positive…</button>
          </div>
        </section>
        <section class="stack" style="gap:6px">
          <span class="h2">Activity</span>
          ${focus.log.slice().reverse().map((g) => html`<div style="display:flex;gap:10px;font-size:12px"><span class="mono muted" style="min-width:86px">${g.at.slice(0, 10)}</span><span class="t2">${g.by}: ${g.text}</span></div>`)}
        </section>
      </aside>`}
    </div>
  </main>`;
}
