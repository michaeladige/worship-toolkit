import { test, expect } from '@playwright/test';

// The service worker itself is disabled in dev mode (enabled: !isDevMode()),
// so these checks cover the installability surface that IS present in dev:
// the manifest link and its content. Offline behavior is verified manually
// against a production build (see manual §11 / plan verification notes).
test.describe('PWA installability', () => {
  test('page links a valid web app manifest with relative start_url', async ({ page }) => {
    await page.goto('/');

    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifestHref).toBe('manifest.webmanifest');

    const manifest = await page.evaluate(async (href) => {
      const res = await fetch(href);
      return res.json();
    }, manifestHref!);

    expect(manifest.name).toBe('WorshipToolkit');
    // Relative URLs are load-bearing: the app deploys under two different
    // base hrefs (/worship-toolkit/ and /worship-toolkit/beta/).
    expect(manifest.start_url).toBe('./');
    expect(manifest.scope).toBe('./');
    expect(manifest.icons.length).toBeGreaterThanOrEqual(8);
    for (const icon of manifest.icons) {
      expect(icon.src).not.toMatch(/^\//);
    }
  });

  test('theme-color meta and apple-touch-icon are present', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#2563eb');
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', 'icons/icon-192x192.png');
  });
});

test.describe('Check for updates (Settings)', () => {
  // The service worker is disabled in dev mode, so clicking the button takes
  // the "no update mechanism available" fallback path: unregister/clear caches
  // and hard-reload. That reload is what we can observe here; the actual
  // checkForUpdate()/VERSION_READY branches only run against a built SW.
  test('forces a reload when no service worker is registered', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Start from scratch' }).click();
    await page.getByRole('button', { name: 'Settings' }).click();

    // A marker that only a real page reload (not an in-SPA navigation) clears.
    await page.evaluate(() => { (window as unknown as { __marker: boolean }).__marker = true; });

    const button = page.getByRole('button', { name: 'Check for updates' });
    await expect(button).toBeVisible();
    await button.click();

    // The click handler awaits unregistering/clearing caches before calling
    // reload(), so the navigation doesn't start the instant click() resolves —
    // poll for it rather than racing a single waitForLoadState() call.
    await expect
      .poll(
        () => page.evaluate(() => (window as unknown as { __marker?: boolean }).__marker === true),
        { timeout: 5000 },
      )
      .toBe(false);
  });
});
