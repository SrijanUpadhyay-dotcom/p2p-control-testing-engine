// Risk and control matrix references used by the rules and in drafted observations.
// Source: the P2P RCM in the companion full pack (self-built practice project).

export const RISKS = {
  R02: { id: 'R02', rating: 'High', text: 'Sensitive vendor data (bank account, payment terms) is changed without authorisation, diverting payments.' },
  R05: { id: 'R05', rating: 'High', text: 'POs are created or changed without approval as per DOA, split to stay under limits, or raised after the invoice.' },
  R09: { id: 'R09', rating: 'High', text: 'Invoices are posted at the wrong price or quantity, or mismatches are released without valid reason.' },
  R10: { id: 'R10', rating: 'Medium', text: 'The same invoice is recorded and paid more than once.' },
  R14: { id: 'R14', rating: 'High', text: 'MSME vendors are paid beyond 45 days, or MSME dues are not tracked and disclosed.' },
  R15: { id: 'R15', rating: 'High', text: 'Users have access that lets one person complete conflicting steps, or access is not removed on exit or role change.' }
};

export const SOD_PAIRS = [
  { id: 'SoD-01', a: ['XK01', 'XK02'], aName: 'Vendor create/change', b: ['F110'], bName: 'Payment run', risk: 'Set up a fake vendor or change a bank account, then pay it' },
  { id: 'SoD-02', a: ['XK02'], aName: 'Vendor change', b: ['FK08'], bName: 'Confirm sensitive change', risk: 'Defeat the dual control on bank details' },
  { id: 'SoD-03', a: ['ME21N'], aName: 'PO create', b: ['ME29N'], bName: 'PO release', risk: 'Approve their own purchases' },
  { id: 'SoD-04', a: ['ME21N'], aName: 'PO create', b: ['MIGO'], bName: 'Goods receipt', risk: 'Order and confirm receipt with no independent check' },
  { id: 'SoD-05', a: ['MIGO'], aName: 'Goods receipt', b: ['MIRO'], bName: 'Invoice posting', risk: 'Create both internal legs of the 3-way match' },
  { id: 'SoD-06', a: ['MIRO'], aName: 'Invoice posting', b: ['MRBR'], bName: 'Release blocked invoice', risk: 'Post a mismatched invoice and clear it' },
  { id: 'SoD-07', a: ['MIRO'], aName: 'Invoice posting', b: ['F110'], bName: 'Payment run', risk: 'Post and pay a liability alone' }
];

export const CONTROLS = {
  C02: {
    criteria: 'Control C02: bank details and payment terms are sensitive fields. Before confirming a bank change in FK08, a second authorised user checks the approved request, a vendor letter on letterhead with bank proof, and a documented call-back to the contact number already in SAP.',
    effect: 'Payments can be diverted to an account that does not belong to the vendor through a fake bank-change request.',
    recommendation: 'Make the call-back section mandatory on the change form; have the FK08 confirmer sign a checklist before confirming; check that requests come from the vendor\'s registered email; look back at all bank changes in the period.'
  },
  C06: {
    criteria: 'Control C06: every PO is released in SAP at the level the delegation of authority requires for its value, before goods are received; a value increase after release resets the release; the creator cannot release.',
    effect: 'Spend can be committed without approval from the person accountable for it.',
    recommendation: 'Compare the release strategy configuration to the board-approved DOA; review users holding release codes; investigate POs received before release.'
  },
  C09: {
    criteria: 'Control C09: POs are raised and approved before the vendor supplies and invoices; POs are not split to stay under a DOA limit. The Purchase Head reviews after-the-fact and split POs monthly.',
    effect: 'The PO approval becomes a formality, and spend bypasses the approver the DOA requires.',
    recommendation: 'Require a written exception approval for any PO raised after the invoice; block release of consecutive POs to the same vendor and material group whose total crosses a DOA limit; escalate repeat cases to the CFO.'
  },
  C13: {
    criteria: 'Control C13: invoices blocked by the 3-way match are released in MRBR only by the AP Lead, not the poster, after written buyer confirmation (price) or a corrected GRN (quantity) dated on or before the release.',
    effect: 'Invoices can be paid at a price or quantity that was never approved.',
    recommendation: 'Do not release price blocks against a rate that is not yet approved; require the confirmation reference in the release text; recover any amount overpaid by debit note.'
  },
  C14: {
    criteria: 'Control C14: SAP warns on duplicate invoices, and AP runs a monthly duplicate review that catches near-matches (e.g. INV/123 vs INV-123) before the next payment run.',
    effect: 'The same invoice is paid twice; recovery from the vendor is slow and uncertain.',
    recommendation: 'Recover the duplicate payment; set the SAP duplicate check to compare normalised invoice numbers; run the near-match review before every payment run.'
  },
  C18: {
    criteria: 'MSMED Act s.15–16 and Income Tax s.43B(h) (from FY 2023-24): dues to micro and small enterprises are paid within 45 days of acceptance; interest at three times the RBI bank rate, compounded monthly, applies to late payment; amounts outstanding beyond the limit at year-end are not deductible until paid.',
    effect: 'Interest liability under the MSMED Act, tax disallowance under s.43B(h), and incorrect MSME disclosure in Schedule III and MSME Form I.',
    recommendation: 'Flag micro and small vendors in the payment proposal; escalate dues approaching 45 days; provide for MSMED interest; compute the s.43B(h) amount at year-end from the same report.'
  },
  C20: {
    criteria: 'Control C20: no user holds both sides of a P2P conflict pair; process owners review access quarterly and remove conflicts or document a compensating control.',
    effect: 'One person can complete conflicting steps alone, which undermines every other control in the cycle.',
    recommendation: 'Remove one side of the conflict; where removal is not possible, document a compensating review and test it.'
  }
};
