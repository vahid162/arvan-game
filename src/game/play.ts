import { FOREST_MISSIONS } from './content/fixtures';
import { createAttempt, reduceAttempt } from './core/attempt';
import type { Anchor } from './core/types';
import { bindControls } from './input/controls';
import { createExplorationWorld } from './render/exploration';
import type { View } from './render/preview';

const mission = FOREST_MISSIONS[0];
const tunnel = mission.tunnels[0]!;
const start: Anchor = { x: -1.45, z: 1.35 };
const bounds = { halfWidth: 3.7, halfDepth: 3.8 };
const entryRadius = 0.49;

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
  let run = 1;
  let attempt = createAttempt(mission, { mode: 'practice', id: String(run) });
  let position = start;
  let lastFrame = performance.now();
  let feedbackUntil = 0;
  let reducedMotion = initialReducedMotion;
  let aspect = 0;

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
    const elapsedMs = Math.max(0, now - lastFrame);
    lastFrame = Math.max(lastFrame, now);
    if (attempt.paused || attempt.phase !== 'explore') return;
    attempt = reduceAttempt(attempt, { type: 'advance', elapsedMs });
    if (attempt.phase !== 'explore') return;
    const movement = controls.move();
    if (movement.x || movement.z) {
      moveTo({ x: position.x + movement.x * elapsedMs * .0028, z: position.z + movement.z * elapsedMs * .0028 });
    }
  }

  function release(inside: boolean) {
    advanceTo(performance.now());
    if (attempt.phase !== 'explore' || attempt.paused) return;
    if (inside && nearEntry()) {
      attempt = reduceAttempt(attempt, { type: 'enter-tunnel', tunnelId: tunnel.id });
      controls.reset();
    } else {
      feedbackUntil = attempt.activeTimeMs + 1500;
    }
    redraw();
  }

  function pause() {
    advanceTo(performance.now());
    attempt = reduceAttempt(attempt, { type: 'pause' });
    controls.reset();
    redraw();
  }

  function action() {
    if (attempt.paused) {
      lastFrame = performance.now();
      attempt = reduceAttempt(attempt, { type: 'resume' });
    } else if (attempt.phase === 'explore') {
      pause();
      return;
    } else {
      attempt = createAttempt(mission, { mode: 'practice', id: String(++run) });
      position = start;
      lastFrame = performance.now();
      feedbackUntil = 0;
    }
    controls.reset();
    canvas.focus({ preventScroll: true });
    redraw();
  }

  const controls = bindControls(canvas, {
    phase: () => !attempt.paused && attempt.phase === 'explore' ? 'explore' : 'inactive',
    point(clientX, clientY) {
      advanceTo(performance.now());
      if (attempt.paused || attempt.phase !== 'explore') return;
      const box = canvas.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) return;
      const anchor = world.pickGround((clientX - box.left) / box.width * 2 - 1, 1 - (clientY - box.top) / box.height * 2);
      if (anchor) moveTo(anchor);
      redraw();
    },
    release, pause, togglePause: action,
  });

  function hint(ready: boolean) {
    if (attempt.paused) return 'Paused. Resume when you’re ready.';
    if (attempt.phase === 'drop') return 'Opening found. The firefly is ready to drop.';
    if (attempt.phase === 'failure') return 'Time ran out. Try the clearing again.';
    if (ready) return 'Release here. On a keyboard, press Space.';
    if (attempt.activeTimeMs < feedbackUntil) return 'Whoops! Release over an opening when its ring appears.';
    return 'Hold and drag, or use the arrow keys. Look for an opening in the clearing.';
  }

  return {
    scene: world.scene,
    camera: world.camera,
    resize(nextAspect) {
      if (nextAspect === aspect) return;
      aspect = nextAspect;
      world.resize(aspect);
      controls.rebase();
    },
    update(_elapsed, now) {
      if (now !== undefined) advanceTo(now);
      const ready = attempt.phase === 'explore' && nearEntry();
      world.update({ position, ready, used: false, elapsedSeconds: attempt.activeTimeMs / 1000, reducedMotion });
      showHud({
        phase: attempt.phase, paused: attempt.paused, ready,
        timeLeftMs: mission.definition.timeLimitMs - attempt.activeTimeMs,
        lights: attempt.collectedIds.size, hint: hint(ready),
        action: attempt.paused ? 'Resume' : attempt.phase === 'explore' ? 'Pause' : 'Try again',
      });
    },
    action,
    setReducedMotion(reduced) {
      reducedMotion = reduced;
      redraw();
    },
    dispose() {
      controls.dispose();
      world.dispose();
    },
  };
}
