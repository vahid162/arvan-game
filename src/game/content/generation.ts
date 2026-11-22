import { sweepLights } from '../core/collection';
import type { Anchor, GeneratedMission, MissionIdentity, TunnelInstance } from '../core/types';
import { FOREST_MISSIONS, P07_MISSION } from './fixtures';

export const TUNNEL_TEMPLATE_IDS = ['shallow-bend', 'wide-sweep', 'root-dip'] as const;
export type TunnelTemplateId = typeof TUNNEL_TEMPLATE_IDS[number];
export const LEGACY_CONTENT_VERSION = 'forest-routes-1';
export const CURRENT_CONTENT_VERSION = 'forest-routes-2';
export const TUNED_ENTRANCE_DISCOVERY_RADIUS = 1.58;
type ContentVersion = typeof LEGACY_CONTENT_VERSION | typeof CURRENT_CONTENT_VERSION;
type MissionIndex = 0 | 1 | 2;
type Layout = Omit<GeneratedMission, 'manifestHash'>;

const generatorVersion = 'seeded-forest-1';
const tunedLateralSpread = 1.14;
const maxAttempts = 4;
const anchors = P07_MISSION.tunnels;
const patterns = [
  anchors[0]!.lights.map(light => light.lateral),
  [0, 0.52, 1.02, 0.72, 0.24, -0.54, -1.08, -0.62, 0.16, 0.82, 0.44, -0.25],
  [0, -0.43, 0.27, 0.94, 0.53, -0.21, -0.88, -0.53, 0.22, 0.83, 0.35, -0.29],
] as const;
const indices = [0, 1, 2] as const;
const sameAnchor = (a: Anchor, b: Anchor) => a.x === b.x && a.z === b.z;

// FNV-1a is a reproducibility checksum. Hash the generated record in its defined field order.
function checksum(value: string) {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(value)) {
    hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * 0x100000001b3n);
  }
  return hash;
}

function randomFor(identity: string) {
  let state = Number(checksum(identity) & 0xffffffffn) || 1;
  return (count: number) => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return Math.floor((state >>> 0) / 0x100000000 * count);
  };
}

