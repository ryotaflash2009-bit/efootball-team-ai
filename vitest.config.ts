import { defineConfig, configDefaults } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  // .tsx を import するテスト（UI ヘルパー等）向けに自動 JSX ランタイムを使う
  // Vitest 5（Vite 8）は esbuild の代わりに oxc で変換する（tsconfig の jsx: preserve に従わせない）。
  oxc: { jsx: { runtime: "automatic", importSource: "react" } },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // 全ファイルを読む・大きな入力の決定性などの重いテストは、他の作業で混んだ PC では既定の 5 秒を超えることがある（2026-10-20）。
    // 確かめる内容は変えず、待つ時間だけ延ばす。
    testTimeout: 20_000,
    include: ["src/**/*.test.ts"],
    // 英語の辞書は本番では後から読み込む（translate.ts）。テストでは最初から登録しておく。
    setupFiles: ["./src/test-setup/register-dictionaries.ts"],
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
