import {
  BufferGeometry, CircleGeometry, Color, ConeGeometry, CylinderGeometry, DirectionalLight,
  DodecahedronGeometry, DoubleSide, Float32BufferAttribute, FogExp2, Group, HemisphereLight,
  InstancedMesh, LatheGeometry, Line, MathUtils, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D,
  PerspectiveCamera, Plane, PlaneGeometry, Raycaster, RingGeometry, Scene, ShaderMaterial, SphereGeometry,
  Vector2, Vector3,
} from 'three';
import type { Material } from 'three';
import type { Anchor } from '../core/types';
import { makeFirefly } from './scene';

interface Bounds { halfWidth: number; halfDepth: number }
export const FOREST_SURFACE_LAYER = 1;
type Entrance = Anchor & { radius: number };
interface ExplorationOptions {
  entry: Entrance;
  entries?: readonly (Entrance & { id: string })[];
  bounds: Bounds;
  story?: boolean;
  lightRadiusScale?: number;
  entranceDiscoveryRadius?: number;
}
interface ExplorationFrame {
  position: Anchor;
  ready?: boolean;
  used?: boolean;
  readyId?: string | null;
  consumedIds?: ReadonlySet<string>;
  carryingElixir?: boolean;
  elapsedSeconds: number;
  reducedMotion: boolean;
}

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
  const shaded = needles.instanceColor!.array.slice();
  const sunlit = [new Color(0x43794c), new Color(0x629650), new Color(0x91b466)];
  function restoreFoliage(fronts: Vector3) {
    for (let i = 0; i < needles.count; i++) {
      const z = needles.instanceMatrix.array[i * 16 + 14]!;
      const before = MathUtils.smoothstep(z, fronts.x, fronts.x + 0.65);
      const after = MathUtils.smoothstep(z, fronts.y, fronts.y + 0.65);
      const restored = MathUtils.lerp(before, after, fronts.z);
      tint.fromArray(shaded, i * 3).lerp(sunlit[i % 3]!, restored);
      needles.setColorAt(i, tint);
    }
    needles.instanceColor!.needsUpdate = true;
  }
  return { forest, restoreFoliage };
}

