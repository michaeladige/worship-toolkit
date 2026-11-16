import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Synthetic SongSelect-style chart that changes key from G to A on page 2 —
// see e2e/fixtures/make-modulation-pdf.mjs for exactly what it exercises.
const MODULATION_PDF = path.join(__dirname, 'fixtures', 'modulation.pdf');

// A song in G whose CHORUS 2 and TAG are already marked as being in Ab.
const SEED = [
  {
    id: 'mod-1',
    title: 'Mod Song',
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
              { chord: 'C', xPercent: 50, charPos: 8 },
            ],
            lyric: 'one two three',
            isChordsOnly: false,
          },
        ],
      },
      {
        name: 'CHORUS',
        lines: [
          {
            chords: [
              { chord: 'G', xPercent: 0, charPos: 0 },
              { chord: 'D', xPercent: 50, charPos: 8 },
            ],
            lyric: 'four five six',
            isChordsOnly: false,
          },
        ],
      },
      {
        name: 'CHORUS 2',
        key: 'Ab',
        lines: [
          {
            chords: [
              { chord: 'Ab', xPercent: 0, charPos: 0 },
              { chord: 'Eb', xPercent: 50, charPos: 8 },
            ],
            lyric: 'four five six',
            isChordsOnly: false,
          },
        ],
      },
      {
        name: 'TAG',
        key: 'Ab',
        lines: [
          {
            chords: [{ chord: 'Db', xPercent: 0, charPos: 0 }],
            lyric: 'seven',
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
  }, SEED);
  await page.goto('/');
  await expect(page.locator('h2.song-title')).toHaveText('Mod Song');
}

const section = (page: Page, name: string) =>
  page.locator('.section').filter({ has: page.locator('.section-label', { hasText: new RegExp(`^${name}$`) }) });
const chordsIn = (page: Page, name: string) => section(page, name).locator('.chord-btn').allInnerTexts();

async function storedSong(page: Page) {
  const raw = await page.evaluate(() => localStorage.getItem('worship_toolkit_session'));
  const parsed = JSON.parse(raw!);
  return (Array.isArray(parsed) ? parsed : parsed.songs)[0];
}

test.describe('Modulation — PDF import', () => {
  test('a mid-song "Key - A" marks the following sections as modulated', async ({ page }) => {
    await page.goto('/');
    await page.locator('.drop-zone input[type="file"]').setInputFiles([MODULATION_PDF]);
    await expect(page.locator('h2.song-title')).toHaveText('Modulation Test');

    // Badge on the first section in the new key only; the toolbar summarizes it.
    await expect(page.locator('.key-change-badge')).toHaveCount(1);
    await expect(section(page, 'CHORUS 2').locator('.key-change-badge')).toHaveText('🔑 → A');
    await expect(page.locator('.modulation-note')).toHaveText('→ A');

    // "~" is its own (still modulated) section, not a stray lyric.
    await expect(section(page, '~')).toHaveCount(1);
    await expect(page.locator('.lyric-row', { hasText: /^~$/ })).toHaveCount(0);

    const song = await storedSong(page);
    expect(song.sections.map((s: { name: string; key?: string }) => [s.name, s.key ?? null])).toEqual([
      ['VERSE 1', null],
      ['CHORUS 1', null],
      ['CHORUS 2', 'A'],
      ['~', 'A'],
    ]);
  });

  test('compound superscripts and split slash-bass chords parse whole', async ({ page }) => {
    await page.goto('/');
    await page.locator('.drop-zone input[type="file"]').setInputFiles([MODULATION_PDF]);
    await expect(page.locator('h2.song-title')).toHaveText('Modulation Test');

    expect(await chordsIn(page, 'VERSE 1')).toEqual(['G', 'D/F#', 'Em7', 'C2sus', 'Am7(4)', 'G2/B']);
    expect(await chordsIn(page, 'CHORUS 1')).toEqual(['C2(no3)', 'D']);
    expect(await chordsIn(page, '~')).toEqual(['A2/C#', 'E']);
    // The page-2 running header ("Modulation Test - 2") is not chart content.
    await expect(page.locator('.lyric-row', { hasText: 'Modulation Test' })).toHaveCount(0);
  });

  test('Nashville numbers follow each section’s own key', async ({ page }) => {
    await page.goto('/');
    await page.locator('.drop-zone input[type="file"]').setInputFiles([MODULATION_PDF]);
    await expect(page.locator('h2.song-title')).toHaveText('Modulation Test');
    await page.locator('.toggle-btn', { hasText: 'Nashville' }).click();

    // Same progression, a whole step apart: identical numbers.
    expect(await chordsIn(page, 'CHORUS 1')).toEqual(['42(no3)', '5']);
    expect(await chordsIn(page, 'CHORUS 2')).toEqual(['42(no3)', '5', '1', '5/7', '6m7']);
  });
});

