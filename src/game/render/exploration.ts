import {
  BufferGeometry, CircleGeometry, Color, ConeGeometry, CylinderGeometry, DirectionalLight,
  DodecahedronGeometry, DoubleSide, Float32BufferAttribute, FogExp2, Group, HemisphereLight,
  InstancedMesh, Line, MathUtils, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D,
  PerspectiveCamera, Plane, PlaneGeometry, Raycaster, RingGeometry, Scene, ShaderMaterial,
  Vector2, Vector3,
} from 'three';
import type { Material } from 'three';
import type { Anchor } from '../core/types';
import { makeFirefly } from './scene';

interface Bounds { halfWidth: number; halfDepth: number }
interface ExplorationOptions { entry: Anchor & { radius: number }; bounds: Bounds }
interface ExplorationFrame { position: Anchor; ready: boolean; used: boolean; elapsedSeconds: number; reducedMotion: boolean }

/** Fit the near ground corners even in portrait. +X projects right; −Z projects toward the far grove. */
export function frameExplorationCamera(camera: PerspectiveCamera, bounds: Bounds, aspect: number) {
  camera.fov = 46;
  camera.aspect = aspect;
  const elevation = MathUtils.degToRad(55);
  const halfFovTangent = Math.tan(MathUtils.degToRad(camera.fov / 2));
  const groundDepth = bounds.halfDepth + 0.25;
  const distance = groundDepth * Math.cos(elevation) + Math.max(
    (bounds.halfWidth + 0.20) / (aspect * halfFovTangent),
    (groundDepth * Math.sin(elevation) + 0.36) / halfFovTangent,
  );
  camera.position.set(0, distance * Math.sin(elevation), distance * Math.cos(elevation));
  camera.up.set(0, 1, 0);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
}

function makeForest(bounds: Bounds) {
  const forest = new Group();
  const trunk = new InstancedMesh(new CylinderGeometry(0.11, 0.17, 1, 6),
    new MeshStandardMaterial({ color: 0x423d37, flatShading: true }), 42);
  const needles = new InstancedMesh(new ConeGeometry(1, 1, 7),
    new MeshStandardMaterial({ color: 0xffffff, flatShading: true }), trunk.count * 3);
  const stones = new InstancedMesh(new DodecahedronGeometry(1),
    new MeshStandardMaterial({ color: 0xffffff, flatShading: true }), 44);
  const transform = new Object3D();
  const tint = new Color();
  const needleTones = [0x153b36, 0x1a4840, 0x23544b];
  const stoneTones = [0x33494a, 0x415653, 0x52645a];

  // The central ground stays open. The far grove and the two banks frame the playable rectangle.
  for (let i = 0; i < trunk.count; i++) {
    const t = ((i * 41 + 7) % 97) / 97;
    const sideTree = i >= 24;
    const x = sideTree ? (i % 2 ? -1 : 1) * (bounds.halfWidth + 0.50 + t * 2.8) : (i % 12 - 5.5) * 1.3 + t;
    const z = sideTree ? -5.5 + Math.floor((i - 24) / 2) * 1.5 : -bounds.halfDepth - 1.1 - t * 2 - Math.floor(i / 12) * 2.5;
    const height = 1.3 + t * 1.8;
    transform.rotation.set(0, i * 2.4, 0);
    transform.scale.set(1, height * 0.49, 1);
    transform.position.set(x, height * 0.245, z);
    transform.updateMatrix();
    trunk.setMatrixAt(i, transform.matrix);
    for (let crown = 0; crown < 3; crown++) {
      const radius = height * (0.33 - crown * 0.054);
      transform.scale.set(radius, height * (0.60 - crown * 0.067), radius);
      transform.position.y = height * (0.45 + 0.19 * crown);
      transform.updateMatrix();
      const index = i * 3 + crown;
      needles.setMatrixAt(index, transform.matrix);
      needles.setColorAt(index, tint.setHex(needleTones[crown]!).multiplyScalar(0.75 + t * 0.48));
    }
  }
  for (let i = 0; i < stones.count; i++) {
    const t = ((i * 17) % 41) / 41;
    const x = (i % 2 ? -1 : 1) * (bounds.halfWidth * (0.63 + t * 1.1));
    const z = (((i * 31 + 7) % 89) / 89 - 0.5) * 12;
    const size = 0.11 + t * 0.27;
    transform.rotation.set(t * 0.6, i, t * 0.2);
    transform.scale.set(size * 1.45, size * 0.72, size);
    transform.position.set(x, size * 0.28, z);
    transform.updateMatrix();
    stones.setMatrixAt(i, transform.matrix);
    stones.setColorAt(i, tint.setHex(stoneTones[i % stoneTones.length]!));
  }
  forest.add(trunk, needles, stones);
  return forest;
}

