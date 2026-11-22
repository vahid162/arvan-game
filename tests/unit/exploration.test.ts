import { Group, Mesh, MeshBasicMaterial, RingGeometry, ShaderMaterial } from 'three';
import { expect, it, onTestFinished } from 'vitest';
import { createExplorationWorld } from '../../src/game/render/exploration';

const entry = { x: 1.45, z: -1.4, radius: 0.49 };
const bounds = { halfWidth: 3.7, halfDepth: 3.8 };

it.each([
  { entranceDiscoveryRadius: undefined, lightRadiusScale: undefined, reach: 1.86 },
  { entranceDiscoveryRadius: undefined, lightRadiusScale: 1.1, reach: 2.046 },
  { entranceDiscoveryRadius: 1.58, lightRadiusScale: undefined, reach: 1.58 },
  { entranceDiscoveryRadius: 1.58, lightRadiusScale: 1.1, reach: 1.738 },
])('reveals the entrance within $reach world units', ({ entranceDiscoveryRadius, lightRadiusScale, reach }) => {
  const world = createExplorationWorld({ entry, bounds, lightRadiusScale, entranceDiscoveryRadius });
  onTestFinished(() => world.dispose());
  const entrance = world.scene.children.find(child =>
    child instanceof Group && child.position.x === entry.x && child.position.z === entry.z)!;
  const rim = entrance.children.find((child): child is Mesh<RingGeometry, MeshBasicMaterial> =>
    child instanceof Mesh && child.geometry instanceof RingGeometry && child.material instanceof MeshBasicMaterial)!;
  const ground = world.scene.children.find((child): child is Mesh =>
    child instanceof Mesh && child.material instanceof ShaderMaterial)!;
  const radii = (ground.material as ShaderMaterial).uniforms.poolRadii!.value;
  expect(radii.x).toBeCloseTo(0.06 * (lightRadiusScale ?? 1), 10);
  expect(radii.y).toBeCloseTo(1.86 * (lightRadiusScale ?? 1), 10);
  function visibleFrom(distance: number) {
    world.update({ position: { x: entry.x - distance, z: entry.z }, elapsedSeconds: 0, reducedMotion: true });
    return entrance.visible;
  }
  expect(visibleFrom(0.75 * (lightRadiusScale ?? 1))).toBe(true);
  expect(rim.material.opacity).toBeCloseTo(1, 10);
  expect(visibleFrom(1.65)).toBe(reach > 1.65);
  expect(visibleFrom(1.95)).toBe(reach > 1.95);
  expect(visibleFrom(reach - 0.001)).toBe(true);
  expect(visibleFrom(reach + 0.001)).toBe(false);
  expect(world.apertureRadius).toBe(entry.radius);
});
