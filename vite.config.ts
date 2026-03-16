import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';
import path from 'path';
import fs from 'fs/promises';

function copyOnnxWasmPlugin(): Plugin {
  return {
    name: 'copy-onnx-wasm',
    apply: 'build',
    async closeBundle() {
      const root = process.cwd();
      const destDir = path.resolve(root, 'dist/wasm');
      await fs.mkdir(destDir, { recursive: true });

      // Copy WASM files from onnxruntime-web (used for direct ONNX inference)
      const ortDir = path.resolve(root, 'node_modules/onnxruntime-web/dist');
      const files = [
        'ort-wasm-simd-threaded.mjs',
        'ort-wasm-simd-threaded.wasm',
        'ort-wasm-simd-threaded.jsep.mjs',
        'ort-wasm-simd-threaded.jsep.wasm',
      ];
      for (const f of files) {
        try {
          await fs.copyFile(path.join(ortDir, f), path.join(destDir, f));
          console.log(`[copy-onnx-wasm] copied ${f}`);
        } catch (err) {
          console.warn(`[copy-onnx-wasm] could not copy ${f}:`, err);
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
    copyOnnxWasmPlugin(),
  ],
  build: {
    rollupOptions: {
      input: {
        popup: 'src/popup/index.html',
        offscreen: 'src/offscreen/offscreen.html',
      },
    },
  },
  optimizeDeps: {
    exclude: ['onnxruntime-web'],
  },
});
