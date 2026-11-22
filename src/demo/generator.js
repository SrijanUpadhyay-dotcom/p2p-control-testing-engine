// Seeded generator for the fictional demo dataset (Sabarmati Autoparts Ltd, FY 2023-24).
// Deterministic: the same seed always produces the same files, so results can be reproduced.
// Exceptions are planted on purpose (see PLANTED); regular data is built so it does not
// break any rule. test/engine.test.mjs checks both.
import { addDays, dayNum, fromDayNum, toCSV } from '../engine/util.js';
import { requiredCodes } from '../engine/rules/c06-po-release.js';

export const DEMO_SEED = 20240331;
export const COUNTS = { purchase_orders: 6214, invoices: 17500, mrbr_releases: 312, users: 46, roleRows: 212, vendors: 410 };
export const PLANTED = { C02: 1, C06: 0, C09: 3, C13: 1, C14: 2, C18: 4, C20: 2 };

const FY_START = '2023-04-01', FY_END = '2024-03-31';

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- vendors
const FIXED_VENDORS = {
  100112: ['Narmada Coil Processors Pvt Ltd', 'steel', 'Small'],
  100145: ['Sanskar Castings Pvt Ltd', 'castings', 'Micro'],
  100163: ['Tapi Forge Works', 'castings', ''],
  100201: ['Saurashtra Packaging Industries', 'packaging', 'Small'],
  100217: ['Kutch Steel Strips Pvt Ltd', 'steel', ''],
  100244: ['Vatsal Engineering Services', 'services', 'Micro'],
  100259: ['Shivam Tooling Pvt Ltd', 'tooling', 'Small'],
  100276: ['Mahi Industrial Gases', 'consumables', ''],
  100290: ['Anand Surface Coatings Pvt Ltd', 'jobwork', 'Small'],
  100305: ['Bhavnagar Rolling Works', 'steel', ''],
  100318: ['Rann Logistics', 'services', ''],
  100331: ['Kesar Electricals', 'spares', 'Micro'],
  100342: ['Mehsana Machining Works', 'jobwork', 'Small'],
  100357: ['Ambaji Precision Components', 'jobwork', 'Small'],
  100366: ['Vishwa Safety Products', 'consumables', 'Micro'],
  100374: ['Lotus Lubricants', 'consumables', ''],
  100388: ['Gokul Fasteners Pvt Ltd', 'components', ''],
  100395: ['Dwarka Hydraulics', 'spares', 'Small'],
  100402: ['Sabar Abrasives', 'consumables', 'Micro'],
  100419: ['Navkar Rubber Products', 'components', ''],
  100427: ['Shreenath Transport Co', 'services', ''],
  100436: ['Gir Steel Service Centre Pvt Ltd', 'steel', '']
};
const PLACES = ['Jamnagar', 'Rajkot', 'Vapi', 'Bharuch', 'Kalol', 'Sanand', 'Modasa', 'Unjha', 'Palanpur', 'Nadiad', 'Vadnagar', 'Kheda', 'Halol', 'Morbi', 'Gondal', 'Amreli', 'Porbandar', 'Veraval', 'Anjar', 'Bardoli', 'Dahej', 'Godhra', 'Himmatnagar', 'Jetpur', 'Kadi', 'Mundra', 'Navsari', 'Patan', 'Surendra', 'Valsad', 'Viramgam', 'Wadhwan', 'Chhatral', 'Becharaji', 'Changodar', 'Odhav', 'Vatva', 'Naroda', 'Kathwada', 'Bavla'];
const CAT_TYPES = {
  steel: ['Steel Strips Pvt Ltd', 'Steel Service Centre', 'Rolling Mills', 'Coil Processors'],
  castings: ['Castings Pvt Ltd', 'Foundry Works', 'Forgings', 'Alloy Castings'],
  jobwork: ['Machining Works', 'Surface Treatment', 'Press Works', 'Fabricators'],
  components: ['Fasteners Pvt Ltd', 'Precision Components', 'Rubber Products', 'Auto Components'],
  consumables: ['Industrial Gases', 'Lubricants', 'Safety Products', 'Abrasives', 'Welding Supplies'],
  spares: ['Hydraulics', 'Electricals', 'Bearings & Spares', 'Pneumatics'],
  services: ['Logistics', 'Transport Co', 'Engineering Services', 'Facility Services', 'Calibration Services'],
  packaging: ['Packaging Industries', 'Corrugators', 'Pallets & Crates'],
  tooling: ['Tooling Pvt Ltd', 'Die Makers', 'Tool Room'],
  capital: ['Machine Tools Pvt Ltd', 'Automation Systems', 'Press Machinery']
};
const CAT_QUOTA = { steel: 12, castings: 30, jobwork: 50, components: 45, consumables: 70, spares: 60, services: 70, packaging: 25, tooling: 25, capital: 23 };
const CAT_SPEC = {
  // matkl, PO type, PO value range (₹), PO weight
  steel: { matkl: ['STEEL-CR', 'STEEL-HR'], type: 'ZRC', min: 500000, max: 9000000, w: 6 },
  castings: { matkl: ['CASTING'], type: 'ZRC', min: 200000, max: 3500000, w: 3 },
  jobwork: { matkl: ['JOBWORK'], type: 'NB', min: 50000, max: 1500000, w: 2 },
  components: { matkl: ['COMPONENT'], type: 'NB', min: 50000, max: 900000, w: 2 },
  consumables: { matkl: ['CONSUMABLE'], type: 'NB', min: 10000, max: 400000, w: 1 },
  spares: { matkl: ['SPARES'], type: 'NB', min: 10000, max: 600000, w: 1 },
  services: { matkl: ['SERVICE'], type: 'NB', min: 25000, max: 900000, w: 1 },
  packaging: { matkl: ['PACKING'], type: 'NB', min: 20000, max: 500000, w: 1 },
  tooling: { matkl: ['TOOLING'], type: 'NB', min: 50000, max: 1200000, w: 1 },
  capital: { matkl: ['CAPEX'], type: 'NB', min: 1000000, max: 20000000, w: 0.3 }
};

