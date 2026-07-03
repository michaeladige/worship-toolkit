import { Component, Input, Output, EventEmitter, ChangeDetectorRef, ElementRef, ViewChild, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ParsedSong } from '../../models/song.model';
import { ChordService } from '../../services/chord.service';
import { SongSectionComponent } from '../song-section/song-section.component';
import { AutofocusDirective } from '../../directives/autofocus.directive';
import { UiSettingsService } from '../../services/ui-settings.service';

const QUICK_SECTIONS = ['INTRO', 'VERSE', 'CHORUS', 'PRE-CHORUS', 'BRIDGE', 'OUTRO', 'TAG'];

@Component({
  selector: 'app-song-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, SongSectionComponent, AutofocusDirective],
  templateUrl: './song-editor.component.html',
  styleUrl: './song-editor.component.scss',
})
export class SongEditorComponent implements OnDestroy, OnChanges {
  readonly Math = Math;
  readonly quickSections = QUICK_SECTIONS;

  @Input() songs: ParsedSong[] = [];
  @Input() selectedIndex = 0;
  @Input() canUndo = false;
  @Input() canRedo = false;
  @Input() fontSize = 14;
  @Output() songsChange = new EventEmitter<ParsedSong[]>();
  @Output() undo = new EventEmitter<void>();
  @Output() redo = new EventEmitter<void>();
  @Output() prevSong = new EventEmitter<void>();
  @Output() nextSong = new EventEmitter<void>();

  @ViewChild('scrollContainer') private scrollContainer?: ElementRef<HTMLDivElement>;

  newSectionName = '';
  editingTitle: string | null = null;
  editingTempo: string | null = null;
  editingTimeSignature: string | null = null;

  // Not persisted to localStorage — resets to 0 (off) every session.
  readonly maxAutoscrollSpeed = 30;
  autoscrollSpeed = 0;
  private lastAutoscrollSpeed = 5;

  private static readonly AUTOSCROLL_PX_PER_SEC_PER_LEVEL = 6;
  private autoscrollFrameId: number | null = null;
  private autoscrollLastTs: number | null = null;

  // Not persisted to localStorage — off on load, and turned off on every song switch (see ngOnChanges).
  readonly minBpm = 30;
  readonly maxBpm = 300;
  metronomeOn = false;
  bpm = 80;

  private metronomeAudioCtx: AudioContext | null = null;
  private metronomeIntervalId: number | null = null;

  constructor(
    public chordSvc: ChordService,
    private cdr: ChangeDetectorRef,
    public ui: UiSettingsService,
  ) {}

  get song(): ParsedSong {
    return this.songs[this.selectedIndex];
  }

  get effectiveKey(): string {
    return this.chordSvc.transposeKey(this.song.originalKey, this.song.transposeSemitones, this.ui.chordAccidentals);
  }

  get allKeys(): string[] {
    return this.chordSvc.allKeys(this.ui.chordAccidentals);
  }

  // The chord-editing hint only makes sense once there are chords to click.
  get songHasChords(): boolean {
    return this.song.sections.some(sec => sec.lines.some(l => l.chords.length > 0));
  }

  updateSong(updated: ParsedSong) {
    const songs = [...this.songs];
    songs[this.selectedIndex] = updated;
    this.songsChange.emit(songs);
  }

  transpose(delta: number) {
    const s = { ...this.song, transposeSemitones: this.song.transposeSemitones + delta };
    this.updateSong(s);
  }

  setKey(key: string) {
    const semitones = this.chordSvc.semitonesBetween(this.song.originalKey, key);
    this.updateSong({ ...this.song, transposeSemitones: semitones });
  }

  toggleBassNotes() {
    this.updateSong({ ...this.song, showBassNotesOnly: !this.song.showBassNotesOnly });
  }

  toggleNashville() {
    this.updateSong({ ...this.song, showNashville: !this.song.showNashville });
  }

  resetTranspose() {
    this.updateSong({ ...this.song, transposeSemitones: 0 });
  }

