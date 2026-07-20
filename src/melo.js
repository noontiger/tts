// Melo-class engine: MMS-TTS (multilingual VITS) via Transformers.js.
// NOTE: The official MyShell "Melo" checkpoint has no public ONNX build, so it
// cannot run in the browser. We use MMS-TTS (Xenova) — a Melo-class multilingual
// VITS — vendored locally so the site works fully offline. See README.
import { pipeline, env } from '@huggingface/transformers';

const BASE = import.meta.env.BASE_URL; // e.g. /tts/

// Allow only local (vendored) model files — no network calls to the Hub.
env.allowRemoteModels = false;

// transformers.js configures onnxruntime-web via `env.backends.onnx.wasm.*`
// (env.backends.onnx === ONNX_ENV). Point it at our vendored WASM.
const numThreads = (typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated)
  ? Math.min(4, navigator.hardwareConcurrency || 4)
  : 1;
env.backends.onnx.wasm.wasmPaths = BASE + 'wasm/';
env.backends.onnx.wasm.numThreads = numThreads;

export const MELO_LANGUAGES = [
  { code: 'eng', label: 'English', dir: 'mms/eng' },
  { code: 'spa', label: 'Español', dir: 'mms/spa' },
  { code: 'fra', label: 'Français', dir: 'mms/fra' },
  { code: 'deu', label: 'Deutsch', dir: 'mms/deu' },
];

const cache = new Map();

async function getPipeline(lang, onProgress) {
  if (cache.has(lang.dir)) return cache.get(lang.dir);
  const p = pipeline('text-to-speech', BASE + 'models/' + lang.dir, {
    dtype: 'q8',
    progress_callback: (e) => {
      if (e.status === 'progress' && typeof e.progress === 'number') {
        onProgress?.(e.progress, `加载音色模型… ${Math.round(e.progress)}%`);
      }
    },
  });
  cache.set(lang.dir, p);
  return p;
}

let onProgress = null;
export function setProgressHandler(fn) { onProgress = fn; }

// Encode a Float32Array of mono samples into a 16-bit PCM WAV Blob.
function encodeWav(samples, sampleRate) {
  const numSamples = samples.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);
  const writeStr = (off, s) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);
  let off = 44;
  for (let i = 0; i < numSamples; i++) {
    let s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Synthesize text using the Melo-class (MMS-TTS) engine.
 * @param {string} text
 * @param {string} langCode - one of MELO_LANGUAGES[].code
 * @param {number} speed
 * @returns {Promise<{blob: Blob, url: string, sampleRate: number}>}
 */
export async function synthesize(text, langCode, speed = 1, onProgress) {
  const lang = MELO_LANGUAGES.find((l) => l.code === langCode) || MELO_LANGUAGES[0];
  const tts = await getPipeline(lang.dir, onProgress);
  const out = await tts(text, { speed });
  const samples = out.audio instanceof Float32Array ? out.audio : Float32Array.from(out.audio);
  const sampleRate = out.sampling_rate || 22050;
  const blob = encodeWav(samples, sampleRate);
  const url = URL.createObjectURL(blob);
  return { blob, url, sampleRate };
}