// The 64 sensitive vendor changes, as listed in the full pack (Part D, population).
const CHANGES = `CD004114,2023-04-04,100427,Bank account,KDESAI,RMEHTA,2023-04-04
CD004117,2023-04-08,100244,Bank account,PSHAH,ABHATT,2023-04-09
CD004120,2023-04-18,100342,Bank account,KDESAI,RMEHTA,2023-04-19
CD004125,2023-04-23,100290,Bank account,PSHAH,ABHATT,2023-04-24
CD004136,2023-04-26,100342,Bank account,KDESAI,RMEHTA,2023-04-27
CD004158,2023-05-02,100395,Bank account + IFSC,PSHAH,RMEHTA,2023-05-02
CD004185,2023-05-07,100305,Payment terms,KDESAI,ABHATT,2023-05-07
CD004187,2023-05-16,100395,Payment terms,PSHAH,ABHATT,2023-05-17
CD004208,2023-05-21,100290,Bank account,PSHAH,RMEHTA,2023-05-22
CD004233,2023-05-25,100290,Bank account,PSHAH,RMEHTA,2023-05-27
CD004267,2023-06-02,100305,Bank account,PSHAH,ABHATT,2023-06-03
CD004276,2023-06-06,100374,Payment terms,KDESAI,RMEHTA,2023-06-07
CD004281,2023-06-09,100305,Bank account,PSHAH,RMEHTA,2023-06-11
CD004286,2023-06-19,100427,Bank account,PSHAH,RMEHTA,2023-06-19
CD004296,2023-06-22,100427,Payment terms,PSHAH,RMEHTA,2023-06-22
CD004310,2023-06-28,100427,Payment terms,PSHAH,ABHATT,2023-06-29
CD004321,2023-07-05,100318,Bank account,PSHAH,ABHATT,2023-07-05
CD004326,2023-07-10,100290,Payment terms,PSHAH,RMEHTA,2023-07-11
CD004373,2023-07-13,100374,Payment terms,PSHAH,RMEHTA,2023-07-15
CD004388,2023-07-23,100276,Bank account,PSHAH,ABHATT,2023-07-23
CD004396,2023-07-25,100163,Bank account + IFSC,PSHAH,ABHATT,2023-07-26
CD004414,2023-08-03,100374,Bank account,PSHAH,RMEHTA,2023-08-04
CD004421,2023-08-07,100342,Bank account,PSHAH,ABHATT,2023-08-08
CD004466,2023-08-14,100318,Bank account,PSHAH,RMEHTA,2023-08-15
CD004467,2023-08-17,100419,Bank account,PSHAH,ABHATT,2023-08-18
CD004471,2023-08-26,100395,Bank account,PSHAH,ABHATT,2023-08-26
CD004477,2023-08-28,100436,Payment terms,PSHAH,ABHATT,2023-08-29
CD004488,2023-09-03,100357,Payment terms,PSHAH,ABHATT,2023-09-03
CD004531,2023-09-11,100366,Payment terms,PSHAH,ABHATT,2023-09-13
CD004533,2023-09-17,100276,Bank account,PSHAH,RMEHTA,2023-09-17
CD004541,2023-09-20,100259,Bank account + IFSC,PSHAH,ABHATT,2023-09-21
CD004555,2023-09-28,100163,Payment terms,PSHAH,RMEHTA,2023-09-29
CD004558,2023-09-30,100259,Bank account,PSHAH,RMEHTA,2023-10-01
CD004565,2023-10-08,100305,Bank account,KDESAI,RMEHTA,2023-10-09
CD004585,2023-10-15,100305,Payment terms,KDESAI,RMEHTA,2023-10-15
CD004594,2023-10-19,100366,Bank account + IFSC,PSHAH,ABHATT,2023-10-20
CD004610,2023-10-26,100357,Payment terms,PSHAH,RMEHTA,2023-10-26
CD004624,2023-10-30,100374,Bank account,PSHAH,RMEHTA,2023-10-31
CD004679,2023-11-10,100395,Payment terms,PSHAH,RMEHTA,2023-11-11
CD004642,2023-11-14,100388,Bank account,KDESAI,ABHATT,2023-11-14
CD004685,2023-11-14,100427,Bank account + IFSC,PSHAH,ABHATT,2023-11-14
CD004686,2023-11-23,100290,Payment terms,PSHAH,RMEHTA,2023-11-23
CD004703,2023-11-28,100366,Bank account,PSHAH,RMEHTA,2023-11-29
CD004704,2023-12-03,100276,Bank account,KDESAI,ABHATT,2023-12-05
CD004706,2023-12-10,100427,Payment terms,KDESAI,RMEHTA,2023-12-10
CD004735,2023-12-14,100244,Payment terms,PSHAH,RMEHTA,2023-12-16
CD004742,2023-12-19,100357,Payment terms,PSHAH,RMEHTA,2023-12-20
CD004757,2023-12-27,100427,Bank account + IFSC,PSHAH,RMEHTA,2023-12-27
CD004773,2023-12-30,100436,Payment terms,PSHAH,RMEHTA,2023-12-30
CD004776,2024-01-04,100331,Bank account + IFSC,PSHAH,ABHATT,2024-01-04
CD004791,2024-01-10,100163,Payment terms,KDESAI,RMEHTA,2024-01-12
CD004827,2024-01-17,100318,Bank account,PSHAH,RMEHTA,2024-01-17
CD004835,2024-01-22,100201,Payment terms,PSHAH,ABHATT,2024-01-23
CD004843,2024-01-26,100259,Bank account,KDESAI,RMEHTA,2024-01-27
CD004851,2024-02-01,100436,Payment terms,PSHAH,RMEHTA,2024-02-01
CD004852,2024-02-08,100259,Payment terms,PSHAH,RMEHTA,2024-02-10
CD004878,2024-02-16,100374,Bank account,PSHAH,RMEHTA,2024-02-17
CD004889,2024-02-22,100163,Payment terms,PSHAH,ABHATT,2024-02-22
CD004898,2024-02-25,100276,Bank account,PSHAH,ABHATT,2024-02-27
CD004901,2024-03-03,100419,Bank account,PSHAH,RMEHTA,2024-03-05
CD004910,2024-03-10,100290,Payment terms,PSHAH,RMEHTA,2024-03-12
CD004933,2024-03-13,100244,Bank account,PSHAH,RMEHTA,2024-03-15
CD004949,2024-03-20,100342,Payment terms,PSHAH,RMEHTA,2024-03-21
CD004980,2024-03-26,100395,Bank account,PSHAH,ABHATT,2024-03-27`;

