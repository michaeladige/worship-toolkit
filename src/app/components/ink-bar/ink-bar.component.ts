import { Component, EventEmitter, Input, Output } from '@angular/core';
import { HIGHLIGHTER_COLORS, InkService, InkTool, PEN_COLORS } from '../../services/ink.service';
import { UiSettingsService } from '../../services/ui-settings.service';

/**
 * Pen/highlighter/eraser tools for freehand ink — shown under the editor
 * toolbar, or floating above the stage-mode bar (`floating`). The strokes
 * themselves are captured by SongSectionComponent; this only edits the shared
 * InkService tool state and forwards undo / clear to the editor.
 */
@Component({
  selector: 'app-ink-bar',
  standalone: true,
  templateUrl: './ink-bar.component.html',
  styleUrl: './ink-bar.component.scss',
})
export class InkBarComponent {
  @Input() floating = false;
  @Input() hasInk = false;
  @Input() canUndo = false;
  @Output() undo = new EventEmitter<void>();
  @Output() clearInk = new EventEmitter<void>();

  readonly penColors = PEN_COLORS;
  readonly highlighterColors = HIGHLIGHTER_COLORS;

  constructor(
    public ink: InkService,
    public ui: UiSettingsService,
  ) {}

  get colors(): readonly string[] {
    return this.ink.tool() === 'highlighter' ? this.highlighterColors : this.penColors;
  }

  get activeColor(): string {
    return this.ink.tool() === 'highlighter' ? this.ink.highlighterColor() : this.ink.penColor();
  }

  setTool(tool: InkTool) {
    this.ink.tool.set(tool);
  }

  setColor(color: string) {
    if (this.ink.tool() === 'highlighter') this.ink.highlighterColor.set(color);
    else this.ink.penColor.set(color);
  }

  swatch(color: string): string {
    return color === 'auto' ? 'var(--color-text)' : color;
  }

  colorName(color: string): string {
    const names: Record<string, string> = {
      auto: 'Black',
      '#dc2626': 'Red',
      '#2563eb': 'Blue',
      '#16a34a': 'Green',
      '#facc15': 'Yellow',
      '#4ade80': 'Green',
      '#f472b6': 'Pink',
      '#38bdf8': 'Blue',
    };
    return this.ui.t(names[color] ?? color);
  }
}
