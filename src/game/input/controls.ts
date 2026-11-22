export interface ControlCallbacks {
  phase(): 'explore' | 'tunnel' | 'inactive';
  point(clientX: number, clientY: number, initial: boolean): void;
  release(inside: boolean): void;
  steer(clientX: number, initial: boolean): void;
  beforeInput(): void;
  beginTunnel(): void;
  endSteer(): void;
  pause(): void;
  togglePause(): void;
}

export interface Controls {
  move(): { x: number; z: number };
  reset(): void;
  rebase(): void;
  dispose(): void;
}

const directions = new Set(['KeyA', 'KeyD', 'KeyW', 'KeyS', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);
const lateralKeys = new Set(['KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight']);

export function bindControls(canvas: HTMLCanvasElement, callbacks: ControlCallbacks): Controls {
  const controller = new AbortController();
  const listeners = { signal: controller.signal };
  const heldKeys = new Set<string>();
  let pointerId: number | null = null;
  let hoverId: number | null = null;

  function clearPointer() {
    const id = pointerId;
    pointerId = null;
    if (id !== null && canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
  }

  function reset() {
    heldKeys.clear();
    rebase();
  }

  function rebase() {
    clearPointer();
    hoverId = null;
    callbacks.endSteer();
  }

  function interrupt() {
    callbacks.beforeInput();
    reset();
    callbacks.pause();
  }

  function insidePlayfield(x: number, y: number) {
    const bounds = canvas.getBoundingClientRect();
    return x >= bounds.left && x < bounds.right && y >= bounds.top && y < bounds.bottom &&
      document.elementFromPoint(x, y) === canvas;
  }

  canvas.addEventListener('pointerdown', event => {
    const phase = callbacks.phase();
    if (phase === 'inactive' || pointerId !== null || !event.isPrimary || event.button !== 0) return;
    if (!insidePlayfield(event.clientX, event.clientY)) return;
    event.preventDefault();
    canvas.focus({ preventScroll: true });
    pointerId = event.pointerId;
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // A device can lose contact before capture. Window listeners still observe its release.
    }
    hoverId = null;
    if (phase === 'tunnel') callbacks.steer(event.clientX, true);
    else callbacks.point(event.clientX, event.clientY, true);
  }, listeners);

  window.addEventListener('pointermove', event => {
    const phase = callbacks.phase();
    if (event.pointerId === pointerId) {
      if (event.pointerType === 'mouse' && (event.buttons & 1) === 0) {
        callbacks.beforeInput();
        rebase();
        return;
      }
      event.preventDefault();
      if (phase === 'explore') callbacks.point(event.clientX, event.clientY, false);
      if (phase === 'tunnel') callbacks.steer(event.clientX, false);
      return;
    }
    if (phase !== 'tunnel' || pointerId !== null || event.pointerType !== 'mouse' ||
        event.buttons !== 0 || !insidePlayfield(event.clientX, event.clientY)) {
      if (hoverId === event.pointerId) {
        callbacks.beforeInput();
        hoverId = null;
        callbacks.endSteer();
      }
      return;
    }
    const initial = hoverId !== event.pointerId;
    hoverId = event.pointerId;
    callbacks.steer(event.clientX, initial);
  }, listeners);

  window.addEventListener('pointerup', event => {
    if (event.pointerId !== pointerId) return;
    const phase = callbacks.phase();
    clearPointer();
    if (phase === 'tunnel') {
      callbacks.beforeInput();
      callbacks.endSteer();
      return;
    }
    if (phase !== 'explore' || event.button !== 0) return;
    event.preventDefault();
    const inside = insidePlayfield(event.clientX, event.clientY);
    if (inside) callbacks.point(event.clientX, event.clientY, false);
    callbacks.release(inside);
  }, listeners);

  function losePointer(event: PointerEvent) {
    if (event.pointerId === pointerId) interrupt();
  }
  window.addEventListener('pointercancel', losePointer, listeners);
  canvas.addEventListener('lostpointercapture', losePointer, listeners);
  window.addEventListener('blur', interrupt, listeners);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) interrupt();
  }, listeners);

  function gameHasKeyboardFocus() {
    const focus = document.activeElement;
    return focus === canvas || focus === document.body || focus === document.documentElement || focus === null;
  }

  window.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.code === 'Escape') {
      event.preventDefault();
      if (!event.repeat) callbacks.togglePause();
      return;
    }
    const phase = callbacks.phase();
    if (phase === 'inactive' || !gameHasKeyboardFocus()) return;
    if ((phase === 'tunnel' ? lateralKeys : directions).has(event.code)) {
      event.preventDefault();
      if (!event.repeat) {
        callbacks.beforeInput();
        if (phase === 'tunnel') callbacks.beginTunnel();
        heldKeys.add(event.code);
      }
    } else if (phase === 'explore' && (event.code === 'Space' || event.code === 'Enter' || event.code === 'NumpadEnter')) {
      event.preventDefault();
      if (!event.repeat) callbacks.release(true);
    }
  }, listeners);
  window.addEventListener('keyup', event => {
    if (heldKeys.has(event.code)) callbacks.beforeInput();
    heldKeys.delete(event.code);
  }, listeners);
  document.addEventListener('focusin', () => {
    if (heldKeys.size && !gameHasKeyboardFocus()) {
      callbacks.beforeInput();
      heldKeys.clear();
    }
  }, listeners);

  function move() {
    const phase = callbacks.phase();
    if (phase === 'inactive') return { x: 0, z: 0 };
    const x = Number(heldKeys.has('KeyD') || heldKeys.has('ArrowRight')) -
      Number(heldKeys.has('KeyA') || heldKeys.has('ArrowLeft'));
    if (phase === 'tunnel') return { x, z: 0 };
    const z = Number(heldKeys.has('KeyS') || heldKeys.has('ArrowDown')) -
      Number(heldKeys.has('KeyW') || heldKeys.has('ArrowUp'));
    const length = Math.hypot(x, z) || 1;
    return { x: x / length, z: z / length };
  }

  return {
    move,
    reset,
    // A gesture in the old coordinate system must finish before the next press can release.
    rebase,
    dispose() {
      controller.abort();
      reset();
    },
  };
}
