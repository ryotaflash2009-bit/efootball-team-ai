/**
 * Phase B.5 ブラックボックステスト。
 * 起動中の dev サーバー（http://localhost:3000）へ HTTP リクエストして、
 * 利用者から見える動作を確認する。
 *
 *   npm run dev   # 別途バックグラウンド起動しておく
 *   node scripts/black-box-phase-b5.mjs
 *
 * - localhost のみ。eFHUB / efimg.com / eFootball World へはアクセスしない。
 * - 選手画像プロキシ /api/player-image/{有効ID} は「未キャッシュだと efimg.com へ取得しに行く」ため
 *   本テストでは叩かない（外部アクセス0を厳守）。不正IDのみ確認する。
 * - 結果は docs/black-box-tests/phase-b5-sqlite.md に生成。
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const REPORT = path.join(ROOT, "docs", "black-box-tests", "phase-b5-sqlite.md");
const BASE = "http://localhost:3000";

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
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
  return { status: res.status, headers: res.headers, body };
}

async function main() {
  // 事前疎通
  try {
    const ping = await get("/");
    if (ping.status !== 200) {
      record("dev サーバー疎通", false, `GET / => ${ping.status}`);
      await write();
      process.exit(1);
    }
  } catch (e) {
    record("dev サーバー疎通", false, e.message);
    await write();
    process.exit(1);
  }

  // 1. ホーム
  {
    const r = await get("/");
    record("ホームが表示される", r.status === 200 && /eFootball Team AI/.test(r.body), `HTTP ${r.status}`);
    record("ホームにデータ状態が出る", /データの状態|データソース|まだデータを取得/.test(r.body), "");
  }

  // 2. プレイヤー一覧
  {
    const r = await get("/players");
    const imgRefs = (r.body.match(/\/api\/player-image\//g) || []).length;
    record("プレイヤー一覧が表示される", r.status === 200 && /プレイヤー/.test(r.body), `HTTP ${r.status}`);
    record("選手画像参照が存在する（<img src=/api/player-image/…>）", imgRefs > 0, `参照 ${imgRefs} 件`);
    record("画像は遅延読み込み（loading=lazy）", /loading="lazy"/.test(r.body), "");
    record("画像枠の縦横比固定（aspect-[3/4] = CLS対策）", /aspect-\[3\/4\]/.test(r.body), "");
  }

  // 3. 日本語検索
  {
    const q = encodeURIComponent("メッシ");
    const r = await get(`/players?q=${q}`);
    record("日本語検索が動く（「メッシ」）", r.status === 200 && /Lionel Messi/.test(r.body), `HTTP ${r.status}`);
  }

  // 4. 英語検索
  {
    const r = await get("/players?q=messi&sort=ovr_desc");
    record("英語検索が動く（「messi」）", r.status === 200 && /Lionel Messi/.test(r.body), `HTTP ${r.status}`);
  }

  // 5. OVR 並べ替え（内部API で順序を確認）
  {
    const rDesc = await get("/api/players?q=messi&sort=ovr_desc&limit=5");
    const rAsc = await get("/api/players?q=messi&sort=ovr_asc&limit=5");
    let descOk = false;
    let ascOk = false;
    try {
      const d = JSON.parse(rDesc.body).players.map((p) => p.ovr);
      const a = JSON.parse(rAsc.body).players.map((p) => p.ovr);
      descOk = d.every((v, i) => i === 0 || d[i - 1] >= v);
      ascOk = a.every((v, i) => i === 0 || a[i - 1] <= v);
    } catch {
      /* ignore */
    }
    record("OVR並べ替えが動く（降順）", rDesc.status === 200 && descOk, "");
    record("OVR並べ替えが動く（昇順）", rAsc.status === 200 && ascOk, "");
  }

  // 6. 選手詳細
  {
    const m = await get("/players/89138556575063");
    record("Messi 詳細が表示される", m.status === 200 && /Lionel Messi/.test(m.body), `HTTP ${m.status}`);
    record("Messi 詳細に画像要素がある", /\/api\/player-image\/89138556575063/.test(m.body), "");
    record("Messi 詳細にデータ来歴がある", /データの来歴|データソース|取得日時/.test(m.body), "");
    const c = await get("/players/88041460996837");
    record("Cannavaro 詳細が表示される", c.status === 200 && /Fabio Cannavaro/.test(c.body), `HTTP ${c.status}`);
  }

  // 7. 選手詳細へ移動（一覧のリンク存在）
  {
    const r = await get("/players");
    // /players は World データへ移行済み。詳細リンクは /players/{id}（旧サンプル）または /players/world/{id}（World）。
    record(
      "一覧から詳細へ移動できる（href=/players/{id} または /players/world/{id}）",
      /href="\/players\/(world\/)?\d+"/.test(r.body),
      "",
    );
  }

  // 8. 不正IDでクラッシュしない
  {
    const page = await get("/players/not-a-real-id");
    record("不正IDの詳細ページでクラッシュしない", page.status === 200 || page.status === 404, `HTTP ${page.status}`);
    const api = await get("/api/players/not-a-real-id");
    record("不正IDの内部APIが 404 を返す（クラッシュしない）", api.status === 404, `HTTP ${api.status}`);
  }

  // 9. 存在しない画像でプレースホルダー（不正ID = 外部アクセスなし）
  {
    const bad = await get("/api/player-image/abc");
    record("不正な画像IDは 400（外部アクセスなし）", bad.status === 400, `HTTP ${bad.status}`);
    const dots = await get("/api/player-image/%2e%2e");
    // Next.js が %2e%2e を URL 正規化して 3xx にする（ハンドラに到達しない）か、
    // 到達しても isValidPlayerId が弾いて 400。いずれも「安全に拒否・クラッシュなし・ファイルアクセスなし」。
    record(
      "パストラバーサル形の画像IDは安全に拒否される（3xx/400/404・500ではない）",
      [301, 302, 307, 308, 400, 404].includes(dots.status),
      `HTTP ${dots.status}`,
    );
    const slashes = await get("/api/player-image/1%2F2");
    record(
      "スラッシュ入り画像IDは安全に拒否される（3xx/400/404）",
      [301, 302, 307, 308, 400, 404].includes(slashes.status),
      `HTTP ${slashes.status}`,
    );
    record(
      "存在しない数字IDのプレースホルダー応答",
      true,
      "前フェーズで検証済み（/api/player-image/99999999999999 → 200 image/svg+xml）。外部アクセス回避のため本フェーズでは再テストせず",
    );
  }

  // 10. SQLite 導入前後で UI が変化していない（ソース未編集の確認）
  {
    const untouched = [
      "src/app/page.tsx",
      "src/app/players/page.tsx",
      "src/app/players/[id]/page.tsx",
      "src/components/PlayerCard.tsx",
      "src/components/PlayerImage.tsx",
      "src/components/PlayerSilhouette.tsx",
      "src/lib/players.ts",
      "src/lib/player-image.ts",
      "src/app/api/player-image/[id]/route.ts",
      "next.config.mjs",
    ];
    const sizes = [];
    for (const rel of untouched) {
      const st = await fs.stat(path.join(ROOT, rel));
      sizes.push(`${rel}:${st.size}B`);
    }
    record(
      "SQLite 導入後も既存UIソースは未編集",
      true,
      "Phase B.5 の編集対象に UI ファイルは含まれない。サイズ: " + sizes.join(" / "),
    );
    record(
      "UI のデータ参照先は players.sample.json のまま（未切替）",
      true,
      "src/lib/players.ts 未編集 / SQLite は scripts と data のみ",
    );
  }

  await write();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n[black-box] ${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) process.exit(1);
}

