import { describe, expect, it } from 'vitest';
import { FOREST_MISSIONS, TUNNEL_DEMO } from '../../src/game/content/fixtures';
import { createAttempt, reduceAttempt, type Attempt, type AttemptCommand } from '../../src/game/core/attempt';

const forestTwo = FOREST_MISSIONS[1];

function apply(state: Attempt, ...commands: AttemptCommand[]) {
  return commands.reduce(reduceAttempt, state);
}

function enter(state: Attempt, index: number) {
  return apply(state,
    { type: 'enter-tunnel', tunnelId: state.mission.tunnels[index]!.id },
    { type: 'drop-finished' },
    { type: 'begin-tunnel' },
  );
}

// Follow the public state transitions even when a test only needs a prior score.
function visit(state: Attempt, index: number, count: number, elapsedMs = count) {
  const hits = state.mission.tunnels[index]!.lights.slice(0, count)
    .map((light, i) => ({ id: light.id, offsetMs: i + 1 }));
  return apply(enter(state, index),
    { type: 'advance', elapsedMs, hits },
    { type: 'tunnel-finished' },
    { type: 'exit-finished' },
  );
}

describe('attempt clock and collection', () => {
  it('allows unlimited tutorial exploration and a normal exit with missed lights', () => {
    let attempt = createAttempt(TUNNEL_DEMO, { mode: 'tutorial' });
    attempt = reduceAttempt(attempt, { type: 'advance', elapsedMs: 900_000 });
    expect(attempt.phase).toBe('explore');
    attempt = visit(attempt, 0, 3, 180_000);
    expect(attempt.phase).toBe('explore');
    expect(attempt.collectedIds.size).toBe(3);
    expect(attempt.outcome).toBeNull();
  });

  it('uses each mission target and its 36 unique one-point lights', () => {
    expect(FOREST_MISSIONS.map(mission => mission.definition.targetLight)).toEqual([22, 25, 28]);
    for (const mission of FOREST_MISSIONS) {
      expect(mission.tunnels.map(tunnel => tunnel.lights.length)).toEqual([12, 12, 12]);
      const lights = mission.tunnels.flatMap(tunnel => tunnel.lights);
      expect(new Set(lights.map(light => light.id)).size).toBe(36);
      expect(lights.every(light => light.value === 1)).toBe(true);
      let state = createAttempt(mission);
      for (const index of [0, 1, 2]) state = visit(state, index, 12);
      expect(state.phase).toBe('success');
      expect(state.collectedIds.size).toBe(mission.definition.targetLight);
    }
  });

  it('only spends time in exploration and active travel and scores only in the active tunnel', () => {
    const tunnel = forestTwo.tunnels[0]!;
    const hits = [{ id: tunnel.lights[0]!.id, offsetMs: 1 }];
    const tick = { type: 'advance', elapsedMs: 10, hits } as const;
    let state = apply(createAttempt(forestTwo), tick);
    expect([state.activeTimeMs, state.collectedIds.size]).toEqual([10, 0]);
    state = apply(state, { type: 'enter-tunnel', tunnelId: tunnel.id }, tick);
    expect([state.phase, state.activeTimeMs]).toEqual(['drop', 10]);
    state = apply(state, { type: 'drop-finished' }, tick);
    expect([state.phase, state.activeTimeMs, state.collectedIds.size]).toEqual(['tunnel-ready', 10, 0]);
    state = apply(state, { type: 'begin-tunnel' }, tick, { type: 'pause' });
    expect([state.paused, state.activeTimeMs, state.collectedIds.size]).toEqual([true, 20, 1]);
    const paused = apply(state,
      { type: 'advance', elapsedMs: 100_000, hits: [{ id: tunnel.lights[1]!.id, offsetMs: 10 }] },
      { type: 'tunnel-finished' },
    );
    expect(paused).toEqual(state);
    state = apply(paused, { type: 'resume' }, tick, { type: 'tunnel-finished' }, tick);
    expect([state.phase, state.activeTimeMs, state.collectedIds.size]).toEqual(['exit', 30, 1]);
    state = apply(state, { type: 'exit-finished' }, tick);
    expect([state.phase, state.activeTimeMs, state.collectedIds.size]).toEqual(['explore', 40, 1]);
  });

  it('ignores unknown, duplicate, foreign and out-of-interval hits without mutating earlier snapshots', () => {
    const original = createAttempt(forestTwo);
    expect(apply(original, { type: 'enter-tunnel', tunnelId: 'unknown' })).toEqual(original);
    const active = enter(original, 0);
    const [one, two] = forestTwo.tunnels[0]!.lights;
    const hits = [
      { id: 'unknown', offsetMs: 0 }, { id: forestTwo.tunnels[1]!.lights[0]!.id, offsetMs: 0 },
      { id: one!.id, offsetMs: 2 }, { id: one!.id, offsetMs: 0 },
      ...[-1, 11, NaN, Infinity].map(offsetMs => ({ id: two!.id, offsetMs })),
    ];
    const collected = apply(active, { type: 'advance', elapsedMs: 10, hits });
    expect([...collected.collectedIds]).toEqual([one!.id]);
    expect(active.activeTimeMs).toBe(0);
    expect(active.collectedIds.size).toBe(0);
    for (const elapsedMs of [-1, NaN, Infinity]) {
      expect(apply(collected, { type: 'advance', elapsedMs, hits })).toEqual(collected);
    }
    const exited = apply(collected, { type: 'tunnel-finished' }, { type: 'exit-finished' });
    expect(collected.consumedTunnelIds.size).toBe(0);
    expect([...exited.consumedTunnelIds]).toEqual([forestTwo.tunnels[0]!.id]);
    expect(apply(exited, { type: 'enter-tunnel', tunnelId: forestTwo.tunnels[0]!.id })).toEqual(exited);
    expect(original.phase).toBe('explore');
  });
});

