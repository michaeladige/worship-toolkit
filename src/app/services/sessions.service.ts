import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { ParsedSong, SavedSession } from '../models/song.model';

const SESSIONS_KEY = 'worship_toolkit_sessions';
const MAX_SESSIONS = 20;

@Injectable({ providedIn: 'root' })
export class SessionsService {
  showModal = false;

  // WorkspaceComponent keeps this in sync on every setSongs() call
  currentSongs: ParsedSong[] = [];

  private loadSubject = new Subject<ParsedSong[]>();
  readonly sessionLoad$ = this.loadSubject.asObservable();

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
    const existing = sessions.find(s => s.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      existing.savedAt = Date.now();
      existing.songs = songs;
    } else {
      sessions.unshift({ id: crypto.randomUUID(), name: trimmed, savedAt: Date.now(), songs });
      if (sessions.length > MAX_SESSIONS) sessions.splice(MAX_SESSIONS);
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
  }

  triggerLoad(session: SavedSession): void {
    this.showModal = false;
    this.loadSubject.next(session.songs);
  }

  openModal(): void { this.showModal = true; }
  closeModal(): void { this.showModal = false; }

  private persist(sessions: SavedSession[]): void {
    try { localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions)); } catch { /* quota */ }
  }
}
