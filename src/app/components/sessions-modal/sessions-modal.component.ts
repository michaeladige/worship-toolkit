import { Component, HostListener } from '@angular/core';
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
export class SessionsModalComponent {
  saveName = '';
  renamingId: string | null = null;
  renameValue = '';
  importError = '';

  constructor(
    public sessionsSvc: SessionsService,
    private exportSvc: ExportService,
  ) {}

  get sessions(): SavedSession[] {
    return this.sessionsSvc.list();
  }

  @HostListener('document:keydown.escape')
  onEscape() { this.sessionsSvc.closeModal(); }

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
      this.sessionsSvc.triggerLoad({ id: '', name, savedAt: Date.now(), songs });
    } catch (err) {
      this.importError = err instanceof Error ? err.message : 'Failed to import file.';
    }
    (e.target as HTMLInputElement).value = '';
  }

  formatDate(ms: number): string {
    return new Date(ms).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  }
}
