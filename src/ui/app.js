import { html } from 'htm/preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import { EXTRACTS, PERIOD_DEFAULT, readTables, prepareExtract, detectExtract, runTests, defaultParams, RULES } from '../engine/index.js';
import { demoFiles, DEMO_FILE_NAMES, COUNTS } from '../demo/generator.js';
import { Header, Toast } from './components.js';
import { Boot } from './screens/boot.js';
import { Start } from './screens/start.js';
import { Intake } from './screens/intake.js';
import { Tests } from './screens/tests.js';
import { Results } from './screens/results.js';
import { Review } from './screens/review.js';
import { Report } from './screens/report.js';
import { SignIn } from './screens/signin.js';

const KEY = 'p2pcte.session.v1';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } };
const save = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* storage unavailable: session stays in memory */ } };

const initial = () => {
  const saved = load();
  return {
    screen: 'boot',
    user: saved?.user || null,
    entity: saved?.entity || '',
    demo: !!saved?.demo,
    period: saved?.run?.period || { ...PERIOD_DEFAULT },
    extracts: {},          // id -> prepared extract (records, checks, mapping…)
    sources: {},           // id -> { fileName, rows, raw }
    expected: {},          // id -> { count, total }
    unassigned: [],        // files whose extract could not be detected
    selected: RULES.map((r) => r.id),
    params: defaultParams(),
    threshold: '10000',
    run: saved?.run || null,
    filters: {},
    focus: null,
    toast: '',
    signIn: false
  };
};

