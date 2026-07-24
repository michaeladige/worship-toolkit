import { test, expect, type Page } from '@playwright/test';

// A deterministic song whose chords sit squarely in G major but whose stored
// base key is a deliberately-wrong 'C' — the exact situation a metadata-less
// import produces. Seeded straight into the session store so the test doesn't
// depend on PDF parsing (which the rest of the suite also avoids asserting on).
const SEED_SONG = [
  {
    id: 'seed-1',
    title: 'Seed Song',
    authors: [],
    key: 'C',
    originalKey: 'C',
    tempo: '',
    timeSignature: '4/4',
    sections: [
      {
        name: 'VERSE',
        lines: [
          {
            chords: [
              { chord: 'G', xPercent: 0, charPos: 0 },
              { chord: 'C', xPercent: 33, charPos: 6 },
              { chord: 'D', xPercent: 66, charPos: 12 },
              { chord: 'Em', xPercent: 90, charPos: 16 },
            ],
            lyric: 'sing a new song to the King',
            isChordsOnly: false,
          },
        ],
      },
    ],
    transposeSemitones: 0,
    showBassNotesOnly: false,
  },
];

// A G-major song shaped like a real Ultimate Guitar import: one VERSE opening on
// G, but a CHORUS opening on C (its IV chord) printed out three times verbatim —
// the exact repetition pattern that used to bias detectKey toward C, since a
// heavily-repeated chorus could out-vote a verse printed only once.
const CHORUS_HEAVY_SONG = [
  {
    id: 'seed-2',
    title: 'Chorus Heavy Song',
    authors: [],
    key: 'C',
    originalKey: 'C',
    tempo: '',
    timeSignature: '4/4',
    sections: [
      {
        name: 'VERSE',
        lines: [{ chords: chordLine(['G', 'D', 'Em', 'C']), lyric: 'v1', isChordsOnly: false }],
      },
      {
        name: 'CHORUS',
        lines: [{ chords: chordLine(['C', 'G', 'Am', 'D']), lyric: 'c1', isChordsOnly: false }],
      },
      {
        name: 'VERSE',
        lines: [{ chords: chordLine(['G', 'D', 'Em', 'C']), lyric: 'v2', isChordsOnly: false }],
      },
      {
        name: 'CHORUS',
        lines: [{ chords: chordLine(['C', 'G', 'Am', 'D']), lyric: 'c2', isChordsOnly: false }],
      },
      {
        name: 'CHORUS',
        lines: [{ chords: chordLine(['C', 'G', 'Am', 'D']), lyric: 'c3', isChordsOnly: false }],
      },
    ],
    transposeSemitones: 0,
    showBassNotesOnly: false,
  },
];

function chordLine(chords: string[]) {
  return chords.map((chord, i) => ({ chord, xPercent: i * 20, charPos: i * 6 }));
}

async function openSeeded(page: Page, seed: unknown[] = SEED_SONG, title = 'Seed Song') {
  await page.addInitScript((s) => {
    localStorage.setItem('worship_toolkit_session', JSON.stringify(s));
  }, seed);
  await page.goto('/');
  await expect(page.locator('h2.song-title')).toHaveText(title);
  await expect(page.locator('.chord-btn').first()).toBeVisible();
}

const baseKeyChip = (page: Page) => page.locator('.meta-chips .chip--btn', { hasText: '🔑' });
const chordTexts = (page: Page) => page.locator('.chord-btn').allInnerTexts();

test.describe('Base key', () => {
  test('relabelling the base key does not move the printed chords', async ({ page }) => {
    await openSeeded(page);

    // Sanity: chords render as written and the (wrong) base key is C.
    expect(await chordTexts(page)).toEqual(['G', 'C', 'D', 'Em']);
    await expect(baseKeyChip(page)).toContainText('C');

    // Correct the base key to G via the picker.
    await baseKeyChip(page).click();
    await page.locator('.chip--basekey .chip-select').selectOption('G');

    // The label moved to G, but every chord is byte-for-byte unchanged.
    await expect(baseKeyChip(page)).toContainText('G');
    expect(await chordTexts(page)).toEqual(['G', 'C', 'D', 'Em']);
  });

  test('auto-detect fills the base key from the chords', async ({ page }) => {
    await openSeeded(page);

    await baseKeyChip(page).click();
    await page.locator('.chip--basekey .chip-detect').click();

    const toast = page.locator('.latin-toast');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('Base key set to G');

    // Detection corrected the label to G, still without moving the chords.
    await expect(baseKeyChip(page)).toContainText('G');
    expect(await chordTexts(page)).toEqual(['G', 'C', 'D', 'Em']);
  });

  test('auto-detect is not thrown off by a chorus repeated verbatim', async ({ page }) => {
    await openSeeded(page, CHORUS_HEAVY_SONG, 'Chorus Heavy Song');

    await baseKeyChip(page).click();
    await page.locator('.chip--basekey .chip-detect').click();

    const toast = page.locator('.latin-toast');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('Base key set to G');
    await expect(baseKeyChip(page)).toContainText('G');
  });
});
