// The whole item before it falls apart: its mesh (built in the worker from the
// item's distance function) with cut lines, plus the flat cut face (cap).
import * as THREE from 'three';
import { objectMaterials } from './materials.js';

export class ObjectModel {
  constructor(cut) {
    this.cut = cut;
    this.root = new THREE.Group(); // world offset (board top at y = 0)
    this.pivot = new THREE.Group(); // squash pivot at the bottom of the item
    this.content = new THREE.Group(); // object space
    this.root.add(this.pivot);
    this.pivot.add(this.content);
    this.cap = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6));
    this.cap.castShadow = true;
    this.cap.receiveShadow = true;
    this.cap.frustumCulled = false;
    this.content.add(this.cap);
    this.body = null;
    this.geometries = new Map();
    this.itemId = null;
  }

  hasGeometry(id) {
    return this.geometries.has(id);
  }

  addGeometry(id, mesh) {
    if (this.geometries.has(id)) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3));
    geo.setIndex(new THREE.BufferAttribute(mesh.index, 1));
    geo.computeBoundingSphere();
    this.geometries.set(id, geo);
  }

  // Keep only the meshes of items in use (current, previous, next).
  retain(ids) {
    for (const [id, geo] of this.geometries) {
      if (!ids.has(id) && id !== this.itemId) {
        geo.dispose();
        this.geometries.delete(id);
      }
    }
  }

  setItem(item) {
    if (this.itemId === item.id && this.body) return true;
    const geo = this.geometries.get(item.id);
    if (!geo) return false;
    const mats = objectMaterials(item, this.cut);
    if (this.body) this.content.remove(this.body);
    this.body = new THREE.Mesh(geo, mats.body);
    this.body.customDepthMaterial = mats.bodyDepth;
    this.body.castShadow = true;
    this.body.receiveShadow = true;
    this.content.add(this.body);
    this.cap.material = mats.cap;
    this.cap.customDepthMaterial = mats.capDepth;
    this.itemId = item.id;
    return true;
  }

  // Drop from above and squash on landing, pivoting on the bottom of the item.
  setIntro(round, t) {
    const boardY = round.boardY;
    const tau = t - round.start;
    const fall = round.land - round.start;
    this.root.position.y = -boardY;
    this.pivot.position.y = boardY;
    this.content.position.y = -boardY;
    let drop = 0;
    let sy = 1;
    if (tau < fall) {
      const k = Math.max(0, tau) / fall;
      drop = (1 - k * k) * 3.6;
      sy = 1 + 0.07 * k;
    } else if (fall > 0) {
      const k = tau - fall;
      sy = 1 - 0.17 * Math.exp(-k * 10) * Math.cos(k * 26);
    }
    this.root.position.y += drop;
    const sxz = 1 / Math.sqrt(sy);
    this.pivot.scale.set(sxz, sy, sxz);
  }

  setVisible(visible, capVisible) {
    this.root.visible = visible && !!this.body;
    this.cap.visible = capVisible;
  }
}
