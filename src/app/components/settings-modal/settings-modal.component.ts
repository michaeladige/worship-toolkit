import { Component, HostListener } from '@angular/core';
import { UiSettingsService } from '../../services/ui-settings.service';

@Component({
  selector: 'app-settings-modal',
  standalone: true,
  imports: [],
  templateUrl: './settings-modal.component.html',
  styleUrl: './settings-modal.component.scss',
})
export class SettingsModalComponent {
  constructor(public ui: UiSettingsService) {}

  @HostListener('document:keydown.escape')
  onEscape() { this.ui.closeSettingsModal(); }

  onBackdropClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('modal-backdrop'))
      this.ui.closeSettingsModal();
  }
}
