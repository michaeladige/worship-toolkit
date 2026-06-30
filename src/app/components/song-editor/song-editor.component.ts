import { Component, Input, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ParsedSong } from '../../models/song.model';
import { ChordService } from '../../services/chord.service';
import { ExportService } from '../../services/export.service';
import { SongSectionComponent } from '../song-section/song-section.component';
import { AutofocusDirective } from '../../directives/autofocus.directive';

const QUICK_SECTIONS = ['INTRO', 'VERSE', 'CHORUS', 'PRE-CHORUS', 'BRIDGE', 'OUTRO', 'TAG'];

@Component({
  selector: 'app-song-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, SongSectionComponent, AutofocusDirective],
  templateUrl: './song-editor.component.html',
  styleUrl: './song-editor.component.scss',
})
export class SongEditorComponent {
  readonly Math = Math;
  readonly quickSections = QUICK_SECTIONS;

  @Input() songs: ParsedSong[] = [];
  @Input() selectedIndex = 0;
  @Input() canUndo = false;
  @Input() canRedo = false;
  @Input() fontSize = 14;
  @Output() songsChange = new EventEmitter<ParsedSong[]>();
  @Output() undo = new EventEmitter<void>();
  @Output() redo = new EventEmitter<void>();

  exporting = false;
  newSectionName = '';
  editingTitle: string | null = null;
  editingTempo: string | null = null;
  editingTimeSignature: string | null = null;

  constructor(
    public chordSvc: ChordService,
    private exportSvc: ExportService,
    private cdr: ChangeDetectorRef,
  ) {}

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

  toggleNashville() {
    this.updateSong({ ...this.song, showNashville: !this.song.showNashville });
  }

  resetTranspose() {
    this.updateSong({ ...this.song, transposeSemitones: 0 });
  }

  startEditTitle() { this.editingTitle = this.song.title; }
  commitTitle() {
    const v = (this.editingTitle ?? '').trim();
    this.editingTitle = null;
    if (v) this.updateSong({ ...this.song, title: v });
  }
  cancelTitle() { this.editingTitle = null; }
  titleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); this.commitTitle(); }
    if (e.key === 'Escape') { this.cancelTitle(); }
  }

  startEditTempo() {
    this.editingTempo = this.song.tempo ?? '';
  }

  commitTempo() {
    if (this.editingTempo === null) return;
    const cleaned = this.editingTempo.replace(/[^\d]/g, '');
    this.editingTempo = null;
    this.setTempo(cleaned);
  }

  cancelTempo() {
    this.editingTempo = null;
  }

  tempoKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); this.commitTempo(); }
    if (e.key === 'Escape') { this.cancelTempo(); }
  }

  setTempo(value: string) {
    this.updateSong({ ...this.song, tempo: value });
  }

  startEditTimeSignature() {
    this.editingTimeSignature = this.song.timeSignature;
  }

  commitTimeSignature() {
    if (this.editingTimeSignature === null) return;
    const cleaned = this.editingTimeSignature.trim();
    this.editingTimeSignature = null;
    if (/^\d{1,2}\/\d{1,2}$/.test(cleaned)) {
      this.setTimeSignature(cleaned);
    }
  }

  cancelTimeSignature() {
    this.editingTimeSignature = null;
  }

  timeSignatureKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); this.commitTimeSignature(); }
    if (e.key === 'Escape') { this.cancelTimeSignature(); }
  }

  setTimeSignature(value: string) {
    this.updateSong({ ...this.song, timeSignature: value });
  }

  addSection(name: string) {
    const trimmed = name.trim().toUpperCase();
    if (!trimmed) return;
    const song = JSON.parse(JSON.stringify(this.song)) as ParsedSong;
    song.sections.push({
      name: trimmed,
      lines: [{ chords: [], lyric: '', isChordsOnly: false }],
    });
    this.updateSong(song);
    this.newSectionName = '';
  }

  addLineToSection(si: number) {
    const song = JSON.parse(JSON.stringify(this.song)) as ParsedSong;
    song.sections[si].lines.push({ chords: [], lyric: '', isChordsOnly: false });
    this.updateSong(song);
  }

  removeSection(si: number) {
    const song = JSON.parse(JSON.stringify(this.song)) as ParsedSong;
    song.sections.splice(si, 1);
    this.updateSong(song);
  }

  async exportPdf() {
    this.exporting = true;
    try {
      await this.exportSvc.toPdf(this.songs, this.fontSize);
    } finally {
      this.exporting = false;
      this.cdr.detectChanges();
    }
  }

  exportMarkdown() {
    this.exportSvc.downloadMarkdown(this.songs);
  }

  async exportCurrentSongPdf() {
    this.exporting = true;
    try {
      await this.exportSvc.toPdf([this.song], this.fontSize);
    } finally {
      this.exporting = false;
      this.cdr.detectChanges();
    }
  }
}
