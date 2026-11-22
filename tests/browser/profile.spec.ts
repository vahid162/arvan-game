import { expect, test, type Page } from '@playwright/test';
import { defaultCampaignSeed, generateMission } from '../../src/game/content/generation';
import {
  collectLights, exitMs, freezeStoryClock, startBriefedMission, storyPhase, travelMs, winStoryMission,
} from './story-controls';

const profileKey = 'light-hunt.profile.v1';
const campaign = ([0, 1, 2] as const).map(index => generateMission(index, defaultCampaignSeed(index)));

async function rawSave(page: Page) {
  return page.evaluate(key => localStorage.getItem(key), profileKey);
}

async function expectProgress(page: Page, completed: string[], pending: string | null, crystals = 0) {
  const raw = await rawSave(page);
  expect(raw).not.toBeNull();
  expect(JSON.parse(raw!)).toMatchObject({
    completedMissionIds: completed,
    pendingPresentationMissionId: pending,
    crystals,
    claimedWorldIds: crystals ? ['forest'] : [],
  });
}

async function beginFirst(page: Page) {
  await freezeStoryClock(page);
  await page.goto('/?lang=en');
  await page.getByRole('button', { name: 'Play story', exact: true }).click();
  await startBriefedMission(page, campaign[0]!);
}

// Stop on the input frame that reaches the target. A save written from the
// later result animation would still be missing at this point.
async function firstSuccessBeforeExit(page: Page) {
  const mission = campaign[0]!;
  const first = mission.tunnels[0]!;
  const second = mission.tunnels[1]!;
  const elapsed = await collectLights(page, first, first.lights.length);
  await page.clock.fastForward(travelMs(first) - elapsed + exitMs);
  await storyPhase(page, 'explore');
  await collectLights(page, second, mission.definition.targetLight - first.lights.length);
  await storyPhase(page, 'exit');
  await expect(page.locator('#game-score')).toHaveText('22 / 36 lights');
  await expect(page.locator('#mission-result')).toBeHidden();
}

async function openSavedForest(page: Page) {
  await page.reload();
  await expect(page.locator('#briefing')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Elixir delivered', exact: true })).toBeVisible();
}

test('threshold success survives reload, restored clearings survive failure, and the guardian pays once', async ({ page }) => {
  test.setTimeout(210_000);
  const ids = campaign.map(mission => mission.definition.id);
  await beginFirst(page);
  await firstSuccessBeforeExit(page);
  await expectProgress(page, ids.slice(0, 1), ids[0]!);
  await openSavedForest(page);
  await expect(page.locator('#briefing')).toContainText(/elixir/i);
  await expect(page.locator('#forest-progress')).toHaveText('Forest restored: 1 / 3 · 0 crystals');
  await openSavedForest(page);
  await expectProgress(page, ids.slice(0, 1), ids[0]!);
  await page.getByRole('button', { name: 'Next mission', exact: true }).click();
  await startBriefedMission(page, campaign[1]!);
  await page.clock.fastForward(90_000);
  await expect(page.locator('#mission-result')).toHaveText('Mission failed');
  await expectProgress(page, ids.slice(0, 1), null);

  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await winStoryMission(page, campaign[1]!);
  await expectProgress(page, ids.slice(0, 2), ids[1]!);
  await page.getByRole('button', { name: 'Next mission', exact: true }).click();
  await startBriefedMission(page, campaign[2]!);
  await winStoryMission(page, campaign[2]!);
  await expectProgress(page, ids, ids[2]!, 12);
  await openSavedForest(page);
  await expect(page.locator('#briefing')).toContainText(/guardian/i);
  await expect(page.locator('#forest-progress')).toContainText(/12 crystals/i);
  await openSavedForest(page);
  await expectProgress(page, ids, ids[2]!, 12);
  await page.getByRole('button', { name: 'Back to clearing', exact: true }).click();
  await expectProgress(page, ids, null, 12);
  await page.reload();
  await page.getByRole('button', { name: 'View forest', exact: true }).click();
  await expect(page.locator('#forest-progress')).toHaveText('Forest restored: 3 / 3 · 12 crystals');
  await expectProgress(page, ids, null, 12);
});

test('a second tab cannot edit the profile and closing its owner releases the writer lock', async ({ page, context }) => {
  await beginFirst(page);
  const original = await rawSave(page);
  expect(original).not.toBeNull();
  const second = await context.newPage();
  await second.goto('/?lang=en');
  await expect(second.locator('#profile-notice')).toContainText(/another tab|other tab/i);
  await expect(second.getByRole('button', { name: /story/i })).toBeDisabled();
  expect(await rawSave(second)).toBe(original);
  await page.close();
  await second.reload();
  await second.getByRole('button', { name: /story/i }).click();
  await expect(second.getByRole('button', { name: 'Start mission', exact: true })).toBeVisible();
});

for (const [description, raw] of [
  ['malformed', '{"truncated":'],
  ['future-version', '{"version":817,"unknown":"keep every byte"}'],
] as const) {
  test(`a ${description} save remains intact while the player sees a warning`, async ({ page }) => {
    await page.addInitScript(({ key, value }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    }, { key: profileKey, value: raw });
    await page.goto('/?lang=en');
    const notice = page.locator('#profile-notice');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText(/save|profile|storage/i);
    expect(await rawSave(page)).toBe(raw);
    await page.getByRole('button', { name: 'Play without saving', exact: true }).click();
    await page.getByRole('button', { name: 'Play story', exact: true }).click();
    await page.getByRole('button', { name: 'Start mission', exact: true }).click();
    await storyPhase(page, 'explore');
    await expect(notice).toContainText(/only be available in this tab/i);
    expect(await rawSave(page)).toBe(raw);
  });
}

test('a failed completion write keeps the prior save and gives the player a visible warning', async ({ page }) => {
  test.setTimeout(75_000);
  await beginFirst(page);
  const previous = await rawSave(page);
  expect(previous).not.toBeNull();
  await page.evaluate(key => {
    const write = Storage.prototype.setItem;
    Storage.prototype.setItem = function (item, value) {
      if (item === key) throw new DOMException('Disk full', 'QuotaExceededError');
      write.call(this, item, value);
    };
  }, profileKey);
  await firstSuccessBeforeExit(page);
  await expect(page.locator('#profile-notice')).toBeVisible();
  await expect(page.locator('#profile-notice')).toContainText(/sav|storag/i);
  expect(await rawSave(page)).toBe(previous);
});
