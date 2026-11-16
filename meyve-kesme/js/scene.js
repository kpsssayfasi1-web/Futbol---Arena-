// Renderer, camera, lights and the swappable kitchen set (see sets.js).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildSet, disposeSet, BOARD_THICKNESS } from './sets.js';
import { canvasTexture } from './textures.js';
import { cameraView, cameraPose } from './camera.js';

export { BOARD_THICKNESS };
const SHADOW_SOFTNESS = 3.5; // PCF radius in shadow-map texels
const CONTACT_OPACITY = 0.5;

export function createStage(canvas, { shadowSize = 2048, sceneId = 'classic' } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Neutral keeps hues and saturation (ACES pulls bright colours towards white).
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  // PCF with a radius gives soft-edged, clearly visible shadows
  // (PCFSoftShadowMap ignores the radius).
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.autoClear = false;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(30, 9 / 16, 0.5, 60);

  const key = new THREE.DirectionalLight(0xfff1e2, 3.1);
  key.position.set(-3.6, 7.5, 4.2);
  key.target.position.set(0, 0, 0.3);
  key.castShadow = true;
  key.shadow.mapSize.set(shadowSize, shadowSize);
  key.shadow.camera.left = -3.4;
  key.shadow.camera.right = 3.4;
  key.shadow.camera.top = 3.4;
  key.shadow.camera.bottom = -3.4;
  key.shadow.camera.near = 2;
  key.shadow.camera.far = 18;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.015;
  key.shadow.radius = SHADOW_SOFTNESS;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xc9dcff, 1.3);
  rim.position.set(3.5, 3.2, -4.5);
  scene.add(rim);
  const hemi = new THREE.HemisphereLight(0xdde8ff, 0x3a2b20, 0.5);
  scene.add(hemi);

  // the kitchen set (board, counter, wall) can be swapped at any time
  let set = null;
  const setScene = (id) => {
    if (set) {
      scene.remove(set);
      disposeSet(set);
    }
    set = buildSet(id, scene, hemi);
    scene.add(set);
  };
  setScene(sceneId);

  const contact = contactShadow();
  scene.add(contact);

  return { renderer, scene, camera, key, contact, setScene };
}

// Soft darkening right under the item where it rests on the board (ambient
// occlusion the shadow map alone does not give). Unit size; placed per round.
function contactShadow() {
  const tex = canvasTexture(128, 128, (g, w, h) => {
    const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    r.addColorStop(0, 'rgba(0,0,0,1)');
    r.addColorStop(0.55, 'rgba(0,0,0,0.7)');
    r.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, w, h);
  });
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: tex, color: 0x140904, transparent: true, opacity: CONTACT_OPACITY, depthWrite: false, toneMapped: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 1;
  return mesh;
}

// Fit the contact shadow to what still stands of the item: its bbox (board
// space, board top y = 0) behind the front-to-back clip plane.
export function placeContactShadow(contact, round, visible, clipZ = Infinity) {
  const { min, max } = round.bbox;
  const back = min[2];
  const front = Math.min(max[2], clipZ);
  contact.visible = visible && front > back + 0.05;
  if (!contact.visible) return;
  contact.position.set((min[0] + max[0]) / 2, 0.004, (back + front) / 2);
  contact.scale.set((max[0] - min[0]) * 1.12, (front - back) * 1.12, 1);
}

// Framing from the camera plan plus a small kick on every chop.
export function placeCamera(camera, t, shake, plan) {
  const { position, target } = cameraPose(cameraView(plan, t));
  camera.position.set(position[0], position[1] + shake, position[2]);
  camera.lookAt(target[0], target[1] + shake * 0.5, target[2]);
}
