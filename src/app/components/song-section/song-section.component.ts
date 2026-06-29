import {
  Component, Input, Output, EventEmitter, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ParsedSong, SongSection, SongLine, ChordToken } from '../../models/song.model';
import { ChordService } from '../../services/chord.service';

interface EditState {
  sectionIdx: number;
  lineIdx: number;
  chordIdx: number;
  value: string;
}

@Component({
  selector: 'app-song-section',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './song-section.component.html',
  styleUrl: './song-section.component.scss',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class SongSectionComponent {
  @Input() song!: ParsedSong;
  @Output() songChange = new EventEmitter<ParsedSong>();

  editing: EditState | null = null;

  constructor(public chordSvc: ChordService) {}

  get effectiveKey(): string {
    return this.chordSvc.transposeKey(this.song.originalKey, this.song.transposeSemitones);
  }

  displayAnnotation(annotation: string): string {
    return this.chordSvc.transposeAnnotation(annotation, this.song.transposeSemitones, this.effectiveKey);
  }

  displayChord(raw: string): string {
    const transposed = this.chordSvc.transposeChord(raw, this.song.transposeSemitones, this.effectiveKey);
    return this.song.showBassNotesOnly ? this.chordSvc.getBassNote(transposed) : transposed;
  }

  startEdit(si: number, li: number, ci: number, currentDisplay: string) {
    this.editing = { sectionIdx: si, lineIdx: li, chordIdx: ci, value: currentDisplay };
  }

  commitEdit() {
    if (!this.editing) return;
    const { sectionIdx, lineIdx, chordIdx, value } = this.editing;
    const song = this.cloneSong();
    song.sections[sectionIdx].lines[lineIdx].chords[chordIdx].chord = value.trim() || song.sections[sectionIdx].lines[lineIdx].chords[chordIdx].chord;
    this.editing = null;
    this.songChange.emit(song);
  }

  cancelEdit() {
    this.editing = null;
  }

  editKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); this.commitEdit(); }
    if (e.key === 'Escape') { this.cancelEdit(); }
  }

  addChord(si: number, li: number) {
    const song = this.cloneSong();
    song.sections[si].lines[li].chords.push({ chord: 'C', xPercent: 0, charPos: 0 });
    this.songChange.emit(song);
    const ci = song.sections[si].lines[li].chords.length - 1;
    this.editing = { sectionIdx: si, lineIdx: li, chordIdx: ci, value: 'C' };
  }

  removeChord(si: number, li: number, ci: number) {
    const song = this.cloneSong();
    song.sections[si].lines[li].chords.splice(ci, 1);
    this.songChange.emit(song);
  }

  editLyric(si: number, li: number, value: string) {
    const song = this.cloneSong();
    song.sections[si].lines[li].lyric = value;
    this.songChange.emit(song);
  }

  private cloneSong(): ParsedSong {
    return JSON.parse(JSON.stringify(this.song));
  }

  isEditing(si: number, li: number, ci: number): boolean {
    return this.editing?.sectionIdx === si && this.editing?.lineIdx === li && this.editing?.chordIdx === ci;
  }

  // Returns the effective left position (in ch units) for chord at index `idx` in `line`,
  // adjusted so no chord visually overlaps the one before it.
  chordLeft(line: SongLine, idx: number): string {
    // Build sort order by charPos once per line, tracking original indices
    const order = line.chords
      .map((ct, i) => ({ charPos: ct.charPos ?? 0, len: this.displayChord(ct.chord).length, i }))
      .sort((a, b) => a.charPos - b.charPos);

    const result: number[] = new Array(line.chords.length);
    let cursor = 0;
    for (const entry of order) {
      const pos = Math.max(cursor, entry.charPos);
      result[entry.i] = pos;
      cursor = pos + entry.len + 1; // +1 gap between chords
    }
    return result[idx] + 'ch';
  }

  trackSection(_: number, s: SongSection) { return s.name; }
  trackLine(i: number, _: SongLine) { return i; }
  trackChord(i: number, _: ChordToken) { return i; }
}
