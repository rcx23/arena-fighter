import * as THREE from 'three';
import { getSharedGrunge } from './InkTextures';

let gradientMap: THREE.DataTexture | null = null;

/**
 * Shared 3-step gradient ramp: with NearestFilter this quantizes lighting
 * into hard comic-book cel bands.
 */
function getGradientMap(): THREE.DataTexture {
  if (!gradientMap) {
    const data = new Uint8Array([135, 205, 255]);
    gradientMap = new THREE.DataTexture(data, 3, 1, THREE.RedFormat);
    gradientMap.minFilter = THREE.NearestFilter;
    gradientMap.magFilter = THREE.NearestFilter;
    gradientMap.needsUpdate = true;
  }
  return gradientMap;
}

/**
 * Borderlands-style shading injected into MeshToonMaterial: cool-tinted
 * shadow bands, screen-space hatching in the shade (cross-hatch in the
 * darkest band and inside cast shadows), and a poster saturation pop.
 * One shared program for every toon material via customProgramCacheKey.
 */
function applyInkShading(material: THREE.MeshToonMaterial): void {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      /* glsl */ `
      {
        // Lit-ness including the toon ramp AND shadow-map attenuation.
        float inkLit = luminance( reflectedLight.directDiffuse )
                     / max( luminance( diffuseColor.rgb ), 1e-3 );
        if ( inkLit < 0.55 ) {
          // Cool, desaturated shadow tint - not just darker.
          float inkGray = luminance( outgoingLight );
          outgoingLight = mix( outgoingLight, vec3( inkGray ) * vec3( 0.66, 0.7, 0.92 ), 0.35 );
          // Diagonal hatch lines.
          float hatchA = step( 0.80, fract( ( gl_FragCoord.x + gl_FragCoord.y ) * 0.14 ) );
          outgoingLight = mix( outgoingLight, vec3( 0.06, 0.045, 0.08 ), hatchA * 0.3 );
          if ( inkLit < 0.22 ) {
            // Darkest band: cross-hatch.
            float hatchB = step( 0.80, fract( ( gl_FragCoord.x - gl_FragCoord.y ) * 0.14 ) );
            outgoingLight = mix( outgoingLight, vec3( 0.06, 0.045, 0.08 ), hatchB * 0.3 );
          }
        }
        // Poster saturation boost.
        outgoingLight = clamp( mix( vec3( luminance( outgoingLight ) ), outgoingLight, 1.18 ), 0.0, 8.0 );
      }
      #include <opaque_fragment>`,
    );
  };
  material.customProgramCacheKey = () => 'ink-toon-1';
}

/**
 * Toon material for the cel-shaded look. Defaults to a shared neutral grunge
 * texture multiplied under the tint so flat colors never look sterile.
 * Returns a fresh instance so callers can tweak opacity per character.
 */
export function makeToonMaterial(color: number, map?: THREE.Texture | null): THREE.MeshToonMaterial {
  const material = new THREE.MeshToonMaterial({
    color,
    gradientMap: getGradientMap(),
    map: map === null ? null : (map ?? getSharedGrunge()),
  });
  applyInkShading(material);
  return material;
}

export type OutlinePush = 'normal' | 'scale';

/**
 * Ink-line material for inverted hulls. Built on MeshBasicMaterial so it
 * supports InstancedMesh and plain opacity automatically.
 * - 'normal': inflate along normals (smooth geometry: capsules, spheres)
 * - 'scale': inflate radially from the origin (boxes/cylinders, where split
 *   edge normals would tear the hull open at corners)
 */
export function makeOutlineMaterial(thickness = 0.035, push: OutlinePush = 'normal'): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({ color: 0x100c10, side: THREE.BackSide });
  const t = thickness.toFixed(4);
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      push === 'normal'
        ? `vec3 transformed = position + normal * ${t};`
        : `vec3 transformed = position * ( 1.0 + ${t} );`,
    );
  };
  material.customProgramCacheKey = () => `outline-${push}-${t}`;
  return material;
}

/**
 * Borderlands-style ink line via inverted hull: a back-facing copy of the
 * mesh, inflated outward. Added as a child so it follows all transforms.
 */
export function addOutline(mesh: THREE.Mesh, thickness = 0.035, push: OutlinePush = 'normal'): THREE.Mesh {
  const outline = new THREE.Mesh(mesh.geometry, makeOutlineMaterial(thickness, push));
  outline.name = 'outline';
  mesh.add(outline);
  return outline;
}
