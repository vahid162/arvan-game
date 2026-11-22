import { expect, it, onTestFinished } from 'vitest';
import { Raycaster, Vector3, type PerspectiveCamera } from 'three';
import { FOREST_MISSIONS, P07_MISSION } from '../../src/game/content/fixtures';
import { createExplorationWorld } from '../../src/game/render/exploration';
import { createTunnelView } from '../../src/game/render/tunnel';

const tunnel = FOREST_MISSIONS[0].tunnels[0]!;
const worldUp = new Vector3(0, 1, 0);

function cameraPose(camera: PerspectiveCamera) {
  return { eye: camera.position.clone(), rotation: camera.quaternion.clone(), fov: camera.fov, aspect: camera.aspect };
}

function expectSameCamera(actual: ReturnType<typeof cameraPose>, expected: ReturnType<typeof cameraPose>) {
  expect(actual.eye.distanceTo(expected.eye)).toBeLessThan(1e-6);
  expect(actual.rotation.angleTo(expected.rotation)).toBeLessThan(1e-6);
  expect(actual.fov).toBeCloseTo(expected.fov, 6);
  expect(actual.aspect).toBeCloseTo(expected.aspect, 6);
}

function setup(aspect = 1, instance = tunnel) {
  const release = { x: instance.entry.x + 0.2, z: instance.entry.z - 0.1 };
  const world = createExplorationWorld({
    entry: { ...instance.entry, radius: 0.49 },
    bounds: { halfWidth: 3.7, halfDepth: 3.8 },
  });
  world.resize(aspect);
  const view = createTunnelView(world, instance);
  onTestFinished(() => { view.dispose(); world.dispose(); });

  function pose(phase: Parameters<typeof view.applyPose>[0]['phase'], progress: number, distance: number, lateral = 0) {
    // The controller retains the player's release position until exit-finished.
    const position = release;
    world.update({ position, ready: false, used: false, elapsedSeconds: 0, reducedMotion: true });
    view.applyPose({ phase, progress, distance, lateral, position, reducedMotion: true });
    return { camera: cameraPose(view.camera), fly: world.firefly.position.clone() };
  }
  return { world, view, pose, release };
}

it.each([390 / 844, 900 / 500])('joins the exploration and chase poses without a jump at aspect %f', aspect => {
  const { world, pose, release } = setup(aspect);
  const explorationCamera = cameraPose(world.camera);
  const start = pose('drop', 0, 0);
  expectSameCamera(start.camera, explorationCamera);
  expect(start.fly.x).toBeCloseTo(release.x, 6);
  expect(start.fly.z).toBeCloseTo(release.z, 6);
  expect(start.fly.y).toBeGreaterThan(0);

  const dropped = pose('drop', 1, 0);
  const justBeforeReady = pose('drop', 0.999, 0);
  expect(justBeforeReady.camera.eye.distanceTo(dropped.camera.eye)).toBeLessThan(0.15);
  expect(justBeforeReady.camera.rotation.angleTo(dropped.camera.rotation)).toBeLessThan(0.03);
  for (const next of [pose('ready', 0, 0), pose('tunnel', 0, 0)]) {
    expectSameCamera(next.camera, dropped.camera);
    expect(next.fly.distanceTo(dropped.fly)).toBeLessThan(1e-6);
  }

  const last = pose('tunnel', 0, tunnel.length);
  const exiting = pose('exit', 0, tunnel.length);
  expectSameCamera(exiting.camera, last.camera);
  expect(exiting.fly.distanceTo(last.fly)).toBeLessThan(1e-6);

  const returned = pose('exit', 1, tunnel.length);
  expectSameCamera(returned.camera, explorationCamera);
  const justBeforeReturn = pose('exit', 0.999, tunnel.length);
  expect(justBeforeReturn.camera.eye.distanceTo(returned.camera.eye)).toBeLessThan(0.15);
  expect(justBeforeReturn.camera.rotation.angleTo(returned.camera.rotation)).toBeLessThan(0.03);
  expect(returned.fly.x).toBeCloseTo(tunnel.exit.x, 6);
  expect(returned.fly.z).toBeCloseTo(tunnel.exit.z, 6);
  expect(returned.fly.y).toBeCloseTo(start.fly.y, 6);
});

