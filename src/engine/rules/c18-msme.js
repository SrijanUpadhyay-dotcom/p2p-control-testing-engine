import { fmtDate, inr, daysBetween } from '../util.js';

/** MSMED Act s.16: compound interest with monthly rests at three times the RBI bank rate. */
export function msmeInterest(amount, daysLate, bankRatePct) {
  if (daysLate <= 0) return 0;
  const monthly = (3 * bankRatePct) / 100 / 12;
  const months = daysLate / (365 / 12);
  return amount * (Math.pow(1 + monthly, months) - 1);
}

export default {
  id: 'C18',
  name: 'MSME dues beyond 45 days',
  type: 'Detective',
  risk: 'R14',
  subprocess: 'Payments',
  assertion: 'Completeness',
  coso: 'P10',
  fraud: false,
  needs: ['invoices', 'payments', 'vendors'],
  populationOf: 'invoices',
  logic: 'For invoices from Micro and Small vendors: paid after the limit from the date of acceptance (MSMED interest exposure), or unpaid at period end beyond the limit (s.43B(h) disallowance). Payment lines with no value date are excluded and logged.',
  params: [
    { key: 'limit', label: 'Payment limit (days from acceptance)', type: 'int', default: '45' },
    { key: 'bankRate', label: 'RBI bank rate (%)', type: 'float', default: '6.75' },
    { key: 'categories', label: 'MSME categories covered', type: 'list', default: 'Micro;Small' }
  ],
  run(ctx, p) {
    const limit = parseInt(p.limit, 10) || 45;
    const rate = parseFloat(p.bankRate) || 6.75;
    const cats = new Set(String(p.categories).split(/[;,]/).map((s) => s.trim().toLowerCase()));
    const yearEnd = ctx.period.to;
    const out = [];
    let population = 0, excluded = 0, disallowance = 0, interestTotal = 0;
    for (const inv of ctx.data.invoices) {
      const v = ctx.vendors.get(inv.LIFNR);
      if (!v || !cats.has(String(v.MSME_CAT || '').toLowerCase())) continue;
      if (!inv.ACCEPT_DATE) continue;
      population++;
      const pays = ctx.idx.paymentsByInvoice.get(inv.BELNR) || [];
      if (pays.some((x) => !x.VALUT)) { excluded++; continue; }
      const paidOn = pays.length ? pays.map((x) => x.VALUT).sort()[0] : null;
      const days = paidOn ? daysBetween(inv.ACCEPT_DATE, paidOn) : daysBetween(inv.ACCEPT_DATE, yearEnd);
      if (days <= limit) continue;
      const interest = msmeInterest(inv.RMWWR, days - limit, rate);
      interestTotal += interest;
      const unpaid = !paidOn;
      if (unpaid) disallowance += inv.RMWWR;
      out.push({
        key: inv.BELNR,
        title: unpaid ? 'MSME due unpaid beyond 45 days at year-end' : 'MSME vendor paid after 45 days',
        record: unpaid ? `Unpaid at ${fmtDate(yearEnd)} · day ${days}` : `Paid day ${days} · MSME ${String(v.MSME_CAT).toLowerCase()}`,
        vendor: inv.LIFNR,
        party: `${v.NAME1} · ${inv.LIFNR}`,
        amount: inv.RMWWR,
        moneyOut: !unpaid,
        interest,
        disallowance: unpaid ? inv.RMWWR : 0,
        reasons: [unpaid ? `${days} days outstanding at year-end` : `paid ${days} days after acceptance`],
        facts: [
          { k: 'Invoice / doc', v: `${inv.XBLNR} · ${inv.BELNR}` },
          { k: 'MSME category / Udyam', v: `${v.MSME_CAT} · ${v.UDYAM_NO || '—'}` },
          { k: 'Date of acceptance', v: fmtDate(inv.ACCEPT_DATE) },
          { k: unpaid ? 'Outstanding at year-end' : 'Paid on', v: unpaid ? fmtDate(yearEnd) : fmtDate(paidOn), bad: true },
          { k: 'Days from acceptance', v: `${days} (limit ${limit})`, bad: true },
          { k: 'Amount', v: `₹${inr(inv.RMWWR, 2)}` },
          { k: 'MSMED interest (est.)', v: `₹${inr(interest)} at ${(3 * rate).toFixed(2)}% p.a., monthly rests` },
          ...(unpaid ? [{ k: 's.43B(h) disallowance', v: `₹${inr(inv.RMWWR)}`, bad: true }] : [])
        ],
        condition: unpaid
          ? `Invoice ${inv.XBLNR} from ${v.NAME1} (${inv.LIFNR}, ${String(v.MSME_CAT).toLowerCase()} enterprise) for ₹${inr(inv.RMWWR)}, accepted on ${fmtDate(inv.ACCEPT_DATE)}, was unpaid at ${fmtDate(yearEnd)}, ${days} days after acceptance. The amount is not deductible under s.43B(h) until paid; estimated MSMED interest to year-end is ₹${inr(interest)}.`
          : `Invoice ${inv.XBLNR} from ${v.NAME1} (${inv.LIFNR}, ${String(v.MSME_CAT).toLowerCase()} enterprise) for ₹${inr(inv.RMWWR)}, accepted on ${fmtDate(inv.ACCEPT_DATE)}, was paid on ${fmtDate(paidOn)}, ${days} days after acceptance against a ${limit}-day limit. Estimated MSMED interest is ₹${inr(interest)}.`
      });
    }
    return {
      population,
      exceptions: out,
      summary: { disallowance, interest: interestTotal, excluded },
      notes: excluded ? [`${excluded} MSME invoice(s) excluded because a payment line has no value date.`] : []
    };
  }
};
