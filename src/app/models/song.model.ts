export interface ChordToken {
  chord: string;
  xPercent: number; // 0-100, position within the line from PDF
  charPos?: number; // estimated character offset in lyric
}

// One freehand pen/highlighter stroke, anchored to the SongLine it was drawn
// on so it moves/copies/deletes with that line. Coordinates are relative to
// the top-left of the line's lyric row (its chord row for chords-only lines):
// x in `ch` (one monospace character column — the same unit chord charPos
// uses, so ink stays over the same characters at any text size and maps 1:1
// onto PDF export's monospace columns) and y in `em`. Negative y reaches up
// into the chord row; strokes may freely extend past the line's own box.
export interface InkStroke {
  tool: 'pen' | 'highlighter';
  color: string; // CSS hex, e.g. '#dc2626'
  width: number; // stroke width in em
  points: number[]; // flattened [x0, y0, x1, y1, …] in (ch, em)
}

export interface SongLine {
  chords: ChordToken[];
  lyric: string;
  isChordsOnly: boolean; // line with chords but no lyric (interlude bars, etc.)
  annotation?: string;   // direction notes from the chord line: "(To Tag)", "(1.)", etc.
  ink?: InkStroke[];
}

export interface SongSection {
  name: string;
  lines: SongLine[];
  // Modulation: the key this section is written in, when it differs from the
  // song's base key (originalKey). Stored in the same untransposed terms as
  // originalKey — transposeSemitones/capo shift it for display exactly like
  // the song key. Absent = the song's base key. Set on every section after a
  // key change (not just the first), so reordering, copying or deleting
  // sections can never silently move a modulation onto the wrong music.
  key?: string;
}

export interface SavedSession {
  id: string;
  name: string;
  savedAt: number; // Unix ms timestamp
  songs: ParsedSong[];
  language?: string;   // 'en' | 'la' | 'zh-TW' | 'id' | 'jv'
  latinMode?: boolean; // kept for migration of old saved sets
}

export interface ParsedSong {
  id: string;
  title: string;
  authors: string[];
  key: string;
  originalKey: string;
  tempo: string;
  timeSignature: string;
  sections: SongSection[];
  ccliNumber?: string;
  copyright?: string;
  transposeSemitones: number;
  showBassNotesOnly: boolean;
  showNashville?: boolean;
  capo?: number; // 0-11 fret; undefined/0 = no capo. Display-only — never changes the sounding key.
  showChordDiagrams?: boolean;
  notes?: string; // free-text arrangement/performance notes
  durationSeconds?: number; // optional, user-entered; powers the set PDF's estimated length
}
