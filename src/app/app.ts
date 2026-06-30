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
}
