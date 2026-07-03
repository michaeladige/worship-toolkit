import { test, expect, type Page } from '@playwright/test';

// The chord-edit hint only appears once the song actually has a chord.
// "+ chord" inserts a C chord immediately and opens its inline editor.
async function openSongWithChord(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start from scratch' }).click();
  await page.locator('.add-chord-btn--inline').first().click();
  await page.keyboard.press('Enter');
}

test.describe('Chord-editing hint', () => {
  test('shows once, dismisses with Got it, and stays dismissed after reload', async ({ page }) => {
    await openSongWithChord(page);

    const hint = page.locator('.hint-banner');
    await expect(hint).toBeVisible();
    await expect(hint).toContainText('click a chord');

    await page.getByRole('button', { name: 'Got it' }).click();
    await expect(hint).toHaveCount(0);

    const prefs = await page.evaluate(() => localStorage.getItem('worship_toolkit_prefs'));
    expect(prefs).toContain('chord-edit');

    await page.reload();
    await expect(page.locator('h2.song-title')).toBeVisible();
    await expect(page.locator('.hint-banner')).toHaveCount(0);
  });

  test('does not show when the song has no chords', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Start from scratch' }).click();
    await expect(page.locator('h2.song-title')).toBeVisible();
    await expect(page.locator('.hint-banner')).toHaveCount(0);
  });
});
