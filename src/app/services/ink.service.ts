import { Injectable, signal } from '@angular/core';
import { InkStroke } from '../models/song.model';

export type InkTool = 'pen' | 'highlighter' | 'eraser';

// 'auto' renders in the current text color (dark on light, light on dark), so
// the default pen stays readable in both themes; exported PDFs use black.
export const PEN_COLORS = ['auto', '#dc2626', '#2563eb', '#16a34a'] as const;
export const HIGHLIGHTER_COLORS = ['#facc15', '#4ade80', '#f472b6', '#38bdf8'] as const;

// Stroke widths, in em of the chart's chord/lyric font — so ink thickens and
// thins with the text-size preference, same as the text it marks up.
const PEN_WIDTH_EM = 0.13;
const HIGHLIGHTER_WIDTH_EM = 1.05;

// Ramer–Douglas–Peucker tolerance (in ch/em units) applied when a stroke is
// committed. A pen reports 120–240 points/sec; nearly all of them are
// redundant once the stroke is drawn, and every point is persisted to
// localStorage (once for the working session, again for the active saved
// set), so thinning is what keeps heavily annotated sets small.
const SIMPLIFY_TOLERANCE = 0.04;

/**
 * Freehand ink ("pen annotations") state and geometry.
 *
 * The strokes themselves live on SongLine.ink (see InkStroke) so they persist,
 * undo, copy and move with their line like any other song edit. This service
 * only holds the transient tool state shared by the editor toolbar, the
 * stage-mode bar and the chart (SongSectionComponent, which captures input),
 * plus the pure helpers that turn points into SVG paths. Nothing here is
 * persisted — like stageMode/viewOnly, ink tools reset on reload.
 */
@Injectable({ providedIn: 'root' })
export class InkService {
  /** Ink tool bar open (editor toolbar or stage bar). */
  readonly barOpen = signal(false);
  readonly tool = signal<InkTool>('pen');
  readonly penColor = signal<string>('auto');
  readonly highlighterColor = signal<string>(HIGHLIGHTER_COLORS[0]);
  // A stylus always draws (that's the point of a pen), while a finger keeps
  // scrolling and a mouse keeps clicking — unless this is on, which lets
  // mouse/finger users draw too. Only effective while the bar is open, so a
  // finger can never be silently stuck in drawing mode with no visible way out.
  readonly fingerDraws = signal(false);
  readonly visible = signal(true);

  toggleBar() {
    this.barOpen.set(!this.barOpen());
  }

  /** Whether a pointer of this type should draw rather than interact. */
  drawsWith(pointerType: string): boolean {
    if (!this.visible()) return false;
    if (pointerType === 'pen') return true;
    return this.barOpen() && this.fingerDraws();
  }

  /** Style for a stroke about to be drawn with the current tool (null for the eraser). */
  newStroke(): Omit<InkStroke, 'points'> | null {
    const tool = this.tool();
    if (tool === 'eraser') return null;
    return tool === 'pen'
      ? { tool, color: this.penColor(), width: PEN_WIDTH_EM }
      : { tool, color: this.highlighterColor(), width: HIGHLIGHTER_WIDTH_EM };
  }

  /** CSS stroke color: 'auto' follows the theme's text color. */
  cssColor(color: string): string {
    return color === 'auto' ? 'currentColor' : color;
  }

  // ── Geometry ────────────────────────────────────────────────────────────────

  // Path strings are cached per stroke object: strokes are immutable once
  // committed (an edit always replaces the song via a deep clone), and the
  // template re-reads every stroke's path on each change-detection pass.
  private pathCache = new WeakMap<InkStroke, string>();

  pathD(stroke: InkStroke): string {
    let d = this.pathCache.get(stroke);
    if (d === undefined) {
      d = InkService.smoothPath(stroke.points);
      this.pathCache.set(stroke, d);
    }
    return d;
  }

  // Quadratic curves through the midpoints between samples — the standard
  // cheap smoothing for freehand input; it passes near every sample without
  // the angular "polyline" look of joining them with straight segments. A
  // single point (a tap) becomes a zero-length segment, which a round line
  // cap renders as a dot.
  static smoothPath(pts: number[]): string {
    const n = pts.length / 2;
    if (n === 0) return '';
    const f = (v: number) => +v.toFixed(3);
    if (n === 1) return `M${f(pts[0])} ${f(pts[1])}L${f(pts[0])} ${f(pts[1])}`;
    if (n === 2) return `M${f(pts[0])} ${f(pts[1])}L${f(pts[2])} ${f(pts[3])}`;
    let d = `M${f(pts[0])} ${f(pts[1])}`;
    for (let i = 1; i < n - 1; i++) {
      const x = pts[i * 2];
      const y = pts[i * 2 + 1];
      const mx = (x + pts[i * 2 + 2]) / 2;
      const my = (y + pts[i * 2 + 3]) / 2;
      d += `Q${f(x)} ${f(y)} ${f(mx)} ${f(my)}`;
    }
    d += `L${f(pts[(n - 1) * 2])} ${f(pts[(n - 1) * 2 + 1])}`;
    return d;
  }

  /** Thin a raw point list (RDP) and round it for storage. */
  static simplify(pts: number[], tolerance = SIMPLIFY_TOLERANCE): number[] {
    const n = pts.length / 2;
    if (n <= 2) return pts.map((v) => +v.toFixed(2));
    const keep = new Uint8Array(n);
    keep[0] = keep[n - 1] = 1;
    const stack: [number, number][] = [[0, n - 1]];
    while (stack.length) {
      const [a, b] = stack.pop()!;
      let maxD = 0;
      let idx = -1;
      for (let i = a + 1; i < b; i++) {
        const dd = InkService.segDistSq(
          pts[i * 2], pts[i * 2 + 1],
          pts[a * 2], pts[a * 2 + 1],
          pts[b * 2], pts[b * 2 + 1],
        );
        if (dd > maxD) {
          maxD = dd;
          idx = i;
        }
      }
      if (idx !== -1 && maxD > tolerance * tolerance) {
        keep[idx] = 1;
        stack.push([a, idx], [idx, b]);
      }
    }
    const out: number[] = [];
    for (let i = 0; i < n; i++) {
      if (keep[i]) out.push(+pts[i * 2].toFixed(2), +pts[i * 2 + 1].toFixed(2));
    }
    return out;
  }

  /** Squared distance from point P to segment AB. */
  static segDistSq(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
    const dx = bx - ax;
    const dy = by - ay;
    const len = dx * dx + dy * dy;
    let t = len ? ((px - ax) * dx + (py - ay) * dy) / len : 0;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + t * dx - px;
    const cy = ay + t * dy - py;
    return cx * cx + cy * cy;
  }
}
