// Counters drawn into the WebGL canvas (so recordings include them), in a
// virtual 1080x1920 frame. Digits come from a glyph atlas built once, so a
// counter that changes every frame costs no texture upload.
import * as THREE from 'three';

const W = 1080;
const H = 1920;
const FONT = '"Poppins", "Montserrat", "Segoe UI", Arial, sans-serif';
const GOLD = '#f6b941';
const GLYPHS = '0123456789,.≈ ';
const ATLAS_SIZE = 180;
const CELL_H = 240;
const PAD = 26;

class GlyphAtlas {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 2048;
    this.canvas.height = CELL_H;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.generateMipmaps = true;
    this.texture.minFilter = THREE.LinearMipmapLinearFilter;
    this.build();
  }

  build() {
    const g = this.canvas.getContext('2d');
    g.clearRect(0, 0, this.canvas.width, CELL_H);
    g.font = `800 ${ATLAS_SIZE}px ${FONT}`;
    g.textBaseline = 'alphabetic';
    g.fillStyle = '#ffffff';
    g.shadowColor = 'rgba(0,0,0,0.6)';
    g.shadowBlur = 18;
    g.shadowOffsetY = 4;
    this.metrics = new Map();
    let x = 0;
    for (const ch of GLYPHS) {
      const adv = g.measureText(ch).width;
      const w = Math.ceil(adv + PAD * 2);
      g.fillText(ch, x + PAD, CELL_H - 50);
      this.metrics.set(ch, { u0: x / this.canvas.width, u1: (x + w) / this.canvas.width, w, adv });
      x += w;
    }
    this.texture.needsUpdate = true;
  }
}

class GlyphText {
  constructor(atlas, maxChars = 24) {
    this.atlas = atlas;
    this.max = maxChars;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(maxChars * 4 * 3), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(maxChars * 4 * 2), 2));
    const idx = [];
    for (let i = 0; i < maxChars; i++) idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
    geo.setIndex(idx);
    geo.setDrawRange(0, 0);
    this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: atlas.texture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
    this.mesh.frustumCulled = false;
    this.text = null;
  }

  // Lays out `text` centred on (cx, baseline) at font `size`, shrinking to maxWidth.
  set(text, cx, baseline, size, maxWidth) {
    const key = `${text}|${cx}|${baseline}|${size}`;
    if (key === this.text) return;
    this.text = key;
    const chars = [...text].filter((ch) => this.atlas.metrics.has(ch)).slice(0, this.max);
    let s = size / ATLAS_SIZE;
    const total = () => chars.reduce((sum, ch) => sum + this.atlas.metrics.get(ch).adv, 0) * s;
    if (total() > maxWidth) s *= maxWidth / total();
    const pos = this.mesh.geometry.attributes.position;
    const uv = this.mesh.geometry.attributes.uv;
    let x = cx - total() / 2;
    const top = baseline + (50 * s);
    chars.forEach((ch, i) => {
      const m = this.atlas.metrics.get(ch);
      const x0 = x - PAD * s;
      const x1 = x0 + m.w * s;
      const y0 = top - CELL_H * s;
      pos.setXYZ(i * 4, x0, H - top, 0);
      pos.setXYZ(i * 4 + 1, x1, H - top, 0);
      pos.setXYZ(i * 4 + 2, x1, H - y0, 0);
      pos.setXYZ(i * 4 + 3, x0, H - y0, 0);
      uv.setXY(i * 4, m.u0, 0);
      uv.setXY(i * 4 + 1, m.u1, 0);
      uv.setXY(i * 4 + 2, m.u1, 1);
      uv.setXY(i * 4 + 3, m.u0, 1);
      x += m.adv * s;
    });
    pos.needsUpdate = true;
    uv.needsUpdate = true;
    this.mesh.geometry.setDrawRange(0, chars.length * 6);
  }
}

// Static text (labels, handle, opening question), redrawn only when it changes.
class Label {
  constructor(width, height) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
    this.key = null;
  }

  draw(key, paint) {
    if (key === this.key) return;
    this.key = key;
    const g = this.canvas.getContext('2d');
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    g.textAlign = 'center';
    g.shadowColor = 'rgba(0,0,0,0.6)';
    g.shadowBlur = 20;
    g.shadowOffsetY = 4;
    paint(g, this.canvas.width, this.canvas.height);
    this.texture.needsUpdate = true;
  }
}

