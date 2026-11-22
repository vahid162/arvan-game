export interface Anchor {
  readonly x: number;
  readonly z: number;
}

export interface WorldDefinition {
  readonly id: string;
  readonly guardian: string;
  readonly missionIds: readonly string[];
  readonly restorationIds: readonly string[];
  readonly rewardCrystals: number;
}

export interface MissionDefinition {
  readonly id: string;
  readonly worldId: string;
  readonly timeLimitMs: number;
  readonly targetLight: number;
  readonly restorationId: string;
}

export interface Collectible {
  readonly id: string;
  readonly distance: number;
  readonly lateral: number;
  readonly radius: number;
  readonly value: 1;
}

export interface TunnelInstance {
  readonly id: string;
  readonly templateId: string;
  readonly entry: Anchor;
  readonly exit: Anchor;
  readonly length: number;
  readonly width: number;
  readonly speed: number;
  readonly lights: readonly Collectible[];
}

export interface GeneratedMission {
  readonly definition: MissionDefinition;
  readonly seed: string;
  readonly generatorVersion: string;
  readonly contentVersion: string;
  readonly manifestHash: string;
  readonly tunnels: readonly TunnelInstance[];
}

export type AttemptMode = 'story' | 'practice' | 'tutorial';
export type UpgradeId = 'exploration-radius' | 'collection-radius';
export type Loadout = Readonly<Partial<Record<UpgradeId, 1>>>;

export interface UpgradeDefinition {
  readonly id: UpgradeId;
  readonly cost: number;
  readonly multiplier: number;
}

export type MissionIdentity = Pick<GeneratedMission, 'seed' | 'generatorVersion' | 'contentVersion' | 'manifestHash'>;

export interface Profile {
  readonly version: 1;
  readonly completedMissionIds: readonly string[];
  readonly claimedWorldIds: readonly string[];
  readonly crystals: number;
  readonly upgrades: Loadout;
  readonly settings: { readonly sound: boolean; readonly reducedMotion: boolean; readonly sensitivity: number };
  readonly assignedMissions: Readonly<Partial<Record<string, MissionIdentity>>>;
  readonly pendingPresentationMissionId: string | null;
  readonly practiceRecords: Readonly<Partial<Record<string, number>>>;
}
