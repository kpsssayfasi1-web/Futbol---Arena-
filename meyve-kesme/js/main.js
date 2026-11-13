// Page controller: settings, item picker, transport, music, export and batch.
import { App } from './app.js';
import { canExport } from './exporter.js';
import { pickRecorderMime } from './recorder.js';
import { roundIndexAt } from './timeline.js';
import { CATEGORIES, ITEMS, itemById, itemsInCategory, isValidSelection } from './catalog/index.js';
import { shortsCopy } from './titles.js';
import { displayedCubeTotal } from './cubes-data.js';

const $ = (id) => document.getElementById(id);
const STORAGE_KEY = 'kesim-studyosu-settings-v3';
const DEFAULTS = { item: 'apple', preset: 'classic', speed: '1', lang: 'en', handle: '', quality: 'auto', sound: true, loop: false, music: 'jazz', musicVolume: 0.2, hook: true, seed: 1 };
const MUSIC = ['jazz', 'waltz', 'swing', 'baroque', 'musette', 'custom', 'off'];
const params = new URLSearchParams(location.search);

function loadSettings() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    saved = {};
  }
  const s = { ...DEFAULTS, ...saved };
  for (const key of ['item', 'preset', 'speed', 'lang', 'quality', 'handle', 'music', 'seed']) if (params.has(key)) s[key] = params.get(key);
  if (params.has('sound')) s.sound = params.get('sound') !== '0';
  if (params.has('hook')) s.hook = params.get('hook') !== '0';
  if (params.has('shadow')) s.shadowSize = Math.min(4096, Math.max(256, Number(params.get('shadow')) || 1024));
  s.speed = String(Math.min(2, Math.max(0.5, Number(s.speed) || 1)));
  s.handle = String(s.handle || '').trim().slice(0, 32);
  s.seed = Math.max(1, Math.floor(Number(s.seed) || 1));
  s.musicVolume = Number.isFinite(Number(s.musicVolume)) ? Math.min(1, Math.max(0, Number(s.musicVolume))) : DEFAULTS.musicVolume;
  if (!['tr', 'en'].includes(s.lang)) s.lang = DEFAULTS.lang;
  if (!['auto', 'low', 'medium', 'high'].includes(s.quality)) s.quality = DEFAULTS.quality;
  if (!isValidSelection(s.item)) s.item = DEFAULTS.item;
  if (!['classic', 'short', 'legend'].includes(s.preset)) s.preset = DEFAULTS.preset;
  // A custom track is not stored, so a reload falls back to the default style.
  if (!MUSIC.includes(s.music) || s.music === 'custom') s.music = DEFAULTS.music;
  return s;
}

function saveSettings(s) {
  try {
    const { shadowSize, ...rest } = s;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
  } catch {
    /* storage unavailable: settings just won't persist */
  }
}

const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

const settings = loadSettings();
const canvas = $('view');
const stage = $('stage');
const app = new App(canvas, settings, {
  onRecording: (on) => {
    $('recordBtn').setAttribute('aria-pressed', String(on));
    $('recordBtn').querySelector('span').textContent = on ? 'Kaydı durdur' : 'Canlı kayıt';
    showBadge(on ? 'KAYIT' : '', on);
  },
  onResize: () => fit(),
  onSaved: (status) => {
    $('exportNote').textContent = status === 'declined' ? 'Kayıt kaydedilmedi.' : 'Canlı kayıt kaydedildi.';
  },
});
window.__app = app;

function showBadge(text, rec = false) {
  const b = $('statusBadge');
  b.hidden = !text;
  b.textContent = text;
  b.classList.toggle('rec', rec);
}

function fit() {
  const r = stage.getBoundingClientRect();
  const maxRatio = params.has('capture') ? 1 : Math.min(2, window.devicePixelRatio || 1);
  app.resize(Math.max(1, Math.round(r.width)), Math.max(1, Math.round(r.height)), maxRatio);
}
new ResizeObserver(fit).observe(stage);

const rebuild = () => {
  app.rebuild();
  updateInfo(true);
};

