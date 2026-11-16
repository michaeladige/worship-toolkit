// Generates e2e/fixtures/modulation.pdf — a synthetic two-page chart laid out
// the way SongSelect sets one, exercising what the parser has to get right for
// a mid-song key change:
//   • page 2 opens with SongSelect's running header ("<title> - 2") and a
//     right-aligned "Key - A" above the first section in the new key;
//   • chord extensions are separate, raised superscript runs, including the
//     compound forms SongSelect uses ("2sus", "7(4)", "2(no3)");
//   • a superscript in the middle of a slash chord splits the bass off into
//     its own item (G²/B → "G" + "2" + "/B");
//   • "~" in the heading column marks an unnamed section break.
// Lyrics are Psalm 96:1 (public domain). Run: node e2e/fixtures/make-modulation-pdf.mjs
import { jsPDF } from 'jspdf';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const doc = new jsPDF({ unit: 'pt', format: 'a4' });
const LEFT = 64;

// A chord whose extension is a raised superscript run, as SongSelect sets it.
// `parts` = [root, superscript?, bass?] e.g. ['G', '2', '/B'].
function chord(x, y, [root, sup, bass]) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(root, x, y);
  let end = x + doc.getTextWidth(root);
  if (sup) {
    doc.setFontSize(7);
    doc.text(sup, end, y - 4.5);
    end += doc.getTextWidth(sup);
    doc.setFontSize(10);
  }
  if (bass) doc.text(bass, end, y);
}

function lyric(y, text) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(text, LEFT, y);
}

function heading(y, text) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(text, 40, y);
}

// ── Page 1 — key of G ─────────────────────────────────────────────────────────
doc.setFont('helvetica', 'bold');
doc.setFontSize(16);
doc.text('Modulation Test', 40, 50);
doc.setFont('helvetica', 'normal');
doc.setFontSize(7);
doc.text('Public Domain', 40, 62);
doc.setFont('helvetica', 'bold');
doc.text('Key - G | Tempo - 72 | Time - 4/4', 40, 74);

heading(110, 'VERSE 1');
chord(LEFT, 130, ['G']);
chord(150, 130, ['D/F#']);
chord(240, 130, ['Em', '7']);
lyric(142, 'Sing to the Lord a new song');
chord(LEFT, 166, ['C', '2sus']);
chord(150, 166, ['Am', '7(4)']);
chord(240, 166, ['G', '2', '/B']);
lyric(178, 'Sing to the Lord all the earth');

heading(214, 'CHORUS 1');
chord(LEFT, 234, ['C', '2(no3)']);
chord(170, 234, ['D']);
lyric(246, 'Sing to the Lord, bless His name');

// ── Page 2 — modulates up a whole step to A ──────────────────────────────────
doc.addPage();
doc.setFont('helvetica', 'normal');
doc.setFontSize(9);
doc.text('Modulation Test - 2', 555, 26, { align: 'right' });
doc.setFont('helvetica', 'bold');
doc.setFontSize(11);
doc.text('Key - A', 555, 40, { align: 'right' });

heading(60, 'CHORUS 2');
chord(LEFT, 80, ['D', '2(no3)']);
chord(170, 80, ['E']);
lyric(92, 'Sing to the Lord, bless His name');
chord(LEFT, 116, ['A']);
chord(150, 116, ['E/G#']);
chord(240, 116, ['F#m', '7']);
lyric(128, 'Proclaim His salvation day by day');

heading(164, '~');
chord(LEFT, 184, ['A', '2', '/C#']);
chord(170, 184, ['E']);
lyric(196, 'Sing to the Lord a new song');

doc.setFont('helvetica', 'bold');
doc.setFontSize(7);
doc.text('CCLI Song # 0000000', 297, 240, { align: 'center' });

const out = fileURLToPath(new URL('./modulation.pdf', import.meta.url));
writeFileSync(out, Buffer.from(doc.output('arraybuffer')));
console.log('wrote', out);
