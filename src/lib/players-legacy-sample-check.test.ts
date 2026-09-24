import { describe, it, expect, afterEach, vi } from "vitest";
import { checkLegacySampleDetail } from "../../scripts/lib/legacy-sample-detail.mjs";

/**
 * ブラックボックス共通の旧サンプル詳細チェック(scripts/lib/legacy-sample-detail.mjs)が、
 * サンプルあり/なしの両環境で正しく判定し、HTTP 200だけで合格にしないことを確かめる(fetchは差し替え)。
 */

type Routes = Record<string, { status: number; body: string }>;
const NOT_FOUND = "<html><body><h1>ページが見つかりません</h1></body></html>";

function stubFetch(routes: Routes) {
  vi.stubGlobal("fetch", async (url: string) => {
    const path = url.replace("http://test", "");
    const r = routes[path] ?? { status: 404, body: "" };
    return { status: r.status, text: async () => r.body } as unknown as Response;
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const list = (players: { id: string; nameJa: string | null; nameEn: string | null }[]) => ({ status: 200, body: JSON.stringify({ players, total: players.length }) });

describe("旧サンプル詳細チェック", () => {
  it("サンプルあり: 旧APIの選手名が詳細に表示されていれば合格、無ければ不合格(固定の選手名に依存しない)", async () => {
    stubFetch({ "/api/players?limit=1": list([{ id: "p1", nameJa: "テスト選手", nameEn: "Test Player" }]), "/players/p1": { status: 200, body: "<h1>テスト選手</h1>" } });
    expect((await checkLegacySampleDetail("http://test"))[0].pass).toBe(true);
    stubFetch({ "/api/players?limit=1": list([{ id: "p1", nameJa: "テスト選手", nameEn: "Test Player" }]), "/players/p1": { status: 200, body: NOT_FOUND } });
    expect((await checkLegacySampleDetail("http://test"))[0].pass).toBe(false);
  });

  it("サンプルあり: 指定件数を確認し、足りなければ不合格", async () => {
    stubFetch({ "/api/players?limit=2": list([{ id: "p1", nameJa: null, nameEn: "Only One" }]), "/players/p1": { status: 200, body: "Only One" } });
    const r = await checkLegacySampleDetail("http://test", 2);
    expect(r.map((x) => x.pass)).toEqual([true, false]);
  });

  it("サンプルなし: 共通のnot-found画面なら合格。5xx・not-found以外・内部情報の露出は不合格(HTTP 200だけでは合格にしない)", async () => {
    const empty = list([]);
    stubFetch({ "/api/players?limit=1": empty, "/players/89138556575063": { status: 200, body: NOT_FOUND } });
    expect((await checkLegacySampleDetail("http://test"))[0].pass).toBe(true);
    // streaming後のnotFound(): 文言はブラウザー側で描画され、HTMLにはNext.jsの404 fallback信号が入る(公開サイトで確認した形)。
    const STREAMED_NOT_FOUND = '<html><body><nav>eFootball Team AI</nav><script>self.__next_f.push([1,"8:E{\\"digest\\":\\"NEXT_HTTP_ERROR_FALLBACK;404\\"}"])</script></body></html>';
    stubFetch({ "/api/players?limit=1": empty, "/players/89138556575063": { status: 200, body: STREAMED_NOT_FOUND } });
    expect((await checkLegacySampleDetail("http://test"))[0].pass).toBe(true);
    // 信号も共通画面の文言も無いHTTP 200(アプリの殻だけ)は不合格。
    stubFetch({ "/api/players?limit=1": empty, "/players/89138556575063": { status: 200, body: "<html><body><nav>eFootball Team AI</nav></body></html>" } });
    expect((await checkLegacySampleDetail("http://test"))[0].pass).toBe(false);
    for (const bad of [
      { status: 200, body: "<html></html>" },
      { status: 500, body: NOT_FOUND },
      { status: 200, body: `${NOT_FOUND} ENOENT src/data/players.sample.json` },
      { status: 200, body: `${NOT_FOUND} Lionel Messi` },
    ]) {
      stubFetch({ "/api/players?limit=1": empty, "/players/89138556575063": bad });
      expect((await checkLegacySampleDetail("http://test"))[0].pass).toBe(false);
    }
    stubFetch({ "/api/players?limit=1": { status: 500, body: "{}" }, "/players/89138556575063": { status: 200, body: NOT_FOUND } });
    expect((await checkLegacySampleDetail("http://test"))[0].pass).toBe(false);
  });
});
