import { InkStroke } from '../../models/song.model';
import { InkService } from '../../services/ink.service';
import { InkAnchor, measureInkAnchor } from '../../directives/ink-layer.directive';

export interface InkCaptureHost {
  readonly ink: InkService;
  /** False while ink must not start at all (e.g. select mode). */
  canInk(): boolean;
  /** View-only/stage: controls are inert, so a pen draws even over them. */
  isLocked(): boolean;
  strokesAt(si: number, li: number): readonly InkStroke[];
  commitStroke(si: number, li: number, stroke: InkStroke): void;
  eraseStrokes(hits: { si: number; li: number; k: number }[]): void;
}

interface LineBox {
  el: HTMLElement;
  si: number;
  li: number;
  rect: DOMRect;
  anchor?: InkAnchor | null; // measured up front for the eraser only
}

// Where a press should keep its normal meaning instead of drawing: a pen tap
// on a chord opens the chord editor (where iPad Scribble / Windows Ink turn
// handwriting into the new chord), and buttons/fields/drag handles keep
// working. Only while the chart is editable — in view-only and stage mode
// these are inert anyway, so the pen draws straight over them.
const PASSTHROUGH_SELECTOR =
  'button, input, select, textarea, a, .chord-btn, .annotation-row--btn, ' +
  '.drag-handle, .line-drag-handle, .select-check';
const ALWAYS_PASSTHROUGH_SELECTOR = 'input, select, textarea';

// Erase radius around the eraser tip, in px, on top of the stroke's own half-width.
const ERASER_RADIUS_PX = 10;

/**
 * Turns pointer input over a chart into ink strokes (or erases them).
 *
 * Kept out of SongSectionComponent because it's plain DOM work: listeners
 * must be capture-phase (to win over chord-drag/CDK handlers for a pen) and
 * touchstart must be non-passive (to stop iOS/Android scrolling for a
 * stylus), neither of which Angular's (event) bindings can express — and the
 * live stroke is drawn by writing the preview path's `d` directly, not via
 * change detection, so a 240Hz pen stays smooth.
 */
export class InkCapture {
  private active: {
    pointerId: number;
    pointerType: string;
    mode: 'draw' | 'erase';
    style: Omit<InkStroke, 'points'> | null;
    pts: number[]; // client px, flattened
    lines: LineBox[];
    erased: Map<string, { si: number; li: number; k: number }>;
  } | null = null;
  private suppressClickUntil = 0;

  constructor(
    private root: HTMLElement,
    private livePath: () => SVGPathElement | undefined,
    private host: InkCaptureHost,
  ) {}

  attach() {
    this.root.addEventListener('pointerdown', this.onDown, { capture: true });
    this.root.addEventListener('touchstart', this.onTouchStart, { capture: true, passive: false });
    this.root.addEventListener('click', this.onClick, { capture: true });
    document.addEventListener('pointermove', this.onMove, { passive: false });
    document.addEventListener('pointerup', this.onUp);
    document.addEventListener('pointercancel', this.onCancel);
  }

  detach() {
    this.root.removeEventListener('pointerdown', this.onDown, { capture: true });
    this.root.removeEventListener('touchstart', this.onTouchStart, { capture: true });
    this.root.removeEventListener('click', this.onClick, { capture: true });
    document.removeEventListener('pointermove', this.onMove);
    document.removeEventListener('pointerup', this.onUp);
    document.removeEventListener('pointercancel', this.onCancel);
  }

  private wouldInk(target: EventTarget | null, pointerType: string, eraserButton: boolean): boolean {
    if (!this.host.canInk()) return false;
    if (!eraserButton && !this.host.ink.drawsWith(pointerType)) return false;
    if (!(target instanceof Element)) return true;
    if (target.closest(ALWAYS_PASSTHROUGH_SELECTOR)) return false;
    return this.host.isLocked() || !target.closest(PASSTHROUGH_SELECTOR);
  }

