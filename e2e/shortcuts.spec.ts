import { test, expect, type Page } from '@playwright/test';

async function openBlankSong(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start from scratch' }).click();
  await expect(page.locator('h2.song-title')).toBeVisible();
}

test.describe('Keyboard shortcuts', () => {
  test('+ and - transpose the selected song', async ({ page }) => {
    await openBlankSong(page);

    await expect(page.locator('.key-display')).toHaveText('C');

    await page.keyboard.press('+');
    await expect(page.locator('.key-display')).toHaveText(/C#|Db/);

    await page.keyboard.press('-');
    await expect(page.locator('.key-display')).toHaveText('C');
  });

  test('shortcuts do not fire while typing in an input', async ({ page }) => {
    await openBlankSong(page);

    await page.locator('.title-edit-trigger').click();
    await page.locator('.title-input').pressSequentially('+-?');
    await page.keyboard.press('Escape');

    await expect(page.locator('.key-display')).toHaveText('C');
    await expect(page.locator('app-shortcuts-modal')).toHaveCount(0);
  });

  test('? opens the shortcuts cheatsheet and Escape closes it', async ({ page }) => {
    await openBlankSong(page);

    await page.keyboard.press('?');
    await expect(page.locator('app-shortcuts-modal .modal-dialog')).toBeVisible();
    await expect(page.locator('app-shortcuts-modal')).toContainText('Keyboard shortcuts');

    await page.keyboard.press('Escape');
    await expect(page.locator('app-shortcuts-modal')).toHaveCount(0);
  });

  test('Ctrl+ArrowDown / Ctrl+ArrowUp move between songs', async ({ page }) => {
    await openBlankSong(page);

    await page.locator('.add-song-pc', { hasText: '+ New Song' }).click();
    await page.locator('.title-edit-trigger').click();
    await page.locator('.title-input').fill('Second Song');
    await page.keyboard.press('Enter');
    // Zoneless CD removes the input asynchronously — wait for the commit to
    // render before firing shortcuts, or the in-input guard swallows them.
    await expect(page.locator('.title-input')).toHaveCount(0);

    await page.keyboard.press('Control+ArrowUp');
    await expect(page.locator('h2.song-title')).toHaveText('New Song');

    await page.keyboard.press('Control+ArrowDown');
    await expect(page.locator('h2.song-title')).toHaveText('Second Song');
  });
});
