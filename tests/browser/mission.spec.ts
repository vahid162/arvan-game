import { expect, test, type Page } from '@playwright/test';
import { defaultCampaignSeed, generateMission } from '../../src/game/content/generation';
import { PLAYER_RADIUS } from '../../src/game/core/collection';
import type { Profile, TunnelInstance } from '../../src/game/core/types';
import { PROFILE_KEY } from '../../src/game/profile';
import {
  beginCentered, collectLights, enterTunnel, exitMs, freezeStoryClock, groundScreenPoint, mouseSteering, releaseAt,
  remainingMissionMs, startBriefedMission, storyPhase, travelMs, winStoryMission,
} from './story-controls';

const campaign = ([0, 1, 2] as const).map(index => generateMission(index, defaultCampaignSeed(index)));
const openingMission = campaign[0]!;
const first = openingMission.tunnels[0]!;
const second = openingMission.tunnels[1]!;
const third = openingMission.tunnels[2]!;
const exhausted = 'There are too few lights left in the unopened tunnels to reach the target.';

async function assignedLayout(page: Page) {
  return page.evaluate(({ key, id }) => {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Profile).assignedMissions[id] : undefined;
  }, { key: PROFILE_KEY, id: openingMission.definition.id });
}

// Ride against the wall on the side with fewer lights. The first light reaches
// the player after the firefly has had time to reach the wall.
async function rideOuterLane(page: Page, tunnel: TunnelInstance) {
  const limit = tunnel.width / 2 - 0.43;
  const sides = [-limit, limit].map(lane => ({
    lane,
    expected: tunnel.lights.filter(light => Math.abs(light.lateral - lane) <= light.radius + PLAYER_RADIUS).length,
  }));
  const route = sides[0]!.expected <= sides[1]!.expected ? sides[0]! : sides[1]!;
  const aim = await mouseSteering(page, tunnel);
  await aim(route.lane);
  await page.clock.fastForward(travelMs(tunnel) + exitMs);
  return route.expected;
}

test.beforeEach(async ({ page }) => {
  await freezeStoryClock(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Play story' }).click();
  await expect(page.getByRole('heading', { name: 'Mission 1 of 3', exact: true })).toBeVisible();
  await startBriefedMission(page, openingMission);
});

test('a tuned opening is visible before it is close enough to enter', async ({ page }) => {
  const entrance = openingMission.tunnels.reduce((nearest, tunnel) =>
    Math.abs(nearest.entry.x) < Math.abs(tunnel.entry.x) ? nearest : tunnel).entry;
  const center = await groundScreenPoint(page, entrance);
  const game = page.locator('#game');
  async function colorAtDistance(distance: number) {
    const position = await groundScreenPoint(page, { x: entrance.x + distance, z: entrance.z });
    await page.mouse.move(position.x, position.y);
    await expect(game).toHaveAttribute('data-ready', 'false');
    // Sample the ground at the center, away from the rim and moving firefly.
    const patch = await page.screenshot({
      clip: { x: Math.floor(center.x) - 3, y: Math.floor(center.y) - 3, width: 7, height: 7 }, scale: 'css',
    });
    return page.evaluate(async base64 => {
      const image = new Image();
      image.src = 'data:image/png;base64,' + base64;
      await image.decode();
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d')!;
      context.drawImage(image, 0, 0, 1, 1);
      return Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3);
    }, patch.toString('base64'));
  }
  const contrast = (a: number[], b: number[]) => Math.max(...a.map((value, i) => Math.abs(value - b[i]!)));
  const start = await groundScreenPoint(page, { x: entrance.x + 2, z: entrance.z });
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  const hidden = await colorAtDistance(1.72);
  const visible = await colorAtDistance(1.42);
  const closer = await colorAtDistance(1.10);
  expect(contrast(visible, closer), `visible pit samples: ${visible} and ${closer}`).toBeLessThan(3);
  expect(contrast(hidden, visible), `forest floor ${hidden} versus visible pit ${visible}`).toBeGreaterThan(4);

  const outside = await groundScreenPoint(page, { x: entrance.x + 0.57, z: entrance.z });
  await page.mouse.move(outside.x, outside.y);
  await expect(game).toHaveAttribute('data-ready', 'false');
  await page.mouse.up();
  await storyPhase(page, 'explore');
  await page.mouse.down();
  const inside = await groundScreenPoint(page, { x: entrance.x + 0.41, z: entrance.z });
  await page.mouse.move(inside.x, inside.y);
  await expect(game).toHaveAttribute('data-ready', 'true');
  await page.mouse.up();
  await storyPhase(page, 'drop');
  expect(await remainingMissionMs(page)).toBe(90_000);
});

