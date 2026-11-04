import { defineConfig } from "vite";
import { foldkitPlugin } from "@foldkit/vite-plugin";

export default defineConfig({
  plugins: [foldkitPlugin()],
  build: {
    outDir: "dist",
  },
});