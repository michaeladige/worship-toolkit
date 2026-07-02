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
  test('defaults to 0 (off) with the down arrow disabled', async ({ page }) => {
    await createSongWithScrollableContent(page);

    await expect(page.locator('.autoscroll-control .key-display')).toHaveText('0');
    await expect(page.locator('.autoscroll-control .step-btn').first()).toBeDisabled();
    await expect(page.locator('.autoscroll-control')).not.toHaveClass(/active/);
  });

  test('up/down arrows adjust speed and clamp at the [0, 10] bounds', async ({ page }) => {
    await createSongWithScrollableContent(page);

    const downBtn = page.locator('.autoscroll-control .step-btn').first();
    const upBtn = page.locator('.autoscroll-control .step-btn').last();
    const speed = page.locator('.autoscroll-control .key-display');

    await clickUntilDisabled(upBtn, 15);
    await expect(speed).toHaveText('10');
    await expect(upBtn).toBeDisabled();

    await clickUntilDisabled(downBtn, 15);
    await expect(speed).toHaveText('0');
    await expect(downBtn).toBeDisabled();
  });

  test('scrolls the content while speed > 0, and stops when returned to 0', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 400 });
    await createSongWithScrollableContent(page);

    const content = page.locator('.content');
    const upBtn = page.locator('.autoscroll-control .step-btn').last();
    const downBtn = page.locator('.autoscroll-control .step-btn').first();

    for (let i = 0; i < 5; i++) await upBtn.click();
    await expect(page.locator('.autoscroll-control')).toHaveClass(/active/);

    const before = await content.evaluate((el) => el.scrollTop);
    await page.waitForTimeout(1000);
    const during = await content.evaluate((el) => el.scrollTop);
    expect(during).toBeGreaterThan(before);

    for (let i = 0; i < 5; i++) await downBtn.click();
    await expect(page.locator('.autoscroll-control .key-display')).toHaveText('0');

    const stoppedAt = await content.evaluate((el) => el.scrollTop);
    await page.waitForTimeout(500);
    const stillStopped = await content.evaluate((el) => el.scrollTop);
    expect(stillStopped).toBe(stoppedAt);
  });

  test('autoscroll speed is not persisted (not written to localStorage)', async ({ page }) => {
    await createSongWithScrollableContent(page);

    const upBtn = page.locator('.autoscroll-control .step-btn').last();
    for (let i = 0; i < 4; i++) await upBtn.click();
    await expect(page.locator('.autoscroll-control .key-display')).toHaveText('4');

    const storageSnapshot = await page.evaluate(() => JSON.stringify(localStorage));
    expect(storageSnapshot).not.toContain('autoscroll');

    await page.reload();
    await expect(page.locator('.autoscroll-control .key-display')).toHaveText('0');
  });
});