it('moves by distance and keeps a continuous, upright frame through the authored tunnel', () => {
  const { view } = setup();
  for (const [distance, anchor] of [[0, tunnel.entry], [tunnel.length, tunnel.exit]] as const) {
    const { center } = view.frameAt(distance);
    expect(center.x).toBeCloseTo(anchor.x, 5);
    expect(center.z).toBeCloseTo(anchor.z, 5);
    expect(center.y).toBeLessThan(-2);
  }

  const step = tunnel.length / 96;
  let previousCenter = view.frameAt(0).center.clone();
  let previousRight = view.frameAt(0).right.clone();
  for (let i = 1; i <= 96; i++) {
    const { center, tangent, right, up } = view.frameAt(i * step);
    expect(Math.abs(center.distanceTo(previousCenter) - step)).toBeLessThan(step * 0.02);
    for (const axis of [tangent, right, up]) expect(axis.length()).toBeCloseTo(1, 5);
    expect(tangent.dot(right)).toBeCloseTo(0, 5);
    expect(tangent.dot(up)).toBeCloseTo(0, 5);
    expect(right.dot(up)).toBeCloseTo(0, 5);
    expect(up.dot(worldUp)).toBeGreaterThan(0);
    expect(right.dot(previousRight)).toBeGreaterThan(0.95);
    // A right axis that points left throughout is continuous but reverses steering.
    expect(right.dot(tangent.clone().cross(up))).toBeCloseTo(1, 5);
    previousCenter = center.clone();
    previousRight = right.clone();
  }
});

it.each([390 / 844, 900 / 500])('holds a clear sightline on the drop and keeps the emerging firefly in frame at aspect %f', aspect => {
  const { view, pose } = setup(aspect);
  const ray = new Raycaster();
  for (let step = 0; step <= 50; step++) {
    const progress = step / 50;
    const dropping = pose('drop', progress, 0);
    const toFly = dropping.fly.clone().sub(dropping.camera.eye);
    ray.near = view.camera.near;
    ray.far = toFly.length() - 0.095;
    ray.set(dropping.camera.eye, toFly.normalize());
    view.group.updateWorldMatrix(true, true);
    expect(ray.intersectObject(view.group).length, `wall obscures firefly at drop ${progress}`).toBe(0);

    const exiting = pose('exit', progress, tunnel.length);
    const screen = exiting.fly.project(view.camera);
    expect(Math.max(Math.abs(screen.x), Math.abs(screen.y), Math.abs(screen.z)),
      `firefly leaves camera frustum at exit ${progress}`).toBeLessThan(1);
  }
});

it('keeps the chase eye and its near plane inside the bore as the firefly moves sideways', () => {
  const { view, pose } = setup(16 / 9);
  const centers: Vector3[] = [];
  // The camera trails the entry, where the tube has a lead-in.
  for (let d = -4; d <= tunnel.length; d += 0.125) centers.push(view.frameAt(d).center.clone());
  for (const fraction of [0, 0.25, 0.5, 0.75, 1]) {
    const d = tunnel.length * fraction;
    const centered = pose('tunnel', 0, d);
    const steered = pose('tunnel', 0, d, 0.6);
    expectSameCamera(steered.camera, centered.camera);
    const toFly = centered.fly.clone().sub(centered.camera.eye);
    expect(toFly.dot(view.frameAt(d).tangent)).toBeGreaterThan(0);
    const screen = centered.fly.clone().project(view.camera);
    expect(Math.max(Math.abs(screen.x), Math.abs(screen.y), Math.abs(screen.z))).toBeLessThan(1);
    const eyeDistance = Math.min(...centers.map(point => point.distanceTo(centered.camera.eye)));
    const halfHeight = view.camera.near * Math.tan(view.camera.fov * Math.PI / 360);
    const nearCornerDistance = Math.hypot(view.camera.near, halfHeight, halfHeight * view.camera.aspect);
    expect(eyeDistance + nearCornerDistance).toBeLessThan(tunnel.width / 2);
  }
});

it.each([390 / 844, 900 / 500])('keeps both outside lanes visible through all three mission tunnels at aspect %f', aspect => {
  const ray = new Raycaster();
  for (const instance of P07_MISSION.tunnels) {
    const { view, pose } = setup(aspect, instance);
    view.group.updateWorldMatrix(true, true);
    for (let step = 0; step <= 48; step++) {
      const distance = instance.length * step / 48;
      for (const lateral of [-1.32, 0, 1.32]) {
        const { fly, camera } = pose('tunnel', 0, distance, lateral);
        const toFly = fly.clone().sub(camera.eye);
        ray.near = view.camera.near;
        ray.far = toFly.length() - 0.095;
        ray.set(camera.eye, toFly.normalize());
        expect(ray.intersectObject(view.group), `${instance.id} wall at distance ${distance}, lane ${lateral}`).toHaveLength(0);
        const screen = fly.project(view.camera);
        expect(Math.max(Math.abs(screen.x), Math.abs(screen.y), Math.abs(screen.z))).toBeLessThan(1);
      }
    }
  }
});
