import type { Preview } from './game/render/preview';
import type { GameHud, GameView } from './game/play';
import type { GeneratedMission } from './game/core/types';
import { FOREST } from './game/content/fixtures';
import { defaultCampaignSeed, generateMission } from './game/content/generation';

const shell = document.querySelector<HTMLElement>('#shell')!;
const canvas = document.querySelector<HTMLCanvasElement>('#glade')!;
const statusMessage = document.querySelector<HTMLElement>('#status')!;
const motion = document.querySelector<HTMLButtonElement>('#motion')!;
const motionLabel = document.querySelector<HTMLElement>('#motion-label')!;
const play = document.querySelector<HTMLButtonElement>('#play')!;
const story = document.querySelector<HTMLButtonElement>('#story')!;
const briefing = document.querySelector<HTMLElement>('#briefing')!;
const briefTitle = document.querySelector<HTMLElement>('#brief-title')!;
const briefDetail = document.querySelector<HTMLElement>('#brief-detail')!;
const missionStart = document.querySelector<HTMLButtonElement>('#mission-start')!;
const briefBack = document.querySelector<HTMLButtonElement>('#brief-back')!;
const missionTarget = document.querySelector<HTMLElement>('#mission-target')!;
const missionResult = document.querySelector<HTMLElement>('#mission-result')!;
const gameAction = document.querySelector<HTMLButtonElement>('#game-action')!;
const gameMenu = document.querySelector<HTMLButtonElement>('#game-menu')!;
const gamePanel = document.querySelector<HTMLElement>('#game')!;
const gameClock = document.querySelector<HTMLElement>('#game-clock')!;
const gameScore = document.querySelector<HTMLElement>('#game-score')!;
const gameHint = document.querySelector<HTMLElement>('#game-hint')!;
const sceneTitle = document.querySelector<HTMLElement>('#scene-title')!;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

let preview: Preview | undefined;
let game: GameView | undefined;
let cancelled = false;
let campaignStep = 0;
let activeMission: GeneratedMission | undefined;
let offeredMission: GeneratedMission | undefined;
let storyWon = false;
const missionIndices = [0, 1, 2] as const;

function showFailure(message: string) {
  shell.dataset.state = 'failed';
  statusMessage.textContent = message;
  motion.hidden = true;
  play.hidden = true;
  story.hidden = true;
  briefing.hidden = true;
  gameAction.hidden = true;
  gameMenu.hidden = true;
  gamePanel.hidden = true;
  cancelled = true;
  preview?.dispose();
  preview = undefined;
  game = undefined;
}

function setPaused(paused: boolean) {
  preview?.setPaused(paused);
  motion.dataset.paused = String(paused);
  motionLabel.textContent = paused ? 'Resume motion' : 'Pause motion';
}

motion.onclick = () => setPaused(motion.dataset.paused !== 'true');
reducedMotion.onchange = () => {
  if (game) game.setReducedMotion(reducedMotion.matches);
  else if (reducedMotion.matches) setPaused(true);
};
canvas.addEventListener('webglcontextlost', () => {
  showFailure('The graphics connection was interrupted. Reload to return to the clearing.');
});

function setText(element: HTMLElement, value: string) {
  if (element.textContent !== value) element.textContent = value;
}

function showHud(hud: GameHud) {
  storyWon = hud.storyWon;
  if (storyWon && activeMission?.definition.id === FOREST.missionIds[campaignStep]) campaignStep++;
  gamePanel.dataset.phase = hud.phase;
  gamePanel.dataset.ready = String(hud.ready);
  if (gamePanel.dataset.paused !== String(hud.paused)) {
    gamePanel.dataset.paused = String(hud.paused);
    preview?.setPaused(hud.paused);
  }
  gameClock.dataset.ms = String(Math.round(hud.timeLeftMs));
  const seconds = Math.ceil(hud.timeLeftMs / 1000);
  setText(gameClock, `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`);
  setText(gameScore, `${hud.lights} / ${hud.total} lights`);
  gameScore.dataset.collecting = String(hud.collecting);
  missionTarget.hidden = hud.target === null;
  if (hud.target !== null) setText(missionTarget, `Target ${hud.target}`);
  missionResult.hidden = !hud.result;
  gameMenu.hidden = !hud.result;
  setText(missionResult, hud.result);
  setText(gameHint, hud.hint);
  setText(gameAction, storyWon ? (campaignStep < missionIndices.length ? 'Next mission' : 'Back to clearing') : hud.action);
  const underground = hud.phase.startsWith('tunnel');
  setText(sceneTitle, underground ? 'Under the forest' : 'Forest clearing');
  const playfield = underground ? 'Tunnel playfield' : 'Forest playfield';
  if (canvas.getAttribute('aria-label') !== playfield) canvas.setAttribute('aria-label', playfield);
}

