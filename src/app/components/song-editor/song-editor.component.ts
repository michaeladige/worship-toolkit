import {
  Component,
  Input,
  Output,
  EventEmitter,
  ElementRef,
  ViewChild,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ParsedSong } from '../../models/song.model';
import { ChordService } from '../../services/chord.service';
import { SongSectionComponent } from '../song-section/song-section.component';
import { ChordDiagramsComponent } from '../chord-diagrams/chord-diagrams.component';
import { AutofocusDirective } from '../../directives/autofocus.directive';
import { UiSettingsService } from '../../services/ui-settings.service';

const QUICK_SECTIONS = ['INTRO', 'VERSE', 'CHORUS', 'PRE-CHORUS', 'BRIDGE', 'OUTRO', 'TAG'];

@Component({
  selector: 'app-song-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SongSectionComponent,
    ChordDiagramsComponent,
    AutofocusDirective,
  ],
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
  private autoscrollFloatTop = 0;

  // Not persisted to localStorage — off on load, and turned off on every song switch (see ngOnChanges).
  // Signals (not plain fields): both get written from the scheduler's nested
  // setTimeout chain as well as from click handlers, and in this zoneless
  // app only a signal write reliably notifies Angular from a bare timer
  // callback — see the longer note by currentBeatInBar/beatFlash below.
  readonly minBpm = 30;
  readonly maxBpm = 300;
  readonly metronomeOn = signal(false);
  readonly bpm = signal(80);

  // Which beat of the bar is currently sounding (0 = downbeat/accent) and a
  // brief on/off flash flag the template binds to for the visual pulse —
  // both driven from the audio scheduler below via setTimeout, not a click
  // handler. This app is zoneless (see CLAUDE.md), where a plain field
  // mutated from a bare setTimeout callback never prompts a re-render —
  // only a DOM-bound event or a signal write does — so these are signals
  // rather than plain fields, matching the pattern UiSettingsService already
  // uses for its own async-driven state (stageMode, toastMsg, etc.).
  beatsPerBar = 4;
  readonly currentBeatInBar = signal(0);
  readonly beatFlash = signal(false);
  private beatFlashTimeoutId: ReturnType<typeof setTimeout> | null = null;

  private metronomeAudioCtx: AudioContext | null = null;
  // Lookahead scheduler (the standard Web Audio metronome pattern): a coarse
  // setInterval repeatedly tops up a short queue of precisely-timed audio
  // events, rather than relying on setInterval's own timing — setInterval
  // alone drifts under load exactly when a click track matters most.
  private static readonly SCHEDULE_AHEAD_SEC = 0.1;
  private static readonly LOOKAHEAD_MS = 25;
  private schedulerIntervalId: ReturnType<typeof setInterval> | null = null;
  private nextNoteTime = 0;

  // Tap tempo: a rolling window of tap timestamps; a gap over 2s starts a
  // fresh series instead of averaging across an unrelated pause.
  private tapTimes: number[] = [];

  constructor(
    public chordSvc: ChordService,
    public ui: UiSettingsService,
  ) {}

  get song(): ParsedSong {
    return this.songs[this.selectedIndex];
  }

  get effectiveKey(): string {
    return this.chordSvc.effectiveKey(this.song, this.ui.chordAccidentals);
  }

  get allKeys(): string[] {
    return this.chordSvc.allKeys(this.ui.chordAccidentals);
  }

  // The chord-editing hint only makes sense once there are chords to click.
  get songHasChords(): boolean {
    return this.song.sections.some((sec) => sec.lines.some((l) => l.chords.length > 0));
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

  // Relabel the song's base (original) key WITHOUT moving any chords — unlike
  // setKey()/transpose(), transposeSemitones is left untouched, so only the key
  // label, Nashville reference, and accidental spelling change. This is how a
  // user corrects a mis-detected or metadata-less key (e.g. Ultimate Guitar imports).
  editingBaseKey = false;

  startEditBaseKey() {
    if (this.ui.viewOnly()) return;
    this.editingBaseKey = true;
  }

  setBaseKey(key: string) {
    this.editingBaseKey = false;
    if (key && key !== this.song.originalKey) {
      this.updateSong({ ...this.song, originalKey: key });
    }
  }

  autoDetectKey() {
    const detected = this.chordSvc.detectKey(this.song.sections);
    this.editingBaseKey = false;
    if (detected !== this.song.originalKey) {
      this.updateSong({ ...this.song, originalKey: detected });
    }
    this.ui.showToast(this.ui.t('Base key set to') + ' ' + detected);
  }

  // ── Capo ─────────────────────────────────────────────────────────────────
  // Display-only: never changes the sounding key, only which fretted shape
  // produces it. See ChordService.displayChord() for the composition rules.
  readonly capoOptions = Array.from({ length: 12 }, (_, i) => i); // 0 = none

  editingCapo = false;

  get capo(): number {
    return this.song.capo ?? 0;
  }

  get shapeKey(): string {
    return this.chordSvc.shapeKey(this.song, this.ui.chordAccidentals);
  }

  // The toolbar (title/BPM/key/capo chips) is hidden in browser print output,
  // so this summary line stands in for it on paper — same info the PDF
  // export's own header line carries.
  printKeyLine(s: ParsedSong): string {
    const key = this.chordSvc.effectiveKey(s, this.ui.chordAccidentals);
    const parts = [`Key ${key}`];
    if (s.tempo) parts.push(`${s.tempo} BPM`);
    if (s.timeSignature) parts.push(s.timeSignature);
    if (s.capo)
      parts.push(`Capo ${s.capo} (play in ${this.chordSvc.shapeKey(s, this.ui.chordAccidentals)})`);
    return parts.join(' · ');
  }

  startEditCapo() {
    if (this.ui.viewOnly()) return;
    this.editingCapo = true;
  }

  setCapo(value: number | string) {
    this.editingCapo = false;
    const n = Math.max(0, Math.min(11, Math.round(Number(value)) || 0));
    if (n !== this.capo) {
      this.updateSong({ ...this.song, capo: n || undefined });
    }
  }

  toggleBassNotes() {
    this.updateSong({ ...this.song, showBassNotesOnly: !this.song.showBassNotesOnly });
  }

  toggleNashville() {
    this.updateSong({ ...this.song, showNashville: !this.song.showNashville });
  }

  toggleChordDiagrams() {
    this.updateSong({ ...this.song, showChordDiagrams: !this.song.showChordDiagrams });
  }

  // ── Notes & duration ─────────────────────────────────────────────────────
  // Commit-on-blur, like the title/tempo/time-signature chips — a draft field
  // per open/close cycle rather than writing to the song on every keystroke.
  notesOpen = false;
  notesDraft = '';
  durationDraft = '';

  toggleNotes() {
    if (this.ui.viewOnly()) return;
    if (!this.notesOpen) {
      this.notesDraft = this.song.notes ?? '';
      this.durationDraft = this.durationDisplay;
    }
    this.notesOpen = !this.notesOpen;
  }

  get durationDisplay(): string {
    const s = this.song.durationSeconds;
    if (!s) return '';
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  commitNotes() {
    const trimmed = this.notesDraft.trim();
    if (trimmed !== (this.song.notes ?? '')) {
      this.updateSong({ ...this.song, notes: trimmed || undefined });
    }
  }

  commitDuration() {
    const seconds = this.parseDuration(this.durationDraft);
    if (seconds !== this.song.durationSeconds) {
      this.updateSong({ ...this.song, durationSeconds: seconds });
    }
  }

  private parseDuration(input: string): number | undefined {
    const trimmed = input.trim();
    if (!trimmed) return undefined;
    const mmss = trimmed.match(/^(\d+):([0-5]?\d)$/);
    if (mmss) return parseInt(mmss[1], 10) * 60 + parseInt(mmss[2], 10);
    const n = parseInt(trimmed, 10);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }

  resetTranspose() {
    this.updateSong({ ...this.song, transposeSemitones: 0 });
  }

  startEditTitle() {
    if (this.ui.viewOnly()) return;
    this.editingTitle = this.song.title;
  }
  commitTitle() {
    const v = (this.editingTitle ?? '').trim();
    this.editingTitle = null;
    if (v) this.updateSong({ ...this.song, title: v });
  }
  cancelTitle() {
    this.editingTitle = null;
  }
  titleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.commitTitle();
    }
    if (e.key === 'Escape') {
      this.cancelTitle();
    }
  }

  startEditTempo() {
    if (this.ui.viewOnly()) return;
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
    if (e.key === 'Enter') {
      e.preventDefault();
      this.commitTempo();
    }
    if (e.key === 'Escape') {
      this.cancelTempo();
    }
  }

  setTempo(value: string) {
    this.updateSong({ ...this.song, tempo: value });
  }

  startEditTimeSignature() {
    if (this.ui.viewOnly()) return;
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
    if (e.key === 'Enter') {
      e.preventDefault();
      this.commitTimeSignature();
    }
    if (e.key === 'Escape') {
      this.cancelTimeSignature();
    }
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
    // Tracked separately from el.scrollTop because some browsers (notably iOS
    // Safari) round scrollTop to an integer on write — reading it back each
    // frame would throw away the sub-pixel remainder and low speeds (whose
    // per-frame delta is well under 1px) would never accumulate to a scroll.
    this.autoscrollFloatTop = this.scrollContainer?.nativeElement.scrollTop ?? 0;
    const step = (ts: number) => {
      const el = this.scrollContainer?.nativeElement;
      if (el && this.autoscrollLastTs !== null) {
        // Re-baseline if the actual scrollTop drifted from what we expect —
        // e.g. the user manually scrolled/dragged — so a manual scroll isn't
        // undone by snapping back to our tracked float on the next frame.
        if (Math.abs(el.scrollTop - this.autoscrollFloatTop) > 1) {
          this.autoscrollFloatTop = el.scrollTop;
        }
        const dtSeconds = (ts - this.autoscrollLastTs) / 1000;
        this.autoscrollFloatTop +=
          this.autoscrollSpeed * SongEditorComponent.AUTOSCROLL_PX_PER_SEC_PER_LEVEL * dtSeconds;
        el.scrollTop = this.autoscrollFloatTop;
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
    if (this.metronomeOn()) {
      this.stopMetronome();
    } else {
      this.startMetronome();
    }
  }

  increaseBpm() {
    this.setBpm(this.bpm() + 1);
  }

  decreaseBpm() {
    this.setBpm(this.bpm() - 1);
  }

  onBpmInput(value: string) {
    const parsed = parseInt(value, 10);
    if (Number.isFinite(parsed)) this.setBpm(parsed);
  }

  // Tap the beat 2+ times to set BPM directly, writing it back to the song's
  // own tempo (so it persists and feeds the next re-derive in
  // startMetronome()) rather than just nudging the transient `bpm` field.
  tapTempo() {
    const now = performance.now();
    if (this.tapTimes.length && now - this.tapTimes[this.tapTimes.length - 1] > 2000) {
      this.tapTimes = []; // stale gap — this tap starts a fresh series
    }
    this.tapTimes.push(now);
    if (this.tapTimes.length > 5) this.tapTimes.shift(); // average at most the last 4 intervals
    if (this.tapTimes.length < 2) return;

    const intervals: number[] = [];
    for (let i = 1; i < this.tapTimes.length; i++)
      intervals.push(this.tapTimes[i] - this.tapTimes[i - 1]);
    const avgMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    this.setBpm(Math.round(60000 / avgMs));
    this.setTempo(String(this.bpm()));
  }

  private setBpm(value: number) {
    this.bpm.set(Math.max(this.minBpm, Math.min(this.maxBpm, value)));
    if (this.metronomeOn()) this.restartScheduler();
  }

  private startMetronome() {
    // Always re-derive from the song's own tempo rather than remembering a
    // previously hand-adjusted BPM from an earlier on/off cycle.
    const parsed = parseInt(this.song.tempo, 10);
    this.bpm.set(
      Number.isFinite(parsed) && parsed > 0
        ? Math.max(this.minBpm, Math.min(this.maxBpm, parsed))
        : 80,
    );
    this.beatsPerBar = this.parseBeatsPerBar(this.song.timeSignature);
    this.tapTimes = [];

    // Created/resumed inside this click handler so Safari/iOS autoplay
    // policy sees it as a genuine user gesture.
    if (!this.metronomeAudioCtx) {
      this.metronomeAudioCtx = new AudioContext();
    } else if (this.metronomeAudioCtx.state === 'suspended') {
      this.metronomeAudioCtx.resume();
    }

    this.metronomeOn.set(true);

    if (this.ui.metronomeCountIn) {
      this.scheduleCountIn(() => this.restartScheduler());
    } else {
      this.restartScheduler();
    }
  }

  private parseBeatsPerBar(timeSignature: string): number {
    const n = parseInt((timeSignature || '').split('/')[0], 10);
    return Number.isFinite(n) && n >= 1 && n <= 12 ? n : 4;
  }

  // One full bar of clicks (accented on beat 1, like the real thing) played
  // silently as far as the visual indicator is concerned — it stays dark
  // through the count-in and only starts pulsing once the real beat begins,
  // so a performer can't mistake the lead-in for the downbeat.
  private scheduleCountIn(onDone: () => void) {
    const ctx = this.metronomeAudioCtx;
    if (!ctx) return;
    const secondsPerBeat = 60 / this.bpm();
    const startAt = ctx.currentTime + 0.05;
    for (let beat = 0; beat < this.beatsPerBar; beat++) {
      this.playTickAt(startAt + beat * secondsPerBeat, beat === 0);
    }
    const totalMs = this.beatsPerBar * secondsPerBeat * 1000;
    setTimeout(() => {
      if (this.metronomeOn()) onDone();
    }, totalMs);
  }

  private restartScheduler() {
    if (this.schedulerIntervalId !== null) {
      clearInterval(this.schedulerIntervalId);
    }
    if (this.beatFlashTimeoutId !== null) {
      clearTimeout(this.beatFlashTimeoutId);
      this.beatFlashTimeoutId = null;
    }
    const ctx = this.metronomeAudioCtx;
    if (!ctx) return;
    this.schedulerBeatCounter = 0;
    this.currentBeatInBar.set(0);
    this.nextNoteTime = ctx.currentTime + 0.05;
    this.schedulerLoop();
    this.schedulerIntervalId = setInterval(
      () => this.schedulerLoop(),
      SongEditorComponent.LOOKAHEAD_MS,
    );
  }

  // The scheduler's own running counter for "which beat comes next" — kept
  // separate from currentBeatInBar (the display value flashBeat() sets),
  // since the scheduler runs up to SCHEDULE_AHEAD_SEC ahead of the audio
  // actually being heard. Sharing one field between the two let the display
  // update (which fires later, at the real beat time) stomp the scheduler's
  // own lookahead position back to a stale value.
  private schedulerBeatCounter = 0;

  // The standard Web Audio lookahead scheduler: tops up a short queue of
  // precisely-timed notes on a coarse setInterval, rather than relying on
  // setInterval itself for musical timing (which drifts under load).
  private schedulerLoop() {
    const ctx = this.metronomeAudioCtx;
    if (!ctx) return;
    const secondsPerBeat = 60 / this.bpm();
    while (this.nextNoteTime < ctx.currentTime + SongEditorComponent.SCHEDULE_AHEAD_SEC) {
      this.scheduleTick(this.schedulerBeatCounter, this.nextNoteTime);
      this.nextNoteTime += secondsPerBeat;
      this.schedulerBeatCounter = (this.schedulerBeatCounter + 1) % this.beatsPerBar;
    }
  }

  private scheduleTick(beat: number, time: number) {
    const ctx = this.metronomeAudioCtx;
    if (!ctx) return;
    this.playTickAt(time, beat === 0);
    const delayMs = Math.max(0, (time - ctx.currentTime) * 1000);
    setTimeout(() => this.flashBeat(beat), delayMs);
  }

  private flashBeat(beat: number) {
    if (!this.metronomeOn()) return;
    this.currentBeatInBar.set(beat);
    this.beatFlash.set(true);
    if (this.beatFlashTimeoutId !== null) clearTimeout(this.beatFlashTimeoutId);
    this.beatFlashTimeoutId = setTimeout(
      () => {
        this.beatFlash.set(false);
      },
      Math.min(120, (60000 / this.bpm()) * 0.4),
    );
  }

  private stopMetronome() {
    this.metronomeOn.set(false);
    this.beatFlash.set(false);
    if (this.schedulerIntervalId !== null) {
      clearInterval(this.schedulerIntervalId);
      this.schedulerIntervalId = null;
    }
    if (this.beatFlashTimeoutId !== null) {
      clearTimeout(this.beatFlashTimeoutId);
      this.beatFlashTimeoutId = null;
    }
  }

  private playTickAt(time: number, accent: boolean) {
    const ctx = this.metronomeAudioCtx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = accent ? 1500 : 1000;
    const peak = accent ? 0.55 : 0.4;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(peak, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.06);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['selectedIndex'] && !changes['selectedIndex'].firstChange) {
      this.stopMetronome();
      this.notesOpen = false;
    }
  }

  ngOnDestroy() {
    this.stopAutoscroll();
    this.stopMetronome();
    this.metronomeAudioCtx?.close();
  }
}
