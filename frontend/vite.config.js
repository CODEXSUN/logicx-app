import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { readFileSync } from 'node:fs'

const appPackage = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const buildMetadata = { appName: appPackage.displayName, version: appPackage.version }

export default defineConfig({
  base: '/assets/logicx_app/frontend/',
  define: { __LOGICX_BUILD_METADATA__: JSON.stringify(buildMetadata) },
  plugins: [
    {
      name: 'logicx-build-metadata',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'build-metadata.json', source: JSON.stringify(buildMetadata) + '\n' })
      },
    },
    react(),
    tailwindcss(),
  ],
  build: {
    outDir: '../logicx_app/public/frontend',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@codexsun/ui/globals.css': path.resolve(__dirname, 'src/ui/src/styles/globals.css'),
      '@codexsun/ui': path.resolve(__dirname, 'src/ui/src'),
    },
  },
})
