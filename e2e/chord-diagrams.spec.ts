import { test, expect, type Page } from '@playwright/test';

const SEED_SONG = [
  {
    id: 'seed-1',
    title: 'Diagram Song',
    authors: [],
    key: 'D',
    originalKey: 'D',
    tempo: '',
    timeSignature: '4/4',
    sections: [
      {
        name: 'VERSE',
        lines: [
          {
            chords: [
              { chord: 'D', xPercent: 0, charPos: 0 },
              { chord: 'G', xPercent: 33, charPos: 6 },
              { chord: 'A', xPercent: 66, charPos: 12 },
            ],
            lyric: 'great is your faithfulness',
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

async function openSeeded(page: Page) {
  await page.addInitScript((s) => {
    localStorage.setItem('worship_toolkit_session', JSON.stringify(s));
  }, SEED_SONG);
  await page.goto('/');
  await expect(page.locator('h2.song-title')).toHaveText('Diagram Song');
  await expect(page.locator('.chord-btn').first()).toBeVisible();
}

const diagramsToggle = (page: Page) => page.locator('.toggle-btn', { hasText: 'Diagrams' });

test.describe('Chord diagrams', () => {
  test('toggle shows and hides the diagram strip with one diagram per distinct chord', async ({
    page,
  }) => {
    await openSeeded(page);
    await expect(page.locator('.diagram-strip')).not.toBeAttached();

    await diagramsToggle(page).click();
    const strip = page.locator('.diagram-strip');
    await expect(strip).toBeVisible();
    await expect(page.locator('.diagram')).toHaveCount(3);
    await expect(page.locator('.diagram-label')).toHaveText(['D', 'G', 'A']);

    // A known chord renders at least one finger dot.
    await expect(page.locator('.diagram').first().locator('.finger-dot')).not.toHaveCount(0);

    await diagramsToggle(page).click();
    await expect(strip).not.toBeAttached();
  });

  test('changing capo updates the rendered shape', async ({ page }) => {
    await openSeeded(page);
    await diagramsToggle(page).click();
    await expect(page.locator('.diagram-label')).toHaveText(['D', 'G', 'A']);

    await page.locator('.meta-chips .chip--btn', { hasText: '🗜️' }).click();
    await page.locator('.chip--capo .chip-select').selectOption('2');

    // Capo 2 shifts the D/G/A shapes down to C/F/G.
    await expect(page.locator('.diagram-label')).toHaveText(['C', 'F', 'G']);
    await expect(page.locator('.diagram-capo-note')).toBeVisible();
  });

  test('Nashville mode hides the diagram toggle and strip', async ({ page }) => {
    await openSeeded(page);
    await diagramsToggle(page).click();
    await expect(page.locator('.diagram-strip')).toBeVisible();

    await page.locator('.toggle-btn', { hasText: '1 2 3' }).first().click();
    await expect(page.locator('.diagram-strip')).not.toBeAttached();
    await expect(diagramsToggle(page)).not.toBeAttached();
  });

  test('exporting a Song PDF with diagrams enabled succeeds without error', async ({ page }) => {
    await openSeeded(page);
    await diagramsToggle(page).click();

    await page.locator('.ui-ctrl-btn', { hasText: 'Export' }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.locator('.export-option', { hasText: 'Song PDF' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('worship-set.pdf');

    // No error toast should follow a successful export.
    await expect(page.locator('.latin-toast')).not.toHaveClass(/toast--error/);
  });

  test('switching to Ukulele in Settings re-renders with 4 strings', async ({ page }) => {
    await openSeeded(page);
    await diagramsToggle(page).click();

    const firstStrings = page.locator('.diagram').first().locator('.string-line');
    await expect(firstStrings).toHaveCount(6);

    await page.locator('.ui-ctrl-btn', { hasText: 'Settings' }).click();
    await page.locator('.seg-btn', { hasText: 'Ukulele' }).click();
    await page.locator('.close-btn').click();

    await expect(firstStrings).toHaveCount(4);
  });
});