function bindSeg(id, key, onChange) {
  const el = $(id);
  const sync = () => el.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === String(settings[key]))));
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    settings[key] = b.dataset.value;
    sync();
    saveSettings(settings);
    onChange(b.dataset.value);
  });
  sync();
  return sync;
}

// ---------- item picker ----------
let activeCat = settings.item.startsWith('mix:') ? settings.item.slice(4) : itemById(settings.item).cat;
if (activeCat !== 'all' && !CATEGORIES.some((c) => c.id === activeCat)) activeCat = 'fruit';

function renderTabs() {
  const tabs = [...CATEGORIES.map((c) => ({ id: c.id, label: c.tr })), { id: 'all', label: 'Hepsi' }];
  $('catTabs').innerHTML = '';
  for (const t of tabs) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.textContent = t.label;
    b.setAttribute('aria-selected', String(t.id === activeCat));
    b.addEventListener('click', () => {
      activeCat = t.id;
      renderTabs();
      renderItems();
    });
    $('catTabs').appendChild(b);
  }
}

function itemButton(value, label, color) {
  const b = document.createElement('button');
  b.type = 'button';
  b.dataset.value = value;
  const dot = document.createElement('span');
  dot.className = 'dot';
  dot.style.background = color;
  b.append(dot, label);
  b.setAttribute('aria-pressed', String(settings.item === value));
  return b;
}

function renderItems() {
  const grid = $('itemGrid');
  grid.innerHTML = '';
  const list = activeCat === 'all' ? ITEMS : itemsInCategory(activeCat);
  const mixLabel = activeCat === 'all' ? 'Hepsinden karışık' : 'Karışık';
  grid.appendChild(itemButton(`mix:${activeCat}`, mixLabel, 'conic-gradient(#c8281e 0 25%,#2f7a2a 0 50%,#f28a12 0 75%,#2f6fd1 0)'));
  for (const it of list) grid.appendChild(itemButton(it.id, it.tr.charAt(0) + it.tr.slice(1).toLocaleLowerCase('tr-TR'), it.dot));
}
$('itemGrid').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  settings.item = b.dataset.value;
  saveSettings(settings);
  renderItems();
  app.seek(0);
  rebuild();
});
renderTabs();
renderItems();

bindSeg('presetSeg', 'preset', () => {
  app.seek(0);
  rebuild();
});
bindSeg('speedSeg', 'speed', rebuild);
bindSeg('langSeg', 'lang', () => {
  app.hud.invalidate();
  updateInfo(true);
});
bindSeg('qualitySeg', 'quality', rebuild);
const syncMusic = bindSeg('musicSeg', 'music', (v) => {
  $('musicFileRow').hidden = v !== 'custom';
  if (v === 'custom' && !app.customMusic) $('exportNote').textContent = 'Bir ses dosyası seç. Seçmezsen video müziksiz olur.';
  app.refreshMusic();
});
$('musicFileRow').hidden = settings.music !== 'custom';
$('musicFile').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const ctx = app.audio.ensure();
    const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
    await app.setCustomMusic(buffer);
    $('exportNote').textContent = `Müzik yüklendi: ${file.name} (${Math.round(buffer.duration)} sn, gerekirse başa sarar).`;
  } catch {
    $('exportNote').textContent = 'Bu ses dosyası açılamadı. mp3, wav veya m4a dene.';
  }
});
$('musicVol').value = String(settings.musicVolume);
$('musicVol').addEventListener('input', (e) => {
  settings.musicVolume = Number(e.target.value);
  saveSettings(settings);
  if (settings.music !== 'off') app.audio.setVolumes({ music: settings.musicVolume });
});
function showSeed() {
  $('seedText').textContent = `şu an #${settings.seed}`;
}
showSeed();
$('variantBtn').addEventListener('click', () => {
  settings.seed = (settings.seed % 9999) + 1 + Math.floor(Math.random() * 50);
  saveSettings(settings);
  showSeed();
  app.seek(0);
  rebuild();
});

