import { html } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';
import { Shield } from '../components.js';
import { RULES, RULE_LIBRARY_VERSION } from '../../engine/index.js';
import { SOD_PAIRS } from '../../engine/rcm.js';

export function Boot({ onDone }) {
  const items = [
    'Initialising engine core',
    `Loading rule library ${RULE_LIBRARY_VERSION} · ${RULES.length} tests`,
    'Loading RCM map · 15 risks · 20 controls',
    `Loading SoD matrix · ${SOD_PAIRS.length} conflict pairs`,
    'Loading FY 2023-24 parameters · GST 2B · TDS · MSME 45 days',
    `Checking local processing · ${globalThis.crypto?.subtle ? 'SHA-256 available · ' : ''}no data leaves this device`,
    'Engine ready'
  ];
  const [step, setStep] = useState(0);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    setStep(0);
    const t = setInterval(() => setStep((s) => { if (s >= items.length) { clearInterval(t); return s; } return s + 1; }), 380);
    return () => clearInterval(t);
  }, [nonce]);
  const ready = step >= items.length;
  const pct = Math.round((Math.min(step, items.length) / items.length) * 100);
  return html`<div class="boot">
    <div class="boot-inner">
      <div style="display:flex;align-items:center;gap:16px">
        <div class="logo" style="width:56px;height:56px;border-radius:10px"><${Shield} size=${32} /></div>
        <div style="display:flex;flex-direction:column;gap:4px">
          <span style="font-weight:600;font-size:20px;letter-spacing:.1em;text-transform:uppercase">P2P Control Testing Engine</span>
          <span class="mono muted" style="font-size:12px">v1.0 · continuous controls monitoring · procure-to-pay</span>
        </div>
      </div>
      <div class="console" role="status" aria-live="polite">
        ${items.map((t, i) => {
          const done = i < step, active = i === step;
          return html`<div class="cline" style=${{ opacity: done || active ? 1 : 0.3 }}>
            <span class="t2">${t}</span>
            <span class=${active ? 'pulse' : ''} style=${{ color: done ? 'var(--green)' : active ? 'var(--amber)' : 'var(--faint)', whiteSpace: 'nowrap' }}>${done ? (i === items.length - 1 ? 'READY' : 'OK') : active ? 'loading' : '…'}</span>
          </div>`;
        })}
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <div class="progress"><div style=${{ width: pct + '%' }}></div></div>
        <div class="mono muted" style="display:flex;justify-content:space-between;font-size:12px"><span>${ready ? 'All systems ready' : 'Starting up…'}</span><span>${pct}%</span></div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between">
        <span class="muted" style="font-size:12px">Runs entirely in your browser · © Srijan Upadhyay</span>
        <div style="display:flex;gap:10px">
          ${ready ? html`<button class="btn" onClick=${() => setNonce((n) => n + 1)}>Replay</button>` : html`<button class="btn" onClick=${onDone}>Skip</button>`}
          ${ready && html`<button class="btn primary" onClick=${onDone} autofocus>Enter →</button>`}
        </div>
      </div>
    </div>
  </div>`;
}
