import { Blob as NodeBlob } from 'node:buffer';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import manifest from './manifest.config';

const globalScope = globalThis as typeof globalThis & {
  Blob?: typeof Blob;
  File?: typeof File;
};

if (!globalScope.Blob) {
  globalScope.Blob = NodeBlob as unknown as typeof Blob;
}

if (!globalScope.File) {
  const BlobCtor = (globalScope.Blob ?? (NodeBlob as unknown as typeof Blob)) as typeof Blob;

  class FilePolyfill extends BlobCtor {
    name: string;
    lastModified: number;

    constructor(bits: BlobPart[], name: string, options: FilePropertyBag = {}) {
      super(bits, options);
      this.name = String(name);
      this.lastModified = options.lastModified ?? Date.now();
    }

    get [Symbol.toStringTag]() {
      return 'File';
    }
  }

  globalScope.File = FilePolyfill as unknown as typeof File;
}

export default defineConfig(async () => {
  const { crx } = await import('@crxjs/vite-plugin');

  return {
    plugins: [react(), crx({ manifest })],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        zod: fileURLToPath(new URL('./src/vendor/zod.ts', import.meta.url))
      }
    },
    build: {
      sourcemap: true
    },
    server: {
      host: 'localhost',
      port: 5173,
      strictPort: true,
      cors: {
        origin: '*'
      },
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
      }
    }
  };
});
