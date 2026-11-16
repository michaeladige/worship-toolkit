import { Injectable } from '@angular/core';
import type { jsPDF as JsPdf, GState as JsPdfGState } from 'jspdf';
import { ParsedSong, SongLine, SongSection, InkStroke } from '../models/song.model';
import { Accidentals, ChordService } from './chord.service';
import { ChordFont, ChordInstrument } from './ui-settings.service';
import { chordShape, ChordShapeDiagram } from '../data/chord-shapes';

export interface SetPdfOptions {
  coverPage?: boolean; // prepend a summary + page-numbered table of contents
  setName?: string;
  includeInk?: boolean; // draw each line's pen/highlighter strokes (SongLine.ink)
}

// Where a line's ink anchor (its lyric row, or chord row for a chords-only
// line) landed on the PDF page, for mapping InkStroke (ch, em) coordinates.
interface PdfInkAnchor {
  x: number; // left edge of the text column
  baseline: number; // baseline of the anchor row's (first) text line
  chordBaseline: number | null; // baseline of the chord row above a lyric anchor
  annotationRows: number; // annotation rows between chord and lyric rows
}

// On-screen geometry of the chart rows ink coordinates are measured against
// (song-section.component.scss): the lyric row's text baseline sits ~1.085em
// below its content top (line-height 1.45), a chord row's ~1.15em below its
// top, a chord row's baseline is ~1.7em above the lyric baseline beneath it,
// and an annotation row adds ~1.45em. The PDF packs rows tighter than the
// screen, so the stretch of a stroke above a lyric (marking up the chords)
// is compressed to land on the same PDF rows rather than drifting upward.
const INK_LYRIC_BASELINE_EM = 1.085;
const INK_CHORD_BASELINE_EM = 1.15;
const INK_CHORD_TO_LYRIC_EM = 1.7;
const INK_ANNOTATION_ROW_EM = 1.45;

@Injectable({ providedIn: 'root' })
export class ExportService {

  // Fetched once per session and reused across every PDF export, rather than
  // re-fetching ~800KB of font files (and re-doing the base64 conversion)
  // every time the user exports another PDF in the "readable" font.
  private jetbrainsMonoPromise: Promise<{ regular: string; bold: string; italic: string }> | null = null;

  constructor(private chordSvc: ChordService) {}

  private async fetchFontBase64(relPath: string): Promise<string> {
    const url = new URL(relPath, document.baseURI).href;
    const buf = await (await fetch(url)).arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }

  private getJetbrainsMonoFonts(): Promise<{ regular: string; bold: string; italic: string }> {
    if (!this.jetbrainsMonoPromise) {
      this.jetbrainsMonoPromise = Promise.all([
        this.fetchFontBase64('fonts/JetBrainsMono-Regular.ttf'),
        this.fetchFontBase64('fonts/JetBrainsMono-Bold.ttf'),
        this.fetchFontBase64('fonts/JetBrainsMono-Italic.ttf'),
      ])
        .then(([regular, bold, italic]) => ({ regular, bold, italic }))
        .catch(err => {
          // Don't cache a rejected promise — a transient network failure would
          // otherwise permanently break "readable font" export until reload.
          this.jetbrainsMonoPromise = null;
          throw err;
        });
    }
    return this.jetbrainsMonoPromise;
  }

  // Defensive cleanup for stray control characters (most commonly U+0000, from
  // SongSelect PDFs whose embedded font maps a broken ligature glyph to NUL —
  // see PdfParserService.stripControlChars). New imports are sanitized at parse
  // time, but this also protects sets saved before that fix, or loaded from an
  // older .wt export, from the same corrupted bytes silently truncating text —
  // jsPDF's embedded-font path treats a raw NUL as a string terminator.
  private stripControlChars(text: string): string {
    return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  }

  private sanitizeSong(song: ParsedSong): ParsedSong {
    const strip = (s: string) => this.stripControlChars(s);
    return {
      ...song,
      title: strip(song.title),
      authors: song.authors.map(strip),
      tempo: strip(song.tempo),
      timeSignature: strip(song.timeSignature),
      ccliNumber: song.ccliNumber ? strip(song.ccliNumber) : song.ccliNumber,
      sections: song.sections.map(section => ({
        ...section,
        name: strip(section.name),
        lines: section.lines.map(line => ({
          ...line,
          lyric: strip(line.lyric),
          annotation: line.annotation ? strip(line.annotation) : line.annotation,
          chords: line.chords.map(ct => ({ ...ct, chord: strip(ct.chord) })),
        })),
      })),
    };
  }

