import * as THREE from 'three';

let gradientMap: THREE.DataTexture | null = null;

/**
 * Shared 4-step gradient ramp: with NearestFilter this quantizes lighting
 * into hard cel-shading bands.
 */
function getGradientMap(): THREE.DataTexture {
  if (!gradientMap) {
    const data = new Uint8Array([90, 150, 210, 255]);
    gradientMap = new THREE.DataTexture(data, 4, 1, THREE.RedFormat);
    gradientMap.minFilter = THREE.NearestFilter;
    gradientMap.magFilter = THREE.NearestFilter;
    gradientMap.needsUpdate = true;
  }
  return gradientMap;
}

/**
 * Toon material for the cel-shaded look. Returns a fresh instance so callers
 * can safely tweak opacity per character (bush translucency).
 */
export function makeToonMaterial(color: number): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ color, gradientMap: getGradientMap() });
}

const OUTLINE_VERTEX = /* glsl */ `
  uniform float thickness;
  void main() {
    vec3 inflated = position + normal * thickness;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(inflated, 1.0);
  }
`;

const OUTLINE_FRAGMENT = /* glsl */ `
  uniform vec3 color;
  uniform float opacity;
  void main() {
    gl_FragColor = vec4(color, opacity);
  }
`;

export function makeOutlineMaterial(thickness = 0.035): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      thickness: { value: thickness },
      color: { value: new THREE.Color(0x141414) },
      opacity: { value: 1 },
    },
    vertexShader: OUTLINE_VERTEX,
    fragmentShader: OUTLINE_FRAGMENT,
    side: THREE.BackSide,
  });
}

/**
 * Borderlands-style ink line via inverted hull: a back-facing copy of the
 * mesh, inflated along its normals. Added as a child so it follows all
 * transforms for free.
 */
export function addOutline(mesh: THREE.Mesh, thickness = 0.035): THREE.Mesh {
  const outline = new THREE.Mesh(mesh.geometry, makeOutlineMaterial(thickness));
  outline.name = 'outline';
  mesh.add(outline);
  return outline;
}