// ---------------------------------------------------------------- users & roles
const ROLES = {
  Z_DISPLAY_P2P: 'ME23N;ME2N;XK03;FBL1N;MB51',
  Z_MM_REQUESTER: 'ME51N;ME52N;ME53N',
  Z_MM_PR_APPROVER: 'ME54N',
  Z_MM_BUYER: 'ME21N;ME22N;ME31K;ME2N',
  Z_MM_PO_REL_PM: 'ME29N;ME28',
  Z_MM_PO_REL_PH: 'ME29N;ME28',
  Z_MM_PO_REL_CFO: 'ME29N',
  Z_MM_PO_REL_MD: 'ME29N',
  Z_MM_STORES: 'MIGO;MB51;MB52',
  Z_MM_QUALITY: 'QA32;QA33',
  Z_FI_MASTERDATA: 'XK01;XK02;XK03;XK05',
  Z_FI_MD_CONFIRM: 'FK08;FK09',
  Z_FI_AP_EXEC: 'MIRO;MIR4;FBL1N',
  Z_FI_AP_LEAD: 'MRBR;MR11;FBL1N',
  Z_FI_PAYMENTS: 'F110;FBL1N',
  Z_FI_TAX: 'J1INMIS;FBL1N',
  Z_FI_TREASURY: 'FF67;FEBAN',
  Z_BASIS_ADMIN: 'SU01;SUIM;SM20',
  Z_REPORTS_MM: 'ME2N;MB52;ME80FN',
  Z_REPORTS_FI: 'S_ALR_87012089;FBL1N;FAGLB03',
  Z_ESS: 'PA20;PTMW'
};
const ROSTER = [
  ['RMEHTA', 'R. Mehta', 'Finance', ['Z_FI_MD_CONFIRM', 'Z_REPORTS_FI']],
  ['ABHATT', 'A. Bhatt', 'Finance', ['Z_FI_MD_CONFIRM']],
  ['PSHAH', 'P. Shah', 'Finance · Master data', ['Z_FI_MASTERDATA', 'Z_FI_PAYMENTS']],
  ['KDESAI', 'K. Desai', 'Finance · Master data', ['Z_FI_MASTERDATA']],
  ['JPATEL', 'J. Patel', 'Accounts payable', ['Z_FI_AP_LEAD', 'Z_FI_PAYMENTS']],
  ['MPARMAR', 'M. Parmar', 'Accounts payable', ['Z_FI_AP_EXEC']],
  ['HSOLANKI', 'H. Solanki', 'Accounts payable', ['Z_FI_AP_EXEC']],
  ['SNAIR', 'S. Nair', 'Taxation', ['Z_FI_TAX']],
  ['VJOSHI', 'V. Joshi', 'Taxation', ['Z_FI_TAX']],
  ['AKRAO', 'A. K. Rao', 'Finance · CFO', ['Z_MM_PO_REL_CFO', 'Z_REPORTS_FI']],
  ['NKAPOOR', 'N. Kapoor', 'Treasury', ['Z_FI_TREASURY']],
  ['DRAVAL', 'D. Raval', 'Purchase', ['Z_MM_BUYER', 'Z_MM_STORES']],
  ['SIYER', 'S. Iyer', 'Purchase', ['Z_MM_BUYER']],
  ['HJOSHI', 'H. Joshi', 'Purchase · Manager', ['Z_MM_PO_REL_PM']],
  ['NTRIVEDI', 'N. Trivedi', 'Purchase · Head', ['Z_MM_PO_REL_PH', 'Z_MM_PR_APPROVER']],
  ['VSABARWAL', 'V. Sabarwal', 'Management · MD', ['Z_MM_PO_REL_MD']]
];
const STORE_IDS = ['BPANDYA', 'RCHAUHAN', 'GTHAKOR', 'MVAGHELA', 'SRATHOD', 'KPRAJAPATI', 'AMAKWANA', 'DPARIKH'];
const QUALITY_IDS = ['TSONI', 'PBAROT', 'NDAVE', 'RVYAS', 'KSHUKLA'];
const REQ_IDS = ['APANCHAL', 'BMODI', 'CGOHIL', 'DJADEJA', 'EKAPADIA', 'FMISTRY', 'GPATHAK', 'HRANA', 'IDESAI', 'JSHETH', 'KTRIVEDI', 'LVORA', 'MZALA', 'NBHAVSAR'];
const IT_IDS = ['ITADMIN1', 'ITADMIN2', 'SECOPS1'];

