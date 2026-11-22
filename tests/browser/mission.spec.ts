import { expect, test, type Page } from '@playwright/test';
import { P07_MISSION } from '../../src/game/content/fixtures';
import type { TunnelInstance } from '../../src/game/core/types';
import { beginCentered, enterTunnel, exitMs, freezeStoryClock, mouseSteering, releaseAt, storyPhase, travelMs } from './story-controls';

const [first, second, third] = [P07_MISSION.tunnels[0]!, P07_MISSION.tunnels[1]!, P07_MISSION.tunnels[2]!];

async function expectScore(page: Page, count: number) {
  await expect(page.locator('#game-score')).toHaveText(`${count} / 36 lights`);
}

async function remaining(page: Page) {
  return Number(await page.locator('#game-clock').getAttribute('data-ms'));
}

async function centerRide(page: Page, tunnel: TunnelInstance) {
  await enterTunnel(page, tunnel);
  await beginCentered(page);
  await page.clock.fastForward(travelMs(tunnel) + exitMs);
}

// The three groups of lights alternate sides. Aim into each group and leave
// enough room at the outer edge to miss one more light on the eight-light run.
async function steerGroups(page: Page, tunnel: TunnelInstance, lights: 8 | 9) {
  await enterTunnel(page, tunnel);
  const aim = await mouseSteering(page, tunnel);
  const side = Math.sign(tunnel.lights[1]!.lateral);
  await aim(side * 0.84);
  await page.clock.fastForward(2350);
  await aim(-side * 0.75);
  await page.clock.fastForward(2163);
  await aim(side * (lights === 8 ? 1.10 : 0.70));
  await page.clock.fastForward(1700);
  return 6213;
}

test.beforeEach(async ({ page }) => {
  await freezeStoryClock(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Play story' }).click();
  const start = page.getByRole('button', { name: 'Start mission' });
  await expect(start).toBeVisible();
  await page.clock.fastForward(15_000);
  await start.click();
  await storyPhase(page, 'explore');
  await expect(page.locator('#mission-target')).toHaveText('Target 25');
  await expectScore(page, 0);
  expect(await remaining(page)).toBe(90_000);
});

test('eight, nine and eight lights win at active second 73 and a consumed opening stays closed', async ({ page }) => {
  test.setTimeout(90_000);
  await page.clock.fastForward(52_538);
  const firstElapsed = await steerGroups(page, first, 8);
  await page.clock.fastForward(travelMs(first) - firstElapsed + exitMs);
  await storyPhase(page, 'explore');
  await expectScore(page, 8);
  await releaseAt(page, first.entry);
  await storyPhase(page, 'explore');
  await expectScore(page, 8);

  const secondElapsed = await steerGroups(page, second, 9);
  await page.clock.fastForward(travelMs(second) - secondElapsed + exitMs);
  await storyPhase(page, 'explore');
  await expectScore(page, 17);
  const thirdElapsed = await steerGroups(page, third, 8);
  await expectScore(page, 25);
  const winningTime = await remaining(page);
  // Mouse coordinates are rounded to a CSS pixel. The exact final swept hit
  // can vary by a few milliseconds at the boundary of the final light.
  expect(Math.abs(winningTime - 17_000)).toBeLessThan(25);
  await page.keyboard.press('ArrowLeft');
  await page.clock.fastForward(travelMs(third) - thirdElapsed + exitMs);
  await expect(page.locator('#mission-result')).toContainText('Mission complete');
  await page.clock.fastForward(5000);
  await expectScore(page, 25);
  expect(await remaining(page)).toBe(winningTime);
});

test('two depleted tunnels can make the target unreachable, and retry restores the same opportunities', async ({ page }) => {
  test.setTimeout(75_000);
  await centerRide(page, first);
  await storyPhase(page, 'explore');
  await expectScore(page, 4);
  await centerRide(page, second);
  await expect(page.locator('#mission-result')).toContainText('Mission failed');
  await expect(page.locator('#game-hint')).toHaveText('There are too few lights left in the unopened tunnels to reach the target.');
  await expectScore(page, 8);
  expect(await remaining(page)).toBe(75_000);
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await storyPhase(page, 'explore');
  await expectScore(page, 0);
  expect(await remaining(page)).toBe(90_000);
  await centerRide(page, first);
  await storyPhase(page, 'explore');
  await expectScore(page, 4);
  expect(await remaining(page)).toBe(82_500);
});

test('an exactly reachable target permits the last tunnel and missing it returns a result', async ({ page }) => {
  test.setTimeout(75_000);
  await centerRide(page, first);
  await storyPhase(page, 'explore');
  const elapsed = await steerGroups(page, second, 9);
  await page.clock.fastForward(travelMs(second) - elapsed + exitMs);
  await storyPhase(page, 'explore');
  await expectScore(page, 13);
  await centerRide(page, third);
  await expect(page.locator('#mission-result')).toContainText('Mission failed');
  await expect(page.locator('#game-hint')).toHaveText('There are too few lights left in the unopened tunnels to reach the target.');
  await expectScore(page, 17);
  expect(await remaining(page)).toBe(67_500);
});

test('the deadline stops an active tunnel immediately and later input cannot award more lights', async ({ page }) => {
  await page.clock.fastForward(89_000);
  await enterTunnel(page, first);
  await beginCentered(page);
  await page.clock.fastForward(999);
  await storyPhase(page, 'tunnel-active');
  await expectScore(page, 1);
  expect(await remaining(page)).toBe(1);
  await page.clock.fastForward(16);
  await expect(page.locator('#mission-result')).toContainText('Mission failed');
  await storyPhase(page, 'failure');
  await expect(page.locator('#game-hint')).toHaveText('Time ran out before you reached the target.');
  expect(await remaining(page)).toBe(0);
  await page.keyboard.press('ArrowLeft');
  await page.clock.fastForward(8000);
  await expectScore(page, 1);
  expect(await remaining(page)).toBe(0);
});
