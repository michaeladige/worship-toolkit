export interface ChordToken {
  chord: string;
  xPercent: number; // 0-100, position within the line from PDF
  charPos?: number; // estimated character offset in lyric
}

export interface SongLine {
  chords: ChordToken[];
  lyric: string;
  isChordsOnly: boolean; // line with chords but no lyric (interlude bars, etc.)
  annotation?: string;   // direction notes from the chord line: "(To Tag)", "(1.)", etc.
}

export interface SongSection {
  name: string;
  lines: SongLine[];
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
