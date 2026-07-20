// Downloads all TTS model assets and vendors them under public/ so the site
// runs fully offline. Run with: node scripts/download-models.mjs
// Writes to a .part file first, then atomically renames on success, so an
// interrupted run never leaves a corrupt (0-byte) final file.
import { mkdirSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const HF = 'https://huggingface.co';

const MMS_LANGS = ['eng', 'spa', 'fra', 'deu'];
const MMS_FILES = [
  'config.json',
  'tokenizer.json',
  'tokenizer_config.json',
  'special_tokens_map.json',
  'vocab.json',
  'added_tokens.json',
  'quantize_config.json',
  'onnx/model_quantized.onnx',
];

const jobs = [];
for (const lang of MMS_LANGS) {
  for (const f of MMS_FILES) {
    jobs.push({
      url: `${HF}/Xenova/mms-tts-${lang}/resolve/main/${f}`,
      out: join(root, 'public', 'models', 'mms', lang, f),
    });
  }
}
// Piper multilingual model (fp16) + sidecar config.
// piper-plus resolves `<model>.onnx.json` first, falling back to config.json,
// so we name the sidecar exactly `css10-ja-6lang-fp16.onnx.json`.
jobs.push({
  url: `${HF}/ayousanz/piper-plus-css10-ja-6lang/resolve/main/css10-ja-6lang-fp16.onnx`,
  out: join(root, 'public', 'piper', 'css10-ja-6lang-fp16.onnx'),
});
jobs.push({
  url: `${HF}/ayousanz/piper-plus-css10-ja-6lang/resolve/main/config.json`,
  out: join(root, 'public', 'piper', 'css10-ja-6lang-fp16.onnx.json'),
});

const MAX_RETRIES = 4;

function alreadyDone(out) {
  try {
    return statSync(out).size > 0;
  } catch {
    return false;
  }
}

async function download(job) {
  mkdirSync(dirname(job.out), { recursive: true });
  if (alreadyDone(job.out)) {
    console.log(`[skip] ${job.out.split('/public/')[1]}`);
    return;
  }
  const part = job.out + '.part';
  // Remove any stale partial.
  try { unlinkSync(part); } catch {}

  let attempt = 0;
  while (true) {
    attempt++;
    try {
      const res = await fetch(job.url, { redirect: 'follow' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const total = Number(res.headers.get('content-length')) || 0;
      const buf = new Uint8Array(await res.arrayBuffer());
      if (total && buf.byteLength !== total) {
        throw new Error(`size mismatch: got ${buf.byteLength}, expected ${total}`);
      }
      if (buf.byteLength === 0) throw new Error('empty body');
      writeFileSync(part, buf);
      renameSync(part, job.out);
      const mb = (buf.byteLength / 1048576).toFixed(1);
      console.log(`[ok] ${job.out.split('/public/')[1]} (${mb} MB)`);
      return;
    } catch (e) {
      try { unlinkSync(part); } catch {}
      if (attempt >= MAX_RETRIES) {
        throw new Error(`after ${MAX_RETRIES} tries: ${e.message}`);
      }
      console.warn(`[retry ${attempt}] ${job.url.split('/resolve/main/')[1]}: ${e.message}`);
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
}

let ok = 0, fail = 0;
for (const job of jobs) {
  try {
    await download(job);
    ok++;
  } catch (e) {
    fail++;
    console.error(`[FAIL] ${job.url}: ${e.message}`);
  }
}
console.log(`\nDone. ${ok} ok, ${fail} failed.`);
process.exit(fail ? 1 : 0);
