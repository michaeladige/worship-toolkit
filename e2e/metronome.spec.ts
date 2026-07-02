import { test, expect, type Page } from '@playwright/test';

async function openBlankSong(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start from scratch' }).click();
  await expect(page.locator('.metronome-control')).toBeVisible();
}

// Playwright refuses to click a disabled element, so clicking a bounded
// stepper past its limit needs to stop once the button actually disables.
async function clickUntilDisabled(locator: ReturnType<Page['locator']>, maxClicks: number) {
  for (let i = 0; i < maxClicks; i++) {
    if (await locator.isDisabled()) return;
    await locator.click({ force: true });
  }
}

test.describe('Metronome control', () => {
  test('defaults to off, with no BPM stepper visible', async ({ page }) => {
    await openBlankSong(page);

    await expect(page.locator('.metronome-control')).not.toHaveClass(/active/);
    await expect(page.locator('.metronome-bpm')).not.toBeVisible();
  });

  test('turning on shows the BPM stepper defaulted to 80 for a song with no tempo', async ({ page }) => {
    await openBlankSong(page);

    await page.locator('.metronome-toggle-btn').click();
    await expect(page.locator('.metronome-control')).toHaveClass(/active/);
    await expect(page.locator('.metronome-bpm')).toHaveText('80');
  });

  test('BPM stepper adjusts and clamps at [30, 240]', async ({ page }) => {
    await openBlankSong(page);
    await page.locator('.metronome-toggle-btn').click();

    const downBtn = page.locator('.metronome-control .step-btn').first();
    const upBtn = page.locator('.metronome-control .step-btn').last();
    const bpm = page.locator('.metronome-bpm');

    await clickUntilDisabled(downBtn, 60);
    await expect(bpm).toHaveText('30');
    await expect(downBtn).toBeDisabled();

    await clickUntilDisabled(upBtn, 220);
    await expect(bpm).toHaveText('240');
    await expect(upBtn).toBeDisabled();
  });

  test('turning off hides the stepper; turning on again re-reads the default instead of remembering', async ({ page }) => {
    await openBlankSong(page);

    await page.locator('.metronome-toggle-btn').click();
    await page.locator('.metronome-control .step-btn').last().click();
    await expect(page.locator('.metronome-bpm')).toHaveText('81');

    await page.locator('.metronome-toggle-btn').click();
    await expect(page.locator('.metronome-control')).not.toHaveClass(/active/);
    await expect(page.locator('.metronome-bpm')).not.toBeVisible();

    await page.locator('.metronome-toggle-btn').click();
    await expect(page.locator('.metronome-bpm')).toHaveText('80');
  });

  test('turning the metronome on for a song with a set tempo defaults BPM to that tempo', async ({ page }) => {
    await openBlankSong(page);

    await page.getByRole('button', { name: '+ BPM' }).click();
    await page.locator('.chip-input').fill('132');
    await page.keyboard.press('Enter');

    await page.locator('.metronome-toggle-btn').click();
    await expect(page.locator('.metronome-bpm')).toHaveText('132');
  });

  test('metronome is not persisted (turns off on reload)', async ({ page }) => {
    await openBlankSong(page);

    await page.locator('.metronome-toggle-btn').click();
    await expect(page.locator('.metronome-control')).toHaveClass(/active/);

    const storageSnapshot = await page.evaluate(() => JSON.stringify(localStorage));
    expect(storageSnapshot).not.toContain('metronome');

    await page.reload();
    await expect(page.locator('.metronome-control')).not.toHaveClass(/active/);
  });

  test('switching to a different song turns the metronome off', async ({ page }) => {
    await openBlankSong(page);

    await page.locator('.metronome-toggle-btn').click();
    await expect(page.locator('.metronome-control')).toHaveClass(/active/);

    // Add a second song (auto-selected), then switch back to the first —
    // either direction is a real selectedIndex change.
    await page.getByRole('button', { name: '+ New Song' }).click();
    await expect(page.locator('.metronome-control')).not.toHaveClass(/active/);
  });
});
