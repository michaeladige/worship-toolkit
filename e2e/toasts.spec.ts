import { test, expect, type Page } from '@playwright/test';

async function openBlankSong(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start from scratch' }).click();
  await expect(page.locator('h2.song-title')).toBeVisible();
}

test.describe('Toast feedback', () => {
  test('saving a set shows a success toast that auto-dismisses', async ({ page }) => {
    await openBlankSong(page);

    await page.locator('.sessions-btn').click();
    await page.getByPlaceholder('Set name…').fill('My Test Set');
    await page.getByRole('button', { name: 'Save', exact: true }).click();

    const toast = page.locator('.latin-toast');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('Set saved');
    await expect(toast).not.toHaveClass(/toast--error/);

    await expect(toast).toBeHidden({ timeout: 5000 });
  });

  test('unsaved work shows the amber indicator on the sets button, saved work clears it', async ({ page }) => {
    await openBlankSong(page);
    await expect(page.locator('.sessions-btn')).toHaveClass(/sessions-btn--unsaved/);

    await page.locator('.sessions-btn').click();
    await page.getByPlaceholder('Set name…').fill('Named Set');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.keyboard.press('Escape');

    await expect(page.locator('.sessions-btn')).not.toHaveClass(/sessions-btn--unsaved/);
  });

  test('storage-full shows an error toast instead of failing silently', async ({ page }) => {
    await openBlankSong(page);

    // Exhaust localStorage so the next write throws QuotaExceededError.
    // Fill with progressively smaller chunks so almost no free space remains.
    await page.evaluate(() => {
      let i = 0;
      for (const size of [1024 * 1024, 64 * 1024, 1024, 16]) {
        const chunk = 'x'.repeat(size);
        try {
          for (;;) localStorage.setItem(`__fill_${i++}`, chunk);
        } catch {
          /* this size no longer fits — drop to a smaller chunk */
        }
      }
    });

    // Any edit triggers a persist attempt.
    await page.getByRole('button', { name: 'VERSE', exact: true }).click();

    const toast = page.locator('.latin-toast');
    await expect(toast).toBeVisible();
    await expect(toast).toHaveClass(/toast--error/);
    await expect(toast).toContainText('Storage is full');
  });
});
