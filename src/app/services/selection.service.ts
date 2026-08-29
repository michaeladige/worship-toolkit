import { Injectable, computed, signal } from '@angular/core';
import { ParsedSong, SongLine, SongSection } from '../models/song.model';

// What a copy put on the clipboard. Kinds never mix: a selection is either
// lines or sections (see the homogeneous-selection rule below), so a paste
// target always knows unambiguously what it's receiving.
export type ClipboardPayload =
  | { kind: 'lines'; lines: SongLine[]; fromSectionIdx: number }
  | { kind: 'sections'; sections: SongSection[] };

const BLANK_LINE = (): SongLine => ({ chords: [], lyric: '', isChordsOnly: false });

/**
 * Owns "select mode" — the transient multi-select state used for bulk
 * copy/duplicate/delete of lines and sections — plus the in-app clipboard.
 *
 * State lives here rather than in UiSettingsService (which is already ~3500
 * lines, mostly the translation table) but follows the same conventions:
 * `providedIn: 'root'`, signals for anything the template reads, and nothing
 * persisted — select mode and the clipboard are session-only, like stageMode
 * and viewOnly.
 *
 * The mutation helpers below are pure: they take the current song and return a
 * NEW deep-cloned song (or null for a no-op) rather than mutating in place.
 * That matters twice over — the undo stack still references the pre-edit
 * object graph (see SongSectionComponent.cloneSong), and it lets both callers
 * (the bulk-action bar in SongEditorComponent and the keyboard shortcuts in
 * WorkspaceComponent) share one implementation without either owning it.
 */
@Injectable({ providedIn: 'root' })
export class SelectionService {
  readonly selectMode = signal(false);

  // Lines are keyed `${sectionIdx}:${lineIdx}` rather than by object identity
  // or an id field. SongLine/SongSection have no id, and adding one would mean
  // migrating every existing localStorage session and .wt file for no gain
  // here: select mode suspends editing, so the structure can't shift underneath
  // a selection while it's held. The only structural change during select mode
  // is a bulk op, and each of those clears the selection afterwards.
  readonly selectedLines = signal<readonly string[]>([]);
  readonly selectedSections = signal<readonly number[]>([]);

  readonly clipboard = signal<ClipboardPayload | null>(null);

  readonly count = computed(() => this.selectedLines().length + this.selectedSections().length);
  readonly hasSelection = computed(() => this.count() > 0);

  // ── Mode ────────────────────────────────────────────────────────────────────

  enterSelectMode() {
    this.selectMode.set(true);
  }

  // Clears the selection but deliberately keeps the clipboard, so the
  // copy → leave select mode → switch song → paste flow works.
  exitSelectMode() {
    this.selectMode.set(false);
    this.clearSelection();
  }

  toggleSelectMode() {
    if (this.selectMode()) this.exitSelectMode();
    else this.enterSelectMode();
  }

  clearSelection() {
    this.selectedLines.set([]);
    this.selectedSections.set([]);
  }

  // ── Selection ───────────────────────────────────────────────────────────────

  private static lineKey(si: number, li: number): string {
    return `${si}:${li}`;
  }

  isLineSelected(si: number, li: number): boolean {
    return this.selectedLines().includes(SelectionService.lineKey(si, li));
  }

  isSectionSelected(si: number): boolean {
    return this.selectedSections().includes(si);
  }

  // A selection is homogeneous — all lines or all sections, never both. Mixing
  // them makes bulk delete ambiguous ("delete this section AND a line inside
  // it?"), so picking one kind simply drops the other.
  toggleLine(si: number, li: number) {
    const key = SelectionService.lineKey(si, li);
    const current = this.selectedLines();
    this.selectedSections.set([]);
    this.selectedLines.set(
      current.includes(key) ? current.filter(k => k !== key) : [...current, key],
    );
  }

  toggleSection(si: number) {
    const current = this.selectedSections();
    this.selectedLines.set([]);
    this.selectedSections.set(
      current.includes(si) ? current.filter(i => i !== si) : [...current, si],
    );
  }

  selectAllLines(song: ParsedSong) {
    const keys: string[] = [];
    song.sections.forEach((section, si) =>
      section.lines.forEach((_, li) => keys.push(SelectionService.lineKey(si, li))),
    );
    this.selectedSections.set([]);
    this.selectedLines.set(keys);
  }

