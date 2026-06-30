import { Injectable } from '@angular/core';

const THEME_KEY = 'worship_toolkit_theme';
const FONT_SIZE_KEY = 'worship_toolkit_font_size';

@Injectable({ providedIn: 'root' })
export class UiSettingsService {
  theme: 'light' | 'dark' = 'light';
  fontSize = 14;
  readonly fontSizes = [13, 14, 16, 18, 20];

  init() {
    const savedTheme = localStorage.getItem(THEME_KEY) as 'light' | 'dark' | null;
    this.theme = (savedTheme === 'light' || savedTheme === 'dark')
      ? savedTheme
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    this.applyTheme();

    const savedSize = parseInt(localStorage.getItem(FONT_SIZE_KEY) ?? '', 10);
    if (this.fontSizes.includes(savedSize)) this.fontSize = savedSize;
    this.applyFontSize();
  }

  toggleTheme() {
    this.theme = this.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem(THEME_KEY, this.theme);
    this.applyTheme();
  }

  adjustFontSize(dir: 1 | -1) {
    const idx = this.fontSizes.indexOf(this.fontSize);
    const newIdx = Math.max(0, Math.min(this.fontSizes.length - 1, idx + dir));
    this.fontSize = this.fontSizes[newIdx];
    localStorage.setItem(FONT_SIZE_KEY, String(this.fontSize));
    this.applyFontSize();
  }

  private applyTheme() {
    document.documentElement.setAttribute('data-theme', this.theme);
  }

  private applyFontSize() {
    document.documentElement.style.fontSize = this.fontSize + 'px';
  }
}
