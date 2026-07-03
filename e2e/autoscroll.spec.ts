import { test, expect, type Page } from '@playwright/test';

async function createSongWithScrollableContent(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start from scratch' }).click();
  await expect(page.locator('.autoscroll-control')).toBeVisible();

  // A blank song has one section/line — add several more so .content overflows.
  for (const name of ['VERSE', 'CHORUS', 'BRIDGE', 'OUTRO', 'TAG']) {
    await page.getByRole('button', { name, exact: true }).click();
  }
}

// Playwright refuses to click a disabled element, so clicking a bounded
// stepper past its limit needs to stop once the button actually disables.
async function clickUntilDisabled(locator: ReturnType<Page['locator']>, maxClicks: number) {
  for (let i = 0; i < maxClicks; i++) {
    if (await locator.isDisabled()) return;
    await locator.click({ force: true });
  }
}

test.describe('Autoscroll control', () => {
  test('defaults to off, with no speed stepper visible', async ({ page }) => {
    await createSongWithScrollableContent(page);

    await expect(page.locator('.autoscroll-control')).not.toHaveClass(/active/);
    await expect(page.locator('.autoscroll-speed')).not.toBeVisible();
  });

  test('turning on shows the speed stepper defaulted to 5', async ({ page }) => {
    await createSongWithScrollableContent(page);

    await page.locator('.autoscroll-toggle-btn').click();
    await expect(page.locator('.autoscroll-control')).toHaveClass(/active/);
    await expect(page.locator('.autoscroll-speed')).toHaveValue('5');
  });

  test('up arrow clamps at 30; toggling off hides the stepper', async ({ page }) => {
    await createSongWithScrollableContent(page);
    await page.locator('.autoscroll-toggle-btn').click();

    const upBtn = page.locator('.autoscroll-control .step-btn').last();
    const speed = page.locator('.autoscroll-speed');

    await clickUntilDisabled(upBtn, 30);
    await expect(speed).toHaveValue('30');
    await expect(upBtn).toBeDisabled();

    await page.locator('.autoscroll-toggle-btn').click();
    await expect(page.locator('.autoscroll-control')).not.toHaveClass(/active/);
    await expect(speed).not.toBeVisible();
  });

  test('scrolls the content while speed > 0, and stops when turned off', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 400 });
    await createSongWithScrollableContent(page);

    const content = page.locator('.content');
    const toggleBtn = page.locator('.autoscroll-toggle-btn');

    await toggleBtn.click();
    await expect(page.locator('.autoscroll-control')).toHaveClass(/active/);

    const before = await content.evaluate((el) => el.scrollTop);
    await page.waitForTimeout(1000);
    const during = await content.evaluate((el) => el.scrollTop);
    expect(during).toBeGreaterThan(before);

    await toggleBtn.click();
    await expect(page.locator('.autoscroll-control')).not.toHaveClass(/active/);

    const stoppedAt = await content.evaluate((el) => el.scrollTop);
    await page.waitForTimeout(500);
    const stillStopped = await content.evaluate((el) => el.scrollTop);
    expect(stillStopped).toBe(stoppedAt);
  });

  test('autoscroll speed is not persisted (not written to localStorage)', async ({ page }) => {
    await createSongWithScrollableContent(page);

    await page.locator('.autoscroll-toggle-btn').click();
    const upBtn = page.locator('.autoscroll-control .step-btn').last();
    for (let i = 0; i < 3; i++) await upBtn.click();
    await expect(page.locator('.autoscroll-speed')).toHaveValue('8');

    const storageSnapshot = await page.evaluate(() => JSON.stringify(localStorage));
    expect(storageSnapshot).not.toContain('autoscroll');

    await page.reload();
    await expect(page.locator('.autoscroll-control')).not.toHaveClass(/active/);
  });
});
