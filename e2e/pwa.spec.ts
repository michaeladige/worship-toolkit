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

test.describe('Install prompt', () => {
  // Real browsers fire `beforeinstallprompt` only on Chromium, and only when
  // their own install-eligibility heuristics are met — neither is
  // controllable from a test. Dispatch a synthetic event with a mocked
  // prompt()/userChoice so the app's own handling can be verified directly.
  async function fireBeforeInstallPrompt(page: import('@playwright/test').Page) {
    await page.evaluate(() => {
      const ev = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
        prompt: () => Promise<void>;
        userChoice: Promise<{ outcome: string; platform: string }>;
        promptCalled?: boolean;
      };
      ev.prompt = () => { ev.promptCalled = true; return Promise.resolve(); };
      ev.userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' });
      (window as unknown as { __lastInstallEvent?: unknown }).__lastInstallEvent = ev;
      window.dispatchEvent(ev);
    });
  }

  test('shows an install toast and the Settings button installs on click', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Start from scratch' }).click();
    await fireBeforeInstallPrompt(page);

    const toastInstallBtn = page.locator('.toast-action-btn', { hasText: 'Install' });
    await expect(toastInstallBtn).toBeVisible();

    // The Settings row should also be available, independent of the toast.
    await page.getByRole('button', { name: 'Settings' }).click();
    const settingsInstallBtn = page.getByRole('button', { name: '📲 Install' });
    await expect(settingsInstallBtn).toBeVisible();

    await settingsInstallBtn.click();
    const promptCalled = await page.evaluate(
      () => (window as unknown as { __lastInstallEvent: { promptCalled?: boolean } }).__lastInstallEvent.promptCalled === true,
    );
    expect(promptCalled).toBe(true);

    // Consumed after use — the row shouldn't linger.
    await expect(settingsInstallBtn).toHaveCount(0);
  });

  test('only shows the install toast once per browser', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Start from scratch' }).click();
    await fireBeforeInstallPrompt(page);
    await expect(page.locator('.toast-action-btn', { hasText: 'Install' })).toBeVisible();
    await page.locator('.latin-toast').waitFor({ state: 'detached', timeout: 10000 });

    await page.reload();
    await fireBeforeInstallPrompt(page);
    // Settings button (tied to the fresh event, not the hint) should still work…
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByRole('button', { name: '📲 Install' })).toBeVisible();
    // …but the toast should not reappear a second time.
    await expect(page.locator('.toast-action-btn', { hasText: 'Install' })).toHaveCount(0);
  });

  test('home page shows an install button always, and it upgrades to a real prompt once available', async ({ page }) => {
    await page.goto('/');
    const homeInstallBtn = page.locator('.install-app-btn');
    await expect(homeInstallBtn).toBeVisible();

    // Before any install event has fired (and not iOS), clicking falls back
    // to a generic pointer at the browser's own install UI.
    await homeInstallBtn.click();
    await expect(page.locator('.latin-toast')).toContainText('install icon');

    await fireBeforeInstallPrompt(page);
    await homeInstallBtn.click();
    const promptCalled = await page.evaluate(
      () => (window as unknown as { __lastInstallEvent: { promptCalled?: boolean } }).__lastInstallEvent.promptCalled === true,
    );
    expect(promptCalled).toBe(true);
    // Still shown afterward — it's unconditional now, not tied to the
    // one-shot captured event.
    await expect(homeInstallBtn).toBeVisible();
  });
});

test.describe('Home page tagline', () => {
  test('shows a non-empty tagline that cycles to a different one over time', async ({ page }) => {
    await page.goto('/');
    const subtitle = page.locator('.subtitle');
    const first = await subtitle.textContent();
    expect(first).toBeTruthy();

    // The English pool has 10 entries and the cycle logic explicitly avoids
    // repeating the one on screen, so a change is guaranteed within one cycle.
    await expect.poll(async () => await subtitle.textContent(), { timeout: 7000 }).not.toBe(first);
  });
});
