import { fmtDate, inr, splitList, parseAmount } from '../util.js';

export function requiredCodes(value, p) {
  const pm = parseAmount(p.pmLimit), ph = parseAmount(p.phLimit), cfo = parseAmount(p.cfoLimit);
  if (value <= pm) return ['PM'];
  if (value <= ph) return ['PH'];
  if (value <= cfo) return ['PH', 'CFO'];
  return ['PH', 'CFO', 'MD'];
}

export default {
  id: 'C06',
  name: 'PO released as per DOA',
  type: 'Automated',
  risk: 'R05',
  subprocess: 'Purchase orders',
  assertion: 'Occurrence',
  coso: 'P11',
  fraud: false,
  needs: ['purchase_orders'],
  populationOf: 'purchase_orders',
  logic: 'Release codes on each PO are compared with the levels the DOA requires for its final value. The final release must come on or before the first goods receipt, a value increase after release must be re-released, and the creator may not be a releaser.',
  params: [
    { key: 'pmLimit', label: 'Purchase Manager up to (₹)', type: 'amount', default: '500000' },
    { key: 'phLimit', label: 'Purchase Head up to (₹)', type: 'amount', default: '2500000' },
    { key: 'cfoLimit', label: 'CFO up to (₹)', type: 'amount', default: '10000000' }
  ],
  run(ctx, p) {
    const out = [];
    for (const po of ctx.data.purchase_orders) {
      const req = requiredCodes(po.NETWR || 0, p);
      const have = new Set(splitList(po.REL_CODES).map((s) => s.toUpperCase()));
      const missing = req.filter((c) => !have.has(c));
      const releasers = splitList(po.RELEASED_BY).map((s) => s.toUpperCase());
      const bad = [];
      if (missing.length) bad.push(`missing release by ${missing.join(' + ')}`);
      if (po.FIRST_GR_DATE && po.REL_DATE && po.REL_DATE > po.FIRST_GR_DATE) bad.push('goods received before final release');
      if (!po.REL_DATE) bad.push('no final release date');
      if (po.CHANGED_AFTER_REL && !po.RE_RELEASED) bad.push('value increased after release without re-release');
      if (releasers.includes((po.ERNAM || '').toUpperCase())) bad.push('creator also released the PO');
      if (!bad.length) continue;
      const v = ctx.vendors.get(po.LIFNR);
      out.push({
        key: po.EBELN,
        title: 'PO not released as per DOA',
        record: `PO ${po.EBELN}`,
        vendor: po.LIFNR,
        party: `${v?.NAME1 || 'Vendor'} · ${po.LIFNR}`,
        amount: po.NETWR,
        moneyOut: false,
        reasons: bad,
        facts: [
          { k: 'PO / date', v: `${po.EBELN} · ${fmtDate(po.BEDAT)}` },
          { k: 'Value', v: `₹${inr(po.NETWR)}` },
          { k: 'Required release', v: req.join(' + ') },
          { k: 'Release codes on PO', v: [...have].join(' + ') || 'None', bad: missing.length > 0 },
          { k: 'Released / first GR', v: `${fmtDate(po.REL_DATE)} / ${fmtDate(po.FIRST_GR_DATE) || '—'}`, bad: bad.includes('goods received before final release') },
          { k: 'Created by / released by', v: `${po.ERNAM} / ${releasers.join(', ')}` }
        ],
        condition: `PO ${po.EBELN} dated ${fmtDate(po.BEDAT)} to ${v?.NAME1 || po.LIFNR} for ₹${inr(po.NETWR)}: ${bad.join('; ')}.`
      });
    }
    return { population: ctx.data.purchase_orders.length, exceptions: out };
  }
};
