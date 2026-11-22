// Transparent severity score (0–100). Documented in docs/METHODOLOGY.md.
import { RISKS } from './rcm.js';

export const SCORE_MODEL = {
  risk: { High: 40, Medium: 25, Low: 10 },
  amountBands: [
    { min: 1000000, pts: 30, label: '≥ ₹10 lakh' },
    { min: 500000, pts: 22, label: '≥ ₹5 lakh' },
    { min: 100000, pts: 15, label: '≥ ₹1 lakh' }
  ],
  aboveThreshold: 8,
  nonMonetary: 20,
  fraudIndicator: 15,
  moneyOut: 10,
  severity: { high: 70, medium: 50 }
};

export function scoreException(ex, rule, threshold) {
  const parts = [];
  const r = RISKS[rule.risk]?.rating || 'Medium';
  parts.push({ k: `Risk ${rule.risk} rated ${r}`, pts: SCORE_MODEL.risk[r] });
  if (ex.amount === null || ex.amount === undefined) {
    parts.push({ k: 'Access risk (no amount)', pts: SCORE_MODEL.nonMonetary });
  } else {
    const band = SCORE_MODEL.amountBands.find((b) => ex.amount >= b.min);
    if (band) parts.push({ k: `Amount ${band.label}`, pts: band.pts });
    else if (ex.amount >= threshold) parts.push({ k: 'Amount above reporting threshold', pts: SCORE_MODEL.aboveThreshold });
    else parts.push({ k: 'Amount below reporting threshold', pts: 0 });
  }
  if (rule.fraud) parts.push({ k: 'Fraud indicator test', pts: SCORE_MODEL.fraudIndicator });
  if (ex.moneyOut) parts.push({ k: 'Money already paid out', pts: SCORE_MODEL.moneyOut });
  const score = Math.min(100, parts.reduce((s, p) => s + p.pts, 0));
  const severity = score >= SCORE_MODEL.severity.high ? 'High' : score >= SCORE_MODEL.severity.medium ? 'Medium' : 'Low';
  return { score, severity, parts };
}
