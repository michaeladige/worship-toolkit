import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';

const SEED = [
  {
    id: 'ink-1',
    title: 'Ink Song',
    authors: [],
    key: 'G',
    originalKey: 'G',
    tempo: '',
    timeSignature: '4/4',
    sections: [
      {
        name: 'VERSE',
        lines: [
          {
            chords: [
              { chord: 'G', xPercent: 0, charPos: 0 },
              { chord: 'C', xPercent: 50, charPos: 14 },
            ],
            lyric: 'amazing grace how sweet the sound',
            isChordsOnly: false,
          },
          {
            chords: [{ chord: 'D', xPercent: 0, charPos: 4 }],
            lyric: 'that saved a wretch like me',
            isChordsOnly: false,
          },
        ],
      },
    ],
    transposeSemitones: 0,
    showBassNotesOnly: false,
    showNashville: false,
  },
];

// Same song with one stroke already on line 0: a pen line from column 8 to
// column 13 ("grace"), 0.5em below the top of the lyric row.
const SEED_WITH_INK = JSON.parse(JSON.stringify(SEED));
SEED_WITH_INK[0].sections[0].lines[0].ink = [
  { tool: 'pen', color: '#dc2626', width: 0.13, points: [8, 0.5, 13, 0.5] },
];

async function open(page: Page, seed = SEED, prefs?: Record<string, unknown>) {
  await page.addInitScript(
    ([s, p]) => {
      localStorage.setItem('worship_toolkit_session', JSON.stringify(s));
      if (p) localStorage.setItem('worship_toolkit_prefs', JSON.stringify(p));
    },
    [seed, prefs ?? null] as const,
  );
  await page.goto('/');
  await expect(page.locator('h2.song-title')).toHaveText('Ink Song');
}

// Playwright's mouse is always pointerType "mouse", so a stylus is simulated
// with real PointerEvents: pointerdown on whatever is under the first point,
// then moves/up on the document, as with a captured pointer.
async function stroke(
  page: Page,
  pts: [number, number][],
  opts: { type?: 'pen' | 'touch' | 'mouse'; buttons?: number } = {},
) {
  await page.evaluate(
    ({ pts, type, buttons }) => {
      const ev = (name: string, [x, y]: [number, number], b: number) =>
        new PointerEvent(name, {
          bubbles: true,
          cancelable: true,
          composed: true,
          pointerId: 11,
          pointerType: type,
          isPrimary: true,
          clientX: x,
          clientY: y,
          button: 0,
          buttons: b,
        });
      const target = document.elementFromPoint(pts[0][0], pts[0][1])!;
      target.dispatchEvent(ev('pointerdown', pts[0], buttons));
      for (const p of pts.slice(1)) document.dispatchEvent(ev('pointermove', p, buttons));
      document.dispatchEvent(ev('pointerup', pts[pts.length - 1], 0));
      const last = pts[pts.length - 1];
      document
        .elementFromPoint(last[0], last[1])
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: last[0], clientY: last[1] }));
    },
    { pts, type: opts.type ?? 'pen', buttons: opts.buttons ?? 1 },
  );
}

async function underline(page: Page, lineIdx: number, opts?: Parameters<typeof stroke>[2]) {
  const box = (await page.locator('.lyric-row').nth(lineIdx).boundingBox())!;
  const y = box.y + box.height - 2;
  await stroke(page, [[box.x + 10, y], [box.x + 60, y + 1], [box.x + 120, y]], opts);
}

async function storedSong(page: Page) {
  const raw = await page.evaluate(() => localStorage.getItem('worship_toolkit_session'));
  const parsed = JSON.parse(raw!);
  return (Array.isArray(parsed) ? parsed : parsed.songs)[0];
}

const inkPaths = (page: Page) => page.locator('svg.ink-layer path');

