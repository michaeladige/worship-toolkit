import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ParsedSong } from './models/song.model';
import { UploadComponent } from './components/upload/upload.component';
import { SongListComponent } from './components/song-list/song-list.component';
import { SongEditorComponent } from './components/song-editor/song-editor.component';

const SESSION_KEY   = 'worship_toolkit_session';
const THEME_KEY     = 'worship_toolkit_theme';
const FONT_SIZE_KEY = 'worship_toolkit_font_size';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, UploadComponent, SongListComponent, SongEditorComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  songs: ParsedSong[] = [];
  selectedIndex = 0;

  // ── Undo / Redo ─────────────────────────────────────────────────────────────
  private undoStack: ParsedSong[][] = [];
  private redoStack: ParsedSong[][] = [];
  private readonly HISTORY_LIMIT = 50;

  get canUndo(): boolean { return this.undoStack.length > 0; }
  get canRedo(): boolean { return this.redoStack.length > 0; }

  // ── Theme ────────────────────────────────────────────────────────────────────
  theme: 'light' | 'dark' = 'light';

  // ── Font size ────────────────────────────────────────────────────────────────
  fontSize = 14;
  readonly fontSizes = [13, 14, 16];

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

    const savedTheme = localStorage.getItem(THEME_KEY) as 'light' | 'dark' | null;
    this.theme = (savedTheme === 'light' || savedTheme === 'dark')
      ? savedTheme
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    this.applyTheme();

    const savedSize = parseInt(localStorage.getItem(FONT_SIZE_KEY) ?? '', 10);
    if (this.fontSizes.includes(savedSize)) this.fontSize = savedSize;
    this.applyFontSize();
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

  toggleTheme() {
    this.theme = this.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem(THEME_KEY, this.theme);
    this.applyTheme();
  }

  private applyTheme() {
    document.documentElement.setAttribute('data-theme', this.theme);
  }

  adjustFontSize(dir: 1 | -1) {
    const idx = this.fontSizes.indexOf(this.fontSize);
    const newIdx = Math.max(0, Math.min(this.fontSizes.length - 1, idx + dir));
    this.fontSize = this.fontSizes[newIdx];
    localStorage.setItem(FONT_SIZE_KEY, String(this.fontSize));
    this.applyFontSize();
  }

  private applyFontSize() {
    document.documentElement.style.fontSize = this.fontSize + 'px';
  }
}
