import { Camera, Scene } from 'three';
import { afterEach, expect, it, vi } from 'vitest';
import { createPreview, type View } from '../../src/game/render/preview';

const renderer = vi.hoisted(() => ({ render: vi.fn(), setDrawingBufferSize: vi.fn(), dispose: vi.fn() }));
vi.mock('three', async importOriginal => ({
  ...await importOriginal<typeof import('three')>(),
  WebGLRenderer: class {
    render = renderer.render;
    setDrawingBufferSize = renderer.setDrawingBufferSize;
    dispose = renderer.dispose;
  },
}));
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

function setup() {
  const frames = new Map<number, FrameRequestCallback>();
  let nextId = 0;
  vi.stubGlobal('requestAnimationFrame', (frame: FrameRequestCallback) => { frames.set(++nextId, frame); return nextId; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  const win = Object.assign(new EventTarget(), { devicePixelRatio: 2 });
  const doc = Object.assign(new EventTarget(), { hidden: false });
  vi.stubGlobal('window', win);
  vi.stubGlobal('document', doc);
  const disconnect = vi.fn();
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect = disconnect; });
  const canvas = { clientWidth: 390, clientHeight: 600 };
  const preview = createPreview(canvas as HTMLCanvasElement, {} as WebGL2RenderingContext, vi.fn());
  function advance() {
    const batch = [...frames.values()];
    frames.clear();
    for (const frame of batch) frame(16);
  }
  const view: View = { scene: new Scene(), camera: new Camera(), update: vi.fn(), resize: vi.fn(), dispose: vi.fn() };
  return { preview, advance, frames, canvas, win, doc, view, disconnect };
}

it('a pause or disposal from inside a frame stops scheduling immediately', () => {
  const { preview, advance, frames, doc, view, disconnect } = setup();
  view.update = (_seconds, now) => { if (now !== undefined) preview.setPaused(true); };
  preview.show(view);
  preview.setPaused(false);
  preview.setPaused(false);
  expect(frames.size).toBe(1);
  advance();
  expect(frames.size).toBe(0);
  preview.setPaused(false);
  doc.hidden = true;
  doc.dispatchEvent(new Event('visibilitychange'));
  expect(frames.size).toBe(0);
  doc.hidden = false;
  doc.dispatchEvent(new Event('visibilitychange'));
  expect(frames.size).toBe(1);
  view.update = () => preview.dispose();
  renderer.render.mockClear();
  advance();
  expect(frames.size).toBe(0);
  expect(renderer.render).not.toHaveBeenCalled();
  preview.dispose();
  expect(disconnect).toHaveBeenCalledOnce();
  expect(view.dispose).toHaveBeenCalledOnce();
  expect(renderer.dispose).toHaveBeenCalledOnce();
});

it('reuses the drawing buffer on duplicate resizes and draws a newly installed view', () => {
  const { preview, canvas, win, view } = setup();
  expect(renderer.setDrawingBufferSize).toHaveBeenCalledTimes(1);
  preview.show(view);
  expect(view.update).toHaveBeenCalledOnce();
  win.dispatchEvent(new Event('resize'));
  expect(renderer.setDrawingBufferSize).toHaveBeenCalledTimes(1);
  expect(view.update).toHaveBeenCalledOnce();
  canvas.clientWidth = 600;
  win.dispatchEvent(new Event('resize'));
  expect(renderer.setDrawingBufferSize).toHaveBeenLastCalledWith(600, 600, 2);
  expect(view.resize).toHaveBeenLastCalledWith(1);
  expect(view.update).toHaveBeenCalledTimes(2);
  preview.dispose();
  canvas.clientWidth = 320;
  win.dispatchEvent(new Event('resize'));
  expect(renderer.setDrawingBufferSize).toHaveBeenCalledTimes(2);
});