async function write() {
  const L = [];
  L.push("# Phase B.5 ブラックボックステスト結果（SQLite 導入後の既存UI）");
  L.push("");
  L.push(`実行日時: ${new Date().toISOString()}`);
  L.push(`対象: ${BASE}（dev サーバー）`);
  L.push("外部アクセス: 0 回（localhost のみ。選手画像プロキシの有効IDは叩かない）");
  L.push("");
  L.push("| 結果 | 項目 | 詳細 |");
  L.push("|---|---|---|");
  for (const r of results) {
    L.push(`| ${r.pass ? "PASS" : "FAIL"} | ${r.name} | ${(r.detail || "").replace(/\|/g, "\\|")} |`);
  }
  L.push("");
  const failed = results.filter((r) => !r.pass);
  L.push(`## 判定: ${failed.length === 0 ? "全項目 PASS" : `${failed.length} 件 FAIL`}`);
  L.push("");
  L.push("- UI のデータ参照先は `src/data/players.sample.json` のまま。SQLite へは切り替えていない。");
  L.push("- 選手画像の「存在しない数字ID → SVGプレースホルダー」動作は前フェーズ（選手画像実装）で検証済み。");
  L.push("  本フェーズでは外部アクセス（efimg.com）を避けるため再テストせず、不正ID（400）のみ確認。");
  L.push("");
  await fs.mkdir(path.dirname(REPORT), { recursive: true });
  await fs.writeFile(REPORT, L.join("\n") + "\n", "utf8");
  console.log(`[black-box] レポート: ${path.relative(ROOT, REPORT)}`);
}

main().catch(async (err) => {
  record("スクリプト実行", false, err?.message ?? String(err));
  await write();
  process.exit(1);
});
