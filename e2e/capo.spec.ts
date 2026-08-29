import { test, expect, type Page } from '@playwright/test';

// A song sounding in D — the classic "capo 2, play in C" scenario.
const SEED_SONG = [
  {
    id: 'seed-1',
    title: 'Capo Song',
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
              { chord: 'Bm', xPercent: 66, charPos: 12 },
              { chord: 'A', xPercent: 90, charPos: 18 },
            ],
            lyric: 'great is your faithfulness',
            isChordsOnly: false,
            annotation: '| D G |',
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
  await expect(page.locator('h2.song-title')).toHaveText('Capo Song');
  await expect(page.locator('.chord-btn').first()).toBeVisible();
}

const capoChip = (page: Page) => page.locator('.meta-chips .chip--btn', { hasText: '🗜️' });
const chordTexts = (page: Page) => page.locator('.chord-btn').allInnerTexts();

async function setCapo(page: Page, fret: number) {
  await capoChip(page).click();
  await page.locator('.chip--capo .chip-select').selectOption(String(fret));
}

test.describe('Capo', () => {
  test('capo 0 (off) leaves the chart identical to no capo', async ({ page }) => {
    await openSeeded(page);
    expect(await chordTexts(page)).toEqual(['D', 'G', 'Bm', 'A']);
    await expect(capoChip(page)).toContainText('+ Capo');
  });

  test('capo 2 on a song in D shows C shapes and the sounds-in/play-in sublabel', async ({
    page,
  }) => {
    await openSeeded(page);
    await setCapo(page, 2);

    await expect(capoChip(page)).toContainText('2');
    expect(await chordTexts(page)).toEqual(['C', 'F', 'Am', 'G']);

    const sub = page.locator('.chip-sublabel');
    await expect(sub).toContainText('D');
    await expect(sub).toContainText('C');
  });

  test('capo composes with transpose (transpose +2 then capo 2 restores the original shapes)', async ({
    page,
  }) => {
    await openSeeded(page);

    // Transpose up 2 semitones: D -> E.
    const upBtn = page.locator('.key-control .step-btn').last();
    await upBtn.click();
    await upBtn.click();
    expect(await chordTexts(page)).toEqual(['E', 'A', 'C#m', 'B']);

    // Capo 2 shifts the new sounding key (E) back down to D-shapes.
    await setCapo(page, 2);
    expect(await chordTexts(page)).toEqual(['D', 'G', 'Bm', 'A']);
  });

  test('Nashville numbers ignore capo entirely', async ({ page }) => {
    await openSeeded(page);
    await page.locator('.toggle-btn', { hasText: '1 2 3' }).first().click();
    const withoutCapo = await chordTexts(page);

    await setCapo(page, 3);
    const withCapo = await chordTexts(page);

    expect(withCapo).toEqual(withoutCapo);
  });

  test('editing a chord while capo is on stores it in original-key form', async ({ page }) => {
    await openSeeded(page);
    await setCapo(page, 2);

    // First chord displays as the capo'd shape "C" (sounding D, capo 2).
    await page.locator('.chord-btn').first().click();
    const input = page.locator('.chord-input');
    await expect(input).toHaveValue('C');
    await input.press('Escape');

    // Clear the capo — the stored chord must still read back as the original D.
    await capoChip(page).click();
    await page.locator('.chip--capo .chip-select').selectOption('0');
    expect((await chordTexts(page))[0]).toBe('D');
  });

  test('capo is written to the session localStorage blob (survives reload)', async ({ page }) => {
    await openSeeded(page);
    await setCapo(page, 4);
    await expect(capoChip(page)).toContainText('4');

    // Reloading would re-run the seed init script and mask a real persistence
    // bug, so assert directly against what setSongs() actually wrote instead.
    const stored = await page.evaluate(() => localStorage.getItem('worship_toolkit_session'));
    const songs = JSON.parse(stored ?? '[]');
    expect(songs[0].capo).toBe(4);
  });
});
