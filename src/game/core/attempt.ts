import type { AttemptMode, GeneratedMission, Loadout } from './types';

type Phase = 'explore' | 'drop' | 'tunnel-ready' | 'tunnel-active' | 'exit' | 'success' | 'failure';
type Outcome =
  | { readonly kind: 'success'; readonly atMs: number }
  | { readonly kind: 'failure'; readonly reason: 'deadline' | 'unreachable'; readonly atMs: number };

export interface Attempt {
  readonly id: string;
  readonly mission: GeneratedMission;
  readonly mode: AttemptMode;
  readonly loadout: Loadout;
  readonly phase: Phase;
  readonly paused: boolean;
  readonly activeTimeMs: number;
  readonly collectedIds: ReadonlySet<string>;
  readonly consumedTunnelIds: ReadonlySet<string>;
  readonly tunnelId: string | null;
  readonly outcome: Outcome | null;
}

export interface Hit {
  readonly id: string;
  /** Milliseconds from the start of this advance. */
  readonly offsetMs: number;
}

type Advance = { type: 'advance'; elapsedMs: number; hits?: readonly Hit[]; attemptId?: string };
export type AttemptCommand =
  | Advance
  | { type: 'enter-tunnel'; tunnelId: string }
  | { type: 'drop-finished' | 'begin-tunnel' | 'tunnel-finished' | 'exit-finished' | 'pause' | 'resume' }
  | { type: 'retry'; id: string };

export function createAttempt(
  mission: GeneratedMission,
  options: { id?: string; mode?: AttemptMode; loadout?: Loadout } = {},
): Attempt {
  return {
    id: options.id ?? `${mission.definition.id}:1`,
    mission,
    mode: options.mode ?? 'story',
    loadout: Object.freeze({ ...options.loadout }),
    phase: 'explore',
    paused: false,
    activeTimeMs: 0,
    collectedIds: new Set(),
    consumedTunnelIds: new Set(),
    tunnelId: null,
    outcome: null,
  };
}

function advance(state: Attempt, { elapsedMs, hits, attemptId }: Advance): Attempt {
  if (attemptId !== undefined && attemptId !== state.id) return state;
  if (state.phase !== 'explore' && state.phase !== 'tunnel-active') return state;
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return state;

  const { timeLimitMs, targetLight } = state.mission.definition;
  const endMs = Math.min(state.activeTimeMs + elapsedMs, timeLimitMs);
  let collectedIds = state.collectedIds;
  if (state.phase === 'tunnel-active' && hits?.length) {
    const tunnel = state.mission.tunnels.find(candidate => candidate.id === state.tunnelId);
    const orderedHits = hits.filter(hit =>
      hit.offsetMs >= 0 && hit.offsetMs <= elapsedMs && state.activeTimeMs + hit.offsetMs <= timeLimitMs,
    ).sort((a, b) => a.offsetMs - b.offsetMs);
    const collected = new Set(collectedIds);
    for (const hit of orderedHits) {
      if (collected.has(hit.id) || !tunnel?.lights.some(light => light.id === hit.id)) continue;
      collected.add(hit.id);
      if (collected.size >= targetLight) {
        const atMs = state.activeTimeMs + hit.offsetMs;
        return { ...state, phase: 'success', collectedIds: collected, activeTimeMs: atMs, outcome: { kind: 'success', atMs } };
      }
    }
    if (collected.size !== collectedIds.size) collectedIds = collected;
  }

  if (endMs >= timeLimitMs) {
    return {
      ...state, phase: 'failure', collectedIds, activeTimeMs: timeLimitMs,
      outcome: { kind: 'failure', reason: 'deadline', atMs: timeLimitMs },
    };
  }
  if (endMs === state.activeTimeMs && collectedIds === state.collectedIds) return state;
  return { ...state, collectedIds, activeTimeMs: endMs };
}

function finishTunnel(state: Attempt): Attempt {
  if (state.phase !== 'tunnel-active' || state.tunnelId === null) return state;
  const consumedTunnelIds = new Set(state.consumedTunnelIds).add(state.tunnelId);
  const reachableIds = new Set(state.collectedIds);
  for (const tunnel of state.mission.tunnels) {
    if (!consumedTunnelIds.has(tunnel.id)) {
      for (const light of tunnel.lights) reachableIds.add(light.id);
    }
  }
  if (reachableIds.size < state.mission.definition.targetLight) {
    return {
      ...state, phase: 'failure', consumedTunnelIds,
      outcome: { kind: 'failure', reason: 'unreachable', atMs: state.activeTimeMs },
    };
  }
  return { ...state, phase: 'exit', consumedTunnelIds };
}

export function reduceAttempt(state: Attempt, command: AttemptCommand): Attempt {
  if (command.type === 'retry') {
    if (state.outcome?.kind !== 'failure' || !command.id || command.id === state.id) return state;
    return createAttempt(state.mission, { id: command.id, mode: state.mode, loadout: state.loadout });
  }
  if (state.outcome) return state;
  if (command.type === 'resume') return state.paused ? { ...state, paused: false } : state;
  if (state.paused) return state;

  switch (command.type) {
    case 'pause':
      return { ...state, paused: true };
    case 'advance':
      return advance(state, command);
    case 'enter-tunnel':
      if (state.phase !== 'explore' || state.consumedTunnelIds.has(command.tunnelId) ||
          !state.mission.tunnels.some(tunnel => tunnel.id === command.tunnelId)) return state;
      return { ...state, phase: 'drop', tunnelId: command.tunnelId };
    case 'drop-finished':
      return state.phase === 'drop' ? { ...state, phase: 'tunnel-ready' } : state;
    case 'begin-tunnel':
      return state.phase === 'tunnel-ready' ? { ...state, phase: 'tunnel-active' } : state;
    case 'tunnel-finished':
      return finishTunnel(state);
    case 'exit-finished':
      return state.phase === 'exit' ? { ...state, phase: 'explore', tunnelId: null } : state;
  }
}
