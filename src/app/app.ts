import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { filter } from 'rxjs';
import { BeforeInstallPromptEvent, UiSettingsService } from './services/ui-settings.service';
import { SessionsService } from './services/sessions.service';
import { SessionsModalComponent } from './components/sessions-modal/sessions-modal.component';
import { ExportModalComponent } from './components/export-modal/export-modal.component';
import { SettingsModalComponent } from './components/settings-modal/settings-modal.component';
import { ShortcutsModalComponent } from './components/shortcuts-modal/shortcuts-modal.component';
import { ImportUrlModalComponent } from './components/import-url-modal/import-url-modal.component';
import { version } from '../../package.json';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet,
            SessionsModalComponent, ExportModalComponent, SettingsModalComponent,
            ShortcutsModalComponent, ImportUrlModalComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  readonly version = version;

  constructor(
    public ui: UiSettingsService,
    public sessionsSvc: SessionsService,
    private router: Router,
    private swUpdate: SwUpdate,
  ) {}

  ngOnInit() {
    this.ui.init();

    // Offer a reload when the service worker has a new version ready —
    // otherwise users keep the old cached app until their next full restart.
    if (this.swUpdate.isEnabled) {
      this.swUpdate.versionUpdates
        .pipe(filter(e => e.type === 'VERSION_READY'))
        .subscribe(() => {
          this.ui.showToast('A new version is available.', 'info', {
            durationMs: 0,
            action: { label: this.ui.t('Reload'), run: () => document.location.reload() },
          });
        });
    }

    // iOS Safari (and other iOS browsers) never fire beforeinstallprompt and
    // have no programmatic install API — the only path is manual
    // Share -> Add to Home Screen, so point at it once instead of staying silent.
    if (!this.ui.isStandalone && this.ui.isIos && !this.ui.hintSeen('pwa-install')) {
      this.ui.showToast(
        'Tip: tap Share, then "Add to Home Screen" to install WorshipToolkit for quick, offline access.',
        'info',
        { durationMs: 8000 },
      );
      this.ui.dismissHint('pwa-install');
    }
  }

  // Chromium fires this once it decides the app is install-eligible.
  // preventDefault() suppresses the browser's own mini-infobar so we can
  // offer install through our own toast/Settings button instead.
  @HostListener('window:beforeinstallprompt', ['$event'])
  onBeforeInstallPrompt(event: Event) {
    event.preventDefault();
    const installEvent = event as BeforeInstallPromptEvent;
    this.ui.installPromptEvent.set(installEvent);

    if (!this.ui.hintSeen('pwa-install')) {
      this.ui.showToast('Install WorshipToolkit for quick, offline access.', 'info', {
        durationMs: 8000,
        action: { label: this.ui.t('Install'), run: () => this.ui.promptInstall() },
      });
      this.ui.dismissHint('pwa-install');
    }
  }

  // Covers install via the browser's own UI too, not just our button —
  // otherwise the Settings "Install app" row could linger after install.
  @HostListener('window:appinstalled')
  onAppInstalled() {
    this.ui.installPromptEvent.set(null);
  }

  // If the user leaves system fullscreen (system Esc / swipe), stage mode's
  // CSS layout should exit with it rather than staying header-less.
  @HostListener('document:fullscreenchange')
  onFullscreenChange() {
    if (!document.fullscreenElement && this.ui.stageMode()) {
      this.ui.exitStageMode();
    }
  }

  onNewSet() {
    if (this.sessionsSvc.currentSongs.length === 0) return;
    if (this.sessionsSvc.activeSessionId !== null) {
      this.sessionsSvc.clearWorkspace();
      this.router.navigate(['/']);
    } else {
      this.sessionsSvc.pendingNewSet = true;
      this.sessionsSvc.openModal();
      this.router.navigate(['/']);
    }
  }
}
