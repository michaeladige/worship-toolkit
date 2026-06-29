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
        const lyricLine = line.lyric;
        if (chordLine.trim()) lines.push(chordLine);
        if (lyricLine.trim()) lines.push(lyricLine);
        if (!chordLine.trim() && !lyricLine.trim()) lines.push('');
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
    return transposed;
  }

  async toPdf(songs: ParsedSong[]): Promise<void> {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });

    const margin = 40;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const colWidth = (pageWidth - margin * 2 - 10) / 2;
    const lineH = 11;
    const chordH = 10;
    const sectionGap = 14;
    const songGap = 30;
    const headerH = 60;

    for (let si = 0; si < songs.length; si++) {
      const song = songs[si];
      if (si > 0) doc.addPage();

      const effectiveKey = this.chordSvc.transposeKey(song.originalKey, song.transposeSemitones);

      // Header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text(song.title, margin, margin + 14);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      let authorY = margin + 26;
      for (const author of song.authors) {
        doc.text(author, margin, authorY);
        authorY += 10;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(`Key - ${effectiveKey} | Tempo - ${song.tempo} | Time - ${song.timeSignature}`, margin, authorY + 2);

      // Two-column layout for sections
      let col = 0;
      let y = margin + headerH;

      const colX = (c: number) => margin + c * (colWidth + 10);

      const newColumn = () => {
        if (col === 0) {
          col = 1;
          y = margin + headerH;
        } else {
          doc.addPage();
          col = 0;
          y = margin + 20;
        }
      };

      const ensureSpace = (needed: number) => {
        if (y + needed > pageHeight - margin) newColumn();
      };

      for (const section of song.sections) {
        // Estimate height needed
        let needed = sectionGap;
        for (const line of section.lines) {
          if (line.chords.length) needed += chordH;
          if (line.lyric) needed += lineH;
        }

        ensureSpace(needed);

        // Section label
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text(section.name, colX(col), y);
        y += sectionGap;

        for (const line of section.lines) {
          const chordRow = this.renderChordRow(line, song);

          if (chordRow.trim()) {
            ensureSpace(chordH + lineH);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.text(chordRow, colX(col), y, { maxWidth: colWidth });
            y += chordH;
          }

          if (line.lyric.trim()) {
            ensureSpace(lineH);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            const wrappedLines = doc.splitTextToSize(line.lyric, colWidth);
            doc.text(wrappedLines, colX(col), y);
            y += lineH * wrappedLines.length;
          }

          if (!chordRow.trim() && !line.lyric.trim()) y += lineH * 0.5;
        }

        y += sectionGap * 0.5;
      }

      // Footer
      if (song.ccliNumber) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.text(`CCLI Song # ${song.ccliNumber}`, pageWidth / 2, pageHeight - 20, { align: 'center' });
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
