import { Component, HostListener, ChangeDetectorRef } from '@angular/core';
import { SessionsService } from '../../services/sessions.service';
import { ExportService } from '../../services/export.service';
import { UiSettingsService } from '../../services/ui-settings.service';

@Component({
  selector: 'app-export-modal',
  standalone: true,
  imports: [],
  templateUrl: './export-modal.component.html',
  styleUrl: './export-modal.component.scss',
})
export class ExportModalComponent {
  exporting = false;

  constructor(
    public sessionsSvc: SessionsService,
    private exportSvc: ExportService,
    public ui: UiSettingsService,
    private cdr: ChangeDetectorRef,
  ) {}

  get song() {
    return this.sessionsSvc.currentSongs[this.sessionsSvc.currentSongIndex];
  }

  @HostListener('document:keydown.escape')
  onEscape() { this.sessionsSvc.closeExportModal(); }

  onBackdropClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('modal-backdrop'))
      this.sessionsSvc.closeExportModal();
  }

  async exportSongPdf() {
    if (!this.song) return;
    this.exporting = true;
    try { await this.exportSvc.toPdf([this.song], this.ui.pdfFontSize); }
    finally { this.exporting = false; this.cdr.detectChanges(); }
  }

  async exportSetPdf() {
    this.exporting = true;
    try { await this.exportSvc.toPdf(this.sessionsSvc.currentSongs, this.ui.pdfFontSize); }
    finally { this.exporting = false; this.cdr.detectChanges(); }
  }

  exportMarkdown() {
    this.exportSvc.downloadMarkdown(this.sessionsSvc.currentSongs);
  }
}
