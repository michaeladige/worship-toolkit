import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ParsedSong } from '../../models/song.model';
import { UploadComponent } from '../upload/upload.component';
import { SongListComponent } from '../song-list/song-list.component';
import { SongEditorComponent } from '../song-editor/song-editor.component';
import { UiSettingsService } from '../../services/ui-settings.service';

const SESSION_KEY = 'worship_toolkit_session';

@Component({
  selector: 'app-workspace',
  standalone: true,
  imports: [CommonModule, UploadComponent, SongListComponent, SongEditorComponent],
  templateUrl: './workspace.component.html',
  styleUrl: './workspace.component.scss',
})
export class WorkspaceComponent implements OnInit {
  songs: ParsedSong[] = [];
  selectedIndex = 0;

  // ── Undo / Redo ─────────────────────────────────────────────────────────────
  private undoStack: ParsedSong[][] = [];
  private redoStack: ParsedSong[][] = [];
  private readonly HISTORY_LIMIT = 50;

  get canUndo(): boolean { return this.undoStack.length > 0; }
  get canRedo(): boolean { return this.redoStack.length > 0; }

  constructor(public ui: UiSettingsService) {}

  ngOnInit() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as ParsedSong[];
        if (Array.isArray(saved) && saved.length > 0) {
          this.songs = saved;
          this.selectedIndex = 0;
        }
      }
    } catch {
      localStorage.removeItem(SESSION_KEY);
    }
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent) {
    if (!e.ctrlKey && !e.metaKey) return;
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      this.undo();
    } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
      e.preventDefault();
      this.redo();
    }
  }

  private setSongs(songs: ParsedSong[]) {
    this.undoStack.push(this.songs);
    if (this.undoStack.length > this.HISTORY_LIMIT) this.undoStack.shift();
    this.redoStack = [];
    this.songs = songs;
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(songs)); } catch { /* quota */ }
  }

  private applyHistory(songs: ParsedSong[]) {
    this.songs = songs;
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(songs)); } catch { /* quota */ }
  }

  undo() {
    if (!this.canUndo) return;
    this.redoStack.push(this.songs);
    this.applyHistory(this.undoStack.pop()!);
  }

  redo() {
    if (!this.canRedo) return;
    this.undoStack.push(this.songs);
    if (this.undoStack.length > this.HISTORY_LIMIT) this.undoStack.shift();
    this.applyHistory(this.redoStack.pop()!);
  }

  onSongsLoaded(songs: ParsedSong[]) {
    this.undoStack = [];
    this.redoStack = [];
    this.songs = songs;
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(songs)); } catch {}
    this.selectedIndex = 0;
  }

  onUploadNew() {
    this.undoStack = [];
    this.redoStack = [];
    localStorage.removeItem(SESSION_KEY);
    this.songs = [];
    this.selectedIndex = 0;
  }

  onSelectSong(i: number) {
    this.selectedIndex = i;
  }

  onSongsChange(songs: ParsedSong[]) {
    this.setSongs(songs);
  }
}
