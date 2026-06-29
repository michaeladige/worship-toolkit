import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const file = process.argv[2];
if (!file) { console.error('Usage: node debug-pdf.mjs <path.pdf>'); process.exit(1); }

const data = await import('fs').then(fs => fs.promises.readFile(file));
const pdf = await getDocument({ data: new Uint8Array(data), disableWorker: true }).promise;

console.log(`Pages: ${pdf.numPages}`);

for (let p = 1; p <= Math.min(pdf.numPages, 3); p++) {
  const page = await pdf.getPage(p);
  const vp = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  console.log(`\n=== PAGE ${p} (h=${vp.height.toFixed(1)}) ===`);
  const items = content.items
    .filter(i => 'str' in i && i.str.trim())
    .map(i => ({ text: i.str, x: +i.transform[4].toFixed(1), y: +(vp.height - i.transform[5]).toFixed(1), w: +(i.width||0).toFixed(1) }))
    .sort((a,b) => a.y - b.y || a.x - b.x);
  for (const it of items.slice(0, 80)) {
    console.log(`  y=${it.y.toString().padStart(6)}  x=${it.x.toString().padStart(6)}  w=${it.w.toString().padStart(5)}  "${it.text}"`);
  }
  if (items.length > 80) console.log(`  ... (${items.length - 80} more items)`);
}
