import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolveGitHubPagesBase } from './src/deploy/githubPagesBase'

const isGitHubActions = process.env.GITHUB_ACTIONS === 'true'
const base = isGitHubActions
  ? resolveGitHubPagesBase(process.env.GITHUB_REPOSITORY, process.env.GITHUB_PAGES_BASE)
  : '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 525,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three/examples')) {
            return 'three-examples'
          }
          if (id.includes('node_modules/three')) {
            return 'three-vendor'
          }
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react-vendor'
          }
        },
      },
    },
  },
})