  private readonly onDown = (e: PointerEvent) => {
    if (this.active) return; // a second finger/pen while drawing — ignore
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // A Surface-style pen's eraser end (or barrel eraser button) reports buttons & 32.
    const eraserButton = e.pointerType === 'pen' && (e.buttons & 32) !== 0;
    if (!this.wouldInk(e.target, e.pointerType, eraserButton)) return;

    // Claim the press: no chord drag, no CDK drag, no text selection or
    // focus, no compatibility mouse events.
    e.preventDefault();
    e.stopPropagation();
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {
      /* not capturable — document listeners still see the moves */
    }

    const style = eraserButton ? null : this.host.ink.newStroke();
    const lines: LineBox[] = Array.from(
      this.root.querySelectorAll<HTMLElement>('.line-group[data-si]'),
    ).map((el) => ({
      el,
      si: Number(el.dataset['si']),
      li: Number(el.dataset['li']),
      rect: el.getBoundingClientRect(),
    }));
    // Layout can't change mid-gesture, so the eraser measures each inked
    // line's anchor once here rather than on every pointer sample.
    if (!style) {
      for (const line of lines) {
        if (this.host.strokesAt(line.si, line.li).length) line.anchor = measureInkAnchor(line.el);
      }
    }
    this.active = {
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      mode: style ? 'draw' : 'erase',
      style,
      pts: [],
      lines,
      erased: new Map(),
    };
    if (style) this.startLivePath(style, lines);
    this.addPoint(e.clientX, e.clientY);
  };

  // iOS Safari scrolls on an Apple Pencil drag unless its touchstart is
  // cancelled, and Chrome on Android does the same for a stylus — while a
  // finger must keep scrolling, so a blanket `touch-action: none` won't do.
  // Pointer events fire before their compatibility touch events, so an
  // active pen stroke already exists by now; Safari additionally labels the
  // touch itself as a stylus.
  private readonly onTouchStart = (e: TouchEvent) => {
    const stylus = Array.from(e.changedTouches).some(
      (t) => (t as Touch & { touchType?: string }).touchType === 'stylus',
    );
    if (this.active || (stylus && this.wouldInk(e.target, 'pen', false))) {
      e.preventDefault();
    }
  };

  private readonly onMove = (e: PointerEvent) => {
    if (!this.active || e.pointerId !== this.active.pointerId) return;
    e.preventDefault();
    // Coalesced events recover the samples a high-rate pen produced between
    // animation frames, so fast strokes stay smooth instead of going polygonal.
    const samples = e.getCoalescedEvents?.() ?? [];
    for (const s of samples.length ? samples : [e]) this.addPoint(s.clientX, s.clientY);
  };

  private readonly onUp = (e: PointerEvent) => {
    if (!this.active || e.pointerId !== this.active.pointerId) return;
    const stroke = this.active;
    this.active = null;
    this.clearLivePath();
    // The click that follows this pointerup isn't a tap on whatever lies beneath.
    this.suppressClickUntil = performance.now() + 400;

    if (stroke.mode === 'erase') {
      this.restoreErasePreview(stroke.erased.keys());
      if (stroke.erased.size) this.host.eraseStrokes([...stroke.erased.values()]);
      return;
    }
    this.commit(stroke.pts, stroke.style!, stroke.lines);
  };

  private readonly onCancel = (e: PointerEvent) => {
    if (!this.active || e.pointerId !== this.active.pointerId) return;
    // The browser took the gesture over (e.g. began scrolling) — drop it.
    this.restoreErasePreview(this.active.erased.keys());
    this.active = null;
    this.clearLivePath();
  };

  private readonly onClick = (e: MouseEvent) => {
    if (performance.now() < this.suppressClickUntil) {
      this.suppressClickUntil = 0;
      e.preventDefault();
      e.stopPropagation();
    }
  };

  private addPoint(x: number, y: number) {
    const a = this.active!;
    if (a.mode === 'erase') {
      this.eraseAt(x, y);
      return;
    }
    const n = a.pts.length;
    // Drop sub-pixel jitter; simplify() thins the rest on commit.
    if (n >= 2 && Math.abs(a.pts[n - 2] - x) < 0.5 && Math.abs(a.pts[n - 1] - y) < 0.5) return;
    a.pts.push(x, y);
    const path = this.livePath();
    if (path) {
      let d = `M${a.pts[0]} ${a.pts[1]}`;
      for (let i = 2; i < a.pts.length; i += 2) d += `L${a.pts[i]} ${a.pts[i + 1]}`;
      if (a.pts.length === 2) d += `L${a.pts[0]} ${a.pts[1]}`;
      path.setAttribute('d', d);
    }
  }

