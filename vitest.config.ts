import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  // .tsx を import するテスト（UI ヘルパー等）向けに自動 JSX ランタイムを使う
  esbuild: { jsx: "automatic", jsxImportSource: "react" },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // node:sqlite（Node 24 標準・実験的）は Vite に変換させず Node 側で require する
    server: {
      deps: {
        external: [/node:sqlite/],
      },
    },
  },
});
