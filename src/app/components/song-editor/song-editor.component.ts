import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ParsedSong } from '../../models/song.model';
import { ChordService } from '../../services/chord.service';
import { ExportService } from '../../services/export.service';
import { SongSectionComponent } from '../song-section/song-section.component';

@Component({
  selector: 'app-song-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, SongSectionComponent],
  templateUrl: './song-editor.component.html',
  styleUrl: './song-editor.component.scss',
})
export class SongEditorComponent {
  readonly Math = Math;
  @Input() songs: ParsedSong[] = [];
  @Input() selectedIndex = 0;
  @Output() songsChange = new EventEmitter<ParsedSong[]>();

  exporting = false;

  constructor(public chordSvc: ChordService, private exportSvc: ExportService) {}

  get song(): ParsedSong {
    return this.songs[this.selectedIndex];
  }

  get effectiveKey(): string {
    return this.chordSvc.transposeKey(this.song.originalKey, this.song.transposeSemitones);
  }

  get allKeys(): string[] {
    return this.chordSvc.allKeys();
  }

  updateSong(updated: ParsedSong) {
    const songs = [...this.songs];
    songs[this.selectedIndex] = updated;
    this.songsChange.emit(songs);
  }

  transpose(delta: number) {
    const s = { ...this.song, transposeSemitones: this.song.transposeSemitones + delta };
    this.updateSong(s);
  }

  setKey(key: string) {
    const semitones = this.chordSvc.semitonesBetween(this.song.originalKey, key);
    this.updateSong({ ...this.song, transposeSemitones: semitones });
  }

  toggleBassNotes() {
    this.updateSong({ ...this.song, showBassNotesOnly: !this.song.showBassNotesOnly });
  }

  resetTranspose() {
    this.updateSong({ ...this.song, transposeSemitones: 0 });
  }

  async exportPdf() {
    this.exporting = true;
    try {
      await this.exportSvc.toPdf(this.songs);
    } finally {
      this.exporting = false;
    }
  }

  exportMarkdown() {
    this.exportSvc.downloadMarkdown(this.songs);
  }

  async exportCurrentSongPdf() {
    this.exporting = true;
    try {
      await this.exportSvc.toPdf([this.song]);
    } finally {
      this.exporting = false;
    }
  }
}
