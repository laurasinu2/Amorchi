import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'brand/recuerdos-horizontal.webp', 'brand/recuerdos-app.webp', 'brand/icon-192.png', 'brand/icon-512.png'],
      manifest: {
        name: 'Recuerdos · Amorchi',
        short_name: 'Recuerdos',
        description: 'Nuestra historia en fotografías',
        start_url: '/',
        display: 'standalone',
        background_color: '#faf3ec',
        theme_color: '#253343',
        icons: [
          { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
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