// The owl and its torch stay at the same landmark throughout all three missions.
function makeGuardian() {
  const group = new Group();
  group.position.set(2.05, 0, 1.05);
  const round = new SphereGeometry(1, 16, 12);
  const bark = new MeshStandardMaterial({ color: 0x74593e, roughness: 1 });
  const feathers = new MeshStandardMaterial({ color: 0x71875b, roughness: 1 });
  const cream = new MeshStandardMaterial({ color: 0xdfc98c, roughness: 0.8 });
  const eye = new MeshBasicMaterial({ color: 0x20322e });
  function oval(parent: Group, material: Material, x: number, y: number, z: number, w: number, h: number, d: number) {
    const mesh = new Mesh(round, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    parent.add(mesh);
    return mesh;
  }
  const stump = new Mesh(new CylinderGeometry(0.36, 0.46, 0.26, 9), bark);
  stump.position.y = 0.13;
  group.add(stump);
  oval(group, feathers, 0, 0.56, 0, 0.38, 0.39, 0.30);
  const wings = [-1, 1].map(side => {
    const shoulder = new Group();
    shoulder.position.set(side * 0.29, 0.66, 0.05);
    group.add(shoulder);
    oval(shoulder, feathers, 0, -0.12, 0, 0.11, 0.23, 0.19);
    return { shoulder, side };
  });
  const face = new Group();
  face.position.set(0, 0.88, 0.10);
  face.rotation.x = -0.60;
  group.add(face);
  oval(face, feathers, 0, 0, 0, 0.40, 0.29, 0.25);
  for (const side of [-1, 1]) {
    const tuft = new Mesh(new ConeGeometry(0.135, 0.32, 5), feathers);
    tuft.position.set(side * 0.26, 0.23, -0.02);
    tuft.rotation.z = -side * 0.35;
    face.add(tuft);
    oval(face, cream, side * 0.145, 0.045, 0.20, 0.139, 0.145, 0.055);
    oval(face, eye, side * 0.14, 0.05, 0.246, 0.059, 0.073, 0.025);
  }
  const beak = new Mesh(new ConeGeometry(0.057, 0.17, 4), cream);
  beak.rotation.z = Math.PI;
  beak.position.set(0, -0.043, 0.255);
  face.add(beak);

  const staff = new Mesh(new CylinderGeometry(0.055, 0.08, 0.87, 7), bark);
  staff.position.set(0.52, 0.47, 0.08);
  group.add(staff);
  const bowl = new Mesh(new CylinderGeometry(0.185, 0.083, 0.15, 8), cream);
  bowl.position.set(0.52, 0.94, 0.08);
  group.add(bowl);
  const flame = new Group();
  flame.position.set(0.52, 1, 0.08);
  group.add(flame);
  const amber = new MeshBasicMaterial({ color: 0xffa23b });
  oval(flame, amber, 0, 0.17, 0, 0.14, 0.22, 0.14);
  const tip = new Mesh(new ConeGeometry(0.11, 0.30, 8), amber);
  tip.position.set(0.018, 0.36, 0);
  tip.rotation.z = -0.12;
  flame.add(tip);
  oval(flame, new MeshBasicMaterial({ color: 0xfff5b6 }), 0, 0.15, 0.08, 0.076, 0.14, 0.075);
  const sizes = [0.23, 0.55, 0.82, 1.18];
  function update(level: number, seconds: number, salute = 0) {
    const size = MathUtils.lerp(sizes[Math.floor(level)]!, sizes[Math.ceil(level)]!, level % 1);
    const flicker = level === 3 ? 1 : 1 + 0.05 * Math.sin(seconds * 3.5);
    flame.scale.set(size, size * flicker, size);
    for (const { shoulder, side } of wings) shoulder.rotation.z = side * (0.24 + 1.35 * salute);
    face.rotation.x = -0.60 + 0.14 * salute;
  }
  const torchAt = new Vector2(group.position.x + flame.position.x, group.position.z + flame.position.z);
  return { group, torchAt, update };
}

function makeElixir() {
  const bottle = new Group();
  bottle.position.set(0.01, -0.23, 0.17);
  const profile = [[0, -0.42], [0.13, -0.38], [0.16, -0.26], [0.14, -0.18],
    [0.065, -0.12], [0.065, -0.065], [0.085, -0.065], [0.085, -0.035], [0, -0.035]] as const;
  const flask = new Mesh(new LatheGeometry(profile.map(([r, y]) => new Vector2(r, y)), 10),
    new MeshStandardMaterial({ color: 0x77dfca, emissive: 0x174e49, roughness: 0.32, flatShading: true }));
  const stopper = new Mesh(new CylinderGeometry(0.063, 0.061, 0.072, 8),
    new MeshBasicMaterial({ color: 0xd9ba78 }));
  stopper.position.y = -0.025;
  bottle.add(flask, stopper);
  bottle.visible = false;
  return bottle;
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

function makeEntrance(anchor: Entrance, id?: string) {
  const group = new Group();
  group.position.set(anchor.x, 0, anchor.z);
  const pit = new Mesh(new CircleGeometry(anchor.radius, 64), new MeshBasicMaterial({ color: 0x081819 }));
  pit.rotation.x = -Math.PI / 2;
  pit.position.y = 0.008;
  const rim = new Mesh(new RingGeometry(anchor.radius - 0.021, anchor.radius + 0.021, 64),
    new MeshBasicMaterial({ color: 0x769c88, transparent: true, depthWrite: false }));
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 0.018;
  const cues = makeInwardCues(anchor.radius);
  group.add(pit, rim, cues);

  const closed = new Group();
  if (id !== undefined) {
    // Crossed wooden slats cover a consumed entrance and disappear with the pit when it opens.
    const slat = new PlaneGeometry(anchor.radius * 1.56, anchor.radius * 0.22);
    const wood = new MeshBasicMaterial({ color: 0xb3a787 });
    for (const angle of [-Math.PI / 4, Math.PI / 4]) {
      const bar = new Mesh(slat, wood);
      bar.rotation.z = angle;
      closed.add(bar);
    }
    closed.position.z = 0.02;
    closed.visible = false;
    pit.add(closed);
  }
  return { anchor, id, group, pit, rim, cues, closed };
}

const baseLightRadius = 1.86;
// Positive Z is south. The northern holes stay dark until the third delivery.
const restorationFronts = [200, 1.1, -0.75, -200];
const restorationSeconds = 1.4;

export function createExplorationWorld({
  entry, entries, bounds, story = false, lightRadiusScale = 1, entranceDiscoveryRadius = baseLightRadius,
}: ExplorationOptions) {
  const scene = new Scene();
  const sky = new Color(0x10292e);
  const mist = new FogExp2(0x173737, 0.038);
  const nightSky = sky.clone(), restoredSky = new Color(0x91ad91);
  const nightMist = mist.color.clone(), restoredMist = new Color(0x9cb69a);
  scene.background = sky;
  scene.fog = mist;
  const camera = new PerspectiveCamera(46, 1, 0.035, 160);
  const key = new DirectionalLight(0xffedbd, 2.0);
  key.position.set(-3, 7, 3);
  const { forest, restoreFoliage } = makeForest(bounds);
  scene.add(key, new HemisphereLight(0xc4e5dd, 0x526b63, 1.45), forest);
  const guardian = story ? makeGuardian() : null;
  if (guardian) scene.add(guardian.group);

  const lightAt = new Vector2();
  const poolRadii = new Vector2(0.06, baseLightRadius).multiplyScalar(lightRadiusScale);
  const discoveryRadius = entranceDiscoveryRadius * lightRadiusScale;
  const fullRevealRadius = 0.75 * lightRadiusScale;
  const aperture = new Vector3();
  const fronts = new Vector3(restorationFronts[0], restorationFronts[0], 0);
  const torchLight = { value: 0 };
  const ground = new Mesh(new PlaneGeometry(120, 120), new ShaderMaterial({
    uniforms: {
      lightAt: { value: lightAt }, poolRadii: { value: poolRadii }, aperture: { value: aperture }, fronts: { value: fronts },
      torchAt: { value: guardian?.torchAt ?? new Vector2() }, torchLight,
    },
    vertexShader: `varying vec2 groundPos;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        groundPos = world.xz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: `varying vec2 groundPos;
      uniform vec2 lightAt;
      uniform vec2 poolRadii;
      uniform vec3 aperture;
      uniform vec3 fronts;
      uniform vec2 torchAt;
      uniform float torchLight;
      void main() {
        vec2 p = groundPos;
        if (distance(p, aperture.xy) < aperture.z) discard;
        float grain = sin(p.x * 3.1 + sin(p.y * 1.9)) * sin(p.y * 3.6 + sin(p.x * 1.6));
        float broad = sin(p.x * 0.89 + p.y * 0.71 + sin(p.y * 0.67));
        vec3 ground = mix(vec3(0.009, 0.034, 0.037), vec3(0.027, 0.063, 0.051), 0.5 + 0.5 * broad);
        ground += vec3(0.002, 0.004, 0.002) * grain;
        float z = p.y + 0.09 * sin(2.1*p.x);
        float meadow = mix(smoothstep(fronts.x, fronts.x + 0.65, z), smoothstep(fronts.y, fronts.y + 0.65, z), fronts.z);
        vec3 moss = mix(vec3(0.073,0.155,0.061), vec3(0.22,0.31,0.101), 0.5 + 0.5 * broad);
        ground = mix(ground, moss + vec3(0.012,0.017,0.005)*grain, meadow);
        float torchDistance = distance(p, torchAt);
        ground += vec3(0.25,0.14,0.026) * torchLight * exp(-1.35*torchDistance*torchDistance);
        float d = distance(p, lightAt);
        float pool = 1.0 - smoothstep(poolRadii.x, poolRadii.y, d);
        ground += vec3(0.21, 0.135, 0.025) * pool * pool;
        float farGround = smoothstep(6.0, 18.0, length(p));
        vec3 haze = mix(vec3(0.009, 0.034, 0.034), vec3(0.12,0.22,0.14), meadow);
        gl_FragColor = vec4(mix(ground, haze, farGround), 1.0);
        #include <colorspace_fragment>
      }`,
  }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const entrances = entries ? entries.map(anchor => makeEntrance(anchor, anchor.id)) : [makeEntrance(entry)];
  for (const entrance of entrances) scene.add(entrance.group);

  const { fly, wings } = makeFirefly();
  const elixir = story ? makeElixir() : null;
  if (elixir) fly.add(elixir);
  fly.scale.setScalar(0.56);
  const marker = new Mesh(new RingGeometry(0.074, 0.108, 24), new MeshBasicMaterial({ color: 0xffdb76 }));
  marker.rotation.x = -Math.PI / 2;
  scene.add(fly, marker);
  // The enclosed bore hides these meshes. Keep the firefly and its lights on the default layer.
  camera.layers.enable(FOREST_SURFACE_LAYER);
  const surface = [forest, ground, marker, ...entrances.map(entrance => entrance.group)];
  if (guardian) surface.push(guardian.group);
  for (const object of surface) object.traverse(child => child.layers.set(FOREST_SURFACE_LAYER));
  const groundPlane = new Plane(new Vector3(0, 1, 0), 0);
  const ray = new Raycaster();
  const ndc = new Vector2();
  const hit = new Vector3();
  let restoration = 0;
  let transition: { from: number; to: number; start: number } | null = null;

  function displayRestoration(level: number) {
    if (level === restoration) return;
    restoration = level;
    fronts.set(restorationFronts[Math.floor(level)]!, restorationFronts[Math.ceil(level)]!, level % 1);
    restoreFoliage(fronts);
    torchLight.value = guardian ? level / 3 : 0;
    const dawn = Math.max(0, level - 2);
    sky.lerpColors(nightSky, restoredSky, dawn);
    mist.color.lerpColors(nightMist, restoredMist, dawn);
  }

  function setRestoration(level: number) {
    if (!Number.isFinite(level)) return;
    transition = null;
    displayRestoration(MathUtils.clamp(Math.trunc(level), 0, 3));
    guardian?.update(restoration, 0);
  }

  function transitionRestoration(level: number, elapsedSeconds: number) {
    if (!Number.isFinite(level)) return;
    const next = MathUtils.clamp(Math.trunc(level), 0, 3);
    if (next <= restoration || !Number.isFinite(elapsedSeconds)) setRestoration(next);
    else if (transition?.to !== next) transition = { from: restoration, to: next, start: elapsedSeconds };
  }

  function pickGround(ndcX: number, ndcY: number): Anchor | null {
    ray.setFromCamera(ndc.set(ndcX, ndcY), camera);
    if (!ray.ray.intersectPlane(groundPlane, hit)) return null;
    return { x: hit.x, z: hit.z };
  }

  function update({ position, ready, used, readyId, consumedIds, carryingElixir = false, elapsedSeconds, reducedMotion }: ExplorationFrame) {
    const t = reducedMotion ? 0 : elapsedSeconds;
    let salute = 0;
    if (transition) {
      const progress = reducedMotion ? 1 : MathUtils.smoothstep(elapsedSeconds, transition.start, transition.start + restorationSeconds);
      displayRestoration(MathUtils.lerp(transition.from, transition.to, progress));
      if (progress === 1) transition = null;
      else if (transition.to === 3) salute = Math.sin(Math.PI * progress) ** 2;
    }
    guardian?.update(restoration, t, salute);
    if (elixir) elixir.visible = carryingElixir;
    lightAt.set(position.x, position.z);
    fly.position.set(position.x, 0.57 + 0.036 * Math.sin(t * 2.4), position.z);
    fly.quaternion.copy(camera.quaternion);
    fly.rotateZ(0.033 * Math.sin(t * 1.55));
    for (const { wing, angle } of wings) wing.rotation.z = angle + Math.sin(t * 6.2) * 0.075;
    marker.position.set(position.x, 0.035, position.z);
    for (const entrance of entrances) {
      const { anchor, group, rim, cues, closed, id } = entrance;
      const distance = Math.hypot(position.x - anchor.x, position.z - anchor.z);
      const visibility = 1 - MathUtils.smoothstep(distance, fullRevealRadius, discoveryRadius);
      const taken = consumedIds && id !== undefined ? consumedIds.has(id) : !!used && entrance === entrances[0];
      const active = readyId !== undefined ? readyId === id : !!ready && entrance === entrances[0];
      group.visible = visibility > 0;
      rim.material.opacity = (taken ? 0.35 : 1) * visibility;
      rim.material.color.setHex(active && !taken ? 0xffdc85 : 0x8fb5a1);
      cues.visible = active && !taken;
      closed.visible = taken && entrances.length > 1;
    }
  }

  function resize(aspect: number) {
    frameExplorationCamera(camera, bounds, aspect);
  }

  function setAperture(anchor: Anchor | null) {
    let radius = entry.radius;
    for (const entrance of entrances) {
      const open = anchor?.x === entrance.anchor.x && anchor?.z === entrance.anchor.z;
      entrance.pit.visible = !open;
      if (open) radius = entrance.anchor.radius;
    }
    aperture.set(anchor?.x ?? 0, anchor?.z ?? 0, anchor ? radius : 0);
    marker.visible = !anchor;
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
  guardian?.update(restoration, 0);
  return {
    scene, camera, firefly: fly, apertureRadius: entry.radius, setRestoration, transitionRestoration,
    get restoring() { return transition !== null; },
    setAperture, resize, pickGround, update, dispose,
  };
}
