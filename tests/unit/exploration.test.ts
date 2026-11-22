import { Group, Mesh, ShaderMaterial } from 'three';
import { expect, it, onTestFinished } from 'vitest';
import { createExplorationWorld } from '../../src/game/render/exploration';

const entry = { x: 1.45, z: -1.4, radius: 0.49 };
const bounds = { halfWidth: 3.7, halfDepth: 3.8 };

it.each([
  { lightRadiusScale: undefined, reach: 1.86, seesDistantEntrance: false },
  { lightRadiusScale: 1.1, reach: 2.046, seesDistantEntrance: true },
])('scales the exploration pool and entrance reveal to $reach ground units', ({ lightRadiusScale, reach, seesDistantEntrance }) => {
  const world = createExplorationWorld({ entry, bounds, lightRadiusScale });
  onTestFinished(() => world.dispose());
  const entrance = world.scene.children.find(child =>
    child instanceof Group && child.position.x === entry.x && child.position.z === entry.z)!;
  const ground = world.scene.children.find((child): child is Mesh =>
    child instanceof Mesh && child.material instanceof ShaderMaterial)!;
  const radii = (ground.material as ShaderMaterial).uniforms.poolRadii!.value;
  expect(radii.x).toBeCloseTo(0.06 * (lightRadiusScale ?? 1), 10);
  expect(radii.y).toBeCloseTo(reach, 10);
  function visibleFrom(distance: number) {
    world.update({ position: { x: entry.x - distance, z: entry.z }, elapsedSeconds: 0, reducedMotion: true });
    return entrance.visible;
  }
  expect(visibleFrom(1.95)).toBe(seesDistantEntrance);
  expect(visibleFrom(reach - 0.001)).toBe(true);
  expect(visibleFrom(reach + 0.001)).toBe(false);
  expect(world.apertureRadius).toBe(entry.radius);
});