  toMarkdown(songs: ParsedSong[], accidentals: Accidentals = 'auto'): string {
    return songs.map(song => this.songToMarkdown(song, accidentals)).join('\n\n---\n\n');
  }

  private songToMarkdown(song: ParsedSong, accidentals: Accidentals = 'auto'): string {
    song = this.sanitizeSong(song);
    const effectiveKey = this.chordSvc.effectiveKey(song, accidentals);
    const lines: string[] = [];

    lines.push(`# ${song.title}`);
    if (song.authors.length) lines.push(song.authors.join(' | '));
    let keyLine = `**Key - ${effectiveKey} | Tempo - ${song.tempo} | Time - ${song.timeSignature}**`;
    if (song.capo) {
      keyLine += ` | Capo ${song.capo} (play in ${this.chordSvc.shapeKey(song, accidentals)})`;
    }
    lines.push(keyLine);
    lines.push('');

    song.sections.forEach((section, si) => {
      const keyChange = this.keyChangeText(song, si, accidentals);
      lines.push(keyChange ? `**${section.name}** — *${keyChange}*` : `**${section.name}**`);
      lines.push('');
      for (const line of section.lines) {
        const chordLine = this.renderChordRow(line, song, accidentals, section);
        if (chordLine.trim()) lines.push(chordLine);
        if (line.annotation) {
          const ann = this.chordSvc.displayAnnotation(line.annotation, song, accidentals, section);
          lines.push(`*${ann}*`);
        }
        if (line.lyric.trim()) lines.push(line.lyric);
        if (!chordLine.trim() && !line.annotation && !line.lyric.trim()) lines.push('');
      }
      lines.push('');
    });

    if (song.ccliNumber) {
      lines.push(`*CCLI Song # ${song.ccliNumber}*`);
    }

    return lines.join('\n');
  }

  // "Key - Ab" (plus the capo shape, when one applies) for a section that
  // modulates away from the section before it, else null. Same "Key - X"
  // wording SongSelect prints, which PdfParserService reads back on re-import.
  private keyChangeText(song: ParsedSong, si: number, accidentals: Accidentals): string | null {
    const sounding = this.chordSvc.keyChangeAt(song, si, accidentals);
    if (!sounding) return null;
    let text = `Key - ${sounding}`;
    if (song.capo && !song.showNashville) {
      text += ` (play in ${this.chordSvc.shapeKey(song, accidentals, song.sections[si])})`;
    }
    return text;
  }

  private renderChordRow(
    line: SongLine,
    song: ParsedSong,
    accidentals: Accidentals = 'auto',
    section?: SongSection,
  ): string {
    if (line.chords.length === 0) return '';

    // Build a character array
    const maxLen = Math.max(line.lyric.length + 20, 80);
    const chars: string[] = new Array(maxLen).fill(' ');

    const sortedChords = [...line.chords].sort((a, b) => (a.charPos ?? 0) - (b.charPos ?? 0));

    let cursor = 0;
    for (const ct of sortedChords) {
      const chord = this.getDisplayChord(ct.chord, song, accidentals, section);
      const pos = Math.max(cursor, ct.charPos ?? 0);
      for (let j = 0; j < chord.length; j++) {
        if (pos + j < chars.length) chars[pos + j] = chord[j];
      }
      cursor = pos + chord.length + 1;
    }

    return chars.join('').trimEnd();
  }

  getDisplayChord(
    chord: string,
    song: ParsedSong,
    accidentals: Accidentals = 'auto',
    section?: SongSection,
  ): string {
    return this.chordSvc.displayChord(chord, song, accidentals, section);
  }

  async toPdf(
    songs: ParsedSong[],
    pdfFontSize = 14,
    accidentals: Accidentals = 'auto',
    fontChoice: ChordFont = 'classic',
    instrument: ChordInstrument = 'guitar',
    setOptions: SetPdfOptions | null = null,
  ): Promise<void> {
    const doc = await this.buildDoc(songs, pdfFontSize, accidentals, fontChoice, instrument, setOptions);
    doc.save('worship-set.pdf');
  }

