import {
  DynamicDrawUsage, Float32BufferAttribute, InstancedBufferAttribute, InstancedBufferGeometry,
  Mesh, ShaderMaterial,
} from 'three';
import type { TunnelInstance } from '../core/types';
import type { createTunnelView } from './tunnel';

/** Draw every light in a single camera-facing batch. Picking and scoring belong to the attempt. */
export function createTunnelLights(travel: ReturnType<typeof createTunnelView>, tunnel: TunnelInstance) {
  const centers: number[] = [];
  const radii: number[] = [];
  for (const light of tunnel.lights) {
    const { center, right } = travel.frameAt(light.distance);
    center.addScaledVector(right, light.lateral);
    centers.push(center.x, center.y, center.z);
    radii.push(light.radius);
  }

  // −1 is available, −2 is an existing collection when the view opens. Other values are pickup times.
  const pickedAt = new InstancedBufferAttribute(new Float32Array(radii.length).fill(-1), 1);
  pickedAt.setUsage(DynamicDrawUsage);
  const geometry = new InstancedBufferGeometry();
  geometry.instanceCount = radii.length;
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.setAttribute('position', new Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
  geometry.setAttribute('sparkCenter', new InstancedBufferAttribute(new Float32Array(centers), 3));
  geometry.setAttribute('sparkRadius', new InstancedBufferAttribute(new Float32Array(radii), 1));
  geometry.setAttribute('pickedAt', pickedAt);
  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { seconds: { value: 0 }, reduced: { value: false } },
    vertexShader: `attribute vec3 sparkCenter;
      attribute float sparkRadius;
      attribute float pickedAt;
      uniform float seconds;
      uniform bool reduced;
      varying vec2 local;
      varying float age;
      varying float warmth;
      void main() {
        local = position.xy * 3.20;
        age = pickedAt >= 0.0 ? max(0.0, seconds - pickedAt) : pickedAt;
        warmth = reduced ? 1.0 : 0.94 + 0.06 * sin(seconds * 2.6 + sparkCenter.z);
        vec4 view = modelViewMatrix * vec4(sparkCenter, 1.0);
        view.xy += local * sparkRadius;
        gl_Position = projectionMatrix * view;
      }`,
    fragmentShader: `uniform bool reduced;
      varying vec2 local;
      varying float age;
      varying float warmth;
      void main() {
        float r = length(local);
        vec3 color;
        float alpha;
        if (age < -0.5 && age > -1.5) {
          float diamond = abs(local.x) + abs(local.y);
          float rays = pow(abs(local.x), 0.6) + pow(abs(local.y), 0.6);
          float aa = clamp(fwidth(diamond), 0.025, 0.22);
          float core = 1.0 - smoothstep(0.61-aa, 0.61+aa, diamond);
          float star = 1.0 - smoothstep(1.09-aa, 1.09+aa, rays);
          float halo = 0.63 * exp(-0.96*r*r);
          color = mix(vec3(1.0,0.45,0.035), vec3(1.0,0.95,0.66), core);
          alpha = max(max(star,core),halo) * warmth;
        } else {
          float duration = reduced ? 0.13 : 0.31;
          if (age < 0.0 || age >= duration) discard;
          float t = age / duration;
          float radius = reduced ? 1.12 : mix(0.70, 2.78, 1.0-(1.0-t)*(1.0-t));
          float line = 1.0 - smoothstep(0.10,0.26,abs(r-radius));
          color = vec3(1.0,0.85,0.41);
          alpha = (1.0-t) * max(line, 0.32*exp(-r*r));
        }
        if (alpha < 0.015) discard;
        gl_FragColor = vec4(color, alpha);
        #include <colorspace_fragment>
      }`,
  });
  const field = new Mesh(geometry, material);
  // The unit quad's bounding sphere does not include the 12 instance positions in the tunnel.
  field.frustumCulled = false;
  travel.group.add(field);
  let initialized = false;

  function sync(collected: ReadonlySet<string>, elapsedSeconds: number, reducedMotion: boolean) {
    material.uniforms.seconds!.value = elapsedSeconds;
    material.uniforms.reduced!.value = reducedMotion;
    let changed = false;
    for (let i = 0; i < tunnel.lights.length; i++) {
      const wasCollected = pickedAt.getX(i) !== -1;
      const isCollected = collected.has(tunnel.lights[i]!.id);
      if (wasCollected === isCollected) continue;
      pickedAt.setX(i, isCollected ? (initialized ? elapsedSeconds : -2) : -1);
      changed = true;
    }
    if (changed) pickedAt.needsUpdate = true;
    initialized = true;
  }

  function dispose() {
    field.removeFromParent();
    geometry.dispose();
    material.dispose();
  }
  return { sync, dispose };
}
