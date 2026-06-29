// Verify column detection and section parsing against real PDFs
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const SECTION_RE = /^(VERSE\s*\d*|CHORUS\s*\d*|PRE[-\s]?CHORUS\s*\d*|BRIDGE\s*\d*|INTRO|OUTRO|TAG|ENDING|INTERLUDE\s*[\w\d]*|INSTRUMENTAL|CODA|VAMP)\s*$/i;
const SUPERSCRIPT_RE = /^(\d+|sus\d*|maj\d*|add\d*|dim|aug|m|\(\d+\))$/i;
const CHORD_RE = /^([A-G][b#]?)(maj|min|dim|aug|m|M)?(\d+)?(\([0-9]+\))?(sus\d*|add\d*)?(\/[A-G][b#]?)?$/;

function isChord(t) { return CHORD_RE.test(t.trim()); }
function isChordLine(line) {
  const tokens = line.trim().split(/\s+/).filter(t => t);
  if (!tokens.length) return false;
  const skip = new Set(['|','||','||:',':|:',':|',':||']);
  const ann = /^\(.*\)$|^\*|^[0-9]+\.$|^-+$/;
  let chords = 0, other = 0;
  for (const t of tokens) {
    if (skip.has(t) || ann.test(t)) continue;
    if (isChord(t)) chords++; else other++;
  }
  return chords > 0 && other === 0;
}

function mergeSuperscripts(items) {
  const dead = new Set();
  for (const sup of items) {
    if (!SUPERSCRIPT_RE.test(sup.text.trim())) continue;
    let best = null, bestDx = Infinity;
    for (const root of items) {
      if (root === sup || dead.has(root)) continue;
      const dy = root.y - sup.y;
      if (dy < 1 || dy > 9) continue;
      const dx = Math.abs(sup.x - (root.x + root.w));
      if (dx > 6) continue;
      if (dx < bestDx) { bestDx = dx; best = root; }
    }
    if (best) { best.text += sup.text; best.w += sup.w; dead.add(sup); }
  }
  return items.filter(i => !dead.has(i));
}

function groupItems(items, colMinX, colWidth) {
  if (!items.length) return [];
  const sorted = [...items].sort((a,b) => a.y !== b.y ? a.y - b.y : a.x - b.x);
  const lines = [];
  let group = [sorted[0]], gy = sorted[0].y;
  for (let i = 1; i < sorted.length; i++) {
    if (Math.abs(sorted[i].y - gy) <= 4) group.push(sorted[i]);
    else { lines.push(makeRawLine(group)); group = [sorted[i]]; gy = sorted[i].y; }
  }
  lines.push(makeRawLine(group));
  return lines;
}

function makeRawLine(items) {
  const sorted = [...items].sort((a,b) => a.x - b.x);
  let text = '';
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i].x - (sorted[i-1].x + sorted[i-1].w) > 1) text += ' ';
    text += sorted[i].text;
  }
  return text.trim();
}

async function testPdf(path, label) {
  const data = await import('fs').then(fs => fs.promises.readFile(path));
  const pdf = await getDocument({ data: new Uint8Array(data), disableWorker: true }).promise;

  console.log(`\n=== ${label} (${pdf.numPages} pages) ===`);

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    let items = tc.items
      .filter(i => 'str' in i && i.str.trim())
      .map(i => ({ text: i.str, x: +i.transform[4].toFixed(1), y: +(vp.height - i.transform[5]).toFixed(1), w: +(i.width||0).toFixed(1) }));

    items = mergeSuperscripts(items);

    // Detect columns
    const headerXs = items.filter(i => SECTION_RE.test(i.text.trim())).map(i => i.x);
    const minHX = headerXs.length ? Math.min(...headerXs) : 0;
    const maxHX = headerXs.length ? Math.max(...headerXs) : 0;
    const isTwoCols = headerXs.length >= 2 && (maxHX - minHX) > 50;
    const splitX = isTwoCols ? (minHX + maxHX) / 2 : null;

    console.log(`\nPage ${p}: ${isTwoCols ? `TWO-COLUMN (split at x=${splitX?.toFixed(0)})` : 'SINGLE-COLUMN'}`);

    let allLines;
    if (splitX) {
      const leftLines = groupItems(items.filter(i => i.x < splitX), 0, 0);
      const rightLines = groupItems(items.filter(i => i.x >= splitX), 0, 0);
      allLines = [...leftLines, ...rightLines];
    } else {
      allLines = groupItems(items, 0, 0);
    }

    // Show sections and first line of each
    let inContent = false;
    let prevWasSection = false;
    for (const line of allLines) {
      if (/Key\s*[-–].*Tempo/i.test(line)) { inContent = true; continue; }
      if (!inContent) continue;
      if (/CCLI Song|For use solely|©/i.test(line)) continue;
      if (SECTION_RE.test(line)) {
        console.log(`  [SECTION] ${line}`);
        prevWasSection = true;
      } else if (prevWasSection) {
        const type = isChordLine(line) ? 'CHORDS' : 'LYRIC ';
        console.log(`    → ${type}: ${line.slice(0, 60)}`);
        prevWasSection = false;
      }
    }
  }
}

await testPdf('../fpc0607.pdf', 'fpc0607.pdf');
await testPdf('../fpc0628.pdf', 'fpc0628.pdf');
