import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SessionsService } from '../../services/sessions.service';
import { ExportService } from '../../services/export.service';
import { SavedSession } from '../../models/song.model';

@Component({
  selector: 'app-sessions-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sessions-modal.component.html',
  styleUrl: './sessions-modal.component.scss',
})
export class SessionsModalComponent implements OnInit {
  saveName = '';
  renamingId: string | null = null;
  renameValue = '';
  importError = '';
  showNewSessionConfirm = false;
  newSessionSaveName = '';

  constructor(
    public sessionsSvc: SessionsService,
    private exportSvc: ExportService,
  ) {}

  ngOnInit() {
    // Opened via the header "➕ New" with unsaved work — jump straight to the confirm.
    if (this.sessionsSvc.pendingNewSet) {
      this.sessionsSvc.pendingNewSet = false;
      this.showNewSessionConfirm = true;
    }
  }

  get sessions(): SavedSession[] {
    return this.sessionsSvc.list();
  }

  get activeSession(): SavedSession | null {
    if (!this.sessionsSvc.activeSessionId) return null;
    return this.sessions.find(s => s.id === this.sessionsSvc.activeSessionId) ?? null;
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.showNewSessionConfirm) {
      this.cancelNewSessionConfirm();
    } else {
      this.sessionsSvc.closeModal();
    }
  }

  onBackdropClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.sessionsSvc.closeModal();
    }
  }

  saveSession() {
    const name = this.saveName.trim();
    if (!name) return;
    this.sessionsSvc.save(name, this.sessionsSvc.currentSongs);
    this.saveName = '';
  }

  loadSession(session: SavedSession) {
    this.sessionsSvc.triggerLoad(session);
  }

  startRename(session: SavedSession) {
    this.renamingId = session.id;
    this.renameValue = session.name;
  }

  commitRename(id: string) {
    if (this.renameValue.trim()) this.sessionsSvc.rename(id, this.renameValue);
    this.renamingId = null;
  }

  cancelRename() { this.renamingId = null; }

  deleteSession(id: string) { this.sessionsSvc.delete(id); }

  exportSession(session: SavedSession) {
    this.exportSvc.downloadSession(session.songs, session.name);
  }

  async onImportFile(e: Event) {
    this.importError = '';
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const { name, songs } = await this.exportSvc.parseSessionFile(file);
      this.sessionsSvc.save(name, songs);
      const saved = this.sessionsSvc.list().find(s => s.name.toLowerCase() === name.trim().toLowerCase());
      if (saved) {
        this.sessionsSvc.triggerLoad(saved);
      } else {
        this.sessionsSvc.triggerLoad({ id: '', name, savedAt: Date.now(), songs });
      }
    } catch (err) {
      this.importError = err instanceof Error ? err.message : 'Failed to import file.';
    }
    (e.target as HTMLInputElement).value = '';
  }

  requestNewSession() {
    if (this.sessionsSvc.currentSongs.length === 0) return;
    if (this.sessionsSvc.activeSessionId !== null) {
      // Named session is tracked and auto-saved — just clear
      this.sessionsSvc.clearWorkspace();
    } else {
      this.showNewSessionConfirm = true;
    }
  }

  confirmNewSessionWithSave() {
    const name = this.newSessionSaveName.trim();
    if (name) this.sessionsSvc.save(name, this.sessionsSvc.currentSongs);
    this.showNewSessionConfirm = false;
    this.newSessionSaveName = '';
    this.sessionsSvc.clearWorkspace();
  }

  discardAndNewSession() {
    this.showNewSessionConfirm = false;
    this.newSessionSaveName = '';
    this.sessionsSvc.clearWorkspace();
  }

  cancelNewSessionConfirm() {
    this.showNewSessionConfirm = false;
    this.newSessionSaveName = '';
  }

  formatDate(ms: number): string {
    return new Date(ms).toLocaleString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }
}
