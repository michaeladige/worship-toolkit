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
