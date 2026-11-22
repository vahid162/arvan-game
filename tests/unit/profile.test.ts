import { afterEach, expect, it, vi } from 'vitest';
import { CURRENT_CONTENT_VERSION, generateMission } from '../../src/game/content/generation';
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

// These receipts, record keys and lanes were captured from the P10 build at 4fa8d16.
function p10Receipt(id: string, digest: string) {
  return { seed: id + '/campaign', generatorVersion: 'seeded-forest-1', contentVersion: 'forest-routes-1', manifestHash: 'fnv1a64:' + digest };
}
const p10Profile = {
  version: 1, completedMissionIds: ['forest-1', 'forest-2', 'forest-3'], claimedWorldIds: ['forest'],
  crystals: 2, upgrades: { 'collection-radius': 1 },
  assignedMissions: {
    'forest-1': p10Receipt('forest-1', 'f4398e92181cf321'), 'forest-2': p10Receipt('forest-2', 'f3a8d6e95d4701b4'),
    'forest-3': p10Receipt('forest-3', 'd16f930ceb6d4fda'),
  },
  pendingPresentationMissionId: null,
  practiceRecords: {
    '["forest-1","forest-1/campaign","seeded-forest-1","forest-routes-1","fnv1a64:f4398e92181cf321","forest-practice-rules-1",0,0]': 19,
    '["forest-1","forest-1/campaign","seeded-forest-1","forest-routes-1","fnv1a64:f4398e92181cf321","forest-practice-rules-1",0,1]': 22,
  },
  settings: { sound: true, reducedMotion: false, sensitivity: 1 },
};
const p10Lanes = [0, -0.52, -1.02, -0.72, -0.24, 0.54, 1.08, 0.62, -0.16, -0.82, -0.44, 0.25];

it('opens the completed P10 save byte-for-byte with its original practice lanes and equipped and base records', async () => {
  const raw = JSON.stringify(p10Profile);
  const host = browser(raw);
  const store = await openProfile();
  expect(store.status).toBe('durable');
  expect(store.profile).toEqual(p10Profile);
  const first = store.practiceMission(0)!;
  expect(first).toMatchObject(p10Profile.assignedMissions['forest-1']);
  expect(first.tunnels[0]!.lights.map(light => light.lateral)).toEqual(p10Lanes);
  expect(store.practiceBest(first, {})).toBe(19);
  expect(store.practiceBest(first, { 'collection-radius': 1 })).toBe(22);
  expect(store.practiceBest(generateMission(0, first.seed), {})).toBeNull();
  expect(store.purchaseUpgrade('collection-radius')).toBe('owned');
  expect(host.storage.setItem).not.toHaveBeenCalled();
  expect(host.raw()).toBe(raw);
  store.close();
});

it('resumes an unfinished P10 layout exactly and assigns current content only when the next mission opens', async () => {
  const firstReceipt = p10Profile.assignedMissions['forest-1'];
  const raw = JSON.stringify({ ...p10Profile, completedMissionIds: [], claimedWorldIds: [], crystals: 0, upgrades: {},
    assignedMissions: { 'forest-1': firstReceipt }, practiceRecords: {} });
  const host = browser(raw);
  const store = await openProfile();
  const first = store.assignMission(0)!;
  expect(first).toMatchObject(firstReceipt);
  expect(first.tunnels[0]!.lights.map(light => light.lateral)).toEqual(p10Lanes);
  expect(store.completeMission(generateMission(0, first.seed))).toBe(false);
  expect(host.raw()).toBe(raw);
  expect(store.completeMission(first)).toBe(true);
  store.finishPresentation(first.definition.id);
  const second = store.assignMission(1)!;
  expect(second.contentVersion).toBe(CURRENT_CONTENT_VERSION);
  expect(store.profile.assignedMissions['forest-1']).toEqual(firstReceipt);
  const reloaded = await host.reopen(store);
  expect(reloaded.status).toBe('durable');
  expect(reloaded.assignMission(1)).toEqual(second);
  expect(reloaded.profile.assignedMissions['forest-1']).toEqual(firstReceipt);
  reloaded.close();
});

