import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDragDrop, CdkDropList, CdkDrag, CdkDragHandle, moveItemInArray } from '@angular/cdk/drag-drop';
import { ParsedSong } from '../../models/song.model';
import { ChordService } from '../../services/chord.service';
import { PdfParserService } from '../../services/pdf-parser.service';

@Component({
  selector: 'app-song-list',
  standalone: true,
  imports: [CommonModule, CdkDropList, CdkDrag, CdkDragHandle],
  templateUrl: './song-list.component.html',
  styleUrl: './song-list.component.scss',
})
export class SongListComponent {
  @Input() songs: ParsedSong[] = [];
  @Input() selectedIndex = 0;
  @Output() selectSong = new EventEmitter<number>();
  @Output() uploadNew = new EventEmitter<void>();
  @Output() reorderSongs = new EventEmitter<ParsedSong[]>();
  @Output() addBlankSong = new EventEmitter<void>();
  @Output() appendSongs = new EventEmitter<ParsedSong[]>();
  @Output() removeSong = new EventEmitter<number>();

  confirmingUpload = false;
  isAppending = false;
  appendError = '';
  dupeNames: string[] = [];
  pendingAppend: ParsedSong[] = [];

  constructor(
    public chordSvc: ChordService,
    private parser: PdfParserService,
  ) {}

  effectiveKey(song: ParsedSong): string {
    return this.chordSvc.transposeKey(song.originalKey, song.transposeSemitones);
  }

  requestUploadNew() { this.confirmingUpload = true; }
  cancelUploadNew() { this.confirmingUpload = false; }
  confirmUploadNew() { this.confirmingUpload = false; this.uploadNew.emit(); }

  dropSong(event: CdkDragDrop<ParsedSong[]>) {
    if (event.previousIndex === event.currentIndex) return;
    const reordered = [...this.songs];
    moveItemInArray(reordered, event.previousIndex, event.currentIndex);
    this.reorderSongs.emit(reordered);
  }

  async onAppendFileChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    (e.target as HTMLInputElement).value = '';
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      this.appendError = 'Please choose a PDF file.';
      return;
    }
    this.appendError = '';
    this.isAppending = true;
    try {
      const incoming = await this.parser.parsePdf(file);
      if (incoming.length === 0) {
        this.appendError = 'No songs detected in this PDF.';
        return;
      }
      const existing = new Set(this.songs.map(s => s.title.toLowerCase()));
      const dupes = incoming.filter(s => existing.has(s.title.toLowerCase()));
      if (dupes.length > 0) {
        this.dupeNames = dupes.map(s => s.title);
        this.pendingAppend = incoming;
      } else {
        this.appendSongs.emit(incoming);
      }
    } catch {
      this.appendError = 'Failed to parse PDF. Please try again.';
    } finally {
      this.isAppending = false;
    }
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
