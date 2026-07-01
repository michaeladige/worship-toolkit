import { Injectable } from '@angular/core';
import { ParsedSong, SongLine, ChordToken } from '../models/song.model';
import { Accidentals, ChordService } from './chord.service';

@Injectable({ providedIn: 'root' })
export class ExportService {

  constructor(private chordSvc: ChordService) {}

  toMarkdown(songs: ParsedSong[], accidentals: Accidentals = 'auto'): string {
    return songs.map(song => this.songToMarkdown(song, accidentals)).join('\n\n---\n\n');
  }

  private songToMarkdown(song: ParsedSong, accidentals: Accidentals = 'auto'): string {
    const effectiveKey = this.chordSvc.transposeKey(song.originalKey, song.transposeSemitones, accidentals);
    const lines: string[] = [];

    lines.push(`# ${song.title}`);
    if (song.authors.length) lines.push(song.authors.join(' | '));
    lines.push(`**Key - ${effectiveKey} | Tempo - ${song.tempo} | Time - ${song.timeSignature}**`);
    lines.push('');

    for (const section of song.sections) {
      lines.push(`**${section.name}**`);
      lines.push('');
      for (const line of section.lines) {
        const chordLine = this.renderChordRow(line, song, accidentals);
        if (chordLine.trim()) lines.push(chordLine);
        if (line.annotation) {
          const ann = this.chordSvc.transposeAnnotation(line.annotation, song.transposeSemitones, effectiveKey, accidentals);
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

  private renderChordRow(line: SongLine, song: ParsedSong, accidentals: Accidentals = 'auto'): string {
    if (line.chords.length === 0) return '';

    // Build a character array
    const maxLen = Math.max(line.lyric.length + 20, 80);
    const chars: string[] = new Array(maxLen).fill(' ');

    const sortedChords = [...line.chords].sort((a, b) => (a.charPos ?? 0) - (b.charPos ?? 0));

    let cursor = 0;
    for (const ct of sortedChords) {
      const chord = this.getDisplayChord(ct.chord, song, accidentals);
      const pos = Math.max(cursor, ct.charPos ?? 0);
      for (let j = 0; j < chord.length; j++) {
        if (pos + j < chars.length) chars[pos + j] = chord[j];
      }
      cursor = pos + chord.length + 1;
    }

    return chars.join('').trimEnd();
  }

  getDisplayChord(chord: string, song: ParsedSong, accidentals: Accidentals = 'auto'): string {
    const effectiveKey = this.chordSvc.transposeKey(song.originalKey, song.transposeSemitones, accidentals);
    let transposed = this.chordSvc.transposeChord(chord, song.transposeSemitones, effectiveKey, accidentals);
    if (song.showBassNotesOnly) transposed = this.chordSvc.getBassNote(transposed);
    if (song.showNashville) transposed = this.chordSvc.toNashville(transposed, effectiveKey);
    return transposed;
  }

  async toPdf(songs: ParsedSong[], pdfFontSize = 14, accidentals: Accidentals = 'auto'): Promise<void> {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });

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

    // Match the editor: Courier New monospace, same sizes as the CSS (0.82rem ≈ 8pt print)
    const MONO         = 'courier';
    const FONT_PT      = 8 * scale;
    const SEC_LABEL_PT = 9 * scale; // section labels slightly larger than body (9pt vs 8pt)
    const CHAR_W       = FONT_PT * 0.6; // Courier: every char is exactly 60% of the point size
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

    for (let si = 0; si < songs.length; si++) {
      const song = songs[si];
      if (si > 0) doc.addPage();

      const effectiveKey = this.chordSvc.transposeKey(song.originalKey, song.transposeSemitones, accidentals);

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
        if (splitColumns && col === 0) { col = 1; y = margin + headerH; }
        else { doc.addPage(); col = 0; y = margin + 20; }
      };
      const ensureSpace = (needed: number) => {
        if (y + needed > pageH - margin) newColumn();
      };

      for (const section of song.sections) {
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
              const chord  = this.getDisplayChord(ct.chord, song, accidentals);
              const pos    = Math.max(cursor, ct.charPos ?? 0);
              const chordX = colX(col) + pos * CHAR_W;
              // Clamp: skip chords that would start past the right column edge
              if (chordX + chord.length * CHAR_W <= colX(col) + colWidth + CHAR_W) {
                doc.text(chord, chordX, y);
              }
              cursor = pos + chord.length + 1;
            }
            y += CHORD_H;
          }

          if (line.annotation) {
            doc.setFont(MONO, 'italic');
            doc.setFontSize(FONT_PT - 0.5);
            setMutedColor();
            const ann = this.chordSvc.transposeAnnotation(line.annotation, song.transposeSemitones, effectiveKey, accidentals);
            const annLines = doc.splitTextToSize(ann, colWidth) as string[];
            ensureSpace(ANNOT_H * annLines.length);
            doc.text(annLines, colX(col), y);
            y += ANNOT_H * annLines.length;
          }

          if (hasLyric) {
            doc.setFont(MONO, 'normal');
            doc.setFontSize(FONT_PT);
            setTextColor();
            const lyricLines = doc.splitTextToSize(line.lyric, colWidth) as string[];
            ensureSpace(LYRIC_H * lyricLines.length);
            doc.text(lyricLines, colX(col), y);
            y += LYRIC_H * lyricLines.length;
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
    return {
      name: (parsed['sessionName'] as string) || file.name.replace(/\.wt$/i, ''),
      songs: parsed['songs'] as ParsedSong[],
    };
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