  // A stroke belongs to the line it starts on (or the nearest line, if it
  // starts in a gap), and is stored relative to that line's anchor even
  // where it wanders over its neighbours — so it moves as one piece with
  // that line and is never split across lines.
  private commit(pts: number[], style: Omit<InkStroke, 'points'>, lines: LineBox[]) {
    if (!pts.length || !lines.length) return;
    const [x0, y0] = pts;
    let best: LineBox | null = null;
    let bestDist = Infinity;
    for (const line of lines) {
      const r = line.rect;
      const dy = y0 < r.top ? r.top - y0 : y0 > r.bottom ? y0 - r.bottom : 0;
      const dx = x0 < r.left ? r.left - x0 : x0 > r.right ? x0 - r.right : 0;
      const dist = dy * 4 + dx; // vertical distance decides the line
      if (dist < bestDist) {
        bestDist = dist;
        best = line;
      }
    }
    if (!best) return;
    const anchor = measureInkAnchor(best.el);
    if (!anchor) return;
    const local: number[] = [];
    for (let i = 0; i < pts.length; i += 2) {
      local.push((pts[i] - anchor.x) / anchor.chPx, (pts[i + 1] - anchor.y) / anchor.emPx);
    }
    this.host.commitStroke(best.si, best.li, {
      ...style,
      points: InkService.simplify(local),
    });
  }

  private eraseAt(x: number, y: number) {
    const a = this.active!;
    for (const line of a.lines) {
      const anchor = line.anchor;
      if (!anchor) continue;
      const r = line.rect;
      if (y < r.top - 200 || y > r.bottom + 200) continue; // strokes rarely stray further
      this.host.strokesAt(line.si, line.li).forEach((stroke, k) => {
        const key = `${line.si}:${line.li}:${k}`;
        if (a.erased.has(key)) return;
        const pts = stroke.points;
        const half = stroke.width * anchor.emPx * 0.5;
        const reach = (ERASER_RADIUS_PX + half) ** 2;
        const px = (i: number) => anchor.x + pts[i] * anchor.chPx;
        const py = (i: number) => anchor.y + pts[i + 1] * anchor.emPx;
        let hit = pts.length === 2 && InkService.segDistSq(x, y, px(0), py(0), px(0), py(0)) <= reach;
        for (let i = 0; !hit && i + 3 < pts.length; i += 2) {
          hit = InkService.segDistSq(x, y, px(i), py(i), px(i + 2), py(i + 2)) <= reach;
        }
        if (hit) {
          a.erased.set(key, { si: line.si, li: line.li, k });
          // Immediate feedback; the stroke is removed for real on pointerup.
          const path = line.el.querySelector<SVGPathElement>(`path[data-k="${k}"]`);
          if (path) path.style.opacity = '0.15';
        }
      });
    }
  }

  private restoreErasePreview(keys: Iterable<string>) {
    for (const key of keys) {
      const [si, li, k] = key.split(':');
      const path = this.root.querySelector<SVGPathElement>(
        `.line-group[data-si="${si}"][data-li="${li}"] path[data-k="${k}"]`,
      );
      if (path) path.style.opacity = '';
    }
  }

  private startLivePath(style: Omit<InkStroke, 'points'>, lines: LineBox[]) {
    const path = this.livePath();
    if (!path) return;
    const anchorEm = (lines[0] && measureInkAnchor(lines[0].el)?.emPx) || 13;
    path.setAttribute('d', '');
    path.style.stroke = this.host.ink.cssColor(style.color);
    path.style.strokeWidth = `${style.width * anchorEm}px`;
    path.classList.toggle('ink-hl', style.tool === 'highlighter');
  }

  private clearLivePath() {
    this.livePath()?.setAttribute('d', '');
  }
}