function shuffle(random: (count: number) => number) {
  const order = [...indices];
  for (let i = order.length - 1; i > 0; i--) {
    const j = random(i + 1);
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return order;
}

interface TunnelWitness {
  tunnelId: string;
  controls: { atMs: number; targetLateral: number }[];
  hitIds: string[];
}

// Aim at each next light, travel at the controller's full lateral speed, then hold the lane.
function driveTunnel(tunnel: TunnelInstance): TunnelWitness {
  const controls: TunnelWitness['controls'] = [];
  const hits = new Set<string>();
  let current = { distance: 0, lateral: 0 };
  function travel(distance: number, lateral: number) {
    const next = { distance, lateral };
    const ms = (distance - current.distance) / tunnel.speed * 1000;
    for (const hit of sweepLights(tunnel.lights, current, next, ms, hits)) hits.add(hit.id);
    current = next;
  }
  for (const light of tunnel.lights) {
    controls.push({ atMs: current.distance / tunnel.speed * 1000, targetLateral: light.lateral });
    const duration = (light.distance - current.distance) / tunnel.speed;
    const delta = light.lateral - current.lateral;
    const steeringSeconds = Math.min(duration, Math.abs(delta) / 3);
    travel(Math.min(light.distance, current.distance + steeringSeconds * tunnel.speed),
      current.lateral + Math.sign(delta) * steeringSeconds * 3);
    travel(light.distance, current.lateral);
  }
  travel(tunnel.length, current.lateral);
  return { tunnelId: tunnel.id, controls, hitIds: [...hits] };
}

function driveMission(tunnels: readonly TunnelInstance[]) {
  let from: Anchor = { x: -1.45, z: 1.35 };
  let activeMs = 0;
  const runs = [];
  for (const tunnel of tunnels) {
    // A keyboard player can follow this unobstructed two-leg route at 2.8 world units/s.
    const walk = Math.abs(from.x - tunnel.entry.x) + Math.abs(from.z - tunnel.entry.z);
    activeMs += (walk / 2.8 + tunnel.length / tunnel.speed) * 1000;
    runs.push(driveTunnel(tunnel));
    from = tunnel.exit;
  }
  return { runs, activeMs, collected: runs.reduce((sum, run) => sum + run.hitIds.length, 0) };
}

export function validateLayout(layout: Layout) {
  const issues: string[] = [];
  const definition = FOREST_MISSIONS.find(mission => mission.definition.id === layout.definition.id)?.definition;
  if (!definition || definition.targetLight !== layout.definition.targetLight ||
      definition.timeLimitMs !== layout.definition.timeLimitMs || definition.worldId !== layout.definition.worldId ||
      definition.restorationId !== layout.definition.restorationId) issues.push('Unknown mission rules');
  if (layout.tunnels.length !== 3) issues.push('Expected three tunnels');
  const ids = new Set<string>();
  const pairs = new Set<number>();
  for (const tunnel of layout.tunnels) {
    const pair = anchors.findIndex(anchor => sameAnchor(anchor.entry, tunnel.entry) && sameAnchor(anchor.exit, tunnel.exit));
    if (pair < 0 || pairs.has(pair)) issues.push('Unapproved or repeated anchor pair: ' + tunnel.id);
    pairs.add(pair);
    if (!TUNNEL_TEMPLATE_IDS.some(id => id === tunnel.templateId) ||
        tunnel.length !== 24 || tunnel.width !== 3.5 || tunnel.speed !== 3.2) {
      issues.push('Unapproved tunnel geometry: ' + tunnel.id);
    }
    if (tunnel.lights.length !== 12) issues.push('Expected twelve lights: ' + tunnel.id);
    if (!tunnel.id || ids.has(tunnel.id)) issues.push('Empty or duplicate tunnel ID: ' + tunnel.id);
    ids.add(tunnel.id);
    let previousDistance = 0;
    for (const light of tunnel.lights) {
      if (!light.id || ids.has(light.id)) issues.push('Empty or duplicate light ID: ' + light.id);
      ids.add(light.id);
      if (!(light.distance > previousDistance && light.distance < tunnel.length && Math.abs(light.lateral) <= tunnel.width / 2 - 0.43) ||
          light.radius !== 0.14 || light.value !== 1) issues.push('Invalid light placement: ' + light.id);
      previousDistance = light.distance;
    }
  }
  const witness = issues.length ? null : driveMission(layout.tunnels);
  if (witness && witness.collected !== 36) issues.push('Baseline steering cannot collect all 36 lights');
  if (witness && witness.activeMs + 18_000 > layout.definition.timeLimitMs) issues.push('Insufficient search time');
  return { issues, witness };
}

export function defaultCampaignSeed(index: MissionIndex): string {
  return FOREST_MISSIONS[index].definition.id + '/campaign';
}

export function generateMission(
  index: MissionIndex, seed: string, attemptLimit = maxAttempts, contentVersion: ContentVersion = CURRENT_CONTENT_VERSION,
): GeneratedMission {
  if (!seed) throw new Error('A mission seed is required');
  const limit = Number.isFinite(attemptLimit) ? Math.min(maxAttempts, Math.max(0, Math.floor(attemptLimit))) : maxAttempts;
  const definition = FOREST_MISSIONS[index].definition;
  const version = limit === maxAttempts ? generatorVersion : generatorVersion + '/limit-' + limit;
  // Keep tunnel assignments and pattern choices identical when only their lane spread changes.
  const random = randomFor(JSON.stringify([definition.id, seed, version, LEGACY_CONTENT_VERSION]));
  const spread = contentVersion === CURRENT_CONTENT_VERSION ? tunedLateralSpread : 1;
  for (let attempt = 0; attempt <= limit; attempt++) {
    // The last proposal is the authored fallback and consumes no random numbers.
    const fallback = attempt === limit;
    const anchorOrder = fallback ? indices : shuffle(random);
    const templateOrder = fallback ? indices : shuffle(random);
    const tunnels = anchorOrder.map((pair, slot) => {
      const anchor = anchors[pair]!;
      const id = definition.id + '/tunnel-' + (pair + 1);
      const pattern = fallback ? patterns[0] : patterns[random(patterns.length)]!;
      const sign = fallback || random(2) === 0 ? 1 : -1;
      return {
        ...anchor, id, templateId: TUNNEL_TEMPLATE_IDS[templateOrder[slot]!],
        lights: anchor.lights.map((light, i) => {
          const lane = pattern[i]! * spread;
          return { ...light, id: id + '/light-' + (i + 1), lateral: lane === 0 ? 0 : sign * lane };
        }),
      };
    });
    const layout = { definition, seed, generatorVersion: version, contentVersion, tunnels };
    const { issues } = validateLayout(layout);
    if (!issues.length) {
      const digest = checksum(JSON.stringify(layout)).toString(16).padStart(16, '0');
      return { ...layout, manifestHash: 'fnv1a64:' + digest };
    }
    if (fallback) throw new Error(`Invalid authored fallback for ${definition.id} seed ${seed}: ${issues.join(', ')}`);
  }
  throw new Error('Generation exhausted without a fallback');
}

export function reproduceMission(index: MissionIndex, identity: MissionIdentity): GeneratedMission | null {
  const { seed, contentVersion, generatorVersion: savedGenerator, manifestHash } = identity;
  if (!seed || savedGenerator !== generatorVersion ||
      (contentVersion !== LEGACY_CONTENT_VERSION && contentVersion !== CURRENT_CONTENT_VERSION)) return null;
  const mission = generateMission(index, seed, maxAttempts, contentVersion);
  return mission.manifestHash === manifestHash ? mission : null;
}
