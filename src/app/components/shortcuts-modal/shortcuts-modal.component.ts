import { Component, HostListener } from '@angular/core';
import { UiSettingsService } from '../../services/ui-settings.service';

@Component({
  selector: 'app-shortcuts-modal',
  standalone: true,
  imports: [],
  templateUrl: './shortcuts-modal.component.html',
  styleUrl: './shortcuts-modal.component.scss',
})
export class ShortcutsModalComponent {
  constructor(public ui: UiSettingsService) {}

  @HostListener('document:keydown.escape')
  onEscape() { this.ui.showShortcutsModal = false; }

  onBackdropClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('modal-backdrop'))
      this.ui.showShortcutsModal = false;
  }
}
