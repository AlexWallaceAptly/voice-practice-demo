/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * GitHub Pages project sites live at /<repo>/.
 * Local/dev and user/org root pages use /.
 * Override with VITE_BASE if needed.
 */
function resolveBase(): string {
  if (process.env.VITE_BASE) return process.env.VITE_BASE
  if (process.env.GITHUB_REPOSITORY) {
    const repo = process.env.GITHUB_REPOSITORY.split('/')[1]
    if (repo) return `/${repo}/`
  }
  return '/'
}

const base = resolveBase()

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Voice Practice Demo',
        short_name: 'Voice Demo',
        description:
          'Compare three ways to add voice to citizenship civics study',
        theme_color: '#1e3a5f',
        background_color: '#f8fafc',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,svg,woff2,json,m4a,wav}'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/audio/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'audio-cache',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: ({ url }) =>
              url.hostname.includes('huggingface.co') ||
              url.hostname.includes('hf.co'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'whisper-model-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
  worker: {
    format: 'es',
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