  // Decoded once here so every consumer works with numbers, and always sorted
  // descending so callers can splice without invalidating later indices.
  private selectedLinePairs(): { si: number; li: number }[] {
    return this.selectedLines()
      .map(key => {
        const [si, li] = key.split(':').map(Number);
        return { si, li };
      })
      .sort((a, b) => (a.si === b.si ? b.li - a.li : b.si - a.si));
  }

  // ── Clipboard ───────────────────────────────────────────────────────────────

  /**
   * Copies the current selection. Returns the number of items copied (0 when
   * there's nothing selected) so the caller can toast an accurate count.
   * Everything is deep-cloned on the way in, so a later edit to the source
   * song can't reach back and mutate what's on the clipboard.
   */
  copy(song: ParsedSong): number {
    const sectionIdxs = [...this.selectedSections()].sort((a, b) => a - b);
    if (sectionIdxs.length > 0) {
      const sections = sectionIdxs
        .map(si => song.sections[si])
        .filter((s): s is SongSection => !!s)
        .map(s => clone(s));
      this.clipboard.set({ kind: 'sections', sections });
      return sections.length;
    }

    // Ascending, so pasted lines keep their on-screen order.
    const pairs = this.selectedLinePairs().slice().reverse();
    if (pairs.length === 0) return 0;
    const lines = pairs
      .map(({ si, li }) => song.sections[si]?.lines[li])
      .filter((l): l is SongLine => !!l)
      .map(l => clone(l));
    this.clipboard.set({ kind: 'lines', lines, fromSectionIdx: pairs[0].si });
    return lines.length;
  }

  // ── Pure song transforms ────────────────────────────────────────────────────

  /**
   * Removes every selected line or section. Returns a new song, or null if
   * nothing was selected. One call = one returned song = one songChange emit =
   * one undo entry, which is why this can't just loop over removeLine().
   */
  deleteSelected(song: ParsedSong): ParsedSong | null {
    const sectionIdxs = [...this.selectedSections()].sort((a, b) => b - a);
    if (sectionIdxs.length > 0) {
      const next = clone(song);
      for (const si of sectionIdxs) next.sections.splice(si, 1);
      return next;
    }

    const pairs = this.selectedLinePairs(); // already descending
    if (pairs.length === 0) return null;
    const next = clone(song);
    for (const { si, li } of pairs) next.sections[si]?.lines.splice(li, 1);
    // Same invariant removeLine() keeps: a section is never left with no lines.
    for (const section of next.sections) {
      if (section.lines.length === 0) section.lines.push(BLANK_LINE());
    }
    return next;
  }

  /**
   * Inserts a copy of each selected item directly after the selection, so a
   * verse can be duplicated into verse 2 in one action. Doesn't touch the
   * clipboard — this is the in-place shortcut for the copy/paste round trip.
   */
  duplicateSelected(song: ParsedSong): ParsedSong | null {
    const sectionIdxs = [...this.selectedSections()].sort((a, b) => b - a);
    if (sectionIdxs.length > 0) {
      const next = clone(song);
      for (const si of sectionIdxs) {
        const section = next.sections[si];
        if (section) next.sections.splice(si + 1, 0, clone(section));
      }
      return next;
    }

    const pairs = this.selectedLinePairs(); // descending — later inserts don't shift earlier ones
    if (pairs.length === 0) return null;
    const next = clone(song);
    for (const { si, li } of pairs) {
      const line = next.sections[si]?.lines[li];
      if (line) next.sections[si].lines.splice(li + 1, 0, clone(line));
    }
    return next;
  }

  /** Appends the clipboard's lines to the end of section `si`. */
  pasteLines(song: ParsedSong, si: number): ParsedSong | null {
    const payload = this.clipboard();
    if (payload?.kind !== 'lines' || !song.sections[si]) return null;
    const next = clone(song);
    next.sections[si].lines.push(...payload.lines.map(l => clone(l)));
    return next;
  }

  /** Appends the clipboard's sections to the end of the song. */
  pasteSections(song: ParsedSong): ParsedSong | null {
    const payload = this.clipboard();
    if (payload?.kind !== 'sections') return null;
    const next = clone(song);
    next.sections.push(...payload.sections.map(s => clone(s)));
    return next;
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
