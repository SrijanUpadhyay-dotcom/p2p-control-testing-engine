import { html } from 'htm/preact';
import { useState } from 'preact/hooks';

export function RoleFields({ v, set }) {
  return html`
    <label class="field">Your name<input class="inp" value=${v.name} onInput=${(e) => set({ ...v, name: e.target.value })} placeholder="e.g. A. Auditor" autocomplete="name" /></label>
    <label class="field">Organisation (optional)<input class="inp" value=${v.org} onInput=${(e) => set({ ...v, org: e.target.value })} placeholder="Firm or team" autocomplete="organization" /></label>
    <fieldset style="border:0;margin:0;padding:0;display:flex;flex-direction:column;gap:8px">
      <legend class="muted" style="font-size:12px;padding:0 0 6px">Role in this session</legend>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        ${[['Preparer', 'Runs tests, reviews exceptions'], ['Reviewer', 'Reviews and signs off']].map(([r, d]) => html`
          <label class=${'role' + (v.role === r ? ' on' : '')}>
            <span style="display:flex;align-items:center;gap:8px;font-weight:600"><input type="radio" name="role" checked=${v.role === r} onChange=${() => set({ ...v, role: r })} />${r}</span>
            <span class="muted" style="font-size:12px">${d}</span>
          </label>`)}
      </div>
    </fieldset>`;
}

export function SignIn({ st, onDone, onCancel }) {
  const [v, set] = useState({ name: '', org: '', role: st.user?.role === 'Preparer' ? 'Reviewer' : 'Preparer' });
  const ok = v.name.trim().length >= 2;
  return html`<div class="modal-back" onClick=${(e) => e.target === e.currentTarget && onCancel()}>
    <form class="modal" role="dialog" aria-modal="true" aria-labelledby="si-t" onSubmit=${(e) => { e.preventDefault(); if (ok) onDone({ ...v, name: v.name.trim() }); }}>
      <h2 id="si-t" style="margin:0;font-size:18px">Sign in</h2>
      <p class="muted" style="margin:0;font-size:13px">Currently: ${st.user ? `${st.user.name} (${st.user.role})` : 'nobody'}. No account needed; your name goes on the run record and sign-offs.</p>
      <${RoleFields} v=${v} set=${set} />
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button type="button" class="btn" onClick=${onCancel}>Cancel</button>
        <button type="submit" class="btn primary" disabled=${!ok}>Sign in</button>
      </div>
    </form>
  </div>`;
}
