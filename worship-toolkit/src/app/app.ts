import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ParsedSong } from './models/song.model';
import { UploadComponent } from './components/upload/upload.component';
import { SongListComponent } from './components/song-list/song-list.component';
import { SongEditorComponent } from './components/song-editor/song-editor.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, UploadComponent, SongListComponent, SongEditorComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  songs: ParsedSong[] = [];
  selectedIndex = 0;

  onSongsLoaded(songs: ParsedSong[]) {
    this.songs = songs;
    this.selectedIndex = 0;
  }

  onUploadNew() {
    this.songs = [];
    this.selectedIndex = 0;
  }

  onSelectSong(i: number) {
    this.selectedIndex = i;
  }

  onSongsChange(songs: ParsedSong[]) {
    this.songs = songs;
  }
}
