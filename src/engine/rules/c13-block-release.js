import { fmtDate, inr, splitList } from '../util.js';

export default {
  id: 'C13',
  name: 'Blocked invoice released without support',
  type: 'Preventive',
  risk: 'R09',
  subprocess: 'Invoice processing',
  assertion: 'Accuracy',
  coso: 'P10',
  fraud: false,
  needs: ['mrbr_releases'],
  populationOf: 'mrbr_releases',
  logic: 'Each MRBR release must be by an authorised releaser who did not post the invoice, and must be supported by a buyer confirmation or corrected GRN dated on or before the release.',
  params: [
    { key: 'releasers', label: 'Authorised releasers', type: 'list', default: 'JPATEL' }
  ],
  run(ctx, p) {
    const auth = new Set(splitList(p.releasers).map((s) => s.toUpperCase()));
    const out = [];
    for (const r of ctx.data.mrbr_releases) {
      const rel = (r.REL_USER || '').toUpperCase();
      const bad = [];
      const noConf = !r.CONF_DATE || !r.CONF_TYPE || /^none/i.test(r.CONF_TYPE);
      if (auth.size && !auth.has(rel)) bad.push(`released by ${rel}, who is not an authorised releaser`);
      if (rel && rel === (r.USNAM || '').toUpperCase()) bad.push('released by the user who posted the invoice');
      if (noConf) bad.push('no buyer confirmation or corrected GRN on record');
      else if (r.CONF_DATE > r.REL_DATE) bad.push(`support dated ${fmtDate(r.CONF_DATE)}, after the release`);
      if (!bad.length) continue;
      const v = ctx.vendors.get(r.LIFNR);
      const paid = ctx.idx.paymentsByInvoice.has(r.BELNR);
      out.push({
        key: r.BELNR,
        title: 'Blocked invoice released without support',
        record: `Release ${r.XBLNR}`,
        vendor: r.LIFNR,
        party: `${v?.NAME1 || 'Vendor'} · ${r.LIFNR}`,
        amount: r.VARIANCE,
        moneyOut: paid,
        reasons: bad,
        facts: [
          { k: 'Invoice / MIRO doc', v: `${r.XBLNR} · ${r.BELNR}` },
          { k: 'Invoice date / PO', v: `${fmtDate(r.BLDAT)} · ${r.EBELN || '—'}` },
          { k: 'Block reason / variance', v: `${r.BLOCK_REASON} · ₹${inr(r.VARIANCE)}` },
          { k: 'Posted by / released by', v: `${r.USNAM} / ${rel}`, bad: bad.some((b) => b.startsWith('released by')) },
          { k: 'Release date', v: fmtDate(r.REL_DATE) },
          { k: 'Support', v: noConf ? 'None on file' : `${r.CONF_TYPE} ${r.CONF_REF || ''} · ${fmtDate(r.CONF_DATE)}`, bad: true },
          ...(r.RELEASE_TEXT ? [{ k: 'Release text', v: `"${r.RELEASE_TEXT}"` }] : []),
          { k: 'Invoice paid', v: paid ? 'Yes' : 'No' }
        ],
        condition: `Invoice ${r.XBLNR} dated ${fmtDate(r.BLDAT)} from ${v?.NAME1 || r.LIFNR} (MIRO ${r.BELNR}) was blocked for a ${String(r.BLOCK_REASON).toLowerCase()} difference of ₹${inr(r.VARIANCE)} and released by ${rel} on ${fmtDate(r.REL_DATE)}${r.RELEASE_TEXT ? ` with the text "${r.RELEASE_TEXT}"` : ''}: ${bad.join('; ')}.`
      });
    }
    return { population: ctx.data.mrbr_releases.length, exceptions: out };
  }
};
