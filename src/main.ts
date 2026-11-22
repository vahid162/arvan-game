import type { Preview } from './game/render/preview';
import type { GameHud, GameView } from './game/play';

const shell = document.querySelector<HTMLElement>('#shell')!;
const canvas = document.querySelector<HTMLCanvasElement>('#glade')!;
const statusMessage = document.querySelector<HTMLElement>('#status')!;
const motion = document.querySelector<HTMLButtonElement>('#motion')!;
const motionLabel = document.querySelector<HTMLElement>('#motion-label')!;
const play = document.querySelector<HTMLButtonElement>('#play')!;
const gameAction = document.querySelector<HTMLButtonElement>('#game-action')!;
const gamePanel = document.querySelector<HTMLElement>('#game')!;
const gameClock = document.querySelector<HTMLElement>('#game-clock')!;
const gameScore = document.querySelector<HTMLElement>('#game-score')!;
const gameHint = document.querySelector<HTMLElement>('#game-hint')!;
const sceneTitle = document.querySelector<HTMLElement>('#scene-title')!;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

let preview: Preview | undefined;
let game: GameView | undefined;
let cancelled = false;

function showFailure(message: string) {
  shell.dataset.state = 'failed';
  statusMessage.textContent = message;
  motion.hidden = true;
  play.hidden = true;
  gameAction.hidden = true;
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
  setText(gameHint, hud.hint);
  setText(gameAction, hud.action);
  const underground = hud.phase.startsWith('tunnel');
  setText(sceneTitle, underground ? 'Under the forest' : 'Forest clearing');
  const playfield = underground ? 'Tunnel playfield' : 'Forest playfield';
  if (canvas.getAttribute('aria-label') !== playfield) canvas.setAttribute('aria-label', playfield);
}

play.onclick = async () => {
  play.disabled = true;
  try {
    const { createGame } = await import('./game/play');
    if (!preview) return;
    game = createGame(canvas, reducedMotion.matches, showHud, () => preview?.redraw());
    gamePanel.hidden = false;
    gameAction.hidden = false;
    play.hidden = true;
    motion.hidden = true;
    shell.dataset.playing = 'true';
    canvas.tabIndex = 0;
    canvas.focus({ preventScroll: true });
    preview.show(game);
  } catch {
    showFailure('The clearing could not start. Reload the preview to try again.');
  }
};
gameAction.onclick = () => game?.action();

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
  } catch {
    showFailure('The scene could not start. Check your connection and reload the preview.');
  }
}

void start();
