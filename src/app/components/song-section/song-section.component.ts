import {
  Component, Input, Output, EventEmitter, ChangeDetectionStrategy,
  ElementRef, ViewChildren, QueryList, HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  CdkDragDrop, CdkDropList, CdkDrag, CdkDragHandle, CdkDragPlaceholder, moveItemInArray
} from '@angular/cdk/drag-drop';
import { ParsedSong, SongSection, SongLine, ChordToken } from '../../models/song.model';
import { ChordService } from '../../services/chord.service';
import { UiSettingsService } from '../../services/ui-settings.service';
import { AutofocusDirective } from '../../directives/autofocus.directive';

interface EditState {
  sectionIdx: number;
  lineIdx: number;
  chordIdx: number;
  value: string;
}

interface AnnotationEditState {
  sectionIdx: number;
  lineIdx: number;
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
  imports: [CommonModule, FormsModule, CdkDropList, CdkDrag, CdkDragHandle, CdkDragPlaceholder, AutofocusDirective],
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
  editingAnnotation: AnnotationEditState | null = null;
  chordDrag: ChordDrag | null = null;

  constructor(public chordSvc: ChordService, public ui: UiSettingsService) {}

  get effectiveKey(): string {
    return this.chordSvc.transposeKey(this.song.originalKey, this.song.transposeSemitones, this.ui.chordAccidentals);
  }

  displayAnnotation(annotation: string): string {
    return this.chordSvc.transposeAnnotation(annotation, this.song.transposeSemitones, this.effectiveKey, this.ui.chordAccidentals);
  }

  displayChord(raw: string): string {
    const transposed = this.chordSvc.transposeChord(raw, this.song.transposeSemitones, this.effectiveKey, this.ui.chordAccidentals);
    const display = this.song.showBassNotesOnly ? this.chordSvc.getBassNote(transposed) : transposed;
    return this.song.showNashville ? this.chordSvc.toNashville(display, this.effectiveKey) : display;
  }

  // ── Chord edit ──────────────────────────────────────────────────────────────

  // Set after a real drag completes, to swallow the native click that always
  // follows a mouseup/touchend on the same element — without this, finishing
  // a drag would immediately reopen the inline editor.
  private suppressNextClick = false;