test.describe('Ink — drawing', () => {
  test('a pen stroke is saved on the line it was drawn on', async ({ page }) => {
    await open(page);
    await underline(page, 1);
    await expect(inkPaths(page)).toHaveCount(1);

    const song = await storedSong(page);
    expect(song.sections[0].lines[0].ink).toBeUndefined();
    const ink = song.sections[0].lines[1].ink;
    expect(ink).toHaveLength(1);
    expect(ink[0]).toMatchObject({ tool: 'pen', color: 'auto' });
    // Stored in (ch, em) relative to the lyric row, simplified to a few points.
    expect(ink[0].points.length).toBeGreaterThanOrEqual(4);
    expect(ink[0].points[0]).toBeGreaterThan(0.5);
    expect(ink[0].points[0]).toBeLessThan(2.5);
  });

  test('a finger or mouse does not draw unless "Finger draws" is on', async ({ page }) => {
    await open(page);
    await underline(page, 0, { type: 'touch' });
    await underline(page, 0, { type: 'mouse' });
    await expect(inkPaths(page)).toHaveCount(0);

    await page.locator('.ink-toggle-btn').click();
    await page.locator('app-ink-bar .ink-btn', { hasText: 'Finger draws' }).click();
    await underline(page, 0, { type: 'mouse' });
    await expect(inkPaths(page)).toHaveCount(1);

    // Closing the ink bar turns finger drawing back off.
    await page.locator('app-ink-bar .ink-btn--ghost').click();
    await underline(page, 1, { type: 'mouse' });
    await expect(inkPaths(page)).toHaveCount(1);
  });

  test('a pen tap on a chord opens the handwriting-friendly chord editor', async ({ page }) => {
    await open(page);
    const box = (await page.locator('.chord-btn').first().boundingBox())!;
    await stroke(page, [[box.x + box.width / 2, box.y + box.height / 2]]);
    await expect(page.locator('.chord-input.chord-input--pen')).toBeVisible();
    await expect(inkPaths(page)).toHaveCount(0);
  });

  test('in stage mode the pen draws straight over chords', async ({ page }) => {
    await open(page);
    await page.locator('.stage-btn').click();
    const box = (await page.locator('.chord-btn').first().boundingBox())!;
    await stroke(page, [[box.x - 2, box.y + 2], [box.x + box.width + 4, box.y + box.height]]);
    await expect(inkPaths(page)).toHaveCount(1);
    await expect(page.locator('.chord-input')).toHaveCount(0);
  });

  test('highlighter strokes use the highlighter color and style', async ({ page }) => {
    await open(page);
    await page.locator('.ink-toggle-btn').click();
    await page.locator('app-ink-bar .ink-btn', { hasText: 'Highlighter' }).click();
    await underline(page, 0);
    await expect(page.locator('svg.ink-layer path.ink-hl')).toHaveCount(1);
    const song = await storedSong(page);
    expect(song.sections[0].lines[0].ink[0]).toMatchObject({ tool: 'highlighter', color: '#facc15' });
  });

  test('ink stays over the same characters at a different text size', async ({ browser }) => {
    const offsets: number[] = [];
    for (const fontSize of [14, 24]) {
      const page = await browser.newPage();
      await open(page, SEED_WITH_INK, { fontSize });
      const startCh = await page.evaluate(() => {
        const path = document.querySelector('svg.ink-layer path')!;
        const lyric = path.closest('.line-group')!.querySelector('.lyric-row')!;
        const cs = getComputedStyle(lyric);
        const probe = document.createElement('span');
        probe.style.cssText = `position:absolute;width:1ch;font-family:${cs.fontFamily};font-size:${cs.fontSize}`;
        document.body.appendChild(probe);
        const ch = probe.getBoundingClientRect().width;
        probe.remove();
        const contentLeft = lyric.getBoundingClientRect().left + parseFloat(cs.paddingLeft);
        // Path bbox includes the round cap; take its centre and back out half the 5ch length.
        const r = path.getBoundingClientRect();
        return (r.left + r.width / 2 - contentLeft) / ch - 2.5;
      });
      offsets.push(startCh);
      await page.close();
    }
    expect(offsets[0]).toBeCloseTo(8, 0);
    expect(offsets[1]).toBeCloseTo(8, 0);
  });
});

