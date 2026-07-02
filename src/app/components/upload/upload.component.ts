import { ChangeDetectorRef, Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PdfParserService } from '../../services/pdf-parser.service';
import { ExportService } from '../../services/export.service';
import { ParsedSong } from '../../models/song.model';
import { UiSettingsService } from '../../services/ui-settings.service';

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './upload.component.html',
  styleUrl: './upload.component.scss',
})
export class UploadComponent {
  @Output() songsLoaded = new EventEmitter<ParsedSong[]>();

  isDragging = false;
  isLoading = false;
  progressText = '';
  error = '';
  fileErrors: { name: string; message: string }[] = [];
  sessionImportError = '';

  constructor(
    private parser: PdfParserService,
    private exportSvc: ExportService,
    public ui: UiSettingsService,
    private cdr: ChangeDetectorRef,
  ) {}

  onDragOver(e: DragEvent) {
    e.preventDefault();
    this.isDragging = true;
  }

  onDragLeave() {
    this.isDragging = false;
  }

  onDrop(e: DragEvent) {
    e.preventDefault();
    this.isDragging = false;
    const files = Array.from(e.dataTransfer?.files ?? []);
    if (files.length) this.processFiles(files);
  }

  onFileChange(e: Event) {
    const files = Array.from((e.target as HTMLInputElement).files ?? []);
    (e.target as HTMLInputElement).value = '';
    if (files.length) this.processFiles(files);
  }

  async onSessionFileChange(e: Event) {
    this.sessionImportError = '';
    const file = (e.target as HTMLInputElement).files?.[0];
    (e.target as HTMLInputElement).value = '';
    if (!file) return;
    try {
      const { songs } = await this.exportSvc.parseSessionFile(file);
      this.songsLoaded.emit(songs);
    } catch (err) {
      this.sessionImportError = err instanceof Error ? err.message : 'Invalid set file.';
      this.cdr.detectChanges();
    }
  }

  startFresh() {
    this.songsLoaded.emit([{
      id: crypto.randomUUID(),
      title: 'New Song',
      authors: [],
      key: 'C',
      originalKey: 'C',
      tempo: '',
      timeSignature: '4/4',
      sections: [{ name: 'VERSE', lines: [{ chords: [], lyric: '', isChordsOnly: false }] }],
      transposeSemitones: 0,
      showBassNotesOnly: false,
    }]);
  }

  // Parses every dropped/selected file sequentially (the pdfjs worker is
  // shared, so no parallel parsing) and reports per-file failures instead of
  // silently ignoring everything past the first file.
  async processFiles(files: File[]) {
    this.error = '';
    this.fileErrors = [];
    this.isLoading = true;

    const allSongs: ParsedSong[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        this.progressText = files.length > 1 ? `${i + 1} / ${files.length} — ${file.name}` : '';
        // Zoneless app: state set after an await needs an explicit render.
        this.cdr.detectChanges();
        if (!file.name.toLowerCase().endsWith('.pdf')) {
          this.fileErrors.push({ name: file.name, message: this.ui.t('Please upload a PDF file.') });
          continue;
        }
        try {
          const songs = await this.parser.parsePdf(file);
          if (songs.length === 0) {
            this.fileErrors.push({
              name: file.name,
              message: this.ui.t('No songs detected in this PDF. Make sure it is a SongSelect chord chart.'),
            });
          } else {
            allSongs.push(...songs);
          }
        } catch (err) {
          console.error(err);
          this.fileErrors.push({
            name: file.name,
            message: err instanceof Error && err.message ? err.message : this.ui.t('Failed to parse PDF. Please try again.'),
          });
        }
      }
    } finally {
      this.isLoading = false;
      this.progressText = '';
      this.cdr.detectChanges();
    }

    if (allSongs.length > 0) this.songsLoaded.emit(allSongs);
  }
}
