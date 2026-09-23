import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { INTERNAL_PAGE_PATHS, areInternalPagesVisible, isInternalPagePath } from "./internal-pages";
import { SEARCH_INDEXING_ALLOWED, SITE_ROBOTS_METADATA, buildRobotsTxt } from "./search-indexing";

const ROOT = path.resolve(__dirname, "..", "..", "..");
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");

describe("内部ページの表示可否(fail-closed)", () => {
  it("ローカル開発か明示のenabledだけ表示し、それ以外はすべて非表示", () => {
    expect(areInternalPagesVisible({ NODE_ENV: "development" })).toBe(true);
    expect(areInternalPagesVisible({ NODE_ENV: "production", NEXT_PUBLIC_EFTA_INTERNAL_PAGES: "enabled" })).toBe(true);
    for (const env of [
      { NODE_ENV: "production" },
      { NODE_ENV: "test" },
      {},
      { NODE_ENV: "production", NEXT_PUBLIC_EFTA_INTERNAL_PAGES: "true" },
      { NODE_ENV: "production", NEXT_PUBLIC_EFTA_INTERNAL_PAGES: "1" },
      { NODE_ENV: "production", NEXT_PUBLIC_EFTA_INTERNAL_PAGES: "Enabled" },
    ]) {
      expect(areInternalPagesVisible(env), JSON.stringify(env)).toBe(false);
    }
  });

  it("対象は開発者向けの2ページだけ(データ削除機能を持つ/data-managementは対象外)", () => {
    expect([...INTERNAL_PAGE_PATHS]).toEqual(["/account/rls-test", "/release-readiness"]);
    expect(isInternalPagePath("/data-management")).toBe(false);
  });

  it("各内部ページは表示不可なら最初にnotFound()し、noindexを持つ", () => {
    for (const p of ["src/app/account/rls-test/page.tsx", "src/app/release-readiness/page.tsx"]) {
      const src = read(p);
      expect(src, p).toMatch(/if \(!areInternalPagesVisible\(\)\) notFound\(\);/);
      expect(src, p).toMatch(/robots: \{ index: false, follow: false \}/);
      // 静的生成ではnotFound()でもHTTP 200になるため、request時判定とmetadata側のnotFound()を要求する
      expect(src, p).toContain('export const dynamic = "force-dynamic";');
      expect(src, p).toMatch(/export function generateMetadata\(\): Metadata \{\s+if \(!areInternalPagesVisible\(\)\) notFound\(\);/);
      expect(src, p).not.toMatch(/export const metadata/);
    }
  });

  it("フッターは内部ページへの導線を表示可否に従って隠す", () => {
    const src = read("src/components/Footer.tsx");
    expect(src).toMatch(/areInternalPagesVisible\(\) \? LINKS : LINKS\.filter\(\(l\) => !isInternalPagePath\(l\.href\)\)/);
    expect(src).toMatch(/\{links\.map\(/);
  });
});

describe("招待制ベータの検索エンジン対策", () => {
  it("robots.txtは全体をdisallowし、全ページnoindex", () => {
    expect(SEARCH_INDEXING_ALLOWED).toBe(false);
    expect(buildRobotsTxt()).toEqual({ rules: [{ userAgent: "*", disallow: "/" }] });
    expect(SITE_ROBOTS_METADATA).toMatchObject({ index: false, follow: false });
    expect(read("src/app/layout.tsx")).toMatch(/robots: \{ \.\.\.SITE_ROBOTS_METADATA \}/);
    expect(read("src/app/robots.ts")).toMatch(/buildRobotsTxt\(\)/);
  });
});
