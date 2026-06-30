import { ChangeDetectorRef, Component, HostListener, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ParsedSong } from '../../models/song.model';
import { UploadComponent } from '../upload/upload.component';
import { SongListComponent } from '../song-list/song-list.component';
import { SongEditorComponent } from '../song-editor/song-editor.component';
import { UiSettingsService } from '../../services/ui-settings.service';
import { SessionsService } from '../../services/sessions.service';

const SESSION_KEY = 'worship_toolkit_session';

@Component({
  selector: 'app-workspace',
  standalone: true,
  imports: [CommonModule, UploadComponent, SongListComponent, SongEditorComponent],
  templateUrl: './workspace.component.html',
  styleUrl: './workspace.component.scss',
})
export class WorkspaceComponent implements OnInit, OnDestroy {
  songs: ParsedSong[] = [];
  selectedIndex = 0;
  sidebarCollapsed = false;

  // ── Undo / Redo ─────────────────────────────────────────────────────────────
  private undoStack: ParsedSong[][] = [];
  private redoStack: ParsedSong[][] = [];
  private readonly HISTORY_LIMIT = 50;
  private sessionSub!: Subscription;

  get canUndo(): boolean { return this.undoStack.length > 0; }
  get canRedo(): boolean { return this.redoStack.length > 0; }

  constructor(
    public ui: UiSettingsService,
    private sessionsSvc: SessionsService,
    private cdr: ChangeDetectorRef,
  ) {}

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

    this.sessionsSvc.currentSongs = this.songs;
    this.sessionsSvc.initActiveSession();

    this.sessionSub = this.sessionsSvc.sessionLoad$.subscribe(songs => {
      this.undoStack = [];
      this.redoStack = [];
      if (songs.length === 0) {
        this.songs = [];
        this.sessionsSvc.currentSongs = [];
        localStorage.removeItem(SESSION_KEY);
      } else {
        this.songs = songs;
        this.sessionsSvc.currentSongs = songs;
        try { localStorage.setItem(SESSION_KEY, JSON.stringify(songs)); } catch {}
      }
      this.selectedIndex = 0;
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy() {
    this.sessionSub?.unsubscribe();
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
    this.sessionsSvc.currentSongs = songs;
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(songs)); } catch { /* quota */ }
    this.sessionsSvc.autosave(songs);
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
    this.sessionsSvc.activeSessionId = null;
    localStorage.removeItem('worship_toolkit_active_session');
    this.undoStack = [];
    this.redoStack = [];
    this.songs = songs;
    this.sessionsSvc.currentSongs = songs;
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(songs)); } catch {}
    this.selectedIndex = 0;
  }

  onUploadNew() {
    this.sessionsSvc.activeSessionId = null;
    localStorage.removeItem('worship_toolkit_active_session');
    this.undoStack = [];
    this.redoStack = [];
    localStorage.removeItem(SESSION_KEY);
    this.songs = [];
    this.sessionsSvc.currentSongs = [];
    this.selectedIndex = 0;
  }

  onSelectSong(i: number) {
    this.selectedIndex = i;
  }

  onSongsChange(songs: ParsedSong[]) {
    this.setSongs(songs);
  }

  onReorderSongs(reordered: ParsedSong[]) {
    const prevSelected = this.songs[this.selectedIndex];
    this.setSongs(reordered);
    const newIdx = reordered.findIndex(s => s.id === prevSelected?.id);
    this.selectedIndex = newIdx >= 0 ? newIdx : 0;
  }

  onAddBlankSong() {
    const blank: ParsedSong = {
      id: crypto.randomUUID(),
      title: 'New Song',
      authors: [],
      key: 'C',
      originalKey: 'C',
      tempo: '',
      timeSignature: '4/4',
      sections: [{ name: 'VERSE', lines: [{ chords: [], lyric: '', isChordsOnly: false }] }],
      transposeSemitones: 0,
      showBassNotesOnly: false,
    };
    const updated = [...this.songs, blank];
    this.setSongs(updated);
    this.selectedIndex = updated.length - 1;
  }

  onAppendSongs(newSongs: ParsedSong[]) {
    const updated = [...this.songs, ...newSongs];
    this.setSongs(updated);
    this.selectedIndex = this.songs.length - newSongs.length; // select first appended
  }

  onRemoveSong(i: number) {
    const updated = this.songs.filter((_, idx) => idx !== i);
    if (updated.length === 0) { this.onUploadNew(); return; }
    this.setSongs(updated);
    this.selectedIndex = Math.min(this.selectedIndex, updated.length - 1);
  }
}
