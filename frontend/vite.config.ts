import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      workbox: {
        globPatterns: ['**/*.{js,css,ico,png,svg}'],
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        navigateFallbackDenylist: [/^\/api\//],
        // Cache em runtime para economizar dados em visitas repetidas e
        // reduzir erros em conexões instáveis.
        runtimeCaching: [
          {
            // Logo e arquivos de mídia (imagens/vídeos) servidos pela API
            urlPattern: ({ url }) =>
              /\/api\/v1\/(logo\/|midia\/[^/]+\/arquivo)/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'ieq-midia-arquivos',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 7 * 24 * 60 * 60 // 7 dias
              },
              cacheableResponse: { statuses: [0, 200, 206] },
              rangeRequests: true
            }
          },
          {
            // Vitrine pública e identidade visual: atualiza quando possível,
            // mas serve cache se a rede falhar (economia + resiliência).
            urlPattern: ({ url }) =>
              /\/api\/v1\/(publico\/vitrine\/|publico\/visual\/)/.test(url.pathname),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'ieq-vitrine-publica',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 24 * 60 * 60 // 1 dia
              },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      },
      manifest: {
        name: 'IEQ Sistema da Igreja',
        short_name: 'IEQ',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait'
      }
    })
  ],
  server: {
    port: 3000
  },
  build: {
    target: 'es2019',
    sourcemap: false,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          icons: ['lucide-react']
        }
      }
    }
  }
});

