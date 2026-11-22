import { FOREST, UPGRADES } from './content/fixtures';
import { defaultCampaignSeed, generateMission } from './content/generation';
import type { AttemptMode, GeneratedMission, MissionIdentity, Profile } from './core/types';

export const PROFILE_KEY = 'light-hunt.profile.v1';
const writerLock = 'light-hunt.profile.writer';
type MissionIndex = 0 | 1 | 2;
export type ProfileStatus = 'durable' | 'memory' | 'busy' | 'corrupt' | 'future' | 'unavailable';

export interface ProfileStore {
  readonly profile: Profile;
  readonly status: ProfileStatus;
  useMemory(): void;
  assignMission(index: MissionIndex): GeneratedMission | null;
  completeMission(mission: GeneratedMission, mode?: AttemptMode): boolean;
  finishPresentation(missionId: string): void;
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

function identityOf({ seed, generatorVersion, contentVersion, manifestHash }: GeneratedMission): MissionIdentity {
  return { seed, generatorVersion, contentVersion, manifestHash };
}

function sameIdentity(receipt: MissionIdentity, mission: GeneratedMission): boolean {
  return receipt.seed === mission.seed && receipt.generatorVersion === mission.generatorVersion &&
    receipt.contentVersion === mission.contentVersion && receipt.manifestHash === mission.manifestHash;
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
  if (Object.values(practice).some(score => typeof score !== 'number' || !Number.isSafeInteger(score) || score < 0)) return false;

  let balance = restored ? FOREST.rewardCrystals : 0;
  for (const [id, level] of Object.entries(upgrades)) {
    const upgrade = UPGRADES.find(item => item.id === id);
    if (!upgrade || level !== 1) return false;
    balance -= upgrade.cost;
  }
  if (balance < 0 || crystals !== balance) return false;
  if (completed.some(id => !Object.hasOwn(assigned, id))) return false;
  for (const [id, receipt] of Object.entries(assigned)) {
    const index = FOREST.missionIds.indexOf(id);
    if (index < 0 || index > completed.length || !record(receipt) || typeof receipt.seed !== 'string' || !receipt.seed) return false;
    const mission = generateMission(index as MissionIndex, receipt.seed);
    if (receipt.generatorVersion !== mission.generatorVersion || receipt.contentVersion !== mission.contentVersion ||
        receipt.manifestHash !== mission.manifestHash) return false;
  }
  return true;
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
    assignMission(index) {
      const id = FOREST.missionIds[index];
      if (!id || !writable() || profile.pendingPresentationMissionId !== null || index !== profile.completedMissionIds.length) return null;
      const assigned = profile.assignedMissions[id];
      const mission = generateMission(index, assigned?.seed ?? defaultCampaignSeed(index));
      if (!assigned) commit({ ...profile, assignedMissions: { ...profile.assignedMissions, [id]: identityOf(mission) } });
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
