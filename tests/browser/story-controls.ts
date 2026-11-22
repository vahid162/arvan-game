import { expect, type Page } from '@playwright/test';
import { PerspectiveCamera, Vector3 } from 'three';
import type { Anchor, TunnelInstance } from '../../src/game/core/types';
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
