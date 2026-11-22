import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { PerspectiveCamera, Vector3 } from 'three';
import { FOREST_MISSIONS } from '../../src/game/content/fixtures';
import { frameExplorationCamera } from '../../src/game/render/exploration';

const hole = FOREST_MISSIONS[0].tunnels[0]!.entry;
const radius = 0.49;

async function groundPoint(page: Page, x: number, z: number) {
  const box = await page.locator('#glade').boundingBox();
  if (!box) throw new Error('The forest canvas is not visible');
  const camera = new PerspectiveCamera();
  frameExplorationCamera(camera, { halfWidth: 3.7, halfDepth: 3.8 }, box.width / box.height);
  const point = new Vector3(x, 0, z).project(camera);
  return { x: box.x + (point.x + 1) * box.width / 2, y: box.y + (1 - point.y) * box.height / 2 };
}

async function remaining(page: Page) {
  return Number(await page.locator('#game-clock').getAttribute('data-ms'));
}

async function capture(page: Page, filename: string) {
  if (process.env.P04_CAPTURE !== '1') return;
  const directory = new URL('../../docs/evidence/', import.meta.url);
  await mkdir(directory, { recursive: true });
  await page.screenshot({ path: fileURLToPath(new URL(filename, directory)), scale: 'css' });
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-01-01T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T12:01:00Z'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Start exploring' }).click();
  await expect(page.locator('#game')).toHaveAttribute('data-phase', 'explore');
});

test('invalid release preserves exploration time and a release inside the ring enters the hole', async ({ page }) => {
  const game = page.locator('#game');
  const score = await page.locator('#game-score').textContent();
  // Check either side of the drawn boundary, leaving a few CSS pixels for input rounding.
  const outside = await groundPoint(page, hole.x + radius + 0.12, hole.z);
  const inside = await groundPoint(page, hole.x + radius - 0.12, hole.z);
  await page.mouse.move(outside.x, outside.y);
  await page.mouse.down();
  await expect(game).toHaveAttribute('data-ready', 'false');
  await page.clock.fastForward(150);
  const before = await remaining(page);
  await page.mouse.up();
  await expect(game).toHaveAttribute('data-phase', 'explore');
  await expect(game).toHaveAttribute('data-paused', 'false');
  await expect(page.locator('#game-hint')).toContainText(/release over an opening/i);
  expect(await page.locator('#game-score').textContent()).toBe(score);
  const atRelease = await remaining(page);
  expect(atRelease).toBeLessThanOrEqual(before);
  await page.clock.fastForward(500);
  expect(await remaining(page)).toBeLessThan(atRelease);

  await page.mouse.down();
  await page.mouse.move(inside.x, inside.y);
  await expect(game).toHaveAttribute('data-ready', 'true');
  await capture(page, 'p04-ready.png');
  await page.mouse.up();
  await expect(game).toHaveAttribute('data-phase', 'drop');
});

test('a keyboard player can find the opening and deliberately release', async ({ page }) => {
  const game = page.locator('#game');
  await expect(page.locator('#glade')).toBeFocused();
  // Start at (-1.45, 1.35); held keys move at 2.8 world units per active second.
  await page.keyboard.down('ArrowRight');
  await page.clock.fastForward(1_036);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.down('ArrowUp');
  await page.clock.fastForward(982);
  await page.keyboard.up('ArrowUp');
  await expect(game).toHaveAttribute('data-ready', 'true');
  await page.keyboard.press('Space');
  await expect(game).toHaveAttribute('data-phase', 'drop');
});

test('a captured drag outside, pause, focus loss and resize cannot become a release into the hole', async ({ page }) => {
  const game = page.locator('#game');
  const action = page.locator('#game-action');
  const onHole = await groundPoint(page, hole.x, hole.z);
  const canvas = page.locator('#glade');
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(onHole.x, onHole.y);
  await page.mouse.down();
  await expect(game).toHaveAttribute('data-ready', 'true');
  // Chromium's mouse has pointerId 1. The app must retain it beyond the playfield.
  expect(await canvas.evaluate(node => node.hasPointerCapture(1))).toBe(true);
  await page.mouse.move(box.x - 4, box.y + box.height / 2);
  await page.mouse.up();
  await expect(game).toHaveAttribute('data-phase', 'explore');

  await page.mouse.move(onHole.x, onHole.y);
  await page.mouse.down();
  await expect(game).toHaveAttribute('data-ready', 'true');
  // Activate the real UI button while the primary mouse button remains held.
  await action.focus();
  await page.keyboard.press('Enter');
  await expect(game).toHaveAttribute('data-paused', 'true');
  const pausedAt = await remaining(page);
  await page.mouse.up();
  await page.clock.fastForward(1_000);
  expect(await remaining(page)).toBe(pausedAt);
  await action.click();
  await expect(game).toHaveAttribute('data-paused', 'false');
  await expect(game).toHaveAttribute('data-phase', 'explore');

  await page.mouse.move(onHole.x, onHole.y);
  await page.mouse.down();
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(game).toHaveAttribute('data-paused', 'true');
  await page.mouse.up();
  await action.click();
  await page.mouse.move(onHole.x, onHole.y);
  await page.mouse.down();
  await page.setViewportSize({ width: 740, height: 440 });
  await expect.poll(() => canvas.evaluate(node => node.hasPointerCapture(1))).toBe(false);
  await page.mouse.up();
  await expect(game).toHaveAttribute('data-phase', 'explore');
});

test.describe('touch input', () => {
  test.use({ hasTouch: true });

  test('a second finger cannot steer and cancelling over the hole pauses the attempt', async ({ page, context }) => {
    const game = page.locator('#game');
    const onHole = await groundPoint(page, hole.x, hole.z);
    const away = await groundPoint(page, -1.45, 1.35);
    const primary = { id: 1, ...onHole };
    const secondary = { id: 2, ...away };
    const input = await context.newCDPSession(page);
    await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [primary] });
    await expect(game).toHaveAttribute('data-ready', 'true');
    await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [primary, secondary] });
    await input.send('Input.dispatchTouchEvent', {
      type: 'touchMove', touchPoints: [primary, { ...secondary, x: secondary.x + 5 }],
    });
    await expect(game).toHaveAttribute('data-ready', 'true');
    await expect(game).toHaveAttribute('data-phase', 'explore');
    await input.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    await expect(game).toHaveAttribute('data-paused', 'true');
    await expect(game).toHaveAttribute('data-phase', 'explore');
    await page.locator('#game-action').click();
    await expect(game).toHaveAttribute('data-paused', 'false');
    await expect(game).toHaveAttribute('data-phase', 'explore');
    // Only the secondary contact ends over the ring; neither release can enter.
    const firstAway = { id: 3, ...away };
    const secondOnHole = { id: 4, ...onHole };
    await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [firstAway] });
    await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [firstAway, secondOnHole] });
    await expect(game).toHaveAttribute('data-ready', 'false');
    await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(game).toHaveAttribute('data-phase', 'explore');
  });
});
