import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Genera un único dist/index.html autocontenido (JS y CSS en línea) que se abre con doble clic.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile({ removeViteModuleLoader: true })],
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2020', assetsInlineLimit: 100000000, cssCodeSplit: false, reportCompressedSize: false, chunkSizeWarningLimit: 4000 },
});
