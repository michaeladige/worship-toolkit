import { test, expect, type Page } from '@playwright/test';

async function openTwoSongs(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start from scratch' }).click();
  await page.locator('.add-song-pc', { hasText: '+ New Song' }).click();
  await page.locator('.title-edit-trigger').click();
  await page.locator('.title-input').fill('Second Song');
  await page.keyboard.press('Enter');
  await expect(page.locator('.title-input')).toHaveCount(0);
}

test.describe('Stage mode', () => {
  test('entering hides header, sidebar, and toolbar, and shows the floating bar', async ({ page }) => {
    await openTwoSongs(page);

    await page.locator('.stage-btn').click();

    await expect(page.locator('.app-shell')).toHaveClass(/stage-mode/);
    await expect(page.locator('.app-header')).toHaveCount(0);
    await expect(page.locator('app-song-list')).toHaveCount(0);
    await expect(page.locator('.toolbar')).toHaveCount(0);
    await expect(page.locator('.stage-bar')).toBeVisible();
  });

  test('prev/next buttons switch songs and disable at the bounds', async ({ page }) => {
    await openTwoSongs(page);
    await page.locator('.stage-btn').click();

    // Started on song 2 (the just-added one) — next is disabled, prev works.
    const prev = page.locator('.stage-bar-btn[title*="Previous" i]');
    const next = page.locator('.stage-bar-btn[title*="Next" i]');

    await expect(next).toBeDisabled();
    await prev.click();
    await expect(page.locator('.stage-bar-title')).toHaveText('New Song');
    await expect(prev).toBeDisabled();

    await next.click();
    await expect(page.locator('.stage-bar-title')).toHaveText('Second Song');
  });

  test('Escape and the exit button both leave stage mode', async ({ page }) => {
    await openTwoSongs(page);

    await page.locator('.stage-btn').click();
    await expect(page.locator('.stage-bar')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('.stage-bar')).toHaveCount(0);
    await expect(page.locator('.app-header')).toBeVisible();

    await page.locator('.stage-btn').click();
    await page.locator('.stage-exit-btn').click();
    await expect(page.locator('.stage-bar')).toHaveCount(0);
    await expect(page.locator('.app-header')).toBeVisible();
  });

  test('scroll and metronome controls stay usable in stage mode', async ({ page }) => {
    await openTwoSongs(page);
    await page.locator('.stage-btn').click();

    const scrollGroup = page.locator('.stage-bar-group').first();
    await scrollGroup.locator('.stage-bar-btn').first().click(); // toggle on
    await expect(scrollGroup).toHaveClass(/active/);
    await scrollGroup.locator('.stage-bar-btn').nth(2).click(); // ▲ up
    await expect(scrollGroup.locator('.stage-bar-value')).toHaveValue('6');

    const metronomeGroup = page.locator('.stage-bar-group').nth(1);
    await metronomeGroup.locator('.stage-bar-btn').first().click();
    await expect(metronomeGroup).toHaveClass(/active/);
    await expect(metronomeGroup.locator('.stage-bar-value')).toHaveValue('80');
  });

  test('song title stays visible on a phone-width viewport, even under scroll+metronome', async ({ page }) => {
    await openTwoSongs(page);
    await page.setViewportSize({ width: 375, height: 700 });
    await page.locator('.stage-btn').click();

    const title = page.locator('.stage-bar-title');
    await expect(title).toBeVisible();
    const initialBox = await title.boundingBox();
    expect(initialBox!.width).toBeGreaterThan(0);

    // Worst case: both control groups active alongside a long title can
    // outgrow the bar's width — it should scroll rather than clip a control.
    await page.locator('.stage-bar-group').first().locator('.stage-bar-btn').first().click();
    await page.locator('.stage-bar-group').nth(1).locator('.stage-bar-btn').first().click();
    await expect(title).toBeVisible();

    const bar = page.locator('.stage-bar');
    const { scrollWidth, clientWidth } = await bar.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    if (scrollWidth > clientWidth) {
      await bar.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
      await expect(page.locator('.stage-exit-btn')).toBeVisible();
    }
  });
});
