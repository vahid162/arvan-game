import { WebGLRenderer } from 'three';
import { createGlade } from './scene';
import { viewportSize } from './viewport';

export interface Preview {
  setPaused(paused: boolean): void;
  dispose(): void;
}

export function createPreview(
  canvas: HTMLCanvasElement,
  context: WebGL2RenderingContext,
  onError: () => void,
): Preview {
  const renderer = new WebGLRenderer({ canvas, context });
  const glade = createGlade();
  let paused = true;
  let frameId = 0;
  let previousTime: number | undefined;
  let elapsedSeconds = 0;

  function draw() {
    glade.update(elapsedSeconds);
    renderer.render(glade.scene, glade.camera);
  }

  function resize() {
    const { width, height, aspect, pixelRatio } = viewportSize(
      canvas.clientWidth, canvas.clientHeight, window.devicePixelRatio,
    );
    renderer.setDrawingBufferSize(width, height, pixelRatio);
    glade.resize(aspect);
    draw();
  }

  function animate(now: number) {
    if (previousTime !== undefined) elapsedSeconds += (now - previousTime) / 1000;
    previousTime = now;
    try {
      draw();
      frameId = requestAnimationFrame(animate);
    } catch {
      onError();
    }
  }

  function syncMotion() {
    cancelAnimationFrame(frameId);
    previousTime = undefined;
    if (!paused && !document.hidden) frameId = requestAnimationFrame(animate);
  }

  function onResize() {
    try {
      resize();
    } catch {
      onError();
    }
  }

  const observer = new ResizeObserver(onResize);
  function dispose() {
    cancelAnimationFrame(frameId);
    observer.disconnect();
    window.removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', syncMotion);
    glade.dispose();
    renderer.dispose();
  }

  try {
    resize();
    observer.observe(canvas);
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', syncMotion);
  } catch (error) {
    dispose();
    throw error;
  }

  return {
    setPaused(value) {
      paused = value;
      syncMotion();
    },
    dispose,
  };
}
