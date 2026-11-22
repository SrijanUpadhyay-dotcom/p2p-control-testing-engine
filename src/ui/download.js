// File delivery. Files are built in memory and never leave the device except to the viewer's own disk.
// Inside a claude.ai Artifact the host's `downloads` capability is used (the viewer confirms each file);
// on a normal web page a standard browser download is used.

let cap;
async function hostDownloads() {
  if (cap !== undefined) return cap;
  try { cap = globalThis.claude?.use ? await globalThis.claude.use('downloads') : null; } catch { cap = null; }
  return cap;
}

export async function inHostedView() { return !!(await hostDownloads()); }

/** Save one file. Resolves 'saved', 'declined' or an error code. */
export async function download({ name, mime, bytes, text }) {
  const host = await hostDownloads();
  if (host) {
    try { await host.save({ filename: name, data: bytes ?? text }); return 'saved'; }
    catch (e) { return e?.code || 'unavailable'; }
  }
  const blob = new Blob([bytes ?? text], { type: mime || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
  return 'saved';
}

/** Print an HTML report (choose "Save as PDF"). In a hosted view, saves the print-ready HTML instead. */
export async function printHTML(file) {
  if (await hostDownloads()) return download(file);
  try {
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(frame);
    const doc = frame.contentWindow.document;
    doc.open(); doc.write(file.text); doc.close();
    await new Promise((r) => setTimeout(r, 300));
    try { frame.contentWindow.focus(); frame.contentWindow.print(); } catch { await download(file); }
    setTimeout(() => frame.remove(), 4000);
    return 'saved';
  } catch {
    return download(file);
  }
}
