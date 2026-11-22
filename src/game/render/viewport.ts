export const MAX_PIXEL_RATIO = 2;

/** Three.js needs non-zero CSS dimensions even during transient layout changes. */
export function viewportSize(width: number, height: number, devicePixelRatio: number) {
  const cssWidth = Math.max(1, Math.round(width));
  const cssHeight = Math.max(1, Math.round(height));
  const pixelRatio = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0
    ? Math.min(devicePixelRatio, MAX_PIXEL_RATIO)
    : 1;
  return { width: cssWidth, height: cssHeight, aspect: cssWidth / cssHeight, pixelRatio };
}
