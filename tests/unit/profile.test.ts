import { afterEach, expect, it, vi } from 'vitest';
import { generateMission } from '../../src/game/content/generation';
import type { Loadout, UpgradeId } from '../../src/game/core/types';
import { openProfile, PROFILE_KEY, type ProfileStore } from '../../src/game/profile';

afterEach(() => vi.unstubAllGlobals());

function browser(raw: string | null = null) {
  const storage = {
    getItem: vi.fn(() => raw),
    setItem: vi.fn((key: string, next: string) => { expect(key).toBe(PROFILE_KEY); raw = next; }),
  };
  let locked = false;
  let writerDone = Promise.resolve();
  const locks = {
    request: vi.fn((name: string, options: { ifAvailable: boolean }, callback: (lock: object | null) => Promise<void>) => {
      expect(name).toBe('light-hunt.profile.writer');
      expect(options.ifAvailable).toBe(true);
      if (locked) return callback(null);
      locked = true;
      writerDone = callback({ name }).finally(() => { locked = false; });
      return writerDone;
    }),
  };
  const window = Object.assign(new EventTarget(), { localStorage: storage, navigator: { locks } });
  vi.stubGlobal('window', window);
  return {
    window, storage, locks, raw: () => raw,
    async reopen(store: ProfileStore) {
      store.close();
      await writerDone;
      return openProfile();
    },
  };
}

it('assigns the next story seed once and reconstructs the exact manifest after an unfinished attempt reloads', async () => {
  const host = browser();
  const store = await openProfile();
  expect(store.status).toBe('durable');
  expect(store.assignMission(1)).toBeNull();
  const first = store.assignMission(0)!;
  expect(store.assignMission(0)).toEqual(first);
  const receipt = store.profile.assignedMissions[first.definition.id];
  expect(receipt).toEqual({ seed: first.seed, generatorVersion: first.generatorVersion,
    contentVersion: first.contentVersion, manifestHash: first.manifestHash });
  expect(host.storage.setItem).toHaveBeenCalledTimes(1);
  const reloaded = await host.reopen(store);
  expect(reloaded.assignMission(0)).toEqual(first);
  expect(reloaded.completeMission(first, 'practice')).toBe(false);
  expect(reloaded.completeMission(generateMission(0, 'different-seed'))).toBe(false);
  expect(reloaded.profile.completedMissionIds).toEqual([]);
  expect(host.storage.setItem).toHaveBeenCalledTimes(1);
  reloaded.close();
});

it('recovers each committed success and grants the final claim and twelve crystals in one write', async () => {
  const host = browser();
  let store = await openProfile();
  for (const index of [0, 1, 2] as const) {
    const mission = store.assignMission(index)!;
    const id = mission.definition.id;
    const writes = host.storage.setItem.mock.calls.length;
    expect(store.completeMission(mission)).toBe(true);
    expect(host.storage.setItem).toHaveBeenCalledTimes(writes + 1);
    const receipt = JSON.parse(host.raw()!);
    expect(receipt.pendingPresentationMissionId).toBe(id);
    expect(receipt.claimedWorldIds).toEqual(index === 2 ? ['forest'] : []);
    expect(receipt.crystals).toBe(index === 2 ? 12 : 0);
    // Reload before starting delivery, and again while showing it.
    store = await host.reopen(store);
    store = await host.reopen(store);
    expect(store.profile.pendingPresentationMissionId).toBe(id);
    expect(store.completeMission(mission)).toBe(false);
    expect(store.assignMission(index)).toBeNull();
    store.finishPresentation('wrong-mission-id');
    expect(store.profile.pendingPresentationMissionId).toBe(id);
    expect(host.storage.setItem).toHaveBeenCalledTimes(writes + 1);
    store.finishPresentation(id);
    store.finishPresentation(id);
    expect(host.storage.setItem).toHaveBeenCalledTimes(writes + 2);
  }
  store = await host.reopen(store);
  expect(store.profile.completedMissionIds).toEqual(['forest-1', 'forest-2', 'forest-3']);
  expect(store.profile.pendingPresentationMissionId).toBeNull();
  expect(store.profile.crystals).toBe(12);
  store.close();
});

it('keeps the first tab writable, forbids a busy tab from opting into memory, and releases the writer on pagehide', async () => {
  const host = browser();
  const first = await openProfile();
  const mission = first.assignMission(0)!;
  const second = await openProfile();
  expect(second.profile.assignedMissions).toEqual(first.profile.assignedMissions);
  second.useMemory();
  expect(second.status).toBe('busy');
  expect(second.assignMission(0)).toBeNull();
  expect(second.completeMission(mission)).toBe(false);
  expect(host.storage.setItem).toHaveBeenCalledTimes(1);
  host.window.dispatchEvent(new Event('pagehide'));
  expect(first.completeMission(mission)).toBe(false);
  const next = await host.reopen(first);
  expect(next.assignMission(0)).toEqual(mission);
  next.close();
});

