import { Injectable } from '@angular/core';
import { ChordService } from './chord.service';
import { ParsedSong, SongLine, SongSection, ChordToken } from '../models/song.model';

interface RawItem {
  text: string;
  x: number;
  y: number;
  width: number;
}

interface RawLine {
  items: RawItem[];
  y: number;
  text: string;
}

const SECTION_RE = /^(VERSE\s*\d*|CHORUS\s*\d*|PRE[-\s]?CHORUS\s*\d*|BRIDGE\s*\d*|INTRO|OUTRO|TAG|ENDING|INTERLUDE\s*\w*|INSTRUMENTAL|CODA|VAMP)\s*$/i;
const META_RE = /Key\s*[-–]\s*([A-G][b#]?)\s*\|.*Tempo\s*[-–]\s*(\d*)\s*\|.*Time\s*[-–]\s*([\d/]+)/i;
// Superscript suffixes that appear as separate PDF text items above the chord root
const SUPERSCRIPT_RE = /^(\d+|sus\d*|maj\d*|add\d*|dim|aug|m|\(\d+\))$/i;

@Injectable({ providedIn: 'root' })
export class PdfParserService {

  constructor(private chordSvc: ChordService) {}

  async parsePdf(file: File): Promise<ParsedSong[]> {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'assets/pdf.worker.mjs';

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    // Collect items per page separately (so we can detect song boundaries by page)
    const pages: { items: RawItem[]; height: number }[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1 });
      const textContent = await page.getTextContent();
      const pageHeight = viewport.height;
      const items: RawItem[] = [];

      for (const item of textContent.items) {
        if (!('str' in item) || !item.str.trim()) continue;
        const tx = item.transform as number[];
        items.push({
          text: item.str,
          x: +tx[4].toFixed(2),
          y: +(pageHeight - tx[5]).toFixed(2),
          width: +(item.width || 0).toFixed(2),
        });
      }
      pages.push({ items, height: pageHeight });
    }

    // Merge superscripts within each page before grouping into lines
    for (const page of pages) {
      this.mergeSuperscripts(page.items);
    }

    // Split pages into song blocks: a page that has a META_RE line starts a new song
    const songPageGroups: { items: RawItem[]; height: number }[][] = [];
    let current: { items: RawItem[]; height: number }[] = [];

    for (const page of pages) {
      const lines = this.groupIntoLines(page.items, 4);
      const hasMeta = lines.some(l => META_RE.test(l.text));

      if (hasMeta && current.length > 0) {
        songPageGroups.push(current);
        current = [];
      }
      current.push(page);
    }
    if (current.length > 0) songPageGroups.push(current);

    // Parse each song group
    const songs: ParsedSong[] = [];
    for (const group of songPageGroups) {
      // Flatten pages, adding a vertical offset between pages so y coords don't overlap
      const allItems: RawItem[] = [];
      let yOffset = 0;
      for (const page of group) {
        for (const item of page.items) {
          allItems.push({ ...item, y: item.y + yOffset });
        }
        yOffset += page.height + 20;
      }
      const song = this.parseSongItems(allItems);
      if (song) songs.push(song);
    }

    return songs;
  }

  // ── Superscript merging ──────────────────────────────────────────────────────
  // Chord roots (e.g. "Fm") and their suffixes (e.g. "7") appear as separate PDF
  // text items. The suffix floats 3-8 px above and starts right where the root ends:
  //   suffix.x ≈ root.x + root.width
  // We merge them in-place so downstream code sees "Fm7" as one item.
  private mergeSuperscripts(items: RawItem[]): void {
    const toRemove = new Set<RawItem>();

    for (const sup of items) {
      if (!SUPERSCRIPT_RE.test(sup.text.trim())) continue;

      // Find the chord root this superscript belongs to
      let best: RawItem | null = null;
      let bestDist = Infinity;

      for (const root of items) {
        if (root === sup || toRemove.has(root)) continue;
        // In top-down coordinates: superscript is visually above the chord root,
        // so superscript.y < root.y  → dy = root.y - sup.y is positive (1–9 px)
        const dy = root.y - sup.y;
        if (dy < 1 || dy > 9) continue;

        // x alignment: sup.x should be close to root.x + root.width
        const xDiff = Math.abs(sup.x - (root.x + root.width));
        if (xDiff > 6) continue;

        if (xDiff < bestDist) {
          bestDist = xDiff;
          best = root;
        }
      }

      if (best) {
        best.text = best.text + sup.text;
        best.width = best.width + sup.width;
        toRemove.add(sup);
      }
    }

    // Remove merged superscripts
    for (let i = items.length - 1; i >= 0; i--) {
      if (toRemove.has(items[i])) items.splice(i, 1);
    }
  }

  // ── Group items into lines by y-coordinate ───────────────────────────────────
  private groupIntoLines(items: RawItem[], tolerance = 4): RawLine[] {
    if (items.length === 0) return [];
    const sorted = [...items].sort((a, b) => a.y !== b.y ? a.y - b.y : a.x - b.x);
    const lines: RawLine[] = [];
    let group: RawItem[] = [sorted[0]];
    let groupY = sorted[0].y;

    for (let i = 1; i < sorted.length; i++) {
      if (Math.abs(sorted[i].y - groupY) <= tolerance) {
        group.push(sorted[i]);
      } else {
        lines.push(this.makeRawLine(group));
        group = [sorted[i]];
        groupY = sorted[i].y;
      }
    }
    lines.push(this.makeRawLine(group));
    return lines;
  }

  private makeRawLine(items: RawItem[]): RawLine {
    const sorted = [...items].sort((a, b) => a.x - b.x);
    let text = '';
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0) {
        const gap = sorted[i].x - (sorted[i - 1].x + sorted[i - 1].width);
        if (gap > 3) text += ' ';
      }
      text += sorted[i].text;
    }
    return { items: sorted, y: sorted[0].y, text: text.trim() };
  }

  // ── Parse a flat list of items (one song, possibly multi-page) ───────────────
  private parseSongItems(items: RawItem[]): ParsedSong | null {
    const lines = this.groupIntoLines(items, 4);
    if (lines.length < 3) return null;

    let title = '';
    let authors: string[] = [];
    let key = 'C';
    let tempo = '';
    let timeSignature = '4/4';
    let ccliNumber = '';
    let copyright = '';
    let contentStart = 0;

    // Parse header: title, authors, meta in first ~8 lines
    for (let i = 0; i < Math.min(8, lines.length); i++) {
      const text = lines[i].text.trim();
      const metaMatch = text.match(META_RE);
      if (metaMatch) {
        key = metaMatch[1];
        tempo = metaMatch[2] ?? '';
        timeSignature = metaMatch[3] ?? '4/4';
        contentStart = i + 1;
        break;
      }
      if (i === 0) {
        title = text;
      } else if (!text.match(/^\(as published|^\(based on/i)) {
        authors.push(text);
      }
    }

    // Footer: CCLI info
    for (let i = lines.length - 1; i >= Math.max(0, lines.length - 8); i--) {
      const t = lines[i].text;
      const m = t.match(/CCLI Song\s*#\s*(\d+)/i);
      if (m) { ccliNumber = m[1]; break; }
    }

    if (!title) return null;

    // Compute x-range for % positioning
    const allX = items.map(it => it.x);
    const minX = allX.length ? Math.min(...allX) : 40;
    const pageContentWidth = 520; // approx SongSelect content width in pts

    // Parse sections
    const sections: SongSection[] = [];
    let currentSection: SongSection | null = null;
    let pendingChordLine: RawLine | null = null;

    const getXPct = (x: number) =>
      Math.max(0, Math.min(100, ((x - minX) / pageContentWidth) * 100));

    for (let i = contentStart; i < lines.length; i++) {
      const line = lines[i];
      const text = line.text.trim();
      if (!text) continue;

      // Skip footer lines
      if (/CCLI Song|For use solely|©|www\.ccli|License #/i.test(text)) continue;

      // Key change annotation mid-song ("Key - D" etc.) — treat as separator comment
      if (/^Key\s*[-–]\s*[A-G][b#]?$/i.test(text)) {
        if (pendingChordLine && currentSection) {
          currentSection.lines.push(this.makeChordOnlyLine(pendingChordLine, getXPct));
          pendingChordLine = null;
        }
        continue;
      }

      // Section header
      if (SECTION_RE.test(text)) {
        if (pendingChordLine && currentSection) {
          currentSection.lines.push(this.makeChordOnlyLine(pendingChordLine, getXPct));
          pendingChordLine = null;
        }
        currentSection = { name: text.toUpperCase().trim(), lines: [] };
        sections.push(currentSection);
        continue;
      }

      if (!currentSection) {
        currentSection = { name: 'SONG', lines: [] };
        sections.push(currentSection);
      }

      // Is this line mostly chords?
      if (this.chordSvc.isChordLine(text)) {
        if (pendingChordLine) {
          // Two chord lines in a row → first is chord-only (interlude, bar line, etc.)
          currentSection.lines.push(this.makeChordOnlyLine(pendingChordLine, getXPct));
        }
        pendingChordLine = line;
      } else {
        // Lyric line
        const chords = pendingChordLine
          ? this.extractChords(pendingChordLine, getXPct)
          : [];
        currentSection.lines.push({ chords, lyric: text, isChordsOnly: false });
        pendingChordLine = null;
      }
    }

    if (pendingChordLine && currentSection) {
      currentSection.lines.push(this.makeChordOnlyLine(pendingChordLine, getXPct));
    }

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

  // ── Extract chord tokens from a chord line ───────────────────────────────────
  private extractChords(line: RawLine, getXPct: (x: number) => number): ChordToken[] {
    const tokens: ChordToken[] = [];
    for (const item of line.items) {
      const chord = item.text.trim();
      if (!chord) continue;
      // Skip bar-line tokens
      if (/^[|:]+$/.test(chord) || chord === '||:' || chord === ':||') continue;
      if (this.chordSvc.isChord(chord)) {
        tokens.push({ chord, xPercent: getXPct(item.x), charPos: 0 });
      }
    }
    return tokens;
  }

  private makeChordOnlyLine(line: RawLine, getXPct: (x: number) => number): SongLine {
    return { chords: this.extractChords(line, getXPct), lyric: '', isChordsOnly: true };
  }
}
