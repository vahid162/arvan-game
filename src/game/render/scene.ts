import {
  AdditiveBlending, BufferGeometry, Color, DirectionalLight, DoubleSide,
  Float32BufferAttribute, Group, HemisphereLight, LatheGeometry, Line,
  LineBasicMaterial, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, Shape,
  ShapeGeometry, SphereGeometry, Vector2, Vector3,
} from 'three'
import type { Material, Object3D } from 'three'

function stroke(parent: Object3D, points: [number, number, number][], ink: LineBasicMaterial) {
  const path = new BufferGeometry().setFromPoints(points.map(([x, y, z]) => new Vector3(x, y, z)))
  parent.add(new Line(path, ink))
}

export function makeFirefly() {
  const fly = new Group()
  const sphere = new SphereGeometry(1, 24, 16)
  const shell = new MeshStandardMaterial({ color: 0x294b48, roughness: 0.56 })
  const collar = new MeshStandardMaterial({ color: 0xb08d4a, roughness: 0.55 })
  const ivory = new MeshBasicMaterial({ color: 0xfff0cb })
  const onyx = new MeshBasicMaterial({ color: 0x182c32 })
  const gold = new MeshBasicMaterial({ color: 0xffdc84 })
  const antenna = new LineBasicMaterial({ color: 0xcfbb87 })
  const faceInk = new LineBasicMaterial({ color: 0x112c30 })

  function oval(material: Material, x: number, y: number, z: number, w: number, h: number, d: number) {
    const mesh = new Mesh(sphere, material)
    mesh.position.set(x, y, z)
    mesh.scale.set(w, h, d)
    fly.add(mesh)
    return mesh
  }

  // The lantern tapers toward the tail. Vertex colors keep its center warm without post-processing.
  const profile = [[0, -0.61], [0.095, -0.55], [0.17, -0.43], [0.225, -0.26],
    [0.245, -0.08], [0.222, 0.08], [0.165, 0.20], [0.075, 0.27], [0, 0.28]] as const
  const lanternGeometry = new LatheGeometry(profile.map(([r, y]) => new Vector2(r, y)), 32)
  const lanternColors: number[] = []
  const lanternPositions = lanternGeometry.getAttribute('position')
  const honey = new Color(0xf3a533)
  const lemon = new Color(0xffef9a)
  for (let i = 0; i < lanternPositions.count; i++) {
    const depth = (lanternPositions.getZ(i) + 0.245) / 0.49
    const shade = honey.clone().lerp(lemon, depth * depth)
    lanternColors.push(shade.r, shade.g, shade.b)
  }
  lanternGeometry.setAttribute('color', new Float32BufferAttribute(lanternColors, 3))
  const lantern = new Mesh(lanternGeometry, new MeshBasicMaterial({ vertexColors: true }))
  lantern.rotation.z = -0.98
  lantern.position.set(-0.25, -0.15, 0.08)
  fly.add(lantern)

  const chest = oval(shell, 0.09, 0.08, 0.10, 0.30, 0.22, 0.19)
  chest.rotation.z = 0.50
  const band = oval(collar, -0.07, -0.025, 0.11, 0.08, 0.19, 0.16)
  band.rotation.z = 0.53
  oval(shell, 0.34, 0.21, 0.16, 0.29, 0.265, 0.21)
  for (const [x, y, size] of [[0.305, 0.255, 1], [0.506, 0.28, 0.79]] as const) {
    oval(ivory, x, y, 0.339, 0.078 * size, 0.097 * size, 0.031)
    oval(onyx, x + 0.016, y - 0.004, 0.367, 0.044 * size, 0.066 * size, 0.016)
    oval(ivory, x + 0.029, y + 0.022, 0.382, 0.015, 0.017, 0.008)
  }
  stroke(fly, [[0.337, 0.133, 0.356], [0.374, 0.119, 0.363], [0.408, 0.122, 0.364], [0.44, 0.141, 0.353]], faceInk)
  for (const [root, tip, high] of [[0.27, 0.22, 0.71], [0.436, 0.65, 0.63]] as const) {
    stroke(fly, [[root, 0.40, 0.15], [root + 0.025, high - 0.16, 0.14], [(root + tip) / 2, high - 0.045, 0.15], [tip, high, 0.16]], antenna)
    oval(gold, tip, high, 0.16, 0.031, 0.031, 0.025)
  }

  const wingShape = new Shape()
  wingShape.moveTo(0, 0)
  wingShape.bezierCurveTo(-0.08, 0.32, -0.06, 0.84, 0.045, 1)
  wingShape.bezierCurveTo(0.205, 1.09, 0.245, 0.71, 0.19, 0.46)
  wingShape.bezierCurveTo(0.15, 0.22, 0.052, 0.06, 0, 0)
  const wingGeometry = new ShapeGeometry(wingShape, 16)
  const wingVein = new LineBasicMaterial({ color: 0xaddbc0, transparent: true, opacity: 0.56, depthWrite: false })
  const wings = []
  // Two pairs spread behind the thorax. Each wing pivots about its own root.
  for (const [angle, length, z, opacity] of [[-0.41, 0.83, -0.18, 0.31], [0.23, 1.04, -0.14, 0.48],
    [1.26, 0.87, -0.12, 0.41], [0.80, 1.19, -0.08, 0.62]] as const) {
    const wing = new Group()
    wing.position.set(0.015, 0.16, z)
    wing.rotation.z = angle
    wing.scale.setScalar(length)
    const film = new MeshBasicMaterial({ color: 0x9dd9c8, side: DoubleSide, transparent: true, opacity, depthWrite: false })
    const membrane = new Mesh(wingGeometry, film)
    wing.add(membrane)
    stroke(wing, [[0.004, 0.022, 0.006], [0.06, 0.33, 0.01], [0.102, 0.66, 0.006], [0.075, 0.945, 0.006]], wingVein)
    stroke(wing, [[0.073, 0.42, 0.008], [0.143, 0.55, 0.008], [0.194, 0.67, 0.006]], wingVein)
    fly.add(wing)
    wings.push({ wing, angle })
  }
  return { fly, wings }
}

