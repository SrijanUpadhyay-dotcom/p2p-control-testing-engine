import { fmtDate, inr, splitList, parseAmount, daysBetween } from '../util.js';

export default {
  id: 'C09',
  name: 'After-the-fact and split POs',
  type: 'Detective',
  risk: 'R05',
  subprocess: 'Purchase orders',
  assertion: 'Occurrence',
  coso: 'P16',
  fraud: false,
  needs: ['purchase_orders', 'invoices'],
  populationOf: 'purchase_orders',
  logic: 'A PO is after-the-fact when any invoice against it is dated before the PO. POs are split when two or more standard POs to one vendor for one material group, each within a DOA limit, fall inside the window and together cross that limit. Rate-contract call-offs are excluded from the split test.',
  params: [
    { key: 'window', label: 'Split window (days)', type: 'int', default: '7' },
    { key: 'excludeTypes', label: 'PO types excluded from split test', type: 'list', default: 'ZRC' },
    { key: 'pmLimit', label: 'DOA limits tested (₹)', type: 'list', default: '500000;2500000;10000000' }
  ],
  run(ctx, p) {
    const out = [];
    const pos = ctx.data.purchase_orders;
    // After-the-fact
    for (const po of pos) {
      const invs = ctx.idx.invoicesByPO.get(po.EBELN) || [];
      const early = invs.filter((i) => i.BLDAT && i.BLDAT < po.BEDAT).sort((a, b) => (a.BLDAT < b.BLDAT ? -1 : 1));
      if (!early.length) continue;
      const first = early[0];
      const v = ctx.vendors.get(po.LIFNR);
      const paid = early.some((i) => ctx.idx.paymentsByInvoice.has(i.BELNR));
      out.push({
        key: 'ATF-' + po.EBELN,
        kind: 'After-the-fact',
        title: 'PO raised after the vendor invoice',
        record: `PO ${po.EBELN} after invoice`,
        vendor: po.LIFNR,
        party: `${v?.NAME1 || 'Vendor'} · ${po.LIFNR}`,
        amount: po.NETWR,
        moneyOut: paid,
        reasons: [`invoice ${first.XBLNR} dated ${fmtDate(first.BLDAT)}, ${daysBetween(first.BLDAT, po.BEDAT)} days before the PO`],
        facts: [
          { k: 'PO / date', v: `${po.EBELN} · ${fmtDate(po.BEDAT)}`, bad: true },
          { k: 'Earliest invoice', v: `${first.XBLNR} · ${fmtDate(first.BLDAT)}`, bad: true },
          { k: 'Days invoice preceded PO', v: String(daysBetween(first.BLDAT, po.BEDAT)), bad: true },
          { k: 'PO value / type', v: `₹${inr(po.NETWR)} · ${po.BSART}` },
          { k: 'Created / released by', v: `${po.ERNAM} / ${po.RELEASED_BY}` },
          { k: 'Invoice paid', v: paid ? 'Yes' : 'No' }
        ],
        condition: `PO ${po.EBELN} to ${v?.NAME1 || po.LIFNR} for ₹${inr(po.NETWR)} was created on ${fmtDate(po.BEDAT)}, ${daysBetween(first.BLDAT, po.BEDAT)} days after the vendor's invoice ${first.XBLNR} dated ${fmtDate(first.BLDAT)}.`
      });
    }
    // Split POs
    const win = parseInt(p.window, 10) || 7;
    const excl = new Set(splitList(p.excludeTypes).map((s) => s.toUpperCase()));
    const limits = splitList(p.pmLimit).map(parseAmount).filter(Boolean).sort((a, b) => a - b);
    const groups = new Map();
    for (const po of pos) {
      if (excl.has((po.BSART || '').toUpperCase())) continue;
      const k = po.LIFNR + '|' + po.MATKL;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(po);
    }
    const flagged = new Set();
    for (const list of groups.values()) {
      if (list.length < 2) continue;
      list.sort((a, b) => (a.BEDAT < b.BEDAT ? -1 : 1));
      for (const lim of limits) {
        for (let i = 0; i < list.length; i++) {
          if (flagged.has(list[i].EBELN) || list[i].NETWR > lim) continue;
          const cluster = [list[i]];
          for (let j = i + 1; j < list.length && daysBetween(list[i].BEDAT, list[j].BEDAT) <= win; j++) {
            if (list[j].NETWR <= lim && !flagged.has(list[j].EBELN)) cluster.push(list[j]);
          }
          const total = cluster.reduce((s, x) => s + x.NETWR, 0);
          if (cluster.length < 2 || total <= lim) continue;
          cluster.forEach((x) => flagged.add(x.EBELN));
          const v = ctx.vendors.get(list[i].LIFNR);
          const ids = cluster.map((x) => x.EBELN);
          out.push({
            key: 'SPL-' + ids.join('+'),
            kind: 'Split',
            title: 'POs split to stay within a DOA limit',
            record: `Split POs ${ids.join(' + ')}`,
            vendor: list[i].LIFNR,
            party: `${v?.NAME1 || 'Vendor'} · ${list[i].LIFNR}`,
            amount: total,
            moneyOut: cluster.some((x) => (ctx.idx.invoicesByPO.get(x.EBELN) || []).some((inv) => ctx.idx.paymentsByInvoice.has(inv.BELNR))),
            reasons: [`${cluster.length} POs in ${daysBetween(cluster[0].BEDAT, cluster[cluster.length - 1].BEDAT)} days, each ≤ ₹${inr(lim)}, together ₹${inr(total)}`],
            facts: [
              ...cluster.map((x) => ({ k: `PO ${x.EBELN}`, v: `${fmtDate(x.BEDAT)} · ₹${inr(x.NETWR)} · ${x.REL_CODES}` })),
              { k: 'Material group', v: list[i].MATKL },
              { k: 'Combined value', v: `₹${inr(total)} > limit ₹${inr(lim)}`, bad: true },
              { k: 'Created by', v: [...new Set(cluster.map((x) => x.ERNAM))].join(', ') }
            ],
            condition: `${cluster.length} POs (${ids.join(', ')}) to ${v?.NAME1 || list[i].LIFNR} for material group ${list[i].MATKL} were raised between ${fmtDate(cluster[0].BEDAT)} and ${fmtDate(cluster[cluster.length - 1].BEDAT)}. Each was within the ₹${inr(lim)} approval limit; together they total ₹${inr(total)}, which needed a higher approver.`
          });
        }
      }
    }
    return { population: pos.length, exceptions: out };
  }
};