  /**
   * Export every song as its own PDF, bundled into a single .zip download. Each
   * song is rendered into a fresh document (via buildDoc) exactly like the
   * combined export, so per-song files look identical to one page of the set
   * PDF. The JetBrains Mono base64 cache is shared across documents, so the loop
   * only repeats the cheap per-doc addFont, never a refetch.
   */
  async toSeparatePdfs(
    songs: ParsedSong[],
    pdfFontSize = 14,
    accidentals: Accidentals = 'auto',
    fontChoice: ChordFont = 'classic',
    zipName = 'worship-set',
    instrument: ChordInstrument = 'guitar',
    includeInk = false,
  ): Promise<void> {
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();

    const used = new Set<string>();
    const fileNameFor = (title: string): string => {
      const base = (title || 'song').replace(/[^a-z0-9]/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'song';
      let name = base;
      let n = 2;
      while (used.has(name)) name = `${base}-${n++}`;
      used.add(name);
      return `${name}.pdf`;
    };

    for (const song of songs) {
      const doc = await this.buildDoc([song], pdfFontSize, accidentals, fontChoice, instrument, {
        includeInk,
      });
      zip.file(fileNameFor(song.title), doc.output('blob'));
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(zipName || 'worship-set').replace(/[^a-z0-9]/gi, '-')}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Draws one row of small fretboard diagrams — one per distinct chord in the
  // song — wrapping to further rows if they don't fit maxWidth, and returns
  // the total height consumed so the caller can push the section layout
  // below it. Diagrams are drawn as vectors (lines/circles), same as the
  // rest of the PDF, so this adds no image data or extra dependency.
  private drawChordDiagrams(
    doc: JsPdf,
    song: ParsedSong,
    accidentals: Accidentals,
    instrument: ChordInstrument,
    x: number,
    y: number,
    maxWidth: number,
  ): number {
    const labels = this.chordSvc.distinctChordLabels(song, accidentals);
    if (labels.length === 0) return 0;

    const DIAG_W = 42;
    const DIAG_H = 34;
    const GAP = 6;
    const perRow = Math.max(1, Math.floor((maxWidth + GAP) / (DIAG_W + GAP)));

    let col = 0;
    let cx = x;
    let cy = y;
    for (const label of labels) {
      if (col >= perRow) {
        col = 0;
        cx = x;
        cy += DIAG_H;
      }
      const parsed = this.chordSvc.parseChord(label);
      const shape = parsed ? chordShape(parsed.root, parsed.suffix, instrument) : null;
      this.drawOneDiagram(doc, label, shape, cx, cy, instrument);
      cx += DIAG_W + GAP;
      col++;
    }
    return cy - y + DIAG_H;
  }

  private drawOneDiagram(
    doc: JsPdf,
    label: string,
    shape: ChordShapeDiagram | null,
    ox: number,
    oy: number,
    instrument: ChordInstrument,
  ): void {
    const DIAG_W = 42;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(17, 24, 39);
    doc.text(label, ox + DIAG_W / 2, oy + 6, { align: 'center' });

    if (!shape) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(5);
      doc.setTextColor(107, 114, 128);
      doc.text('no shape', ox + DIAG_W / 2, oy + 20, { align: 'center' });
      return;
    }

    const stringCount = instrument === 'ukulele' ? 4 : 6;
    const boardW = 24;
    const marginX = (DIAG_W - boardW) / 2;
    const sx = (i: number) => ox + marginX + i * (boardW / (stringCount - 1));
    const yTop = oy + 11;
    const rowH = 6;
    const fy = (row: number) => yTop + row * rowH;

    doc.setDrawColor(107, 114, 128);
    doc.setLineWidth(0.4);
    for (let i = 0; i < stringCount; i++) {
      doc.line(sx(i), yTop, sx(i), fy(4));
    }
    if (shape.baseFret === 1) {
      doc.setLineWidth(1.1);
      doc.line(sx(0), yTop, sx(stringCount - 1), yTop);
      doc.setLineWidth(0.4);
    } else {
      doc.line(sx(0), yTop, sx(stringCount - 1), yTop);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(4.5);
      doc.text(`${shape.baseFret}fr`, sx(stringCount - 1) + 2, yTop + 3);
    }
    for (let row = 1; row <= 4; row++) {
      doc.line(sx(0), fy(row), sx(stringCount - 1), fy(row));
    }

    doc.setFontSize(4.5);
    doc.setTextColor(107, 114, 128);
    for (let i = 0; i < stringCount; i++) {
      const f = shape.frets[i];
      if (f === 0) {
        doc.circle(sx(i), yTop - 3, 1.2, 'S');
      } else if (f === -1) {
        doc.text('x', sx(i), yTop - 1, { align: 'center' });
      }
    }

    if (shape.barreFret !== undefined) {
      const row = shape.barreFret - shape.baseFret + 1;
      const indices = shape.frets
        .map((f, i) => ({ i, rel: f > 0 ? f - shape.baseFret + 1 : 0 }))
        .filter(e => e.rel === row)
        .map(e => e.i);
      if (indices.length >= 2) {
        const from = Math.min(...indices);
        const to = Math.max(...indices);
        doc.setDrawColor(29, 78, 216);
        doc.setLineWidth(2.5);
        doc.line(sx(from), fy(row) - rowH / 2, sx(to), fy(row) - rowH / 2);
        doc.setDrawColor(107, 114, 128);
        doc.setLineWidth(0.4);
      }
    }

    doc.setFillColor(29, 78, 216);
    for (let i = 0; i < stringCount; i++) {
      const f = shape.frets[i];
      if (f > 0) {
        const rel = f - shape.baseFret + 1;
        doc.circle(sx(i), fy(rel) - rowH / 2, 1.6, 'F');
      }
    }
  }

  // Draws a line's ink strokes in PDF space. x maps column-for-column (ink x is
  // in ch, the PDF is monospace); y maps em → points around the anchor row's
  // baseline, compressing the part above a lyric baseline as described at
  // INK_CHORD_TO_LYRIC_EM. Highlighter strokes go down at reduced opacity.
  private drawInk(
    doc: JsPdf,
    GState: typeof JsPdfGState,
    strokes: InkStroke[],
    fontPt: number,
    charW: number,
    anchor: PdfInkAnchor,
  ): void {
    const isLyric = anchor.chordBaseline !== null;
    const baseEm = isLyric ? INK_LYRIC_BASELINE_EM : INK_CHORD_BASELINE_EM;
    const screenAboveEm = INK_CHORD_TO_LYRIC_EM + anchor.annotationRows * INK_ANNOTATION_ROW_EM;
    const pdfAbovePt = isLyric ? anchor.baseline - (anchor.chordBaseline as number) : 0;
    const aboveScale = isLyric && pdfAbovePt > 0 ? pdfAbovePt / (screenAboveEm * fontPt) : 1;
    const px = (xCh: number) => anchor.x + xCh * charW;
    const py = (yEm: number) => {
      const d = yEm - baseEm;
      return anchor.baseline + d * fontPt * (d < 0 ? aboveScale : 1);
    };

    doc.saveGraphicsState();
    doc.setLineJoin('round');
    for (const stroke of strokes) {
      const pts = stroke.points;
      if (pts.length < 2) continue;
      const [r, g, b] = this.inkRgb(stroke.color);
      const width = Math.max(0.4, stroke.width * fontPt);
      // jsPDF's `opacity` is fill alpha only; strokes need `stroke-opacity`.
      const alpha = stroke.tool === 'highlighter' ? 0.4 : 1;
      doc.setGState(new GState({ opacity: alpha, 'stroke-opacity': alpha }));
      // Flat ends for the highlighter, as on screen — a round cap half an em
      // wide would overhang the start of the line.
      doc.setLineCap(stroke.tool === 'highlighter' ? 'butt' : 'round');
      if (pts.length === 2) {
        doc.setFillColor(r, g, b);
        doc.circle(px(pts[0]), py(pts[1]), width / 2, 'F');
        continue;
      }
      doc.setDrawColor(r, g, b);
      doc.setLineWidth(width);
      doc.moveTo(px(pts[0]), py(pts[1]));
      for (let i = 2; i < pts.length; i += 2) doc.lineTo(px(pts[i]), py(pts[i + 1]));
      doc.stroke();
    }
    doc.restoreGraphicsState();
  }

  // 'auto' ink follows the theme's text color on screen; on paper that's the
  // same near-black the lyrics are printed in.
  private inkRgb(color: string): [number, number, number] {
    const m = /^#([0-9a-f]{6})$/i.exec(color);
    if (!m) return [17, 24, 39];
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  // Builds a single jsPDF document containing every song passed in (one per page
  // group), and returns it WITHOUT saving so callers can either .save() it
  // (combined export) or .output('blob') it into a zip (per-song export).
  private async buildDoc(
    songs: ParsedSong[],
    pdfFontSize: number,
    accidentals: Accidentals,
    fontChoice: ChordFont,
    instrument: ChordInstrument = 'guitar',
    setOptions: SetPdfOptions | null = null,
  ): Promise<JsPdf> {
    const { jsPDF, GState } = await import('jspdf');
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    const includeInk = !!setOptions?.includeInk;
    // A cover/TOC page only makes sense for a genuine multi-song set.
    const includeCover = !!setOptions?.coverPage && songs.length > 1;

    const margin        = 40;
    const pageW         = doc.internal.pageSize.getWidth();
    const pageH         = doc.internal.pageSize.getHeight();
    const colGap        = 20;
    // Above 14px: single-column layout so text doesn't overflow or wrap unexpectedly
    const splitColumns  = pdfFontSize <= 14;
    const colWidth      = splitColumns
      ? (pageW - margin * 2 - colGap) / 2   // 256pt each
      : (pageW - margin * 2);                // 532pt full width
    const col2X         = Math.round(margin + colWidth + colGap);

    // Embed WT marker; only embed column geometry when actually splitting (for round-trip parser)
    doc.setProperties({ subject: 'WorshipToolkit', keywords: splitColumns ? String(col2X) : '' });

    // Scale body font relative to 14px base.
    // In split-column mode cap at 10pt so chars never overflow the 256pt column.
    // In single-column mode no cap is needed — the 532pt width comfortably fits larger text.
    const rawScale = pdfFontSize / 14;
    const scale    = splitColumns ? Math.min(rawScale, 10 / 8) : rawScale;

    // Match the editor: same sizes as the CSS (0.82rem ≈ 8pt print). "courier" is
    // one of jsPDF's built-in base-14 fonts; "readable" embeds JetBrains Mono TTFs.
    let MONO = 'courier';
    if (fontChoice === 'readable') {
      MONO = 'JetBrainsMono';
      const fonts = await this.getJetbrainsMonoFonts();
      doc.addFileToVFS('JetBrainsMono-Regular.ttf', fonts.regular);
      doc.addFont('JetBrainsMono-Regular.ttf', MONO, 'normal');
      doc.addFileToVFS('JetBrainsMono-Bold.ttf', fonts.bold);
      doc.addFont('JetBrainsMono-Bold.ttf', MONO, 'bold');
      doc.addFileToVFS('JetBrainsMono-Italic.ttf', fonts.italic);
      doc.addFont('JetBrainsMono-Italic.ttf', MONO, 'italic');
    }
    const FONT_PT      = 8 * scale;
    const SEC_LABEL_PT = 9 * scale; // section labels slightly larger than body (9pt vs 8pt)
    // Measured from the actual font's metrics rather than assumed, since different
    // monospace fonts have different advance-width-to-point-size ratios (Courier's
    // happens to be exactly 0.6, JetBrains Mono's is not).
    doc.setFont(MONO, 'normal');
    doc.setFontSize(FONT_PT);
    const CHAR_W       = doc.getTextWidth('0');
    const CHORD_H      = 10 * scale;    // vertical space consumed by a chord row
    const ANNOT_H      = 9  * scale;    // vertical space consumed by an annotation row (single line)
    const LYRIC_H      = 11 * scale;    // vertical space consumed by a lyric row (single line)
    const SEC_GAP      = 16 * scale;    // space before a section label (bumped for larger label)

    // Max characters that fit horizontally in one column at this font size
    const maxCharsPerCol = Math.floor(colWidth / CHAR_W);

    // CSS variable equivalents: --color-chord / --color-text / --color-muted
    const setChordColor  = () => doc.setTextColor(29,  78,  216); // #1d4ed8
    const setTextColor   = () => doc.setTextColor(17,  24,  39);  // #111827
    const setMutedColor  = () => doc.setTextColor(107, 114, 128); // #6b7280

    // Reserve blank cover/TOC pages up front — their content (which needs
    // each song's actual starting page number) is drawn in a second pass
    // after the songs below have been laid out and those numbers are known.
    // One combined page serves as both: a header block (set name, date,
    // song count, estimated duration) followed by a page-numbered row per
    // song, rather than two near-duplicate listings.
    const TOC_ROWS_PER_PAGE = 32;
    const coverPageCount = includeCover ? Math.max(1, Math.ceil(songs.length / TOC_ROWS_PER_PAGE)) : 0;
    for (let i = 1; i < coverPageCount; i++) doc.addPage(); // page 1 already exists
    const songStartPages: number[] = [];

    for (let si = 0; si < songs.length; si++) {
      const song = this.sanitizeSong(songs[si]);
      if (includeCover || si > 0) doc.addPage();
      songStartPages.push(doc.getNumberOfPages());

      const effectiveKey = this.chordSvc.effectiveKey(song, accidentals);

      // ── Header (Helvetica, like the editor toolbar) ──────────────────────────
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      setTextColor();
      doc.text(song.title, margin, margin + 12);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      setMutedColor();
      let authorY = margin + 24;
      for (const author of song.authors) {
        doc.text(author, margin, authorY);
        authorY += 10;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      setMutedColor();
      let keyLine = `Key - ${effectiveKey} | Tempo - ${song.tempo} | Time - ${song.timeSignature}`;
      if (song.capo) {
        keyLine += ` | Capo ${song.capo} (play in ${this.chordSvc.shapeKey(song, accidentals)})`;
      }
      doc.text(keyLine, margin, authorY + 2);

      let headerH = (authorY + 2) - margin + 14;

      if (song.notes) {
        doc.setFont(MONO, 'italic');
        doc.setFontSize(FONT_PT - 1);
        setMutedColor();
        const noteLines = doc.splitTextToSize(song.notes, pageW - margin * 2) as string[];
        doc.text(noteLines, margin, margin + headerH - 2);
        headerH += ANNOT_H * noteLines.length;
      }

      // Same gating as the on-screen toggle: diagrams hide under Nashville
      // numbers, which have no fingering to show.
      if (song.showChordDiagrams && !song.showNashville) {
        headerH += this.drawChordDiagrams(
          doc, song, accidentals, instrument,
          margin, margin + headerH - 6, pageW - margin * 2,
        );
      }

      // ── Two-column section layout ─────────────────────────────────────────────
      let col = 0;
      let y   = margin + headerH;

      const colX      = (c: number) => margin + c * (colWidth + colGap);
      const newColumn = () => {
        if (splitColumns && col === 0) { col = 1; y = margin + headerH; }
        else { doc.addPage(); col = 0; y = margin + 20; }
      };
      const ensureSpace = (needed: number) => {
        if (y + needed > pageH - margin) newColumn();
      };

      for (let secIdx = 0; secIdx < song.sections.length; secIdx++) {
        const section = song.sections[secIdx];
        // Estimate height so we don't orphan a section header at the column bottom.
        // Account for lyric/annotation wrapping at the current font size.
        let needed = SEC_GAP;
        for (const line of section.lines) {
          if (line.chords.length > 0) needed += CHORD_H;
          if (line.annotation) {
            const annWraps = Math.ceil((line.annotation.length || 1) / maxCharsPerCol);
            needed += ANNOT_H * Math.max(1, annWraps);
          }
          if (!line.isChordsOnly) {
            const lyricWraps = Math.ceil((line.lyric?.length || 1) / maxCharsPerCol);
            needed += LYRIC_H * Math.max(1, lyricWraps);
          }
        }
        ensureSpace(needed);

        // Section label — uppercase, bold, larger than body text
        doc.setFont(MONO, 'bold');
        doc.setFontSize(SEC_LABEL_PT);
        setMutedColor();
        doc.text(section.name, colX(col), y);
        // Modulation marker, right-aligned on the label line — where SongSelect
        // puts its own "Key - X", and what the parser picks back up on re-import.
        const keyChange = this.keyChangeText(song, secIdx, accidentals);
        if (keyChange) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8 * scale);
          setChordColor();
          doc.text(keyChange, colX(col) + colWidth, y, { align: 'right' });
        }
        y += SEC_GAP;

        for (const line of section.lines) {
          const hasChords = line.chords.length > 0;
          const hasLyric  = !line.isChordsOnly && line.lyric.trim().length > 0;
          const ann = line.annotation
            ? this.chordSvc.displayAnnotation(line.annotation, song, accidentals, section)
            : '';

          if (hasChords) {
            // Measure the real wrapped-line counts for annotation/lyric up front and
            // reserve space for the whole chord+annotation+lyric group in one call, so
            // the group moves to the next column/page as a unit rather than the chord
            // row landing on one column and its lyric being pushed to the next by a
            // later, more-accurate ensureSpace() call mid-line.
            const annLines   = ann ? (doc.splitTextToSize(ann, colWidth) as string[]) : [];
            const lyricLines = hasLyric ? (doc.splitTextToSize(line.lyric, colWidth) as string[]) : [];
            ensureSpace(CHORD_H + ANNOT_H * annLines.length + LYRIC_H * lyricLines.length);

            // Same anti-stacking as chordLeft() in the display component:
            // sort by charPos, advance cursor so no chord overlaps the previous one.
            const sorted = [...line.chords]
              .map((ct, i) => ({ ct, i }))
              .sort((a, b) => (a.ct.charPos ?? 0) - (b.ct.charPos ?? 0));

            doc.setFont(MONO, 'bold');
            doc.setFontSize(FONT_PT);
            setChordColor();
            const chordBaseline = y;

            let cursor = 0;
            for (const { ct } of sorted) {
              const chord  = this.getDisplayChord(ct.chord, song, accidentals, section);
              const pos    = Math.max(cursor, ct.charPos ?? 0);
              const chordX = colX(col) + pos * CHAR_W;
              // Clamp: skip chords that would start past the right column edge
              if (chordX + chord.length * CHAR_W <= colX(col) + colWidth + CHAR_W) {
                doc.text(chord, chordX, y);
              }
              cursor = pos + chord.length + 1;
            }
            y += CHORD_H;

            if (annLines.length) {
              doc.setFont(MONO, 'italic');
              doc.setFontSize(FONT_PT - 0.5);
              setMutedColor();
              doc.text(annLines, colX(col), y);
              y += ANNOT_H * annLines.length;
            }

            const lyricBaseline = y;
            if (lyricLines.length) {
              doc.setFont(MONO, 'normal');
              doc.setFontSize(FONT_PT);
              setTextColor();
              doc.text(lyricLines, colX(col), y);
              y += LYRIC_H * lyricLines.length;
            }
            if (includeInk && line.ink?.length) {
              this.drawInk(doc, GState, line.ink, FONT_PT, CHAR_W, line.isChordsOnly
                ? { x: colX(col), baseline: chordBaseline, chordBaseline: null, annotationRows: 0 }
                : { x: colX(col), baseline: lyricBaseline, chordBaseline, annotationRows: annLines.length });
            }
          } else {
            if (ann) {
              doc.setFont(MONO, 'italic');
              doc.setFontSize(FONT_PT - 0.5);
              setMutedColor();
              const annLines = doc.splitTextToSize(ann, colWidth) as string[];
              ensureSpace(ANNOT_H * annLines.length);
              doc.text(annLines, colX(col), y);
              y += ANNOT_H * annLines.length;
            }

            let lyricBaseline = y;
            if (hasLyric) {
              doc.setFont(MONO, 'normal');
              doc.setFontSize(FONT_PT);
              setTextColor();
              const lyricLines = doc.splitTextToSize(line.lyric, colWidth) as string[];
              ensureSpace(LYRIC_H * lyricLines.length);
              lyricBaseline = y; // after ensureSpace, which may have moved to a new column
              doc.text(lyricLines, colX(col), y);
              y += LYRIC_H * lyricLines.length;
            }
            if (includeInk && line.ink?.length) {
              // A chordless lyric: no chord row above to compress against.
              this.drawInk(doc, GState, line.ink, FONT_PT, CHAR_W, {
                x: colX(col),
                baseline: lyricBaseline,
                chordBaseline: lyricBaseline - INK_CHORD_TO_LYRIC_EM * FONT_PT,
                annotationRows: 0,
              });
            }

            if (!ann && !hasLyric) y += LYRIC_H * 0.4;
          }
        }

        y += SEC_GAP * 0.4;
      }

      // ── Footer ────────────────────────────────────────────────────────────────
      if (song.ccliNumber) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        setMutedColor();
        doc.text(`CCLI Song # ${song.ccliNumber}`, pageW / 2, pageH - 20, { align: 'center' });
      }
    }

    if (includeCover) {
      this.drawCoverPages(doc, songs, setOptions?.setName, accidentals, songStartPages, margin, pageW, pageH);
    }

    return doc;
  }

