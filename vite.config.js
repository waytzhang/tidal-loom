import { defineConfig } from 'vite';
export default defineConfig({ base: './', resolve: { dedupe: ['three'] }, server: { host: '127.0.0.1', port: 5187, strictPort: true }, build: { outDir: 'docs/site', emptyOutDir: true } });
