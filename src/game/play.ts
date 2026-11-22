import { TUNNEL_DEMO, UPGRADES } from './content/fixtures';
import { t } from '../ui/copy';
import { CURRENT_CONTENT_VERSION, TUNED_ENTRANCE_DISCOVERY_RADIUS } from './content/generation';
import { createAttempt, reduceAttempt } from './core/attempt';
import { sweepLights } from './core/collection';
import type { Anchor, AttemptMode, GeneratedMission, Loadout } from './core/types';
import { bindControls } from './input/controls';
import { createExplorationWorld } from './render/exploration';
import { createTunnelLights } from './render/lights';
import { createPickupSound } from './render/pickup-sound';
import type { View } from './render/preview';
import { createTunnelView } from './render/tunnel';

const start: Anchor = { x: -1.45, z: 1.35 };
const bounds = { halfWidth: 3.7, halfDepth: 3.8 };
const entryRadius = 0.49;
const dropMs = 1200;
const exitMs = 1400;
const lateralPerMs = .003;

export interface GameHud {
  phase: string;
  tutorial: boolean;
  paused: boolean;
  ready: boolean;
  timeLeftMs: number;
  lights: number;
  total: number;
  target: number | null;
  result: string;
  failure: 'deadline' | 'unreachable' | null;
  storyWon: boolean;
  collecting: boolean;
  hint: string;
  action: string;
}

export interface GameView extends View {
  startClock(): void;
  action(): void;
  setReducedMotion(reduced: boolean): void;
}

