import c02 from './c02-bank-change.js';
import c06 from './c06-po-release.js';
import c09 from './c09-po-timing.js';
import c13 from './c13-block-release.js';
import c14 from './c14-duplicates.js';
import c18 from './c18-msme.js';
import c20 from './c20-sod.js';

export const RULE_LIBRARY_VERSION = 'P2P-IN v1.0';
export const RULES = [c02, c06, c09, c13, c14, c18, c20];
export const RULE_BY_ID = Object.fromEntries(RULES.map((r) => [r.id, r]));

export function defaultParams() {
  return Object.fromEntries(RULES.map((r) => [r.id, Object.fromEntries(r.params.map((p) => [p.key, p.default]))]));
}
