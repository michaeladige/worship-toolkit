import { test, expect, type Page } from '@playwright/test';

const ALL_THEMES = ['blue', 'pink', 'red', 'amber', 'green', 'purple', 'teal', 'orange', 'disco', 'confetti'];

async function openSettings(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start from scratch' }).click();
  await page.locator('.ui-ctrl-btn', { hasText: '⚙️' }).click();
  await expect(page.locator('.modal-dialog')).toBeVisible();
}

test.describe('Color themes', () => {
  for (const color of ALL_THEMES) {
    test(`selecting ${color} applies data-color and marks the swatch active`, async ({ page }) => {
      await openSettings(page);

      await page.locator(`[data-color-swatch="${color}"]`).click();

      if (color === 'blue') {
        await expect(page.locator('html')).not.toHaveAttribute('data-color', /.+/);
      } else {
        await expect(page.locator('html')).toHaveAttribute('data-color', color);
      }
      await expect(page.locator(`[data-color-swatch="${color}"]`)).toHaveClass(/swatch--active/);
    });
  }

  test('theme selection persists across reload', async ({ page }) => {
    await openSettings(page);

    await page.locator('[data-color-swatch="teal"]').click();
    await expect(page.locator('html')).toHaveAttribute('data-color', 'teal');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-color', 'teal');

    const storageSnapshot = await page.evaluate(() => localStorage.getItem('worship_toolkit_prefs'));
    expect(storageSnapshot).toContain('teal');
  });

  test('dark mode combines with a non-default color theme', async ({ page }) => {
    await openSettings(page);

    await page.locator('[data-color-swatch="orange"]').click();
    await page.locator('.setting-btn', { hasText: /Dark|Light/ }).click();

    await expect(page.locator('html')).toHaveAttribute('data-color', 'orange');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });
});

test.describe('Mobile toolbar labels', () => {
  test('Bass Notes and Nashville toggles show short labels on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Start from scratch' }).click();

    const bassBtn = page.locator('.toggle-btn').filter({ hasText: /Bass/ });
    const nashvilleBtn = page.locator('.toggle-btn').filter({ hasText: /1 2 3/ });

    await expect(bassBtn.locator('.label-short')).toBeVisible();
    await expect(bassBtn.locator('.label-full')).toBeHidden();
    await expect(nashvilleBtn.locator('.label-short')).toBeVisible();
    await expect(nashvilleBtn.locator('.label-full')).toBeHidden();
  });
});
