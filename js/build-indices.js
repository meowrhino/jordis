import fs from 'fs';
import path from 'path';
import {
  parseDateTimeFromName, parseWhatsAppAudio
} from './utils.js';

const ROOT = process.cwd();
const DATA = path.join(ROOT, 'data');
const CATS = ['diario', 'extras', 'libros', 'pensamientos'];
const AUDIO_EXT = ['.mp3', '.m4a', '.ogg', '.wav', '.opus'];

// Flexible date/time extraction from filename:
// Supports:
//  - YYYY-MM-DD__HH-mm-ss*
//  - YYYY-MM-DD_HH-mm*
//  - YYYY-MM-DD-HH-mm(-ss)? at end of name (e.g., funcionaria_1_2025-10-16-19-24.html)
//  - fallback: date-only YYYY-MM-DD anywhere
function parseDateTimeFlexible(name) {
  // 1) Prefix with optional double underscore and optional seconds
  let m = name.match(/^(\d{4}-\d{2}-\d{2})__?(\d{2})-(\d{2})(?:-(\d{2}))?/);
  if (m) {
    const [, d, hh, mm, ss] = m;
    return { date: d, time: `${hh}:${mm}:${ss||'00'}` };
  }
  // 2) Suffix at end (…_YYYY-MM-DD-HH-mm(-ss)?)
  m = name.match(/(\d{4}-\d{2}-\d{2})[-_](\d{2})-(\d{2})(?:-(\d{2}))?(?:\.\w+)?$/);
  if (m) {
    const [, d, hh, mm, ss] = m;
    return { date: d, time: `${hh}:${mm}:${ss||'00'}` };
  }
  // 3) Date-only anywhere
  m = name.match(/(\d{4}-\d{2}-\d{2})/);
  if (m) return { date: m[1], time: '' };
  return { date: '', time: '' };
}

async function buildForCategory(cat) {
  const dir = path.join(DATA, cat);
  const out = [];
  if (!fs.existsSync(dir)) return out;

  const entries = await fs.promises.readdir(dir, { withFileTypes: true });

  for (const e of entries) {
    if (!e.isFile()) continue;
    const ext = path.extname(e.name).toLowerCase();
    const relPath = `data/${cat}/${e.name}`;

    // qué tipos acepta cada categoría
    if (cat === 'pensamientos') {
      if (![ '.html', '.htm', ...AUDIO_EXT ].includes(ext)) continue;
    } else {
      if (![ '.html', '.htm' ].includes(ext)) continue;
    }

    let item = { path: relPath, date: '', time: '' };

    if (ext === '.html' || ext === '.htm') {
      // fecha/hora desde filename (soporta múltiples patrones)
      let dt = parseDateTimeFromName(e.name);
      if (!dt.date) dt = parseDateTimeFlexible(e.name);
      item.date = dt.date;
      item.time = dt.time;

      if (cat === 'extras') {
        const base = e.name.replace(/\.[^.]+$/, '');
        const parts = base.split('_'); // ej: extra_astros_2025-10-16
        const tema = parts[1] || '';
        const fechaParte = (parts[2] || '').replace(/\.html?$/i, '');
        // Prioridad: 3er cacho como fecha; si falta, usa la detectada
        item.date = fechaParte || item.date || '';
        // extras NO llevan hora: eliminar la propiedad
        delete item.time;
        item.tema = tema;
      }

      if (cat === 'diario') {
        const base = e.name.replace(/\.[^.]+$/, '');
        const parts = base.split('_'); // ej: 2025-10-16_09-36_barcelona
        item.place = parts[parts.length - 1] || '';
      }

      if (cat === 'libros') {
        const base = e.name.replace(/\.[^.]+$/, '');
        const parts = base.split('_'); // ej: funcionaria_2_2025-11-04-21-16
        item.libro = parts[0] || '';
        item.capitulo = parts[1] || '';
      }
    } else if (AUDIO_EXT.includes(ext)) {
      // pensamientos → audio
      const wa = parseWhatsAppAudio(e.name);
      item.date = wa.date;
      item.time = wa.time;
    }

    out.push(item);
  }

  // nuevo → antiguo (prefiere date/time extraído, si está; si no, filename/path)
  out.sort((a, b) => {
    const aKey = a.date ? `${a.date}__${(a.time||'00:00:00').replace(/:/g,'-')}` : a.path || '';
    const bKey = b.date ? `${b.date}__${(b.time||'00:00:00').replace(/:/g,'-')}` : b.path || '';
    return aKey < bKey ? 1 : -1; // nuevo → antiguo
  });
  return out;
}

async function main() {
  for (const cat of CATS) {
    const arr = await buildForCategory(cat);
    const outPath = path.join(DATA, `${cat}.json`);
    await fs.promises.writeFile(outPath, JSON.stringify(arr, null, 2), 'utf8');
    console.log(`✓ ${cat}.json (${arr.length})`);
  }
}
main().catch(err => { console.error(err); process.exit(1); });