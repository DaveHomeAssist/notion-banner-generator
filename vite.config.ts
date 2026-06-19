import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// GitHub Pages serves project sites from /<repo>/. Set base accordingly for
// production builds while keeping dev at root. Override with VITE_BASE if the
// repo name ever differs from the folder name.
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const base = env.VITE_BASE ?? "/notion-banner-generator/";
  return {
    base: command === "build" ? base : "/",
    plugins: [react(), tailwindcss()],
  };
});
