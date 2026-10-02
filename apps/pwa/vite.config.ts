import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { IDENTITY_ASSETS } from '../../packages/core/src/identity-passwords/assets';
const assetCacheName = 'swiss-tesseract-7.0.0-eng-1.0.0';
export default defineConfig({
  // Prebundle the lazy worker dependency so its first use cannot reload the UI.
  optimizeDeps: { include: ['@swiss/core > tesseract.js'] },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'swiss - Local Dev Tools',
        short_name: 'Swiss',
        description:
          'Local Base64, OCR, Identity passwords and secure secret generators.',
        theme_color: '#15181d',
        background_color: '#15181d',
        display: 'standalone',
        lang: 'en',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        globIgnores: ['ocr/**', 'identity/**'],
        navigateFallbackDenylist: [/\/(ocr|identity)\//],
        runtimeCaching: [
          {
            urlPattern: ({ url, request }) =>
              /\/identity\/[^/]+\//.test(url.pathname) &&
              request.headers.get('X-Swiss-Prepare') !== 'identity',
            handler: 'CacheFirst',
            options: {
              cacheName: `swiss-${IDENTITY_ASSETS.version}`,
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: ({ url, request }) =>
              /\/ocr\/tesseract-7\.0\.0-eng-1\.0\.0\//.test(url.pathname) &&
              request.headers.get('X-Swiss-Prepare') !== 'ocr',
            handler: 'CacheFirst',
            options: {
              cacheName: assetCacheName,
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  worker: { format: 'es' },
});
