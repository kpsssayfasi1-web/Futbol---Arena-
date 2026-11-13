// Page controller: settings, transport, recording and export UI.
import { App } from './app.js';
import { canExport } from './exporter.js';
import { pickRecorderMime } from './recorder.js';
import { roundIndexAt } from './timeline.js';
import { fruitById } from './fruits.js';

const $ = (id) => document.getElementById(id);
const STORAGE_KEY = 'meyve-kesme-settings-v1';
const DEFAULTS = { fruit: 'apple', preset: 'classic', speed: '1', lang: 'en', handle: '', quality: 'auto', sound: true, loop: false };
const params = new URLSearchParams(location.search);

function loadSettings() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    saved = {};
  }
  const s = { ...DEFAULTS, ...saved };
  for (const key of ['fruit', 'preset', 'speed', 'lang', 'quality', 'handle']) if (params.has(key)) s[key] = params.get(key);
  if (params.has('sound')) s.sound = params.get('sound') !== '0';
  s.speed = String(Math.min(2, Math.max(0.5, Number(s.speed) || 1)));
  s.handle = String(s.handle || '').trim().slice(0, 32);
  if (!['tr', 'en'].includes(s.lang)) s.lang = DEFAULTS.lang;
  if (!['auto', 'low', 'medium', 'high'].includes(s.quality)) s.quality = DEFAULTS.quality;
  if (!['apple', 'watermelon', 'orange', 'kiwi', 'mix'].includes(s.fruit)) s.fruit = DEFAULTS.fruit;
  if (!['classic', 'short', 'legend'].includes(s.preset)) s.preset = DEFAULTS.preset;
  if (params.has('shadow')) s.shadowSize = Math.min(4096, Math.max(256, Number(params.get('shadow')) || 1024));
  return s;
}

function saveSettings(s) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
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

function bindSeg(id, key, onChange) {
  const el = $(id);
  const sync = () => el.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === String(settings[key]))));
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    settings[key] = b.dataset.value;
    sync();
    saveSettings(settings);
    onChange();
  });
  sync();
}

const rebuild = () => {
  app.rebuild();
  updateInfo();
};
bindSeg('fruitSeg', 'fruit', rebuild);
bindSeg('presetSeg', 'preset', () => {
  app.seek(0);
  rebuild();
});
bindSeg('speedSeg', 'speed', rebuild);
bindSeg('langSeg', 'lang', () => app.hud.invalidate());
bindSeg('qualitySeg', 'quality', rebuild);

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
$('exportBtn').addEventListener('click', async () => {
  if (!canExport()) {
    $('exportNote').textContent = 'Bu tarayıcı kare kare MP4 oluşturmayı desteklemiyor. Chrome, Edge veya güncel Safari kullan; ya da Canlı kayıt düğmesini dene.';
    return;
  }
  cancelled = false;
  $('exportModal').hidden = false;
  $('exportBar').style.width = '0%';
  $('exportStatus').textContent = 'Ses hazırlanıyor…';
  $('startOverlay').hidden = true;
  setPlaying(false);
  try {
    const res = await app.exportVideo({
      onProgress: (p) => {
        $('exportBar').style.width = `${(p * 100).toFixed(1)}%`;
        $('exportStatus').textContent = `Kareler işleniyor: %${Math.round(p * 100)}`;
      },
      isCancelled: () => cancelled,
    });
    if (!res) $('exportNote').textContent = 'MP4 oluşturma iptal edildi.';
    else if (res.saved === 'declined') $('exportNote').textContent = 'Video kaydedilmedi. Tekrar denemek için MP4 oluştur düğmesine bas.';
    else $('exportNote').textContent = `Video kaydedildi (${res.codec}${res.audio ? ` + ${res.audio}` : ', sessiz'}).`;
  } catch (err) {
    $('exportNote').textContent = `MP4 oluşturulamadı: ${err.message}. Canlı kayıt düğmesini deneyebilirsin.`;
  } finally {
    $('exportModal').hidden = true;
  }
});

if (pickRecorderMime() === null) $('recordBtn').disabled = true;

function updateInfo() {
  const tl = app.timeline;
  const ri = roundIndexAt(tl, app.time);
  const r = tl.rounds[ri];
  const name = fruitById(r.fruitId).tr;
  $('roundPill').textContent = `Tur ${ri + 1}/${tl.rounds.length} · ${name} · ${r.cuts.toLocaleString('tr-TR')} kesim${app.buffering ? ' · hazırlanıyor…' : ''}`;
  $('timeText').textContent = `${fmt(app.time)} / ${fmt(app.duration)}`;
  if (!scrubbing) $('scrub').value = String(Math.round((app.time / app.duration) * 1000));
}

let lastInfo = 0;
function loop(now) {
  requestAnimationFrame(loop);
  app.frame(now);
  if (now - lastInfo > 200) {
    lastInfo = now;
    updateInfo();
  }
}

document.fonts?.load('800 100px Poppins').then(() => app.hud.invalidate()).catch(() => {});
fit();
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
