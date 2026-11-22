import { fmtDate, inr, splitList } from '../util.js';

export default {
  id: 'C02',
  name: 'Bank change paid before verification',
  type: 'Preventive',
  risk: 'R02',
  subprocess: 'Vendor master',
  assertion: 'Occurrence',
  coso: 'P10',
  fraud: true,
  needs: ['vendor_changes', 'payments'],
  populationOf: 'vendor_changes',
  logic: 'For each bank or payment-term change: the FK08 confirmer must be an authorised user other than the changer. For bank changes, a vendor letter with bank proof and a logged call-back are also required, and no payment may go out between the change and its confirmation.',
  params: [
    { key: 'confirmers', label: 'Authorised FK08 confirmers', type: 'list', default: 'RMEHTA;ABHATT' }
  ],
  run(ctx, p) {
    const auth = new Set(splitList(p.confirmers).map((s) => s.toUpperCase()));
    const out = [];
    for (const c of ctx.data.vendor_changes) {
      const bank = /BANK/i.test(c.FIELD || '');
      const facts = [];
      const bad = [];
      const changer = (c.USERNAME || '').toUpperCase();
      const conf = (c.CONF_USER || '').toUpperCase();
      facts.push({ k: 'Change document', v: `${c.CHANGENR} · ${fmtDate(c.UDATE)}` });
      facts.push({ k: 'Field changed', v: c.FIELD });
      facts.push({ k: 'Changed by / confirmed by', v: `${changer || '—'} / ${conf || '—'}`, bad: !conf || conf === changer });
      if (!conf) bad.push('not confirmed in FK08');
      else if (conf === changer) bad.push('confirmed by the same user who made the change');
      if (conf && auth.size && !auth.has(conf)) { bad.push(`confirmed by ${conf}, who is not an authorised confirmer`); facts.push({ k: 'Confirmer authorised', v: 'No', bad: true }); }
      if (c.REQUEST_SOURCE) facts.push({ k: 'Request received from', v: c.REQUEST_SOURCE });
      let firstPay = null;
      if (bank) {
        facts.push({ k: 'Vendor letter with bank proof', v: c.LETTER_ON_FILE ? 'On file' : 'Not on file', bad: !c.LETTER_ON_FILE });
        facts.push({ k: 'Call-back to number in SAP', v: c.CALLBACK_LOGGED ? 'Logged' : 'Not logged', bad: !c.CALLBACK_LOGGED });
        if (!c.LETTER_ON_FILE) bad.push('no vendor letter or bank proof on file');
        if (!c.CALLBACK_LOGGED) bad.push('no call-back logged');
        const pays = (ctx.idx.paymentsByVendor.get(c.LIFNR) || []).filter((x) => x.VALUT && x.VALUT >= c.UDATE).sort((a, b) => (a.VALUT < b.VALUT ? -1 : 1));
        firstPay = pays[0] || null;
        const early = c.CONF_DATE ? pays.filter((x) => x.VALUT < c.CONF_DATE) : pays;
        if (early.length) bad.push(`${early.length} payment(s) made before the change was confirmed`);
        facts.push({ k: 'FK08 confirmation', v: c.CONF_DATE ? fmtDate(c.CONF_DATE) + (c.CONF_DATE === c.UDATE ? ' (same day)' : '') : 'None', bad: !c.CONF_DATE });
        facts.push({ k: 'First payment after change', v: firstPay ? `${fmtDate(firstPay.VALUT)} · ₹${inr(firstPay.RWBTR)}` : 'None in period', bad: early.length > 0 });
      }
      if (!bad.length) continue;
      const v = ctx.vendors.get(c.LIFNR);
      out.push({
        key: c.CHANGENR,
        title: bank ? 'Bank account changed without full verification' : 'Payment terms change not properly confirmed',
        record: `Change ${c.CHANGENR}`,
        vendor: c.LIFNR,
        party: `${v?.NAME1 || 'Vendor'} · ${c.LIFNR}`,
        amount: firstPay ? firstPay.RWBTR : null,
        moneyOut: !!firstPay,
        reasons: bad,
        facts,
        condition: `The ${bank ? 'bank account' : 'payment terms'} of ${v?.NAME1 || 'vendor'} (${c.LIFNR}) ${bank ? 'was' : 'were'} changed on ${fmtDate(c.UDATE)} (${c.CHANGENR}) by ${changer}${conf ? ` and confirmed in FK08 by ${conf}${c.CONF_DATE ? ' on ' + fmtDate(c.CONF_DATE) : ''}` : ''}, with ${bad.join(', ')}.${firstPay ? ` ₹${inr(firstPay.RWBTR)} was paid to the vendor on ${fmtDate(firstPay.VALUT)}.` : ''}`
      });
    }
    return { population: ctx.data.vendor_changes.length, exceptions: out };
  }
};
