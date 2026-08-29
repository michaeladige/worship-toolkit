import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ParsedSong } from '../../models/song.model';
import { ChordService } from '../../services/chord.service';
import { UiSettingsService } from '../../services/ui-settings.service';
import { chordShape, ChordShapeDiagram } from '../../data/chord-shapes';

export interface DiagramEntry {
  label: string;
  shape: ChordShapeDiagram | null;
}

// Ukulele diagrams draw 4 strings, guitar 6 — everything else about the SVG
// (fret spacing, dot sizing) stays the same regardless of string count.
const STRING_COUNT: Record<'guitar' | 'ukulele', number> = { guitar: 6, ukulele: 4 };

@Component({
  selector: 'app-chord-diagrams',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chord-diagrams.component.html',
  styleUrl: './chord-diagrams.component.scss',
})
export class ChordDiagramsComponent {
  @Input({ required: true }) song!: ParsedSong;

  constructor(
    private chordSvc: ChordService,
    public ui: UiSettingsService,
  ) {}

  get stringCount(): number {
    return STRING_COUNT[this.ui.chordInstrument];
  }

  // Every distinct chord shape used in the song, in the shape actually
  // played right now (transpose + capo already applied via ChordService).
  // Slash-chord bass notes aren't shown — see chordShape()'s own note on
  // why the fretting only reflects the upper-structure root + quality.
  get diagrams(): DiagramEntry[] {
    const instrument = this.ui.chordInstrument;
    return this.chordSvc.distinctChordLabels(this.song, this.ui.chordAccidentals).map((label) => {
      const parsed = this.chordSvc.parseChord(label);
      const shape = parsed ? chordShape(parsed.root, parsed.suffix, instrument) : null;
      return { label, shape };
    });
  }

  trackDiagram(_i: number, entry: DiagramEntry): string {
    return entry.label;
  }

  // ── SVG geometry ────────────────────────────────────────────────────────
  readonly fretRows = [1, 2, 3, 4];

  stringIndices(): number[] {
    return Array.from({ length: this.stringCount }, (_, i) => i);
  }

  stringX(i: number): number {
    return 10 + i * (60 / (this.stringCount - 1));
  }

  fretY(row: number): number {
    return 14 + row * 16;
  }

  dotY(fret: number): number {
    return this.fretY(fret) - 8;
  }

  isMuted(shape: ChordShapeDiagram, i: number): boolean {
    return shape.frets[i] === -1;
  }

  isOpen(shape: ChordShapeDiagram, i: number): boolean {
    return shape.frets[i] === 0;
  }

  relFret(shape: ChordShapeDiagram, i: number): number {
    const f = shape.frets[i];
    return f > 0 ? f - shape.baseFret + 1 : 0;
  }

  // The row (1-based, within the 4-fret window drawn) a barre bar sits on.
  barreRelRow(shape: ChordShapeDiagram): number {
    return (shape.barreFret ?? 0) - shape.baseFret + 1;
  }

  // Which strings the barre spans, for drawing a single bar across them
  // instead of one dot per string.
  barreStringRange(shape: ChordShapeDiagram): { from: number; to: number } | null {
    if (shape.barreFret === undefined) return null;
    const row = this.barreRelRow(shape);
    const indices = shape.frets
      .map((f, i) => ({ i, rel: this.relFret(shape, i) }))
      .filter((e) => e.rel === row)
      .map((e) => e.i);
    if (indices.length < 2) return null;
    return { from: Math.min(...indices), to: Math.max(...indices) };
  }
}
