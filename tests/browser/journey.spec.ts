import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { PerspectiveCamera, Vector3 } from 'three';
import { FOREST_MISSIONS } from '../../src/game/content/fixtures';
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

async function capture(page: Page, name: string) {
  if (process.env.P05_CAPTURE !== '1') return;
  const directory = new URL('../../docs/evidence/', import.meta.url);
  await mkdir(directory, { recursive: true });
  await page.screenshot({ path: fileURLToPath(new URL('p05-' + name + '.png', directory)), scale: 'css' });
}

async function openGame(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start exploring' }).click();
  await phase(page, 'explore');
}

test('camera entry, ready and exit freeze mission time; paused and repeated travel use one clock', async ({ page }) => {
  test.setTimeout(60_000);
  await page.clock.install({ time: new Date('2026-01-01T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T12:01:00Z'));
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
  await capture(page, 'entry');
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

  await page.getByRole('button', { name: 'Begin ride' }).click();
  const beforeTravel = await frames.evaluate(state => state.count);
  await page.clock.fastForward(travelMs / 2);
  await phase(page, 'tunnel-active');
  expect(await remaining(page)).toBe(startMs - travelMs / 2);
  const callbacksPerFrame = await frames.evaluate(state => state.count) - beforeTravel;
  expect(callbacksPerFrame).toBeGreaterThan(0);
  await capture(page, 'travel');
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
  await capture(page, 'exit');
  await page.clock.fastForward(exitMs / 2);
  await phase(page, 'explore');
  expect(await remaining(page)).toBe(startMs - travelMs);

  // Reset in the same application, preserving any loops from the previous ride.
  await page.getByRole('button', { name: 'Try again' }).click();
  expect(await remaining(page)).toBe(startMs);
  await releaseIntoHole(page);
  await page.clock.fastForward(dropMs);
  await phase(page, 'tunnel-ready');
  await page.getByRole('button', { name: 'Begin ride' }).click();
  const beforeRepeat = await frames.evaluate(state => state.count);
  await page.clock.fastForward(travelMs / 2);
  expect(await frames.evaluate(state => state.count) - beforeRepeat).toBe(callbacksPerFrame);
  await page.clock.fastForward(travelMs / 2);
  await phase(page, 'exit');
  expect(await remaining(page)).toBe(startMs - travelMs);
  expect(await originalContext.evaluate(ctx => ctx?.canvas === document.querySelector('#glade'))).toBe(true);
});

if (process.env.P05_CAPTURE === '1') {
  test('observes headless Chromium frame times during the running tunnel', async ({ page }, info) => {
    await openGame(page);
    await releaseIntoHole(page);
    await page.getByRole('button', { name: 'Begin ride' }).click();
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
