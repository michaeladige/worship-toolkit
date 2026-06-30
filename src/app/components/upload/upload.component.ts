import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PdfParserService } from '../../services/pdf-parser.service';
import { ParsedSong } from '../../models/song.model';

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
  error = '';

  constructor(private parser: PdfParserService) {}

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
    const file = e.dataTransfer?.files[0];
    if (file) this.processFile(file);
  }

  onFileChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) this.processFile(file);
  }

  async processFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      this.error = 'Please upload a PDF file.';
      return;
    }
    this.error = '';
    this.isLoading = true;
    try {
      const songs = await this.parser.parsePdf(file);
      if (songs.length === 0) {
        this.error = 'No songs detected in this PDF. Make sure it is a SongSelect chord chart.';
      } else {
        this.songsLoaded.emit(songs);
      }
    } catch (err) {
      console.error(err);
      this.error = 'Failed to parse PDF. Please try again.';
    } finally {
      this.isLoading = false;
    }
  }
}