test('the forest campaign unlocks the 25- and 28-light missions with fresh 90-second clocks', async ({ page }) => {
  test.setTimeout(150_000);
  expect(campaign.map(mission => mission.definition.targetLight)).toEqual([22, 25, 28]);
  for (let index = 0; index < 2; index++) {
    await winStoryMission(page, campaign[index]!);
    await page.getByRole('button', { name: 'Next mission', exact: true }).click();
    await expect(page.getByRole('heading', { name: `Mission ${index + 2} of 3`, exact: true })).toBeVisible();
    await startBriefedMission(page, campaign[index + 1]!);
  }
  await enterTunnel(page, campaign[2]!.tunnels[0]!);
  await storyPhase(page, 'tunnel-ready');
});

test('using two openings can exhaust the target, and retry restores the same layout and collection', async ({ page }) => {
  test.setTimeout(70_000);
  const { seed, generatorVersion, contentVersion, manifestHash } = openingMission;
  const original = { seed, generatorVersion, contentVersion, manifestHash };
  expect(await assignedLayout(page)).toEqual(original);
  await enterTunnel(page, first);
  const firstScore = await rideOuterLane(page, first);
  await storyPhase(page, 'explore');
  await expect(page.locator('#game-score')).toHaveText(`${firstScore} / 36 lights`);
  await releaseAt(page, first.entry);
  await storyPhase(page, 'explore');

  await enterTunnel(page, second);
  const total = firstScore + await rideOuterLane(page, second);
  expect(total + third.lights.length).toBeLessThan(openingMission.definition.targetLight);
  await expect(page.locator('#mission-result')).toHaveText('Mission failed');
  await expect(page.locator('#game-hint')).toHaveText(exhausted);
  await expect(page.locator('#game-score')).toHaveText(`${total} / 36 lights`);
  expect(await remainingMissionMs(page)).toBe(75_000);

  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await storyPhase(page, 'explore');
  await expect(page.locator('#game-score')).toHaveText('0 / 36 lights');
  expect(await remainingMissionMs(page)).toBe(90_000);
  await enterTunnel(page, first);
  expect(await assignedLayout(page)).toEqual(original);
  await rideOuterLane(page, first);
  await expect(page.locator('#game-score')).toHaveText(`${firstScore} / 36 lights`);
});

test('missing lights in the final tunnel returns a usable failure result', async ({ page }) => {
  test.setTimeout(60_000);
  const elapsed = await collectLights(page, first, first.lights.length);
  await page.clock.fastForward(travelMs(first) - elapsed + exitMs);
  await storyPhase(page, 'explore');
  await enterTunnel(page, second);
  const subtotal = first.lights.length + await rideOuterLane(page, second);
  await storyPhase(page, 'explore');
  await enterTunnel(page, third);
  const total = subtotal + await rideOuterLane(page, third);
  expect(total).toBeLessThan(openingMission.definition.targetLight);
  await expect(page.locator('#mission-result')).toHaveText('Mission failed');
  await expect(page.locator('#game-score')).toHaveText(`${total} / 36 lights`);
  await expect(page.locator('#game-hint')).toHaveText(exhausted);
  await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeVisible();
});

test('the deadline stops an active tunnel immediately and later input cannot award more lights', async ({ page }) => {
  await page.clock.fastForward(89_000);
  await enterTunnel(page, first);
  await beginCentered(page);
  await page.clock.fastForward(999);
  await storyPhase(page, 'tunnel-active');
  const atDeadline = await page.locator('#game-score').innerText();
  expect(await remainingMissionMs(page)).toBe(1);
  await page.clock.fastForward(16);
  await expect(page.locator('#mission-result')).toHaveText('Mission failed');
  await storyPhase(page, 'failure');
  await expect(page.locator('#game-hint')).toHaveText('Time ran out before you reached the target.');
  expect(await remainingMissionMs(page)).toBe(0);
  await page.keyboard.press('ArrowLeft');
  await page.clock.fastForward(8000);
  await expect(page.locator('#game-score')).toHaveText(atDeadline);
  expect(await remainingMissionMs(page)).toBe(0);
});
