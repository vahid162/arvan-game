import { expect, it } from 'vitest';
import {
  CURRENT_CONTENT_VERSION, defaultCampaignSeed, generateMission, LEGACY_CONTENT_VERSION, reproduceMission,
  TUNNEL_TEMPLATE_IDS, validateLayout,
} from '../../src/game/content/generation';
import { P07_MISSION } from '../../src/game/content/fixtures';
import { PLAYER_RADIUS } from '../../src/game/core/collection';
import type { TunnelInstance } from '../../src/game/core/types';

const indices = [0, 1, 2] as const;

it('reconstructs the original campaign manifests with their P10 hashes', () => {
  const hashes = ['fnv1a64:f4398e92181cf321', 'fnv1a64:f3a8d6e95d4701b4', 'fnv1a64:d16f930ceb6d4fda'];
  const targets = [22, 25, 28];
  for (const index of indices) {
    const seed = defaultCampaignSeed(index);
    const mission = generateMission(index, seed, undefined, LEGACY_CONTENT_VERSION);
    expect(mission.seed).toBe(seed);
    expect(mission.generatorVersion).toBe('seeded-forest-1');
    expect(mission.contentVersion).toBe('forest-routes-1');
    expect(mission.manifestHash).toBe(hashes[index]);
    expect(mission.definition).toMatchObject({ id: `forest-${index + 1}`, timeLimitMs: 90_000, targetLight: targets[index] });
    expect(reproduceMission(index, mission)).toEqual(mission);
    expect(JSON.parse(JSON.stringify(mission))).toEqual(mission);
  }
});

function lateralTravel(tunnel: TunnelInstance) {
  let previous = 0;
  let travel = 0;
  for (const light of tunnel.lights) {
    travel += Math.abs(light.lateral - previous);
    previous = light.lateral;
  }
  return travel;
}

function scoreWithLateAiming(tunnel: TunnelInstance) {
  let previousDistance = 0;
  let lateral = 0;
  let score = 0;
  const laneLimit = tunnel.width / 2 - 0.43;
  for (const [index, light] of tunnel.lights.entries()) {
    // Wait 250 ms before steering toward the next light and aim 0.10 units off-center.
    const aim = Math.max(-laneLimit, Math.min(laneLimit, light.lateral + (index % 2 ? -0.10 : 0.10)));
    const delta = aim - lateral;
    const available = Math.max(0, (light.distance - previousDistance) / tunnel.speed - 0.25) * 3;
    lateral += Math.sign(delta) * Math.min(Math.abs(delta), available);
    if (Math.abs(light.lateral - lateral) <= PLAYER_RADIUS + light.radius) score++;
    previousDistance = light.distance;
  }
  return score;
}

it.each(indices)('needs more lateral travel while keeping steering room in forest mission %i', index => {
  const seed = defaultCampaignSeed(index);
  const baseline = generateMission(index, seed, undefined, LEGACY_CONTENT_VERSION);
  const tuned = generateMission(index, seed);
  expect(tuned.contentVersion).toBe(CURRENT_CONTENT_VERSION);
  expect(tuned.manifestHash).not.toBe(baseline.manifestHash);
  expect(reproduceMission(index, tuned)).toEqual(tuned);
  expect(reproduceMission(index, { ...tuned, manifestHash: baseline.manifestHash })).toBeNull();
  expect(tuned.definition).toEqual(baseline.definition);

  let baselineScore = 0;
  let tunedScore = 0;
  let baselineCentered = 0;
  let tunedCentered = 0;
  const inCenterReach = (light: TunnelInstance['lights'][number]) => Math.abs(light.lateral) <= PLAYER_RADIUS + light.radius;
  tuned.tunnels.forEach((tunnel, slot) => {
    const original = baseline.tunnels[slot]!;
    expect(tunnel).toEqual({
      ...original, lights: original.lights.map(light => ({ ...light, lateral: light.lateral * 1.14 })),
    });
    expect(lateralTravel(tunnel) / lateralTravel(original)).toBeCloseTo(1.14);
    baselineScore += scoreWithLateAiming(original);
    tunedScore += scoreWithLateAiming(tunnel);
    baselineCentered += original.lights.filter(inCenterReach).length;
    tunedCentered += tunnel.lights.filter(inCenterReach).length;
  });
  expect(tunedCentered).toBeLessThanOrEqual(baselineCentered);
  expect(tunedScore).toBeGreaterThanOrEqual(tuned.definition.targetLight + 3);
  console.info(`${tuned.definition.id}: centered ${baselineCentered} → ${tunedCentered}, late aiming ${baselineScore} → ${tunedScore} (out of 36)`);
});

