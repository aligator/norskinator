import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Relative asset paths let the same build run at `/` or behind a proxy sub-path.
  base: './',
  build: {
    target: 'es2022',
    cssCodeSplit: false,
  },
  plugins: [
    VitePWA({
      // Updates wait for the learner's OK (see src/ui/modules/update/app-update.ts).
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Norskinator — norsk grammatikk',
        short_name: 'Norskinator',
        description: 'Øv på norske preposisjoner med repetisjon og dagsmål.',
        lang: 'nb-NO',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#0D1420',
        theme_color: '#0D1420',
        icons: [
          { src: './icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: './icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          // Full-bleed variant with the mark inside the 80 % safe zone; the
          // rounded-corner icon would show transparent corners once masked.
          { src: './icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
  },
});
