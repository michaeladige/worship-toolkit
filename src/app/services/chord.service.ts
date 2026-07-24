import { Injectable } from '@angular/core';

export type Accidentals = 'auto' | 'sharps' | 'flats';

const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

// Keys that prefer flats (includes enharmonic sharps so transposeKey() always matches allKeys())
const FLAT_KEYS = new Set([
  'F',
  'Bb',
  'Eb',
  'Ab',
  'Db',
  'Gb',
  'C#',
  'D#',
  'G#',
  'A#',
  'Dm',
  'Gm',
  'Cm',
  'Fm',
  'Bbm',
  'Ebm',
]);

// Quality alternatives ordered longest-first so "maj" beats "m", etc. Case
// variants are spelled out explicitly for maj/min/dim/aug (SongSelect charts
// sometimes render "CMaj7"/"CDim") — deliberately NOT a blanket `i` flag,
// since that would blur the single-letter m/M minor-vs-major distinction.
const CHORD_RE =
  /^([A-G][b#]?)(maj|Maj|MAJ|min|Min|MIN|dim|Dim|DIM|aug|Aug|AUG|m|M)?(\d+)?((?:[#b]\d+)|(?:\d+\/\d+))?(\([0-9]+\))?(sus\d*|add\d*)?(\/[A-G][b#]?)?$/;

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

    const tokens = cleaned
      .trim()
      .split(/\s+/)
      .filter((t) => t.length > 0);
    if (tokens.length === 0) return false;

    const SKIP = new Set(['|', '||', '||:', ':|:', ':|', ':||', '(', ')']);
    // Single-token annotations: (1.) (2.) *, dashes, standalone numbers/letters like "1" "1A",
    // and dots used as beat placeholders in bar notation (e.g. "| Eb . . Gm |")
    const ANN_RE = /^\(.*\)$|^\*|^[0-9]+\.$|^-+$|^\[.*\]$|^\d+[A-Za-z]?$|^\.+$/;
    // Section-name keywords that can appear inline on chord lines (e.g. "F TAG", "C VERSE 3")
    const SEC_RE =
      /^(VERSE|CHORUS|PRE-?CHORUS|PRE|BRIDGE|INTRO|OUTRO|TAG|ENDING|INTERLUDE|INSTRUMENTAL|CODA|VAMP)$/i;

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
    // groups: [2]=quality, [3]=digits, [4]=altered/compound ext (b5/#9/6\/9), [5]=parens, [6]=sus/add, [7]=bass
    const suffix = (
      (m[2] ?? '') +
      (m[3] ?? '') +
      (m[4] ?? '') +
      (m[5] ?? '') +
      (m[6] ?? '')
    ).trim();
    const bass = m[7] ? m[7].slice(1) : null; // strip leading "/"
    return { root, suffix, bass };
  }

  private noteToIndex(note: string): number {
    let idx = SHARPS.indexOf(note);
    if (idx === -1) idx = FLATS.indexOf(note);
    return idx;
  }

  private preferFlat(key: string, accidentals: Accidentals = 'auto'): boolean {
    if (accidentals === 'sharps') return false;
    if (accidentals === 'flats') return true;
    return FLAT_KEYS.has(key);
  }

  transposeNote(note: string, semitones: number, useFlats: boolean): string {
    const idx = this.noteToIndex(note);
    if (idx === -1) return note;
    const newIdx = (((idx + semitones) % 12) + 12) % 12;
    return useFlats ? FLATS[newIdx] : SHARPS[newIdx];
  }

  transposeChord(
    chord: string,
    semitones: number,
    targetKey: string,
    accidentals: Accidentals = 'auto',
  ): string {
    const parsed = this.parseChord(chord);
    if (!parsed) return chord;
    // Preserve original spelling only when no transposition and in auto mode
    if (semitones === 0 && accidentals === 'auto') return chord;
    const flat = this.preferFlat(targetKey, accidentals);
    const newRoot = this.transposeNote(parsed.root, semitones, flat);
    const newBass = parsed.bass ? '/' + this.transposeNote(parsed.bass, semitones, flat) : '';
    return newRoot + parsed.suffix + newBass;
  }

  /** Transpose full key string e.g. "C" → "D" when +2 semitones */
  transposeKey(key: string, semitones: number, accidentals: Accidentals = 'auto'): string {
    const idx = this.noteToIndex(key);
    if (idx === -1) return key;
    const newIdx = (((idx + semitones) % 12) + 12) % 12;
    const newKeySharp = SHARPS[newIdx];
    const newKeyFlat = FLATS[newIdx];
    return this.preferFlat(newKeySharp, accidentals) ? newKeyFlat : newKeySharp;
  }

  getBassNote(chord: string): string {
    const parsed = this.parseChord(chord);
    if (!parsed) return chord;
    // If slash chord, bass is the bass note; otherwise it's the root
    return parsed.bass ?? parsed.root;
  }

  allKeys(accidentals: Accidentals = 'auto'): string[] {
    if (accidentals === 'sharps')
      return ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    if (accidentals === 'flats')
      return ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
    return ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']; // auto (conventional)
  }

  // Transpose chord names embedded in an annotation string (bar notation, direction notes).
  // Splits on whitespace so each token is checked individually — non-chord tokens like
  // "|", ".", "(To", "Tag)" are passed through unchanged.
  transposeAnnotation(
    annotation: string,
    semitones: number,
    targetKey: string,
    accidentals: Accidentals = 'auto',
  ): string {
    if (semitones === 0 && accidentals === 'auto') return annotation;
    return annotation
      .split(/(\s+)/)
      .map((token) => {
        // Strip a glued bar/repeat prefix (e.g. "|Am7") before checking/transposing,
        // matching how extractChords() strips the same prefix during PDF parsing —
        // otherwise a chord glued to "|" never matches isChord() and stays untransposed.
        const m = token.match(/^([|:]+\s*)(.*)$/);
        const prefix = m ? m[1] : '';
        const rest = m ? m[2] : token;
        return this.isChord(rest)
          ? prefix + this.transposeChord(rest, semitones, targetKey, accidentals)
          : token;
      })
      .join('');
  }

  // Nashville Number System: convert a chord to scale-degree notation relative to key.
  // e.g. in key of C: Am7 → "6m7", F/C → "4/1", Bb → "b7"
  toNashville(chord: string, key: string): string {
    const DEGREES = ['1', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7'];
    const parsed = this.parseChord(chord);
    if (!parsed) return chord;
    const keyIdx = this.noteToIndex(key);
    const rootIdx = this.noteToIndex(parsed.root);
    if (keyIdx === -1 || rootIdx === -1) return chord;
    const degree = DEGREES[(rootIdx - keyIdx + 12) % 12];
    let bassStr = '';
    if (parsed.bass) {
      const bassIdx = this.noteToIndex(parsed.bass);
      bassStr = bassIdx !== -1 ? '/' + DEGREES[(bassIdx - keyIdx + 12) % 12] : '/' + parsed.bass;
    }
    return degree + parsed.suffix + bassStr;
  }

  semitonesBetween(fromKey: string, toKey: string): number {
    const from = this.noteToIndex(fromKey);
    const to = this.noteToIndex(toKey);
    if (from === -1 || to === -1) return 0;
    return (to - from + 12) % 12;
  }

  // Best-effort guess of a chart's base key from the chords printed on it, for
  // charts that arrive without key metadata (some Ultimate Guitar imports, PDFs
  // missing the SongSelect "Key -" line). Returns a plain pitch string spelled
  // like allKeys('auto'), so the result is always a valid `originalKey`.
  detectKey(chords: string[]): string {
    // Major-scale pitch-class offsets from the tonic (also the natural-minor set
    // of the relative minor a minor-third below — that ambiguity is resolved in
    // stage 2 below).
    const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
    // allKeys('auto') spelling, indexed by pitch class.
    const SPELL = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

    const roots: number[] = [];
    let firstRoot = -1;
    let lastRoot = -1;
    // pitch class -> counts of that root appearing as a major vs minor chord
    const majorAt = new Array(12).fill(0);
    const minorAt = new Array(12).fill(0);
    for (const raw of chords) {
      const parsed = this.parseChord(raw);
      if (!parsed) continue;
      const pc = this.noteToIndex(parsed.root);
      if (pc === -1) continue;
      roots.push(pc);
      if (firstRoot === -1) firstRoot = pc;
      lastRoot = pc;
      // Minor = an "m" quality not followed into "maj". parseChord folds the
      // quality into `suffix`, so a leading lowercase "m" (but not "maj") marks it.
      if (/^m(?!aj)/.test(parsed.suffix)) minorAt[pc]++;
      else majorAt[pc]++;
    }
    if (roots.length === 0) return 'C';

    // Stage 1: pick the tonic whose major scale best covers the chord roots.
    let bestScore = -1;
    const bestTonics: number[] = [];
    for (let tonic = 0; tonic < 12; tonic++) {
      const scale = new Set(MAJOR_SCALE.map((d) => (tonic + d) % 12));
      const score = roots.reduce((n, pc) => n + (scale.has(pc) ? 1 : 0), 0);
      if (score > bestScore) {
        bestScore = score;
        bestTonics.length = 0;
        bestTonics.push(tonic);
      } else if (score === bestScore) {
        bestTonics.push(tonic);
      }
    }

    // Stage 2: within the best-fitting scale(s), decide the actual tonic. A major
    // key and its relative minor (tonic + 9) share the same scale, so score both
    // the major tonic and the relative minor of every best-scoring candidate and
    // pick the strongest. The tonic chord's own quality, the presence of its
    // dominant (a fifth up), and the first/last chords all point at it.
    const present = (pc: number): boolean => majorAt[pc] > 0 || minorAt[pc] > 0;
    const score = (pc: number, isMinor: boolean): number => {
      // Reward the candidate appearing in its expected quality most.
      let s = isMinor ? 3 * minorAt[pc] + majorAt[pc] : 3 * majorAt[pc] + minorAt[pc];
      if (present((pc + 7) % 12)) s += 2; // dominant a fifth above the tonic
      if (pc === lastRoot) s += 3; // songs usually resolve to the tonic
      if (pc === firstRoot) s += 2;
      if (!isMinor) s += 0.1; // break exact ties toward the (more common) major key
      return s;
    };
    let best = bestTonics[0];
    let bestRank = -1;
    for (const tonic of bestTonics) {
      for (const [pc, isMinor] of [
        [tonic, false],
        [(tonic + 9) % 12, true],
      ] as const) {
        const r = score(pc, isMinor);
        if (r > bestRank) {
          bestRank = r;
          best = pc;
        }
      }
    }
    return SPELL[best];
  }
}
