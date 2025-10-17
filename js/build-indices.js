import fs from 'fs';
import path from 'path';
import {
  readFileText, extractMetaByIds, extractTitle,
  parseDateTimeFromName, parseWhatsAppAudio
} from './utils.js';

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
    const relPath = `data/${cat}/${e.name}`;

    // qué tipos acepta cada categoría
    if (cat === 'pensamientos') {
      if (![ '.html', '.htm', ...AUDIO_EXT ].includes(ext)) continue;
    } else {
      if (![ '.html', '.htm' ].includes(ext)) continue;
    }

    let item = { file: e.name, path: relPath, title: '', date: '', time: '' };

    if (ext === '.html' || ext === '.htm') {
      const fp = path.join(dir, e.name);
      const html = await readFileText(fp);

      // comunes
      item.title = extractTitle(html);

      // fecha/hora (filename)
      const dt = parseDateTimeFromName(e.name);
      item.date = dt.date; item.time = dt.time;

      // especiales “libros”: intenta sacar libro/capitulo/titulo/fecha del cuerpo
      if (cat === 'libros') {
        const meta = extractMetaByIds(html);
        // mejor título compuesto "[libro] [numero]: [titulo]"
        const numero = (meta.capitulo || '').toString().trim();
        const cabecera = [
          meta.libro || '',
          numero ? `${numero}:` : ''
        ].filter(Boolean).join(' ');
        const compuesto = [cabecera, meta.titulo || ''].filter(Boolean).join(' ');
        if (compuesto) item.title = compuesto;

        if (meta.fecha) {
          // si el archivo guarda fecha en el body, úsala como date (YYYY-MM-DD recomendado)
          item.date = meta.fecha;
        }
        // metadatos útiles para capitulo.html
        item.libro = meta.libro || '';
        item.numero = numero;
        item.tituloCap = meta.titulo || '';
      }
    } else if (AUDIO_EXT.includes(ext)) {
      // pensamientos → audio
      const wa = parseWhatsAppAudio(e.name);
      item.title = 'audio';
      item.date = wa.date;
      item.time = wa.time;
      item.kind = 'audio';
    }

    out.push(item);
  }

  // nuevo → antiguo (asumiendo prefijo fecha en nombre)
  out.sort((a, b) => (a.path < b.path ? 1 : -1));
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