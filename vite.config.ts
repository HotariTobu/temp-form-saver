import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import webExtension, { readJsonFile } from "vite-plugin-web-extension";
import path from "node:path";

import 'dotenv/config'

function generateManifest() {
  const manifest = readJsonFile("src/manifest.json");
  const pkg = readJsonFile("package.json");
  return {
    description: pkg.description,
    version: pkg.version,
    ...manifest,
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    webExtension({
      manifest: generateManifest,
      webExtConfig: {
        startUrl: process.env.START_URL.split(","),
      },
      additionalInputs: [
        'src/scripts/form.ts',
      ]
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // In dev mode, make sure fast refresh works
      "/@react-refresh": path.resolve(
        "node_modules/@vitejs/plugin-react-swc/refresh-runtime.js"
      ),
    },
  },
});