// ---------------------------------------------------------------- generator
export function generateDemo(seed = DEMO_SEED) {
  const rnd = mulberry32(seed);
  const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const round = (n, to) => Math.round(n / to) * to;
  const money = (a, b, to = 100) => round(a + rnd() * (b - a), to);
  const D0 = dayNum(FY_START), DN = dayNum(FY_END);

  // Payment runs: Thursdays, four skipped (48 runs)
  const skip = new Set(['2023-04-13', '2023-08-17', '2023-11-16', '2023-12-28']);
  const runs = [];
  for (let d = dayNum('2023-04-06'); d <= DN; d += 7) { const iso = fromDayNum(d); if (!skip.has(iso)) runs.push(iso); }
  const runOnOrAfter = (iso) => runs.find((r) => r >= iso) || null;

  // ---- vendors
  const vendors = [];
  const used = new Set();
  const quota = { ...CAT_QUOTA };
  for (const [, [, cat]] of Object.entries(FIXED_VENDORS)) quota[cat]--;
  const freeCats = Object.entries(quota).flatMap(([c, n]) => Array(n).fill(c));
  for (let i = freeCats.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [freeCats[i], freeCats[j]] = [freeCats[j], freeCats[i]]; }
  let fi = 0;
  const msmeFor = () => { const r = rnd(); return r < 0.13 ? 'Micro' : r < 0.31 ? 'Small' : r < 0.38 ? 'Medium' : ''; };
  for (let code = 100031; code <= 100440; code++) {
    let name, cat, msme;
    if (FIXED_VENDORS[code]) [name, cat, msme] = FIXED_VENDORS[code];
    else {
      cat = freeCats[fi++];
      do { name = `${pick(PLACES)} ${pick(CAT_TYPES[cat])}`; } while (used.has(name) || Object.values(FIXED_VENDORS).some((v) => v[0] === name));
      msme = msmeFor();
    }
    used.add(name);
    const pan = 'AA' + String.fromCharCode(65 + (code % 26)) + 'F' + 'C' + String(code).slice(-4) + String.fromCharCode(65 + ((code * 7) % 26));
    vendors.push({
      LIFNR: String(code), NAME1: name, cat,
      PAN: pan, GSTIN: '24' + pan + '1Z' + ((code % 9) + 1),
      MSME_CAT: msme, UDYAM_NO: msme ? `UDYAM-GJ-${String(code % 38).padStart(2, '0')}-${String(code * 13).slice(-7)}` : '',
      ERDAT: fromDayNum(dayNum('2015-01-01') + (code % 2900))
    });
  }
  const V = Object.fromEntries(vendors.map((v) => [v.LIFNR, v]));
  const isMSME = (lifnr) => ['Micro', 'Small'].includes(V[lifnr].MSME_CAT);

  // ---- purchase orders
  const pos = [];
  const keyDates = new Map(); // NB vendor|matkl -> taken day numbers (keeps NB POs ≥ 9 days apart)
  const reserve = (k, d) => { if (!keyDates.has(k)) keyDates.set(k, []); keyDates.get(k).push(d); };
  const okGap = (k, d) => (keyDates.get(k) || []).every((t) => Math.abs(t - d) >= 9);
  const releasersFor = (codes) => codes.map((c) => ({ PM: 'HJOSHI', PH: 'NTRIVEDI', CFO: 'AKRAO', MD: 'VSABARWAL' })[c]).join(';');
  const doa = { pmLimit: 500000, phLimit: 2500000, cfoLimit: 10000000 };
  const makePO = (o) => {
    const codes = requiredCodes(o.NETWR, doa);
    const rel = o.REL_DATE || addDays(o.BEDAT, int(0, 3));
    const changed = o.changed ?? rnd() < 0.02;
    return {
      EBELN: '', BSART: o.BSART, BEDAT: o.BEDAT, LIFNR: o.LIFNR, MATKL: o.MATKL, NETWR: o.NETWR,
      ERNAM: o.ERNAM || pick(['DRAVAL', 'SIYER']), REL_CODES: codes.join(';'), RELEASED_BY: releasersFor(codes),
      REL_DATE: rel, FIRST_GR_DATE: o.FIRST_GR_DATE || (() => { const g = addDays(rel, int(2, 25)); return g > FY_END ? FY_END : g; })(),
      CHANGED_AFTER_REL: changed ? 'Y' : 'N', RE_RELEASED: changed ? 'Y' : '', _planted: o._planted || null
    };
  };

  // Planted POs
  const planted = {};
  planted.kesarPO = makePO({ BSART: 'NB', BEDAT: '2023-10-09', LIFNR: '100331', MATKL: 'SPARES', NETWR: 412000, ERNAM: 'SIYER', REL_DATE: '2023-10-09', FIRST_GR_DATE: '2023-10-10', changed: false, _planted: 'C09-ATF' });
  planted.navkarPO = makePO({ BSART: 'NB', BEDAT: '2024-02-19', LIFNR: '100419', MATKL: 'COMPONENT', NETWR: 186500, ERNAM: 'DRAVAL', REL_DATE: '2024-02-19', FIRST_GR_DATE: '2024-02-20', changed: false, _planted: 'C09-ATF' });
  planted.splitA = makePO({ BSART: 'NB', BEDAT: '2023-08-07', LIFNR: '100342', MATKL: 'JOBWORK', NETWR: 470000, ERNAM: 'SIYER', REL_DATE: '2023-08-07', FIRST_GR_DATE: '2023-08-16', changed: false, _planted: 'C09-SPLIT' });
  planted.splitB = makePO({ BSART: 'NB', BEDAT: '2023-08-10', LIFNR: '100342', MATKL: 'JOBWORK', NETWR: 490000, ERNAM: 'SIYER', REL_DATE: '2023-08-10', FIRST_GR_DATE: '2023-08-21', changed: false, _planted: 'C09-SPLIT' });
  planted.kutchPO = makePO({ BSART: 'ZRC', BEDAT: '2023-12-28', LIFNR: '100217', MATKL: 'STEEL-CR', NETWR: 1500000, ERNAM: 'DRAVAL', REL_DATE: '2023-12-29', FIRST_GR_DATE: '2024-01-04', changed: false });
  planted.gokulPO = makePO({ BSART: 'NB', BEDAT: '2023-10-03', LIFNR: '100388', MATKL: 'COMPONENT', NETWR: 391678, ERNAM: 'DRAVAL', REL_DATE: '2023-10-04', FIRST_GR_DATE: '2023-10-20', changed: false });
  planted.shivamPO = makePO({ BSART: 'NB', BEDAT: '2023-09-22', LIFNR: '100259', MATKL: 'TOOLING', NETWR: 440678, ERNAM: 'SIYER', REL_DATE: '2023-09-23', FIRST_GR_DATE: '2023-10-07', changed: false });
  planted.sanskarPO = makePO({ BSART: 'ZRC', BEDAT: '2023-07-14', LIFNR: '100145', MATKL: 'CASTING', NETWR: 264746, ERNAM: 'DRAVAL', REL_DATE: '2023-07-15', FIRST_GR_DATE: '2023-07-31', changed: false });
  planted.ambajiPO = makePO({ BSART: 'NB', BEDAT: '2023-11-24', LIFNR: '100357', MATKL: 'JOBWORK', NETWR: 126059, ERNAM: 'SIYER', REL_DATE: '2023-11-25', FIRST_GR_DATE: '2023-12-07', changed: false });
  planted.dwarkaPO = makePO({ BSART: 'NB', BEDAT: '2024-01-22', LIFNR: '100395', MATKL: 'SPARES', NETWR: 81610, ERNAM: 'DRAVAL', REL_DATE: '2024-01-22', FIRST_GR_DATE: '2024-02-02', changed: false });
  for (const po of Object.values(planted)) { pos.push(po); if (po.BSART === 'NB') reserve(po.LIFNR + '|' + po.MATKL, dayNum(po.BEDAT)); }

  // Regular POs
  const weighted = vendors.flatMap((v) => Array(Math.max(1, Math.round(CAT_SPEC[v.cat].w * 3))).fill(v));
  while (pos.length < COUNTS.purchase_orders) {
    const v = pick(weighted);
    const spec = CAT_SPEC[v.cat];
    const matkl = pick(spec.matkl);
    const type = spec.type === 'ZRC' ? (rnd() < 0.9 ? 'ZRC' : 'NB') : spec.type;
    let d = int(D0, dayNum('2024-03-05'));
    const k = v.LIFNR + '|' + matkl;
    if (type === 'NB') {
      let tries = 0;
      while (!okGap(k, d) && tries < 40) { d = int(D0, dayNum('2024-03-05')); tries++; }
      if (!okGap(k, d)) continue;
      reserve(k, d);
    }
    const skewed = spec.min + Math.pow(rnd(), 2.2) * (spec.max - spec.min);
    pos.push(makePO({ BSART: type, BEDAT: fromDayNum(d), LIFNR: v.LIFNR, MATKL: matkl, NETWR: round(skewed, 100) }));
  }
  pos.sort((a, b) => (a.BEDAT < b.BEDAT ? -1 : a.BEDAT > b.BEDAT ? 1 : 0));
  pos.forEach((p, i) => { p.EBELN = String(4500010001 + i); });

  // ---- invoices
  const invoices = [];
  const seq = {};
  const prefixOf = (lifnr) => V[lifnr].NAME1.replace(/[^A-Za-z ]/g, '').split(' ').filter((w) => w.length > 2 && !['Pvt', 'Ltd'].includes(w)).map((w) => w[0]).join('').slice(0, 3).toUpperCase().padEnd(3, 'X');
  const nextNo = (lifnr) => {
    if (!(lifnr in seq)) seq[lifnr] = lifnr === '100217' ? 1500 : int(101, 700);
    return `${prefixOf(lifnr)}/23-24/${String(seq[lifnr]++).padStart(4, '0')}`;
  };
  const poker = (o) => invoices.push({
    BELNR: '', GJAHR: '2023', LIFNR: o.LIFNR, XBLNR: o.XBLNR || nextNo(o.LIFNR), BLDAT: o.BLDAT, BUDAT: o.BUDAT,
    ACCEPT_DATE: o.ACCEPT_DATE, RMWWR: o.RMWWR, EBELN: o.EBELN, USNAM: o.USNAM || pick(['MPARMAR', 'HSOLANKI']), _p: o._p || null, _payOn: o._payOn || null, _unpaid: !!o._unpaid
  });
  // Planted invoices
  poker({ LIFNR: '100331', EBELN: planted.kesarPO.EBELN, BLDAT: '2023-10-03', BUDAT: '2023-10-12', ACCEPT_DATE: '2023-10-10', RMWWR: 486160.00, _p: 'C09-ATF' });
  poker({ LIFNR: '100419', EBELN: planted.navkarPO.EBELN, BLDAT: '2024-02-12', BUDAT: '2024-02-21', ACCEPT_DATE: '2024-02-20', RMWWR: 220070.00, _p: 'C09-ATF' });
  poker({ LIFNR: '100217', EBELN: planted.kutchPO.EBELN, XBLNR: 'KUT/23-24/1473', BLDAT: '2024-01-03', BUDAT: '2024-01-05', ACCEPT_DATE: '2024-01-04', RMWWR: 1538400.00, USNAM: 'MPARMAR', _payOn: '2024-02-15', _p: 'C13' });
  poker({ LIFNR: '100388', EBELN: planted.gokulPO.EBELN, BLDAT: '2023-10-19', BUDAT: '2023-10-23', ACCEPT_DATE: '2023-10-20', RMWWR: 462180.00, _payOn: '2023-11-23', _p: 'C02' });
  poker({ LIFNR: '100259', EBELN: planted.shivamPO.EBELN, BLDAT: '2023-10-06', BUDAT: '2023-10-09', ACCEPT_DATE: '2023-10-07', RMWWR: 520000.00, _payOn: '2023-12-07', _p: 'C18' });
  poker({ LIFNR: '100145', EBELN: planted.sanskarPO.EBELN, BLDAT: '2023-07-29', BUDAT: '2023-08-01', ACCEPT_DATE: '2023-07-31', RMWWR: 312400.00, _payOn: '2023-09-21', _p: 'C18' });
  poker({ LIFNR: '100357', EBELN: planted.ambajiPO.EBELN, BLDAT: '2023-12-06', BUDAT: '2023-12-08', ACCEPT_DATE: '2023-12-07', RMWWR: 148750.00, _payOn: '2024-01-25', _p: 'C18' });
  poker({ LIFNR: '100395', EBELN: planted.dwarkaPO.EBELN, BLDAT: '2024-02-01', BUDAT: '2024-02-03', ACCEPT_DATE: '2024-02-02', RMWWR: 96300.00, _unpaid: true, _p: 'C18' });
  // Duplicates (C14): attach to an early PO of each vendor
  const firstPO = (lifnr, before) => pos.find((p) => p.LIFNR === lifnr && p.BEDAT <= before && !p._planted);
  const tapiPO = firstPO('100163', '2023-09-01'), rannPO = firstPO('100318', '2023-11-20');
  poker({ LIFNR: '100163', EBELN: tapiPO.EBELN, XBLNR: 'TFW/1182', BLDAT: '2023-09-14', BUDAT: '2023-09-16', ACCEPT_DATE: '2023-09-15', RMWWR: 186240.00, _p: 'C14' });
  poker({ LIFNR: '100163', EBELN: tapiPO.EBELN, XBLNR: 'TFW-1182', BLDAT: '2023-09-21', BUDAT: '2023-09-23', ACCEPT_DATE: '2023-09-15', RMWWR: 186240.00, _p: 'C14' });
  poker({ LIFNR: '100318', EBELN: rannPO.EBELN, XBLNR: 'RL 0457', BLDAT: '2023-12-04', BUDAT: '2023-12-05', ACCEPT_DATE: '2023-12-04', RMWWR: 58900.00, _p: 'C14' });
  poker({ LIFNR: '100318', EBELN: rannPO.EBELN, XBLNR: 'RL0457', BLDAT: '2023-12-11', BUDAT: '2023-12-12', ACCEPT_DATE: '2023-12-04', RMWWR: 58900.00, _p: 'C14' });

  // Regular invoices: every regular PO gets at least one; the rest are spread by value.
  const regularPOs = pos.filter((p) => !Object.values(planted).includes(p));
  const plantedPOsWithInvoices = new Set(invoices.map((i) => i.EBELN));
  const plantedNeedInvoice = Object.values(planted).filter((p) => !plantedPOsWithInvoices.has(p.EBELN)); // split POs
  const perPO = new Map();
  for (const p of [...regularPOs, ...plantedNeedInvoice]) perPO.set(p, 1);
  let remaining = COUNTS.invoices - invoices.length - perPO.size;
  const byValue = regularPOs.slice().sort((a, b) => b.NETWR - a.NETWR);
  while (remaining > 0) { const p = byValue[Math.floor(Math.pow(rnd(), 1.6) * byValue.length)]; perPO.set(p, perPO.get(p) + 1); remaining--; }
  for (const [p, n] of perPO) {
    let accept = p.FIRST_GR_DATE;
    for (let k = 0; k < n; k++) {
      if (k > 0) accept = addDays(accept, int(4, 18));
      if (accept > FY_END) accept = FY_END;
      const share = (p.NETWR / n) * (0.85 + rnd() * 0.3);
      const gross = Math.round(share * 1.18 * 100 + int(1, 99)) / 100;
      let bldat = addDays(accept, -int(0, 2));
      if (bldat < p.BEDAT) bldat = p.BEDAT;
      let budat = addDays(accept, int(1, 5));
      if (budat > FY_END) budat = FY_END;
      poker({ LIFNR: p.LIFNR, EBELN: p.EBELN, BLDAT: bldat, BUDAT: budat, ACCEPT_DATE: accept, RMWWR: gross });
    }
  }
  invoices.sort((a, b) => (a.BUDAT < b.BUDAT ? -1 : a.BUDAT > b.BUDAT ? 1 : 0));
  invoices.forEach((inv, i) => { inv.BELNR = String(5105600001 + i); });

  // ---- MRBR releases (blocked invoices) — non-MSME vendors only, so release timing never breaches 45 days
  const releases = [];
  const kutchInv = invoices.find((i) => i._p === 'C13');
  releases.push({ BELNR: kutchInv.BELNR, XBLNR: kutchInv.XBLNR, BLDAT: kutchInv.BLDAT, LIFNR: kutchInv.LIFNR, EBELN: kutchInv.EBELN, BLOCK_REASON: 'Price', VARIANCE: 38400, USNAM: 'MPARMAR', REL_USER: 'JPATEL', REL_DATE: '2024-01-08', CONF_TYPE: 'None', CONF_REF: '', CONF_DATE: '', RELEASE_TEXT: 'rate revised per discussion' });
  kutchInv._releasedOn = '2024-01-08';
  const candidates = invoices.filter((i) => !i._p && !isMSME(i.LIFNR) && i.BUDAT <= '2024-03-10');
  const chosen = new Set();
  while (releases.length < COUNTS.mrbr_releases) {
    const inv = pick(candidates);
    if (chosen.has(inv.BELNR)) continue;
    chosen.add(inv.BELNR);
    const reason = rnd() < 0.6 ? 'Price' : rnd() < 0.85 ? 'Quantity' : 'Price + quantity';
    let rel = addDays(inv.BUDAT, int(3, 18));
    if (rel > FY_END) rel = FY_END;
    const conf = addDays(rel, -int(0, 3)) < inv.BUDAT ? inv.BUDAT : addDays(rel, -int(0, 3));
    const qty = reason === 'Quantity';
    const variance = Math.max(1000, round(inv.RMWWR * (0.004 + rnd() * 0.03), 50));
    releases.push({
      BELNR: inv.BELNR, XBLNR: inv.XBLNR, BLDAT: inv.BLDAT, LIFNR: inv.LIFNR, EBELN: inv.EBELN, BLOCK_REASON: reason, VARIANCE: variance,
      USNAM: inv.USNAM, REL_USER: 'JPATEL', REL_DATE: rel,
      CONF_TYPE: qty ? 'Corrected GRN' : 'Buyer email', CONF_REF: qty ? String(5000030000 + int(0, 19999)) : pick(['DRAVAL', 'SIYER']) + ' email',
      CONF_DATE: conf, RELEASE_TEXT: qty ? 'balance quantity received' : pick(['price agreed with buyer', 'debit note raised for difference', 'revised rate approved'])
    });
    inv._releasedOn = rel;
  }

  // ---- payments
  const changes = CHANGES.trim().split('\n').map((l) => { const [CHANGENR, UDATE, LIFNR, FIELD, USERNAME, CONF_USER, CONF_DATE] = l.split(','); return { CHANGENR, UDATE, LIFNR, FIELD, USERNAME, CONF_USER, CONF_DATE }; });
  const bankWindows = changes.filter((x) => /Bank/.test(x.FIELD));
  const inWindow = (lifnr, run) => bankWindows.some((c) => c.LIFNR === lifnr && run >= c.UDATE && run < c.CONF_DATE);
  const payments = [];
  const vendorRunDoc = new Map();
  let payDocSeq = 1500000001;
  const pay = (inv, run) => {
    const k = inv.LIFNR + '|' + run;
    if (!vendorRunDoc.has(k)) vendorRunDoc.set(k, String(payDocSeq++));
    payments.push({ VBLNR: vendorRunDoc.get(k), LAUFD: run, VALUT: run, LIFNR: inv.LIFNR, BELNR: inv.BELNR, RWBTR: inv.RMWWR });
  };
  for (const inv of invoices) {
    if (inv._unpaid) continue;
    if (inv._payOn) { pay(inv, inv._payOn); continue; }
    let run;
    if (isMSME(inv.LIFNR)) {
      const lo = addDays(inv.ACCEPT_DATE, 7), hi = addDays(inv.ACCEPT_DATE, 44);
      const options = runs.filter((r) => r >= lo && r <= hi && r >= inv.BUDAT && !inWindow(inv.LIFNR, r));
      if (!options.length) continue; // falls after year-end: unpaid but within 45 days
      run = pick(options);
    } else {
      let target = addDays(inv.ACCEPT_DATE, int(30, 90));
      if (inv._releasedOn && target <= inv._releasedOn) target = addDays(inv._releasedOn, 1);
      run = runOnOrAfter(target);
      if (!run) continue; // unpaid at year-end
    }
    pay(inv, run);
  }
  // C02 hygiene: no payment between a bank change and its confirmation; Gokul's planted payment stays first.
  for (const c of bankWindows) {
    for (const p of payments) {
      if (p.LIFNR !== c.LIFNR || p.VALUT < c.UDATE || p.VALUT >= c.CONF_DATE) continue;
      const next = runOnOrAfter(addDays(c.CONF_DATE, 0));
      p.LAUFD = p.VALUT = next;
    }
  }
  for (const p of payments) {
    if (p.LIFNR === '100388' && p.VALUT >= '2023-11-14' && p.VALUT <= '2023-11-23' && p.RWBTR !== 462180) p.LAUFD = p.VALUT = '2023-11-30';
  }
  // Data quality: three payment lines for non-MSME vendors lose their value date.
  const nonMsmePays = payments.filter((p) => !isMSME(p.LIFNR) && p.LIFNR !== '100388' && p.LIFNR !== '100163' && p.LIFNR !== '100318');
  for (let i = 0; i < 3; i++) nonMsmePays[Math.floor(nonMsmePays.length * (0.2 + i * 0.3))].VALUT = '';
  payments.sort((a, b) => (a.LAUFD < b.LAUFD ? -1 : a.LAUFD > b.LAUFD ? 1 : a.VBLNR < b.VBLNR ? -1 : 1));

  // ---- vendor change log
  const vendor_changes = changes.map((c) => {
    const bank = /Bank/.test(c.FIELD);
    const bad = c.CHANGENR === 'CD004642';
    return {
      CHANGENR: c.CHANGENR, UDATE: c.UDATE, LIFNR: c.LIFNR,
      FIELD: c.FIELD === 'Payment terms' ? 'ZTERM' : c.FIELD === 'Bank account' ? 'BANKN' : 'BANKL+BANKN',
      USERNAME: c.USERNAME, CONF_USER: c.CONF_USER, CONF_DATE: c.CONF_DATE,
      LETTER_ON_FILE: bank ? (bad ? 'N' : 'Y') : '', CALLBACK_LOGGED: bank ? (bad ? 'N' : 'Y') : '',
      REQUEST_SOURCE: bad ? 'Gmail address (not the registered email)' : bank ? 'Registered email + letter' : 'Purchase Head request'
    };
  });

  // ---- user access
  const users = [...ROSTER];
  STORE_IDS.forEach((id, i) => users.push([id, `${id[0]}. ${id.slice(1, 2)}${id.slice(2).toLowerCase()}`, i < 5 ? 'Stores · Sanand' : 'Stores · Becharaji', ['Z_MM_STORES']]));
  QUALITY_IDS.forEach((id) => users.push([id, `${id[0]}. ${id.slice(1, 2)}${id.slice(2).toLowerCase()}`, 'Quality', ['Z_MM_QUALITY']]));
  REQ_IDS.forEach((id, i) => users.push([id, `${id[0]}. ${id.slice(1, 2)}${id.slice(2).toLowerCase()}`, ['Production planning', 'Maintenance', 'Tool room', 'Admin'][i % 4], i % 5 === 0 ? ['Z_MM_REQUESTER', 'Z_MM_PR_APPROVER'] : ['Z_MM_REQUESTER']]));
  IT_IDS.forEach((id) => users.push([id, id === 'SECOPS1' ? 'Security operations' : 'SAP Basis', 'IT', ['Z_BASIS_ADMIN']]));
  const rows = [];
  for (const [id, name, dept, roles] of users) {
    for (const r of [...roles, 'Z_DISPLAY_P2P', 'Z_ESS']) rows.push({ BNAME: id, USER_NAME: name, DEPARTMENT: dept, AGR_NAME: r, TCODES: ROLES[r] });
  }
  const extra = ['Z_REPORTS_MM', 'Z_REPORTS_FI'];
  let guard = 0;
  while (rows.length < COUNTS.roleRows && guard++ < 1000) {
    const [id, name, dept] = pick(users);
    const r = pick(extra);
    if (rows.some((x) => x.BNAME === id && x.AGR_NAME === r)) continue;
    rows.push({ BNAME: id, USER_NAME: name, DEPARTMENT: dept, AGR_NAME: r, TCODES: ROLES[r] });
  }
  rows.sort((a, b) => (a.BNAME < b.BNAME ? -1 : a.BNAME > b.BNAME ? 1 : a.AGR_NAME < b.AGR_NAME ? -1 : 1));

  const strip = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith('_') && k !== 'cat'));
  return {
    vendors: vendors.map(strip),
    vendor_changes,
    purchase_orders: pos.map(strip),
    invoices: invoices.map(strip),
    mrbr_releases: releases,
    payments,
    user_access: rows
  };
}

