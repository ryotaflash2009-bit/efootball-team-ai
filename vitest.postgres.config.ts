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
    // 複数の*.postgres.test.tsファイルが同一の固定schema名(reference_data_ops_test等)を
    // 共有しているため、Vitestの既定(ファイル単位の並列実行)のままでは、複数ファイルの
    // beforeAllが同時にCREATE SCHEMA IF NOT EXISTSを実行し、PostgreSQL側の
    // 既存確認とCREATEが同時実行下では原子的でないことに起因する競合
    // (pg_namespace_nspname_indexのunique constraint違反、23505)が発生し得る
    // (2026-09-20、PR #23マージ後のmain CIで実際に発生・確認済み)。
    // このPostgreSQL integration専用configだけをファイル単位で直列実行にし、
    // 通常のvitest.config.ts(Unit Test全体)の並列性には一切影響させない。
    fileParallelism: false,
  },
});
