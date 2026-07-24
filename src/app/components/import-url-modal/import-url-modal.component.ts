import { ChangeDetectorRef, Component, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SessionsService } from '../../services/sessions.service';
import { UiSettingsService } from '../../services/ui-settings.service';
import { UltimateGuitarService } from '../../services/ultimate-guitar.service';

@Component({
  selector: 'app-import-url-modal',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './import-url-modal.component.html',
  styleUrl: './import-url-modal.component.scss',
})
export class ImportUrlModalComponent {
  url = '';
  isLoading = false;
  error = '';

  constructor(
    public sessionsSvc: SessionsService,
    public ui: UiSettingsService,
    private ug: UltimateGuitarService,
    private cdr: ChangeDetectorRef,
  ) {}

  @HostListener('document:keydown.escape')
  onEscape() {
    if (!this.isLoading) this.sessionsSvc.closeImportUrlModal();
  }

  onBackdropClick(e: MouseEvent) {
    if (!this.isLoading && (e.target as HTMLElement).classList.contains('modal-backdrop'))
      this.sessionsSvc.closeImportUrlModal();
  }

  async submit() {
    const url = this.url.trim();
    if (!url || this.isLoading) return;
    this.isLoading = true;
    this.error = '';
    this.cdr.detectChanges();
    try {
      const songs = await this.ug.importFromUrl(url);
      this.sessionsSvc.appendSongs(songs);
      this.ui.showToast('Song imported');
      this.url = '';
      this.sessionsSvc.closeImportUrlModal();
    } catch (err) {
      this.error = err instanceof Error && err.message ? err.message : 'Import failed.';
      this.ui.showToast(this.error, 'error');
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }
}
