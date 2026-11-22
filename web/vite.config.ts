import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'brand/recuerdos-horizontal.webp', 'brand/recuerdos-app.webp'],
      manifest: {
        name: 'Memrly · Amorchi',
        short_name: 'Memrly',
        description: 'Nuestra historia en fotografías',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#102b49',
        icons: [
          { src: '/brand/recuerdos-app.webp', sizes: '192x192', type: 'image/webp', purpose: 'any' },
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }
        ]
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webp}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024
      }
    })
  ]
});
