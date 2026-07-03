import { Component, HostListener, ChangeDetectorRef } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { UiSettingsService, ColorTheme } from '../../services/ui-settings.service';
import { version } from '../../../../package.json';

@Component({
  selector: 'app-settings-modal',
  standalone: true,
  imports: [],
  templateUrl: './settings-modal.component.html',
  styleUrl: './settings-modal.component.scss',
})
export class SettingsModalComponent {
  readonly version = version;
  checkingForUpdate = false;

  constructor(
    public ui: UiSettingsService,
    private swUpdate: SwUpdate,
    private cdr: ChangeDetectorRef,
  ) {}

  @HostListener('document:keydown.escape')
  onEscape() { this.ui.closeSettingsModal(); }

  onBackdropClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('modal-backdrop'))
      this.ui.closeSettingsModal();
  }

  // "Check for updates": ask the service worker for a newer version; if there
  // isn't one, the problem is more likely a stuck/broken registration than a
  // genuinely-current app, so fall back to unregistering it, clearing the
  // caches, and reloading — the same recovery as the manual ?ngsw-bypass
  // trick documented in the manual, without needing to know the URL param.
  async checkForUpdates() {
    if (this.checkingForUpdate) return;
    this.checkingForUpdate = true;
    this.cdr.detectChanges();
    try {
      if (!this.swUpdate.isEnabled) {
        await this.forceRefresh();
        return;
      }
      const updateFound = await this.swUpdate.checkForUpdate();
      if (updateFound) {
        this.ui.showToast('Update found — it will be ready to reload shortly.', 'info');
      } else {
        this.ui.showToast('Already on the latest version. Refreshing…', 'info');
        await this.forceRefresh();
      }
    } catch {
      this.ui.showToast('Could not check for updates — check your connection.', 'error');
    } finally {
      this.checkingForUpdate = false;
      this.cdr.detectChanges();
    }
  }

  private async forceRefresh() {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(r => r.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    document.location.reload();
  }

  colorLabel(c: ColorTheme): string {
    const labels: Record<ColorTheme, string> = {
      blue: 'Blue',
      pink: 'Pink',
      red: 'Red',
      amber: 'Amber',
      green: 'Green',
      purple: 'Purple',
      teal: 'Teal',
      orange: 'Orange',
      disco: 'Disco',
      confetti: 'Confetti',
    };
    return labels[c];
  }
}
