import { expect, test } from '@playwright/test';
import { TUNNEL_DEMO } from '../../src/game/content/fixtures';
import { PROFILE_KEY } from '../../src/game/profile';
import { beginCentered, enterTunnel, freezeStoryClock, storyPhase } from './story-controls';

test('settings survive reload, and a muted tutorial still shows collected lights', async ({ page }) => {
  test.setTimeout(75_000);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await freezeStoryClock(page);
  await page.addInitScript(key => {
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, JSON.stringify({
        version: 1, completedMissionIds: [], claimedWorldIds: [], crystals: 0, upgrades: {},
        assignedMissions: {}, pendingPresentationMissionId: null, practiceRecords: {},
        settings: { sound: true, reducedMotion: false, sensitivity: 1.15 },
      }));
    }
    const Audio = window.AudioContext;
    Object.defineProperty(window, 'AudioContext', {
      value: class extends Audio {
        constructor() {
          super();
          document.documentElement.dataset.audioStarted = 'true';
        }
      },
    });
  }, PROFILE_KEY);
  await page.goto('/');
  await expect(page.locator('#shell')).toHaveAttribute('data-reduced-motion', 'false');
  await page.getByRole('button', { name: 'Pause motion', exact: true }).click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('#shell')).toHaveAttribute('data-reduced-motion', 'true');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator('#shell')).toHaveAttribute('data-reduced-motion', 'false');
  await expect(page.getByRole('button', { name: 'Resume motion', exact: true })).toBeVisible();
  const settings = page.getByRole('button', { name: 'Settings', exact: true });
  await settings.click();
  const sound = page.getByRole('checkbox', { name: 'Sound effects' });
  const motion = page.getByRole('checkbox', { name: 'Reduce motion' });
  const sensitivity = page.getByRole('combobox', { name: 'Pointer sensitivity' });
  await expect(sensitivity).toHaveValue('1.15');
  await sound.uncheck();
  await motion.check();
  await sensitivity.selectOption('0.75');
  await expect(sensitivity.locator('option', { hasText: 'Saved' })).toHaveCount(0);
  const expected = { sound: false, reducedMotion: true, sensitivity: 0.75 };
  const raw = await page.evaluate(key => localStorage.getItem(key), PROFILE_KEY);
  expect(JSON.parse(raw!).settings).toEqual(expected);

  await page.reload();
  await settings.click();
  await expect(sound).not.toBeChecked();
  await expect(motion).toBeChecked();
  await expect(sensitivity).toHaveValue('0.75');
  await expect(page.locator('#shell')).toHaveAttribute('data-reduced-motion', 'true');
  await page.keyboard.press('Escape');
  await expect(settings).toBeFocused();
  await page.getByRole('button', { name: 'Start exploring' }).click();
  await enterTunnel(page, TUNNEL_DEMO.tunnels[0]!);
  await beginCentered(page);
  await page.clock.fastForward(3000);
  await storyPhase(page, 'tunnel-active');
  await expect(page.locator('#game-score')).not.toHaveText('0 / 12 lights');
  await expect(page.locator('html')).not.toHaveAttribute('data-audio-started', 'true');
  expect(await page.evaluate(key => localStorage.getItem(key), PROFILE_KEY)).toBe(raw);
});

test('Persian RTL presentation keeps the briefing and HUD readable in landscape and narrow portrait', async ({ page }) => {
  await freezeStoryClock(page);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/?lang=fa');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.getByRole('button', { name: 'شروع داستان', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'مأموریت ۱ از ۳' })).toBeVisible();
  const start = page.getByRole('button', { name: 'شروع مأموریت' });
  expect((await start.boundingBox())!.height).toBeGreaterThanOrEqual(48);
  await start.click();
  await storyPhase(page, 'explore');
  await page.setViewportSize({ width: 320, height: 640 });
  await expect(page.locator('#game-score')).toHaveText('۰ از ۳۶ نور');
  await expect(page.locator('#mission-target')).toHaveText('هدف ۲۲');
  await expect(page.locator('#game-clock')).toHaveText('1:30');
  const screen = await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth }));
  expect(screen.content).toBe(screen.width);
});

test('the first deliberate control unlocks audio for a deadline in the clearing', async ({ page }) => {
  await freezeStoryClock(page);
  await page.addInitScript(() => {
    const Audio = window.AudioContext;
    let notes = 0;
    Object.defineProperty(window, 'AudioContext', {
      value: class extends Audio {
        constructor() {
          super();
          document.documentElement.dataset.audioStarted = 'true';
        }
        createOscillator() {
          document.documentElement.dataset.audioNotes = String(++notes);
          return super.createOscillator();
        }
      },
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Play story', exact: true }).click();
  await page.getByRole('button', { name: 'Start mission', exact: true }).click();
  await storyPhase(page, 'explore');
  const canvas = (await page.locator('#glade').boundingBox())!;
  await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
  const html = page.locator('html');
  await expect(html).not.toHaveAttribute('data-audio-started', 'true');
  await page.keyboard.press('ArrowLeft');
  await expect(html).toHaveAttribute('data-audio-started', 'true');
  await page.clock.fastForward(90_000);
  await expect(page.locator('#mission-result')).toHaveText('Mission failed');
  await expect(html).toHaveAttribute('data-audio-notes', '2');
});