// SAP-style formatting for files: dates DD.MM.YYYY, amounts with two decimals.
const sapDate = (iso) => (iso ? iso.slice(8, 10) + '.' + iso.slice(5, 7) + '.' + iso.slice(0, 4) : '');
const COLUMNS = {
  vendors: ['LIFNR', 'NAME1', 'PAN', 'GSTIN', 'MSME_CAT', 'UDYAM_NO', 'ERDAT'],
  vendor_changes: ['CHANGENR', 'UDATE', 'LIFNR', 'FIELD', 'USERNAME', 'CONF_USER', 'CONF_DATE', 'LETTER_ON_FILE', 'CALLBACK_LOGGED', 'REQUEST_SOURCE'],
  purchase_orders: ['EBELN', 'BSART', 'BEDAT', 'LIFNR', 'MATKL', 'NETWR', 'ERNAM', 'REL_CODES', 'RELEASED_BY', 'REL_DATE', 'FIRST_GR_DATE', 'CHANGED_AFTER_REL', 'RE_RELEASED'],
  // Invoices use business-style headers to show column mapping at work.
  invoices: [['BELNR', 'Doc No'], ['GJAHR', 'Fiscal Year'], ['LIFNR', 'Vendor'], ['XBLNR', 'Invoice No'], ['BLDAT', 'Inv Date'], ['BUDAT', 'Posting Date'], ['ACCEPT_DATE', 'Acceptance Date'], ['RMWWR', 'Gross Amt'], ['EBELN', 'PO Ref'], ['USNAM', 'Posted By']],
  mrbr_releases: ['BELNR', 'XBLNR', 'BLDAT', 'LIFNR', 'EBELN', 'BLOCK_REASON', 'VARIANCE', 'USNAM', 'REL_USER', 'REL_DATE', 'CONF_TYPE', 'CONF_REF', 'CONF_DATE', 'RELEASE_TEXT'],
  payments: ['VBLNR', 'LAUFD', 'VALUT', 'LIFNR', 'BELNR', 'RWBTR'],
  user_access: ['BNAME', 'USER_NAME', 'DEPARTMENT', 'AGR_NAME', 'TCODES']
};
const DATE_COLS = new Set(['ERDAT', 'UDATE', 'CONF_DATE', 'BEDAT', 'REL_DATE', 'FIRST_GR_DATE', 'BLDAT', 'BUDAT', 'ACCEPT_DATE', 'LAUFD', 'VALUT']);
const AMT_COLS = new Set(['NETWR', 'RMWWR', 'VARIANCE', 'RWBTR']);

