import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * `next start`(本番相当)実行時に一度EvalError(Edge Runtime内のcode generation制限)が
 * 観測された調査の結果を、将来の回帰防止として固定化する。
 *
 * 調査結果(2026-09-18):
 * - `src/middleware.ts`の依存グラフ(直接importのみ: next/server, @supabase/ssr,
 *   @/lib/supabase/env)にはeval/new Function/動的requireは存在しない。
 * - `@/lib/supabase/env.ts`は他モジュールを一切importしない純関数群。
 * - Build後のMiddlewareバンドル(.next/server/src/middleware.js)を
 *   `eval(`/`new Function`/`Function(`/`codeGeneration`/`WebAssembly.compile`/
 *   `WebAssembly.instantiate`で検索した結果、いずれも0件だった。
 * - 複数回の独立した`next start`起動(WORLD_DATA_SOURCE未設定・明示sqliteの両方)で
 *   EvalErrorは再現しなかった。
 * - 結論: 観測されたEvalErrorは、`npm run build`(本番Build)と稼働中の`next dev`が
 *   同じ`.next`ディレクトリを共有・同時書込みしたことによる一時的なビルド成果物の
 *   不整合が原因である可能性が高く、Middlewareのコード自体の欠陥ではないと判断した。
 *   Phase E(`WORLD_DATA_SOURCE`)の変更とも無関係(依存グラフに一切含まれない)。
 *
 * このテストはソーステキストの静的検証のみ(このプロジェクトのVitest環境はNode環境で
 * jsdomを使わないため、Middlewareの実行そのものはCDPブラックボックスで別途確認する)。
 */
const MIDDLEWARE_PATH = path.resolve(__dirname, "middleware.ts");

function readMiddlewareSource(): string {
  return readFileSync(MIDDLEWARE_PATH, "utf8");
}

describe("middleware.ts: Edge Runtime互換性の静的監査", () => {
  it("eval・new Function・動的requireを含まない", () => {
    const source = readMiddlewareSource();
    expect(source).not.toMatch(/\beval\s*\(/);
    expect(source).not.toMatch(/new\s+Function\s*\(/);
    expect(source).not.toMatch(/\brequire\s*\(/);
  });

  it("参照データ(WORLD_DATA_SOURCE/reference-data/world/managers)関連コードに依存しない(Phase Eとの独立性)", () => {
    const source = readMiddlewareSource();
    expect(source).not.toMatch(/reference-data|WORLD_DATA_SOURCE|@\/lib\/world|@\/lib\/managers/);
  });

  it("既知のimportのみ(next/server・@supabase/ssr・@/lib/supabase/env)を使う", () => {
    const source = readMiddlewareSource();
    const importLines = source.match(/^import .+$/gm) ?? [];
    for (const line of importLines) {
      expect(line).toMatch(/next\/server|@supabase\/ssr|@\/lib\/supabase\/env/);
    }
  });

  it("Supabase環境変数が未設定/不正な場合は例外を投げずリクエストを素通りさせる設計になっている", () => {
    const source = readMiddlewareSource();
    expect(source).toMatch(/if\s*\(!env\.ok\)/);
    expect(source).toMatch(/return NextResponse\.next/);
  });
});
