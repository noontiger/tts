import './style.css';
import * as melo from './melo.js';
import * as piper from './piper.js';

const $ = (id) => document.getElementById(id);

const THEMES = [
  { id: 'tech', label: '科技感', color: '#38bdf8' },
  { id: 'eye', label: '护眼', color: '#5a8f3c' },
  { id: 'white', label: '白色', color: '#2f6dfc' },
  { id: 'blue', label: '简约蓝', color: '#4f9bff' },
];

const ENGINE_NOTES = {
  melo:
    'Melo 引擎：使用 MMS-TTS 多语种 VITS。说明——官方 MyShell「Melo」尚未发布浏览器端 ONNX 权重，' +
    '此处采用同级的浏览器端多语种模型（完全离线）替代。支持 英 / 西 / 法 / 德。',
  piper:
    'Piper 引擎：piper-plus 离线多语种 VITS（ja / en / zh / es / fr / pt）。' +
    '首次加载会启用跨源隔离（页面自动刷新一次）以支持浏览器端多线程推理。',
};

let currentEngine = 'melo';
let currentUrl = null;

/* ---------------- Theme switcher ---------------- */
function buildThemeMenu() {
  const menu = $('theme-menu');
  menu.innerHTML = '';
  THEMES.forEach((t) => {
    const opt = document.createElement('div');
    opt.className = 'theme-opt';
    opt.innerHTML = `<span class="theme-dot" style="background:${t.color}"></span><span>${t.label}</span>`;
    opt.addEventListener('click', () => setTheme(t.id));
    menu.appendChild(opt);
  });
}
function setTheme(id) {
  const t = THEMES.find((x) => x.id === id);
  if (!t) return;
  document.documentElement.setAttribute('data-theme', id);
  try { localStorage.setItem('tts-theme', id); } catch (e) {}
  $('theme-current').textContent = t.label;
  $('theme-wrap').removeAttribute('open');
}
function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem('tts-theme'); } catch (e) {}
  const active = THEMES.find((x) => x.id === saved) || THEMES[0];
  document.documentElement.setAttribute('data-theme', active.id);
  $('theme-current').textContent = active.label;
  buildThemeMenu();
}

/* ---------------- Engine tabs ---------------- */
function setEngine(engine) {
  currentEngine = engine;
  document.querySelectorAll('#engine-tabs .tab').forEach((b) =>
    b.classList.toggle('active', b.dataset.engine === engine)
  );
  $('melo-controls').classList.toggle('hidden', engine !== 'melo');
  $('piper-controls').classList.toggle('hidden', engine !== 'piper');
  $('engine-note').textContent = ENGINE_NOTES[engine];
}

/* ---------------- Populate selects ---------------- */
function populateSelect(sel, items, selected) {
  sel.innerHTML = '';
  items.forEach((it) => {
    const o = document.createElement('option');
    o.value = it.code;
    o.textContent = it.label;
    if (it.code === selected) o.selected = true;
    sel.appendChild(o);
  });
}

/* ---------------- Progress ---------------- */
function showProgress(msg) {
  $('progress').classList.remove('hidden');
  $('progress-status').textContent = msg;
  $('progress-fill').style.width = '0%';
}
function setProgress(pct, msg) {
  $('progress-fill').style.width = Math.max(0, Math.min(100, pct)) + '%';
  if (msg) $('progress-status').textContent = msg;
}
function hideProgress() {
  $('progress').classList.add('hidden');
}

function showError(msg) {
  const e = $('error');
  e.textContent = msg;
  e.classList.remove('hidden');
}
function clearError() {
  $('error').classList.add('hidden');
}

/* ---------------- Synthesize ---------------- */
async function synthesize() {
  clearError();
  // GitHub Pages needs cross-origin isolation for the threaded WASM. The
  // coi-serviceworker (loaded in index.html) enables it and reloads once.
  if (typeof crossOriginIsolated === 'undefined' || !crossOriginIsolated) {
    showError('正在启用跨源隔离环境，页面将自动刷新，请稍候重试。');
    return;
  }
  const text = $('text').value.trim();
  if (!text) {
    showError('请输入要合成的文本。');
    return;
  }
  const speed = parseFloat($('speed').value) || 1;

  $('synth').disabled = true;
  $('stop').disabled = false;
  showProgress('初始化引擎…');

  const onProg = (e) => {
    if (e && typeof e.progress === 'number') setProgress(e.progress, e.message || '处理中…');
    else if (e && e.message) setProgress(null, e.message);
  };

  try {
    let res;
    if (currentEngine === 'melo') {
      const lang = $('melo-voice').value;
      setProgress(10, '加载 Melo 模型…');
      res = await melo.synthesize(text, lang, speed, onProg);
    } else {
      const lang = $('piper-lang').value;
      setProgress(10, '加载 Piper 模型…');
      res = await piper.synthesize(text, lang, speed, onProg);
    }
    if (currentUrl) URL.revokeObjectURL(currentUrl);
    currentUrl = res.url;
    $('audio').src = res.url;
    const fname = `tts-${currentEngine}.wav`;
    $('download').href = res.url;
    $('download').setAttribute('download', fname);
    $('result').classList.remove('hidden');
    setProgress(100, '完成 ✓');
  } catch (err) {
    console.error(err);
    showError('合成失败：' + (err && err.message ? err.message : err) +
      '\n（若为 Piper 引擎，请确认浏览器支持多线程 WASM；中文/日文需 Rust 语音前端已加载）');
  } finally {
    $('synth').disabled = false;
    $('stop').disabled = true;
    setTimeout(hideProgress, 1200);
  }
}

/* ---------------- Init ---------------- */
function init() {
  initTheme();
  setEngine('melo');
  populateSelect($('melo-voice'), melo.MELO_LANGUAGES, 'eng');
  populateSelect($('piper-lang'), piper.PIPER_LANGUAGES, 'en');

  document.querySelectorAll('#engine-tabs .tab').forEach((b) =>
    b.addEventListener('click', () => setEngine(b.dataset.engine))
  );
  $('speed').addEventListener('input', () => {
    $('speed-val').textContent = parseFloat($('speed').value).toFixed(1);
  });
  $('synth').addEventListener('click', synthesize);
  $('stop').addEventListener('click', () => {
    if (currentUrl) { URL.revokeObjectURL(currentUrl); currentUrl = null; }
    $('result').classList.add('hidden');
    $('audio').removeAttribute('src');
  });
  // Close theme menu when clicking outside.
  document.addEventListener('click', (e) => {
    if (!$('theme-wrap').contains(e.target)) $('theme-wrap').removeAttribute('open');
  });
}

init();
