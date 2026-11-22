import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['brand/memrly-horizontal.svg', 'brand/memrly-app.svg'],
      manifest: {
        name: 'Memrly · Amorchi',
        short_name: 'Memrly',
        description: 'Nuestra historia en fotografías',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#102b49',
        icons: [
          { src: '/brand/memrly-app.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }
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