function groundGrass() {
  const positions: number[] = []
  const colors: number[] = []
  // Three tapered blades per tuft are batched into a single draw.
  for (let i = 0; i < 54; i++) {
    const x = -1 + 2 * ((i * 37) % 53) / 53
    const edge = Math.abs(x)
    const color = new Color(i % 3 === 0 ? 0x194341 : 0x102f33)
    for (let blade = -1; blade <= 1; blade++) {
      const height = 0.02 + (0.025 + ((i * 17) % 13) / 100) * (0.16 + edge * edge)
      const lean = blade * (0.01 + height / 4)
      positions.push(x - 0.007, -0.01, 0, x + 0.006, -0.01, 0, x + lean, height, 0)
      for (let v = 0; v < 3; v++) colors.push(color.r, color.g, color.b)
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  return new Mesh(geometry, new MeshBasicMaterial({ vertexColors: true, side: DoubleSide }))
}

export function createGlade() {
  const scene = new Scene()
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 20)
  camera.position.z = 6
  const plane = new PlaneGeometry(2, 2)
  const backdrop = new Mesh(plane, new ShaderMaterial({
    depthWrite: false,
    vertexShader: 'varying vec2 pos; void main(){pos=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `varying vec2 pos;
      void main() {
        float mist = 1.0 - smoothstep(0.04, 0.83, length((pos - vec2(0.50, 0.52)) * vec2(1.12, 0.83)));
        gl_FragColor = vec4(mix(vec3(0.0015, 0.005, 0.011), vec3(0.009, 0.047, 0.049), mist), 1.0);
        #include <colorspace_fragment>
      }`,
  }))
  backdrop.position.z = -4
  scene.add(backdrop, new HemisphereLight(0xffefd0, 0x4aada9, 2.0))
  const key = new DirectionalLight(0xffebb7, 2.3)
  key.position.set(-2, 4, 4)
  scene.add(key)

  const { fly, wings } = makeFirefly()
  const halo = new Mesh(plane, new ShaderMaterial({
    transparent: true, depthWrite: false, blending: AdditiveBlending,
    vertexShader: 'varying vec2 pos; void main(){pos=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `varying vec2 pos;
      void main() {
        vec2 offset = (pos - 0.5) * 2.0;
        float light = exp(-4.3 * dot(offset,offset)) * (1.0 - smoothstep(0.56,1.0,length(offset)));
        gl_FragColor = vec4(1.0,0.58,0.14,0.24 * light);
      }`,
  }))
  halo.scale.set(1.26, 0.97, 1)
  halo.position.set(-0.33, -0.15, -0.42)
  halo.renderOrder = -1
  fly.add(halo)
  scene.add(fly)

  const grass = groundGrass()
  const specks: number[] = []
  for (let i = 0; i < 44; i++) {
    const x = 2 * ((i * 43 + 13) % 101) / 100 - 1
    const y = 2 * ((i * 31 + 57) % 97) / 96 - 1
    if (Math.abs(x) < 0.3 && Math.abs(y) < 0.5) continue
    const r = i % 7 === 0 ? 0.0033 : 0.0019
    specks.push(x - r, y, 0, x, y + r * 2, 0, x + r, y, 0, x - r, y, 0, x + r, y, 0, x, y - r * 2, 0)
  }
  const speckGeometry = new BufferGeometry()
  speckGeometry.setAttribute('position', new Float32BufferAttribute(specks, 3))
  const motes = new Mesh(speckGeometry, new MeshBasicMaterial({ color: 0x9aa37a, side: DoubleSide }))
  motes.position.z = -2
  scene.add(motes, grass)

  function resize(aspect: number) {
    const halfHeight = Math.max(1.54, 1.43 / aspect)
    const halfWidth = halfHeight * aspect
    camera.left = -halfWidth
    camera.right = halfWidth
    camera.top = halfHeight
    camera.bottom = -halfHeight
    camera.updateProjectionMatrix()
    backdrop.scale.set(halfWidth, halfHeight, 1)
    motes.scale.copy(backdrop.scale)
    grass.scale.set(halfWidth, halfHeight * 1.75, 1)
    grass.position.set(0, -halfHeight, -1)
  }

  function update(elapsedSeconds: number) {
    fly.position.y = -0.16 + Math.sin(elapsedSeconds * 1.36) * 0.053
    fly.rotation.z = Math.sin(elapsedSeconds * 0.87) * 0.035
    for (const { wing, angle } of wings) {
      wing.rotation.z = angle + Math.sin(elapsedSeconds * 4.5) * 0.057
      wing.rotation.y = Math.sin(elapsedSeconds * 4.5) * 0.19
    }
  }

  function dispose() {
    const geometries = new Set<BufferGeometry>()
    const materials = new Set<Material>()
    scene.traverse(object => {
      if (!(object instanceof Mesh || object instanceof Line)) return
      geometries.add(object.geometry)
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material)
    })
    for (const geometry of geometries) geometry.dispose()
    for (const material of materials) material.dispose()
    scene.clear()
  }

  resize(1)
  update(0)
  return { scene, camera, resize, update, dispose }
}
