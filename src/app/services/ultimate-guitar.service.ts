import { Injectable } from '@angular/core';
import { ChordService } from './chord.service';
import { ChordToken, ParsedSong, SongLine, SongSection } from '../models/song.model';

// Shape of the (small) slice of Ultimate Guitar's embedded `js-store` JSON we
// actually read. UG stuffs the whole page state into a `data-content` attribute
// on a `<div class="js-store">`; the raw chord chart lives at
// store.page.data.tab_view.wiki_tab.content and the song metadata at
// store.page.data.tab. Everything is optional because the markup is not a
// contract — we navigate defensively and fail with a friendly message.
interface UgTabMeta {
  song_name?: string;
  artist_name?: string;
  tonality_name?: string;
}
interface UgStore {
  store?: {
    page?: {
      data?: {
        tab?: UgTabMeta;
        tab_view?: { wiki_tab?: { content?: string } };
      };
    };
  };
}

// A single [ch] chord and the character column it sits at in the de-tagged line.
interface RawChord {
  chord: string;
  col: number;
}

// Public CORS proxies, tried in order. WorshipToolkit is a static client-only
// app, so it cannot fetch ultimate-guitar.com directly (no CORS headers, plus
// Cloudflare). These free/keyless proxies relay the request; any of them can be
// blocked or down at any time, hence the fallback chain + clear error handling.
const PROXIES: ((url: string) => string)[] = [
  u => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
  u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  u => `https://thingproxy.freeboard.io/fetch/${u}`,
];

const FETCH_TIMEOUT_MS = 15000;
const SECTION_LINE_RE = /^\[([^\]]+)\]$/;

@Injectable({ providedIn: 'root' })
export class UltimateGuitarService {
  constructor(private chordSvc: ChordService) {}

  /**
   * Fetch an ultimate-guitar.com chords page and convert it into the same
   * ParsedSong[] shape PdfParserService.parsePdf() returns, so it flows through
   * the existing upload/append pipeline unchanged.
   */
  async importFromUrl(url: string): Promise<ParsedSong[]> {
    const clean = url.trim();
    if (!this.isUltimateGuitarUrl(clean)) {
      throw new Error("That doesn't look like an Ultimate Guitar URL.");
    }

    const html = await this.fetchViaProxy(clean);
    const store = this.extractJsStore(html);
    const data = store.store?.page?.data;
    const content = data?.tab_view?.wiki_tab?.content;
    if (!content || typeof content !== 'string') {
      throw new Error("Couldn't read the chart from that page.");
    }

    const song = this.toSong(content, data?.tab ?? {});
    return [song];
  }

