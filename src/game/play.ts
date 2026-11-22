import { FOREST_MISSIONS } from './content/fixtures';
import { createAttempt, reduceAttempt } from './core/attempt';
import type { Anchor } from './core/types';
import { bindControls } from './input/controls';
import { createExplorationWorld } from './render/exploration';
import type { View } from './render/preview';
import { createTunnelView } from './render/tunnel';

const mission = FOREST_MISSIONS[0];
const tunnel = mission.tunnels[0]!;
const start: Anchor = { x: -1.45, z: 1.35 };
const bounds = { halfWidth: 3.7, halfDepth: 3.8 };
const entryRadius = 0.49;
const dropMs = 1200;
const exitMs = 1400;

export interface GameHud {
  phase: string;
  paused: boolean;
  ready: boolean;
  timeLeftMs: number;
  lights: number;
  hint: string;
  action: string;
}

export interface GameView extends View {
  action(): void;
  setReducedMotion(reduced: boolean): void;
}

export function createGame(
  canvas: HTMLCanvasElement,
  initialReducedMotion: boolean,
  showHud: (hud: GameHud) => void,
  redraw: () => void,
): GameView {
  const world = createExplorationWorld({ entry: { ...tunnel.entry, radius: entryRadius }, bounds });
  const travel = createTunnelView(world, tunnel);
  let run = 1;
  let attempt = createAttempt(mission, { mode: 'practice', id: String(run) });
  let position = start;
  let lastFrame: number | undefined;
  let feedbackUntil = 0;
  let reducedMotion = initialReducedMotion;
  let aspect = 0;
  let phaseTime = 0;
  let distance = 0;
  let returned = false;

  function nearEntry() {
    return Math.hypot(position.x - tunnel.entry.x, position.z - tunnel.entry.z) <= entryRadius + 1e-9;
  }

  function moveTo(anchor: Anchor) {
    position = {
      x: Math.max(-bounds.halfWidth, Math.min(bounds.halfWidth, anchor.x)),
      z: Math.max(-bounds.halfDepth, Math.min(bounds.halfDepth, anchor.z)),
    };
  }

  function advanceTo(now: number) {
    const previous = lastFrame ?? now;
    const elapsedMs = Math.max(0, now - previous);
    lastFrame = Math.max(previous, now);
    if (attempt.paused || attempt.outcome || returned) return;
    if (attempt.phase === 'explore') {
      attempt = reduceAttempt(attempt, { type: 'advance', elapsedMs });
      if (attempt.phase !== 'explore') return;
      const movement = controls.move();
      if (movement.x || movement.z) {
        moveTo({ x: position.x + movement.x * elapsedMs * .0028, z: position.z + movement.z * elapsedMs * .0028 });
      }
    } else if (attempt.phase === 'drop') {
      phaseTime += elapsedMs;
      if (phaseTime >= dropMs) {
        attempt = reduceAttempt(attempt, { type: 'drop-finished' });
        phaseTime = 0;
      }
    } else if (attempt.phase === 'tunnel-active') {
      const remainingMs = (tunnel.length - distance) / tunnel.speed * 1000;
      const before = attempt.activeTimeMs;
      attempt = reduceAttempt(attempt, { type: 'advance', elapsedMs: Math.min(elapsedMs, remainingMs) });
      distance = Math.min(tunnel.length, distance + (attempt.activeTimeMs - before) * tunnel.speed / 1000);
      if (!attempt.outcome && elapsedMs >= remainingMs) {
        distance = tunnel.length;
        attempt = reduceAttempt(attempt, { type: 'tunnel-finished' });
        phaseTime = 0;
      }
    } else if (attempt.phase === 'exit') {
      phaseTime += elapsedMs;
      if (phaseTime >= exitMs) {
        attempt = reduceAttempt(attempt, { type: 'exit-finished' });
        position = tunnel.exit;
        returned = true;
        phaseTime = 0;
        distance = 0;
      }
    }
  }

  function release(inside: boolean) {
    advanceTo(performance.now());
    if (attempt.phase !== 'explore' || attempt.paused || returned) return;
    if (inside && nearEntry()) {
      attempt = reduceAttempt(attempt, { type: 'enter-tunnel', tunnelId: tunnel.id });
      controls.reset();
    } else {
      feedbackUntil = attempt.activeTimeMs + 1500;
    }
    redraw();
  }

  function pause() {
    if (returned || attempt.outcome) return;
    advanceTo(performance.now());
    attempt = reduceAttempt(attempt, { type: 'pause' });
    controls.reset();
    redraw();
  }

  function togglePause() {
    if (attempt.outcome || returned) return;
    if (attempt.paused) {
      lastFrame = performance.now();
      attempt = reduceAttempt(attempt, { type: 'resume' });
      controls.reset();
      canvas.focus({ preventScroll: true });
      redraw();
    } else {
      pause();
    }
  }

  function action() {
    if (attempt.paused) {
      togglePause();
    } else if (attempt.phase === 'tunnel-ready') {
      lastFrame = performance.now();
      attempt = reduceAttempt(attempt, { type: 'begin-tunnel' });
      canvas.focus({ preventScroll: true });
      redraw();
    } else if (!attempt.outcome && !returned) {
      togglePause();
    } else {
      attempt = createAttempt(mission, { mode: 'practice', id: String(++run) });
      position = start;
      lastFrame = performance.now();
      feedbackUntil = 0;
      phaseTime = 0;
      distance = 0;
      returned = false;
      controls.reset();
      canvas.focus({ preventScroll: true });
      redraw();
    }
  }

  const controls = bindControls(canvas, {
    phase: () => !attempt.paused && !returned && attempt.phase === 'explore' ? 'explore' : 'inactive',
    point(clientX, clientY) {
      advanceTo(performance.now());
      if (attempt.paused || attempt.phase !== 'explore') return;
      const box = canvas.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) return;
      const anchor = world.pickGround((clientX - box.left) / box.width * 2 - 1, 1 - (clientY - box.top) / box.height * 2);
      if (anchor) moveTo(anchor);
      redraw();
    },
    release, pause, togglePause,
  });

  function hint(ready: boolean) {
    if (attempt.paused) return 'Paused. Resume when you’re ready.';
    if (returned) return 'Back above ground. Try the tunnel again.';
    if (attempt.phase === 'drop') return 'Dropping into the tunnel…';
    if (attempt.phase === 'tunnel-ready') return 'Ready at the entrance. Begin the ride when you’re ready.';
    if (attempt.phase === 'tunnel-active') return 'Follow the bend through the tunnel.';
    if (attempt.phase === 'exit') return 'Returning to the clearing…';
    if (attempt.phase === 'failure') return 'Time ran out. Try the clearing again.';
    if (ready) return 'Release here. On a keyboard, press Space.';
    if (attempt.activeTimeMs < feedbackUntil) return 'Whoops! Release over an opening when its ring appears.';
    return 'Hold and drag, or use the arrow keys. Look for an opening in the clearing.';
  }

  return {
    scene: world.scene,
    camera: travel.camera,
    resize(nextAspect) {
      if (nextAspect === aspect) return;
      aspect = nextAspect;
      world.resize(aspect);
      controls.rebase();
    },
    update(_elapsed, now) {
      if (now !== undefined) advanceTo(now);
      const ready = attempt.phase === 'explore' && !returned && nearEntry();
      world.update({ position, ready, used: returned, elapsedSeconds: attempt.activeTimeMs / 1000, reducedMotion });
      const phase = attempt.phase;
      const pose = phase === 'drop' || phase === 'exit' ? phase
        : phase === 'tunnel-ready' ? 'ready'
        : phase === 'tunnel-active' || (phase === 'failure' && distance > 0) ? 'tunnel' : 'explore';
      travel.applyPose({
        phase: pose, position, distance, lateral: 0, reducedMotion,
        progress: pose === 'drop' ? phaseTime / dropMs : pose === 'exit' ? phaseTime / exitMs : 0,
      });
      showHud({
        phase, paused: attempt.paused, ready,
        timeLeftMs: mission.definition.timeLimitMs - attempt.activeTimeMs,
        lights: attempt.collectedIds.size, hint: hint(ready),
        action: attempt.paused ? 'Resume' : returned || attempt.outcome ? 'Try again'
          : phase === 'tunnel-ready' ? 'Begin ride' : 'Pause',
      });
    },
    action,
    setReducedMotion(reduced) {
      reducedMotion = reduced;
      redraw();
    },
    dispose() {
      controls.dispose();
      travel.dispose();
      world.dispose();
    },
  };
}