  // Drawn as a second pass, once every song's actual starting page is known
  // from the main layout loop above — jsPDF's setPage() lets earlier
  // (already-reserved, still-blank) pages be revisited for this without
  // disturbing the page order already laid down.
  private drawCoverPages(
    doc: JsPdf,
    songs: ParsedSong[],
    setName: string | undefined,
    accidentals: Accidentals,
    songStartPages: number[],
    margin: number,
    pageW: number,
    pageH: number,
  ): void {
    doc.setPage(1);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(17, 24, 39);
    doc.text(setName || 'Worship Set', margin, margin + 16);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    const dateStr = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    const timed = songs.filter(s => (s.durationSeconds ?? 0) > 0);
    const totalSeconds = timed.reduce((sum, s) => sum + (s.durationSeconds ?? 0), 0);
    const durationStr = timed.length
      ? `≈ ${Math.round(totalSeconds / 60)} min (${timed.length} of ${songs.length} songs timed)`
      : null;
    const summaryParts = [dateStr, `${songs.length} song${songs.length === 1 ? '' : 's'}`, durationStr]
      .filter((p): p is string => !!p);
    doc.text(summaryParts.join('   ·   '), margin, margin + 34);

    let page = 1;
    let y = margin + 56;
    const rowH = 15;
    const bottomLimit = pageH - margin;

    for (let i = 0; i < songs.length; i++) {
      if (y + rowH > bottomLimit) {
        page++;
        doc.setPage(page);
        y = margin + 20;
      }
      const song = songs[i];
      const key = this.chordSvc.effectiveKey(song, accidentals);
      let label = `${i + 1}. ${song.title || 'Untitled'} — Key ${key}`;
      if (song.capo) label += ` · Capo ${song.capo}`;
      if (song.tempo) label += ` · ${song.tempo} BPM`;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(17, 24, 39);
      doc.text(label, margin, y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(107, 114, 128);
      doc.text(`p. ${songStartPages[i]}`, pageW - margin, y, { align: 'right' });

      y += rowH;
    }
  }

  downloadSession(songs: ParsedSong[], name: string): void {
    const payload = {
      wtVersion: '1.1.0',
      exportedAt: new Date().toISOString(),
      sessionName: name,
      songs,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/[^a-z0-9]/gi, '-')}.wt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async parseSessionFile(file: File): Promise<{ name: string; songs: ParsedSong[] }> {
    const text = await file.text();
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('Invalid file — not valid JSON.');
    }
    if (!parsed['wtVersion'] || !Array.isArray(parsed['songs']) || parsed['songs'].length === 0) {
      throw new Error('Invalid set file — missing required fields.');
    }
    const rawSongs = parsed['songs'] as unknown[];
    for (const s of rawSongs) {
      const song = s as Record<string, unknown> | null;
      if (!song || typeof song['title'] !== 'string' || !Array.isArray(song['sections'])) {
        throw new Error('Invalid set file — one or more songs have an unexpected format.');
      }
      // Clamp a hostile/garbage capo value (e.g. a hand-edited .wt) into the
      // 0-11 fret range the toolbar chip and PDF/Markdown export assume.
      if ('capo' in song) {
        const n = Math.round(Number(song['capo']));
        song['capo'] = Number.isFinite(n) && n > 0 ? Math.min(11, n) : undefined;
      }
      this.sanitizeImportedSections(song['sections'] as unknown[]);
    }
    return {
      name: (parsed['sessionName'] as string) || file.name.replace(/\.wt$/i, ''),
      songs: rawSongs as ParsedSong[],
    };
  }

