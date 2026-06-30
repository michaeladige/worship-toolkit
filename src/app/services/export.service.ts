import { Injectable } from '@angular/core';
import { ParsedSong, SongLine, ChordToken } from '../models/song.model';
import { ChordService } from './chord.service';

@Injectable({ providedIn: 'root' })
export class ExportService {

  constructor(private chordSvc: ChordService) {}

  toMarkdown(songs: ParsedSong[]): string {
    return songs.map(song => this.songToMarkdown(song)).join('\n\n---\n\n');
  }

  private songToMarkdown(song: ParsedSong): string {
    const effectiveKey = this.chordSvc.transposeKey(song.originalKey, song.transposeSemitones);
    const lines: string[] = [];

    lines.push(`# ${song.title}`);
    if (song.authors.length) lines.push(song.authors.join(' | '));
    lines.push(`**Key - ${effectiveKey} | Tempo - ${song.tempo} | Time - ${song.timeSignature}**`);
    lines.push('');

    for (const section of song.sections) {
      lines.push(`**${section.name}**`);
      lines.push('');
      for (const line of section.lines) {
        const chordLine = this.renderChordRow(line, song);
        if (chordLine.trim()) lines.push(chordLine);
        if (line.annotation) {
          const ann = this.chordSvc.transposeAnnotation(line.annotation, song.transposeSemitones, effectiveKey);
          lines.push(`*${ann}*`);
        }
        if (line.lyric.trim()) lines.push(line.lyric);
        if (!chordLine.trim() && !line.annotation && !line.lyric.trim()) lines.push('');
      }
      lines.push('');
    }

    if (song.ccliNumber) {
      lines.push(`*CCLI Song # ${song.ccliNumber}*`);
    }

    return lines.join('\n');
  }

  private renderChordRow(line: SongLine, song: ParsedSong): string {
    if (line.chords.length === 0) return '';

    // Build a character array
    const maxLen = Math.max(line.lyric.length + 20, 80);
    const chars: string[] = new Array(maxLen).fill(' ');

    const sortedChords = [...line.chords].sort((a, b) => (a.charPos ?? 0) - (b.charPos ?? 0));

    let cursor = 0;
    for (const ct of sortedChords) {
      const chord = this.getDisplayChord(ct.chord, song);
      const pos = Math.max(cursor, ct.charPos ?? 0);
      for (let j = 0; j < chord.length; j++) {
        if (pos + j < chars.length) chars[pos + j] = chord[j];
      }
      cursor = pos + chord.length + 1;
    }

    return chars.join('').trimEnd();
  }

  getDisplayChord(chord: string, song: ParsedSong): string {
    const effectiveKey = this.chordSvc.transposeKey(song.originalKey, song.transposeSemitones);
    let transposed = this.chordSvc.transposeChord(chord, song.transposeSemitones, effectiveKey);
    if (song.showBassNotesOnly) transposed = this.chordSvc.getBassNote(transposed);
    if (song.showNashville) transposed = this.chordSvc.toNashville(transposed, effectiveKey);
    return transposed;
  }

