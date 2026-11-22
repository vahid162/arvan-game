import { expect, type Page } from '@playwright/test';
import { PerspectiveCamera, Vector3 } from 'three';
import type { Anchor, GeneratedMission, TunnelInstance } from '../../src/game/core/types';
import { frameExplorationCamera } from '../../src/game/render/exploration';

export const dropMs = 1200;
export const exitMs = 1400;

export async function freezeStoryClock(page: Page) {
  await page.clock.install({ time: new Date('2026-01-01T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T12:01:00Z'));
}

export async function storyPhase(page: Page, phase: string) {
  await expect(page.locator('#game')).toHaveAttribute('data-phase', phase);
}

export async function releaseAt(page: Page, anchor: Anchor) {
  const box = (await page.locator('#glade').boundingBox())!;
  const camera = new PerspectiveCamera();
  frameExplorationCamera(camera, { halfWidth: 3.7, halfDepth: 3.8 }, box.width / box.height);
  const projected = new Vector3(anchor.x, 0, anchor.z).project(camera);
  await page.mouse.click(box.x + (projected.x + 1) * box.width / 2, box.y + (1 - projected.y) * box.height / 2);
}

export async function enterTunnel(page: Page, tunnel: TunnelInstance) {
  await releaseAt(page, tunnel.entry);
  await storyPhase(page, 'drop');
  await page.clock.fastForward(dropMs);
  await storyPhase(page, 'tunnel-ready');
}

export function travelMs(tunnel: TunnelInstance) {
  return 1000 * tunnel.length / tunnel.speed;
}

export async function beginCentered(page: Page) {
  await page.keyboard.down('ArrowRight');
  await page.keyboard.up('ArrowRight');
  await storyPhase(page, 'tunnel-active');
}

export async function mouseSteering(page: Page, tunnel: TunnelInstance) {
  const box = (await page.locator('#glade').boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await storyPhase(page, 'tunnel-active');
  return async (lane: number) => {
    await page.mouse.move(x + lane * box.width * 0.65 / tunnel.width, y);
  };
}

export async function remainingMissionMs(page: Page) {
  return Number(await page.locator('#game-clock').getAttribute('data-ms'));
}

export async function startBriefedMission(page: Page, mission: GeneratedMission) {
  const start = page.getByRole('button', { name: 'Start mission', exact: true });
  await expect(start).toBeVisible();
  await page.clock.fastForward(15_000);
  await start.click();
  await storyPhase(page, 'explore');
  await expect(page.locator('#mission-target')).toHaveText(`Target ${mission.definition.targetLight}`);
  await expect(page.locator('#game-score')).toHaveText('0 / 36 lights');
  expect(await remainingMissionMs(page)).toBe(mission.definition.timeLimitMs);
}

export async function collectLights(page: Page, tunnel: TunnelInstance, count: number) {
  await enterTunnel(page, tunnel);
  const aim = await mouseSteering(page, tunnel);
  let elapsed = 0;
  for (const light of tunnel.lights.slice(0, count)) {
    await aim(light.lateral);
    const arrival = Math.ceil(1000 * light.distance / tunnel.speed);
    await page.clock.fastForward(arrival - elapsed);
    elapsed = arrival;
  }
  return elapsed;
}

export async function winStoryMission(page: Page, mission: GeneratedMission) {
  const target = mission.definition.targetLight;
  let collected = 0;
  for (const tunnel of mission.tunnels) {
    const count = Math.min(tunnel.lights.length, target - collected);
    const elapsed = await collectLights(page, tunnel, count);
    collected += count;
    await expect(page.locator('#game-score')).toHaveText(`${collected} / 36 lights`);
    const timeAtPickup = await remainingMissionMs(page);
    await page.clock.fastForward(travelMs(tunnel) - elapsed + exitMs);
    if (collected === target) {
      await expect(page.locator('#mission-result')).toHaveText('Mission complete');
      expect(await remainingMissionMs(page)).toBe(timeAtPickup);
      return;
    }
    await storyPhase(page, 'explore');
  }
  throw new Error('The mission ran out of lights before reaching its target');
}
