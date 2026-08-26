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
    await expect(page.locator('.metronome-bpm')).toHaveValue('80');
  });

  test('BPM stepper adjusts and clamps at [30, 300]', async ({ page }) => {
    await openBlankSong(page);
    await page.locator('.metronome-toggle-btn').click();

    const downBtn = page.locator('.metronome-control .step-btn').first();
    const upBtn = page.locator('.metronome-control .step-btn').last();
    const bpm = page.locator('.metronome-bpm');

    await clickUntilDisabled(downBtn, 60);
    await expect(bpm).toHaveValue('30');
    await expect(downBtn).toBeDisabled();

    await clickUntilDisabled(upBtn, 280);
    await expect(bpm).toHaveValue('300');
    await expect(upBtn).toBeDisabled();
  });

  test('turning off hides the stepper; turning on again re-reads the default instead of remembering', async ({ page }) => {
    await openBlankSong(page);

    await page.locator('.metronome-toggle-btn').click();
    await page.locator('.metronome-control .step-btn').last().click();
    await expect(page.locator('.metronome-bpm')).toHaveValue('81');

    await page.locator('.metronome-toggle-btn').click();
    await expect(page.locator('.metronome-control')).not.toHaveClass(/active/);
    await expect(page.locator('.metronome-bpm')).not.toBeVisible();

    await page.locator('.metronome-toggle-btn').click();
    await expect(page.locator('.metronome-bpm')).toHaveValue('80');
  });

  test('turning the metronome on for a song with a set tempo defaults BPM to that tempo', async ({ page }) => {
    await openBlankSong(page);

    await page.getByRole('button', { name: '+ BPM' }).click();
    await page.locator('.chip-input').fill('132');
    await page.keyboard.press('Enter');

    await page.locator('.metronome-toggle-btn').click();
    await expect(page.locator('.metronome-bpm')).toHaveValue('132');
  });

  test('metronome on/off and BPM are not persisted (turns off on reload)', async ({ page }) => {
    await openBlankSong(page);

    await page.locator('.metronome-toggle-btn').click();
    await expect(page.locator('.metronome-control')).toHaveClass(/active/);

    // Transport state (on/off, current BPM) is never written to storage — only
    // the unrelated, deliberately-persisted "count-in enabled?" preference may
    // legitimately appear in the prefs blob, so check for that distinction
    // rather than banning the substring "metronome" outright.
    const prefs = await page.evaluate(() => localStorage.getItem('worship_toolkit_prefs'));
    const parsedPrefs = prefs ? JSON.parse(prefs) : {};
    expect(Object.keys(parsedPrefs)).not.toContain('metronomeOn');
    expect(Object.keys(parsedPrefs)).not.toContain('bpm');
    const session = await page.evaluate(() => localStorage.getItem('worship_toolkit_session'));
    expect(session).not.toContain('metronome');

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

  test('the beat indicator accents the downbeat and not every other beat (4/4, 80 BPM)', async ({ page }) => {
    await openBlankSong(page);
    await page.locator('.metronome-toggle-btn').click();

    const indicator = page.locator('.beat-indicator');
    const sawAccent: boolean[] = [];
    for (let i = 0; i < 5; i++) {
      await expect(indicator).toHaveClass(/beat-indicator--on/, { timeout: 2000 });
      const cls = (await indicator.getAttribute('class')) ?? '';
      sawAccent.push(cls.includes('beat-indicator--accent'));
      await expect(indicator).not.toHaveClass(/beat-indicator--on/, { timeout: 2000 });
    }
    expect(sawAccent.some((v) => v)).toBe(true);
    expect(sawAccent.some((v) => !v)).toBe(true);
  });

  test('tap tempo sets BPM from two taps and writes it back to the song tempo chip', async ({ page }) => {
    await openBlankSong(page);
    await page.locator('.metronome-toggle-btn').click();

    const tapBtn = page.locator('.tap-tempo-btn');
    const bpmInput = page.locator('.metronome-bpm');
    await tapBtn.click();
    await page.waitForTimeout(500); // ~120 BPM gap
    await tapBtn.click();

    // The DOM patch lands asynchronously relative to the click resolving
    // (this app is zoneless — see CLAUDE.md), so wait for it via an
    // auto-retrying assertion rather than reading .inputValue() once.
    await expect(bpmInput).not.toHaveValue('80');
    const bpm = Number(await bpmInput.inputValue());
    expect(bpm).toBeGreaterThan(100);
    expect(bpm).toBeLessThan(140);

    // song.tempo (the toolbar BPM chip) picks up the tapped value too.
    await expect(page.locator('.chip--btn', { hasText: 'BPM' })).toContainText(String(bpm));
  });

  test('tap tempo ignores a stale gap over 2 seconds and restarts the average', async ({ page }) => {
    await openBlankSong(page);
    await page.locator('.metronome-toggle-btn').click();

    const tapBtn = page.locator('.tap-tempo-btn');
    const bpmInput = page.locator('.metronome-bpm');

    await tapBtn.click();
    await page.waitForTimeout(2200); // stale gap — resets the tap series
    await tapBtn.click(); // only one tap in the new series so far
    await expect(bpmInput).toHaveValue('80'); // still the untouched default

    await page.waitForTimeout(400);
    await tapBtn.click(); // second tap in the new series — now it sets BPM
    await expect(bpmInput).not.toHaveValue('80');
  });

  test('count-in delays the first beat-indicator pulse by roughly one bar', async ({ page }) => {
    await openBlankSong(page);
    await page.locator('.count-in-btn').click();
    await expect(page.locator('.count-in-btn')).toHaveClass(/active/);

    const start = Date.now();
    await page.locator('.metronome-toggle-btn').click();
    await expect(page.locator('.beat-indicator')).toHaveClass(/beat-indicator--on/, { timeout: 6000 });
    const elapsedMs = Date.now() - start;

    // Default BPM 80 in 4/4 → a one-bar count-in is ~3000ms; allow generous
    // slack for CI/test timing but still well above a single-beat interval.
    expect(elapsedMs).toBeGreaterThan(2000);
  });

  test('the beat indicator also renders in stage mode', async ({ page }) => {
    await openBlankSong(page);
    await page.locator('.metronome-toggle-btn').click();
    await page.locator('.stage-btn').click();
    await expect(page.locator('.stage-bar .beat-indicator')).toHaveCount(1);
  });
});
