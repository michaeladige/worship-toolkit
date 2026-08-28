import { test, expect, type Page } from '@playwright/test';

// Two songs so the cross-song clipboard can actually be exercised.
const SONGS = [
  {
    id: 'song-a',
    title: 'Song A',
    authors: [],
    key: 'G',
    originalKey: 'G',
    tempo: '',
    timeSignature: '4/4',
    transposeSemitones: 0,
    showBassNotesOnly: false,
    sections: [
      {
        name: 'VERSE',
        lines: [
          { chords: [{ chord: 'G', xPercent: 0, charPos: 0 }], lyric: 'alpha', isChordsOnly: false },
          { chords: [{ chord: 'C', xPercent: 0, charPos: 0 }], lyric: 'bravo', isChordsOnly: false },
          {
            chords: [{ chord: 'D', xPercent: 0, charPos: 0 }],
            lyric: 'charlie',
            isChordsOnly: false,
          },
        ],
      },
      {
        name: 'CHORUS',
        lines: [
          { chords: [{ chord: 'Em', xPercent: 0, charPos: 0 }], lyric: 'delta', isChordsOnly: false },
        ],
      },
    ],
  },
  {
    id: 'song-b',
    title: 'Song B',
    authors: [],
    key: 'A',
    originalKey: 'A',
    tempo: '',
    timeSignature: '4/4',
    transposeSemitones: 0,
    showBassNotesOnly: false,
    sections: [
      {
        name: 'VERSE',
        lines: [
          { chords: [{ chord: 'A', xPercent: 0, charPos: 0 }], lyric: 'echo', isChordsOnly: false },
        ],
      },
    ],
  },
];

async function seed(page: Page) {
  await page.addInitScript((songs) => {
    localStorage.setItem('worship_toolkit_session', JSON.stringify(songs));
  }, SONGS);
  await page.goto('/');
  await expect(page.locator('.line-group').first()).toBeVisible();
}

const lines = (page: Page) => page.locator('.line-group');
const sectionLines = (page: Page, si: number) =>
  page.locator('.section').nth(si).locator('.line-group');
const lineCheck = (page: Page, i: number) => lines(page).nth(i).locator('.select-check');
const bulk = (page: Page, name: string) => page.locator('.bulk-btn', { hasText: name });

/**
 * CDK needs a real gesture: a single mouse.move() jumps straight past its drag
 * threshold detection and its sort math never runs, so the drop is a no-op.
 * Stepping the move is what makes this deterministic rather than flaky.
 */
async function dragTo(page: Page, handle: ReturnType<Page['locator']>, target: ReturnType<Page['locator']>) {
  const from = (await handle.boundingBox())!;
  const to = (await target.boundingBox())!;
  const startX = from.x + from.width / 2;
  const startY = from.y + from.height / 2;
  // Aim at the target's centre, not its bottom edge — CDK sorts by which item
  // the pointer is currently over, and the bottom edge of row N is already
  // close enough to row N+1 to overshoot by one position.
  const endX = to.x + to.width / 2;
  const endY = to.y + to.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  const STEPS = 12;
  for (let i = 1; i <= STEPS; i++) {
    await page.mouse.move(
      startX + (endX - startX) * (i / STEPS),
      startY + (endY - startY) * (i / STEPS),
    );
  }
  await page.mouse.up();

  // CDK animates the dragged item into its slot and only fires
  // (cdkDropListDropped) once that finishes — so the model is still unchanged
  // the instant mouse.up() resolves, and asserting straight away reads the
  // half-applied state (DOM sorted, model not yet). Wait for CDK to tear the
  // drag down instead of sleeping a fixed number of milliseconds.
  await expect(page.locator('.cdk-drag-preview')).toHaveCount(0);
  await expect(page.locator('.cdk-drag-animating')).toHaveCount(0);
}

