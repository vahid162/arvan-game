import { WebGLRenderer, type Camera, type Scene } from 'three';
import { createGlade } from './scene';
import { createExplorationWorld } from './exploration';
import { P07_MISSION } from '../content/fixtures';
import { viewportSize } from './viewport';

export interface Preview {
  setPaused(paused: boolean): void;
  show(view: View): void;
  showIntro(): void;
  showForest(level: number): void;
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
  let disposed = false;
  let frameId: number | undefined;
  let previousTime: number | undefined;
  let elapsedSeconds = 0;
  let bufferWidth = 0, bufferHeight = 0, bufferRatio = 0;

  function draw(now?: number) {
    if (disposed) return;
    const current = view;
    current.update(elapsedSeconds, now);
    if (!disposed && current === view) renderer.render(current.scene, current.camera);
  }

  function resize(newView = false) {
    if (disposed) return;
    const { width, height, aspect, pixelRatio } = viewportSize(
      canvas.clientWidth, canvas.clientHeight, window.devicePixelRatio,
    );
    const changed = width !== bufferWidth || height !== bufferHeight || pixelRatio !== bufferRatio;
    if (changed) {
      renderer.setDrawingBufferSize(width, height, pixelRatio);
      bufferWidth = width;
      bufferHeight = height;
      bufferRatio = pixelRatio;
    }
    view.resize(aspect);
    if (changed || newView) draw();
  }

  function requestFrame() {
    if (frameId === undefined && !disposed && !paused && !document.hidden) {
      frameId = requestAnimationFrame(animate);
    }
  }

  function animate(now: number) {
    frameId = undefined;
    if (disposed || paused || document.hidden) return;
    if (previousTime !== undefined) elapsedSeconds += (now - previousTime) / 1000;
    previousTime = now;
    try {
      draw(now);
      requestFrame();
    } catch {
      onError();
    }
  }

  function syncMotion() {
    if (frameId !== undefined) cancelAnimationFrame(frameId);
    frameId = undefined;
    previousTime = undefined;
    requestFrame();
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
    if (disposed) return;
    disposed = true;
    syncMotion();
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
      if (disposed) {
        nextView.dispose();
        return;
      }
      view.dispose();
      view = nextView;
      resize(true);
    },
    showIntro() {
      this.show(createGlade());
    },
    showForest(level) {
      const entries = P07_MISSION.tunnels.map(tunnel => ({ ...tunnel.entry, id: tunnel.id, radius: .49 }));
      const world = createExplorationWorld({
        entry: entries[0]!, entries, bounds: { halfWidth: 3.7, halfDepth: 3.8 }, story: true,
      });
      world.setRestoration(level);
      this.show({
        ...world,
        update: elapsedSeconds => world.update({
          position: { x: -1.45, z: 1.35 }, ready: false, used: false, elapsedSeconds, reducedMotion: false,
        }),
      });
    },
    redraw() {
      try {
        draw();
      } catch {
        onError();
      }
    },
    setPaused(value) {
      if (paused === value) return;
      paused = value;
      syncMotion();
    },
    dispose,
  };

}
