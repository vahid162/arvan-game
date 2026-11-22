export interface ControlCallbacks {
  phase(): 'explore' | 'inactive';
  point(clientX: number, clientY: number, initial: boolean): void;
  release(inside: boolean): void;
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

export function bindControls(canvas: HTMLCanvasElement, callbacks: ControlCallbacks): Controls {
  const controller = new AbortController();
  const listeners = { signal: controller.signal };
  const heldKeys = new Set<string>();
  let pointerId: number | null = null;

  function clearPointer() {
    const id = pointerId;
    pointerId = null;
    if (id !== null && canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
  }

  function reset() {
    heldKeys.clear();
    clearPointer();
  }

  function interrupt() {
    reset();
    callbacks.pause();
  }

  function insidePlayfield(x: number, y: number) {
    const bounds = canvas.getBoundingClientRect();
    return x >= bounds.left && x < bounds.right && y >= bounds.top && y < bounds.bottom &&
      document.elementFromPoint(x, y) === canvas;
  }

  canvas.addEventListener('pointerdown', event => {
    if (callbacks.phase() !== 'explore' || pointerId !== null || !event.isPrimary || event.button !== 0) return;
    if (!insidePlayfield(event.clientX, event.clientY)) return;
    event.preventDefault();
    canvas.focus({ preventScroll: true });
    pointerId = event.pointerId;
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // A device can lose contact before capture. Window listeners still observe its release.
    }
    callbacks.point(event.clientX, event.clientY, true);
  }, listeners);

  window.addEventListener('pointermove', event => {
    if (event.pointerId !== pointerId || callbacks.phase() !== 'explore') return;
    if (event.pointerType === 'mouse' && (event.buttons & 1) === 0) {
      clearPointer();
      return;
    }
    event.preventDefault();
    callbacks.point(event.clientX, event.clientY, false);
  }, listeners);

  window.addEventListener('pointerup', event => {
    if (event.pointerId !== pointerId) return;
    clearPointer();
    if (callbacks.phase() !== 'explore' || event.button !== 0) return;
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
    if (callbacks.phase() !== 'explore' || !gameHasKeyboardFocus()) return;
    if (directions.has(event.code)) {
      event.preventDefault();
      if (!event.repeat) heldKeys.add(event.code);
    } else if (event.code === 'Space' || event.code === 'Enter' || event.code === 'NumpadEnter') {
      event.preventDefault();
      if (!event.repeat) callbacks.release(true);
    }
  }, listeners);
  window.addEventListener('keyup', event => heldKeys.delete(event.code), listeners);
  document.addEventListener('focusin', () => {
    if (!gameHasKeyboardFocus()) heldKeys.clear();
  }, listeners);

  function move() {
    if (callbacks.phase() !== 'explore') return { x: 0, z: 0 };
    const x = Number(heldKeys.has('KeyD') || heldKeys.has('ArrowRight')) -
      Number(heldKeys.has('KeyA') || heldKeys.has('ArrowLeft'));
    const z = Number(heldKeys.has('KeyS') || heldKeys.has('ArrowDown')) -
      Number(heldKeys.has('KeyW') || heldKeys.has('ArrowUp'));
    const length = Math.hypot(x, z) || 1;
    return { x: x / length, z: z / length };
  }

  return {
    move,
    reset,
    // A gesture in the old coordinate system must finish before the next press can release.
    rebase: clearPointer,
    dispose() {
      controller.abort();
      reset();
    },
  };
}
