import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { UiSettingsService } from './services/ui-settings.service';
import { version } from '../../package.json';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  readonly version = version;

  constructor(public ui: UiSettingsService) {}

  ngOnInit() {
    this.ui.init();
  }
}
