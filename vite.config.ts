import { defineConfig } from "vite";

export default defineConfig({
  // Relativ, damit der Build auch in einem Unterordner (GitHub Pages) laeuft.
  base: "./",
  server: {
    host: true, // im WLAN erreichbar -> zum Testen auf dem Handy
    port: 5173,
  },
  build: {
    target: "es2022",
  },
});
