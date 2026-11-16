import { AfterViewInit, Directive, ElementRef, OnDestroy } from '@angular/core';

export interface InkAnchor {
  el: HTMLElement;
  x: number; // client px of the anchor's content-box left edge
  y: number; // client px of the anchor's content-box top edge
  chPx: number; // px per ch of the anchor's font
  emPx: number; // px per em of the anchor's font
  fontFamily: string;
}

// The element a line's ink coordinates are relative to: its lyric row, or —
// for a chords-only line (interlude bars etc.) — its chord row. Measured
// fresh every time rather than cached, since text size, the font preference,
// edit vs. view-only affordances, and column layout all move it.
export function measureInkAnchor(lineGroup: HTMLElement): InkAnchor | null {
  const el =
    lineGroup.querySelector<HTMLElement>('.lyric-row') ??
    lineGroup.querySelector<HTMLElement>('.chord-row') ??
    lineGroup.querySelector<HTMLElement>('.line-body');
  if (!el) return null;
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  const emPx = parseFloat(cs.fontSize) || 13;
  // 1ch can't be read from computed style; measure it with a detached probe
  // in the same font (never inside the lyric row itself — it's contentEditable).
  const probe = document.createElement('span');
  probe.style.cssText =
    `position:absolute;visibility:hidden;width:1ch;` +
    `font-family:${cs.fontFamily};font-size:${cs.fontSize};`;
  document.body.appendChild(probe);
  const chPx = probe.getBoundingClientRect().width || emPx * 0.6;
  probe.remove();
  return {
    el,
    x: r.left + (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.borderLeftWidth) || 0),
    y: r.top + (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.borderTopWidth) || 0),
    chPx,
    emPx,
    fontFamily: cs.fontFamily,
  };
}

/**
 * Pins a line's ink <svg> onto that line's lyric (or chord) row.
 *
 * The svg can't simply live inside the row: `.line-body` scrolls horizontally
 * and fades its right edge, which would clip every stroke that strays above,
 * below or past the line — and circling a chord or arrowing between lines is
 * exactly what pen markup does. So the svg sits in the unclipped `.line-group`
 * and is positioned (and font-matched, so its 1ch × 1em viewBox lines up with
 * the text) from a measurement of the row, redone whenever the line, the row,
 * or the row's horizontal scroll moves.
 */
@Directive({
  selector: 'svg[appInkLayer]',
  standalone: true,
})
export class InkLayerDirective implements AfterViewInit, OnDestroy {
  private ro: ResizeObserver | null = null;
  private scroller: HTMLElement | null = null;
  private readonly onScroll = () => this.position();

  constructor(private host: ElementRef<SVGSVGElement>) {}

  ngAfterViewInit() {
    this.position();
    const lineGroup = this.host.nativeElement.parentElement;
    if (!lineGroup || typeof ResizeObserver === 'undefined') return;
    this.ro = new ResizeObserver(() => this.position());
    this.ro.observe(lineGroup);
    const body = lineGroup.querySelector<HTMLElement>('.line-body');
    if (body) {
      this.ro.observe(body);
      this.scroller = body;
      body.addEventListener('scroll', this.onScroll, { passive: true });
    }
  }

  ngOnDestroy() {
    this.ro?.disconnect();
    this.scroller?.removeEventListener('scroll', this.onScroll);
  }

  private position() {
    const svg = this.host.nativeElement;
    const lineGroup = svg.parentElement;
    if (!lineGroup) return;
    const anchor = measureInkAnchor(lineGroup);
    if (!anchor) return;
    const g = lineGroup.getBoundingClientRect();
    svg.style.left = `${anchor.x - g.left}px`;
    svg.style.top = `${anchor.y - g.top}px`;
    svg.style.fontSize = `${anchor.emPx}px`;
    svg.style.fontFamily = anchor.fontFamily;
  }
}
