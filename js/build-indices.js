import fs from 'fs';
import path from 'path';
import { readFileText, extractTitle, parseDateTimeFromName, parseWhatsAppAudio } from './utils.js';

const ROOT = process.cwd();
const DATA = path.join(ROOT, 'data');

const CATS = ['diarios', 'extras', 'libros', 'pensamientos'];
const AUDIO_EXT = ['.mp3', '.m4a', '.ogg', '.wav'];

async function buildForCategory(cat) {
  const dir = path.join(DATA, cat);
  const out = [];
  if (!fs.existsSync(dir)) return out;

  const entries = await fs.promises.readdir(dir, { withFileTypes: true });

  for (const e of entries) {
    if (!e.isFile()) continue;
    const ext = path.extname(e.name).toLowerCase();

    // Pensamientos admite audios; el resto solo HTML
    if (cat !== 'pensamientos' && !['.html', '.htm'].includes(ext)) continue;
    if (cat === 'pensamientos' && !['.html', '.htm', ...AUDIO_EXT].includes(ext)) continue;

    const relPath = `data/${cat}/${e.name}`;
    const fp = path.join(dir, e.name);

    let title = '';
    let date = '';
    let time = '';

    if (['.html', '.htm'].includes(ext)) {
      const txt = await readFileText(fp);
      title = extractTitle(txt);

      const dt = parseDateTimeFromName(e.name);
      date = dt.date; time = dt.time;
    } else if (AUDIO_EXT.includes(ext)) {
      const wa = parseWhatsAppAudio(e.name);
      date = wa.date; time = wa.time;
      title = 'audio';
    }

    out.push({
      title,
      file: e.name,      // nombre simple
      path: relPath,     // ruta relativa servible
      date,
      time
    });
  }

  // Más nuevo primero: ordenar por path desc suele bastar (si embedimos fecha en nombre)
  out.sort((a, b) => (a.path < b.path ? 1 : -1));
  return out;
}

async function main() {
  for (const cat of CATS) {
    const arr = await buildForCategory(cat);
    const outPath = path.join(DATA, `${cat}.json`);
    await fs.promises.writeFile(outPath, JSON.stringify(arr, null, 2), 'utf8');
    console.log(`✓ ${cat}.json (${arr.length} items)`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });