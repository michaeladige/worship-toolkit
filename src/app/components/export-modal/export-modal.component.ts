import { Component, HostListener, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SessionsService } from '../../services/sessions.service';
import { ExportService } from '../../services/export.service';
import { UiSettingsService } from '../../services/ui-settings.service';

@Component({
  selector: 'app-export-modal',
  standalone: true,
  imports: [FormsModule],
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
    try {
      await this.exportSvc.toPdf(
        [this.song],
        this.ui.pdfFontSize,
        this.ui.chordAccidentals,
        this.ui.chordFont,
        this.ui.chordInstrument,
      );
      this.ui.showToast('PDF exported');
    } catch (err) {
      console.error(err);
      this.ui.showToast('PDF export failed. Please try again.', 'error');
    } finally { this.exporting = false; this.cdr.detectChanges(); }
  }

  async exportSetPdf() {
    this.exporting = true;
    try {
      await this.exportSvc.toPdf(
        this.sessionsSvc.currentSongs,
        this.ui.pdfFontSize,
        this.ui.chordAccidentals,
        this.ui.chordFont,
        this.ui.chordInstrument,
        { coverPage: this.ui.setPdfCoverPage, setName: this.sessionsSvc.activeSessionName ?? undefined },
      );
      this.ui.showToast('PDF exported');
    } catch (err) {
      console.error(err);
      this.ui.showToast('PDF export failed. Please try again.', 'error');
    } finally { this.exporting = false; this.cdr.detectChanges(); }
  }

  async exportSeparatePdfs() {
    this.exporting = true;
    try {
      await this.exportSvc.toSeparatePdfs(
        this.sessionsSvc.currentSongs,
        this.ui.pdfFontSize,
        this.ui.chordAccidentals,
        this.ui.chordFont,
        this.sessionsSvc.activeSessionName ?? 'worship-set',
        this.ui.chordInstrument,
      );
      this.ui.showToast('PDFs exported');
    } catch (err) {
      console.error(err);
      this.ui.showToast('PDF export failed. Please try again.', 'error');
    } finally { this.exporting = false; this.cdr.detectChanges(); }
  }

  exportMarkdown() {
    this.exportSvc.downloadMarkdown(this.sessionsSvc.currentSongs, this.ui.chordAccidentals);
    this.ui.showToast('Markdown exported');
  }

  // Browser print, not the jsPDF path. printingSet stays false here, so
  // SongEditorComponent's normal single-song view is what gets printed.
  printSong() {
    this.sessionsSvc.closeExportModal();
    window.print();
  }

  // Reveals every song's chart (normally not rendered at all — see
  // ui.printingSet) for the duration of the print, then reverts once the
  // print dialog closes. 'afterprint' fires whether the user prints or
  // cancels, so this can't get stuck on. printingSet is set a tick before
  // window.print() so the print-only content has actually rendered by the
  // time the (synchronous, blocking) print dialog opens.
  printSet() {
    this.sessionsSvc.closeExportModal();
    this.ui.printingSet.set(true);
    document.body.classList.add('print-set');
    setTimeout(() => {
      const cleanup = () => {
        document.body.classList.remove('print-set');
        this.ui.printingSet.set(false);
        window.removeEventListener('afterprint', cleanup);
      };
      window.addEventListener('afterprint', cleanup);
      window.print();
    }, 50);
  }
}