it('rejects invalid connections, geometry, IDs and unreachable light spacing', () => {
  const mission = generateMission(1, 'invalid-pattern-check');
  const [first, second, third] = [mission.tunnels[0]!, mission.tunnels[1]!, mission.tunnels[2]!];
  function issuesFor(changes: Partial<typeof first>) {
    return validateLayout({ ...mission, tunnels: [{ ...first, ...changes }, second, third] }).issues.join(' ');
  }
  expect(issuesFor({ exit: second.exit })).toContain('anchor pair');
  expect(issuesFor({ templateId: 'unknown' })).toContain('geometry');
  expect(issuesFor({ speed: 0 })).toContain('geometry');
  expect(issuesFor({ id: second.id })).toContain('duplicate tunnel ID');
  const firstLight = first.lights[0]!;
  expect(issuesFor({ lights: [{ ...firstLight, id: second.lights[0]!.id }, ...first.lights.slice(1)] })).toContain('duplicate light ID');
  expect(issuesFor({ lights: [{ ...firstLight, lateral: NaN }, ...first.lights.slice(1)] })).toContain('Invalid light placement');
  const unreachable = first.lights.map((light, i) => ({ ...light, distance: 0.1 + i * 0.1, lateral: i % 2 ? -1.30 : 1.30 }));
  expect(issuesFor({ lights: unreachable })).toContain('Baseline steering');
});

it('uses the known authored layout on exhaustion, preserving its seed and the cap in its identity', () => {
  const seed = 'forced-fallback';
  const fallback = generateMission(2, seed, 0);
  expect(fallback.seed).toBe(seed);
  expect(fallback.generatorVersion).toBe('seeded-forest-1/limit-0');
  expect(fallback.tunnels.map(tunnel => tunnel.templateId)).toEqual(TUNNEL_TEMPLATE_IDS);
  expect(fallback.tunnels.map(tunnel => [tunnel.entry, tunnel.exit]))
    .toEqual(P07_MISSION.tunnels.map(tunnel => [tunnel.entry, tunnel.exit]));
  expect(validateLayout(fallback).witness?.collected).toBe(36);
  expect(generateMission(2, seed, -1)).toEqual(fallback);
  expect(generateMission(2, seed, 1_000_000)).toEqual(generateMission(2, seed));
});

it.each(indices)('checks 1,000 deterministic seeds for forest mission %i', index => {
  const assignments = new Set<string>();
  const patterns = new Set<string>();
  const orders = new Set<string>();
  let longestMs = 0;
  for (let n = 0; n < 1000; n++) {
    const seed = `sweep/${n}`;
    const mission = generateMission(index, seed);
    const { issues, witness } = validateLayout(mission);
    if (issues.length || !witness || witness.collected !== 36 || witness.runs.some(run => run.controls.length !== 12)) {
      throw new Error(`${mission.definition.id} seed ${seed}: ${issues.join(', ')}; collected ${witness?.collected}`);
    }
    longestMs = Math.max(longestMs, witness.activeMs);
    orders.add(mission.tunnels.map(tunnel => tunnel.id).join(','));
    for (const tunnel of mission.tunnels) {
      assignments.add(tunnel.id + ':' + tunnel.templateId);
      patterns.add(tunnel.lights.map(light => light.lateral).join(','));
    }
  }
  expect(assignments.size).toBe(9);
  expect(orders.size).toBe(6);
  expect(patterns.size).toBe(6);
  expect(longestMs + 18_000).toBeLessThan(90_000);
  console.info(`forest-${index + 1}: 1000 seeds, 36/36 reachable, slowest full route ${Math.ceil(longestMs)} ms`);
}, 40_000);
