import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';

const SEED_SONGS = [
  {
    id: 'seed-1',
    title: 'First Song',
    authors: [],
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
            lyric: 'how great is our God',
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

const notesChip = (page: Page) => page.locator('.meta-chips .chip--btn', { hasText: 'Notes' });

test.describe('Song notes & duration', () => {
  test('opening the notes panel, typing, and blurring commits notes and duration', async ({
    page,
  }) => {
    await openSeeded(page);
    await notesChip(page).click();

    const textarea = page.locator('.notes-textarea');
    await textarea.fill('Watch the drummer into the bridge');
    const durationInput = page.locator('.duration-input');
    await durationInput.fill('3:45');
    await durationInput.blur();

    // Reopen after closing to confirm the values were actually committed to the song.
    await notesChip(page).click(); // close
    await notesChip(page).click(); // reopen
    await expect(page.locator('.notes-textarea')).toHaveValue('Watch the drummer into the bridge');
    await expect(page.locator('.duration-input')).toHaveValue('3:45');
  });

  test('notes chip is dimmed when empty and stays plain text when unset', async ({ page }) => {
    await openSeeded(page);
    await expect(notesChip(page)).toHaveClass(/chip--empty/);
  });
});

test.describe('Set PDF cover page & export', () => {
  test('exporting a Set PDF with the cover-page checkbox on succeeds without error', async ({
    page,
  }) => {
    await openSeeded(page);
    await page.locator('.ui-ctrl-btn', { hasText: 'Export' }).click();

    const checkbox = page.locator('.export-suboption input[type=checkbox]');
    await checkbox.check();
    await expect(checkbox).toBeChecked();

    const downloadPromise = page.waitForEvent('download');
    await page.locator('.export-option', { hasText: 'Set PDF' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('worship-set.pdf');
    await expect(page.locator('.latin-toast')).not.toHaveClass(/toast--error/);
  });

  test('the cover-page preference persists across reload', async ({ page }) => {
    await openSeeded(page);
    await page.locator('.ui-ctrl-btn', { hasText: 'Export' }).click();
    await page.locator('.export-suboption input[type=checkbox]').check();

    await page.reload();
    await page.locator('.ui-ctrl-btn', { hasText: 'Export' }).click();
    await expect(page.locator('.export-suboption input[type=checkbox]')).toBeChecked();
  });
});

test.describe('.wt round-trip', () => {
  test('notes, duration, and capo survive an export + re-import cycle', async ({ page }) => {
    await openSeeded(page);
    await notesChip(page).click();
    await page.locator('.notes-textarea').fill('Round trip note');
    await page.locator('.duration-input').fill('2:30');
    await page.locator('.duration-input').blur();

    await page.locator('.ui-ctrl-btn.sessions-btn').click();
    await page.locator('.save-input').fill('My Set');
    await page.locator('.save-btn').click();

    const downloadPromise = page.waitForEvent('download');
    await page.locator('.action-btn', { hasText: '↓' }).click();
    const download = await downloadPromise;
    const filePath = await download.path();
    expect(filePath).toBeTruthy();

    const raw = fs.readFileSync(filePath!, 'utf-8');
    const parsed = JSON.parse(raw);
    expect(parsed.songs[0].notes).toBe('Round trip note');
    expect(parsed.songs[0].durationSeconds).toBe(150);
    expect(parsed.songs[0].capo).toBe(2);

    // Re-import the same file and confirm it round-trips into the UI too —
    // a successful import auto-closes the Saved Sets modal on its own.
    await page.locator('input[type=file][accept=".wt,.json"]').setInputFiles(filePath!);
    await expect(page.locator('.latin-toast')).toContainText('Set imported');

    // The notes panel was already opened earlier in this test (line ~115)
    // and never closed, so whether it's still open after the reimport
    // depends on whether that local UI toggle survived — click the chip
    // only if the panel isn't already showing, rather than assuming either way.
    const notesTextarea = page.locator('.notes-textarea');
    if (!(await notesTextarea.isVisible())) {
      await notesChip(page).click();
    }
    await expect(notesTextarea).toHaveValue('Round trip note');
  });
});
