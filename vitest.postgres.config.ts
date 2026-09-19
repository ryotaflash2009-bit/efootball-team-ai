import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * PostgreSQL統合試験専用のvitest設定。
 *
 * 通常の`vitest.config.ts`はこのファイル群(`*.postgres.test.ts`)を除外している
 * (PostgreSQL未インストールの環境でも通常のUnit Testが成功する設計を維持するため)。
 * 実PostgreSQLへ接続可能な環境(GitHub ActionsのPostgreSQL service container、または
 * 同等の隔離環境)だけで、次のように明示的に実行すること:
 *
 *   npx vitest run --config vitest.postgres.config.ts
 *
 * 接続先は`PHASE2_TEST_PG_*`環境変数(localhost限定、ホワイトリストDB名限定)だけから読む。
 * 実Supabase・実Productionへは一切接続しない。
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/lib/reference-data/auto-update/*.postgres.test.ts"],
    testTimeout: 20_000,
  },
});
