import { defineConfig } from "vite";
import { resolve } from "node:path";
export default defineConfig({
  build: {
    rollupOptions: {
      input: Object.fromEntries(
        [
          "index",
          "services",
          "estimate",
          "appointments",
          "contact",
          "privacy",
          "terms",
          "disclosures",
          "accessibility",
        ].map((p) => [p, resolve(import.meta.dirname, `${p}.html`)]),
      ),
    },
  },
});
