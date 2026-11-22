import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { defaultCampaignSeed, generateMission } from '../../src/game/content/generation';
import { openProfile, PROFILE_KEY } from '../../src/game/profile';
import { collectLights, freezeStoryClock, storyPhase } from './story-controls';

test.use({ locale: 'en-US', viewport: { width: 390, height: 844 } });

async function expectLanguage(page: Page, language: 'fa' | 'en') {
  await expect(page.locator('html')).toHaveAttribute('lang', language);
  await expect(page.locator('html')).toHaveAttribute('dir', language === 'fa' ? 'rtl' : 'ltr');
}

async function capture(page: Page, name: string) {
  if (process.env.PERSIAN_THEME_CAPTURE !== '1') return;
  const directory = new URL('../../docs/evidence/persian-theme/', import.meta.url);
  await mkdir(directory, { recursive: true });
  await page.screenshot({ path: fileURLToPath(new URL(name + '.png', directory)), scale: 'css' });
}

test('a fresh visit renders Persian with the local Vazirmatn font across menu, briefing and playable HUD', async ({ page, context, baseURL }) => {
  test.setTimeout(90_000);
  const fonts: string[] = [];
  page.on('response', response => {
    if (response.request().resourceType() === 'font' && response.ok()) fonts.push(response.url());
  });
  await freezeStoryClock(page);
  await page.goto('/');
  const story = page.getByRole('button', { name: 'شروع داستان', exact: true });
  await expect(story).toBeVisible();
  await expectLanguage(page, 'fa');
  await page.evaluate(() => document.fonts.ready);
  expect(fonts.some(url => new URL(url).pathname.endsWith('.woff2'))).toBe(true);
  for (const url of fonts) expect(new URL(url).origin).toBe(new URL(baseURL!).origin);

  // Ask Chromium which font supplied real Persian glyphs, including native buttons and HUD text.
  const cdp = await context.newCDPSession(page);
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  const { root } = await cdp.send('DOM.getDocument');
  async function expectPersianText(selector: string) {
    await expect(page.locator(selector)).toBeInViewport({ ratio: 1 });
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector });
    const { fonts: used } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
    expect(used.some(font => font.isCustomFont && font.glyphCount > 0 && /vazirmatn/i.test(font.familyName))).toBe(true);
  }
  await expectPersianText('#story');
  await capture(page, 'menu');

  await story.click();
  await expect(page.getByRole('dialog', { name: 'مأموریت ۱ از ۳' })).toBeVisible();
  await expectPersianText('#brief-title');
  await expect(page.locator('#mission-start')).toBeInViewport({ ratio: 1 });
  await capture(page, 'briefing');

  await page.getByRole('button', { name: 'شروع مأموریت' }).click();
  const tunnel = generateMission(0, defaultCampaignSeed(0)).tunnels[0]!;
  await collectLights(page, tunnel, 5);
  await storyPhase(page, 'tunnel-active');
  const clock = page.locator('#game-clock');
  await expect(clock).toHaveAttribute('dir', 'ltr');
  await expect(clock).toHaveText(/^[۰-۹]:[۰-۹]{2}$/u);
  await expect(page.locator('#game-score')).toHaveText('۵ از ۳۶ نور');
  await expect(page.locator('#mission-target')).toHaveText('هدف ۲۲');
  await expectPersianText('#game-score');
  await expect(page.locator('#game-hint')).toBeInViewport({ ratio: 1 });
  await expect(page.locator('#game-action')).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await capture(page, 'tunnel-hud');
  await cdp.detach();
});

test('a visit-only language override preserves a progressed save and the Settings selector persists only its language', async ({ page }) => {
  test.setTimeout(120_000);
  const store = await openProfile();
  store.useMemory();
  for (const index of [0, 1, 2] as const) {
    const mission = store.assignMission(index)!;
    expect(store.completeMission(mission)).toBe(true);
    store.finishPresentation(mission.definition.id);
  }
  expect(store.purchaseUpgrade('exploration-radius')).toBe('purchased');
  expect(store.recordPractice(store.practiceMission(0)!, store.profile.upgrades, 22)).toBe(22);
  const legacy = store.profile;
  store.close();

  const original = JSON.stringify(legacy);
  await page.addInitScript(({ key, value }) => {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
  }, { key: PROFILE_KEY, value: original });
  const raw = () => page.evaluate(key => localStorage.getItem(key), PROFILE_KEY);

  await page.setViewportSize({ width: 1100, height: 760 });
  await page.goto('/?lang=en');
  await expect(page.getByRole('button', { name: 'View forest' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1100);
  await expectLanguage(page, 'en');
  expect(await raw()).toBe(original);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'دیدن جنگل' })).toBeVisible();
  await expectLanguage(page, 'fa');
  expect(await raw()).toBe(original);

  await page.getByRole('button', { name: 'تنظیمات' }).click();
  const settings = page.locator('#settings-panel');
  const select = settings.getByRole('combobox', { name: 'زبان', exact: true });
  await expect(select).toHaveValue('fa');
  await select.focus();
  await select.selectOption('en');
  await expectLanguage(page, 'en');
  await expect(settings.getByRole('combobox', { name: 'Language', exact: true })).toBeFocused();
  expect(new URL(page.url()).searchParams.has('lang')).toBe(false);
  const savedEnglish = (await raw())!;
  expect(JSON.parse(savedEnglish)).toEqual({ ...legacy, settings: { ...legacy.settings, language: 'en' } });

  await page.reload();
  await expect(page.getByRole('button', { name: 'View forest' })).toBeVisible();
  await expectLanguage(page, 'en');
  await page.goto('/?lang=de');
  await expect(page.getByRole('button', { name: 'View forest' })).toBeVisible();
  await expectLanguage(page, 'en');
  expect(await raw()).toBe(savedEnglish);
  await page.goto('/?lang=fa');
  await expect(page.getByRole('button', { name: 'دیدن جنگل' })).toBeVisible();
  await expectLanguage(page, 'fa');
  expect(await raw()).toBe(savedEnglish);

  await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await settings.getByRole('combobox', { name: 'Language' }).selectOption('fa');
  await expectLanguage(page, 'fa');
  expect(JSON.parse((await raw())!)).toEqual({ ...legacy, settings: { ...legacy.settings, language: 'fa' } });
  await page.reload();
  await expect(page.getByRole('button', { name: 'دیدن جنگل' })).toBeVisible();
  await expectLanguage(page, 'fa');
});

test('a fresh Persian visit gives readable recovery instructions when the entry module is missing', async ({ page }) => {
  await page.route('**/*.js', route => route.abort('failed'));
  await page.goto('/');
  await expectLanguage(page, 'fa');
  await expect(page.locator('#shell')).toHaveAttribute('data-state', 'failed');
  await expect(page.getByRole('heading', { name: 'شکار نور' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('بازی بارگذاری نشد');
  await expect(page.getByRole('link', { name: 'بارگذاری دوباره' })).toBeVisible();
});
