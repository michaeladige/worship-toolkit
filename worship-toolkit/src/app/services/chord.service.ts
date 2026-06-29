import { Injectable } from '@angular/core';

const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATS  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

// Keys that prefer flats
const FLAT_KEYS = new Set(['F','Bb','Eb','Ab','Db','Gb','Dm','Gm','Cm','Fm','Bbm','Ebm']);

// Regex to match a single chord root + optional modifier
const CHORD_RE =
  /^([A-G][b#]?)((?:maj|min|sus|add|aug|dim|no|M)?[0-9]*)?((?:sus|add)[0-9]?)?(\([0-9]+\))?(?:\/([A-G][b#]?))?$/;

const NOTE_RE = /^[A-G][b#]?$/;

@Injectable({ providedIn: 'root' })
export class ChordService {

  isChord(token: string): boolean {
    return CHORD_RE.test(token.trim());
  }

  /** Check if a line of space-separated tokens is primarily chords */
  isChordLine(line: string): boolean {
    const tokens = line.trim().split(/\s+/).filter(t => t.length > 0);
    if (tokens.length === 0) return false;

    // Allow bar lines and annotation tokens
    const skipTokens = new Set(['|', '||', '||:', ':|:', ':|', ':||', '(', ')']);
    const annotationRe = /^\(.*\)$|^\*|^[0-9]+\.$|^-+$|^\[.*\]$/;

    let chordCount = 0;
    let nonChordCount = 0;
    for (const t of tokens) {
      if (skipTokens.has(t) || annotationRe.test(t)) continue;
      if (this.isChord(t)) {
        chordCount++;
      } else {
        nonChordCount++;
      }
    }
    return chordCount > 0 && nonChordCount === 0;
  }

  parseChord(chord: string): { root: string; suffix: string; bass: string | null } | null {
    const m = chord.match(CHORD_RE);
    if (!m) return null;
    const root = m[1];
    const suffix = ((m[2] ?? '') + (m[3] ?? '') + (m[4] ?? '')).trim();
    const bass = m[5] ?? null;
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
    const newBass = parsed.bass ? this.transposeNote(parsed.bass, semitones, flat) : null;
    return newRoot + parsed.suffix + (newBass ? '/' + newBass : '');
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

  semitonesBetween(fromKey: string, toKey: string): number {
    const from = this.noteToIndex(fromKey);
    const to = this.noteToIndex(toKey);
    if (from === -1 || to === -1) return 0;
    return ((to - from) + 12) % 12;
  }
}