  // Same spirit as the capo clamp above, for the two per-section/per-line
  // fields a hand-edited .wt could break: a modulation key the chord engine
  // can't read is dropped (the section falls back to the song key), and an
  // ink stroke with a non-hex color, a silly width or a malformed point list
  // is dropped rather than reaching the SVG renderer or the PDF exporter.
  private sanitizeImportedSections(sections: unknown[]): void {
    for (const raw of sections) {
      const section = raw as Record<string, unknown> | null;
      if (!section || typeof section !== 'object') continue;
      if ('key' in section && !(typeof section['key'] === 'string' && /^[A-G][b#]?$/.test(section['key']))) {
        delete section['key'];
      }
      if (!Array.isArray(section['lines'])) continue;
      for (const rawLine of section['lines'] as unknown[]) {
        const line = rawLine as Record<string, unknown> | null;
        if (!line || typeof line !== 'object' || !('ink' in line)) continue;
        const strokes = Array.isArray(line['ink'])
          ? (line['ink'] as unknown[]).filter((st) => this.isValidInkStroke(st))
          : [];
        if (strokes.length) line['ink'] = strokes;
        else delete line['ink'];
      }
    }
  }

  private isValidInkStroke(raw: unknown): boolean {
    const st = raw as Record<string, unknown> | null;
    if (!st || typeof st !== 'object') return false;
    if (st['tool'] !== 'pen' && st['tool'] !== 'highlighter') return false;
    if (typeof st['color'] !== 'string' || !/^(auto|#[0-9a-fA-F]{6})$/.test(st['color'])) return false;
    const w = st['width'];
    if (typeof w !== 'number' || !(w > 0 && w <= 4)) return false;
    const pts = st['points'];
    return (
      Array.isArray(pts) &&
      pts.length >= 2 &&
      pts.length % 2 === 0 &&
      pts.length <= 20000 &&
      pts.every((v) => typeof v === 'number' && Number.isFinite(v))
    );
  }

  downloadMarkdown(songs: ParsedSong[], accidentals: Accidentals = 'auto'): void {
    const content = this.toMarkdown(songs, accidentals);
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'worship-set.md';
    a.click();
    URL.revokeObjectURL(url);
  }
}