it.each([
  ['{bad-json', 'corrupt'],
  ['{"version":1}', 'corrupt'],
  ['{"version":42,"futureOwnerField":true}', 'future'],
])('preserves the original record %s through explicit memory-only play', async (raw, expected) => {
  const host = browser(raw);
  const store = await openProfile();
  expect(store.status).toBe(expected);
  expect(store.assignMission(0)).toBeNull();
  store.useMemory();
  expect(store.status).toBe('memory');
  expect(store.completeMission(store.assignMission(0)!)).toBe(true);
  expect(host.raw()).toBe(raw);
  expect(host.storage.setItem).not.toHaveBeenCalled();
  store.close();
});

it('rejects an impossible award, missing or changed assignments and out-of-order completion', async () => {
  const original = browser();
  const writer = await openProfile();
  const mission = writer.assignMission(0)!;
  expect(writer.completeMission(mission)).toBe(true);
  const valid = JSON.parse(original.raw()!);
  writer.close();
  for (const patch of [
    { crystals: -1 }, { crystals: 12 }, { claimedWorldIds: ['forest'] }, { assignedMissions: {} },
    { completedMissionIds: ['forest-2'] }, { pendingPresentationMissionId: 'forest-3' }, { upgrades: { 'unknown-upgrade': 1 } },
    { assignedMissions: { 'forest-1': { ...valid.assignedMissions['forest-1'], manifestHash: 'wrong' } } },
  ]) {
    const raw = JSON.stringify({ ...valid, ...patch });
    const host = browser(raw);
    const rejected = await openProfile();
    expect(rejected.status).toBe('corrupt');
    expect(host.raw()).toBe(raw);
    rejected.close();
  }
});

it('discloses unavailable storage or locks before allowing memory-only play', async () => {
  vi.stubGlobal('window', undefined);
  const absent = await openProfile();
  expect(absent.status).toBe('unavailable');
  expect(absent.assignMission(0)).toBeNull();
  absent.useMemory();
  expect(absent.assignMission(0)).not.toBeNull();
  absent.close();

  const denied = browser();
  denied.storage.getItem.mockImplementation(() => { throw new Error('blocked'); });
  const blocked = await openProfile();
  expect(blocked.status).toBe('unavailable');
  blocked.close();

  const lockDenied = browser();
  lockDenied.locks.request.mockRejectedValue(new Error('locks not allowed'));
  expect((await openProfile()).status).toBe('unavailable');
  expect(lockDenied.storage.setItem).not.toHaveBeenCalled();
});

it('retains a failed save in memory, with the previous durable record intact and no duplicate completion', async () => {
  const host = browser();
  const store = await openProfile();
  const mission = store.assignMission(0)!;
  const before = host.raw();
  host.storage.setItem.mockImplementation(() => { throw new Error('quota'); });
  expect(store.completeMission(mission)).toBe(true);
  expect(store.status).toBe('memory');
  expect(store.profile.pendingPresentationMissionId).toBe(mission.definition.id);
  expect(store.completeMission(mission)).toBe(false);
  store.finishPresentation(mission.definition.id);
  expect(store.profile.completedMissionIds).toEqual([mission.definition.id]);
  expect(host.raw()).toBe(before);
  expect(host.storage.setItem).toHaveBeenCalledTimes(2);
  const reloaded = await host.reopen(store);
  expect(reloaded.status).toBe('durable');
  expect(reloaded.profile.completedMissionIds).toEqual([]);
  expect(reloaded.assignMission(0)).toEqual(mission);
  reloaded.close();
});

function restoreWorld(store: ProfileStore, acknowledgeFinal = true) {
  for (const index of [0, 1, 2] as const) {
    const mission = store.assignMission(index)!;
    expect(store.completeMission(mission)).toBe(true);
    if (index < 2 || acknowledgeFinal) store.finishPresentation(mission.definition.id);
  }
}