$('hookToggle').checked = settings.hook !== false;
$('hookToggle').addEventListener('change', (e) => {
  settings.hook = e.target.checked;
  saveSettings(settings);
  app.hud.invalidate();
});
$('handleInput').value = settings.handle;
$('handleInput').addEventListener('input', (e) => {
  settings.handle = e.target.value.trim().slice(0, 32);
  saveSettings(settings);
});
$('soundToggle').checked = settings.sound;
$('soundToggle').addEventListener('change', (e) => {
  settings.sound = e.target.checked;
  saveSettings(settings);
  if (settings.sound) app.audio.ensure();
  app.resetClock();
});
$('loopToggle').checked = settings.loop;
$('loopToggle').addEventListener('change', (e) => {
  settings.loop = e.target.checked;
  saveSettings(settings);
});

// ---------- transport ----------
function setPlaying(on) {
  if (on) app.play();
  else app.pause();
  $('playBtn').textContent = on ? 'Ⅱ' : '▶';
  $('playBtn').setAttribute('aria-label', on ? 'Duraklat' : 'Oynat');
  $('startOverlay').hidden = true;
}
$('startBtn').addEventListener('click', () => setPlaying(true));
$('playBtn').addEventListener('click', () => setPlaying(!app.playing));
$('restartBtn').addEventListener('click', () => {
  app.seek(0);
  setPlaying(true);
});
$('sheetBtn').addEventListener('click', () => $('side').classList.toggle('open'));

let scrubbing = false;
$('scrub').addEventListener('input', (e) => {
  scrubbing = true;
  app.seek((Number(e.target.value) / 1000) * app.duration);
});
$('scrub').addEventListener('change', () => {
  scrubbing = false;
});

$('cleanBtn').addEventListener('click', () => {
  $('app').classList.add('clean');
  $('side').classList.remove('open');
  setTimeout(fit, 50);
});
stage.addEventListener('click', (e) => {
  if (!$('app').classList.contains('clean') || e.target.closest('button')) return;
  $('app').classList.remove('clean');
  setTimeout(fit, 50);
});

// ---------- copy ----------
document.querySelectorAll('.copyBtn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const el = $(btn.dataset.copy);
    const done = () => {
      btn.textContent = 'Kopyalandı';
      setTimeout(() => (btn.textContent = 'Kopyala'), 1500);
    };
    const select = () => {
      const r = document.createRange();
      r.selectNodeContents(el);
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
      btn.textContent = 'Seçildi';
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(el.textContent).then(done, select);
    else select();
  });
});

// ---------- output ----------
$('recordBtn').addEventListener('click', () => {
  if (app.recorder) {
    app.finishRecording();
    return;
  }
  try {
    $('startOverlay').hidden = true;
    app.startRecording();
    $('playBtn').textContent = 'Ⅱ';
  } catch (err) {
    $('exportNote').textContent = `Canlı kayıt başlatılamadı: ${err.message}`;
  }
});

let cancelled = false;
$('cancelExport').addEventListener('click', () => {
  cancelled = true;
});

function runExport(label) {
  $('exportTitle').textContent = label;
  $('exportBar').style.width = '0%';
  $('exportStatus').textContent = 'Ses ve müzik hazırlanıyor…';
  return app.exportVideo({
    onProgress: (p) => {
      $('exportBar').style.width = `${(p * 100).toFixed(1)}%`;
      $('exportStatus').textContent = `Kareler işleniyor: %${Math.round(p * 100)}`;
    },
    isCancelled: () => cancelled,
  });
}

function exportBlocked() {
  if (canExport()) return false;
  $('exportNote').textContent = 'Bu tarayıcı kare kare MP4 oluşturmayı desteklemiyor. Chrome, Edge veya güncel Safari kullan; ya da Canlı kayıt düğmesini dene.';
  return true;
}

