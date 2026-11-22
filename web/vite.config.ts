// @ts-expect-error Vite ejecuta este archivo en Node; el tsconfig web no incorpora los tipos Node.
import { existsSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Se usan exclusivamente los PNG originales cuando se han añadido al repositorio.
// Hasta entonces la PWA conserva un icono válido, sin mostrar recursos rotos.
const originalSquare=existsSync(new URL('./public/brand/memrly-app.png',import.meta.url));
const originalHorizontal=existsSync(new URL('./public/brand/memrly-horizontal.png',import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        originalSquare?'brand/memrly-app.png':'brand/memrly-app.svg',
        originalHorizontal?'brand/memrly-horizontal.png':'brand/memrly-horizontal.svg'
      ],
      manifest: {
        name: 'Memrly · Amorchi',
        short_name: 'Memrly',
        description: 'Nuestra historia en fotografías',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#102b49',
        icons: [
          originalSquare
            ? { src: '/brand/memrly-app.png', sizes: '1254x1254', type: 'image/png', purpose: 'any' }
            : { src: '/brand/memrly-app.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }
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
