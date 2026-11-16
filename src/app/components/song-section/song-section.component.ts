import {
  Component, Input, Output, EventEmitter, ChangeDetectionStrategy,
  ElementRef, ViewChild, ViewChildren, QueryList, HostListener,
  AfterViewInit, OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  CdkDragDrop, CdkDropList, CdkDrag, CdkDragHandle, CdkDragPlaceholder,
  moveItemInArray, transferArrayItem,
} from '@angular/cdk/drag-drop';
import { ParsedSong, SongSection, SongLine, ChordToken, InkStroke } from '../../models/song.model';
import { ChordService } from '../../services/chord.service';
import { InkService } from '../../services/ink.service';
import { SelectionService } from '../../services/selection.service';
import { UiSettingsService } from '../../services/ui-settings.service';
import { AutofocusDirective } from '../../directives/autofocus.directive';
import { InkLayerDirective } from '../../directives/ink-layer.directive';
import { InkCapture, InkCaptureHost } from './ink-capture';

interface EditState {
  sectionIdx: number;
  lineIdx: number;
  chordIdx: number;
  value: string;
  pen?: boolean; // opened by a stylus tap — show the roomier handwriting-friendly box
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
  imports: [
    CommonModule, FormsModule, CdkDropList, CdkDrag, CdkDragHandle, CdkDragPlaceholder,
    AutofocusDirective, InkLayerDirective,
  ],
  templateUrl: './song-section.component.html',
  styleUrl: './song-section.component.scss',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class SongSectionComponent implements AfterViewInit, OnDestroy, InkCaptureHost {
  @Input() song!: ParsedSong;
  @Input() showSectionControls = false;
  @Input() viewOnly = false;
  @Input() splitColumns = false;
  @Output() songChange = new EventEmitter<ParsedSong>();
  @Output() addLine = new EventEmitter<number>();
  @Output() removeSection = new EventEmitter<number>();
  @Output() pasteLines = new EventEmitter<number>();

  @ViewChildren('chordRowRef') chordRowRefs!: QueryList<ElementRef<HTMLElement>>;
  @ViewChild('inkLivePath') private inkLivePath?: ElementRef<SVGPathElement>;

  editing: EditState | null = null;
  editingAnnotation: AnnotationEditState | null = null;
  chordDrag: ChordDrag | null = null;

  private inkCapture: InkCapture | null = null;

  constructor(
    public chordSvc: ChordService,
    public ui: UiSettingsService,
    public selection: SelectionService,
    public ink: InkService,
    private hostEl: ElementRef<HTMLElement>,
  ) {}

  ngAfterViewInit() {
    this.inkCapture = new InkCapture(
      this.hostEl.nativeElement,
      () => this.inkLivePath?.nativeElement,
      this,
    );
    this.inkCapture.attach();
  }

  ngOnDestroy() {
    this.inkCapture?.detach();
  }

  // ── Ink (InkCaptureHost) ────────────────────────────────────────────────────
  //
  // Ink is markup, not structure, so unlike every other edit here it is NOT
  // blocked by view-only: annotating the chart with a pen mid-rehearsal (in
  // stage mode, which turns view-only on) is the main use. Select mode does
  // block it — there a press means "tick this line".

  canInk(): boolean {
    return !this.selection.selectMode();
  }

  isLocked(): boolean {
    return this.locked;
  }

  strokesAt(si: number, li: number): readonly InkStroke[] {
    return this.song.sections[si]?.lines[li]?.ink ?? [];
  }

  commitStroke(si: number, li: number, stroke: InkStroke) {
    const song = this.cloneSong();
    const line = song.sections[si]?.lines[li];
    if (!line) return;
    line.ink = [...(line.ink ?? []), stroke];
    this.songChange.emit(song);
  }

  eraseStrokes(hits: { si: number; li: number; k: number }[]) {
    const song = this.cloneSong();
    const doomed = new Set(hits.map((h) => `${h.si}:${h.li}:${h.k}`));
    song.sections.forEach((sec, si) =>
      sec.lines.forEach((line, li) => {
        if (!line.ink) return;
        const kept = line.ink.filter((_, k) => !doomed.has(`${si}:${li}:${k}`));
        if (kept.length) line.ink = kept;
        else delete line.ink;
      }),
    );
    this.songChange.emit(song);
  }

  // Select mode suspends every editing affordance for the same reasons
  // viewOnly does, so the two collapse into one guard the template can use
  // everywhere viewOnly was checked before. It also means a pointerdown during
  // select mode never has to be arbitrated between chord drag, line drag, and
  // ticking a checkbox — only the checkbox is live.
  get locked(): boolean {
    return this.viewOnly || this.selection.selectMode();
  }

  get selectMode(): boolean {
    return this.selection.selectMode();
  }

  // True only when the clipboard holds lines, i.e. when a per-section
  // "Paste" button has something to offer.
  get canPasteLines(): boolean {
    return this.selection.clipboard()?.kind === 'lines';
  }

  // Every display helper takes the section the chord lives in, so a
  // modulated section (SongSection.key) spells and numbers its chords
  // against its own key — see ChordService.baseKey().
  displayAnnotation(annotation: string, section: SongSection): string {
    return this.chordSvc.displayAnnotation(annotation, this.song, this.ui.chordAccidentals, section);
  }

  displayChord(raw: string, section: SongSection): string {
    return this.chordSvc.displayChord(raw, this.song, this.ui.chordAccidentals, section);
  }

  // ── Modulation (per-section key) ────────────────────────────────────────────

  get allKeys(): string[] {
    return this.chordSvc.allKeys(this.ui.chordAccidentals);
  }

  /** The key a section currently sounds in (transpose applied), for its key picker. */
  sectionKey(section: SongSection): string {
    return this.chordSvc.effectiveKey(this.song, this.ui.chordAccidentals, section);
  }

  // Badge text for a section that modulates away from the one before it,
  // e.g. "Ab" or, with a capo, "Ab · play in G". Null = no key change here.
  keyChangeLabel(si: number): string | null {
    const sounding = this.chordSvc.keyChangeAt(this.song, si, this.ui.chordAccidentals);
    if (!sounding) return null;
    if (!this.song.capo || this.song.showNashville) return sounding;
    const shape = this.chordSvc.shapeKey(this.song, this.ui.chordAccidentals, this.song.sections[si]);
    return `${sounding} · ${this.ui.t('play in')} ${shape}`;
  }

  // "Modulate from here": re-keys this section AND every following section
  // that was in the same key as it, stopping at the next existing key change.
  // That's what a musician means by marking a modulation — the whole rest of
  // the song (up to any later change) moves — while still letting a single
  // section be changed when the next one already differs. The picked key is
  // in sounding terms (transpose applied), so undo the transpose to store it.
  setSectionKey(si: number, soundingKey: string) {
    if (this.locked) return;
    const song = this.cloneSong();
    const acc = this.ui.chordAccidentals;
    const newBase = this.chordSvc.transposeKey(soundingKey, -song.transposeSemitones, acc);
    const oldBase = this.chordSvc.baseKey(song, song.sections[si]);
    if (this.chordSvc.semitonesBetween(oldBase, newBase) === 0) return;
    const isSongKey = this.chordSvc.semitonesBetween(song.originalKey, newBase) === 0;
    for (let j = si; j < song.sections.length; j++) {
      const sec = song.sections[j];
      if (j > si && this.chordSvc.semitonesBetween(this.chordSvc.baseKey(song, sec), oldBase) !== 0) break;
      if (isSongKey) delete sec.key;
      else sec.key = newBase;
    }
    this.songChange.emit(song);
  }

  // ── Chord edit ──────────────────────────────────────────────────────────────

  // Set after a real drag completes, to swallow the native click that always
  // follows a mouseup/touchend on the same element — without this, finishing
  // a drag would immediately reopen the inline editor.
  private suppressNextClick = false;

  startEdit(si: number, li: number, ci: number) {
    if (this.locked) return;
    if (this.suppressNextClick) { this.suppressNextClick = false; return; }
    const raw = this.song.sections[si].lines[li].chords[ci].chord;
    this.editing = {
      sectionIdx: si,
      lineIdx: li,
      chordIdx: ci,
      value: this.editableValue(raw, si),
      pen: this.lastChordPointerType === 'pen',
    };
  }

  commitEdit() {
    if (!this.editing) return;
    const { sectionIdx, lineIdx, chordIdx, value } = this.editing;
    const song = this.cloneSong();
    const chord = song.sections[sectionIdx].lines[lineIdx].chords[chordIdx];
    chord.chord = this.storableValue(value, sectionIdx) || chord.chord;
    this.editing = null;
    this.songChange.emit(song);
  }

  cancelEdit() { this.editing = null; }

  // Chords are always stored in their original-key form (song.originalKey);
  // transposeSemitones is applied only for display. Bass-notes-only and
  // Nashville views are lossy (they discard the chord quality or rename the
  // root to a scale degree), so those must be edited via the raw text —
  // feeding a lossy display string back in as ground truth would corrupt the
  // stored chord. Plain transposed display, on the other hand, is reversible,
  // so the edit box shows/accepts the transposed value for a natural UX and
  // we convert back to original-key form on commit (see storableValue).
  private editableValue(raw: string, si: number): string {
    return (this.song.showBassNotesOnly || this.song.showNashville)
      ? raw
      : this.displayChord(raw, this.song.sections[si]);
  }

  private storableValue(typed: string, si: number): string {
    const trimmed = typed.trim();
    if (!trimmed || this.song.showBassNotesOnly || this.song.showNashville) return trimmed;
    return this.chordSvc.storableChord(trimmed, this.song, this.ui.chordAccidentals, this.song.sections[si]);
  }

  editKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); this.commitEdit(); }
    if (e.key === 'Escape') { this.cancelEdit(); }
  }

  // ── Chord CRUD ──────────────────────────────────────────────────────────────

  addChord(si: number, li: number) {
    if (this.locked) return;
    const song = this.cloneSong();
    const line = song.sections[si].lines[li];
    // Place new chord after the last existing chord, or at 0
    const lastCharPos = line.chords.length > 0
      ? Math.max(...line.chords.map(c => c.charPos ?? 0)) + 4
      : 0;
    line.chords.push({ chord: 'C', xPercent: 0, charPos: lastCharPos });
    const ci = line.chords.length - 1;
    this.songChange.emit(song);
    this.editing = { sectionIdx: si, lineIdx: li, chordIdx: ci, value: this.editableValue('C', si) };
  }

  removeChord(si: number, li: number, ci: number) {
    if (this.locked) return;
    const song = this.cloneSong();
    song.sections[si].lines[li].chords.splice(ci, 1);
    this.songChange.emit(song);
  }

  removeLine(si: number, li: number) {
    if (this.locked) return;
    const song = this.cloneSong();
    song.sections[si].lines.splice(li, 1);
    // Keep at least one empty line in the section
    if (song.sections[si].lines.length === 0) {
      song.sections[si].lines.push({ chords: [], lyric: '', isChordsOnly: false });
    }
    this.songChange.emit(song);
  }

  editLyric(si: number, li: number, value: string) {
    if (this.locked) return;
    const song = this.cloneSong();
    song.sections[si].lines[li].lyric = value;
    this.songChange.emit(song);
  }

  // ── Annotation CRUD ──────────────────────────────────────────────────────────

  startEditAnnotation(si: number, li: number) {
    if (this.locked) return;
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
    if (this.locked) return;
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
  //
  // Split-column view used to render every section into ONE cdkDropList and rely
  // on plain CSS `column-count` to lay them out visually in two newspaper-style
  // columns. That broke drag-and-drop: cdkDropList's sort algorithm assumes items
  // are laid out along one axis in DOM order, but CSS multi-column reflows DOM
  // order into a visually non-adjacent grid (item N sits at the bottom of column
  // 1, item N+1 jumps to the top of column 2), so dragging across the column
  // boundary landed the item somewhere unrelated to where the cursor was.
  //
  // Fixed by actually splitting song.sections into two real arrays/drop-lists —
  // one per visual column — connected via cdkDropListConnectedTo, so each column
  // is its own correctly-ordered vertical list and CDK's sort math applies per
  // column, with connectedTo handling the cross-column transfer.

  // Memoized on (sections reference, splitColumns) so the exact same column
  // array instances are bound in the template across repeated reads within a
  // render — dropSection() below relies on identity to map an event's container
  // back to a column index. Sections aren't split evenly by rendered height (that
  // needs a real layout pass); an equal-count split is a simple, deterministic
  // stand-in that's good enough for reordering purposes.
  private columnsCache: { sections: SongSection[]; split: boolean; value: SongSection[][] } | null = null;

  get columns(): SongSection[][] {
    const sections = this.song.sections;
    if (this.columnsCache && this.columnsCache.sections === sections && this.columnsCache.split === this.splitColumns) {
      return this.columnsCache.value;
    }
    const mid = Math.ceil(sections.length / 2);
    const value = this.splitColumns
      ? [sections.slice(0, mid), sections.slice(mid)]
      : [sections.slice()];
    this.columnsCache = { sections, split: this.splitColumns, value };
    return value;
  }

  columnId(colIdx: number): string {
    return `section-col-${colIdx}`;
  }

  connectedColumnIds(colIdx: number): string[] {
    return this.columns.map((_, i) => this.columnId(i)).filter((_, i) => i !== colIdx);
  }

  sectionIndex(section: SongSection): number {
    return this.song.sections.indexOf(section);
  }

  dropSection(event: CdkDragDrop<SongSection[]>) {
    const prevColIdx = this.columns.findIndex(c => c === event.previousContainer.data);
    const currColIdx = this.columns.findIndex(c => c === event.container.data);
    if (prevColIdx === currColIdx && event.previousIndex === event.currentIndex) return;

    // Work on arrays derived from a fresh clone, never the live template-bound
    // `columns` (which alias this.song.sections) — mutating those in place would
    // corrupt the pre-edit state still referenced by the undo stack.
    const song = this.cloneSong();
    const mid = Math.ceil(song.sections.length / 2);
    const cols = this.splitColumns
      ? [song.sections.slice(0, mid), song.sections.slice(mid)]
      : [song.sections.slice()];

    if (prevColIdx === currColIdx) {
      moveItemInArray(cols[currColIdx], event.previousIndex, event.currentIndex);
    } else {
      transferArrayItem(cols[prevColIdx], cols[currColIdx], event.previousIndex, event.currentIndex);
    }

    song.sections = cols.flat();
    this.songChange.emit(song);
  }

  // ── Line drag-drop reorder ───────────────────────────────────────────────────
  //
  // Each section's lines are their own cdkDropList, all cross-connected so a
  // line can be dragged into a different section. Unlike the section lists
  // above, these bind the section INDEX as their data rather than the array
  // itself — dropLine() then needs no identity mapping back to a container, so
  // there's no equivalent of the columnsCache memoization to keep in step.
  //
  // Deliberately not cdkDropListGroup: that would also connect these lists to
  // the .section-column lists above them, making it possible to drop a whole
  // section into a line list.

  lineListId(si: number): string {
    return `line-list-${si}`;
  }

  connectedLineListIds(si: number): string[] {
    return this.song.sections.map((_, i) => this.lineListId(i)).filter((_, i) => i !== si);
  }

  dropLine(event: CdkDragDrop<number>) {
    const fromSi = event.previousContainer.data;
    const toSi = event.container.data;
    if (fromSi === toSi && event.previousIndex === event.currentIndex) return;

    // Indices are measured against the live arrays but applied to a structurally
    // identical clone, exactly as dropSection() does — never mutate the arrays
    // the undo stack still points at.
    const song = this.cloneSong();
    if (fromSi === toSi) {
      moveItemInArray(song.sections[fromSi].lines, event.previousIndex, event.currentIndex);
    } else {
      transferArrayItem(
        song.sections[fromSi].lines,
        song.sections[toSi].lines,
        event.previousIndex,
        event.currentIndex,
      );
      // Same invariant removeLine() keeps: a section never ends up with no lines.
      if (song.sections[fromSi].lines.length === 0) {
        song.sections[fromSi].lines.push({ chords: [], lyric: '', isChordsOnly: false });
      }
    }
    this.songChange.emit(song);
  }

  // ── Chord horizontal drag (reposition charPos) ──────────────────────────────

  // How the last chord press was made, so a stylus tap can open the roomier,
  // select-all edit box that handwriting input (iPad Scribble, Windows Ink)
  // needs to replace a chord in one go.
  private lastChordPointerType = '';

  startChordDrag(e: PointerEvent, si: number, li: number, ci: number, rowEl: HTMLElement) {
    this.lastChordPointerType = e.pointerType;
    if (this.locked) return;
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
    const section = this.song.sections[si];
    const key = [
      this.song.transposeSemitones,
      this.chordSvc.effectiveKey(this.song, this.ui.chordAccidentals, section),
      this.ui.chordAccidentals,
      this.song.showBassNotesOnly,
      this.song.showNashville,
      this.song.capo ?? 0,
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
      return { charPos, len: this.displayChord(ct.chord, section).length, i };
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

  // No font-family/font-size set here — the probe inherits both from rowEl
  // (the real .chord-row), so it always measures whichever chord font and
  // text-size preference is actually active, not a hardcoded assumption.
  private measureChPx(rowEl: HTMLElement): number {
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;width:1ch;';
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

  trackLine(i: number, _: SongLine) { return i; }
  trackChord(i: number, _: ChordToken) { return i; }
}
