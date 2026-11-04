import { defineConfig } from "vite";
import { foldkit } from "@foldkit/vite-plugin";

export default defineConfig({
  plugins: [foldkit()],
  server: {
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
  build: {
    outDir: "dist",
  },
});