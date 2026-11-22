import { expect, test, type Page, type Route } from '@playwright/test';
import { defaultCampaignSeed, generateMission } from '../../src/game/content/generation';
import { openProfile, PROFILE_KEY } from '../../src/game/profile';
import {
  collectLights, enterTunnel, exitMs, freezeStoryClock, groundScreenPoint, remainingMissionMs, storyPhase, travelMs,
} from './story-controls';

const mission = generateMission(0, defaultCampaignSeed(0));
const tunnel = mission.tunnels[0]!;
const unreachable = 'Could not reach Light Hunt. Check your connection and try again.';

function savedProfile(page: Page) {
  return page.evaluate(key => localStorage.getItem(key), PROFILE_KEY);
}

async function offerStory(page: Page) {
  await freezeStoryClock(page);
  await page.goto('/?lang=en');
  await page.getByRole('button', { name: 'Play story', exact: true }).click();
}

async function waitForPlay(page: Page) {
  // First play loads the game chunk and compiles the WebGL scene before the clock starts.
  await expect(page.locator('#game')).toHaveAttribute('data-phase', 'explore', { timeout: 25_000 });
}

async function hint(page: Page, event: 'online' | 'offline') {
  await page.evaluate(type => window.dispatchEvent(new Event(type)), event);
}

test('a timed start waits for a fresh service response, spends no time on failure and rejects a fallback HTML page', async ({ page }) => {
  test.setTimeout(75_000);
  let held: Route | undefined;
  let attempts = 0;
  await page.route('**/health', async route => {
    attempts++;
    if (attempts === 1) {
      held = route;
    } else if (attempts === 2) {
      await route.fulfill({ status: 200, contentType: 'text/html', body: '<html>Proxy fallback</html>' });
    } else {
      await route.continue();
    }
  });
  await offerStory(page);
  // Some network adapters report offline even when this site's endpoint is reachable.
  await page.evaluate(() => Object.defineProperty(navigator, 'onLine', { value: false, configurable: true }));
  const initial = await savedProfile(page);
  const status = page.locator('#brief-status');
  const start = page.locator('#mission-start');
  await start.click();
  await expect(status).toHaveText('Checking connection…');
  await expect.poll(() => Boolean(held)).toBe(true);
  await expect(page.locator('#game')).toBeHidden();
  await page.clock.fastForward(4_001);
  await expect(status).toHaveText(unreachable);
  await held!.abort();
  await expect(start).toHaveText('Retry connection');
  await page.clock.fastForward(90_000);
  expect(await savedProfile(page)).toBe(initial);
  await expect(page.locator('#mission-result')).toBeHidden();

  await start.click();
  await expect(status).toHaveText(unreachable);
  expect(attempts).toBe(2);
  expect(await savedProfile(page)).toBe(initial);
  const healthy = page.waitForResponse(response => new URL(response.url()).pathname === '/health' && response.status() === 200);
  await start.click();
  expect(await (await healthy).json()).toEqual({ status: 'ok' });
  await waitForPlay(page);
  expect(attempts).toBe(3);
  expect(await remainingMissionMs(page)).toBe(90_000);
  await expect(page.locator('#game-score')).toHaveText('0 / 36 lights');
  expect(JSON.parse((await savedProfile(page))!).assignedMissions['forest-1']).toBeDefined();
});

