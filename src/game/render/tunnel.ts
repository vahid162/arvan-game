import {
  BufferGeometry, CatmullRomCurve3, DoubleSide, Float32BufferAttribute, Group, MathUtils,
  Matrix4, Mesh, Quaternion, ShaderMaterial, Vector3,
} from 'three';
import type { Anchor, TunnelInstance } from '../core/types';
import type { createExplorationWorld } from './exploration';

interface TravelPose {
  phase: 'explore' | 'drop' | 'ready' | 'tunnel' | 'exit';
  position: Anchor;
  progress: number;
  distance: number;
  lateral: number;
  reducedMotion: boolean;
}

const vertical = new Vector3(0, 1, 0);
const smooth = (value: number, start: number, end: number) => MathUtils.smootherstep(value, start, end);

function buildPath(tunnel: TunnelInstance) {
  const a = new Vector3(tunnel.entry.x, -6.4, tunnel.entry.z);
  const b = new Vector3(tunnel.exit.x, -6.4, tunnel.exit.z);
  const across = b.clone().sub(a).normalize();
  const forward = new Vector3(-across.z, 0, across.x);
  function mainCurve(span: number) {
    const point = (cross: number, run: number, depth: number) =>
      a.clone().lerp(b, cross).addScaledVector(forward, run * span).addScaledVector(vertical, depth);
    const curve = new CatmullRomCurve3([
      point(0, 0, 0), point(-0.045, 0.28, -0.05), point(-0.24, 0.62, -0.33),
      point(-0.16, 0.88, -0.24), point(0.50, 1, -0.08), point(1.16, 0.88, 0.10),
      point(1.24, 0.62, 0.21), point(1.045, 0.28, 0.06), point(1, 0, 0),
    ]);
    curve.arcLengthDivisions = 480;
    return curve;
  }
  // Keep the world anchors fixed and fit the bend to the authored travel distance.
  let lo = 0.01;
  let hi = tunnel.length;
  for (let i = 0; i < 20; i++) {
    const span = (lo + hi) / 2;
    if (mainCurve(span).getLength() < tunnel.length) lo = span;
    else hi = span;
  }
  const main = mainCurve((lo + hi) / 2);
  const start = main.getTangentAt(0);
  const end = main.getTangentAt(1);

  function neck(center: Vector3, into: Vector3, exiting: boolean) {
    const surface = new Vector3(center.x, 0, center.z);
    const horizontal = new Vector3(into.x, 0, into.z).normalize();
    const offset = (back: number, y: number) => new Vector3(center.x, y, center.z).addScaledVector(horizontal, -back);
    const points = [surface, offset(0, -0.85), offset(0.75, -2.2), offset(2.55, -3.5),
      offset(3.05, -4.95), center.clone().addScaledVector(into, -1.65), center];
    return new CatmullRomCurve3(exiting ? points.reverse() : points);
  }
  const lead = neck(a, start, false);
  const tail = neck(b, end.clone().negate(), true);
  const minimum = -lead.getLength();
  const maximum = tunnel.length + tail.getLength();
  const firstRight = start.clone().cross(vertical).normalize();
  const lastRight = end.clone().cross(vertical).normalize();

  function frameAt(distance: number) {
    const before = distance < 0;
    const after = distance > tunnel.length;
    const curve = before ? lead : after ? tail : main;
    const t = before ? (distance - minimum) / -minimum :
      after ? (distance - tunnel.length) / (maximum - tunnel.length) : distance / tunnel.length;
    const u = MathUtils.clamp(t, 0, 1);
    const center = curve.getPointAt(u);
    const tangent = curve.getTangentAt(u);
    if (distance < minimum) center.addScaledVector(tangent, distance - minimum);
    if (distance > maximum) center.addScaledVector(tangent, distance - maximum);
    const right = before ? firstRight.clone() : after ? lastRight.clone() : tangent.clone().cross(vertical).normalize();
    const up = right.clone().cross(tangent).normalize();
    return { center, tangent, right, up };
  }
  return { frameAt, minimum, maximum };
}

