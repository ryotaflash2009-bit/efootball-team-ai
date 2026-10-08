import { describe, expect, it } from "vitest";
import { breadcrumbJsonLd, serializeJsonLd, structuredDataEnabled, websiteJsonLd } from "./structured-data";

describe("構造化データ（JSON-LD）", () => {
  it("WebSite と BreadcrumbList の形（正式な URL・順番）", () => {
    expect(websiteJsonLd("https://e.test")).toEqual({ "@context": "https://schema.org", "@type": "WebSite", name: "TeamAIXI", url: "https://e.test/", inLanguage: "ja" });
    const b = breadcrumbJsonLd([{ name: "ホーム", path: "/" }, { name: "選手一覧", path: "/players" }, { name: "メッシ", path: "/players/world/1" }], "https://e.test");
    expect((b.itemListElement as { position: number; item: string }[]).map((x) => [x.position, x.item])).toEqual([[1, "https://e.test/"], [2, "https://e.test/players"], [3, "https://e.test/players/world/1"]]);
  });
  it("文字列から script を閉じられない（< を逃がす）・JSON として読み戻せる", () => {
    const s = serializeJsonLd(breadcrumbJsonLd([{ name: "</script><script>alert(1)</script>", path: "/x" }], "https://e.test"));
    expect(s).not.toContain("</script>");
    expect(JSON.parse(s).itemListElement[0].name).toBe("</script><script>alert(1)</script>");
  });
  it("検索への登録を許可していない間は出さない", () => {
    expect(structuredDataEnabled(false)).toBe(false);
    expect(structuredDataEnabled(true)).toBe(true);
  });
});