test('a connectivity interruption freezes live play and requires a verified connection and a deliberate resume', async ({ page }) => {
  test.setTimeout(90_000);
  let reachable = true;
  let checks = 0;
  await page.route('**/health', async route => {
    checks++;
    if (reachable) await route.continue();
    else await route.fulfill({ status: 503, body: 'Service unavailable' });
  });
  await offerStory(page);
  await page.locator('#mission-start').click();
  await waitForPlay(page);
  const game = page.locator('#game');
  const action = page.locator('#game-action');
  const feedback = page.locator('#game-hint');
  const entrance = await groundScreenPoint(page, tunnel.entry);
  await page.mouse.move(entrance.x, entrance.y);
  await page.mouse.down();
  await expect(game).toHaveAttribute('data-ready', 'true');
  await hint(page, 'offline');
  await expect(action).toHaveText('Resume');
  await expect(feedback).toHaveText(/Connection restored/i);
  await page.clock.fastForward(10_000);
  expect(await remainingMissionMs(page)).toBe(90_000);
  await action.focus();
  await page.keyboard.press('Enter');
  await expect(game).toHaveAttribute('data-paused', 'false');
  // Releasing the contact that began before the interruption must not enter the opening.
  await page.mouse.up();
  await waitForPlay(page);
  await enterTunnel(page, tunnel);
  await page.keyboard.down('ArrowRight');
  await storyPhase(page, 'tunnel-active');
  await page.clock.fastForward(500);

  reachable = false;
  await hint(page, 'offline');
  await expect(feedback).toHaveText(unreachable);
  await expect(action).toHaveText('Check connection');
  const time = await remainingMissionMs(page);
  const score = await page.locator('#game-score').innerText();
  // A held key, an Escape press and a failed online hint cannot restart the clock.
  await page.keyboard.up('ArrowRight');
  await page.keyboard.press('Escape');
  const beforeOnline = checks;
  await hint(page, 'online');
  await expect.poll(() => checks).toBeGreaterThan(beforeOnline);
  await expect(action).toHaveText('Check connection');
  await page.clock.fastForward(95_000);
  await expect(game).toHaveAttribute('data-paused', 'true');
  expect(await remainingMissionMs(page)).toBe(time);
  await expect(page.locator('#game-score')).toHaveText(score);
  await expect(page.locator('#mission-result')).toBeHidden();

  reachable = true;
  await action.click();
  await expect(action).toHaveText('Resume');
  await expect(feedback).toHaveText(/Connection restored/i);
  await page.clock.fastForward(5_000);
  expect(await remainingMissionMs(page)).toBe(time);
  await action.click();
  await expect(game).toHaveAttribute('data-paused', 'false');
  const traffic: string[] = [];
  page.on('request', request => traffic.push(request.url()));
  await page.keyboard.down('ArrowLeft');
  await page.clock.fastForward(200);
  await page.keyboard.up('ArrowLeft');
  await page.clock.runFor(350);
  await action.click();
  await expect(game).toHaveAttribute('data-paused', 'true');
  expect(await remainingMissionMs(page)).toBe(time - 550);
  expect(traffic).toEqual([]);
});

test('both starting practice and retrying it require a new successful check', async ({ page }) => {
  test.setTimeout(75_000);
  const store = await openProfile();
  store.useMemory();
  for (const index of [0, 1, 2] as const) {
    const next = store.assignMission(index)!;
    store.completeMission(next);
    store.finishPresentation(next.definition.id);
  }
  const original = JSON.stringify(store.profile);
  store.close();
  await page.addInitScript(({ key, raw }) => localStorage.setItem(key, raw), { key: PROFILE_KEY, raw: original });
  let reachable = false;
  let checks = 0;
  await page.route('**/health', async route => {
    checks++;
    if (reachable) await route.continue();
    else await route.abort('internetdisconnected');
  });
  await freezeStoryClock(page);
  await page.goto('/?lang=en');
  await page.getByRole('button', { name: 'Practice', exact: true }).click();
  await page.getByRole('button', { name: 'Mission 1', exact: true }).click();
  await page.getByRole('button', { name: 'Start practice', exact: true }).click();
  await expect(page.locator('#brief-status')).toHaveText(unreachable);
  expect(await savedProfile(page)).toBe(original);
  reachable = true;
  await page.locator('#mission-start').click();
  await waitForPlay(page);
  await page.clock.fastForward(90_000);
  await expect(page.locator('#mission-result')).toHaveText('Practice failed');
  const afterPlay = await savedProfile(page);
  reachable = false;
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.locator('#game-hint')).toHaveText(unreachable);
  await page.clock.fastForward(15_000);
  expect(await savedProfile(page)).toBe(afterPlay);
  reachable = true;
  await page.locator('#game-action').click();
  await waitForPlay(page);
  expect(await remainingMissionMs(page)).toBe(90_000);
  expect(checks).toBe(4);
});

