import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { ParsedSong, SavedSession } from '../models/song.model';
import { UiSettingsService } from './ui-settings.service';

const SESSIONS_KEY = 'worship_toolkit_sessions';
const ACTIVE_KEY = 'worship_toolkit_active_session';
const MAX_SESSIONS = 20;

@Injectable({ providedIn: 'root' })
export class SessionsService {
  showModal = false;
  showExportModal = false;
  currentSongIndex = 0;
  activeSessionId: string | null = null;

  constructor(private ui: UiSettingsService) {}

  // Set by the header "➕ New" button when there is unsaved work: tells the
  // modal to open straight into the "start a new set" confirmation.
  pendingNewSet = false;

  // Source of truth for the current song list. WorkspaceComponent keeps this
  // in sync via setSongs(); clearWorkspace() and triggerLoad() also update it
  // directly so the header disabled-state is accurate on any route.
  currentSongs: ParsedSong[] = [];

  private loadSubject = new Subject<ParsedSong[]>();
  readonly sessionLoad$ = this.loadSubject.asObservable();

  initActiveSession(): void {
    this.activeSessionId = localStorage.getItem(ACTIVE_KEY) ?? null;
  }

  get activeSessionName(): string | null {
    if (!this.activeSessionId) return null;
    return this.list().find(s => s.id === this.activeSessionId)?.name ?? null;
  }

  autosave(songs: ParsedSong[]): void {
    if (!this.activeSessionId) return;
    const sessions = this.list();
    const s = sessions.find(s => s.id === this.activeSessionId);
    if (!s) {
      this.activeSessionId = null;
      localStorage.removeItem(ACTIVE_KEY);
      return;
    }
    s.savedAt = Date.now();
    s.songs = songs;
    s.latinMode = this.ui.latinMode;
    this.persist(sessions);
  }

  list(): SavedSession[] {
    try {
      const raw = localStorage.getItem(SESSIONS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as SavedSession[];
      return Array.isArray(parsed)
        ? parsed.sort((a, b) => b.savedAt - a.savedAt)
        : [];
    } catch {
      return [];
    }
  }

  save(name: string, songs: ParsedSong[]): void {
    const sessions = this.list();
    const trimmed = name.trim() || 'Unnamed Session';
    const latinMode = this.ui.latinMode;
    const existing = sessions.find(s => s.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      existing.savedAt = Date.now();
      existing.songs = songs;
      existing.latinMode = latinMode;
      this.activeSessionId = existing.id;
      localStorage.setItem(ACTIVE_KEY, existing.id);
    } else {
      const id = crypto.randomUUID();
      sessions.unshift({ id, name: trimmed, savedAt: Date.now(), songs, latinMode });
      if (sessions.length > MAX_SESSIONS) sessions.splice(MAX_SESSIONS);
      this.activeSessionId = id;
      localStorage.setItem(ACTIVE_KEY, id);
    }
    this.persist(sessions);
  }

  rename(id: string, newName: string): void {
    const sessions = this.list();
    const s = sessions.find(s => s.id === id);
    if (s) { s.name = newName.trim() || s.name; this.persist(sessions); }
  }

  delete(id: string): void {
    const sessions = this.list().filter(s => s.id !== id);
    this.persist(sessions);
    if (this.activeSessionId === id) {
      this.activeSessionId = null;
      localStorage.removeItem(ACTIVE_KEY);
    }
  }

  triggerLoad(session: SavedSession): void {
    this.activeSessionId = session.id || null;
    this.currentSongs = session.songs;
    if (this.activeSessionId) {
      localStorage.setItem(ACTIVE_KEY, this.activeSessionId);
    } else {
      localStorage.removeItem(ACTIVE_KEY);
    }
    if (session.latinMode !== undefined) {
      this.ui.setLatinMode(session.latinMode);
    }
    this.showModal = false;
    this.loadSubject.next(session.songs);
  }

  clearWorkspace(): void {
    this.activeSessionId = null;
    this.currentSongs = [];
    localStorage.removeItem(ACTIVE_KEY);
    localStorage.removeItem('worship_toolkit_session');
    this.showModal = false;
    this.loadSubject.next([]);
  }

  openModal(): void  { this.showModal = true; }
  closeModal(): void { this.showModal = false; }

  openExportModal(): void  { this.showExportModal = true; }
  closeExportModal(): void { this.showExportModal = false; }

  private persist(sessions: SavedSession[]): void {
    try { localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions)); } catch { /* quota */ }
  }
}
