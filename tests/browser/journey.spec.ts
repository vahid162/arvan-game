import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { PerspectiveCamera, Vector3 } from 'three';
import { FOREST_MISSIONS } from '../../src/game/content/fixtures';
import { PROFILE_KEY } from '../../src/game/profile';
import { frameExplorationCamera } from '../../src/game/render/exploration';

const tunnel = FOREST_MISSIONS[0].tunnels[0]!;
const travelMs = tunnel.length / tunnel.speed * 1000;
const dropMs = 1200;
const exitMs = 1400;

async function releaseIntoHole(page: Page) {
  const box = (await page.locator('#glade').boundingBox())!;
  const camera = new PerspectiveCamera();
  frameExplorationCamera(camera, { halfWidth: 3.7, halfDepth: 3.8 }, box.width / box.height);
  const center = new Vector3(tunnel.entry.x, 0, tunnel.entry.z).project(camera);
  await page.mouse.click(box.x + (center.x + 1) * box.width / 2, box.y + (1 - center.y) * box.height / 2);
}

async function remaining(page: Page) {
  return Number(await page.locator('#game-clock').getAttribute('data-ms'));
}

async function phase(page: Page, expected: string) {
  await expect(page.locator('#game')).toHaveAttribute('data-phase', expected);
}

async function capture(page: Page, milestone: 'P05' | 'P06', name: string) {
  if (process.env[milestone + '_CAPTURE'] !== '1') return;
  const directory = new URL('../../docs/evidence/', import.meta.url);
  await mkdir(directory, { recursive: true });
  const file = new URL(milestone.toLowerCase() + '-' + name + '.png', directory);
  await page.screenshot({ path: fileURLToPath(file), scale: 'css' });
}

async function openGame(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start exploring' }).click();
  await phase(page, 'explore');
}

