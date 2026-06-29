import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ParsedSong } from '../../models/song.model';
import { ChordService } from '../../services/chord.service';

@Component({
  selector: 'app-song-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './song-list.component.html',
  styleUrl: './song-list.component.scss',
})
export class SongListComponent {
  @Input() songs: ParsedSong[] = [];
  @Input() selectedIndex = 0;
  @Output() selectSong = new EventEmitter<number>();
  @Output() uploadNew = new EventEmitter<void>();

  constructor(public chordSvc: ChordService) {}

  effectiveKey(song: ParsedSong): string {
    return this.chordSvc.transposeKey(song.originalKey, song.transposeSemitones);
  }
}
