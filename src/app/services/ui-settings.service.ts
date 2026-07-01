import { Injectable, ApplicationRef } from '@angular/core';

const THEME_KEY = 'worship_toolkit_theme';
const FONT_SIZE_KEY = 'worship_toolkit_font_size';
const LATIN_MODE_KEY = 'worship_toolkit_latin_mode';

@Injectable({ providedIn: 'root' })
export class UiSettingsService {
  theme: 'light' | 'dark' = 'light';
  fontSize = 14;
  readonly fontSizes = [13, 14, 16, 18, 20];

  latinMode = false;
  toastMsg = '';
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private appRef: ApplicationRef) {}

  init() {
    const savedTheme = localStorage.getItem(THEME_KEY) as 'light' | 'dark' | null;
    this.theme = (savedTheme === 'light' || savedTheme === 'dark')
      ? savedTheme
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    this.applyTheme();

    const savedSize = parseInt(localStorage.getItem(FONT_SIZE_KEY) ?? '', 10);
    if (this.fontSizes.includes(savedSize)) this.fontSize = savedSize;
    this.applyFontSize();

    this.latinMode = localStorage.getItem(LATIN_MODE_KEY) === 'true';
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

  toggleLatinMode() {
    this.setLatinMode(!this.latinMode);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastMsg = this.latinMode
      ? 'Modus Latinus Activatus 🏛️'
      : 'Modus Latinus Deactivatus';
    this.toastTimer = setTimeout(() => {
      this.toastMsg = '';
      this.appRef.tick();
    }, 3000);
  }

  setLatinMode(mode: boolean) {
    this.latinMode = mode;
    localStorage.setItem(LATIN_MODE_KEY, String(mode));
  }

  t(en: string, la: string): string {
    return this.latinMode ? la : en;
  }

  private applyTheme() {
    document.documentElement.setAttribute('data-theme', this.theme);
  }

  private applyFontSize() {
    document.documentElement.style.fontSize = this.fontSize + 'px';
  }
}
