import { fmtDate, inr, daysBetween } from '../util.js';

/** Normalise an invoice number: upper-case, drop separators, drop leading zeros in number runs. */
export function normInvoiceNo(s) {
  return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/(^|[A-Z])0+(?=\d)/g, '$1');
}

export default {
  id: 'C14',
  name: 'Duplicate invoices',
  type: 'Detective',
  risk: 'R10',
  subprocess: 'Invoice processing',
  assertion: 'Occurrence',
  coso: 'P10',
  fraud: true,
  needs: ['invoices', 'payments'],
  populationOf: 'invoices',
  logic: 'Invoices from the same vendor for the same amount, whose numbers match once separators, spaces and leading zeros are removed (INV/123 = INV-123 = INV 0123), dated within the window of each other.',
  params: [
    { key: 'window', label: 'Date window (± days)', type: 'int', default: '30' }
  ],
  run(ctx, p) {
    const win = parseInt(p.window, 10) || 30;
    const groups = new Map();
    for (const inv of ctx.data.invoices) {
      if (inv.RMWWR === null) continue;
      const k = `${inv.LIFNR}|${normInvoiceNo(inv.XBLNR)}|${inv.RMWWR.toFixed(2)}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(inv);
    }
    const out = [];
    for (const list of groups.values()) {
      if (list.length < 2) continue;
      list.sort((a, b) => (a.BLDAT < b.BLDAT ? -1 : 1));
      if (daysBetween(list[0].BLDAT, list[list.length - 1].BLDAT) > win) continue;
      const v = ctx.vendors.get(list[0].LIFNR);
      const paidN = list.filter((i) => ctx.idx.paymentsByInvoice.has(i.BELNR)).length;
      const extra = list[0].RMWWR * (list.length - 1);
      out.push({
        key: list.map((i) => i.BELNR).join('+'),
        title: 'Duplicate invoice',
        record: `Invoices ${list.map((i) => i.XBLNR).join(' ↔ ')}`,
        vendor: list[0].LIFNR,
        party: `${v?.NAME1 || 'Vendor'} · ${list[0].LIFNR}`,
        amount: extra,
        moneyOut: paidN > 1,
        reasons: [`${list.length} invoices with matching number and amount; ${paidN} paid`],
        facts: [
          ...list.map((i) => ({ k: `${i.XBLNR}`, v: `doc ${i.BELNR} · ${fmtDate(i.BLDAT)} · ₹${inr(i.RMWWR, 2)} · ${ctx.idx.paymentsByInvoice.has(i.BELNR) ? 'paid' : 'unpaid'}` })),
          { k: 'Normalised number', v: normInvoiceNo(list[0].XBLNR) },
          { k: 'Times paid', v: String(paidN), bad: paidN > 1 }
        ],
        condition: `${v?.NAME1 || list[0].LIFNR} (${list[0].LIFNR}) invoice ${list.map((i) => `${i.XBLNR} (doc ${i.BELNR}, ${fmtDate(i.BLDAT)})`).join(' and ')} for ₹${inr(list[0].RMWWR, 2)} each ${list.length > 2 ? 'were' : 'were both'} posted; ${paidN} of them ${paidN === 1 ? 'was' : 'were'} paid.`
      });
    }
    return { population: ctx.data.invoices.length, exceptions: out };
  }
};
