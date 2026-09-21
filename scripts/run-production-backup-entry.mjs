/**
 * Production reference-data Backupワークフロー専用のエントリースクリプト。
 *
 *   node scripts/run-production-backup-entry.mjs
 *
 * 事前に `npx tsc -p tsconfig.backup-execution.json` でコンパイルされた
 * `dist-backup-execution/reference-data/auto-update/run-production-backup-cli.js`
 * (CommonJS出力)から`main()`をimportして呼び出すだけの薄いシムであり、Backupの
 * 実処理ロジックは一切含まない(すべて`src/lib/reference-data/auto-update/
 * run-production-backup-cli.ts`とその依存先に実装がある)。
 *
 * 2026-09-21修正(初回workflow run #1の失敗、design onlyでのローカル検証では
 * 再現できなかった不具合): このリポジトリの`package.json`は`"type": "module"`を
 * 宣言しているため、`tsc -p tsconfig.backup-execution.json`(module: CommonJS)が
 * 生成する`.js`ファイルは、Node.jsの既定では**最も近い祖先package.jsonの`type`を
 * 継承してES Moduleとして解釈されてしまい**、`Object.defineProperty(exports, ...)`
 * のようなCommonJS構文で`ReferenceError: exports is not defined in ES module scope`
 * を送出する。
 *
 * 修正: `dist-backup-execution/`直下に`{"type":"commonjs"}`という最小の
 * package.jsonを、**このファイル自身が、importを試みる直前に毎回書き出す**。
 * これにより、GitHub Actionsのworkflowでもローカルでも、この1つのファイルだけが
 * 「compileされた出力の実行方法」の唯一の真実源になり、workflow YAML側の
 * 別ステップとこのファイルの内容が食い違う(どちらか一方だけ更新されて
 * 齟齬が生じる)リスクを構造的に無くす。以前はこのpackage.jsonをこのセッションの
 * 開発中に手動で1回だけ作成し、それがローカルのdist-backup-execution/に残り
 * 続けたため、ローカル検証では問題が再現せず、まっさらなGitHub Actions
 * checkoutで初めて発覚した(誠実な開示: 当時のローカル検証は、実際の
 * GitHub Actions実行環境と同一ではなかった)。
 *
 * 動的な文字置換・危険なrename・新規npm packageの追加はいずれも行っていない。
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const distDir = join(scriptDir, "..", "dist-backup-execution");
const markerPath = join(distDir, "package.json");

// tsc自体はpackage.jsonを生成しないため、importを試みる直前に必ずこのファイルが
// 書き出す(compile済み出力が存在することを前提とするが、distDir自体は
// tscの実行によって既に作成されているはずであり、このファイルはその中へ
// 1つのファイルを追加するだけ)。
writeFileSync(markerPath, `${JSON.stringify({ type: "commonjs" }, null, 2)}\n`);

const { main } = await import("../dist-backup-execution/reference-data/auto-update/run-production-backup-cli.js");
await main();
