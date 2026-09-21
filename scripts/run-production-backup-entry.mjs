/**
 * Production reference-data Backupワークフロー専用のエントリースクリプト。
 *
 *   node scripts/run-production-backup-entry.mjs
 *
 * 事前に `npx tsc -p tsconfig.backup-execution.json` でコンパイルされた
 * `dist-backup-execution/reference-data/auto-update/run-production-backup-cli.js`
 * (CommonJS、`dist-backup-execution/package.json`で`"type":"commonjs"`に固定)から
 * `main()`をimportして呼び出すだけの薄いシムであり、Backupの実処理ロジックは
 * 一切含まない(すべて`src/lib/reference-data/auto-update/run-production-backup-cli.ts`
 * とその依存先に実装がある)。
 *
 * このセッションでは一度も実行していない(Production未接続、R2未接続、`age`未実行)。
 */

const { main } = await import("../dist-backup-execution/reference-data/auto-update/run-production-backup-cli.js");
await main();