$('exportBtn').addEventListener('click', async () => {
  if (exportBlocked()) return;
  cancelled = false;
  $('exportModal').hidden = false;
  setPlaying(false);
  try {
    const res = await runExport('MP4 hazırlanıyor');
    if (!res) $('exportNote').textContent = 'MP4 oluşturma iptal edildi.';
    else if (res.saved === 'declined') $('exportNote').textContent = 'Video kaydedilmedi. Tekrar denemek için MP4 oluştur düğmesine bas.';
    else $('exportNote').textContent = `Video kaydedildi (${res.codec}${res.audio ? ` + ${res.audio}` : ', sessiz'}).`;
  } catch (err) {
    $('exportNote').textContent = `MP4 oluşturulamadı: ${err.message}. Canlı kayıt düğmesini deneyebilirsin.`;
  } finally {
    $('exportModal').hidden = true;
  }
});

// Batch: three videos with different items (from the open category) and music.
$('batchBtn').addEventListener('click', async () => {
  if (exportBlocked()) return;
  const original = { ...settings };
  const pool = activeCat === 'all' ? ITEMS : itemsInCategory(activeCat);
  const picks = [...pool].sort(() => Math.random() - 0.5).slice(0, 3);
  // Jazz stays jazz (each seed is a new key, tempo and tune); the vintage
  // styles rotate so the three videos sound different.
  const styles = ['waltz', 'swing', 'baroque', 'musette'];
  const keepMusic = ['off', 'custom', 'jazz'].includes(settings.music);
  cancelled = false;
  $('exportModal').hidden = false;
  setPlaying(false);
  let saved = 0;
  try {
    for (let i = 0; i < picks.length && !cancelled; i++) {
      Object.assign(settings, { item: picks[i].id, seed: Math.floor(Math.random() * 9000) + 1, music: keepMusic ? settings.music : styles[(styles.indexOf(original.music) + i + 4) % 4] });
      app.seek(0);
      app.rebuild();
      const res = await runExport(`Video ${i + 1}/${picks.length}: ${picks[i].tr}`);
      if (res && res.saved !== 'declined') saved++;
    }
    $('exportNote').textContent = cancelled ? `Seri durduruldu, ${saved} video kaydedildi.` : `${saved} video kaydedildi.`;
  } catch (err) {
    $('exportNote').textContent = `Seri üretim durdu: ${err.message}`;
  } finally {
    Object.assign(settings, original);
    syncMusic();
    app.seek(0);
    rebuild();
    $('exportModal').hidden = true;
  }
});

if (pickRecorderMime() === null) $('recordBtn').disabled = true;

// ---------- info ----------
function updateInfo(copyToo = false) {
  const tl = app.timeline;
  const ri = roundIndexAt(tl, app.time);
  const r = tl.rounds[ri];
  $('roundPill').textContent = `Tur ${ri + 1}/${tl.rounds.length} · ${itemById(r.itemId).tr} · ${r.cuts.toLocaleString('tr-TR')} kesim${app.buffering ? ' · hazırlanıyor…' : ''}`;
  $('timeText').textContent = `${fmt(app.time)} / ${fmt(app.duration)}`;
  if (!scrubbing) $('scrub').value = String(Math.round((app.time / app.duration) * 1000));
  if (copyToo) {
    const last = tl.rounds[tl.rounds.length - 1];
    const pile = app.piles.get(last.index);
    const copy = shortsCopy(settings, tl, pile ? displayedCubeTotal(pile.data, last.end) : 0);
    $('titleText').textContent = copy.title;
    $('descText').textContent = copy.description;
    $('tagsText').textContent = copy.tags;
  }
}

let lastInfo = 0;
let infoTicks = 0;
function loop(now) {
  requestAnimationFrame(loop);
  app.frame(now);
  if (now - lastInfo > 250) {
    lastInfo = now;
    updateInfo(++infoTicks % 8 === 0);
  }
}

document.fonts?.load('800 100px Poppins').then(() => app.hud.invalidate()).catch(() => {});
fit();
updateInfo(true);
if (params.has('t')) {
  app.seek(Number(params.get('t')));
  $('startOverlay').hidden = true;
}
if (params.has('capture')) {
  // Headless rendering: frames are drawn on demand through window.__app.
  $('app').classList.add('clean');
  $('startOverlay').hidden = true;
} else {
  requestAnimationFrame(loop);
}
