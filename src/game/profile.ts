import { FOREST, FOREST_MISSIONS, UPGRADES } from './content/fixtures';
import { defaultCampaignSeed, generateMission, reproduceMission } from './content/generation';
import type { AttemptMode, GeneratedMission, Loadout, MissionIdentity, Profile, UpgradeId } from './core/types';

export const PROFILE_KEY = 'light-hunt.profile.v1';
const writerLock = 'light-hunt.profile.writer';
type MissionIndex = 0 | 1 | 2;
export type ProfileStatus = 'durable' | 'memory' | 'busy' | 'corrupt' | 'future' | 'unavailable';
export type PurchaseResult = 'purchased' | 'owned' | 'insufficient' | 'unavailable';

export interface ProfileStore {
  readonly profile: Profile;
  readonly status: ProfileStatus;
  useMemory(): void;
  updateSettings(changes: Partial<Profile['settings']>): boolean;
  assignMission(index: MissionIndex): GeneratedMission | null;
  completeMission(mission: GeneratedMission, mode?: AttemptMode): boolean;
  finishPresentation(missionId: string): void;
  purchaseUpgrade(id: UpgradeId): PurchaseResult;
  practiceMission(index: MissionIndex): GeneratedMission | null;
  recordPractice(mission: GeneratedMission, loadout: Loadout, score: number): number | null;
  practiceBest(mission: GeneratedMission, loadout: Loadout): number | null;
  close(): void;
}