it.each([
  ['exploration-radius', 'collection-radius', 4],
  ['collection-radius', 'exploration-radius', 2],
] as const)('purchases %s in one write and retains its level and balance across reload', async (id, other, balance) => {
  const host = browser();
  const store = await openProfile();
  expect(store.purchaseUpgrade(id)).toBe('insufficient');
  restoreWorld(store, false);
  expect(store.purchaseUpgrade(id)).toBe('unavailable');
  expect(store.practiceMission(0)).toBeNull();
  store.finishPresentation('forest-3');
  const before = host.storage.setItem.mock.calls.length;
  expect(store.purchaseUpgrade('unknown' as UpgradeId)).toBe('unavailable');
  expect(store.purchaseUpgrade(id)).toBe('purchased');
  expect(JSON.parse(host.raw()!)).toMatchObject({ crystals: balance, upgrades: { [id]: 1 } });
  expect(store.purchaseUpgrade(id)).toBe('owned');
  expect(store.purchaseUpgrade(other)).toBe('insufficient');
  const reloaded = await host.reopen(store);
  expect(reloaded.status).toBe('durable');
  expect(reloaded.purchaseUpgrade(id)).toBe('owned');
  expect(reloaded.purchaseUpgrade(other)).toBe('insufficient');
  expect(reloaded.profile.crystals).toBe(balance);
  expect(host.storage.setItem).toHaveBeenCalledTimes(before + 1);
  reloaded.close();
});

it('records the highest eligible score for each assigned mission and loadout without changing story progress', async () => {
  const host = browser();
  const store = await openProfile();
  expect(store.practiceMission(0)).toBeNull();
  restoreWorld(store);
  const first = store.practiceMission(0)!;
  const second = store.practiceMission(1)!;
  const equipped: Loadout = { 'exploration-radius': 1 };
  expect(store.practiceBest(first, {})).toBeNull();
  expect(store.recordPractice(first, equipped, 15)).toBeNull();
  expect(store.recordPractice(first, {}, 0)).toBe(0);
  expect(store.recordPractice(first, {}, 21)).toBe(21);
  expect(store.purchaseUpgrade('exploration-radius')).toBe('purchased');
  const { practiceRecords: beforeRecords, ...story } = store.profile;
  expect(Object.values(beforeRecords)).toEqual([21]);
  expect(store.recordPractice(first, equipped, 22)).toBe(22);
  expect(store.recordPractice(second, {}, 25)).toBe(25);
  const writes = host.storage.setItem.mock.calls.length;
  expect(store.recordPractice(first, {}, 10)).toBe(21);
  expect(store.recordPractice(first, equipped, 22)).toBe(22);
  for (const score of [-1, 12.5, 23, NaN, Infinity]) expect(store.recordPractice(first, {}, score)).toBeNull();
  expect(store.recordPractice(generateMission(0, 'different-seed'), {}, 12)).toBeNull();
  expect(store.recordPractice({ ...first, generatorVersion: 'foreign-rules' }, {}, 12)).toBeNull();
  expect(store.recordPractice(first, { fake: 1 } as Loadout, 12)).toBeNull();
  expect(store.completeMission(first, 'practice')).toBe(false);
  expect(host.storage.setItem).toHaveBeenCalledTimes(writes);
  const reloaded = await host.reopen(store);
  expect(reloaded.practiceMission(0)).toEqual(first);
  expect(reloaded.practiceBest(first, {})).toBe(21);
  expect(reloaded.practiceBest(first, equipped)).toBe(22);
  expect(reloaded.practiceBest(second, {})).toBe(25);
  expect(reloaded.practiceBest(second, equipped)).toBeNull();
  const { practiceRecords, ...after } = reloaded.profile;
  expect(Object.values(practiceRecords).sort()).toEqual([21, 22, 25]);
  expect(after).toEqual(story);
  const busy = await openProfile();
  expect(busy.purchaseUpgrade('exploration-radius')).toBe('unavailable');
  expect(busy.practiceMission(0)).toBeNull();
  expect(busy.recordPractice(first, {}, 22)).toBeNull();
  reloaded.close();
  busy.close();
});

it('retains both the owned level and its deduction only in memory if persisting the purchase fails', async () => {
  const host = browser();
  const store = await openProfile();
  restoreWorld(store);
  const before = host.raw();
  host.storage.setItem.mockImplementation(() => { throw new Error('quota'); });
  expect(store.purchaseUpgrade('collection-radius')).toBe('purchased');
  expect(store.status).toBe('memory');
  expect(store.profile.crystals).toBe(2);
  expect(store.profile.upgrades).toEqual({ 'collection-radius': 1 });
  expect(store.purchaseUpgrade('collection-radius')).toBe('owned');
  expect(host.raw()).toBe(before);
  const reloaded = await host.reopen(store);
  expect(reloaded.profile.crystals).toBe(12);
  expect(reloaded.profile.upgrades).toEqual({});
  reloaded.close();
});
