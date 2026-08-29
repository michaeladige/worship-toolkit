// Computed guitar/ukulele chord-diagram fretting. Rather than a hand-curated
// table of shapes (error-prone to transcribe and hard to extend), a shape is
// derived from music theory directly: given the root and quality, find the
// lowest playable fret on each string whose sounded note is one of the
// chord's actual tones. This guarantees every diagram only ever shows real
// chord tones, and generalizes to any root/quality/instrument for free.

export type Instrument = 'guitar' | 'ukulele';

export interface ChordShapeDiagram {
  frets: number[]; // per string, low → high; -1 = muted, 0 = open
  fingers: number[]; // per string; 0 = open/muted
  baseFret: number; // fret shown at the top of the diagram (1 = nut/open position)
  barreFret?: number; // absolute fret of a barre across 2+ strings, if any
}

// Low → high open-string pitch classes (C = 0).
const GUITAR_TUNING = [4, 9, 2, 7, 11, 4]; // E A D G B E
const UKULELE_TUNING = [7, 0, 4, 9]; // G C E A (reentrant tuning; pitch class matching only)

// Semitone offsets from the root for each quality bucket a chord suffix
// normalizes into — enough for a helpful diagram, not a full voicing
// dictionary (extensions like 9/11/13 fold into the nearest bucket below).
const QUALITY_TONES: Record<string, number[]> = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  '7': [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  dim: [0, 3, 6],
};

// Collapse a parsed chord suffix (which can carry extensions like "13",
// "add9", "6/9") down to the nearest of the buckets above, so every
// real-world chord still gets a sensible diagram instead of no shape.
export function normalizeQuality(suffix: string): keyof typeof QUALITY_TONES {
  const s = suffix.toLowerCase();
  if (s.includes('dim')) return 'dim';
  if (s.includes('maj')) return 'maj7';
  if (s.includes('sus2')) return 'sus2';
  if (s.includes('sus')) return 'sus4';
  const isMinor = s.startsWith('m') && !s.startsWith('maj');
  const hasSeventhOrHigher = /7|9|11|13/.test(s);
  if (isMinor) return hasSeventhOrHigher ? 'm7' : 'm';
  return hasSeventhOrHigher ? '7' : '';
}

const NOTE_INDEX: Record<string, number> = {
  C: 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
};

function findShape(
  rootPc: number,
  quality: keyof typeof QUALITY_TONES,
  tuning: number[],
  bassOrdered: boolean,
): ChordShapeDiagram {
  const tones = new Set(
    (QUALITY_TONES[quality] ?? QUALITY_TONES['']).map((iv) => (rootPc + iv) % 12),
  );

  // Search a 4-fret window starting at `base`; when `allowOpen`, fret 0 is
  // also tried on every string (the classic first-position/open shape).
  const tryWindow = (base: number, allowOpen: boolean): number[] | null => {
    // Every playable fret per string, ascending — not just the lowest one:
    // picking only the lowest match up front can grab a non-root tone (say
    // the 7th at fret 2) and never even consider the root two frets later on
    // that same string, leaving the root out of the shape entirely.
    const candidates = tuning.map((openPc) => {
      const cands: number[] = [];
      if (allowOpen && tones.has(openPc)) cands.push(0);
      for (let f = base; f <= base + 3; f++) {
        if (tones.has((openPc + f) % 12)) cands.push(f);
      }
      return cands;
    });

    // Pick the lowest-pitched string that can carry the root at all, and
    // force it there — this is the one fret every other choice must respect.
    let rootStringIdx = -1;
    let rootFret = -1;
    for (let i = 0; i < tuning.length; i++) {
      const f = candidates[i].find((cand) => (tuning[i] + cand) % 12 === rootPc);
      if (f !== undefined) {
        rootStringIdx = i;
        rootFret = f;
        break;
      }
    }
    if (rootStringIdx === -1) return null; // root unreachable in this window

    const frets = candidates.map((cands, i) => (i === rootStringIdx ? rootFret : (cands[0] ?? -1)));
    const played = frets.filter((f) => f >= 0).length;
    return played >= 2 ? frets : null;
  };

  let baseFret = 1;
  let frets = tryWindow(1, true);

  if (!frets) {
    // No playable open-position shape — slide a movable window up to the
    // lowest fret where the root itself appears on some string.
    let rootFret = 12;
    for (const openPc of tuning) {
      for (let f = 1; f <= 11; f++) {
        if ((openPc + f) % 12 === rootPc) {
          rootFret = Math.min(rootFret, f);
          break;
        }
      }
    }
    baseFret = Math.max(1, Math.min(rootFret, 9));
    frets = tryWindow(baseFret, false);
  }

  if (!frets) {
    return { frets: tuning.map(() => -1), fingers: tuning.map(() => 0), baseFret: 1 };
  }

  // Mute any string below (lower-pitched than) the first string that carries
  // the root, unless that lower string happens to carry the root too. Without
  // this, a chord tone that isn't the root (e.g. open low E, the 5th of A
  // major) can end up sounding as the bass note — technically still a valid
  // voicing, but not the shape a guitarist expects to see, e.g. A rendering
  // as 002220 instead of the familiar x02220. Only meaningful for a tuning
  // whose string order is actually low-to-high in pitch (guitar); ukulele's
  // reentrant tuning (G is higher than C despite being listed first) has no
  // such "below" to speak of, so applying this would mute strings that are
  // correctly part of the standard voicing (e.g. the open G in a C chord).
  if (bassOrdered) {
    const rootStringIdx = frets.findIndex((f, i) => f >= 0 && (tuning[i] + f) % 12 === rootPc);
    if (rootStringIdx > 0) {
      for (let i = 0; i < rootStringIdx; i++) {
        if ((tuning[i] + frets[i]) % 12 !== rootPc) frets[i] = -1;
      }
    }
  }

  // Fret numbers relative to the window shown (1-based; 0 stays open/muted).
  const relFrets = frets.map((f) => (f > 0 ? f - baseFret + 1 : f));
  const distinctFretted = Array.from(new Set(relFrets.filter((f) => f > 0))).sort((a, b) => a - b);
  const fingerOf = new Map(distinctFretted.map((f, i) => [f, i + 1]));
  const fingers = relFrets.map((f) => (f > 0 ? fingerOf.get(f)! : 0));

  // A barre is drawn when 2+ strings share the lowest fretted position.
  const lowest = distinctFretted[0];
  const barreCount = lowest !== undefined ? relFrets.filter((f) => f === lowest).length : 0;
  const barreFret = barreCount >= 2 ? baseFret + lowest - 1 : undefined;

  return { frets, fingers, baseFret, barreFret };
}

// Fretting for a chord's upper structure (root + quality). Slash-chord bass
// notes are intentionally ignored — the diagram shows the shape a player's
// fretting hand actually forms, which is unaffected by which note the bass
// player (or a thumb-over-the-neck bass note) sounds underneath it.
export function chordShape(
  root: string,
  suffix: string,
  instrument: Instrument,
): ChordShapeDiagram | null {
  const rootPc = NOTE_INDEX[root];
  if (rootPc === undefined) return null;
  const quality = normalizeQuality(suffix);
  const isUkulele = instrument === 'ukulele';
  const tuning = isUkulele ? UKULELE_TUNING : GUITAR_TUNING;
  return findShape(rootPc, quality, tuning, !isUkulele);
}