export function createGame(
  canvas: HTMLCanvasElement,
  initialReducedMotion: boolean,
  showHud: (hud: GameHud) => void,
  redraw: () => void,
  options: {
    mission?: GeneratedMission;
    mode?: AttemptMode;
    loadout?: Loadout;
    restored?: number;
    sensitivity?: number;
    sound?: boolean;
    onStoryWin?: (mission: GeneratedMission) => number;
    onPracticeResult?: (mission: GeneratedMission, loadout: Loadout, score: number) => number | null;
  } = {},
): GameView {
  const mission = options.mission ?? TUNNEL_DEMO;
  const mode = mission === TUNNEL_DEMO ? 'tutorial' : options.mode ?? 'story';
  const tutorial = mode === 'tutorial';
  const sensitivity = options.sensitivity ?? 1;
  let run = 1;
  let attempt = createAttempt(mission, { mode, loadout: options.loadout, id: String(run) });
  const [explorationUpgrade, collectionUpgrade] = UPGRADES;
  const lightRadiusScale = attempt.loadout[explorationUpgrade.id] ? explorationUpgrade.multiplier : 1;
  const collectionScale = attempt.loadout[collectionUpgrade.id] ? collectionUpgrade.multiplier : 1;
  const totalLights = mission.tunnels.reduce((sum, track) => sum + track.lights.length, 0);
  const entries = mission.tunnels.map(tunnel => ({ ...tunnel.entry, id: tunnel.id, radius: entryRadius }));
  const world = createExplorationWorld({
    entry: entries[0]!, entries, bounds, story: !tutorial, lightRadiusScale,
    entranceDiscoveryRadius: mission.contentVersion === CURRENT_CONTENT_VERSION ? TUNED_ENTRANCE_DISCOVERY_RADIUS : undefined,
  });
  let restoration = options.restored ?? 0;
  world.setRestoration(restoration);
  const routes = mission.tunnels.map(tunnel => {
    const travel = createTunnelView(world, tunnel);
    return { tunnel, travel, sparks: createTunnelLights(travel, tunnel) };
  });
  let route = routes[0]!;
  let { tunnel, travel, sparks } = route;
  const sound = createPickupSound();
  sound.setEnabled(options.sound ?? true);
  let soundedOutcome = attempt.outcome;
  let recordedPractice = false;
  let practiceBest: number | null = null;
  let position = start;
  let lastFrame: number | undefined;
  let feedbackUntil = 0;
  let reducedMotion = initialReducedMotion;
  let aspect = 0;
  let viewport: DOMRect | undefined;
  let phaseTime = 0;
  let distance = 0;
  let lateral = 0;
  let desiredLateral = 0;
  let pointerStartX = 0;
  let pointerStartLane = 0;
  let returning = false;
  let returnPaused = false;
  let returned = false;
  let visualMs = 0;
  let pickupMs = -Infinity;

  function readyRoute() {
    return routes.find(({ tunnel }) => !attempt.consumedTunnelIds.has(tunnel.id) &&
      Math.hypot(position.x - tunnel.entry.x, position.z - tunnel.entry.z) <= entryRadius + 1e-9);
  }

  function selectRoute(next: typeof route) {
    travel.group.visible = false;
    route = next;
    ({ tunnel, travel, sparks } = route);
    distance = 0;
    lateral = 0;
    phaseTime = 0;
  }

  function moveTo(anchor: Anchor) {
    position = {
      x: Math.max(-bounds.halfWidth, Math.min(bounds.halfWidth, anchor.x)),
      z: Math.max(-bounds.halfDepth, Math.min(bounds.halfDepth, anchor.z)),
    };
  }

  function advanceTunnel(elapsedMs: number) {
    const forwardPerMs = tunnel.speed / 1000;
    const laneLimit = tunnel.width / 2 - .43;
    let remaining = elapsedMs;
    const direction = controls.move().x;
    while (remaining > 1e-7 && attempt.phase === 'tunnel-active') {
      const toEndMs = Math.max(0, (tunnel.length - distance) / forwardPerMs);
      const target = direction ? direction * laneLimit : desiredLateral;
      const delta = target - lateral;
      // Limit each step and split again at the point a lateral target is reached.
      const toTargetMs = Math.abs(delta) > 1e-7 ? Math.abs(delta) / lateralPerMs : Infinity;
      const step = Math.min(remaining, toEndMs, toTargetMs, 32);
      const next = {
        distance: Math.min(tunnel.length, distance + forwardPerMs * step),
        lateral: lateral + Math.sign(delta) * Math.min(Math.abs(delta), lateralPerMs * step),
      };
      const hits = sweepLights(tunnel.lights, { distance, lateral }, next, step, attempt.collectedIds, collectionScale);
      const previous = attempt;
      attempt = reduceAttempt(attempt, { type: 'advance', elapsedMs: step, hits, attemptId: attempt.id });
      const portion = step ? Math.min(1, (attempt.activeTimeMs - previous.activeTimeMs) / step) : 0;
      distance += (next.distance - distance) * portion;
      lateral += (next.lateral - lateral) * portion;
      if (attempt.collectedIds.size > previous.collectedIds.size) {
        pickupMs = visualMs;
        sound.play(attempt.collectedIds.size);
      }
      if (attempt.phase === 'success') {
        returning = true;
        if (mode === 'story' && options.onStoryWin) restoration = options.onStoryWin(mission);
      } else if (!attempt.outcome && toEndMs - step < 1e-7) {
        distance = tunnel.length;
        attempt = reduceAttempt(attempt, { type: 'tunnel-finished' });
        returning = true;
      }
      remaining -= step * (attempt.phase === 'success' ? portion : 1);
    }
    if (direction) desiredLateral = lateral;
    if (returning) {
      controls.reset();
      if (remaining > 1e-7) advanceReturn(remaining);
    }
  }

  function advanceReturn(elapsedMs: number) {
    // A final hit can occur before the end. Coast along the same curve after success.
    const forwardPerMs = tunnel.speed / 1000;
    const coastMs = Math.min(elapsedMs, (tunnel.length - distance) / forwardPerMs);
    distance = Math.min(tunnel.length, distance + coastMs * forwardPerMs);
    phaseTime += elapsedMs - coastMs;
    if (phaseTime < exitMs - 1e-7) return;
    if (!attempt.outcome) {
      attempt = reduceAttempt(attempt, { type: 'exit-finished' });
      if (!tutorial && phaseTime > exitMs) {
        attempt = reduceAttempt(attempt, { type: 'advance', elapsedMs: phaseTime - exitMs });
      }
    }
    position = tunnel.exit;
    returning = false;
    returned = tutorial || attempt.outcome !== null;
    if (mode === 'story' && attempt.outcome?.kind === 'success') {
      world.transitionRestoration(restoration, visualMs / 1000);
    } else if (!attempt.outcome) {
      sound.cue('arrival');
    }
    phaseTime = 0;
    distance = 0;
  }

  function advanceTo(now: number) {
    const previous = lastFrame ?? now;
    const elapsedMs = Math.max(0, now - previous);
    lastFrame = Math.max(previous, now);
    if (attempt.paused || returnPaused) return;
    if (returned) {
      if (world.restoring) visualMs += elapsedMs;
      return;
    }
    if (returning) {
      visualMs += elapsedMs;
      advanceReturn(elapsedMs);
      return;
    }
    if (attempt.outcome) return;
    visualMs += elapsedMs;
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
      advanceTunnel(elapsedMs);
    }
  }

  function release(inside: boolean) {
    advanceTo(performance.now());
    if (attempt.phase !== 'explore' || attempt.paused || returned) return;
    const next = inside ? readyRoute() : undefined;
    if (next) {
      selectRoute(next);
      attempt = reduceAttempt(attempt, { type: 'enter-tunnel', tunnelId: tunnel.id });
      controls.reset();
    } else {
      feedbackUntil = attempt.activeTimeMs + 1500;
    }
    redraw();
  }

  function pause() {
    if (returned || (attempt.outcome && !returning)) return;
    advanceTo(performance.now());
    if (returning) returnPaused = true;
    else attempt = reduceAttempt(attempt, { type: 'pause' });
    controls.reset();
    redraw();
  }

  function togglePause() {
    if (returned || (attempt.outcome && !returning)) return;
    if (attempt.paused || returnPaused) {
      lastFrame = performance.now();
      attempt = reduceAttempt(attempt, { type: 'resume' });
      returnPaused = false;
      controls.reset();
      sound.enable();
      canvas.focus({ preventScroll: true });
      redraw();
    } else {
      pause();
    }
  }

  function action() {
    if (returning || (!attempt.outcome && !returned)) {
      togglePause();
    } else {
      const id = String(++run);
      attempt = attempt.outcome?.kind === 'failure'
        ? reduceAttempt(attempt, { type: 'retry', id })
        : createAttempt(mission, { mode, id, loadout: attempt.loadout });
      position = start;
      lastFrame = performance.now();
      feedbackUntil = 0;
      phaseTime = 0;
      distance = 0;
      lateral = 0;
      visualMs = 0;
      pickupMs = -Infinity;
      returned = false;
      recordedPractice = false;
      practiceBest = null;
      selectRoute(routes[0]!);
      controls.reset();
      canvas.focus({ preventScroll: true });
      redraw();
    }
  }

  function beginTunnel() {
    if (attempt.phase !== 'tunnel-ready' || attempt.paused) return;
    lastFrame = performance.now();
    attempt = reduceAttempt(attempt, { type: 'begin-tunnel' });
    sound.cue('start');
    redraw();
  }

  const controls = bindControls(canvas, {
    userGesture: sound.enable,
    phase() {
      if (attempt.paused || returning || returned) return 'inactive';
      if (attempt.phase === 'explore') return 'explore';
      return attempt.phase === 'tunnel-ready' || attempt.phase === 'tunnel-active' ? 'tunnel' : 'inactive';
    },
    point(clientX, clientY) {
      advanceTo(performance.now());
      if (attempt.paused || attempt.phase !== 'explore') return;
      const box = canvas.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) return;
      const anchor = world.pickGround((clientX - box.left) / box.width * 2 - 1, 1 - (clientY - box.top) / box.height * 2);
      if (anchor) moveTo(anchor);
      redraw();
    },
    steer(clientX, initial) {
      advanceTo(performance.now());
      if (returning || attempt.outcome) return;
      beginTunnel();
      if (initial) {
        pointerStartX = clientX;
        pointerStartLane = desiredLateral = lateral;
        return;
      }
      const lane = pointerStartLane + (clientX - pointerStartX) * sensitivity * tunnel.width / (Math.max(1, canvas.clientWidth) * .65);
      const laneLimit = tunnel.width / 2 - .43;
      desiredLateral = Math.max(-laneLimit, Math.min(laneLimit, lane));
    },
    beforeInput: () => advanceTo(performance.now()),
    beginTunnel,
    endSteer: () => { desiredLateral = lateral; },
    release, pause, togglePause,
  });

  function hint(ready: boolean) {
    if (attempt.paused || returnPaused) return t('gamePaused');
    if (tutorial && returned) return t('tutorialSummary', attempt.collectedIds.size, totalLights);
    const record = practiceBest === null ? '' : ' ' + t('bestEquipment', practiceBest);
    if (!returning && attempt.outcome?.kind === 'success') return t('reachedTarget') + record;
    if (!returning && attempt.outcome?.kind === 'failure') {
      const reason = t(attempt.outcome.reason === 'deadline' ? 'deadline' : 'unreachable');
      return reason + record;
    }
    if (mode === 'story' && returning && attempt.outcome?.kind === 'success') return t('formingElixir');
    if (returning) return t('returning');
    if (attempt.phase === 'drop') return t('dropping');
    if (attempt.phase === 'tunnel-ready') return t(tutorial ? 'tutorialReady' : 'tunnelReady');
    if (attempt.phase === 'tunnel-active') return t(tutorial ? 'tutorialSteer' : 'tunnelSteer');
    if (ready) return t('releaseCue');
    if (attempt.activeTimeMs < feedbackUntil) return t('invalidRelease');
    return t(tutorial ? 'tutorialExplore' : 'exploreHint');
  }

  function resultText() {
    if (returning) return '';
    if (tutorial) return returned ? t('tutorialComplete') : '';
    if (!attempt.outcome) return '';
    if (mode === 'practice') return t(attempt.outcome.kind === 'success' ? 'practiceComplete' : 'practiceFailed');
    return t(attempt.outcome.kind === 'success' ? 'missionComplete' : 'missionFailed');
  }

  return {
    scene: world.scene,
    get camera() { return travel.camera; },
    resize(nextAspect) {
      const next = canvas.getBoundingClientRect();
      if (viewport?.width === next.width && viewport.height === next.height &&
          viewport.left === next.left && viewport.top === next.top) return;
      if (viewport) advanceTo(performance.now());
      viewport = next;
      if (aspect !== nextAspect) {
        aspect = nextAspect;
        world.resize(aspect);
      }
      controls.rebase();
    },
    update(_elapsed, now) {
      if (now !== undefined) advanceTo(now);
      const readyId = attempt.phase === 'explore' && !returned ? readyRoute()?.tunnel.id ?? null : null;
      const ready = readyId !== null;
      const carryingElixir = mode === 'story' && returning && attempt.outcome?.kind === 'success';
      world.update({ position, ready, used: returned, readyId, consumedIds: attempt.consumedTunnelIds,
        elapsedSeconds: visualMs / 1000, reducedMotion, carryingElixir });
      const phase = returning ? 'exit' : returned ? 'explore' : attempt.phase;
      const pose = phase === 'drop' || phase === 'exit' ? phase
        : phase === 'tunnel-ready' ? 'ready'
        : phase === 'tunnel-active' || (phase === 'failure' && distance > 0) ? 'tunnel' : 'explore';
      travel.applyPose({
        phase: returning && distance < tunnel.length ? 'tunnel' : pose,
        position, distance, lateral, reducedMotion,
        progress: pose === 'drop' ? phaseTime / dropMs : pose === 'exit' ? phaseTime / exitMs : 0,
      });
      sparks.sync(attempt.collectedIds, visualMs / 1000, reducedMotion);
      if (attempt.outcome && attempt.outcome !== soundedOutcome) {
        soundedOutcome = attempt.outcome;
        sound.cue(attempt.outcome.kind);
      }
      const outcome = returning ? null : attempt.outcome;
      if (mode === 'practice' && outcome && !recordedPractice && options.onPracticeResult) {
        recordedPractice = true;
        practiceBest = options.onPracticeResult(mission, attempt.loadout, attempt.collectedIds.size);
      }
      showHud({
        phase, tutorial, paused: attempt.paused || returnPaused, ready,
        timeLeftMs: Math.max(0, mission.definition.timeLimitMs - attempt.activeTimeMs),
        lights: attempt.collectedIds.size, total: totalLights,
        target: tutorial ? null : mission.definition.targetLight,
        result: resultText(),
        failure: !tutorial && outcome?.kind === 'failure' ? outcome.reason : null,
        storyWon: mode === 'story' && outcome?.kind === 'success',
        collecting: visualMs - pickupMs < 230, hint: hint(ready),
        action: t(attempt.paused || returnPaused ? 'resume' : returned || (attempt.outcome && !returning) ? 'retry' : 'pause'),
      });
    },
    startClock() { lastFrame = performance.now(); },
    action,
    setReducedMotion(reduced) {
      reducedMotion = reduced;
      redraw();
    },
    dispose() {
      controls.dispose();
      sound.dispose();
      for (const track of routes) {
        track.sparks.dispose();
        track.travel.dispose();
      }
      world.dispose();
    },
  };
}