  async toPdf(songs: ParsedSong[], fontSize = 14): Promise<void> {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });

    const margin     = 40;
    const pageW      = doc.internal.pageSize.getWidth();
    const pageH      = doc.internal.pageSize.getHeight();
    const colGap     = 20;
    const colWidth   = (pageW - margin * 2 - colGap) / 2;
    const col2X      = Math.round(margin + colWidth + colGap); // right column x start

    // Embed WT marker + column geometry so the parser can round-trip this PDF reliably
    doc.setProperties({ subject: 'WorshipToolkit', keywords: String(col2X) });

    // Scale all PDF sizes proportionally to the user's font size preference (default 14px base)
    const scale = fontSize / 14;

    // Match the editor: Courier New monospace, same sizes as the CSS (0.82rem ≈ 8pt print)
    const MONO         = 'courier';
    const FONT_PT      = 8 * scale;
    const SEC_LABEL_PT = 9 * scale; // section labels slightly larger than body (9pt vs 8pt)
    const CHAR_W       = FONT_PT * 0.6; // Courier: every char is exactly 60% of the point size
    const CHORD_H      = 10 * scale;    // vertical space consumed by a chord row
    const ANNOT_H      = 9  * scale;    // vertical space consumed by an annotation row
    const LYRIC_H      = 11 * scale;    // vertical space consumed by a lyric row
    const SEC_GAP      = 16 * scale;    // space before a section label (bumped for larger label)

    // CSS variable equivalents: --color-chord / --color-text / --color-muted
    const setChordColor  = () => doc.setTextColor(29,  78,  216); // #1d4ed8
    const setTextColor   = () => doc.setTextColor(17,  24,  39);  // #111827
    const setMutedColor  = () => doc.setTextColor(107, 114, 128); // #6b7280

    for (let si = 0; si < songs.length; si++) {
      const song = songs[si];
      if (si > 0) doc.addPage();

      const effectiveKey = this.chordSvc.transposeKey(song.originalKey, song.transposeSemitones);

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
      doc.text(
        `Key - ${effectiveKey} | Tempo - ${song.tempo} | Time - ${song.timeSignature}`,
        margin, authorY + 2,
      );

      const headerH = (authorY + 2) - margin + 14;

      // ── Two-column section layout ─────────────────────────────────────────────
      let col = 0;
      let y   = margin + headerH;

      const colX      = (c: number) => margin + c * (colWidth + colGap);
      const newColumn = () => {
        if (col === 0) { col = 1; y = margin + headerH; }
        else           { doc.addPage(); col = 0; y = margin + 20; }
      };
      const ensureSpace = (needed: number) => {
        if (y + needed > pageH - margin) newColumn();
      };

      for (const section of song.sections) {
        // Estimate height so we don't orphan a section header at the column bottom
        let needed = SEC_GAP;
        for (const line of section.lines) {
          if (line.chords.length > 0)  needed += CHORD_H;
          if (line.annotation)         needed += ANNOT_H;
          if (!line.isChordsOnly)      needed += LYRIC_H;
        }
        ensureSpace(needed);

        // Section label — uppercase, bold, larger than body text
        doc.setFont(MONO, 'bold');
        doc.setFontSize(SEC_LABEL_PT);
        setMutedColor();
        doc.text(section.name, colX(col), y);
        y += SEC_GAP;

        for (const line of section.lines) {
          const hasChords = line.chords.length > 0;
          const hasLyric  = !line.isChordsOnly && line.lyric.trim().length > 0;

          if (hasChords) {
            ensureSpace(CHORD_H + (line.annotation ? ANNOT_H : 0) + (hasLyric ? LYRIC_H : 0));

            // Same anti-stacking as chordLeft() in the display component:
            // sort by charPos, advance cursor so no chord overlaps the previous one.
            const sorted = [...line.chords]
              .map((ct, i) => ({ ct, i }))
              .sort((a, b) => (a.ct.charPos ?? 0) - (b.ct.charPos ?? 0));

            doc.setFont(MONO, 'bold');
            doc.setFontSize(FONT_PT);
            setChordColor();

            let cursor = 0;
            for (const { ct } of sorted) {
              const chord = this.getDisplayChord(ct.chord, song);
              const pos   = Math.max(cursor, ct.charPos ?? 0);
              doc.text(chord, colX(col) + pos * CHAR_W, y);
              cursor = pos + chord.length + 1;
            }
            y += CHORD_H;
          }

          if (line.annotation) {
            ensureSpace(ANNOT_H);
            doc.setFont(MONO, 'italic');
            doc.setFontSize(FONT_PT - 0.5);
            setMutedColor();
            const ann = this.chordSvc.transposeAnnotation(line.annotation, song.transposeSemitones, effectiveKey);
            doc.text(ann, colX(col), y, { maxWidth: colWidth });
            y += ANNOT_H;
          }

          if (hasLyric) {
            ensureSpace(LYRIC_H);
            doc.setFont(MONO, 'normal');
            doc.setFontSize(FONT_PT);
            setTextColor();
            doc.text(line.lyric, colX(col), y);
            y += LYRIC_H;
          }

          if (!hasChords && !line.annotation && !hasLyric) y += LYRIC_H * 0.4;
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

    doc.save('worship-set.pdf');
  }

  downloadMarkdown(songs: ParsedSong[]): void {
    const content = this.toMarkdown(songs);
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'worship-set.md';
    a.click();
    URL.revokeObjectURL(url);
  }
}