/** Demo files as CSV text, exactly as a user would upload them. */
export function demoFiles(seed = DEMO_SEED) {
  const data = generateDemo(seed);
  const out = {};
  for (const [id, cols] of Object.entries(COLUMNS)) {
    const spec = cols.map((c) => (Array.isArray(c) ? c : [c, c]));
    const rows = data[id].map((r) => Object.fromEntries(spec.map(([f, h]) => [h, DATE_COLS.has(f) ? sapDate(r[f]) : AMT_COLS.has(f) ? (r[f] === '' || r[f] === null ? '' : Number(r[f]).toFixed(2)) : r[f]])));
    out[id] = toCSV(rows, spec.map(([, h]) => h));
  }
  return out;
}

/** Header-only templates for users preparing their own extracts. */
export function templateFiles() {
  const out = {};
  for (const [id, cols] of Object.entries(COLUMNS)) out[id] = cols.map((c) => (Array.isArray(c) ? c[0] : c)).join(',') + '\n';
  return out;
}

export const DEMO_FILE_NAMES = {
  vendors: 'vendors.csv', vendor_changes: 'vendor_changes.csv', purchase_orders: 'purchase_orders.csv', invoices: 'invoices.csv',
  mrbr_releases: 'mrbr_releases.csv', payments: 'payments.csv', user_access: 'user_access.csv'
};