it('saves settings independently of story and practice data, and retains an older sensitivity until it is changed', async () => {
  const raw = JSON.stringify({ ...p10Profile, settings: { ...p10Profile.settings, sensitivity: 1.15 } });
  const host = browser(raw);
  const store = await openProfile();
  expect(store.status).toBe('durable');
  expect(store.updateSettings({ sound: false, reducedMotion: true })).toBe(true);
  expect(store.updateSettings({ ...store.profile.settings })).toBe(true);
  expect(host.storage.setItem).toHaveBeenCalledTimes(1);
  const reloaded = await host.reopen(store);
  expect(reloaded.profile).toEqual({ ...p10Profile, settings: { sound: false, reducedMotion: true, sensitivity: 1.15 } });
  for (const sensitivity of [0.75, 1, 1.25]) expect(reloaded.updateSettings({ sensitivity })).toBe(true);
  expect(JSON.parse(host.raw()!)).toEqual({ ...p10Profile, settings: { sound: false, reducedMotion: true, sensitivity: 1.25 } });
  reloaded.close();
});

it('rejects invalid or competing settings edits atomically and surfaces a write failure as memory-only', async () => {
  const raw = JSON.stringify(p10Profile);
  const host = browser(raw);
  const store = await openProfile();
  const busy = await openProfile();
  expect(busy.updateSettings({ sound: false })).toBe(false);
  expect(store.updateSettings({ sound: false, sensitivity: 1.1 })).toBe(false);
  expect(store.updateSettings({ sound: false, sensitivity: NaN })).toBe(false);
  expect(store.updateSettings({ sound: 0 } as unknown as { sound: boolean })).toBe(false);
  expect(store.updateSettings({ reducedMotion: true, unexpected: 'value' } as { reducedMotion: boolean })).toBe(false);
  expect(store.profile.settings).toEqual(p10Profile.settings);
  expect(host.storage.setItem).not.toHaveBeenCalled();
  host.storage.setItem.mockImplementation(() => { throw new Error('quota'); });
  expect(store.updateSettings({ sound: false })).toBe(true);
  expect(store.status).toBe('memory');
  expect(store.profile.settings).toEqual({ ...p10Profile.settings, sound: false });
  expect(host.raw()).toBe(raw);
  store.close();
  expect(store.updateSettings({ sound: true })).toBe(false);
  busy.close();
});

it('persists an explicit language choice without rewriting a legacy profile on load or changing its progress', async () => {
  const raw = JSON.stringify(p10Profile);
  const host = browser(raw);
  const store = await openProfile();
  expect(store.profile.settings.language).toBeUndefined();
  expect(host.raw()).toBe(raw);
  const busy = await openProfile();
  expect(busy.updateSettings({ language: 'en' })).toBe(false);
  expect(store.updateSettings({ language: 'other' as 'en' })).toBe(false);
  expect(host.storage.setItem).not.toHaveBeenCalled();
  expect(store.updateSettings({ language: 'en' })).toBe(true);
  expect(store.updateSettings({ language: 'en' })).toBe(true);
  expect(host.storage.setItem).toHaveBeenCalledTimes(1);
  const reloaded = await host.reopen(store);
  expect(reloaded.profile).toEqual({ ...p10Profile, settings: { ...p10Profile.settings, language: 'en' } });
  expect(reloaded.updateSettings({ language: 'fa' })).toBe(true);
  expect(JSON.parse(host.raw()!)).toEqual({ ...p10Profile, settings: { ...p10Profile.settings, language: 'fa' } });
  reloaded.close();
  busy.close();
});

it('keeps a formerly valid v1 save usable when an extra language field is unsupported', async () => {
  const raw = JSON.stringify({ ...p10Profile, settings: { ...p10Profile.settings, language: 'de' } });
  const host = browser(raw);
  const store = await openProfile();
  expect(store.status).toBe('durable');
  expect(store.profile).toEqual(p10Profile);
  expect(host.raw()).toBe(raw);
  store.close();
});
