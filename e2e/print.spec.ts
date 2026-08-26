import { test, expect, type Page } from '@playwright/test';

const SEED_SONGS = [
  {
    id: 'seed-1',
    title: 'First Song',
    authors: ['Test Author'],
    key: 'D',
    originalKey: 'D',
    tempo: '120',
    timeSignature: '4/4',
    sections: [
      {
        name: 'VERSE',
        lines: [
          {
            chords: [{ chord: 'D', xPercent: 0, charPos: 0 }],
            lyric: 'great is your faithfulness',
            isChordsOnly: false,
          },
        ],
      },
    ],
    transposeSemitones: 0,
    showBassNotesOnly: false,
    capo: 2,
  },
  {
    id: 'seed-2',
    title: 'Second Song',
    authors: [],
    key: 'G',
    originalKey: 'G',
    tempo: '90',
    timeSignature: '3/4',
    sections: [
      {
        name: 'CHORUS',
        lines: [
          {
            chords: [{ chord: 'G', xPercent: 0, charPos: 0 }],
            lyric: 'how great',
            isChordsOnly: false,
          },
        ],
      },
    ],
    transposeSemitones: 0,
    showBassNotesOnly: false,
  },
];

async function openSeeded(page: Page) {
  await page.addInitScript((s) => {
    localStorage.setItem('worship_toolkit_session', JSON.stringify(s));
  }, SEED_SONGS);
  await page.goto('/');
  await expect(page.locator('h2.song-title')).toHaveText('First Song');
  await expect(page.locator('.chord-btn').first()).toBeVisible();
}

// Stub window.print so clicking a Print option never actually opens a real
// print dialog (which would hang headless Chromium). Deliberately does NOT
// auto-fire 'afterprint' — a real print dialog stays open until the user
// acts, so tests dispatch that event themselves once they're done inspecting
// the mid-print DOM state, then confirm cleanup actually ran.
async function stubPrint(page: Page) {
  await page.evaluate(() => {
    (window as unknown as { __printCalls: number }).__printCalls = 0;
    window.print = () => {
      (window as unknown as { __printCalls: number }).__printCalls++;
    };
  });
}

async function printCallCount(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { __printCalls?: number }).__printCalls ?? 0);
}

async function fireAfterPrint(page: Page) {
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
}

test.describe('Print layout', () => {
  test('print media hides app chrome and shows the chart with a print header', async ({ page }) => {
    await openSeeded(page);
    await page.emulateMedia({ media: 'print' });

    await expect(page.locator('.app-header')).not.toBeVisible();
    await expect(page.locator('app-song-list')).not.toBeVisible();
    await expect(page.locator('.toolbar')).not.toBeVisible();

    const printHeader = page.locator('.content .print-header').first();
    await expect(printHeader).toBeVisible();
    await expect(printHeader).toContainText('First Song');
    await expect(printHeader).toContainText('Capo 2');

    await expect(page.locator('.chord-btn').first()).toBeVisible();

    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe('rgb(255, 255, 255)');
  });

  test('"Print song" calls window.print without revealing the whole-set pages', async ({
    page,
  }) => {
    await openSeeded(page);
    await stubPrint(page);

    await page.locator('.ui-ctrl-btn', { hasText: 'Export' }).click();
    await page.locator('.export-option', { hasText: 'Print song' }).click();

    expect(await printCallCount(page)).toBe(1);
    await expect(page.locator('body')).not.toHaveClass(/print-set/);
  });

  test('"Print set" reveals every song, then reverts once printing finishes', async ({ page }) => {
    await openSeeded(page);
    await stubPrint(page);

    await page.locator('.ui-ctrl-btn', { hasText: 'Export' }).click();
    await page.locator('.export-option', { hasText: 'Print set' }).click();

    // printSet() sets ui.printingSet a tick before calling window.print(),
    // so the print-only content has time to actually render first.
    await expect(page.locator('body')).toHaveClass(/print-set/);
    const pages = page.locator('.song-print-page');
    await expect(pages).toHaveCount(2);
    await expect(pages.nth(0).locator('.print-header')).toContainText('First Song');
    await expect(pages.nth(1).locator('.print-header')).toContainText('Second Song');
    // window.print() itself fires after a short delay (past the render
    // above), so poll rather than reading the counter once immediately.
    await expect.poll(() => printCallCount(page)).toBe(1);

    // Finishing the (stubbed) print reverts both the body class and the
    // print-only content — it isn't left rendered for every future edit.
    await fireAfterPrint(page);
    await expect(page.locator('body')).not.toHaveClass(/print-set/);
    await expect(pages).toHaveCount(0);
  });

  test('dark mode with a pattern color theme still prints white, not the on-screen dark background', async ({
    page,
  }) => {
    await openSeeded(page);
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.setAttribute('data-color', 'disco');
    });
    await page.emulateMedia({ media: 'print' });

    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe('rgb(255, 255, 255)');
    const bgImage = await page.evaluate(() => getComputedStyle(document.body).backgroundImage);
    expect(bgImage).toBe('none');
  });
});
