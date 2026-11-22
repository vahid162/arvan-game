import { describe, expect, it } from 'vitest';
import { FOREST_MISSIONS } from '../../src/game/content/fixtures';
import { PLAYER_RADIUS, sweepLights } from '../../src/game/core/collection';
import type { Collectible } from '../../src/game/core/types';

const point = (distance: number, lateral = 0) => ({ distance, lateral });
const light = (id: string, distance: number, lateral = 0): Collectible =>
  ({ id, distance, lateral, radius: 0.14, value: 1 });
const noHits = new Set<string>();
const radius = PLAYER_RADIUS + 0.14;

describe('continuous tunnel collection', () => {
  it('reports first contact even when both endpoints miss the light', () => {
    const lamp = light('middle', 5);
    const hits = sweepLights([lamp], point(0), point(10), 1000, noHits);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.id).toBe(lamp.id);
    expect(hits[0]!.offsetMs).toBeCloseTo((5 - radius) * 100, 9);
  });

  it('includes tangency, rejects a near miss, and respects the direction and ends of the segment', () => {
    const lamps = [light('tangent', 7, radius), light('miss', 6, radius + 0.00001),
      light('behind', 11), light('beyond', -1)];
    expect(sweepLights(lamps, point(10), point(0), 1000, noHits))
      .toEqual([{ id: 'tangent', offsetMs: 300 }]);
    expect(sweepLights([light('overlap', 5.1), light('remote', 6)], point(5), point(5), 10, noHits))
      .toEqual([{ id: 'overlap', offsetMs: 0 }]);
  });

  it('reports each new ID once at its earliest contact in time order', () => {
    const collected = new Set(['old']);
    const lamps = [light('duplicate', 9), light('next', 7), light('old', 3), light('duplicate', 2)];
    const hits = sweepLights(lamps, point(0), point(10), 1000, collected);
    expect(hits.map(hit => hit.id)).toEqual(['duplicate', 'next']);
    expect(hits[0]!.offsetMs).toBeCloseTo((2 - radius) * 100, 9);
    expect(hits[1]!.offsetMs).toBeCloseTo((7 - radius) * 100, 9);
    expect([...collected]).toEqual(['old']);
  });

  it('finds the same time of impact on a diagonal over different frame schedules', () => {
    const position = (ms: number) => point(ms / 100, -1.2 + ms / 500);
    const lamps = [light('early', 2, -0.8), light('late', 8, 0.4), light('outside', 5, 1.2)];
    const coarse = sweepLights(lamps, position(0), position(1000), 1000, noHits);
    expect(coarse.map(hit => hit.id)).toEqual(['early', 'late']);
    const collected = new Set<string>();
    const times: number[] = [];
    let previous = 0;
    for (const time of [40, 180, 325, 500, 785, 999, 1000]) {
      const hits = sweepLights(lamps, position(previous), position(time), time - previous, collected);
      for (const hit of hits) {
        collected.add(hit.id);
        times.push(previous + hit.offsetMs);
      }
      previous = time;
    }
    expect([...collected]).toEqual(coarse.map(hit => hit.id));
    times.forEach((time, index) => expect(time).toBeCloseTo(coarse[index]!.offsetMs, 9));
  });

  it('can reach all twelve authored lights with base steering, while a straight run misses lights', () => {
    const tunnel = FOREST_MISSIONS[0].tunnels[0]!;
    expect(tunnel.speed).toBe(3.2);
    expect(tunnel.lights).toHaveLength(12);
    let previous = point(0);
    const collected = new Set<string>();
    for (const lamp of tunnel.lights) {
      const elapsedMs = (lamp.distance - previous.distance) / tunnel.speed * 1000;
      expect(elapsedMs).toBeGreaterThan(0);
      expect(Math.abs(lamp.lateral)).toBeLessThanOrEqual(1.33);
      expect(Math.abs(lamp.lateral - previous.lateral)).toBeLessThanOrEqual(3 * elapsedMs / 1000);
      for (const hit of sweepLights(tunnel.lights, previous, lamp, elapsedMs, collected)) collected.add(hit.id);
      previous = point(lamp.distance, lamp.lateral);
    }
    expect(collected.size).toBe(12);
    const straight = sweepLights(tunnel.lights, point(0), point(tunnel.length), tunnel.length / tunnel.speed * 1000, noHits);
    expect(straight.length).toBeGreaterThan(0);
    expect(straight.length).toBeLessThan(collected.size);
  });
});