test.describe('Ink — erasing & undo', () => {
  test('the eraser removes a stroke in one undoable step', async ({ page }) => {
    await open(page, SEED_WITH_INK);
    await expect(inkPaths(page)).toHaveCount(1);
    await page.locator('.ink-toggle-btn').click();
    await page.locator('app-ink-bar .ink-btn', { hasText: 'Eraser' }).click();

    const box = (await inkPaths(page).first().boundingBox())!;
    await stroke(page, [[box.x + box.width / 2, box.y + box.height / 2]]);
    await expect(inkPaths(page)).toHaveCount(0);
    expect((await storedSong(page)).sections[0].lines[0].ink).toBeUndefined();

    await page.keyboard.press('Control+z');
    await expect(inkPaths(page)).toHaveCount(1);
  });

  test("a pen's eraser end erases without switching tools", async ({ page }) => {
    await open(page, SEED_WITH_INK);
    const box = (await inkPaths(page).first().boundingBox())!;
    await stroke(page, [[box.x + box.width / 2, box.y + box.height / 2]], { buttons: 32 });
    await expect(inkPaths(page)).toHaveCount(0);
  });

  test('Clear removes all ink on the song, and Undo brings it back', async ({ page }) => {
    await open(page, SEED_WITH_INK);
    await underline(page, 1);
    await expect(inkPaths(page)).toHaveCount(2);
    await page.locator('.ink-toggle-btn').click();
    await page.locator('app-ink-bar .ink-btn--danger').click();
    await expect(inkPaths(page)).toHaveCount(0);
    await page.locator('.toast-action-btn, .toast button', { hasText: 'Undo' }).first().click();
    await expect(inkPaths(page)).toHaveCount(2);
  });

  test('Hide ink hides strokes without deleting them', async ({ page }) => {
    await open(page, SEED_WITH_INK);
    await page.locator('.ink-toggle-btn').click();
    await page.locator('app-ink-bar .ink-btn', { hasText: 'Hide ink' }).click();
    await expect(inkPaths(page)).toHaveCount(0);
    expect((await storedSong(page)).sections[0].lines[0].ink).toHaveLength(1);
  });

  test('ink moves with its line when lines are copied', async ({ page }) => {
    await open(page, SEED_WITH_INK);
    await page.locator('.select-btn').click();
    await page.locator('.line-group').first().locator('.select-check').check();
    await page.locator('.bulk-btn', { hasText: 'Duplicate' }).click();
    await expect(inkPaths(page)).toHaveCount(2);
  });
});

test.describe('Ink — PDF export', () => {
  async function exportSongPdf(page: Page, includeInk: boolean): Promise<string> {
    await page.locator('button', { hasText: 'Export' }).first().click();
    const box = page.locator('.include-ink-check');
    if (includeInk) await box.check();
    else await box.uncheck();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('.export-option', { hasText: 'Song PDF' }).click(),
    ]);
    return fs.readFileSync(await download.path()).toString('latin1');
  }

  test('ink is drawn into the PDF only when "Include pen ink" is ticked', async ({ page }) => {
    const seed = JSON.parse(JSON.stringify(SEED_WITH_INK));
    seed[0].sections[0].lines[1].ink = [
      { tool: 'highlighter', color: '#facc15', width: 1.05, points: [0, 0.6, 20, 0.6] },
    ];
    await open(page, seed);

    const without = await exportSongPdf(page, false);
    // Highlighter ink is the only thing drawn at 40% stroke opacity.
    expect(without).not.toMatch(/\/CA 0\.4/);

    await page.locator('.close-btn').click();
    const withInk = await exportSongPdf(page, true);
    expect(withInk).toMatch(/\/CA 0\.4/);
    // The red pen stroke (#dc2626 → jsPDF's 2-decimal "0.86 0.15 0.15 RG").
    expect(withInk).toContain('0.86 0.15 0.15 RG');
    expect(without).not.toContain('0.86 0.15 0.15 RG');
  });
});
