import { test, expect, type Page } from '@playwright/test';
import * as path from 'path';

const FIXTURES = path.join(__dirname, 'fixtures');
const GOOD_PDF = path.join(FIXTURES, 'goodness-of-god.pdf');
const BROKEN_PDF = path.join(FIXTURES, 'broken.pdf');

async function openBlankSong(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start from scratch' }).click();
  await expect(page.locator('h2.song-title')).toBeVisible();
}

test.describe('Multi-file PDF upload', () => {
  test('uploading two PDFs at once loads songs from both', async ({ page }) => {
    await page.goto('/');

    await page.locator('.drop-zone input[type="file"]').setInputFiles([GOOD_PDF, GOOD_PDF]);

    // Both copies parse — two songs land in the set.
    await expect(page.locator('app-song-list li').filter({ hasText: 'Goodness Of God' })).toHaveCount(2);
  });

  test('a broken file reports a per-file error while good files still load', async ({ page }) => {
    await page.goto('/');

    await page.locator('.drop-zone input[type="file"]').setInputFiles([BROKEN_PDF, GOOD_PDF]);

    // The good file loaded us into the editor…
    await expect(page.locator('h2.song-title')).toHaveText('Goodness Of God');
  });

  test('uploading only a broken file shows its error and stays on the upload page', async ({ page }) => {
    await page.goto('/');

    await page.locator('.drop-zone input[type="file"]').setInputFiles([BROKEN_PDF]);

    const errorBox = page.locator('.error-msg');
    await expect(errorBox).toBeVisible();
    await expect(errorBox).toContainText('broken.pdf');
    await expect(page.locator('.drop-zone')).toBeVisible();
  });
});

test.describe('Song list search', () => {
  test('filter box appears past 5 songs, narrows the list, and selection still works', async ({ page }) => {
    await openBlankSong(page);

    // 1 blank song exists; add 5 more so the filter threshold (>5) is crossed.
    for (let i = 0; i < 5; i++) {
      await page.locator('.add-song-pc', { hasText: '+ New Song' }).click();
    }
    await expect(page.locator('app-song-list ul li:not(.add-song-item)')).toHaveCount(6);

    const filter = page.locator('.song-filter-input');
    await expect(filter).toBeVisible();

    // Rename the first song so filtering can distinguish it.
    await page.locator('app-song-list li').first().click();
    await page.locator('.title-edit-trigger').click();
    await page.locator('.title-input').fill('Amazing Grace');
    await page.keyboard.press('Enter');

    await filter.fill('amazing');
    await expect(page.locator('app-song-list ul li:not(.add-song-item)')).toHaveCount(1);

    // Selecting through the filtered view targets the correct song.
    await page.locator('app-song-list li').first().click();
    await expect(page.locator('h2.song-title')).toHaveText('Amazing Grace');

    await filter.fill('');
    await expect(page.locator('app-song-list ul li:not(.add-song-item)')).toHaveCount(6);
  });
});
