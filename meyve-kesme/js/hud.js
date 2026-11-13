// Counters drawn into the WebGL canvas itself, so recordings include them.
// Layout uses a virtual 1080x1920 frame.
import * as THREE from 'three';

const W = 1080;
const H = 1920;
const FONT = '"Poppins", "Montserrat", "Segoe UI", Arial, sans-serif';
const GOLD = '#f6b941';

class TextBlock {
  constructor(width, height, y) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }),
    );
    this.mesh.position.set(W / 2, H - y, 0);
    this.key = '';
  }

  draw(key, paint) {
    if (key === this.key) return;
    this.key = key;
    const g = this.ctx;
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    g.shadowColor = 'rgba(0,0,0,0.55)';
    g.shadowBlur = 22;
    g.shadowOffsetY = 4;
    paint(g, this.canvas.width);
    this.texture.needsUpdate = true;
  }
}

function fitFont(g, text, weight, size, maxWidth) {
  let s = size;
  g.font = `${weight} ${s}px ${FONT}`;
  while (g.measureText(text).width > maxWidth && s > 20) {
    s -= 4;
    g.font = `${weight} ${s}px ${FONT}`;
  }
}

export class Hud {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(0, W, H, 0, -10, 10);
    this.top = new TextBlock(1000, 330, 230);
    this.bottom = new TextBlock(1000, 300, 1705);
    this.vignette = this.makeVignette();
    this.scene.add(this.vignette, this.top.mesh, this.bottom.mesh);
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

  update({ cuts, cubesText, labels, handle, t }) {
    if (cuts !== this.lastCuts) {
      if (cuts > this.lastCuts) this.popAt = t;
      this.lastCuts = cuts;
    }
    const cutsText = cuts.toLocaleString(labels.locale);
    this.top.draw(`${cutsText}|${labels.cuts}`, (g, w) => {
      fitFont(g, cutsText, 800, 190, w - 60);
      g.fillStyle = '#ffffff';
      g.fillText(cutsText, w / 2, 205);
      g.font = `800 64px ${FONT}`;
      g.fillStyle = GOLD;
      g.fillText(labels.cuts, w / 2, 285);
    });
    this.bottom.draw(`${cubesText}|${labels.cubes}|${handle}`, (g, w) => {
      if (handle) {
        g.font = `600 34px ${FONT}`;
        g.fillStyle = 'rgba(255,255,255,0.62)';
        g.fillText(handle, w / 2, 52);
      }
      fitFont(g, cubesText, 800, 118, w - 60);
      g.fillStyle = '#ffffff';
      g.fillText(cubesText, w / 2, 182);
      g.font = `800 54px ${FONT}`;
      g.fillStyle = GOLD;
      g.fillText(labels.cubes, w / 2, 248);
    });
    const k = Math.max(0, t - this.popAt);
    const pop = 1 + 0.07 * Math.exp(-k * 16);
    this.top.mesh.scale.setScalar(pop);
  }

  invalidate() {
    this.top.key = '';
    this.bottom.key = '';
  }

  render(renderer) {
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
  }
}
