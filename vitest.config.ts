import { defineConfig, configDefaults } from "vitest/config";
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
    // *.postgres.test.ts は実PostgreSQL接続が必須(PHASE2_TEST_PG_*環境変数)のため、
    // 通常のUnit Test(PostgreSQL不要が前提)からは除外する。実行する場合は
    // `npx vitest run --config vitest.postgres.config.ts` を明示的に使うこと
    // (docs/production-readiness/reference-data-auto-update-postgres-validation.md参照)。
    exclude: [...configDefaults.exclude, "**/*.postgres.test.ts"],
    // node:sqlite（Node 24 標準・実験的）は Vite に変換させず Node 側で require する
    server: {
      deps: {
        external: [/node:sqlite/],
      },
    },
  },
});
