import { ChangeDetectorRef, Component, HostBinding, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, CdkDropList, CdkDrag, CdkDragHandle, moveItemInArray } from '@angular/cdk/drag-drop';
import { ParsedSong } from '../../models/song.model';
import { ChordService } from '../../services/chord.service';
import { PdfParserService } from '../../services/pdf-parser.service';
import { UiSettingsService } from '../../services/ui-settings.service';

@Component({
  selector: 'app-song-list',
  standalone: true,
  imports: [CommonModule, FormsModule, CdkDropList, CdkDrag, CdkDragHandle],
  templateUrl: './song-list.component.html',
  styleUrl: './song-list.component.scss',
})
export class SongListComponent implements OnChanges {
  @Input() songs: ParsedSong[] = [];
  @Input() selectedIndex = 0;
  @Input() collapsed = false;
  @Output() selectSong = new EventEmitter<number>();
  @Output() reorderSongs = new EventEmitter<ParsedSong[]>();
  @Output() addBlankSong = new EventEmitter<void>();
  @Output() appendSongs = new EventEmitter<ParsedSong[]>();
  @Output() removeSong = new EventEmitter<number>();
  @Output() toggleCollapse = new EventEmitter<void>();

  @HostBinding('class.collapsed') get isCollapsed() { return this.collapsed; }
  @HostBinding('class.append-open') get isAppendMenuOpen() { return this.appendMenuOpen; }

  appendMenuOpen = false;
  filterText = '';

  isAppending = false;
  appendError = '';
  dupeNames: string[] = [];
  pendingAppend: ParsedSong[] = [];

  constructor(
    public chordSvc: ChordService,
    private parser: PdfParserService,
    public ui: UiSettingsService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['collapsed']?.currentValue === true) {
      this.appendMenuOpen = false;
    }
  }

  effectiveKey(song: ParsedSong): string {
    return this.chordSvc.transposeKey(song.originalKey, song.transposeSemitones, this.ui.chordAccidentals);
  }

  // Original indices are preserved so select/remove emits stay correct while
  // the list is filtered. Reordering is disabled during filtering (dropSong
  // indices would be against the filtered view, not the real array).
  get visibleSongs(): { song: ParsedSong; index: number }[] {
    const q = this.filterText.trim().toLowerCase();
    return this.songs
      .map((song, index) => ({ song, index }))
      .filter(({ song }) => !q || song.title.toLowerCase().includes(q));
  }

  get isFiltering(): boolean {
    return this.filterText.trim().length > 0;
  }

  onAddBlankSong() {
    this.appendMenuOpen = false;
    this.addBlankSong.emit();
  }

  dropSong(event: CdkDragDrop<ParsedSong[]>) {
    if (event.previousIndex === event.currentIndex) return;
    const reordered = [...this.songs];
    moveItemInArray(reordered, event.previousIndex, event.currentIndex);
    this.reorderSongs.emit(reordered);
  }

  async onAppendFileChange(e: Event) {
    this.appendMenuOpen = false;
    const files = Array.from((e.target as HTMLInputElement).files ?? []);
    (e.target as HTMLInputElement).value = '';
    if (files.length === 0) return;
    this.appendError = '';
    this.isAppending = true;

    const incoming: ParsedSong[] = [];
    const failures: string[] = [];
    try {
      for (const file of files) {
        if (!file.name.toLowerCase().endsWith('.pdf')) {
          failures.push(`${file.name} — ${this.ui.t('Please choose a PDF file.')}`);
          continue;
        }
        try {
          const songs = await this.parser.parsePdf(file);
          if (songs.length === 0) {
            failures.push(`${file.name} — ${this.ui.t('No songs detected in this PDF.')}`);
          } else {
            incoming.push(...songs);
          }
        } catch (err) {
          console.error(err);
          failures.push(
            `${file.name} — ${err instanceof Error && err.message ? err.message : this.ui.t('Failed to parse PDF. Please try again.')}`,
          );
        }
      }
    } finally {
      this.isAppending = false;
    }

    this.appendError = failures.join(' · ');
    if (incoming.length > 0) {
      const existing = new Set(this.songs.map(s => s.title.toLowerCase()));
      const dupes = incoming.filter(s => existing.has(s.title.toLowerCase()));
      if (dupes.length > 0) {
        this.dupeNames = dupes.map(s => s.title);
        this.pendingAppend = incoming;
      } else {
        this.appendSongs.emit(incoming);
      }
    }
    // Zoneless app: state set after an await needs an explicit render.
    this.cdr.detectChanges();
  }

  confirmAppendAll() {
    this.appendSongs.emit(this.pendingAppend);
    this.pendingAppend = [];
    this.dupeNames = [];
  }

  confirmAppendSkipDupes() {
    const existing = new Set(this.songs.map(s => s.title.toLowerCase()));
    const filtered = this.pendingAppend.filter(s => !existing.has(s.title.toLowerCase()));
    if (filtered.length > 0) this.appendSongs.emit(filtered);
    this.pendingAppend = [];
    this.dupeNames = [];
  }

  cancelAppend() {
    this.pendingAppend = [];
    this.dupeNames = [];
  }
}
