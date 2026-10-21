import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173 },
  worker: { format: "es" },
  optimizeDeps: { exclude: ["@huggingface/transformers"] },
  build: { target: "es2022", chunkSizeWarningLimit: 1200 },
});
