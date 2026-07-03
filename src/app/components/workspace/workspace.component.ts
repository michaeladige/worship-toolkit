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
        this.ui.safeSetItem(SESSION_KEY, JSON.stringify(songs));
      }
      this.selectedIndex = 0;
      this.cdr.detectChanges();
    });

    // One-time touch-device hint: the collapsed song-list tab strip is easy
    // to miss on phones once more than one song is loaded.
    if (this.ui.isCoarsePointer && this.songs.length > 1 && !this.ui.hintSeen('songlist-tab')) {
      this.ui.showToast('Tip: use the tab on the left edge to open your song list.', 'info', { durationMs: 6000 });
      this.ui.dismissHint('songlist-tab');
    }
  }

  ngOnDestroy() {
    this.sessionSub?.unsubscribe();
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent) {
    const target = e.target as HTMLElement | null;
    const tag = target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;
    if (this.songs.length === 0) return;
    const modalOpen = this.sessionsSvc.showModal || this.sessionsSvc.showExportModal
      || this.ui.showSettingsModal || this.ui.showShortcutsModal;

    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (!modalOpen) this.undo();
      } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault();
        if (!modalOpen) this.redo();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!modalOpen) this.stepSong(e.key === 'ArrowDown' ? 1 : -1);
      }
      return;
    }

    if (modalOpen) return;
    if (e.key === 'Escape' && this.ui.stageMode()) {
      e.preventDefault();
      this.ui.exitStageMode();
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      this.transposeSelected(1);
    } else if (e.key === '-') {
      e.preventDefault();
      this.transposeSelected(-1);
    } else if (e.key === '?') {
      e.preventDefault();
      this.ui.showShortcutsModal = true;
    }
  }

  private stepSong(dir: 1 | -1) {
    const next = Math.max(0, Math.min(this.songs.length - 1, this.selectedIndex + dir));
    if (next !== this.selectedIndex) this.onSelectSong(next);
  }

  // Same transform SongEditorComponent.transpose() applies, routed through
  // setSongs so it lands on the undo stack like a button-driven transpose.
  private transposeSelected(delta: number) {
    const songs = this.songs.map((s, i) =>
      i === this.selectedIndex ? { ...s, transposeSemitones: s.transposeSemitones + delta } : s,
    );
    this.setSongs(songs);
  }

  private setSongs(songs: ParsedSong[]) {
    this.undoStack.push(this.songs);
    if (this.undoStack.length > this.HISTORY_LIMIT) this.undoStack.shift();
    this.redoStack = [];
    this.songs = songs;
    this.sessionsSvc.currentSongs = songs;
    this.ui.safeSetItem(SESSION_KEY, JSON.stringify(songs));
    this.sessionsSvc.autosave(songs);
  }

  private applyHistory(songs: ParsedSong[]) {
    this.songs = songs;
    // A snapshot restored by undo/redo can be shorter than the array selectedIndex
    // was pointing into (e.g. undoing an add/append) — clamp so it stays valid.
    this.selectedIndex = Math.max(0, Math.min(this.selectedIndex, songs.length - 1));
    this.sessionsSvc.currentSongIndex = this.selectedIndex;
    this.sessionsSvc.currentSongs = songs;
    this.ui.safeSetItem(SESSION_KEY, JSON.stringify(songs));
    this.sessionsSvc.autosave(songs);
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
    this.ui.safeSetItem(SESSION_KEY, JSON.stringify(songs));
    this.selectedIndex = 0;
    this.cdr.detectChanges();
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
    this.selectedIndex = Math.max(0, Math.min(this.songs.length - 1, i));
    this.sessionsSvc.currentSongIndex = this.selectedIndex;
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
    this.cdr.detectChanges();
  }

  onRemoveSong(i: number) {
    const updated = this.songs.filter((_, idx) => idx !== i);
    if (updated.length === 0) { this.onUploadNew(); return; }
    this.setSongs(updated);
    this.selectedIndex = Math.min(this.selectedIndex, updated.length - 1);
  }
}
