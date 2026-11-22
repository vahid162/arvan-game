import type { GeneratedMission, TunnelInstance, UpgradeDefinition, WorldDefinition } from '../core/types';

const missionIds = ['forest-1', 'forest-2', 'forest-3'] as const;
const restorationIds = ['forest-path', 'forest-canopy', 'forest-torch'] as const;

export const FOREST: WorldDefinition = {
  id: 'forest', guardian: 'Forest guardian', missionIds, restorationIds, rewardCrystals: 12,
};

export const UPGRADES = [
  { id: 'exploration-radius', cost: 8, multiplier: 1.1 },
  { id: 'collection-radius', cost: 10, multiplier: 1.1 },
] as const satisfies readonly UpgradeDefinition[];

const lanes = [0, -0.72, -1.07, -0.55, 0.24, 0.86, 1.09, 0.42, -0.36, -1.01, -0.57, 0.38] as const;

function tunnel(mission: string, index: number): TunnelInstance {
  const id = mission + '/tunnel-' + (index + 1);
  return {
    id, templateId: 'shallow-bend',
    entry: { x: 1.45 - index * 1.5, z: -1.4 - index * 0.6 },
    exit: { x: -1.2 + index * 1.22, z: 1.1 - index * 0.7 },
    length: 24, width: 3.5, speed: 3.2,
    lights: lanes.map((lateral, lightIndex) => ({
      id: id + '/light-' + (lightIndex + 1), distance: 2.4 + lightIndex * 1.72,
      lateral: index === 1 ? -lateral : lateral, radius: 0.14, value: 1,
    })),
  };
}

function mission(index: 0 | 1 | 2, targetLight: number, manifestHash: string): GeneratedMission {
  const id = missionIds[index];
  return {
    definition: { id, worldId: FOREST.id, timeLimitMs: 90_000, targetLight, restorationId: restorationIds[index] },
    seed: id + '/baseline', generatorVersion: 'fixed-fixture-1', contentVersion: 'forest-1',
    manifestHash, tunnels: [tunnel(id, 0), tunnel(id, 1), tunnel(id, 2)],
  };
}

// Digests of the UTF-8 JSON records with manifestHash omitted.
export const FOREST_MISSIONS = [
  mission(0, 22, '6ec95fd86bd00618290132acfc46a0d1dac6b31d2412fdebb70367f63b808b3f'),
  mission(1, 25, 'ed620ea2986864c32908e407d7628ca0b524ccaff7644eb1042d8e55ce199e66'),
  mission(2, 28, '99fb13720f50e71541c7f57b08a06f503b20152a63f01dc8f85a75b3bf93b04b'),
] as const;
