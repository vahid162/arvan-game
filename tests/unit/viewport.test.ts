import { describe, expect, it } from 'vitest';
import { viewportSize } from '../../src/game/render/viewport';

describe('scene viewport', () => {
  it('caps drawing density without changing portrait framing', () => {
    expect(viewportSize(390, 600, 3)).toEqual({
      width: 390, height: 600, aspect: 0.65, pixelRatio: 2,
    });
  });

  it('preserves fractional screen density after resizing to landscape', () => {
    expect(viewportSize(600, 300, 1.25)).toEqual({
      width: 600, height: 300, aspect: 2, pixelRatio: 1.25,
    });
  });

  it('avoids an invalid projection during a zero-sized layout', () => {
    expect(viewportSize(0, 0, NaN)).toEqual({
      width: 1, height: 1, aspect: 1, pixelRatio: 1,
    });
  });
});
