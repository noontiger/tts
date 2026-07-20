// Copies the onnxruntime-web WASM binaries (used by both Transformers.js and
// piper-plus) into public/wasm so the site runs fully offline (no CDN).
import { existsSync, mkdirSync, readdirSync, copyFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dest = join(root, 'public', 'wasm');

// Search for an onnxruntime-web dist directory inside node_modules.
function findOrtDist(dir) {
  if (!existsSync(dir)) return null;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (name === 'onnxruntime-web' && existsSync(join(full, 'dist'))) return join(full, 'dist');
    if (statSync(full).isDirectory() && name !== 'node_modules') {
      const nested = findOrtDist(full);
      if (nested) return nested;
    }
  }
  return null;
}

const ortDist = findOrtDist(join(root, 'node_modules'));
if (!ortDist) {
  console.error('[copy-wasm] onnxruntime-web dist not found in node_modules. Run npm install first.');
  process.exit(1);
}

mkdirSync(dest, { recursive: true });
let count = 0;
for (const f of readdirSync(ortDist)) {
  if (f.endsWith('.wasm') || f.endsWith('.mjs') || f.endsWith('.js')) {
    copyFileSync(join(ortDist, f), join(dest, f));
    count++;
  }
}
console.log(`[copy-wasm] copied ${count} onnxruntime-web files from ${ortDist} -> ${dest}`);

// Copy piper-plus Rust G2P WASM (used by the Piper engine) into public/piper/
const piperWasmSrc = join(root, 'node_modules', 'piper-plus', 'dist', 'rust-wasm');
if (existsSync(piperWasmSrc)) {
  const piperDest = join(root, 'public', 'piper');
  mkdirSync(piperDest, { recursive: true });
  let pcount = 0;
  for (const f of readdirSync(piperWasmSrc)) {
    if (f.endsWith('.wasm') || f.endsWith('.js')) {
      copyFileSync(join(piperWasmSrc, f), join(piperDest, f));
      pcount++;
    }
  }
  console.log(`[copy-wasm] copied ${pcount} piper-plus wasm files from ${piperWasmSrc} -> ${piperDest}`);
} else {
  console.warn('[copy-wasm] piper-plus rust-wasm not found; run npm install first.');
}
