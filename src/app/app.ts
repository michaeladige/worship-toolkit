import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ParsedSong } from './models/song.model';
import { UploadComponent } from './components/upload/upload.component';
import { SongListComponent } from './components/song-list/song-list.component';
import { SongEditorComponent } from './components/song-editor/song-editor.component';

const SESSION_KEY = 'worship_toolkit_session';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, UploadComponent, SongListComponent, SongEditorComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  songs: ParsedSong[] = [];
  selectedIndex = 0;

  ngOnInit() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as ParsedSong[];
        if (Array.isArray(saved) && saved.length > 0) {
          this.songs = saved;
          this.selectedIndex = 0;
        }
      }
    } catch {
      localStorage.removeItem(SESSION_KEY);
    }
  }

  private setSongs(songs: ParsedSong[]) {
    this.songs = songs;
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(songs));
    } catch { /* storage quota exceeded */ }
  }

  onSongsLoaded(songs: ParsedSong[]) {
    this.setSongs(songs);
    this.selectedIndex = 0;
  }

  onUploadNew() {
    localStorage.removeItem(SESSION_KEY);
    this.songs = [];
    this.selectedIndex = 0;
  }

  onSelectSong(i: number) {
    this.selectedIndex = i;
  }

  onSongsChange(songs: ParsedSong[]) {
    this.setSongs(songs);
  }
}
