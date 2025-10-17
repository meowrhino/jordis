import fs from 'fs';

export async function readFileText(fp) {
  try { return await fs.promises.readFile(fp, 'utf8'); }
  catch { return ''; }
}

export function extractTitle(html) {
  const m = html.match(/<title>(.*?)<\/title>/i);
  return m ? m[1].trim() : '';
}

// YYYY-MM-DD__HH-mm-ss(.algo).ext
export function parseDateTimeFromName(name) {
  const m = name.match(/^(\d{4}-\d{2}-\d{2})__(\d{2})-(\d{2})-(\d{2})/);
  if (!m) return { date: '', time: '' };
  const [, d, hh, mm, ss] = m;
  return { date: d, time: `${hh}:${mm}:${ss}` };
}

// "WhatsApp Audio 2025-10-14 at 11.13.45.ext"
export function parseWhatsAppAudio(name) {
  const m = name.match(/^WhatsApp Audio (\d{4}-\d{2}-\d{2}) at (\d{2})\.(\d{2})\.(\d{2})/);
  if (!m) return { date: '', time: '' };
  const [, d, hh, mm, ss] = m;
  return { date: d, time: `${hh}:${mm}:${ss}` };
}