async function startGame(mission?: GeneratedMission) {
  play.disabled = true;
  missionStart.disabled = true;
  try {
    const { createGame } = await import('./game/play');
    if (!preview) return;
    activeMission = mission;
    game = createGame(canvas, reducedMotion.matches, showHud, () => preview?.redraw(), { mission });
    delete gamePanel.dataset.paused;
    gamePanel.hidden = false;
    gameAction.hidden = false;
    play.hidden = true;
    story.hidden = true;
    briefing.hidden = true;
    motion.hidden = true;
    shell.dataset.playing = 'true';
    canvas.tabIndex = 0;
    canvas.focus({ preventScroll: true });
    preview.show(game);
    game.startClock();
  } catch {
    showFailure('The clearing could not start. Reload the preview to try again.');
  }
}
play.onclick = () => void startGame();
function openStoryBriefing() {
  const index = missionIndices[campaignStep];
  offeredMission = index === undefined ? undefined : generateMission(index, defaultCampaignSeed(index));
  briefing.hidden = false;
  missionStart.hidden = !offeredMission;
  if (offeredMission) {
    setText(briefTitle, `Mission ${index! + 1} of 3`);
    setText(briefDetail, `Collect ${offeredMission.definition.targetLight} of 36 lights across three tunnels. You have 90 seconds of active time.`);
    missionStart.focus();
  } else {
    setText(briefTitle, 'Forest missions complete');
    setText(briefDetail, 'You completed all three missions in this session.');
    briefBack.focus();
  }
}
story.onclick = openStoryBriefing;
briefBack.onclick = () => {
  briefing.hidden = true;
  story.focus();
};
missionStart.onclick = () => {
  if (offeredMission) void startGame(offeredMission);
};
gameAction.onclick = () => {
  if (!storyWon) {
    game?.action();
    return;
  }
  showMenu();
  if (campaignStep < missionIndices.length) openStoryBriefing();
};
function showMenu() {
  if (!preview) return;
  game = undefined;
  activeMission = undefined;
  storyWon = false;
  gamePanel.hidden = true;
  gameAction.hidden = true;
  gameMenu.hidden = true;
  delete shell.dataset.playing;
  canvas.removeAttribute('tabindex');
  canvas.setAttribute('aria-label', 'A golden firefly hovering among reeds in a blue-green clearing');
  setText(sceneTitle, 'Forest clearing');
  play.disabled = false;
  missionStart.disabled = false;
  play.hidden = false;
  story.hidden = false;
  motion.hidden = false;
  preview.showIntro();
  setPaused(reducedMotion.matches);
  story.focus();
}
gameMenu.onclick = showMenu;

async function start() {
  try {
    const context = canvas.getContext('webgl2', { alpha: false, antialias: true });
    if (!context) {
      shell.dataset.state = 'unsupported';
      statusMessage.textContent = 'This preview needs WebGL 2. Enable hardware acceleration or open it in a browser that supports WebGL 2.';
      return;
    }
    const { createPreview } = await import('./game/render/preview');
    if (cancelled) return;
    preview = createPreview(canvas, context, () => showFailure('The scene stopped rendering. Reload to try again.'));
    setPaused(reducedMotion.matches);
    shell.dataset.state = 'ready';
    statusMessage.textContent = 'Forest clearing ready.';
    motion.hidden = false;
    play.hidden = false;
    story.hidden = false;
  } catch {
    showFailure('The scene could not start. Check your connection and reload the preview.');
  }
}

void start();
