import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import { resolve } from 'path';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@main': resolve('src/main'),
        '@server': resolve('src/server'),
      },
    },
    define: {
      // In dev mode, pass the dashboard dev server URL to the main process
      // so it can load from localhost instead of a missing dist file.
      'process.env.ELECTRON_RENDERER_URL': JSON.stringify(
        process.env.NODE_ENV === 'development' ? 'http://localhost:5173' : ''
      ),
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    build: {
      rollupOptions: {
        input: resolve('src/renderer/index.html'),
      },
    },
  },
});
