import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { UiSettingsService } from './services/ui-settings.service';
import { SessionsService } from './services/sessions.service';
import { SessionsModalComponent } from './components/sessions-modal/sessions-modal.component';
import { version } from '../../package.json';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet, SessionsModalComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  readonly version = version;

  constructor(
    public ui: UiSettingsService,
    public sessionsSvc: SessionsService,
  ) {}

  ngOnInit() {
    this.ui.init();
  }

  onNewSet() {
    if (this.sessionsSvc.currentSongs.length === 0) return;
    if (this.sessionsSvc.activeSessionId !== null) {
      this.sessionsSvc.clearWorkspace();          // named set is already autosaved → clear now
    } else {
      this.sessionsSvc.pendingNewSet = true;      // unsaved work → open panel & show confirm
      this.sessionsSvc.openModal();
    }
  }
}
