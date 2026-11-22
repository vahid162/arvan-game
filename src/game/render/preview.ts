import { WebGLRenderer, type Camera, type Scene } from 'three';
import { createGlade } from './scene';
import { viewportSize } from './viewport';

export interface Preview {
  setPaused(paused: boolean): void;
  show(view: View): void;
  redraw(): void;
  dispose(): void;
}

export interface View {
  scene: Scene;
  camera: Camera;
  resize(aspect: number): void;
  update(elapsedSeconds: number, now?: number): void;
  dispose(): void;
}

export function createPreview(
  canvas: HTMLCanvasElement,
  context: WebGL2RenderingContext,
  onError: () => void,
): Preview {
  const renderer = new WebGLRenderer({ canvas, context });
  let view: View = createGlade();
  let paused = true;
  let frameId = 0;
  let previousTime: number | undefined;
  let elapsedSeconds = 0;

  function draw(now?: number) {
    view.update(elapsedSeconds, now);
    renderer.render(view.scene, view.camera);
  }

  function resize() {
    const { width, height, aspect, pixelRatio } = viewportSize(
      canvas.clientWidth, canvas.clientHeight, window.devicePixelRatio,
    );
    renderer.setDrawingBufferSize(width, height, pixelRatio);
    view.resize(aspect);
    draw();
  }

  function animate(now: number) {
    if (previousTime !== undefined) elapsedSeconds += (now - previousTime) / 1000;
    previousTime = now;
    try {
      draw(now);
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
    view.dispose();
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
    show(nextView) {
      view.dispose();
      view = nextView;
      resize();
    },
    redraw() {
      try {
        draw();
      } catch {
        onError();
      }
    },
    setPaused(value) {
      paused = value;
      syncMotion();
    },
    dispose,
  };

}