function tunnelWall(path: ReturnType<typeof buildPath>, radius: number, mouth: number) {
  const positions: number[] = [];
  const coordinates: number[] = [];
  const indices: number[] = [];
  const sides = 18;
  const steps = Math.ceil((path.maximum - path.minimum) * 4);
  for (let i = 0; i <= steps; i++) {
    const s = MathUtils.lerp(path.minimum, path.maximum, i / steps);
    const { center, right, up } = path.frameAt(s);
    const fromLip = Math.min(s - path.minimum, path.maximum - s);
    const width = MathUtils.lerp(mouth, radius, smooth(fromLip, 0.1, 5.5));
    for (let j = 0; j <= sides; j++) {
      const a = j / sides * Math.PI * 2;
      const ripple = smooth(fromLip, 0.2, 1.5) * 0.023 * (Math.sin(a * 5 + s * 0.6) + Math.sin(a * 3 - s * 0.8));
      const p = center.clone().addScaledVector(right, width * (1 + ripple) * Math.cos(a))
        .addScaledVector(up, width * (1 + ripple) * Math.sin(a));
      positions.push(p.x, p.y, p.z);
      coordinates.push(j / sides, s);
      if (i < steps && j < sides) {
        const v = i * (sides + 1) + j;
        indices.push(v, v + 1, v + sides + 1, v + 1, v + sides + 2, v + sides + 1);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(coordinates, 2));
  geometry.setIndex(indices);
  const material = new ShaderMaterial({
    side: DoubleSide,
    vertexShader: `varying vec2 wall; varying float depth;
      void main(){
        wall = uv;
        vec4 view = modelViewMatrix * vec4(position,1.0);
        depth = -view.z;
        gl_Position = projectionMatrix * view;
      }`,
    fragmentShader: `varying vec2 wall; varying float depth;
      void main(){
        float a = wall.x * 6.2831853;
        float s = wall.y;
        float facet = 0.5 + 0.5 * sin(floor(wall.x * 18.0) * 1.7 + sin(s * 0.74));
        float bank = 0.5 + 0.5 * sin(a + 0.45 * sin(s * 0.61));
        vec3 stone = mix(vec3(0.009,0.040,0.052),vec3(0.045,0.116,0.101),0.5*facet+0.5*bank);
        float seam = abs(fract(s * 0.57 + 0.16*sin(3.0*a+s*0.38) + 0.09*cos(a*2.0-s*0.64)) - 0.5);
        float lip = 1.0-smoothstep(0.02,0.085,seam);
        stone += lip * mix(vec3(0.036,0.14,0.116),vec3(0.17,0.097,0.032),bank*bank);
        float mineral = abs(sin(a*3.0 + 0.23*s + 0.38*sin(s*1.14)));
        stone += vec3(0.095,0.22,0.157)*(1.0-smoothstep(0.012,0.045,mineral))*smoothstep(0.0,0.9,sin(s*1.7+a));
        gl_FragColor = vec4(mix(stone,vec3(0.006,0.016,0.024),smoothstep(3.0,14.0,depth)),1.0);
        #include <colorspace_fragment>
      }`,
  });
  return new Mesh(geometry, material);
}

export function createTunnelView(world: ReturnType<typeof createExplorationWorld>, tunnel: TunnelInstance) {
  const path = buildPath(tunnel);
  const group = new Group();
  const wall = tunnelWall(path, tunnel.width / 2, world.apertureRadius);
  group.add(wall);
  group.visible = false;
  world.scene.add(group);
  const camera = world.camera.clone();
  const orientation = new Matrix4();

  function applyPose({ phase, position, progress, distance, lateral, reducedMotion }: TravelPose) {
    camera.copy(world.camera);
    group.visible = phase !== 'explore';
    world.setAperture(phase === 'explore' ? null : phase === 'exit' ? tunnel.exit : tunnel.entry);
    if (phase === 'explore') return;
    const trail = MathUtils.clamp(2.8 / Math.pow(camera.aspect, 0.36), 2.65, 3.65);
    const chaseFov = Math.max(51, MathUtils.radToDeg(2 * Math.atan(1.72 / (trail * camera.aspect))));

    function eyePose(station: number) {
      const at = path.frameAt(station);
      const eye = at.center.addScaledVector(at.up, 0.17 * smooth(Math.min(station - path.minimum, path.maximum - station), 0, 3));
      const ahead = path.frameAt(station + trail + 0.40);
      const target = ahead.center.addScaledVector(ahead.up, 0.23);
      return { eye, rotation: new Quaternion().setFromRotationMatrix(orientation.lookAt(eye, target, at.up)) };
    }
    const ground = world.camera;
    const groundFly = world.firefly.position.clone();
    const groundRotation = world.firefly.quaternion.clone();
    let station = phase === 'ready' || phase === 'drop' ? 0 : phase === 'exit' ? tunnel.length : distance;
    let eyeStation = station - trail;
    let groundBlend = 0;
    let groundFlyBlend = 0;
    if (phase === 'drop') {
      station = MathUtils.lerp(path.minimum - 0.22, 0, smooth(progress, 0.31, 1));
      eyeStation = station - MathUtils.lerp(1.35, trail, smooth(station, path.minimum + 3.4, 0));
      groundBlend = 1 - smooth(progress, 0, 0.31);
      groundFlyBlend = groundBlend;
      groundFly.x = position.x;
      groundFly.z = position.z;
    } else if (phase === 'exit') {
      station = MathUtils.lerp(tunnel.length, path.maximum + 0.68, smooth(progress, 0, 0.69));
      const spacing = MathUtils.lerp(trail, 1.34, smooth(station, tunnel.length, path.maximum - 2.8));
      eyeStation = MathUtils.lerp(station - spacing, path.maximum + 1.65, smooth(progress, 0.69, 0.86));
      groundBlend = smooth(progress, 0.84, 1);
      groundFlyBlend = smooth(progress, 0.70, 1);
      groundFly.x = tunnel.exit.x;
      groundFly.z = tunnel.exit.z;
    }
    const eye = eyePose(eyeStation);
    camera.position.copy(eye.eye).lerp(ground.position, groundBlend);
    const body = path.frameAt(station);
    const lateralWeight = phase === 'exit' ? 1 - smooth(progress, 0, 0.42) : phase === 'tunnel' ? 1 : 0;
    world.firefly.position.copy(body.center).addScaledVector(body.right, lateral * lateralWeight).lerp(groundFly, groundFlyBlend);
    if (phase === 'exit') {
      // Separate the dolly and the firefly before the camera rises past its height at the mouth.
      const back = new Vector3(ground.position.x - tunnel.exit.x, 0, ground.position.z - tunnel.exit.z).normalize();
      const flightArc = smooth(progress, 0.62, 0.79) * (1 - smooth(progress, 0.82, 1));
      world.firefly.position.addScaledVector(back, -1.35 * flightArc);
      camera.position.addScaledVector(back, 0.85 * smooth(eye.eye.y, 0, 1.3) * (1 - groundBlend));
    }
    if (phase === 'drop' || phase === 'exit') {
      // In the narrow neck, face the visible fly. Transport screen-right around the vertical lip.
      const rear = camera.position.clone().sub(world.firefly.position).normalize();
      const rimRight = path.frameAt(eyeStation).right;
      if (phase === 'exit') {
        // Interpolate the azimuth itself so opposing screen directions never squeeze through a tiny vector.
        const yaw = Math.atan2(rimRight.z, rimRight.x) * (1 - smooth(progress, 0.32, 0.79));
        rimRight.set(Math.cos(yaw), 0, Math.sin(yaw));
      }
      const up = new Vector3().crossVectors(rear, rimRight);
      const tracked = new Quaternion().setFromRotationMatrix(orientation.lookAt(camera.position, world.firefly.position, up));
      const weight = phase === 'drop' ? 1 - smooth(progress, 0.65, 1) : smooth(progress, 0, 0.26);
      eye.rotation.slerp(tracked, weight);
    }
    camera.quaternion.copy(eye.rotation).slerp(ground.quaternion, groundBlend);
    camera.fov = MathUtils.lerp(chaseFov, ground.fov, groundBlend);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    const flightRotation = new Quaternion().setFromRotationMatrix(orientation.makeBasis(body.tangent, body.up, body.right));
    // A slight three-quarter view keeps the wings legible from behind.
    flightRotation.multiply(new Quaternion().setFromAxisAngle(vertical, reducedMotion ? -0.33 : -0.42));
    world.firefly.quaternion.copy(flightRotation).slerp(groundRotation, groundFlyBlend);
  }

  function dispose() {
    group.removeFromParent();
    wall.geometry.dispose();
    wall.material.dispose();
  }
  return { camera, group, frameAt: path.frameAt, applyPose, dispose };
}