describe('success, expiry and remaining opportunities', () => {
  it.each([-1, 0, 1])('resolves a collision at deadline offset %i ms consistently across frame schedules', difference => {
    // The third tunnel begins one short of the target. Its first light crosses
    // the deadline boundary during an interval lasting 40 ms.
    const mission = forestTwo;
    let nearDeadline = enter(visit(visit(createAttempt(mission), 0, 12), 1, 12), 2);
    nearDeadline = apply(nearDeadline, { type: 'advance', elapsedMs: 89_980 - nearDeadline.activeTimeMs });
    const first = mission.tunnels[2]!.lights[0]!.id;
    const late = mission.tunnels[2]!.lights[1]!.id;
    const eventAt = 90_000 + difference;
    for (const frames of [[40], [13, 4, 6, 17], Array<number>(40).fill(1)]) {
      let state = nearDeadline;
      let start = 89_980;
      for (const elapsedMs of frames) {
        // Deliver later collisions first to exercise chronological ordering.
        const hits = [{ id: late, time: 90_012 }, { id: first, time: eventAt }]
          .filter(event => event.time > start && event.time <= start + elapsedMs)
          .map(event => ({ id: event.id, offsetMs: event.time - start }));
        state = apply(state, { type: 'advance', elapsedMs, hits });
        start += elapsedMs;
      }
      expect(state.activeTimeMs).toBe(Math.min(eventAt, 90_000));
      expect(state.collectedIds.has(first)).toBe(difference <= 0);
      expect(state.collectedIds.has(late)).toBe(false);
      expect(state.outcome).toEqual(difference <= 0
        ? { kind: 'success', atMs: eventAt }
        : { kind: 'failure', reason: 'deadline', atMs: 90_000 });
      expect(apply(state, { type: 'advance', elapsedMs: 10_000,
        hits: [{ id: late, offsetMs: 0 }] }, { type: 'tunnel-finished' }, { type: 'exit-finished' })).toEqual(state);
    }
  });

  it('succeeds once at active second 73 in the forest’s 8 + 9 + 8 example', () => {
    let state = apply(createAttempt(forestTwo), { type: 'advance', elapsedMs: 30_000 });
    state = visit(state, 0, 8, 10_000);
    expect(state.collectedIds.size).toBe(8);
    state = visit(apply(state, { type: 'advance', elapsedMs: 5_000 }), 1, 9, 10_000);
    expect(state.collectedIds.size).toBe(17);
    state = enter(apply(state, { type: 'advance', elapsedMs: 15_000 }), 2);
    const hits = forestTwo.tunnels[2]!.lights.slice(0, 9)
      .map((light, i) => ({ id: light.id, offsetMs: (i + 1) * 375 })).reverse();
    state = apply(state, { type: 'advance', elapsedMs: 8_000, hits });
    expect(state.phase).toBe('success');
    expect(state.collectedIds.size).toBe(25);
    expect(state.collectedIds.has(forestTwo.tunnels[2]!.lights[8]!.id)).toBe(false);
    expect(state.outcome).toEqual({ kind: 'success', atMs: 73_000 });
    expect(state.activeTimeMs).toBe(73_000);
  });

  it('ends immediately when an exit makes the target impossible, and continues at equality', () => {
    const initial = createAttempt(forestTwo);
    const impossible = visit(initial, 0, 0);
    expect(impossible.outcome).toEqual({ kind: 'failure', reason: 'unreachable', atMs: 0 });
    const equal = visit(initial, 0, 1);
    expect(equal.phase).toBe('explore');
    expect(equal.outcome).toBeNull();
    const last = visit(visit(equal, 1, 12), 2, 11);
    expect(last.collectedIds.size).toBe(24);
    expect(last.outcome).toEqual({ kind: 'failure', reason: 'unreachable', atMs: 24 });
  });

  it('retries the same generated mission and loadout with fresh attempt state', () => {
    const loadout: { 'collection-radius'?: 1 } = { 'collection-radius': 1 };
    const missionBeforePlay = structuredClone(forestTwo);
    const original = createAttempt(forestTwo, { id: 'first', mode: 'practice', loadout });
    delete loadout['collection-radius'];
    const failed = apply(visit(original, 0, 8), { type: 'advance', elapsedMs: 100_000 });
    expect(failed.phase).toBe('failure');
    expect(failed.activeTimeMs).toBe(90_000);
    const fresh = apply(failed, { type: 'retry', id: 'second' });
    expect(fresh).toMatchObject({
      id: 'second', mode: 'practice', phase: 'explore', paused: false, tunnelId: null,
      outcome: null, activeTimeMs: 0, loadout: { 'collection-radius': 1 },
    });
    expect(fresh.mission).toEqual(missionBeforePlay);
    expect(fresh.collectedIds.size).toBe(0);
    expect(fresh.consumedTunnelIds.size).toBe(0);
    expect(failed.collectedIds.size).toBe(8);
    expect(failed.consumedTunnelIds.size).toBe(1);

    // The ids of the mission, tunnel and particle legitimately repeat on retry.
    const active = enter(fresh, 0);
    const hit = [{ id: forestTwo.tunnels[0]!.lights[0]!.id, offsetMs: 5 }];
    expect(apply(active, { type: 'advance', elapsedMs: 10, attemptId: 'first', hits: hit })).toEqual(active);
    const accepted = apply(active, { type: 'advance', elapsedMs: 10, attemptId: 'second', hits: hit });
    expect(accepted.collectedIds.size).toBe(1);
    expect(accepted.activeTimeMs).toBe(10);
  });
});
