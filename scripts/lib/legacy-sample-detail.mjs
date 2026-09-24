/**
 * 旧サンプル詳細(/players/[id])の回帰確認(ブラックボックス共通)。
 *
 * 旧ルートは、再配布不可のためgit管理外にあるローカルサンプル(src/data/players.sample.json、eFHUB由来)だけを読む。
 * UIからのリンクは無く、正式な選手詳細は /players/world/[worldCardId](Productionでは参照データDB)。
 * 公開環境・CIにはサンプルが無いため、以前の「固定の選手名が表示される」検査はサンプルのある開発環境でしか成立しなかった
 * (2026-09-24、公開環境で HTTP 200・選手名なし = サンプルなしの正しいnot-found表示だったことを確認)。
 *
 * 固定の選手名に依存せず、環境ごとの正しい表示を確認する:
 *   サンプルあり → 旧API(/api/players)が返す先頭の選手の詳細に、その選手名が表示される
 *   サンプルなし → 旧APIは0件で、旧詳細は共通のnot-found画面(選手情報・内部情報・stack traceなし、5xxなし)
 * localhost等、呼び出し側が渡したBASEへのHTTP GETだけ(外部サイトへはアクセスしない)。
 */

const LEGACY_SAMPLE_ID = "89138556575063";
const NOT_FOUND_TITLE_JA = "ページが見つかりません";
const LEAK_RE = /Lionel Messi|efootball\.db|players\.sample|stack trace|ENOENT/i;

async function fetchText(base, p) {
  try {
    const r = await fetch(base + p, { redirect: "manual" });
    return { status: r.status, body: await r.text().catch(() => "") };
  } catch {
    return { status: -1, body: "" };
  }
}

/**
 * @param {string} base
 * @param {number} count サンプルがある場合に確認する選手数(旧APIの並び順の先頭から)
 * @returns {Promise<Array<{ name: string, pass: boolean, detail: string }>>}
 */
export async function checkLegacySampleDetail(base, count = 1) {
  const list = await fetchText(base, `/api/players?limit=${count}`);
  let data = null;
  try {
    data = JSON.parse(list.body);
  } catch {
    data = null;
  }
  const players = Array.isArray(data?.players) ? data.players.slice(0, count) : [];
  if (players.length > 0) {
    const results = [];
    for (const [i, p] of players.entries()) {
      const d = await fetchText(base, `/players/${encodeURIComponent(p.id)}`);
      const name = p.nameJa || p.nameEn || "";
      results.push({
        name: `回帰: 旧サンプル詳細（ローカルサンプルあり）: 旧APIと同じ選手を表示 #${i + 1}`,
        pass: list.status === 200 && d.status === 200 && name.length > 0 && d.body.includes(name),
        detail: `HTTP ${d.status}`,
      });
    }
    if (players.length < count) results.push({ name: "回帰: 旧サンプル詳細（ローカルサンプルあり）: 件数", pass: false, detail: `${players.length}/${count}` });
    return results;
  }
  const d = await fetchText(base, `/players/${LEGACY_SAMPLE_ID}`);
  return [{
    name: "回帰: 旧サンプル詳細（サンプルなし）: 共通のnot-found画面・選手情報/内部情報なし",
    pass: list.status === 200 && data?.total === 0 && d.status > 0 && d.status < 500 && d.body.includes(NOT_FOUND_TITLE_JA) && !LEAK_RE.test(d.body),
    detail: `HTTP ${d.status}`,
  }];
}
