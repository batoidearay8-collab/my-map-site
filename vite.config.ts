/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // Relative base so the built site works from any folder (GitHub Pages / sub-dir hosting).
  base: "./",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon-192.png", "icons/icon-512.png", "assets/floor.png"],
      manifest: {
        name: "AtlasKobo — 地図サイト制作キット",
        short_name: "AtlasKobo",
        // Use relative start_url so it works on GitHub Pages sub-paths.
        start_url: ".",
        scope: ".",
        display: "standalone",
        background_color: "#0b0c10",
        theme_color: "#0b0c10",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" }
        ]
      },
      workbox: {
        // 静的配信 + オフライン表示
        // Relative fallback so sub-path deployments keep working.
        navigateFallback: "index.html",
        runtimeCaching: [
          {
            // Match even when deployed under a sub-path (e.g. /repo-name/data/...).
            urlPattern: /\/(data|images|assets)\//,
            handler: "CacheFirst",
            options: {
              cacheName: "mapsite-content",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          }
        ]
      }
    })
  ],
  server: { port: 5173 },
  build: {
    sourcemap: true
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
  }
});
