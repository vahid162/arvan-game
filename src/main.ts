import type { Preview } from './game/render/preview';

const shell = document.querySelector<HTMLElement>('#shell')!;
const canvas = document.querySelector<HTMLCanvasElement>('#glade')!;
const statusMessage = document.querySelector<HTMLElement>('#status')!;
const motion = document.querySelector<HTMLButtonElement>('#motion')!;
const motionLabel = document.querySelector<HTMLElement>('#motion-label')!;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

let preview: Preview | undefined;
let cancelled = false;

function showFailure(message: string) {
  shell.dataset.state = 'failed';
  statusMessage.textContent = message;
  motion.hidden = true;
  cancelled = true;
  preview?.dispose();
  preview = undefined;
}

function setPaused(paused: boolean) {
  preview?.setPaused(paused);
  motion.dataset.paused = String(paused);
  motionLabel.textContent = paused ? 'Resume motion' : 'Pause motion';
}

motion.onclick = () => setPaused(motion.dataset.paused !== 'true');
reducedMotion.onchange = () => {
  if (reducedMotion.matches) setPaused(true);
};
canvas.addEventListener('webglcontextlost', () => {
  showFailure('The graphics connection was interrupted. Reload to return to the clearing.');
});

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
  } catch {
    showFailure('The scene could not start. Check your connection and reload the preview.');
  }
}

void start();
