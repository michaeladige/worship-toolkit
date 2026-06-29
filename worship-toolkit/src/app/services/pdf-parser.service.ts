import { Injectable } from '@angular/core';
import { ChordService } from './chord.service';
import { ParsedSong, SongLine, SongSection, ChordToken } from '../models/song.model';

interface TextItem {
  text: string;
  x: number;
  y: number;
  width: number;
}

interface RawLine {
  items: TextItem[];
  y: number;
  text: string;
}

// Section header patterns
const SECTION_RE = /^(VERSE\s*\d*|CHORUS\s*\d*|PRE[-\s]?CHORUS\s*\d*|BRIDGE\s*\d*|INTRO|OUTRO|TAG|ENDING|INTERLUDE\s*\w*|INSTRUMENTAL|CODA|VAMP|TURNAROUND)\s*$/i;

// Song metadata from header line e.g. "Key - C | Tempo - 82 | Time - 3/4"
const META_RE = /Key\s*[-–]\s*([A-G][b#]?)\s*(?:\|.*Tempo\s*[-–]\s*(\d+))?\s*(?:\|.*Time\s*[-–]\s*([\d/]+))?/i;

@Injectable({ providedIn: 'root' })
export class PdfParserService {

  constructor(private chordSvc: ChordService) {}

  async parsePdf(file: File): Promise<ParsedSong[]> {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'assets/pdf.worker.mjs';

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    // Collect all text items across all pages with their positions
    const allItems: TextItem[] = [];
    let pageOffsetY = 0;
    const PAGE_GAP = 20; // virtual gap between pages

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1 });
      const textContent = await page.getTextContent();

      const pageHeight = viewport.height;

      for (const item of textContent.items) {
        if ('str' in item && item.str.trim()) {
          const tx = item.transform as number[];
          const x = tx[4];
          // PDF y is bottom-up; convert to top-down within page
          const yOnPage = pageHeight - tx[5];
          allItems.push({
            text: item.str,
            x,
            y: pageOffsetY + yOnPage,
            width: item.width ?? 0,
          });
        }
      }
      pageOffsetY += pageHeight + PAGE_GAP;
    }

    // Group items into lines by y-coordinate (within 3pt tolerance)
    const rawLines = this.groupIntoLines(allItems);

    // Split into per-song blocks based on presence of "Key -" metadata line
    const songBlocks = this.splitIntoSongBlocks(rawLines);

    const songs: ParsedSong[] = [];
    for (const block of songBlocks) {
      const song = this.parseSongBlock(block);
      if (song) songs.push(song);
    }

    return songs;
  }

  private groupIntoLines(items: TextItem[]): RawLine[] {
    if (items.length === 0) return [];

    // Sort by y then x
    items.sort((a, b) => a.y !== b.y ? a.y - b.y : a.x - b.x);

    const lines: RawLine[] = [];
    let currentLine: TextItem[] = [items[0]];
    let currentY = items[0].y;

    for (let i = 1; i < items.length; i++) {
      if (Math.abs(items[i].y - currentY) < 3) {
        currentLine.push(items[i]);
      } else {
        lines.push(this.makeRawLine(currentLine));
        currentLine = [items[i]];
        currentY = items[i].y;
      }
    }
    lines.push(this.makeRawLine(currentLine));

    return lines;
  }

  private makeRawLine(items: TextItem[]): RawLine {
    items.sort((a, b) => a.x - b.x);
    // Join items, preserving x-gaps as spaces
    let text = '';
    for (let i = 0; i < items.length; i++) {
      if (i > 0) {
        const gap = items[i].x - (items[i - 1].x + items[i - 1].width);
        if (gap > 4) text += ' ';
      }
      text += items[i].text;
    }
    return { items, y: items[0].y, text };
  }

  private splitIntoSongBlocks(lines: RawLine[]): RawLine[][] {
    const blocks: RawLine[][] = [];
    let current: RawLine[] = [];

    for (const line of lines) {
      // A new song starts when we see a Key - X | Tempo - X | Time - X line
      if (META_RE.test(line.text) && current.length > 0) {
        // Walk back to find the title (lines before this meta line in current block)
        // actually meta line belongs to the NEW song block we're about to start
        // but title should already be in current. Let's split here.
        blocks.push(current);
        current = [];
      }
      current.push(line);
    }
    if (current.length > 0) blocks.push(current);

    return blocks.filter(b => b.length > 2);
  }

  private parseSongBlock(lines: RawLine[]): ParsedSong | null {
    if (lines.length === 0) return null;

    let title = '';
    let authors: string[] = [];
    let key = 'C';
    let tempo = '';
    let timeSignature = '4/4';
    let ccliNumber = '';
    let copyright = '';

    // Find title, authors, meta in first ~6 lines
    let contentStart = 0;
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const text = lines[i].text.trim();
      const metaMatch = text.match(META_RE);
      if (metaMatch) {
        key = metaMatch[1] ?? 'C';
        tempo = metaMatch[2] ?? '';
        timeSignature = metaMatch[3] ?? '4/4';
        contentStart = i + 1;
        break;
      }
      if (i === 0) {
        title = text;
      } else if (i < 4 && !text.startsWith('Key')) {
        // Author lines come after title
        if (text && !text.match(/^\(as published/i)) {
          authors.push(text);
        }
      }
    }

    // Find CCLI info at the bottom
    for (let i = lines.length - 1; i >= lines.length - 6 && i >= 0; i--) {
      const t = lines[i].text;
      const ccliMatch = t.match(/CCLI Song\s*#\s*(\d+)/i);
      if (ccliMatch) ccliNumber = ccliMatch[1];
      if (t.match(/©|Copyright|Words:|Music:/i)) copyright = t;
    }

    // Parse sections from contentStart onward
    const sections: SongSection[] = [];
    let currentSection: SongSection | null = null;
    let pendingChordLine: { items: TextItem[]; text: string; lineY: number } | null = null;

    // Get the x-range for percentage calculation
    const allX = lines.slice(contentStart).flatMap(l => l.items.map(it => it.x));
    const minX = allX.length ? Math.min(...allX) : 0;
    const maxX = allX.length ? Math.max(...allX) : 600;
    const xRange = maxX - minX || 600;

    for (let i = contentStart; i < lines.length; i++) {
      const line = lines[i];
      const text = line.text.trim();

      if (!text) continue;

      // Skip CCLI/copyright footer
      if (text.match(/CCLI Song|For use solely|©|www\.ccli/i)) continue;

      // Section header?
      if (SECTION_RE.test(text)) {
        if (pendingChordLine) {
          // chord line with no lyric below - add as chord-only line
          if (currentSection) {
            currentSection.lines.push(this.makeChordOnlyLine(pendingChordLine.items, minX, xRange));
          }
          pendingChordLine = null;
        }
        currentSection = { name: text.trim().toUpperCase(), lines: [] };
        sections.push(currentSection);
        continue;
      }

      // Key change annotation? e.g. "Key - D" appearing mid-song
      if (text.match(/^Key\s*[-–]\s*[A-G][b#]?$/i)) {
        if (pendingChordLine && currentSection) {
          currentSection.lines.push(this.makeChordOnlyLine(pendingChordLine.items, minX, xRange));
          pendingChordLine = null;
        }
        continue;
      }

      if (!currentSection) {
        currentSection = { name: 'SONG', lines: [] };
        sections.push(currentSection);
      }

      // Detect chord vs lyric line
      if (this.chordSvc.isChordLine(text)) {
        if (pendingChordLine) {
          // Two chord lines in a row → first one is chord-only
          currentSection.lines.push(this.makeChordOnlyLine(pendingChordLine.items, minX, xRange));
        }
        pendingChordLine = { items: line.items, text, lineY: line.y };
      } else {
        // Lyric line
        const chords = pendingChordLine
          ? this.extractChordPositions(pendingChordLine.items, text, minX, xRange)
          : [];
        currentSection.lines.push({ chords, lyric: text, isChordsOnly: false });
        pendingChordLine = null;
      }
    }

    // Flush any remaining chord line
    if (pendingChordLine && currentSection) {
      currentSection.lines.push(this.makeChordOnlyLine(pendingChordLine.items, minX, xRange));
    }

    if (!title) return null;

    return {
      id: crypto.randomUUID(),
      title,
      authors,
      key,
      originalKey: key,
      tempo,
      timeSignature,
      sections: sections.filter(s => s.lines.length > 0),
      ccliNumber,
      copyright,
      transposeSemitones: 0,
      showBassNotesOnly: false,
    };
  }

  private extractChordPositions(chordItems: TextItem[], lyric: string, minX: number, xRange: number): ChordToken[] {
    const tokens: ChordToken[] = [];

    // For each chord text item, compute xPercent
    // Then estimate character position in lyric
    const lyricMinX = chordItems.length > 0
      ? Math.min(...chordItems.map(it => it.x))
      : minX;

    // Group chord items into tokens (items that are close together = one chord)
    const chordGroups = this.groupChordItems(chordItems);

    for (const group of chordGroups) {
      const groupX = group[0].x;
      const chordText = group.map(it => it.text).join('');
      if (!this.chordSvc.isChord(chordText.trim())) continue;

      const xPercent = Math.max(0, Math.min(100, ((groupX - minX) / xRange) * 100));

      // Estimate char position based on x relative to lyric
      const charPos = this.xToCharPos(groupX, lyric);

      tokens.push({ chord: chordText.trim(), xPercent, charPos });
    }

    return tokens;
  }

  private groupChordItems(items: TextItem[]): TextItem[][] {
    if (items.length === 0) return [];
    const sorted = [...items].sort((a, b) => a.x - b.x);
    const groups: TextItem[][] = [[sorted[0]]];

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const gap = sorted[i].x - (prev.x + (prev.width || prev.text.length * 6));
      if (gap < 8) {
        groups[groups.length - 1].push(sorted[i]);
      } else {
        groups.push([sorted[i]]);
      }
    }
    return groups;
  }

  private xToCharPos(x: number, lyric: string): number {
    // Approximate: assume ~6.5px per character in the PDF's font
    const charWidth = 6.5;
    return Math.max(0, Math.round(x / charWidth));
  }

  private makeChordOnlyLine(items: TextItem[], minX: number, xRange: number): SongLine {
    const chordGroups = this.groupChordItems(items);
    const chords: ChordToken[] = [];

    for (const group of chordGroups) {
      const chordText = group.map(it => it.text).join('').trim();
      if (!chordText) continue;
      const xPercent = Math.max(0, Math.min(100, ((group[0].x - minX) / xRange) * 100));
      chords.push({ chord: chordText, xPercent, charPos: 0 });
    }

    return { chords, lyric: '', isChordsOnly: true };
  }
}