async function freezeClock(page: Page) {
  await page.clock.install({ time: new Date('2026-01-01T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T12:01:00Z'));
}

async function beginWithKeyboard(page: Page) {
  await phase(page, 'tunnel-ready');
  await page.keyboard.down('ArrowRight');
  await page.keyboard.up('ArrowRight');
  await phase(page, 'tunnel-active');
}

async function score(page: Page) {
  const text = await page.locator('#game-score').innerText();
  expect(text).toMatch(/^\d+\s*\/\s*12 lights$/i);
  return Number(text.split('/')[0]);
}

test('the keyboard tutorial can be completed after a long wait without changing a saved story', async ({ page }) => {
  test.setTimeout(75_000);
  await freezeClock(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Play story', exact: true }).click();
  await page.getByRole('button', { name: 'Start mission', exact: true }).click();
  await phase(page, 'explore');
  await page.clock.fastForward(90_000);
  await expect(page.locator('#mission-result')).toHaveText('Mission failed');
  await page.locator('#game-menu').click();
  const savedStory = () => page.evaluate(key => localStorage.getItem(key), PROFILE_KEY);
  const before = await savedStory();
  expect(before).not.toBeNull();

  await page.getByRole('button', { name: 'Start exploring' }).click();
  await phase(page, 'explore');
  await expect(page.locator('#game-clock')).toBeHidden();
  await page.clock.fastForward(300_000);
  await phase(page, 'explore');
  await page.keyboard.down('ArrowRight');
  await page.clock.fastForward(1036);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.down('ArrowUp');
  await page.clock.fastForward(982);
  await page.keyboard.up('ArrowUp');
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true');
  await page.keyboard.press('Space');
  await phase(page, 'drop');
  await page.clock.fastForward(dropMs);
  await phase(page, 'tunnel-ready');
  await page.clock.fastForward(180_000);
  await phase(page, 'tunnel-ready');
  expect(await score(page)).toBe(0);

  await beginWithKeyboard(page);
  await page.clock.fastForward(900);
  await page.keyboard.down('ArrowLeft');
  await page.clock.fastForward(240);
  await page.keyboard.up('ArrowLeft');
  await page.clock.fastForward(2000);
  expect(await score(page)).toBeGreaterThanOrEqual(3);
  await page.clock.fastForward(travelMs + exitMs);
  await expect(page.locator('#mission-result')).toHaveText('Tutorial complete');
  await expect(page.locator('#game-hint')).toContainText(/target.*90 active seconds/i);
  await expect(page.locator('#game-clock')).toBeHidden();
  expect(await savedStory()).toBe(before);
});

test('camera entry, ready and exit freeze mission time; paused and repeated travel use one clock', async ({ page }) => {
  test.setTimeout(60_000);
  await freezeClock(page);
  await openGame(page);
  const game = page.locator('#game');
  const canvas = page.locator('#glade');
  const originalContext = await canvas.evaluateHandle((node: HTMLCanvasElement) => node.getContext('webgl2'));
  // Count page callbacks actually executed per advanced frame. A second
  // rendering loop could leave the monotonic mission clock correct.
  const frames = await page.evaluateHandle(() => {
    const observed = { count: 0 };
    const schedule = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = callback => schedule(now => {
      observed.count++;
      callback(now);
    });
    return observed;
  });
  const startMs = await remaining(page);
  await releaseIntoHole(page);
  await phase(page, 'drop');
  await page.clock.fastForward(dropMs / 2);
  await phase(page, 'drop');
  expect(await remaining(page)).toBe(startMs);
  await capture(page, 'P05', 'entry');
  await page.clock.fastForward(dropMs / 2);
  await phase(page, 'tunnel-ready');
  await page.clock.fastForward(1000);
  await phase(page, 'tunnel-ready');
  expect(await remaining(page)).toBe(startMs);

  await page.keyboard.press('Escape');
  await expect(game).toHaveAttribute('data-paused', 'true');
  await page.setViewportSize({ width: 740, height: 440 });
  await page.clock.fastForward(2000);
  await phase(page, 'tunnel-ready');
  expect(await remaining(page)).toBe(startMs);
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(game).toHaveAttribute('data-paused', 'false');
  expect(await originalContext.evaluate(ctx => ctx?.canvas === document.querySelector('#glade'))).toBe(true);

  await beginWithKeyboard(page);
  const beforeTravel = await frames.evaluate(state => state.count);
  await page.clock.fastForward(travelMs / 2);
  await phase(page, 'tunnel-active');
  expect(await remaining(page)).toBe(startMs - travelMs / 2);
  const callbacksPerFrame = await frames.evaluate(state => state.count) - beforeTravel;
  expect(callbacksPerFrame).toBeGreaterThan(0);
  await capture(page, 'P05', 'travel');
  await page.keyboard.press('Escape');
  await expect(game).toHaveAttribute('data-paused', 'true');
  await page.clock.fastForward(1500);
  expect(await remaining(page)).toBe(startMs - travelMs / 2);
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.clock.fastForward(travelMs / 2);
  await phase(page, 'exit');
  await page.clock.fastForward(exitMs / 2);
  await phase(page, 'exit');
  expect(await remaining(page)).toBe(startMs - travelMs);
  await capture(page, 'P05', 'exit');
  await page.clock.fastForward(exitMs / 2);
  await phase(page, 'explore');
  expect(await remaining(page)).toBe(startMs - travelMs);

  // Reset in the same application, preserving any loops from the previous ride.
  await page.getByRole('button', { name: 'Try again' }).click();
  expect(await remaining(page)).toBe(startMs);
  await releaseIntoHole(page);
  await page.clock.fastForward(dropMs);
  await phase(page, 'tunnel-ready');
  await beginWithKeyboard(page);
  const beforeRepeat = await frames.evaluate(state => state.count);
  await page.clock.fastForward(travelMs / 2);
  expect(await frames.evaluate(state => state.count) - beforeRepeat).toBe(callbacksPerFrame);
  await page.clock.fastForward(travelMs / 2);
  await phase(page, 'exit');
  expect(await remaining(page)).toBe(startMs - travelMs);
  expect(await originalContext.evaluate(ctx => ctx?.canvas === document.querySelector('#glade'))).toBe(true);
});

test('steering to the lights beats staying in the center on the same tunnel', async ({ page }) => {
  test.setTimeout(90_000);
  await freezeClock(page);
  await openGame(page);
  await releaseIntoHole(page);
  await page.clock.fastForward(dropMs);
  await beginWithKeyboard(page);
  const readyTime = await remaining(page);
  // One late frame crosses both the end of the ride and the entire exit.
  await page.clock.fastForward(travelMs + exitMs);
  await phase(page, 'explore');
  expect(await remaining(page)).toBe(readyTime - travelMs);
  const centerScore = await score(page);
  expect(centerScore).toBeGreaterThan(0);
  expect(centerScore).toBeLessThan(tunnel.lights.length);

  await page.getByRole('button', { name: 'Try again' }).click();
  await releaseIntoHole(page);
  await page.clock.fastForward(dropMs);
  await phase(page, 'tunnel-ready');
  const box = (await page.locator('#glade').boundingBox())!;
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  await page.mouse.move(centerX, centerY);
  await phase(page, 'tunnel-active');
  expect(await score(page)).toBe(0);
  let elapsed = 0;
  for (const [index, light] of tunnel.lights.entries()) {
    const displacement = light.lateral * box.width * 0.65 / tunnel.width;
    await page.mouse.move(centerX + displacement, centerY);
    const arrival = Math.ceil(1000 * light.distance / tunnel.speed);
    await page.clock.fastForward(arrival - elapsed);
    elapsed = arrival;
    expect(await score(page)).toBe(index + 1);
    if (index === 4) await capture(page, 'P06', 'tunnel');
  }
  const timeAtFinalHit = await remaining(page);
  await page.clock.fastForward(travelMs - elapsed);
  await page.clock.fastForward(exitMs);
  await phase(page, 'explore');
  expect(await remaining(page)).toBe(timeAtFinalHit);
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  const steeredScore = await score(page);
  expect(steeredScore).toBe(tunnel.lights.length);
  await capture(page, 'P06', 'result');
  if (process.env.P06_CAPTURE === '1') console.info({ centerScore, steeredScore });
});

test.describe('touch steering', () => {
  test.use({ hasTouch: true });

  test('lifting keeps the ride moving and a fresh contact takes a new steering origin', async ({ page, context }) => {
    await freezeClock(page);
    await openGame(page);
    await releaseIntoHole(page);
    await page.clock.fastForward(dropMs);
    await phase(page, 'tunnel-ready');
    const initialTime = await remaining(page);
    const box = (await page.locator('#glade').boundingBox())!;
    const input = await context.newCDPSession(page);
    const y = box.y + box.height / 2;
    const first = { id: 1, x: box.x + box.width * 0.85, y };
    await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [first] });
    await phase(page, 'tunnel-active');
    await page.clock.fastForward(200);
    await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.clock.fastForward(550);
    expect(await remaining(page)).toBe(initialTime - 750);
    expect(await score(page)).toBe(1);

    // Press on the opposite side. An absolute steering jump would take the
    // firefly through the two left-side lights immediately ahead of it.
    const second = { id: 2, x: box.x + box.width * 0.25, y };
    await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [second] });
    expect(await score(page)).toBe(1);
    await page.clock.fastForward(1100);
    expect(await remaining(page)).toBe(initialTime - 1850);
    expect(await score(page)).toBe(1);
    const lane = tunnel.lights[4]!.lateral;
    const displacement = lane * box.width * 0.65 / tunnel.width;
    await input.send('Input.dispatchTouchEvent', {
      type: 'touchMove', touchPoints: [{ ...second, x: second.x + displacement }],
    });
    await page.clock.fastForward(1100);
    expect(await score(page)).toBe(2);
    await input.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    await expect(page.locator('#game')).toHaveAttribute('data-paused', 'true');
    const pausedAt = await remaining(page);
    await page.clock.fastForward(1000);
    expect(await remaining(page)).toBe(pausedAt);
  });
});

if (process.env.P05_CAPTURE === '1') {
  test('observes headless Chromium frame times during the running tunnel', async ({ page }, info) => {
    await openGame(page);
    await releaseIntoHole(page);
    await beginWithKeyboard(page);
    await phase(page, 'tunnel-active');
    const sample = await page.evaluate(() => new Promise<number[]>((resolve) => {
      const times: number[] = [];
      function frame(now: number) {
        const riding = document.querySelector<HTMLElement>('#game')?.dataset.phase === 'tunnel-active';
        if (riding) times.push(now);
        if (riding && times.length < 13) requestAnimationFrame(frame);
        else resolve(times.slice(1).map((time, i) => Math.round((time - times[i]!) * 10) / 10));
      }
      requestAnimationFrame(frame);
    }));
    expect(sample.length).toBeGreaterThan(0);
    expect(sample.every(ms => ms > 0)).toBe(true);
    const observation = JSON.stringify({ renderer: 'headless Chromium, SwiftShader', frameIntervalsMs: sample });
    await info.attach('tunnel-frame-intervals', { body: observation, contentType: 'application/json' });
    console.info(observation);
  });
}