  /**
   * Import a batch of URLs sequentially. Public proxies + Cloudflare are
   * rate-sensitive, so requests are made one at a time (this also mirrors the
   * multi-PDF upload path and gives clean 1-of-N progress). A per-URL failure
   * never aborts the batch — it is collected in `errors` so the caller can
   * import every song that parsed and report the rest.
   */
  async importFromUrls(
    urls: string[],
    onProgress?: (done: number, total: number, url: string) => void,
  ): Promise<{ songs: ParsedSong[]; errors: { url: string; message: string }[] }> {
    const songs: ParsedSong[] = [];
    const errors: { url: string; message: string }[] = [];
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      onProgress?.(i, urls.length, url);
      try {
        songs.push(...(await this.importFromUrl(url)));
      } catch (err) {
        errors.push({
          url,
          message: err instanceof Error && err.message ? err.message : 'Import failed.',
        });
      }
    }
    onProgress?.(urls.length, urls.length, '');
    return { songs, errors };
  }

  /**
   * Sanitize arbitrary pasted text down to a deduped list of Ultimate Guitar
   * URLs. Handles clean one-per-line input as well as links buried in prose (a
   * chat message, an email, a set list): it grabs both scheme-qualified tokens
   * and bare `…ultimate-guitar.com/…` tokens, trims wrapping/trailing
   * punctuation, adds a missing scheme, and drops anything that isn't a UG URL.
   */
  extractUrls(text: string): string[] {
    if (!text) return [];
    const candidates = text.match(/https?:\/\/[^\s<>"'`)\]]+|(?:www\.|tabs\.)?ultimate-guitar\.com\/[^\s<>"'`)\]]+/gi) ?? [];
    const seen = new Set<string>();
    const urls: string[] = [];
    for (const raw of candidates) {
      // Strip trailing punctuation that commonly rides along in prose.
      const trimmed = raw.replace(/[.,;:!?)\]}>'"`]+$/, '');
      const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
      if (this.isUltimateGuitarUrl(withScheme) && !seen.has(withScheme)) {
        seen.add(withScheme);
        urls.push(withScheme);
      }
    }
    return urls;
  }

  private isUltimateGuitarUrl(url: string): boolean {
    try {
      const host = new URL(url).hostname;
      return /(^|\.)ultimate-guitar\.com$/i.test(host);
    } catch {
      return false;
    }
  }

  private async fetchViaProxy(url: string): Promise<string> {
    for (const build of PROXIES) {
      try {
        const html = await this.fetchWithTimeout(build(url));
        // A real UG page always carries the js-store blob; anything without it
        // is a proxy error page / Cloudflare challenge, so move on.
        if (html.includes('js-store')) return html;
      } catch {
        // Proxy unreachable or timed out — fall through to the next one.
      }
    }
    throw new Error("Couldn't reach Ultimate Guitar. The page may be blocked — try again.");
  }

  private async fetchWithTimeout(url: string): Promise<string> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } finally {
      clearTimeout(timer);
    }
  }

  private extractJsStore(html: string): UgStore {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    // Reading the attribute via the DOM un-escapes the HTML entities for us, so
    // the value is ready to JSON.parse.
    const content = doc.querySelector('.js-store')?.getAttribute('data-content');
    if (!content) throw new Error("Couldn't read the chart from that page.");
    try {
      return JSON.parse(content) as UgStore;
    } catch {
      throw new Error("Couldn't read the chart from that page.");
    }
  }

  // Convert UG's tagged chord text into a ParsedSong, mirroring the chord-over-
  // lyric reconstruction PdfParserService performs. UG content uses [ch]..[/ch]
  // around chords, [tab]..[/tab] block wrappers, and [Section] headers.
  private toSong(content: string, meta: UgTabMeta): ParsedSong {
    const lines = content
      .replace(/\r\n?/g, '\n')
      .replace(/\[\/?tab\]/g, '') // block wrappers carry no chart data
      .split('\n');

    const sections: SongSection[] = [];
    let current: SongSection | null = null;
    const ensureSection = (): SongSection => {
      // Content before any [Section] header goes in a synthetic 'SONG' section,
      // the same fallback the PDF parser uses.
      if (!current) {
        current = { name: 'SONG', lines: [] };
        sections.push(current);
      }
      return current;
    };

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const trimmed = raw.trim();
      if (trimmed === '') continue;

      const secMatch = trimmed.match(SECTION_LINE_RE);
      if (secMatch && !trimmed.includes('[ch]')) {
        current = { name: secMatch[1].toUpperCase(), lines: [] };
        sections.push(current);
        continue;
      }

      if (raw.includes('[ch]')) {
        const { chords: rawChords, text: chordText } = this.parseChordRow(raw);

        // The next line becomes the lyric only if it is real lyric text (not
        // another chord row, a section header, or blank).
        const next: string | undefined = lines[i + 1];
        const nextTrim = next?.trim() ?? '';
        const nextIsLyric =
          next !== undefined &&
          nextTrim !== '' &&
          !next.includes('[ch]') &&
          !SECTION_LINE_RE.test(nextTrim);
        const lyric = nextIsLyric ? next : '';
        if (nextIsLyric) i++; // consume the lyric line

        const refLen = Math.max(chordText.length, lyric.length, 1);
        const chords: ChordToken[] = rawChords
          .filter(c => c.chord.trim().length > 0)
          .map(c => ({
            chord: c.chord,
            charPos: c.col,
            xPercent: Math.min(100, (c.col / refLen) * 100),
          }));

        const line: SongLine = { chords, lyric, isChordsOnly: !nextIsLyric };
        ensureSection().lines.push(line);
        continue;
      }

      // Plain lyric line with no chords above it.
      ensureSection().lines.push({ chords: [], lyric: raw, isChordsOnly: false });
    }

    const key = meta.tonality_name?.trim() || 'C';
    return {
      id: crypto.randomUUID(),
      title: meta.song_name?.trim() || 'Untitled',
      authors: meta.artist_name?.trim() ? [meta.artist_name.trim()] : [],
      key,
      originalKey: key,
      tempo: '',
      timeSignature: '4/4',
      sections: sections.filter(s => s.lines.length > 0),
      transposeSemitones: 0,
      showBassNotesOnly: false,
    };
  }

  // Strip the [ch]..[/ch] tags from one line, returning the de-tagged text plus
  // each chord and the column it starts at — that column is the lyric character
  // offset the chord aligns over, exactly what ChordToken.charPos expects.
  private parseChordRow(raw: string): { chords: RawChord[]; text: string } {
    const chords: RawChord[] = [];
    let text = '';
    let last = 0;
    const re = /\[ch\](.*?)\[\/ch\]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
      text += raw.slice(last, m.index); // literal spacing before this chord
      const chord = m[1];
      // Keep whatever UG tagged as a chord; unknown tokens (e.g. "N.C.") pass
      // through the transposer untouched, so isChord is only a sanity signal.
      if (this.chordSvc.isChord(chord) || chord.trim().length > 0) {
        chords.push({ chord, col: text.length });
      }
      text += chord; // the chord renders as its own text in the de-tagged line
      last = re.lastIndex;
    }
    text += raw.slice(last);
    return { chords, text };
  }
}