  startEditTitle() { this.editingTitle = this.song.title; }
  commitTitle() {
    const v = (this.editingTitle ?? '').trim();
    this.editingTitle = null;
    if (v) this.updateSong({ ...this.song, title: v });
  }
  cancelTitle() { this.editingTitle = null; }
  titleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); this.commitTitle(); }
    if (e.key === 'Escape') { this.cancelTitle(); }
  }

  startEditTempo() {
    this.editingTempo = this.song.tempo ?? '';
  }

  commitTempo() {
    if (this.editingTempo === null) return;
    const cleaned = this.editingTempo.replace(/[^\d]/g, '');
    this.editingTempo = null;
    this.setTempo(cleaned);
  }

  cancelTempo() {
    this.editingTempo = null;
  }

  tempoKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); this.commitTempo(); }
    if (e.key === 'Escape') { this.cancelTempo(); }
  }

  setTempo(value: string) {
    this.updateSong({ ...this.song, tempo: value });
  }

  startEditTimeSignature() {
    this.editingTimeSignature = this.song.timeSignature;
  }

  commitTimeSignature() {
    if (this.editingTimeSignature === null) return;
    const cleaned = this.editingTimeSignature.trim();
    this.editingTimeSignature = null;
    if (/^\d{1,2}\/\d{1,2}$/.test(cleaned)) {
      this.setTimeSignature(cleaned);
    }
  }

  cancelTimeSignature() {
    this.editingTimeSignature = null;
  }

  timeSignatureKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); this.commitTimeSignature(); }
    if (e.key === 'Escape') { this.cancelTimeSignature(); }
  }

  setTimeSignature(value: string) {
    this.updateSong({ ...this.song, timeSignature: value });
  }

  addSection(name: string) {
    const trimmed = name.trim().toUpperCase();
    if (!trimmed) return;
    const song = JSON.parse(JSON.stringify(this.song)) as ParsedSong;
    song.sections.push({
      name: trimmed,
      lines: [{ chords: [], lyric: '', isChordsOnly: false }],
    });
    this.updateSong(song);
    this.newSectionName = '';
  }

  addLineToSection(si: number) {
    const song = JSON.parse(JSON.stringify(this.song)) as ParsedSong;
    song.sections[si].lines.push({ chords: [], lyric: '', isChordsOnly: false });
    this.updateSong(song);
  }

  removeSection(si: number) {
    const song = JSON.parse(JSON.stringify(this.song)) as ParsedSong;
    song.sections.splice(si, 1);
    this.updateSong(song);
  }

  increaseAutoscrollSpeed() {
    this.setAutoscrollSpeed(this.autoscrollSpeed + 1);
  }

  decreaseAutoscrollSpeed() {
    this.setAutoscrollSpeed(this.autoscrollSpeed - 1);
  }

  toggleAutoscroll() {
    if (this.autoscrollSpeed > 0) {
      this.lastAutoscrollSpeed = this.autoscrollSpeed;
      this.setAutoscrollSpeed(0);
    } else {
      this.setAutoscrollSpeed(this.lastAutoscrollSpeed || 5);
    }
  }

  onAutoscrollSpeedInput(value: string) {
    const parsed = parseInt(value, 10);
    if (Number.isFinite(parsed)) this.setAutoscrollSpeed(parsed);
  }

  private setAutoscrollSpeed(value: number) {
    this.autoscrollSpeed = Math.max(0, Math.min(this.maxAutoscrollSpeed, value));
    if (this.autoscrollSpeed > 0) {
      if (this.autoscrollFrameId === null) this.startAutoscroll();
    } else {
      this.stopAutoscroll();
    }
  }

  private startAutoscroll() {
    this.autoscrollLastTs = null;
    const step = (ts: number) => {
      const el = this.scrollContainer?.nativeElement;
      if (el && this.autoscrollLastTs !== null) {
        const dtSeconds = (ts - this.autoscrollLastTs) / 1000;
        el.scrollTop += this.autoscrollSpeed * SongEditorComponent.AUTOSCROLL_PX_PER_SEC_PER_LEVEL * dtSeconds;
      }
      this.autoscrollLastTs = ts;
      this.autoscrollFrameId = requestAnimationFrame(step);
    };
    this.autoscrollFrameId = requestAnimationFrame(step);
  }

  private stopAutoscroll() {
    if (this.autoscrollFrameId !== null) {
      cancelAnimationFrame(this.autoscrollFrameId);
      this.autoscrollFrameId = null;
    }
    this.autoscrollLastTs = null;
  }

  toggleMetronome() {
    if (this.metronomeOn) {
      this.stopMetronome();
    } else {
      this.startMetronome();
    }
  }

  increaseBpm() {
    this.setBpm(this.bpm + 1);
  }

  decreaseBpm() {
    this.setBpm(this.bpm - 1);
  }

  onBpmInput(value: string) {
    const parsed = parseInt(value, 10);
    if (Number.isFinite(parsed)) this.setBpm(parsed);
  }

  private setBpm(value: number) {
    this.bpm = Math.max(this.minBpm, Math.min(this.maxBpm, value));
    if (this.metronomeOn) this.restartMetronomeInterval();
  }

  private startMetronome() {
    // Always re-derive from the song's own tempo rather than remembering a
    // previously hand-adjusted BPM from an earlier on/off cycle.
    const parsed = parseInt(this.song.tempo, 10);
    this.bpm = Number.isFinite(parsed) && parsed > 0
      ? Math.max(this.minBpm, Math.min(this.maxBpm, parsed))
      : 80;

    // Created/resumed inside this click handler so Safari/iOS autoplay
    // policy sees it as a genuine user gesture.
    if (!this.metronomeAudioCtx) {
      this.metronomeAudioCtx = new AudioContext();
    } else if (this.metronomeAudioCtx.state === 'suspended') {
      this.metronomeAudioCtx.resume();
    }

    this.metronomeOn = true;
    this.restartMetronomeInterval();
  }

  private restartMetronomeInterval() {
    if (this.metronomeIntervalId !== null) {
      clearInterval(this.metronomeIntervalId);
    }
    this.playMetronomeTick();
    this.metronomeIntervalId = setInterval(() => this.playMetronomeTick(), 60000 / this.bpm);
  }

  private stopMetronome() {
    this.metronomeOn = false;
    if (this.metronomeIntervalId !== null) {
      clearInterval(this.metronomeIntervalId);
      this.metronomeIntervalId = null;
    }
  }

  private playMetronomeTick() {
    const ctx = this.metronomeAudioCtx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 1000;
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.4, now + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['selectedIndex'] && !changes['selectedIndex'].firstChange) {
      this.stopMetronome();
    }
  }

  ngOnDestroy() {
    this.stopAutoscroll();
    this.stopMetronome();
    this.metronomeAudioCtx?.close();
  }
}
