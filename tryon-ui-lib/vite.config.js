import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Expose the app url to the bundled script
const APP_URL = process.env.SHOPIFY_APP_URL || "";

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.SHOPIFY_APP_URL': JSON.stringify(APP_URL),
  },
  build: {
    cssCodeSplit: true, // ✅ Generate separate CSS file
    outDir: path.resolve(__dirname, "../extensions/theme-extension/assets"),
    emptyOutDir: false,
    rollupOptions: {
      input: path.resolve(__dirname, "src/main.jsx"),
      output: {
        entryFileNames: "main.js", // JS output
        assetFileNames: "[name].[ext]", // ✅ Outputs main.css
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
