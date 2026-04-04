import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path"
import tailwindcss from "@tailwindcss/vite"
import svgr from "vite-plugin-svgr";
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// https://vite.dev/config/

import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill';
import { NodeModulesPolyfillPlugin } from '@esbuild-plugins/node-modules-polyfill';
import rollupNodePolyfills from 'rollup-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    // Must run before Vite's internal browser-external handler
    {
      name: 'buffer-polyfill',
      enforce: 'pre' as const,
      resolveId(id: string) {
        if (id === 'buffer') return require.resolve('buffer');
      },
    },
    react(),
    tailwindcss(),
    svgr()
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: ['buffer'],
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
      plugins: [
        NodeGlobalsPolyfillPlugin({ buffer: true }),
        NodeModulesPolyfillPlugin()
      ]
    }
  },
  build: {
    rollupOptions: {
      plugins: [
        rollupNodePolyfills() as any
      ]
    }
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
