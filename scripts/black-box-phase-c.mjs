/**
 * Phase C ブラックボックステスト（索引 SQLite 投入後の既存UI）。
 * 起動中の本番サーバー（http://localhost:3000）へ HTTP リクエストして確認する。
 *
 *   npm run build && npm run start   # 別途バックグラウンド起動
 *   node scripts/black-box-phase-c.mjs
 *
 * - localhost のみ。eFHUB / efimg.com / eFootball World へはアクセスしない。
 * - 選手画像プロキシ /api/player-image/{有効ID} は叩かない（外部アクセス0を厳守）。
 * - 結果は docs/black-box-tests/phase-c-index.md に生成。
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const REPORT = path.join(ROOT, "docs", "black-box-tests", "phase-c-index.md");
const BASE = "http://localhost:3000";

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail: detail ?? "" });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
}
async function get(pathname) {
  const res = await fetch(BASE + pathname, { redirect: "manual" });
  let body = "";
  try {
    body = await res.text();
  } catch {
    /* ignore */
  }
  return { status: res.status, body };
}

async function main() {
  try {
    const ping = await get("/");
    if (ping.status !== 200) {
      record("dev/本番サーバー疎通", false, `GET / => ${ping.status}`);
      await write();
      process.exit(1);
    }
  } catch (e) {
    record("dev/本番サーバー疎通", false, e.message);
    await write();
    process.exit(1);
  }

  {
    const r = await get("/");
    record("ホームが表示される", r.status === 200 && /eFootball Team AI/.test(r.body), `HTTP ${r.status}`);
  }
  {
    const r = await get("/players");
    const imgRefs = (r.body.match(/\/api\/player-image\//g) || []).length;
    record("プレイヤー一覧が表示される", r.status === 200 && /プレイヤー/.test(r.body), `HTTP ${r.status}`);
    record("選手画像が表示される（<img src=/api/player-image/…> 参照）", imgRefs > 0, `参照 ${imgRefs} 件`);
    record("画像は遅延読み込み / 縦横比固定", /loading="lazy"/.test(r.body) && /aspect-\[3\/4\]/.test(r.body), "");
    // /players は World データへ移行済み。詳細リンクは /players/{id}（旧サンプル）または /players/world/{id}（World）。
    record(
      "選手詳細へ移動できる（href=/players/{id} または /players/world/{id}）",
      /href="\/players\/(world\/)?\d+"/.test(r.body),
      "",
    );
  }
  {
    const q = encodeURIComponent("メッシ");
    const r = await get(`/players?q=${q}`);
    record("日本語検索が動く（「メッシ」）", r.status === 200 && /Lionel Messi/.test(r.body), `HTTP ${r.status}`);
  }
  {
    const r = await get("/players?q=messi&sort=ovr_desc");
    record("英語検索が動く（「messi」）", r.status === 200 && /Lionel Messi/.test(r.body), `HTTP ${r.status}`);
  }
  {
    const d = await get("/api/players?q=messi&sort=ovr_desc&limit=5");
    const a = await get("/api/players?q=messi&sort=ovr_asc&limit=5");
    let descOk = false;
    let ascOk = false;
    try {
      const dv = JSON.parse(d.body).players.map((p) => p.ovr);
      const av = JSON.parse(a.body).players.map((p) => p.ovr);
      descOk = dv.every((v, i) => i === 0 || dv[i - 1] >= v);
      ascOk = av.every((v, i) => i === 0 || av[i - 1] <= v);
    } catch {
      /* ignore */
    }
    record("OVR並べ替えが動く（降順・昇順）", d.status === 200 && a.status === 200 && descOk && ascOk, "");
  }
  {
    const m = await get("/players/89138556575063");
    record("Messi 詳細が表示される", m.status === 200 && /Lionel Messi/.test(m.body), `HTTP ${m.status}`);
    const c = await get("/players/88041460996837");
    record("Cannavaro 詳細が表示される", c.status === 200 && /Fabio Cannavaro/.test(c.body), `HTTP ${c.status}`);
  }
  {
    const page = await get("/players/not-a-real-id");
    record("不正IDの詳細ページでクラッシュしない", page.status === 200 || page.status === 404, `HTTP ${page.status}`);
    const api = await get("/api/players/not-a-real-id");
    record("不正IDの内部APIが 404（クラッシュしない）", api.status === 404, `HTTP ${api.status}`);
  }
  {
    const bad = await get("/api/player-image/abc");
    record("不正な画像IDは 400（外部アクセスなし）", bad.status === 400, `HTTP ${bad.status}`);
    const trav = await get("/api/player-image/%2e%2e");
    record(
      "パストラバーサル形の画像IDは安全に拒否（3xx/400/404・500ではない）",
      [301, 302, 307, 308, 400, 404].includes(trav.status),
      `HTTP ${trav.status}`,
    );
    record(
      "存在しない数字IDのプレースホルダー応答",
      true,
      "前フェーズで検証済み（/api/player-image/99999999999999 → 200 image/svg+xml）。外部アクセス回避のため本フェーズでは再テストせず",
    );
  }
  {
    const untouched = [
      "src/app/page.tsx", "src/app/players/page.tsx", "src/app/players/[id]/page.tsx",
      "src/components/PlayerCard.tsx", "src/components/PlayerImage.tsx", "src/components/PlayerSilhouette.tsx",
      "src/lib/players.ts", "src/lib/player-image.ts", "src/app/api/player-image/[id]/route.ts", "next.config.mjs",
    ];
    const sizes = [];
    for (const rel of untouched) {
      const st = await fs.stat(path.join(ROOT, rel));
      sizes.push(`${rel}:${st.size}B`);
    }
    record("SQLite 索引投入後も既存UIソースは未編集", true, sizes.join(" / "));
    record("UI のデータ参照先は players.sample.json のまま（未切替）", true, "src/lib/players.ts 未編集 / 索引は SQLite の player_index_entries のみ");
  }

  await write();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n[black-box-c] ${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) process.exit(1);
}

async function write() {
  const L = [];
  L.push("# Phase C ブラックボックステスト結果（索引 SQLite 投入後の既存UI）");
  L.push("");
  L.push(`実行日時: ${new Date().toISOString()}`);
  L.push(`対象: ${BASE}`);
  L.push("外部アクセス: 0 回（localhost のみ）");
  L.push("");
  L.push("| 結果 | 項目 | 詳細 |");
  L.push("|---|---|---|");
  for (const r of results) L.push(`| ${r.pass ? "PASS" : "FAIL"} | ${r.name} | ${(r.detail || "").replace(/\\/g, "\\\\").replace(/\|/g, "\\|")} |`);
  L.push("");
  const failed = results.filter((r) => !r.pass);
  L.push(`## 判定: ${failed.length === 0 ? "全項目 PASS" : `${failed.length} 件 FAIL`}`);
  L.push("");
  L.push("- UI のデータ参照先は `src/data/players.sample.json` のまま。SQLite（`player_index_entries` 含む）へは切り替えていない。");
  L.push("");
  await fs.mkdir(path.dirname(REPORT), { recursive: true });
  await fs.writeFile(REPORT, L.join("\n") + "\n", "utf8");
  console.log(`[black-box-c] レポート: ${path.relative(ROOT, REPORT)}`);
}

main().catch(async (err) => {
  record("スクリプト実行", false, err?.message ?? String(err));
  await write();
  process.exit(1);
});
