import { expect, test, type Page } from '@playwright/test';
import { defaultCampaignSeed, generateMission } from '../../src/game/content/generation';
import { PLAYER_RADIUS } from '../../src/game/core/collection';
import type { Profile, TunnelInstance } from '../../src/game/core/types';
import { PROFILE_KEY } from '../../src/game/profile';
import {
  beginCentered, collectLights, enterTunnel, exitMs, freezeStoryClock, mouseSteering, releaseAt,
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
