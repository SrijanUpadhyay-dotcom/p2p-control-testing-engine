// Small shared helpers: CSV, dates, amounts, hashing, formatting.

// ---------- CSV (RFC 4180) ----------
export function parseCSV(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let row = [], field = '', inQ = false, i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQ = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQ = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += c; i++;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ''));
}

export function toCSV(rows, columns) {
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const head = columns.map(esc).join(',');
  const body = rows.map((r) => columns.map((c) => esc(r[c])).join(',')).join('\n');
  return head + '\n' + body + (rows.length ? '\n' : '');
}

// ---------- Dates (stored as ISO yyyy-mm-dd strings) ----------
const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n) => String(n).padStart(2, '0');
const valid = (y, m, d) => {
  if (!(y > 1900 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCMonth() === m - 1 ? `${y}-${pad(m)}-${pad(d)}` : null;
};

// Accepts 2024-01-03, 03-01-2024, 03/01/2024, 03.01.2024 (day first, as in India),
// 03-Jan-2024, 3 Jan 2024, 20240103 and Excel serial numbers.
export function parseDate(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return excelSerial(v);
  const s = String(v).trim();
  if (!s) return null;
  let m;
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) return valid(+m[1], +m[2], +m[3]);
  if ((m = s.match(/^(\d{1,2})[-/. ]([A-Za-z]{3})[A-Za-z]*[-/. ,]+(\d{2,4})$/))) {
    const y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
    return valid(y, MON[m[2].toLowerCase()], +m[1]);
  }
  if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/))) {
    const y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
    return valid(y, +m[2], +m[1]);
  }
  if ((m = s.match(/^(\d{4})(\d{2})(\d{2})$/))) return valid(+m[1], +m[2], +m[3]);
  if (/^\d{5}(\.\d+)?$/.test(s)) return excelSerial(+s);
  return null;
}

function excelSerial(n) {
  if (!(n > 20000 && n < 80000)) return null;
  const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 86400000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export const dayNum = (iso) => Math.round(Date.parse(iso + 'T00:00:00Z') / 86400000);
export const fromDayNum = (n) => new Date(n * 86400000).toISOString().slice(0, 10);
export const daysBetween = (a, b) => dayNum(b) - dayNum(a);
export const addDays = (iso, n) => fromDayNum(dayNum(iso) + n);

export function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}-${Object.keys(MON)[+m - 1].replace(/^./, (c) => c.toUpperCase())}-${y}`;
}

// ---------- Amounts ----------
export function parseAmount(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  let s = String(v).trim().replace(/[₹\s]|INR|Rs\.?/gi, '');
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (s.endsWith('-')) { neg = true; s = s.slice(0, -1); }
  s = s.replace(/,/g, '');
  if (!/^-?\d*\.?\d+$/.test(s)) return null;
  const n = parseFloat(s);
  return neg ? -n : n;
}

// Indian digit grouping: 15,38,400.00
export function inr(n, decimals = 0) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  const neg = n < 0;
  const [int, dec] = Math.abs(n).toFixed(decimals).split('.');
  const last3 = int.slice(-3);
  const rest = int.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  const out = (rest ? rest + ',' : '') + last3 + (dec ? '.' + dec : '');
  return (neg ? '-' : '') + out;
}

export function lakh(n) {
  if (!n) return '₹0';
  if (n >= 1e7) return '₹' + (n / 1e7).toFixed(2) + ' Cr';
  if (n >= 1e5) return '₹' + (n / 1e5).toFixed(2) + ' L';
  return '₹' + inr(n);
}

export const flag = (v) => {
  const s = String(v ?? '').trim().toUpperCase();
  if (['Y', 'YES', 'TRUE', '1', 'X'].includes(s)) return true;
  if (['N', 'NO', 'FALSE', '0'].includes(s)) return false;
  return null;
};

export const normKey = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

export const splitList = (s) => String(s ?? '').split(/[;,|]/).map((x) => x.trim()).filter(Boolean);

// ---------- Hashing ----------
export async function sha256Hex(data) {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const buf = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