export function App() {
  const [st, setSt] = useState(initial);
  const up = useCallback((patch) => setSt((s) => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) })), []);

  useEffect(() => { save({ user: st.user, entity: st.entity, demo: st.demo, run: st.run }); }, [st.user, st.entity, st.demo, st.run]);
  useEffect(() => { if (!st.toast) return; const t = setTimeout(() => up({ toast: '' }), 3200); return () => clearTimeout(t); }, [st.toast]);
  useEffect(() => { window.scrollTo?.(0, 0); }, [st.screen]);

  const go = (screen) => up({ screen });
  const toast = (msg) => up({ toast: msg });

  async function prepare(id, src, mapping, expected) {
    const prepared = await prepareExtract({ id, fileName: src.fileName, rows: src.rows, raw: src.raw, mapping, period: st.period, expected: expected || st.expected[id] || {} });
    up((s) => ({ extracts: { ...s.extracts, [id]: prepared }, sources: { ...s.sources, [id]: src } }));
    return prepared;
  }

  const actions = {
    go, toast,
    setUser: (user) => up({ user, signIn: false }),
    async loadDemo() {
      const files = demoFiles();
      const exts = {}, srcs = {}, exp = {};
      for (const e of EXTRACTS) {
        const text = files[e.id];
        const [{ rows }] = readTables(DEMO_FILE_NAMES[e.id], text);
        const src = { fileName: DEMO_FILE_NAMES[e.id], rows, raw: text };
        // Demo stand-in for figures an auditor would copy from the source report / GL.
        exp[e.id] = { count: String(rows.length - 1) };
        const p = await prepareExtract({ id: e.id, fileName: src.fileName, rows, raw: text, period: PERIOD_DEFAULT, expected: exp[e.id] });
        if (e.amountField) {
          exp[e.id].total = String(Math.round(p.records.reduce((s, r) => s + (r[e.amountField] || 0), 0) * 100) / 100);
          exts[e.id] = await prepareExtract({ id: e.id, fileName: src.fileName, rows, raw: text, period: PERIOD_DEFAULT, expected: exp[e.id] });
        } else exts[e.id] = p;
        srcs[e.id] = src;
      }
      up({ extracts: exts, sources: srcs, expected: exp, demo: true, entity: 'Sabarmati Autoparts Ltd (fictional)', period: { ...PERIOD_DEFAULT }, run: null, unassigned: [], screen: 'intake' });
      toast(`Demo dataset loaded · ${COUNTS.invoices.toLocaleString('en-IN')} invoices and 6 more extracts`);
    },
    async addFiles(fileList) {
      const taken = new Set(Object.keys(st.extracts));
      const unassigned = [];
      let n = 0;
      for (const file of fileList) {
        if (!/\.(csv|txt|xlsx)$/i.test(file.name)) { toast(`${file.name}: use CSV or XLSX`); continue; }
        const content = /\.xlsx$/i.test(file.name) ? new Uint8Array(await file.arrayBuffer()) : await file.text();
        let tables;
        try { tables = readTables(file.name, content); } catch (err) { toast(`${file.name} could not be read`); continue; }
        for (const t of tables) {
          if (!t.rows.length) continue;
          const name = t.sheet ? `${file.name} › ${t.sheet}` : file.name;
          const src = { fileName: name, rows: t.rows, raw: content };
          const { id, score } = detectExtract(t.rows[0], EXTRACTS.map((e) => e.id).filter((x) => !taken.has(x)));
          if (id && score >= 0.6) { taken.add(id); await prepare(id, src); n++; } else unassigned.push(src);
        }
      }
      up((s) => ({ unassigned: [...s.unassigned, ...unassigned], demo: false, run: null }));
      toast(`${n} extract${n === 1 ? '' : 's'} recognised${unassigned.length ? ` · ${unassigned.length} file(s) need assigning` : ''}`);
    },
    async assign(idx, id) {
      const src = st.unassigned[idx];
      up((s) => ({ unassigned: s.unassigned.filter((_, i) => i !== idx) }));
      await prepare(id, src);
    },
    async remap(id, field, header) {
      const cur = st.extracts[id];
      const mapping = { ...cur.mapping };
      if (header) mapping[field] = header; else delete mapping[field];
      await prepare(id, st.sources[id], mapping);
    },
    async setExpected(id, patch) {
      const expected = { ...(st.expected[id] || {}), ...patch };
      up((s) => ({ expected: { ...s.expected, [id]: expected } }));
      await prepare(id, st.sources[id], st.extracts[id].mapping, expected);
    },
    remove(id) { up((s) => { const e = { ...s.extracts }; delete e[id]; return { extracts: e, run: null }; }); },
    runNow() {
      if (!st.user || st.user.role !== 'Preparer') { up({ signIn: true }); toast('Sign in as Preparer to run tests'); return; }
      const data = Object.fromEntries(Object.entries(st.extracts).map(([k, v]) => [k, v.records]));
      const datasets = Object.values(st.extracts).map((p) => ({ id: p.id, name: p.name, fileName: p.fileName, count: p.count, sha256: p.sha256, checks: p.checks, quality: p.quality }));
      const run = runTests({ data, period: st.period, params: st.params, selected: st.selected, threshold: st.threshold, user: st.user, datasets });
      run.entity = st.entity;
      run.demo = st.demo;
      up({ run, screen: 'results', filters: {}, focus: null });
    },
    updateRun(fn) { up((s) => ({ run: fn(s.run) })); },
    openRun(obj) {
      if (obj?.schema !== 'p2p-cte/run@1') { toast('Not a run file from this tool'); return; }
      up({ run: obj, entity: obj.entity || '', demo: !!obj.demo, period: obj.period, screen: 'results' });
      toast(`Opened ${obj.id}`);
    },
    reviewWith(filters) { up({ filters, screen: 'review', focus: null }); }
  };

  const signInModal = st.signIn && html`<${SignIn} st=${st} onDone=${actions.setUser} onCancel=${() => up({ signIn: false })} />`;

  if (st.screen === 'boot') return html`<${Boot} onDone=${() => go(st.user ? (st.run ? 'results' : 'start') : 'start')} />`;
  if (st.screen === 'start') return html`<${Start} st=${st} a=${actions} />${signInModal}<${Toast} msg=${st.toast} />`;

  const Screen = { intake: Intake, tests: Tests, results: Results, review: Review, report: Report }[st.screen] || Intake;
  return html`<${Header} st=${st} go=${go} onSwitchUser=${() => up({ signIn: true })} />
    <div class="wrap"><${Screen} st=${st} up=${up} a=${actions} /></div>
    ${signInModal}
    <${Toast} msg=${st.toast} />`;
}
