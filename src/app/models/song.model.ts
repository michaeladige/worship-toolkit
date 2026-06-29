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
}
