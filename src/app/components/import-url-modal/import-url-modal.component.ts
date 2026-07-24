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
  urlsText = '';
  isLoading = false;
  progress: { done: number; total: number } | null = null;
  errors: { url: string; message: string }[] = [];

  constructor(
    public sessionsSvc: SessionsService,
    public ui: UiSettingsService,
    public ug: UltimateGuitarService,
    private cdr: ChangeDetectorRef,
  ) {}

  // How many Ultimate Guitar links the sanitizer found in the pasted text —
  // shown live under the textarea and used to enable the Import button.
  get foundCount(): number {
    return this.ug.extractUrls(this.urlsText).length;
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (!this.isLoading) this.sessionsSvc.closeImportUrlModal();
  }

  onBackdropClick(e: MouseEvent) {
    if (!this.isLoading && (e.target as HTMLElement).classList.contains('modal-backdrop'))
      this.sessionsSvc.closeImportUrlModal();
  }

  async submit() {
    const urls = this.ug.extractUrls(this.urlsText);
    if (!urls.length || this.isLoading) return;
    this.isLoading = true;
    this.errors = [];
    this.progress = { done: 0, total: urls.length };
    this.cdr.detectChanges();
    try {
      const { songs, errors } = await this.ug.importFromUrls(urls, (done, total) => {
        this.progress = { done, total };
        this.cdr.detectChanges();
      });
      if (songs.length) this.sessionsSvc.appendSongs(songs);
      if (errors.length === 0) {
        this.ui.showToast(songs.length === 1 ? 'Song imported' : 'Songs imported');
        this.urlsText = '';
        this.sessionsSvc.closeImportUrlModal();
      } else {
        this.errors = errors;
        // Keep only the failed URLs in the box so re-submitting retries just those.
        this.urlsText = errors.map(e => e.url).join('\n');
        this.ui.showToast("Some songs couldn't be imported.", 'error');
      }
    } finally {
      this.isLoading = false;
      this.progress = null;
      this.cdr.detectChanges();
    }
  }
}