function makeInwardCues(radius: number) {
  const vertices: number[] = [];
  for (let i = 0; i < 3; i++) {
    const angle = (i * 2 * Math.PI) / 3;
    const x = Math.cos(angle);
    const z = Math.sin(angle);
    const base = radius + 0.22;
    vertices.push(x * (radius + 0.04), 0.04, z * (radius + 0.04),
      x * base - z * 0.085, 0.04, z * base + x * 0.085,
      x * base + z * 0.085, 0.04, z * base - x * 0.085);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  return new Mesh(geometry, new MeshBasicMaterial({ color: 0xffe398, side: DoubleSide }));
}

export function createExplorationWorld({ entry, bounds }: ExplorationOptions) {
  const scene = new Scene();
  scene.background = new Color(0x10292e);
  scene.fog = new FogExp2(0x173737, 0.038);
  const camera = new PerspectiveCamera(46, 1, 0.035, 160);
  const key = new DirectionalLight(0xffedbd, 2.0);
  key.position.set(-3, 7, 3);
  scene.add(key, new HemisphereLight(0xc4e5dd, 0x526b63, 1.45), makeForest(bounds));

  const lightAt = new Vector2();
  const ground = new Mesh(new PlaneGeometry(120, 120), new ShaderMaterial({
    uniforms: { lightAt: { value: lightAt } },
    vertexShader: `varying vec2 groundPos;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        groundPos = world.xz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: `varying vec2 groundPos;
      uniform vec2 lightAt;
      void main() {
        vec2 p = groundPos;
        float grain = sin(p.x * 3.1 + sin(p.y * 1.9)) * sin(p.y * 3.6 + sin(p.x * 1.6));
        float broad = sin(p.x * 0.89 + p.y * 0.71 + sin(p.y * 0.67));
        vec3 ground = mix(vec3(0.009, 0.034, 0.037), vec3(0.027, 0.063, 0.051), 0.5 + 0.5 * broad);
        ground += vec3(0.002, 0.004, 0.002) * grain;
        float d = distance(p, lightAt);
        float pool = 1.0 - smoothstep(0.06, 1.86, d);
        ground += vec3(0.21, 0.135, 0.025) * pool * pool;
        float farGround = smoothstep(6.0, 18.0, length(p));
        gl_FragColor = vec4(mix(ground, vec3(0.009, 0.034, 0.034), farGround), 1.0);
        #include <colorspace_fragment>
      }`,
  }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const entryMarker = new Group();
  entryMarker.position.set(entry.x, 0, entry.z);
  const pit = new Mesh(new CircleGeometry(entry.radius, 64), new MeshBasicMaterial({ color: 0x081819 }));
  pit.rotation.x = -Math.PI / 2;
  pit.position.y = 0.008;
  const rim = new Mesh(new RingGeometry(entry.radius - 0.021, entry.radius + 0.021, 64),
    new MeshBasicMaterial({ color: 0x769c88, transparent: true, depthWrite: false }));
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 0.018;
  const cues = makeInwardCues(entry.radius);
  entryMarker.add(pit, rim, cues);
  scene.add(entryMarker);

  const { fly, wings } = makeFirefly();
  fly.scale.setScalar(0.56);
  const marker = new Mesh(new RingGeometry(0.074, 0.108, 24), new MeshBasicMaterial({ color: 0xffdb76 }));
  marker.rotation.x = -Math.PI / 2;
  scene.add(fly, marker);
  const groundPlane = new Plane(new Vector3(0, 1, 0), 0);
  const ray = new Raycaster();
  const ndc = new Vector2();
  const hit = new Vector3();

  function pickGround(ndcX: number, ndcY: number): Anchor | null {
    ray.setFromCamera(ndc.set(ndcX, ndcY), camera);
    if (!ray.ray.intersectPlane(groundPlane, hit)) return null;
    return { x: hit.x, z: hit.z };
  }

  function update({ position, ready, used, elapsedSeconds, reducedMotion }: ExplorationFrame) {
    const t = reducedMotion ? 0 : elapsedSeconds;
    lightAt.set(position.x, position.z);
    fly.position.set(position.x, 0.57 + 0.036 * Math.sin(t * 2.4), position.z);
    fly.quaternion.copy(camera.quaternion);
    fly.rotateZ(0.033 * Math.sin(t * 1.55));
    for (const { wing, angle } of wings) wing.rotation.z = angle + Math.sin(t * 6.2) * 0.075;
    marker.position.set(position.x, 0.035, position.z);
    const visibility = 1 - MathUtils.smoothstep(Math.hypot(position.x - entry.x, position.z - entry.z), 0.75, 1.86);
    entryMarker.visible = visibility > 0;
    rim.material.opacity = (used ? 0.35 : 1) * visibility;
    rim.material.color.setHex(ready && !used ? 0xffdc85 : 0x8fb5a1);
    cues.visible = ready && !used;
  }

  function resize(aspect: number) {
    frameExplorationCamera(camera, bounds, aspect);
  }

  function dispose() {
    const geometries = new Set<BufferGeometry>();
    const materials = new Set<Material>();
    scene.traverse(object => {
      if (!(object instanceof Mesh || object instanceof Line)) return;
      if (object instanceof InstancedMesh) object.dispose();
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
    });
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
    scene.clear();
  }

  resize(1);
  return { scene, camera, firefly: fly, resize, pickGround, update, dispose };
}
