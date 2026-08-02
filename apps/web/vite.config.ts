import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  resolve: {
    alias: {
      "@kuroshiro/engine": path.resolve(__dirname, "../../packages/engine/src/index.ts"),
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "黒白侵攻 Kuroshiro",
        short_name: "黒白侵攻",
        description: "囲碁と将棋の非対称対戦",
        theme_color: "#2c1810",
        background_color: "#f3e6d0",
        display: "standalone",
        orientation: "portrait",
        lang: "ja",
        icons: [
          {
            src: "favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    host: true,
  },
});
