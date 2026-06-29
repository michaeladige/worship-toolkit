import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const file = process.argv[2];
const data = await import('fs').then(fs => fs.promises.readFile(file));
const pdf = await getDocument({ data: new Uint8Array(data), disableWorker: true }).promise;

const page = await pdf.getPage(1);
const vp = page.getViewport({ scale: 1 });
const content = await page.getTextContent();

const items = content.items
  .filter(i => 'str' in i && i.str.trim())
  .map(i => ({ text: i.str, x: +i.transform[4].toFixed(1), y: +(vp.height - i.transform[5]).toFixed(1), w: +(i.width||0).toFixed(1) }))
  .sort((a,b) => a.y - b.y || a.x - b.x);

console.log(`Total items on page 1: ${items.length}`);
// Print ALL items
for (const it of items) {
  console.log(`  y=${it.y.toString().padStart(6)}  x=${it.x.toString().padStart(6)}  w=${it.w.toString().padStart(5)}  "${it.text}"`);
}