function freshProfile(): Profile {
  return {
    version: 1, completedMissionIds: [], claimedWorldIds: [], crystals: 0, upgrades: {},
    assignedMissions: {}, pendingPresentationMissionId: null, practiceRecords: {},
    settings: { sound: true, reducedMotion: false, sensitivity: 1 },
  };
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function missionIdentity(value: unknown): value is MissionIdentity {
  return record(value) && typeof value.seed === 'string' && value.seed.length > 0 &&
    typeof value.generatorVersion === 'string' && typeof value.contentVersion === 'string' && typeof value.manifestHash === 'string';
}

function identityOf({ seed, generatorVersion, contentVersion, manifestHash }: GeneratedMission): MissionIdentity {
  return { seed, generatorVersion, contentVersion, manifestHash };
}

function sameIdentity(receipt: MissionIdentity, mission: GeneratedMission): boolean {
  return receipt.seed === mission.seed && receipt.generatorVersion === mission.generatorVersion &&
    receipt.contentVersion === mission.contentVersion && receipt.manifestHash === mission.manifestHash;
}

function practiceKey(id: string, receipt: MissionIdentity, loadout: Loadout): string {
  return JSON.stringify([id, receipt.seed, receipt.generatorVersion, receipt.contentVersion, receipt.manifestHash,
    'forest-practice-rules-1', ...UPGRADES.map(upgrade => loadout[upgrade.id] ?? 0)]);
}

function validProfile(value: Record<string, unknown>): boolean {
  const { completedMissionIds: completed, claimedWorldIds: claimed, crystals, upgrades, assignedMissions: assigned,
    pendingPresentationMissionId: pending, practiceRecords: practice, settings } = value;
  if (value.version !== 1 || !Array.isArray(completed) || !Array.isArray(claimed) ||
      !record(assigned) || !record(upgrades) || !record(practice) || !record(settings)) return false;
  if (completed.length > FOREST.missionIds.length || completed.some((id, i) => id !== FOREST.missionIds[i])) return false;
  const restored = completed.length === FOREST.missionIds.length;
  if (claimed.length !== Number(restored) || (restored && claimed[0] !== FOREST.id)) return false;
  if (pending !== null && (typeof pending !== 'string' || pending !== completed.at(-1))) return false;
  if (typeof settings.sound !== 'boolean' || typeof settings.reducedMotion !== 'boolean' ||
      typeof settings.sensitivity !== 'number' || !Number.isFinite(settings.sensitivity) || settings.sensitivity <= 0) return false;
  let balance = restored ? FOREST.rewardCrystals : 0;
  const loadouts: Loadout[] = [{}];
  for (const [id, level] of Object.entries(upgrades)) {
    const upgrade = UPGRADES.find(item => item.id === id);
    if (!upgrade || level !== 1) return false;
    balance -= upgrade.cost;
    loadouts.push({ [upgrade.id]: 1 });
  }
  if (balance < 0 || crystals !== balance) return false;
  if (completed.some(id => !Object.hasOwn(assigned, id))) return false;
  const eligibleRecords = new Map<string, number>();
  for (const [id, receipt] of Object.entries(assigned)) {
    const index = FOREST.missionIds.indexOf(id);
    if (index < 0 || index > completed.length || !missionIdentity(receipt)) return false;
    const mission = reproduceMission(index as MissionIndex, receipt);
    if (!mission) return false;
    if (restored && pending === null) {
      for (const loadout of loadouts) eligibleRecords.set(practiceKey(id, mission, loadout), mission.definition.targetLight);
    }
  }
  return Object.entries(practice).every(([key, score]) => typeof score === 'number' &&
    Number.isSafeInteger(score) && score >= 0 && score <= (eligibleRecords.get(key) ?? -1));
}

function decode(raw: string | null): { profile: Profile; status: ProfileStatus } {
  if (raw === null) return { profile: freshProfile(), status: 'durable' };
  try {
    const value: unknown = JSON.parse(raw);
    if (record(value)) {
      if (typeof value.version === 'number' && Number.isInteger(value.version) && value.version > 1) {
        return { profile: freshProfile(), status: 'future' };
      }
      if (validProfile(value)) return { profile: value as unknown as Profile, status: 'durable' };
    }
  } catch {
    // Keep the original record available for recovery.
  }
  return { profile: freshProfile(), status: 'corrupt' };
}

function completedProfile(profile: Profile, mission: GeneratedMission, mode: AttemptMode): Profile {
  const id = mission.definition.id;
  const assigned = profile.assignedMissions[id];
  if (mode !== 'story' || profile.pendingPresentationMissionId !== null ||
      FOREST.missionIds[profile.completedMissionIds.length] !== id || !assigned || !sameIdentity(assigned, mission)) return profile;
  const completedMissionIds = [...profile.completedMissionIds, id];
  const restored = completedMissionIds.length === FOREST.missionIds.length;
  return {
    ...profile, completedMissionIds, pendingPresentationMissionId: id,
    claimedWorldIds: restored ? [FOREST.id] : profile.claimedWorldIds,
    crystals: restored ? profile.crystals + FOREST.rewardCrystals : profile.crystals,
  };
}

export async function openProfile(): Promise<ProfileStore> {
  let profile = freshProfile();
  let status: ProfileStatus = 'unavailable';
  let storage: Storage | undefined;
  let host: Window | undefined;
  let closed = false;
  let release: (() => void) | undefined;
  const writable = () => !closed && (status === 'durable' || status === 'memory');
  const practiceOpen = () => writable() && profile.claimedWorldIds.includes(FOREST.id) && profile.pendingPresentationMissionId === null;

  function compatibleRecord(mission: GeneratedMission, loadout: Loadout) {
    const id = mission?.definition?.id;
    const index = FOREST.missionIds.indexOf(id);
    if (!practiceOpen() || index < 0 || !record(loadout)) return null;
    const assigned = profile.assignedMissions[id];
    if (!assigned || !sameIdentity(assigned, mission)) return null;
    if (Object.entries(loadout).some(([id, level]) =>
      level !== 1 || !UPGRADES.some(upgrade => upgrade.id === id && profile.upgrades[upgrade.id] === 1))) return null;
    return { key: practiceKey(id, assigned, loadout), max: FOREST_MISSIONS[index]!.definition.targetLight };
  }

  function commit(next: Profile) {
    if (status === 'durable') {
      try {
        storage!.setItem(PROFILE_KEY, JSON.stringify(next));
      } catch {
        status = 'memory';
      }
    }
    profile = next;
  }

  const store: ProfileStore = {
    get profile() { return profile; },
    get status() { return status; },
    useMemory() {
      if (!closed && (status === 'unavailable' || status === 'corrupt' || status === 'future')) status = 'memory';
    },
    updateSettings(changes) {
      if (!writable() || !record(changes)) return false;
      const previous = profile.settings;
      for (const [key, value] of Object.entries(changes)) {
        if (key === 'sound' || key === 'reducedMotion') {
          if (typeof value !== 'boolean') return false;
        } else if (key === 'sensitivity') {
          // Older v1 profiles accepted any positive finite sensitivity.
          if (value !== previous.sensitivity && value !== 0.75 && value !== 1 && value !== 1.25) return false;
        } else return false;
      }
      const settings = { ...previous, ...changes };
      if (settings.sound !== previous.sound || settings.reducedMotion !== previous.reducedMotion || settings.sensitivity !== previous.sensitivity) {
        commit({ ...profile, settings });
      }
      return true;
    },
    assignMission(index) {
      const id = FOREST.missionIds[index];
      if (!id || !writable() || profile.pendingPresentationMissionId !== null || index !== profile.completedMissionIds.length) return null;
      const assigned = profile.assignedMissions[id];
      if (assigned) return reproduceMission(index, assigned);
      const mission = generateMission(index, defaultCampaignSeed(index));
      commit({ ...profile, assignedMissions: { ...profile.assignedMissions, [id]: identityOf(mission) } });
      return mission;
    },
    completeMission(mission, mode = 'story') {
      if (!writable()) return false;
      const next = completedProfile(profile, mission, mode);
      if (next === profile) return false;
      commit(next);
      return true;
    },
    finishPresentation(id) {
      if (writable() && profile.pendingPresentationMissionId === id) commit({ ...profile, pendingPresentationMissionId: null });
    },
    purchaseUpgrade(id) {
      const upgrade = UPGRADES.find(item => item.id === id);
      if (!writable() || !upgrade || profile.pendingPresentationMissionId !== null) return 'unavailable';
      if (profile.upgrades[id] === 1) return 'owned';
      if (profile.crystals < upgrade.cost) return 'insufficient';
      commit({ ...profile, crystals: profile.crystals - upgrade.cost, upgrades: { ...profile.upgrades, [id]: 1 } });
      return 'purchased';
    },
    practiceMission(index) {
      if (!practiceOpen() || !Number.isInteger(index)) return null;
      const id = FOREST.missionIds[index];
      const assigned = id && profile.assignedMissions[id];
      return assigned ? reproduceMission(index, assigned) : null;
    },
    recordPractice(mission, loadout, score) {
      const entry = compatibleRecord(mission, loadout);
      if (!entry || !Number.isSafeInteger(score) || score < 0 || score > entry.max) return null;
      const best = profile.practiceRecords[entry.key];
      if (best !== undefined && best >= score) return best;
      commit({ ...profile, practiceRecords: { ...profile.practiceRecords, [entry.key]: score } });
      return score;
    },
    practiceBest(mission, loadout) {
      const entry = compatibleRecord(mission, loadout);
      return entry ? profile.practiceRecords[entry.key] ?? null : null;
    },
    close() {
      closed = true;
      host?.removeEventListener('pagehide', store.close);
      release?.();
    },
  };

  try {
    host = globalThis.window;
    if (!host) return store;
    host.addEventListener('pagehide', store.close, { once: true });
    const locks = host.navigator.locks;
    if (!locks) return store;
    // Resolve startup after loading, but keep the LockManager callback pending for the session.
    await new Promise<void>((ready, reject) => {
      void locks.request(writerLock, { ifAvailable: true }, async lock => {
        if (closed) { ready(); return; }
        try {
          storage = host!.localStorage;
          const loaded = decode(storage.getItem(PROFILE_KEY));
          profile = loaded.profile;
          status = loaded.status;
        } catch {
          status = 'unavailable';
        }
        if (!lock) { status = 'busy'; ready(); return; }
        const held = new Promise<void>(resolve => { release = resolve; });
        ready();
        await held;
      }).catch(reject);
    });
  } catch {
    status = 'unavailable';
  }
  return store;
}
