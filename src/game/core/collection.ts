import type { Hit } from './attempt';
import type { Collectible } from './types';

export const PLAYER_RADIUS = 0.27;

interface TunnelPoint {
  readonly distance: number;
  readonly lateral: number;
}

/** Timestamp first contact along one linear step in tunnel-local world units. */
export function sweepLights(
  lights: readonly Collectible[], from: TunnelPoint, to: TunnelPoint,
  elapsedMs: number, collected: ReadonlySet<string>, radiusScale = 1,
): Hit[] {
  const forward = to.distance - from.distance;
  const sideways = to.lateral - from.lateral;
  const length = Math.hypot(forward, sideways);
  if (!Number.isFinite(length) || !Number.isFinite(elapsedMs) || elapsedMs < 0) return [];
  if (elapsedMs === 0 && length !== 0) return [];
  const unitForward = length ? forward / length : 0;
  const unitSideways = length ? sideways / length : 0;
  const firstHits = new Map<string, number>();

  for (const light of lights) {
    if (collected.has(light.id)) continue;
    const dx = light.distance - from.distance;
    const dy = light.lateral - from.lateral;
    const radius = (PLAYER_RADIUS + light.radius) * radiusScale;
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || !Number.isFinite(radius) || light.radius < 0) continue;
    let offsetMs = 0;
    if (Math.hypot(dx, dy) > radius) {
      if (length === 0) continue;
      const along = dx * unitForward + dy * unitSideways;
      const across = dx * unitSideways - dy * unitForward;
      // Only allow floating-point roundoff at a geometric tangent or endpoint.
      const tolerance = 8 * Number.EPSILON * Math.max(1, Math.abs(dx), Math.abs(dy), length);
      if (Math.abs(across) > radius + tolerance || along < 0) continue;
      const halfChord = Math.sqrt(Math.max(0, radius * radius - across * across));
      const entry = along - halfChord;
      if (entry > length + tolerance) continue;
      offsetMs = Math.max(0, Math.min(1, entry / length)) * elapsedMs;
    }
    const previous = firstHits.get(light.id);
    if (previous === undefined || offsetMs < previous) firstHits.set(light.id, offsetMs);
  }

  return Array.from(firstHits, ([id, offsetMs]) => ({ id, offsetMs }))
    .sort((a, b) => a.offsetMs - b.offsetMs);
}
