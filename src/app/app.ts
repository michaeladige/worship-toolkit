import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { UiSettingsService } from './services/ui-settings.service';
import { SessionsService } from './services/sessions.service';
import { SessionsModalComponent } from './components/sessions-modal/sessions-modal.component';
import { ExportModalComponent } from './components/export-modal/export-modal.component';
import { SettingsModalComponent } from './components/settings-modal/settings-modal.component';
import { ShortcutsModalComponent } from './components/shortcuts-modal/shortcuts-modal.component';
import { version } from '../../package.json';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet,
            SessionsModalComponent, ExportModalComponent, SettingsModalComponent,
            ShortcutsModalComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  readonly version = version;

  constructor(
    public ui: UiSettingsService,
    public sessionsSvc: SessionsService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.ui.init();
  }

  // If the user leaves system fullscreen (system Esc / swipe), stage mode's
  // CSS layout should exit with it rather than staying header-less.
  @HostListener('document:fullscreenchange')
  onFullscreenChange() {
    if (!document.fullscreenElement && this.ui.stageMode()) {
      this.ui.stageMode.set(false);
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