  startEdit(si: number, li: number, ci: number, currentDisplay: string) {
    if (this.suppressNextClick) { this.suppressNextClick = false; return; }
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

  // ── Annotation CRUD ──────────────────────────────────────────────────────────

  startEditAnnotation(si: number, li: number) {
    this.editingAnnotation = {
      sectionIdx: si,
      lineIdx: li,
      value: this.song.sections[si].lines[li].annotation ?? '',
    };
  }

  commitAnnotation() {
    if (!this.editingAnnotation) return;
    const { sectionIdx, lineIdx, value } = this.editingAnnotation;
    const song = this.cloneSong();
    song.sections[sectionIdx].lines[lineIdx].annotation = value.trim() || undefined;
    this.editingAnnotation = null;
    this.songChange.emit(song);
  }

  cancelAnnotation() {
    this.editingAnnotation = null;
  }

  annotationKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); this.commitAnnotation(); }
    if (e.key === 'Escape') { this.cancelAnnotation(); }
  }

  removeAnnotation(si: number, li: number) {
    const song = this.cloneSong();
    song.sections[si].lines[li].annotation = undefined;
    if (this.editingAnnotation?.sectionIdx === si && this.editingAnnotation?.lineIdx === li) {
      this.editingAnnotation = null;
    }
    this.songChange.emit(song);
  }

  isEditingAnnotation(si: number, li: number): boolean {
    return this.editingAnnotation?.sectionIdx === si && this.editingAnnotation?.lineIdx === li;
  }

  // ── Section drag-drop reorder ────────────────────────────────────────────────

  dropSection(event: CdkDragDrop<SongSection[]>) {
    if (event.previousIndex === event.currentIndex) return;
    const song = this.cloneSong();
    moveItemInArray(song.sections, event.previousIndex, event.currentIndex);
    this.songChange.emit(song);
  }

  // ── Chord horizontal drag (reposition charPos) ──────────────────────────────

  startChordDrag(e: PointerEvent, si: number, li: number, ci: number, rowEl: HTMLElement) {
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

  // Pointer Events unify mouse, touch, and pen — this is what makes chord
  // dragging work on phones/tablets, not just with a mouse.
  @HostListener('document:pointermove', ['$event'])
  onPointerMove(e: PointerEvent) {
    if (!this.chordDrag) return;
    const deltaX = e.clientX - this.chordDrag.startX;
    // Only activate drag after moving more than a few px (avoids suppressing plain taps/clicks)
    if (!this.chordDrag.moved && Math.abs(deltaX) < 6) return;
    this.chordDrag.moved = true;
    const deltaChar = Math.round(deltaX / this.chordDrag.chPx);
    this.chordDrag.currentCharPos = Math.max(0, this.chordDrag.startCharPos + deltaChar);
  }

  @HostListener('document:pointerup')
  @HostListener('document:pointercancel')
  onPointerUp() {
    if (!this.chordDrag) return;
    const { si, li, ci, currentCharPos, moved } = this.chordDrag;
    this.chordDrag = null;
    if (!moved) return; // was just a tap/click → let the click handler open the editor
    this.suppressNextClick = true; // the click that follows this mouseup/touchend isn't a tap
    const song = this.cloneSong();
    song.sections[si].lines[li].chords[ci].charPos = currentCharPos;
    this.songChange.emit(song);
  }

  // Return the visual left position: drag-preview during drag, normal otherwise
  chordLeft(line: SongLine, si: number, li: number, idx: number): string {
    const positions = this.resolveChordPositions(line, si, li);
    return positions[idx] + 'ch';
  }

  // Cached per line object: charPos/length only change when transpose, key,
  // accidentals, bass-notes/Nashville toggles, or (for the line being actively
  // dragged) the drag preview change — everything else re-renders this line's
  // chords unchanged, so recomputing all N positions on each of the N per-chord
  // bindings would be O(N²) work for an O(N) result.
  private positionsCache = new WeakMap<SongLine, { key: string; positions: number[] }>();

  private resolveChordPositions(line: SongLine, si: number, li: number): number[] {
    const dragging = this.chordDrag && this.chordDrag.si === si && this.chordDrag.li === li
      ? this.chordDrag
      : null;
    const key = [
      this.song.transposeSemitones,
      this.effectiveKey,
      this.ui.chordAccidentals,
      this.song.showBassNotesOnly,
      this.song.showNashville,
      dragging ? `${dragging.ci}:${dragging.currentCharPos}` : '',
    ].join('|');

    const cached = this.positionsCache.get(line);
    if (cached && cached.key === key) return cached.positions;

    const chords = line.chords.map((ct, i) => {
      let charPos = ct.charPos ?? 0;
      // Apply live drag preview for the chord being dragged
      if (dragging && dragging.ci === i) {
        charPos = dragging.currentCharPos;
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
    this.positionsCache.set(line, { key, positions: result });
    return result;
  }

  // Measures the actual rendered font (respects the user's font-family preference)
  // so the pixel↔ch drag conversion stays accurate for whichever font is active.
  private measureChPx(rowEl: HTMLElement): number {
    const computed = getComputedStyle(rowEl);
    const probe = document.createElement('span');
    probe.style.cssText =
      `position:absolute;visibility:hidden;width:1ch;` +
      `font-family:${computed.fontFamily};font-size:${computed.fontSize}`;
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

  trackSection(i: number, _: SongSection) { return i; }
  trackLine(i: number, _: SongLine) { return i; }
  trackChord(i: number, _: ChordToken) { return i; }
}
