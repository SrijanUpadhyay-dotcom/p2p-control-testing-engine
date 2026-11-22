import { html } from 'htm/preact';

export const Shield = ({ size = 20 }) => html`<svg width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="#14110A" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"></path><path d="M8.5 12l2.5 2.5 4.5-5"></path></svg>`;

const PATHS = {
  play: html`<path d="M6 4l14 8-14 8z"></path>`,
  upload: html`<path d="M12 16V4"></path><path d="M7 9l5-5 5 5"></path><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"></path>`,
  download: html`<path d="M12 4v12"></path><path d="M7 11l5 5 5-5"></path><path d="M4 20h16"></path>`,
  folder: html`<path d="M4 5h6l2 2h8v12H4z"></path>`,
  user: html`<circle cx="12" cy="8" r="4"></circle><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"></path>`,
  check: html`<path d="M5 12l5 5 9-10"></path>`,
  x: html`<path d="M6 6l12 12M18 6L6 18"></path>`
};
export const Icon = ({ name, size = 18, color = 'currentColor' }) => html`<svg width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke=${color} stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name]}</svg>`;

export const SEV = { High: 'H', Medium: 'M', Low: 'L' };
export const STATUS_CLASS = { New: 'new', 'In review': 'M', Confirmed: 'H', 'False positive': 'L', Remediated: 'good' };

export const STEPS = [
  ['intake', '01', 'Data intake'],
  ['tests', '02', 'Test library'],
  ['results', '03', 'Results'],
  ['review', '04', 'Exception review'],
  ['report', '05', 'Report & export']
];

export function Header({ st, go, onSwitchUser }) {
  const runLabel = st.run ? `${st.run.id} · ${st.run.signoff.reviewer ? 'reviewed' : 'complete'}` : st.demo ? 'demo data loaded' : 'no run yet';
  const enabled = { intake: true, tests: Object.keys(st.extracts).length > 0, results: !!st.run, review: !!st.run, report: !!st.run };
  return html`<header class="top">
    <div class="wrap">
      <div class="top-row">
        <div class="brand">
          <div class="logo"><${Shield} /></div>
          <div style="display:flex;flex-direction:column;gap:2px">
            <span class="brand-name">P2P Control Testing Engine</span>
            <span class="brand-sub">v1.0 · continuous controls monitoring</span>
          </div>
        </div>
        <div class="pills">
          ${st.demo && html`<span class="pill amber">DEMO · FICTIONAL DATA</span>`}
          <span class="pill">${st.entity || 'No entity set'} · ${fy(st.period)}</span>
          <span class=${'pill mono' + (st.run ? ' ok' : '')}>${runLabel}</span>
          <button class="pill" onClick=${onSwitchUser} title="Switch user">
            <span style="display:inline-flex;align-items:center;gap:6px"><${Icon} name="user" size=${13} />${st.user?.name || 'Sign in'} · ${st.user?.role || '—'}</span>
          </button>
        </div>
      </div>
      <nav aria-label="Workflow" class="steps">
        ${STEPS.map(([id, n, label]) => html`<button class="step" aria-current=${st.screen === id ? 'page' : null} disabled=${!enabled[id]} onClick=${() => go(id)}><span class="n">${n}</span>${label}</button>`)}
      </nav>
    </div>
  </header>`;
}

export const fy = (p) => {
  if (!p) return '';
  const y = +p.from.slice(0, 4);
  return p.from.slice(5) === '04-01' && p.to === `${y + 1}-03-31` ? `FY ${y}-${String(y + 1).slice(2)}` : `${p.from} → ${p.to}`;
};

export function Toast({ msg }) {
  return msg ? html`<div class="toast" role="status">${msg}</div>` : null;
}
