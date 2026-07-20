# TTS 语音合成服务

浏览器端、完全离线的语音合成网站，提供 **Melo** 与 **Piper** 两大引擎的多语种音色。
所有模型与推理运行时均随仓库分发（vendored），**不依赖任何外部网络**。

## 引擎说明

- **Melo 标签页** —— 使用 [MMS-TTS](https://huggingface.co/Xenova)（多语种 VITS，Xenova 量化版）。
  说明：官方 MyShell **Melo** 目前没有发布浏览器端可用的 ONNX 权重，因此本处以同级的
  浏览器端多语种模型作为等价替代，覆盖 英 / 西 / 法 / 德。
- **Piper 标签页** —— 使用 [piper-plus](https://github.com/ayutaz/piper-plus)（ayousanz 的
  `css10-ja-6lang` fp16 多语种 VITS），覆盖 ja / en / zh / es / fr / pt。中文与日文依赖内置的
  Rust 语音前端（G2P）。

## 离线分发

- 模型：`public/models/mms/*`（MMS-TTS 量化权重）、`public/piper/*`（Piper 模型与配置）
- 运行时 WASM：`public/wasm/*`（onnxruntime-web）、`public/piper/*`（piper-plus Rust G2P wasm）

## 在 GitHub Pages 上运行（跨源隔离）

`onnxruntime-web` 的线程化 WASM 需要 `SharedArrayBuffer`，而 `SharedArrayBuffer` 仅在
**跨源隔离（cross-origin isolated）** 页面上可用。GitHub Pages 本身无法设置
`Cross-Origin-Opener-Policy` / `Cross-Origin-Embedder-Policy` 响应头，因此本仓库通过
`public/coi-serviceworker.js`（[coi-serviceworker](https://github.com/gzuidhof/coi-serviceworker)）
在客户端注入这两个响应头：页面首次加载时会自动注册 Service Worker 并刷新一次，之后即处于
跨源隔离状态，线程化 WASM 可正常运行。

> 浏览器支持：Chrome / Edge / Firefox 均正常。Safari 对通过 Service Worker 注入 COEP 的支持
> 不完整，可能无法启用跨源隔离，从而无法使用本服务的 WASM 推理。

## 本地开发

```bash
npm install
npm run dev        # Vite 开发服务器（localhost 为安全上下文，coi-serviceworker 同样生效）
npm run build      # 产出 dist/，由 GitHub Actions 部署到 GitHub Pages
```

本地若想脱离 Service Worker 验证跨源隔离，可让静态服务器带上以下响应头：
`Cross-Origin-Opener-Policy: same-origin` 与 `Cross-Origin-Embedder-Policy: require-corp`。
