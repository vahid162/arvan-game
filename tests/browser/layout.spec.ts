import { expect, test } from '@playwright/test';

test.use({ hasTouch: true });

test('phone menus keep every visible action and the local-save notice within the first screen', async ({ page }) => {
  test.setTimeout(60_000);
  for (const [width, height, language] of [[390, 844, 'en'], [320, 568, 'fa'], [568, 320, 'fa']] as const) {
    await page.setViewportSize({ width, height });
    await page.goto('/?lang=' + language);
    await expect(page.locator('#shell')).toHaveAttribute('data-state', 'ready', { timeout: 15_000 });
    await expect(page.locator('#local-save')).toBeInViewport({ ratio: 1 });
    for (const button of await page.locator('.scene-controls button:visible').all()) {
      await expect(button).toBeInViewport({ ratio: 1 });
      const box = (await button.boundingBox())!;
      expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(48);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  }
});

test('short landscape leaves the settings exit reachable and separates gameplay hints from the HUD', async ({ page }) => {
  await page.setViewportSize({ width: 568, height: 320 });
  await page.goto('/?lang=fa');
  await page.locator('#settings').click();
  await page.setViewportSize({ width: 568, height: 260 });
  const panel = page.locator('#settings-panel');
  await expect(panel).toBeInViewport({ ratio: 1 });
  const back = page.locator('#settings-back');
  await back.focus();
  await expect(back).toBeInViewport({ ratio: 1 });
  await back.click();
  await expect(panel).toBeHidden();
  await page.setViewportSize({ width: 568, height: 320 });

  await page.locator('#story').click();
  await page.locator('#mission-start').click();
  await expect(page.locator('#game-action')).toBeInViewport({ ratio: 1 });
  const hud = (await page.locator('.game-hud').boundingBox())!;
  const hint = (await page.locator('.play-feedback').boundingBox())!;
  expect(hud.y + hud.height).toBeLessThan(hint.y);
  for (const id of ['game-score', 'mission-target', 'game-clock', 'game-hint']) {
    await expect(page.locator('#' + id)).toBeInViewport({ ratio: 1 });
  }
});