test.describe('Select mode', () => {
  test('toggling shows checkboxes and the bulk bar, and hides the edit gutter buttons', async ({
    page,
  }) => {
    await seed(page);
    await expect(page.locator('.bulk-bar')).toHaveCount(0);
    await expect(page.locator('.line-ctrl-btn').first()).toBeAttached();

    await page.locator('.select-btn').click();

    await expect(page.locator('.bulk-bar')).toBeVisible();
    // One checkbox per line (4) plus one per section header (2).
    await expect(page.locator('.select-check')).toHaveCount(6);
    await expect(page.locator('.line-ctrl-btn')).toHaveCount(0);
    await expect(page.locator('.line-drag-handle')).toHaveCount(0);
  });

  test('deleting several lines is a SINGLE undo entry', async ({ page }) => {
    await seed(page);
    await expect(lines(page)).toHaveCount(4);

    await page.locator('.select-btn').click();
    await lineCheck(page, 0).check();
    await lineCheck(page, 1).check();
    await expect(page.locator('.bulk-count')).toContainText('2');

    await bulk(page, 'Delete').click();
    await expect(lines(page)).toHaveCount(2);

    await page.locator('.select-btn').click(); // leave select mode
    await page.keyboard.press('Control+z');
    await expect(lines(page)).toHaveCount(4);
    await expect(page.locator('.lyric-row').first()).toHaveText('alpha');
  });

  test('a selection is lines or sections, never both', async ({ page }) => {
    await seed(page);
    await page.locator('.select-btn').click();

    await lineCheck(page, 0).check();
    await expect(page.locator('.bulk-count')).toContainText('1');

    // Ticking a section header drops the line selection rather than adding to it.
    await page.locator('.section').first().locator('.section-header .select-check').check();
    await expect(page.locator('.bulk-count')).toContainText('1');
    await expect(lineCheck(page, 0)).not.toBeChecked();
  });

  test('deleting every line in a section leaves one blank line behind', async ({ page }) => {
    await seed(page);
    await page.locator('.select-btn').click();
    // The CHORUS section has exactly one line — line index 3 overall.
    await lineCheck(page, 3).check();
    await bulk(page, 'Delete').click();

    await expect(sectionLines(page, 1)).toHaveCount(1);
    await expect(sectionLines(page, 1).locator('.lyric-row')).toHaveText('');
  });

  test('duplicate inserts a copy directly after each selected line', async ({ page }) => {
    await seed(page);
    await page.locator('.select-btn').click();
    await lineCheck(page, 0).check();
    await bulk(page, 'Duplicate').click();

    await expect(lines(page)).toHaveCount(5);
    await expect(page.locator('.lyric-row').nth(0)).toHaveText('alpha');
    await expect(page.locator('.lyric-row').nth(1)).toHaveText('alpha');
    await expect(page.locator('.lyric-row').nth(2)).toHaveText('bravo');
  });

  test('select mode is unavailable under View Only', async ({ page }) => {
    await seed(page);
    await page.locator('.toggle-btn', { hasText: 'View Only' }).click();
    await expect(page.locator('.select-btn')).toBeDisabled();
  });

  test('Escape leaves select mode', async ({ page }) => {
    await seed(page);
    await page.locator('.select-btn').click();
    await expect(page.locator('.bulk-bar')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.bulk-bar')).toHaveCount(0);
  });
});

test.describe('Clipboard', () => {
  test('lines copied in one song can be pasted into another', async ({ page }) => {
    await seed(page);

    await page.locator('.select-btn').click();
    await lineCheck(page, 0).check();
    await bulk(page, 'Copy').click();
    await bulk(page, 'Done').click();

    // Switch to Song B — the selection is dropped but the clipboard survives.
    await page.locator('.song-title', { hasText: 'Song B' }).click();
    await expect(lines(page)).toHaveCount(1);

    await page.locator('.section-action-btn', { hasText: 'Paste' }).first().click();
    await expect(lines(page)).toHaveCount(2);
    await expect(page.locator('.lyric-row').nth(1)).toHaveText('alpha');
  });

  test('copied sections offer a paste button next to Add section', async ({ page }) => {
    await seed(page);

    await page.locator('.select-btn').click();
    await page.locator('.section').nth(1).locator('.section-header .select-check').check();
    await bulk(page, 'Copy').click();
    await bulk(page, 'Done').click();

    const pasteSections = page.locator('.paste-sections-btn');
    await expect(pasteSections).toBeVisible();
    await pasteSections.click();
    await expect(page.locator('.section')).toHaveCount(3);
    await expect(page.locator('.section-label').nth(2)).toHaveText('CHORUS');
  });
});

test.describe('Line drag-and-drop', () => {
  test('reorders a line within its own section', async ({ page }) => {
    await seed(page);
    await expect(page.locator('.lyric-row').nth(0)).toHaveText('alpha');

    await dragTo(page, lines(page).first().locator('.line-drag-handle'), lines(page).nth(1));

    await expect(page.locator('.lyric-row').nth(0)).toHaveText('bravo');
    await expect(page.locator('.lyric-row').nth(1)).toHaveText('alpha');
  });

  test('moves a line into a different section', async ({ page }) => {
    await seed(page);
    await expect(sectionLines(page, 0)).toHaveCount(3);
    await expect(sectionLines(page, 1)).toHaveCount(1);

    await dragTo(page, lines(page).first().locator('.line-drag-handle'), sectionLines(page, 1).first());

    await expect(sectionLines(page, 0)).toHaveCount(2);
    await expect(sectionLines(page, 1)).toHaveCount(2);
  });

  test('a reorder is undoable', async ({ page }) => {
    await seed(page);
    await dragTo(page, lines(page).first().locator('.line-drag-handle'), lines(page).nth(1));
    await expect(page.locator('.lyric-row').nth(0)).toHaveText('bravo');

    await page.keyboard.press('Control+z');
    await expect(page.locator('.lyric-row').nth(0)).toHaveText('alpha');
  });
});