test('an elixir saved on the winning input survives failed service and a lost WebGL context', async ({ page }) => {
  test.setTimeout(100_000);
  await offerStory(page);
  await page.locator('#mission-start').click();
  await waitForPlay(page);
  const elapsed = await collectLights(page, tunnel, tunnel.lights.length);
  await page.clock.fastForward(travelMs(tunnel) - elapsed + exitMs);
  const second = mission.tunnels[1]!;
  await collectLights(page, second, mission.definition.targetLight - tunnel.lights.length);
  await storyPhase(page, 'exit');
  const win = await savedProfile(page);
  expect(JSON.parse(win!)).toMatchObject({ completedMissionIds: ['forest-1'], pendingPresentationMissionId: 'forest-1', crystals: 0 });
  await page.route('**/health', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await hint(page, 'offline');
  await page.clock.fastForward(travelMs(second) + exitMs);
  await expect(page.locator('#mission-result')).toHaveText('Mission complete');
  expect(await savedProfile(page)).toBe(win);

  await page.locator('#glade').evaluate((canvas: HTMLCanvasElement) => {
    const extension = canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context');
    if (!extension) throw new Error('The Chromium WebGL context cannot simulate a lost device');
    extension.loseContext();
  });
  await expect(page.locator('#shell')).toHaveAttribute('data-state', 'failed');
  await expect(page.locator('#status')).toContainText(/graphics.*interrupt/i);
  await page.getByRole('link', { name: /reload/i }).click();
  await expect(page.getByRole('heading', { name: 'Elixir delivered' })).toBeVisible();
  expect(await savedProfile(page)).toBe(win);
  await page.getByRole('button', { name: 'Next mission' }).click();
  await page.getByRole('button', { name: 'Start mission' }).click();
  await expect(page.locator('#brief-status')).toHaveText(unreachable);
  expect(JSON.parse((await savedProfile(page))!)).toMatchObject({ completedMissionIds: ['forest-1'], crystals: 0 });
});

test('a suspended audio device recovers on deliberate input and the browser pauses the mission on document hide', async ({ page }) => {
  test.setTimeout(75_000);
  // Retain the game's real Web Audio object so the browser can suspend its output device.
  await page.addInitScript(() => {
    const NativeAudio = window.AudioContext;
    window.AudioContext = class extends NativeAudio {
      constructor() {
        super();
        Object.defineProperty(window, 'observedAudio', { value: this, configurable: true });
      }
    };
  });
  await offerStory(page);
  await page.locator('#mission-start').click();
  await waitForPlay(page);
  await page.keyboard.press('ArrowLeft');
  type AudioWindow = Window & { observedAudio?: AudioContext };
  const audioState = () => page.evaluate(() => (window as AudioWindow).observedAudio?.state);
  await expect.poll(audioState).toBe('running');
  await page.evaluate(() => (window as AudioWindow).observedAudio!.suspend());
  await expect.poll(audioState).toBe('suspended');
  await page.clock.fastForward(500);
  expect(await remainingMissionMs(page)).toBe(89_500);
  await page.keyboard.press('ArrowRight');
  await expect.poll(audioState).toBe('running');

  // Headless-shell does not hide a tab on CDP freeze. Real same-origin navigation
  // delivers a trusted visibilitychange while the outgoing document is still observable.
  await page.evaluate(() => {
    document.addEventListener('visibilitychange', event => {
      if (document.hidden && event.isTrusted) {
        sessionStorage.setItem('p12-hidden-state', JSON.stringify({
          paused: document.getElementById('game')?.dataset.paused,
          time: document.getElementById('game-clock')?.dataset.ms,
          score: document.getElementById('game-score')?.textContent,
        }));
      }
    });
  });
  await page.goto('/health');
  const snapshot = await page.evaluate(() => sessionStorage.getItem('p12-hidden-state'));
  expect(snapshot && JSON.parse(snapshot)).toEqual({ paused: 'true', time: '89500', score: '0 / 36 lights' });
});
