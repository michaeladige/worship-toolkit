import { Injectable } from '@angular/core';

const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATS  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

// Keys that prefer flats
const FLAT_KEYS = new Set(['F','Bb','Eb','Ab','Db','Gb','Dm','Gm','Cm','Fm','Bbm','Ebm']);

// Quality alternatives ordered longest-first so "maj" beats "m", etc.
const CHORD_RE =
  /^([A-G][b#]?)(maj|min|dim|aug|m|M)?(\d+)?(\([0-9]+\))?(sus\d*|add\d*)?(\/[A-G][b#]?)?$/;

@Injectable({ providedIn: 'root' })
export class ChordService {

  isChord(token: string): boolean {
    return CHORD_RE.test(token.trim());
  }

  /** Check if a line of space-separated tokens is primarily chords */
  isChordLine(line: string): boolean {
    // Remove multi-word parenthesized direction annotations before splitting.
    // "(To Tag)", "(To Interlude 1a)", "(Last time)" etc. are single PDF items
    // whose internal spaces would otherwise break into non-chord tokens.
    // Chord extensions like "Eb(4)" are safe: their parens contain no space.
    const cleaned = line.replace(/\([^)]*\s[^)]*\)/g, '');

    const tokens = cleaned.trim().split(/\s+/).filter(t => t.length > 0);
    if (tokens.length === 0) return false;

    const SKIP = new Set(['|', '||', '||:', ':|:', ':|', ':||', '(', ')']);
    // Single-token annotations: (1.) (2.) *, dashes, standalone numbers/letters like "1" "1A",
    // and dots used as beat placeholders in bar notation (e.g. "| Eb . . Gm |")
    const ANN_RE = /^\(.*\)$|^\*|^[0-9]+\.$|^-+$|^\[.*\]$|^\d+[A-Za-z]?$|^\.+$/;
    // Section-name keywords that can appear inline on chord lines (e.g. "F TAG", "C VERSE 3")
    const SEC_RE = /^(VERSE|CHORUS|PRE-?CHORUS|PRE|BRIDGE|INTRO|OUTRO|TAG|ENDING|INTERLUDE|INSTRUMENTAL|CODA|VAMP)$/i;

    let chordCount = 0;
    let nonChordCount = 0;
    for (const t of tokens) {
      if (SKIP.has(t) || ANN_RE.test(t) || SEC_RE.test(t)) continue;
      if (this.isChord(t)) chordCount++;
      else nonChordCount++;
    }
    return chordCount > 0 && nonChordCount === 0;
  }

  parseChord(chord: string): { root: string; suffix: string; bass: string | null } | null {
    const m = chord.match(CHORD_RE);
    if (!m) return null;
    const root = m[1];
    // groups: [2]=quality, [3]=digits, [4]=parens, [5]=sus/add, [6]=bass
    const suffix = ((m[2] ?? '') + (m[3] ?? '') + (m[4] ?? '') + (m[5] ?? '')).trim();
    const bass = m[6] ? m[6].slice(1) : null; // strip leading "/"
    return { root, suffix, bass };
  }

  private noteToIndex(note: string): number {
    let idx = SHARPS.indexOf(note);
    if (idx === -1) idx = FLATS.indexOf(note);
    return idx;
  }

  private preferFlat(key: string): boolean {
    return FLAT_KEYS.has(key);
  }

  transposeNote(note: string, semitones: number, useFlats: boolean): string {
    const idx = this.noteToIndex(note);
    if (idx === -1) return note;
    const newIdx = ((idx + semitones) % 12 + 12) % 12;
    return useFlats ? FLATS[newIdx] : SHARPS[newIdx];
  }

  transposeChord(chord: string, semitones: number, targetKey: string): string {
    if (semitones === 0) return chord;
    const parsed = this.parseChord(chord);
    if (!parsed) return chord;
    const flat = this.preferFlat(targetKey);
    const newRoot = this.transposeNote(parsed.root, semitones, flat);
    const newBass = parsed.bass ? '/' + this.transposeNote(parsed.bass, semitones, flat) : '';
    return newRoot + parsed.suffix + newBass;
  }

  /** Transpose full key string e.g. "C" → "D" when +2 semitones */
  transposeKey(key: string, semitones: number): string {
    const idx = this.noteToIndex(key);
    if (idx === -1) return key;
    const newIdx = ((idx + semitones) % 12 + 12) % 12;
    // Determine if the new key prefers flats
    const newKeySharp = SHARPS[newIdx];
    const newKeyFlat = FLATS[newIdx];
    // Try sharp first, fall back to flat if not in flat preference list
    return this.preferFlat(newKeySharp) ? newKeyFlat : newKeySharp;
  }

  getBassNote(chord: string): string {
    const parsed = this.parseChord(chord);
    if (!parsed) return chord;
    // If slash chord, bass is the bass note; otherwise it's the root
    return parsed.bass ?? parsed.root;
  }

  allKeys(): string[] {
    return ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  }

  // Transpose chord names embedded in an annotation string (bar notation, direction notes).
  // Splits on whitespace so each token is checked individually — non-chord tokens like
  // "|", ".", "(To", "Tag)" are passed through unchanged.
  transposeAnnotation(annotation: string, semitones: number, targetKey: string): string {
    if (semitones === 0) return annotation;
    return annotation
      .split(/(\s+)/)
      .map(token => this.isChord(token) ? this.transposeChord(token, semitones, targetKey) : token)
      .join('');
  }

  // Nashville Number System: convert a chord to scale-degree notation relative to key.
  // e.g. in key of C: Am7 → "6m7", F/C → "4/1", Bb → "b7"
  toNashville(chord: string, key: string): string {
    const DEGREES = ['1','b2','2','b3','3','4','b5','5','b6','6','b7','7'];
    const parsed = this.parseChord(chord);
    if (!parsed) return chord;
    const keyIdx = this.noteToIndex(key);
    const rootIdx = this.noteToIndex(parsed.root);
    if (keyIdx === -1 || rootIdx === -1) return chord;
    const degree = DEGREES[((rootIdx - keyIdx) + 12) % 12];
    let bassStr = '';
    if (parsed.bass) {
      const bassIdx = this.noteToIndex(parsed.bass);
      bassStr = bassIdx !== -1 ? '/' + DEGREES[((bassIdx - keyIdx) + 12) % 12] : '/' + parsed.bass;
    }
    return degree + parsed.suffix + bassStr;
  }

  semitonesBetween(fromKey: string, toKey: string): number {
    const from = this.noteToIndex(fromKey);
    const to = this.noteToIndex(toKey);
    if (from === -1 || to === -1) return 0;
    return ((to - from) + 12) % 12;
  }
}
