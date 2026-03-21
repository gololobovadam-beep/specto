import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "Study Pages",
        short_name: "Study Pages",
        description: "A calm study workspace with tabs, pages, and topic cards.",
        theme_color: "#f4efe7",
        background_color: "#f4efe7",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any"
          }
        ]
      }
    })
  ],
  test: {
    environment: "jsdom",
    environmentOptions: {
      jsdom: {
        url: "https://spectus-33cfe.firebaseapp.com/"
      }
    },
    setupFiles: "./src/test/setup.ts",
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: "v8",
      include: [
        "src/presentation/auth/AuthProvider.tsx",
        "src/presentation/auth/authFlow.ts"
      ],
      reporter: ["text", "html"],
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100
      }
    }
  }
});
