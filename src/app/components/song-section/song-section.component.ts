import {
  Component, Input, Output, EventEmitter, ChangeDetectionStrategy,
  ElementRef, ViewChildren, QueryList, HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  CdkDragDrop, CdkDropList, CdkDrag, CdkDragHandle, moveItemInArray
} from '@angular/cdk/drag-drop';
import { ParsedSong, SongSection, SongLine, ChordToken } from '../../models/song.model';
import { ChordService } from '../../services/chord.service';

interface EditState {
  sectionIdx: number;
  lineIdx: number;
  chordIdx: number;
  value: string;
}

interface ChordDrag {
  si: number;
  li: number;
  ci: number;
  startX: number;
  startCharPos: number;
  chPx: number;  // pixel width of 1ch in the chord-row font
  currentCharPos: number;
  moved: boolean; // true once mouse has moved beyond click threshold
}

@Component({
  selector: 'app-song-section',
  standalone: true,
  imports: [CommonModule, FormsModule, CdkDropList, CdkDrag, CdkDragHandle],
  templateUrl: './song-section.component.html',
  styleUrl: './song-section.component.scss',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class SongSectionComponent {
  @Input() song!: ParsedSong;
  @Input() showSectionControls = false;
  @Output() songChange = new EventEmitter<ParsedSong>();
  @Output() addLine = new EventEmitter<number>();
  @Output() removeSection = new EventEmitter<number>();

  @ViewChildren('chordRowRef') chordRowRefs!: QueryList<ElementRef<HTMLElement>>;

  editing: EditState | null = null;
  chordDrag: ChordDrag | null = null;

  constructor(public chordSvc: ChordService) {}

  get effectiveKey(): string {
    return this.chordSvc.transposeKey(this.song.originalKey, this.song.transposeSemitones);
  }

  displayAnnotation(annotation: string): string {
    return this.chordSvc.transposeAnnotation(annotation, this.song.transposeSemitones, this.effectiveKey);
  }

  displayChord(raw: string): string {
    const transposed = this.chordSvc.transposeChord(raw, this.song.transposeSemitones, this.effectiveKey);
    const display = this.song.showBassNotesOnly ? this.chordSvc.getBassNote(transposed) : transposed;
    return this.song.showNashville ? this.chordSvc.toNashville(display, this.effectiveKey) : display;
  }

  // ── Chord edit ──────────────────────────────────────────────────────────────

  startEdit(si: number, li: number, ci: number, currentDisplay: string) {
    this.editing = { sectionIdx: si, lineIdx: li, chordIdx: ci, value: currentDisplay };
  }

  commitEdit() {
    if (!this.editing) return;
    const { sectionIdx, lineIdx, chordIdx, value } = this.editing;
    const song = this.cloneSong();
    song.sections[sectionIdx].lines[lineIdx].chords[chordIdx].chord =
      value.trim() || song.sections[sectionIdx].lines[lineIdx].chords[chordIdx].chord;
    this.editing = null;
    this.songChange.emit(song);
  }

  cancelEdit() { this.editing = null; }

  editKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); this.commitEdit(); }
    if (e.key === 'Escape') { this.cancelEdit(); }
  }

  // ── Chord CRUD ──────────────────────────────────────────────────────────────

  addChord(si: number, li: number) {
    const song = this.cloneSong();
    const line = song.sections[si].lines[li];
    // Place new chord after the last existing chord, or at 0
    const lastCharPos = line.chords.length > 0
      ? Math.max(...line.chords.map(c => c.charPos ?? 0)) + 4
      : 0;
    line.chords.push({ chord: 'C', xPercent: 0, charPos: lastCharPos });
    const ci = line.chords.length - 1;
    this.songChange.emit(song);
    this.editing = { sectionIdx: si, lineIdx: li, chordIdx: ci, value: 'C' };
  }

  removeChord(si: number, li: number, ci: number) {
    const song = this.cloneSong();
    song.sections[si].lines[li].chords.splice(ci, 1);
    this.songChange.emit(song);
  }

  removeLine(si: number, li: number) {
    const song = this.cloneSong();
    song.sections[si].lines.splice(li, 1);
    // Keep at least one empty line in the section
    if (song.sections[si].lines.length === 0) {
      song.sections[si].lines.push({ chords: [], lyric: '', isChordsOnly: false });
    }
    this.songChange.emit(song);
  }

  editLyric(si: number, li: number, value: string) {
    const song = this.cloneSong();
    song.sections[si].lines[li].lyric = value;
    this.songChange.emit(song);
  }

  // ── Section drag-drop reorder ────────────────────────────────────────────────

  dropSection(event: CdkDragDrop<SongSection[]>) {
    if (event.previousIndex === event.currentIndex) return;
    const song = this.cloneSong();
    moveItemInArray(song.sections, event.previousIndex, event.currentIndex);
    this.songChange.emit(song);
  }

  // ── Chord horizontal drag (reposition charPos) ──────────────────────────────

  startChordDrag(e: MouseEvent, si: number, li: number, ci: number, rowEl: HTMLElement) {
    // Don't start a drag if we're already editing this chord
    if (this.isEditing(si, li, ci)) return;
    e.preventDefault();
    const chPx = this.measureChPx(rowEl);
    this.chordDrag = {
      si, li, ci,
      startX: e.clientX,
      startCharPos: this.song.sections[si].lines[li].chords[ci].charPos ?? 0,
      chPx,
      currentCharPos: this.song.sections[si].lines[li].chords[ci].charPos ?? 0,
      moved: false,
    };
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(e: MouseEvent) {
    if (!this.chordDrag) return;
    const deltaX = e.clientX - this.chordDrag.startX;
    // Only activate drag after moving more than 4px (avoids suppressing plain clicks)
    if (!this.chordDrag.moved && Math.abs(deltaX) < 4) return;
    this.chordDrag.moved = true;
    const deltaChar = Math.round(deltaX / this.chordDrag.chPx);
    this.chordDrag.currentCharPos = Math.max(0, this.chordDrag.startCharPos + deltaChar);
  }

  @HostListener('document:mouseup')
  onMouseUp() {
    if (!this.chordDrag) return;
    const { si, li, ci, currentCharPos, moved } = this.chordDrag;
    this.chordDrag = null;
    if (!moved) return; // was just a click → let the click handler open the editor
    const song = this.cloneSong();
    song.sections[si].lines[li].chords[ci].charPos = currentCharPos;
    this.songChange.emit(song);
  }

  // Return the visual left position: drag-preview during drag, normal otherwise
  chordLeft(line: SongLine, si: number, li: number, idx: number): string {
    const positions = this.resolveChordPositions(line, si, li);
    return positions[idx] + 'ch';
  }

  private resolveChordPositions(line: SongLine, si: number, li: number): number[] {
    const chords = line.chords.map((ct, i) => {
      let charPos = ct.charPos ?? 0;
      // Apply live drag preview for the chord being dragged
      if (
        this.chordDrag &&
        this.chordDrag.si === si &&
        this.chordDrag.li === li &&
        this.chordDrag.ci === i
      ) {
        charPos = this.chordDrag.currentCharPos;
      }
      return { charPos, len: this.displayChord(ct.chord).length, i };
    }).sort((a, b) => a.charPos - b.charPos);

    const result: number[] = new Array(line.chords.length);
    let cursor = 0;
    for (const entry of chords) {
      const pos = Math.max(cursor, entry.charPos);
      result[entry.i] = pos;
      cursor = pos + entry.len + 1;
    }
    return result;
  }

  private measureChPx(rowEl: HTMLElement): number {
    const probe = document.createElement('span');
    probe.style.cssText =
      'position:absolute;visibility:hidden;width:1ch;' +
      'font-family:"Courier New",Consolas,monospace;font-size:0.82rem';
    rowEl.appendChild(probe);
    const w = probe.getBoundingClientRect().width || 8;
    rowEl.removeChild(probe);
    return w;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private cloneSong(): ParsedSong {
    return JSON.parse(JSON.stringify(this.song));
  }

  isEditing(si: number, li: number, ci: number): boolean {
    return (
      this.editing?.sectionIdx === si &&
      this.editing?.lineIdx === li &&
      this.editing?.chordIdx === ci
    );
  }

  isDraggingChord(si: number, li: number, ci: number): boolean {
    return (
      !!this.chordDrag &&
      this.chordDrag.si === si &&
      this.chordDrag.li === li &&
      this.chordDrag.ci === ci
    );
  }

  trackSection(_: number, s: SongSection) { return s.name; }
  trackLine(i: number, _: SongLine) { return i; }
  trackChord(i: number, _: ChordToken) { return i; }
}
