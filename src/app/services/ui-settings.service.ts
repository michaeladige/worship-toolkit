import { Injectable, signal } from '@angular/core';
import { Accidentals } from './chord.service';

const PREFS_KEY = 'worship_toolkit_prefs';

// Legacy keys — read once on migration, then removed
const LEGACY_THEME_KEY    = 'worship_toolkit_theme';
const LEGACY_FONT_KEY     = 'worship_toolkit_font_size';
const LEGACY_LATIN_KEY    = 'worship_toolkit_latin_mode';

@Injectable({ providedIn: 'root' })
export class UiSettingsService {
  theme: 'light' | 'dark' = 'light';
  fontSize = 14;
  readonly fontSizes = [13, 14, 16, 18, 20, 24, 28, 32];

  pdfFontSize = 14;
  readonly pdfFontSizes = [10, 12, 14, 16, 18, 20];

  chordAccidentals: Accidentals = 'auto';

  latinMode = false;
  readonly toastMsg = signal('');
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  showSettingsModal = false;
  openSettingsModal()  { this.showSettingsModal = true; }
  closeSettingsModal() { this.showSettingsModal = false; }

  init() {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      try {
        const p = JSON.parse(raw) as Partial<{ theme: string; fontSize: number; latinMode: boolean }>;
        this.theme    = (p.theme === 'light' || p.theme === 'dark') ? p.theme
                      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        const sz = p.fontSize ?? 14;
        this.fontSize = this.fontSizes.includes(sz) ? sz : 14;
        const psz = (p as any).pdfFontSize ?? 14;
        this.pdfFontSize = this.pdfFontSizes.includes(psz) ? psz : 14;
        const acc = (p as any).chordAccidentals;
        this.chordAccidentals = (acc === 'sharps' || acc === 'flats') ? acc : 'auto';
        this.latinMode = p.latinMode === true;
      } catch {
        this.theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
    } else {
      // Migrate from legacy individual keys
      const oldTheme = localStorage.getItem(LEGACY_THEME_KEY) as 'light' | 'dark' | null;
      this.theme = (oldTheme === 'light' || oldTheme === 'dark') ? oldTheme
                 : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      const oldSize = parseInt(localStorage.getItem(LEGACY_FONT_KEY) ?? '', 10);
      if (this.fontSizes.includes(oldSize)) this.fontSize = oldSize;
      this.latinMode = localStorage.getItem(LEGACY_LATIN_KEY) === 'true';
      this.savePrefs();
      [LEGACY_THEME_KEY, LEGACY_FONT_KEY, LEGACY_LATIN_KEY].forEach(k => localStorage.removeItem(k));
    }
    this.applyTheme();
    this.applyFontSize();
  }

  private savePrefs() {
    localStorage.setItem(PREFS_KEY, JSON.stringify({
      theme: this.theme,
      fontSize: this.fontSize,
      pdfFontSize: this.pdfFontSize,
      chordAccidentals: this.chordAccidentals,
      latinMode: this.latinMode,
    }));
  }

  toggleTheme() {
    this.theme = this.theme === 'light' ? 'dark' : 'light';
    this.savePrefs();
    this.applyTheme();
  }

  adjustFontSize(dir: 1 | -1) {
    const idx = this.fontSizes.indexOf(this.fontSize);
    const newIdx = Math.max(0, Math.min(this.fontSizes.length - 1, idx + dir));
    this.fontSize = this.fontSizes[newIdx];
    this.savePrefs();
    this.applyFontSize();
  }

  setChordAccidentals(val: Accidentals) {
    this.chordAccidentals = val;
    this.savePrefs();
  }

  adjustPdfFontSize(dir: 1 | -1) {
    const idx = this.pdfFontSizes.indexOf(this.pdfFontSize);
    const newIdx = Math.max(0, Math.min(this.pdfFontSizes.length - 1, idx + dir));
    this.pdfFontSize = this.pdfFontSizes[newIdx];
    this.savePrefs();
  }

  toggleLatinMode() {
    this.setLatinMode(!this.latinMode);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastMsg.set(this.latinMode ? 'Modus Latinus Activatus 🏛️' : 'Modus Latinus Deactivatus');
    this.toastTimer = setTimeout(() => { this.toastMsg.set(''); }, 3000);
  }

  setLatinMode(mode: boolean) {
    this.latinMode = mode;
    this.savePrefs();
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
