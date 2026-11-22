import { expect, test, type Page } from '@playwright/test';
import { defaultCampaignSeed, generateMission } from '../../src/game/content/generation';
import type { Profile } from '../../src/game/core/types';
import { PROFILE_KEY } from '../../src/game/profile';
import { collectLights, exitMs, freezeStoryClock, storyPhase, travelMs } from './story-controls';

const missions = ([0, 1, 2] as const).map(index => generateMission(index, defaultCampaignSeed(index)));
const restored: Profile = {
  version: 1,
  completedMissionIds: missions.map(mission => mission.definition.id),
  claimedWorldIds: ['forest'],
  crystals: 12,
  upgrades: {},
  settings: { sound: true, reducedMotion: true, sensitivity: 1 },
  assignedMissions: Object.fromEntries(missions.map(({ definition, seed, generatorVersion, contentVersion, manifestHash }) =>
    [definition.id, { seed, generatorVersion, contentVersion, manifestHash }])),
  pendingPresentationMissionId: null,
  practiceRecords: {},
};

test.use({
  storageState: async ({ baseURL }, use) => {
    await use({
      cookies: [],
      origins: [{ origin: new URL(baseURL!).origin, localStorage: [{ name: PROFILE_KEY, value: JSON.stringify(restored) }] }],
    });
  },
});

async function readProfile(page: Page): Promise<Profile> {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)!), PROFILE_KEY);
}

async function openShop(page: Page) {
  await page.getByRole('button', { name: 'Shop', exact: true }).click();
  const panel = page.locator('#shop-panel');
  await expect(panel).toBeVisible();
  return panel;
}

for (const [id, cost, otherCost] of [
  ['exploration-radius', 8, 10],
  ['collection-radius', 10, 8],
] as const) {
  test(`the ${id} purchase costs ${cost}, survives reload and leaves the other level unaffordable`, async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Shop', exact: true })).toHaveClass('primary');
    let shop = await openShop(page);
    await expect(page.locator('#shop-balance')).toHaveText('12 crystals');
    await shop.getByRole('button', { name: `Buy for ${cost} crystals`, exact: true }).click();
    const balance = 12 - cost;
    await expect(page.locator('#shop-feedback')).toHaveText('Upgrade equipped for your next practice run.');
    for (const reload of [false, true]) {
      if (reload) {
        await page.reload();
        shop = await openShop(page);
      }
      await expect(page.locator('#shop-balance')).toHaveText(`${balance} crystals`);
      await expect(shop.getByRole('button', { name: 'Owned', exact: true })).toBeDisabled();
      await expect(shop.getByRole('button', { name: `Buy for ${otherCost} crystals`, exact: true })).toBeDisabled();
      await expect(shop.getByText(`Need ${otherCost - balance} more crystals`)).toBeVisible();
      expect(await readProfile(page)).toEqual({ ...restored, crystals: balance, upgrades: { [id]: 1 } });
    }
  });
}

test('a purchased level is usable in practice and the best score is the only change to the saved forest', async ({ page }) => {
  test.setTimeout(90_000);
  await freezeStoryClock(page);
  await page.goto('/');
  const shop = await openShop(page);
  await shop.getByRole('button', { name: 'Buy for 8 crystals', exact: true }).click();
  await shop.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Practice', exact: true })).toHaveClass('primary');
  const before = await readProfile(page);
  expect(before.upgrades).toEqual({ 'exploration-radius': 1 });
  const progress = page.locator('#forest-progress');
  await expect(progress).toHaveText('Forest restored: 3 / 3 · 4 crystals');

  await page.getByRole('button', { name: 'Practice', exact: true }).click();
  const practice = page.locator('#practice-panel');
  for (const n of [1, 2, 3]) {
    await expect(practice.getByRole('button', { name: `Mission ${n}`, exact: true })).toBeEnabled();
  }
  await practice.getByRole('button', { name: 'Mission 1', exact: true }).click();
  const briefing = page.locator('#briefing');
  await expect(briefing.getByRole('heading', { name: 'Practice mission 1', exact: true })).toBeVisible();
  await briefing.getByRole('button', { name: 'Start practice', exact: true }).click();
  await storyPhase(page, 'explore');
  expect(await readProfile(page)).toEqual(before);
  const mission = missions[0]!;
  let remaining = mission.definition.targetLight;
  for (const tunnel of mission.tunnels) {
    const count = Math.min(remaining, tunnel.lights.length);
    const elapsed = await collectLights(page, tunnel, count);
    await page.clock.fastForward(travelMs(tunnel) - elapsed + exitMs);
    remaining -= count;
    if (!remaining) break;
    await storyPhase(page, 'explore');
  }
  await expect(page.locator('#game-score')).toHaveText('22 / 36 lights');
  await expect(page.locator('#mission-result')).toHaveText('Practice complete');
  await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Return to forest', exact: true }).click();
  await expect(progress).toBeVisible();
  await expect(progress).toHaveText('Forest restored: 3 / 3 · 4 crystals');
  const after = await readProfile(page);
  expect(Object.values(after.practiceRecords)).toEqual([22]);
  expect(after).toEqual({ ...before, practiceRecords: after.practiceRecords });
  await page.reload();
  await expect(page.getByRole('button', { name: 'View forest', exact: true })).toBeEnabled();
  expect(await readProfile(page)).toEqual(after);
});
