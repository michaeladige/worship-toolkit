import { Component, HostListener } from '@angular/core';
import { UiSettingsService, ColorTheme, FontFamily } from '../../services/ui-settings.service';

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

  colorLabel(c: ColorTheme): string {
    const labels: Record<ColorTheme, string> = { blue: 'Blue', pink: 'Pink', red: 'Red', amber: 'Amber', green: 'Green' };
    return labels[c];
  }

  fontLabel(f: FontFamily): string {
    const labels: Record<FontFamily, string> = { courier: 'Courier New', consolas: 'Consolas', comic: 'Comic Sans MS' };
    return labels[f];
  }
}
