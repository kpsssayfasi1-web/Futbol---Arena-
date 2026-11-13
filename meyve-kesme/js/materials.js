// Per-item shader programs. Every item gets its own GLSL (shape + colours),
// cached and compiled ahead of time so switching items never stalls a frame.
import * as THREE from 'three';
import { itemGlsl } from './object-glsl.js';
import { patchMaterial } from './shader-patch.js';

export function createCutUniforms() {
  return {
    uBMin: { value: new THREE.Vector3(-1, -1, -1) },
    uBMax: { value: new THREE.Vector3(1, 1, 1) },
    uCutN: { value: new THREE.Vector3() },
    uCutDone: { value: new THREE.Vector3() },
    uActive: { value: new THREE.Vector4() },
    uClipZ: { value: 1e6 },
  };
}

const CLIP_VERTEX = { begin_vertex: '$ORIGINAL\nvObjPos = position;' };
const PROPS = (partVar, skinVar) => ({
  roughnessmap_fragment: `$ORIGINAL\nroughnessFactor = itemRough(${partVar}, ${skinVar});`,
  metalnessmap_fragment: `$ORIGINAL\nmetalnessFactor = itemMetal(${partVar});`,
});

let sharedClipDepth = null;
export function clipDepthMaterial(cut) {
  if (sharedClipDepth) return sharedClipDepth;
  sharedClipDepth = patchMaterial(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), {
    key: 'clip-depth',
    uniforms: { uClipZ: cut.uClipZ },
    vertexPars: 'varying vec3 vObjPos;',
    fragmentPars: 'varying vec3 vObjPos;\nuniform float uClipZ;',
    vertex: CLIP_VERTEX,
    fragmentMainStart: 'if (vObjPos.z > uClipZ) discard;',
  });
  return sharedClipDepth;
}

function bodyMaterial(item, cut) {
  const m = new THREE.MeshPhysicalMaterial({ roughness: 0.4, clearcoat: 0.35, clearcoatRoughness: 0.25, side: THREE.DoubleSide, envMapIntensity: item.envBoost ?? 1 });
  return patchMaterial(m, {
    key: `body-${item.id}`,
    uniforms: cut,
    vertexPars: 'varying vec3 vObjPos;',
    fragmentPars: `${itemGlsl(item)}\nvarying vec3 vObjPos;\nuniform float uClipZ;`,
    vertex: CLIP_VERTEX,
    fragment: {
      color_fragment: `$ORIGINAL
        if (vObjPos.z > uClipZ) discard;
        float oPart;
        objMap(vObjPos, oPart);
        float fLines = cutLines(vObjPos, true);
        vec3 fCol = gl_FrontFacing ? itemSkin(vObjPos, oPart) : itemInner(vObjPos, 0.2, oPart) * 0.75;
        diffuseColor.rgb = fCol * (1.0 - 0.5 * fLines);`,
      ...PROPS('oPart', '1.0'),
      normal_fragment_begin: `$ORIGINAL
        if (gl_FrontFacing) normal = bumpNormal(-vViewPosition, normal, itemBump(vObjPos, oPart) - fLines * 0.12, 1.0);`,
    },
  });
}

const CAP_VERTEX = { begin_vertex: '$ORIGINAL\ntransformed.z = uClipZ;\nvObjPos = transformed;' };

function capMaterial(item, cut) {
  const m = new THREE.MeshPhysicalMaterial({ roughness: 0.4, clearcoat: 0.3, clearcoatRoughness: 0.3, side: THREE.DoubleSide, envMapIntensity: item.envBoost ?? 1 });
  return patchMaterial(m, {
    key: `cap-${item.id}`,
    uniforms: cut,
    vertexPars: 'varying vec3 vObjPos;\nuniform float uClipZ;',
    fragmentPars: `${itemGlsl(item)}\nvarying vec3 vObjPos;`,
    vertex: CAP_VERTEX,
    fragment: {
      color_fragment: `$ORIGINAL
        float cPart, cSkin, cDepth;
        vec3 cCol = objColor(vObjPos, cPart, cSkin, cDepth);
        if (cDepth < 0.0) discard;
        diffuseColor.rgb = cCol * (1.0 - 0.4 * cutLines(vObjPos, false));`,
      ...PROPS('cPart', 'cSkin'),
      emissivemap_fragment: '$ORIGINAL\ntotalEmissiveRadiance += itemEmissive(vObjPos, cDepth, cPart);',
    },
  });
}

function capDepthMaterial(item, cut) {
  return patchMaterial(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), {
    key: `cap-depth-${item.id}`,
    uniforms: cut,
    vertexPars: 'varying vec3 vObjPos;\nuniform float uClipZ;',
    fragmentPars: `${itemGlsl(item)}\nvarying vec3 vObjPos;`,
    vertex: CAP_VERTEX,
    fragmentMainStart: 'if (objField(vObjPos) > 0.0) discard;',
  });
}

function simpleMaterial(item, cut) {
  return { body: bodyMaterial(item, cut), cap: capMaterial(item, cut), capDepth: capDepthMaterial(item, cut), bodyDepth: clipDepthMaterial(cut) };
}

const cache = new Map();
export function objectMaterials(item, cut) {
  if (!cache.has(item.id)) cache.set(item.id, simpleMaterial(item, cut));
  return cache.get(item.id);
}

// Compile an item's programs without drawing it (KHR_parallel_shader_compile
// keeps this off the critical path where the browser supports it).
export function precompile(renderer, camera, targetScene, materials) {
  const scene = new THREE.Scene();
  const geo = new THREE.BoxGeometry(0.01, 0.01, 0.01);
  for (const m of materials) {
    const mesh = new THREE.Mesh(geo, m);
    mesh.frustumCulled = false;
    scene.add(mesh);
  }
  const done = renderer.compileAsync ? renderer.compileAsync(scene, camera, targetScene) : Promise.resolve(renderer.compile(scene, camera, targetScene));
  return done.catch(() => {}).finally(() => geo.dispose());
}