test.describe('Modulation — editing', () => {
  test('transposing moves the modulation with the song', async ({ page }) => {
    await openSeeded(page);
    await expect(section(page, 'CHORUS 2').locator('.key-change-badge')).toHaveText('🔑 → Ab');

    await page.locator('.key-control .step-btn').last().click(); // +1
    await expect(page.locator('.key-display')).toHaveText('Ab');
    await expect(section(page, 'CHORUS 2').locator('.key-change-badge')).toHaveText('🔑 → A');
    expect(await chordsIn(page, 'CHORUS 2')).toEqual(['A', 'E']);
    expect(await chordsIn(page, 'TAG')).toEqual(['D']);
  });

  test('chords are spelled for their section’s key, not the song’s', async ({ page }) => {
    await openSeeded(page);
    // -3: the song moves G→E (a sharp key) while CHORUS 2/TAG move Ab→F (a flat key).
    for (let i = 0; i < 3; i++) await page.locator('.key-control .step-btn').first().click();
    await expect(page.locator('.key-display')).toHaveText('E');
    // Db down 3 is A#/Bb — in F it's Bb, as a player in F would read it.
    expect(await chordsIn(page, 'TAG')).toEqual(['Bb']);
  });

  test('picking a section key modulates from there to the next key change', async ({ page }) => {
    await openSeeded(page);
    // Move CHORUS (in G) to A: only CHORUS changes — CHORUS 2 already differs.
    await section(page, 'CHORUS').locator('.section-key-select').selectOption('A');
    let song = await storedSong(page);
    expect(song.sections.map((s: { key?: string }) => s.key ?? null)).toEqual([null, 'A', 'Ab', 'Ab']);
    await expect(section(page, 'CHORUS').locator('.key-change-badge')).toHaveText('🔑 → A');

    // Move CHORUS 2 (Ab) back to the song key: it and the TAG after it follow.
    await section(page, 'CHORUS 2').locator('.section-key-select').selectOption('G');
    song = await storedSong(page);
    expect(song.sections.map((s: { key?: string }) => s.key ?? null)).toEqual([null, 'A', null, null]);
    // Now CHORUS 2 changes back *from* A to G — still a key change.
    await expect(section(page, 'CHORUS 2').locator('.key-change-badge')).toHaveText('🔑 → G');
  });

  test('editing a chord in a modulated, transposed section stores it untransposed', async ({ page }) => {
    await openSeeded(page);
    await page.locator('.key-control .step-btn').last().click(); // +1: CHORUS 2 sounds in A
    await section(page, 'CHORUS 2').locator('.chord-btn').first().click();
    await page.locator('.chord-input').fill('Bm');
    await page.keyboard.press('Enter');
    const song = await storedSong(page);
    expect(song.sections[2].lines[0].chords[0].chord).toBe('Bbm');
  });

  test('a section added after a modulation stays in the new key', async ({ page }) => {
    await openSeeded(page);
    await page.locator('.quick-pick-btn', { hasText: 'OUTRO' }).click();
    const song = await storedSong(page);
    expect(song.sections[4].key).toBe('Ab');
    await expect(section(page, 'OUTRO').locator('.key-change-badge')).toHaveCount(0);
  });

  test('Markdown export marks the key change', async ({ page }) => {
    await openSeeded(page);
    await page.locator('button', { hasText: 'Export' }).first().click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('.export-option', { hasText: 'Markdown' }).click(),
    ]);
    const md = fs.readFileSync(await download.path(), 'utf8');
    expect(md).toContain('**CHORUS 2** — *Key - Ab*');
    expect(md).not.toContain('**TAG** —');
  });
});