function wrapLines(g, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (g.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

export class Hud {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(0, W, H, 0, -10, 10);
    this.atlas = new GlyphAtlas();
    this.cuts = new GlyphText(this.atlas);
    this.cubes = new GlyphText(this.atlas);
    this.topLabel = new Label(900, 100);
    this.topLabel.mesh.position.set(W / 2, H - 330, 0);
    this.bottomLabel = new Label(1000, 260);
    this.bottomLabel.mesh.position.set(W / 2, H - 1700, 0);
    this.hook = new Label(1000, 330);
    this.hook.mesh.position.set(W / 2, H - 1420, 0);
    this.vignette = this.makeVignette();
    this.scene.add(this.vignette, this.cuts.mesh, this.cubes.mesh, this.topLabel.mesh, this.bottomLabel.mesh, this.hook.mesh);
    this.popAt = -10;
    this.lastCuts = 0;
  }

  makeVignette() {
    const c = document.createElement('canvas');
    c.width = 270;
    c.height = 480;
    const g = c.getContext('2d');
    const r = g.createRadialGradient(135, 230, 60, 135, 240, 330);
    r.addColorStop(0, 'rgba(0,0,0,0)');
    r.addColorStop(1, 'rgba(0,0,0,0.62)');
    g.fillStyle = r;
    g.fillRect(0, 0, 270, 480);
    const top = g.createLinearGradient(0, 0, 0, 120);
    top.addColorStop(0, 'rgba(0,0,0,0.55)');
    top.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = top;
    g.fillRect(0, 0, 270, 120);
    const bot = g.createLinearGradient(0, 360, 0, 480);
    bot.addColorStop(0, 'rgba(0,0,0,0)');
    bot.addColorStop(1, 'rgba(0,0,0,0.6)');
    g.fillStyle = bot;
    g.fillRect(0, 360, 270, 120);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
    m.position.set(W / 2, H / 2, -1);
    return m;
  }

  update({ cuts, cubesText, labels, handle, t, hook, hookAlpha }) {
    if (cuts !== this.lastCuts) {
      if (cuts > this.lastCuts) this.popAt = t;
      this.lastCuts = cuts;
    }
    const pop = 1 + 0.07 * Math.exp(-Math.max(0, t - this.popAt) * 16);
    this.cuts.set(cuts.toLocaleString(labels.locale), W / 2, 268, 190 * pop, 940);
    this.cubes.set(cubesText, W / 2, 1737, 118, 940);
    this.topLabel.draw(labels.cuts, (g, w) => {
      g.font = `800 64px ${FONT}`;
      g.fillStyle = GOLD;
      g.fillText(labels.cuts, w / 2, 72);
    });
    this.bottomLabel.draw(`${labels.cubes}|${handle}`, (g, w) => {
      g.font = `800 54px ${FONT}`;
      g.fillStyle = GOLD;
      g.fillText(labels.cubes, w / 2, 233);
      if (handle) {
        g.font = `600 34px ${FONT}`;
        g.fillStyle = 'rgba(255,255,255,0.62)';
        g.fillText(handle, w / 2, 37);
      }
    });
    this.hook.mesh.visible = !!hook && hookAlpha > 0.01;
    if (this.hook.mesh.visible) {
      this.hook.mesh.material.opacity = hookAlpha;
      this.hook.draw(hook, (g, w, h) => {
        g.font = `800 76px ${FONT}`;
        g.fillStyle = '#ffffff';
        const lines = wrapLines(g, hook, w - 80);
        lines.forEach((line, i) => g.fillText(line, w / 2, h / 2 - ((lines.length - 1) * 88) / 2 + i * 88 + 26));
      });
    }
  }

  invalidate() {
    this.atlas.build();
    this.cuts.text = null;
    this.cubes.text = null;
    this.topLabel.key = null;
    this.bottomLabel.key = null;
    this.hook.key = null;
  }

  render(renderer) {
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
  }
}
