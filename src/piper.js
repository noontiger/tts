// Piper engine: real Piper-family VITS via piper-plus (offline, vendored).
import { PiperPlus } from 'piper-plus';
import * as ort from 'onnxruntime-web';

const BASE = import.meta.env.BASE_URL; // e.g. /tts/

// Share the vendored onnxruntime-web WASM with Transformers.js.
// The coi-serviceworker (loaded in index.html) enables crossOriginIsolated on
// GitHub Pages, so SharedArrayBuffer is available and we can use threads.
const numThreads = (typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated)
  ? Math.min(4, navigator.hardwareConcurrency || 4)
  : 1;
ort.env.wasm.wasmPaths = BASE + 'wasm/';
ort.env.wasm.numThreads = numThreads;

const MODEL_URL = BASE + 'piper/css10-ja-6lang-fp16.onnx';
const WASM_G2P_URL = BASE + 'piper/piper_plus_wasm.js';

let instance = null;
let loadingPromise = null;

export const PIPER_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'zh', label: '中文' },
  { code: 'ja', label: '日本語' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'pt', label: 'Português' },
];

/**
 * Lazily initialize the Piper engine (downloads are local/vendored).
 * @param {(e:{stage:string,progress:number,message:string})=>void} onProgress
 */
export async function ensureLoaded(onProgress) {
  if (instance) return instance;
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    instance = await PiperPlus.initialize({
      model: MODEL_URL,
      ort,
      wasmG2pUrl: WASM_G2P_URL,
      onProgress,
    });
    return instance;
  })();
  return loadingPromise;
}

/**
 * Synthesize text with Piper.
 * @param {string} text
 * @param {string} langCode - 'en'|'zh'|'ja'|'es'|'fr'|'pt'
 * @param {number} speed
 * @returns {Promise<{blob: Blob, url: string, sampleRate: number}>}
 */
export async function synthesize(text, langCode, speed = 1, onProgress) {
  const piper = await ensureLoaded(onProgress);
  const lengthScale = 1 / Math.max(0.1, speed);
  const result = await piper.synthesize(text, { language: langCode, lengthScale });
  const blob = result.toBlob ? result.toBlob() : new Blob([result.toWav()], { type: 'audio/wav' });
  const url = URL.createObjectURL(blob);
  return { blob, url, sampleRate: result.sampleRate || 22050 };
}
