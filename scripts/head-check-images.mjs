/**
 * 抽出済みの選手カード画像URL(2件)へ HEAD のみを行い、ヘッダーを記録する。
 *   node scripts/head-check-images.mjs <url1> <url2>
 *
 * 厳守する制約:
 *  - HEAD のみ。GET / Range GET へ切り替えない。
 *  - 各URLへ1回ずつ、合計最大2リクエスト。タイムアウト20秒。間隔1秒。再試行なし。
 *  - redirect: "manual"（自動追跡しない）。3xx なら停止。
 *  - ホストが efimg.com 以外、またはURLが抽出済みの player_cards/{id}_l.png 形式でなければ停止。
 *  - 認証要求(401/403) / HEAD非対応(405/501) / その他エラー(2xx以外) / Content-Type欠落 は
 *    別方式へ切り替えず停止。
 *  - 画像バイナリを一切受信・保存しない（HEAD なので本文なし）。
 *  - 成功時のみ docs/player-image-findings.md を新規作成。停止時は作成しない。
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_FILE = path.join(ROOT, "docs", "player-image-findings.md");

const TIMEOUT_MS = 20_000;
const GAP_MS = 1_000;
const MAX_REQUESTS = 2;
const ALLOWED_HOST = "efimg.com";
const UA = "eFootball-Team-AI-dev/0.1 (image header check; HEAD only; <=2 requests)";

// 既に完了済みの「個別ページ調査」の確定事実（前ステップ investigate-player-images.mjs の結果）
const PAGE_FINDINGS = [
  { name: "Lionel Messi", id: "89138556575063", page: "https://efhub.com/players/89138556575063", status: 200, bytes: 207529, candidates: 72 },
  { name: "Fabio Cannavaro", id: "88041460996837", page: "https://efhub.com/players/88041460996837", status: 200, bytes: 194816, candidates: 37 },
];

const HEADER_KEYS = [
  "content-type", "content-length", "cache-control", "etag", "last-modified",
  "age", "expires", "vary", "cf-cache-status", "cf-ray", "x-cache",
  "x-served-by", "x-amz-cf-pop", "x-amz-request-id", "via", "server",
  "accept-ranges", "access-control-allow-origin",
];

const urls = process.argv.slice(2).filter(Boolean);
let requestCount = 0;
let lastAt = 0;

function stop(reason, detail) {
  console.error("\n[head-check] 停止:", reason);
  if (detail !== undefined) console.error(detail);
  console.error("[head-check] 成果物は作成しません。実行リクエスト数:", requestCount);
  process.exit(1);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function hostOf(u) {
  try {
    return new URL(u).host.toLowerCase();
  } catch {
    return "";
  }
}

async function headOnly(url) {
  if (requestCount >= MAX_REQUESTS) stop(`リクエスト上限(${MAX_REQUESTS})超過`, url);
  const wait = GAP_MS - (Date.now() - lastAt);
  if (wait > 0) await sleep(wait);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  requestCount++;
  lastAt = Date.now();
  console.log(`[head-check] (${requestCount}/${MAX_REQUESTS}) HEAD ${url}`);

  let res;
  try {
    res = await fetch(url, {
      method: "HEAD",
      redirect: "manual",
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: "image/avif,image/webp,image/png,image/*,*/*" },
    });
  } catch (err) {
    stop("HEAD リクエスト失敗（ネットワークまたはタイムアウト）", err?.message ?? err);
  } finally {
    clearTimeout(timer);
  }

  if (res.status >= 300 && res.status < 400) {
    stop(`リダイレクト(${res.status})が返りました（自動追跡しません）`, `Location: ${res.headers.get("location") ?? "(なし)"}`);
  }
  if (res.status === 401 || res.status === 403) stop(`認証が要求されました (HTTP ${res.status})`);
  if (res.status === 405 || res.status === 501) stop(`HEAD 非対応 (HTTP ${res.status})。別方式へ切り替えず停止します。`);
  if (res.status < 200 || res.status >= 300) stop(`想定外の HTTP ステータス ${res.status}`);

  const headers = {};
  for (const k of HEADER_KEYS) {
    const v = res.headers.get(k);
    if (v != null) headers[k] = v;
  }
  if (!headers["content-type"]) {
    stop("HEAD 応答に Content-Type がありません。別方式へ切り替えず停止します。");
  }
  return { url, status: res.status, headers };
}

function guessFormat(ct) {
  const t = (ct ?? "").toLowerCase();
  if (t.includes("avif")) return "AVIF";
  if (t.includes("webp")) return "WebP";
  if (t.includes("png")) return "PNG";
  if (t.includes("jpeg") || t.includes("jpg")) return "JPEG";
  return `不明 (${ct})`;
}

async function main() {
  if (urls.length !== 2) stop("引数が2つのURLではありません", JSON.stringify(urls));
  for (const u of urls) {
    if (!/^https:\/\//i.test(u)) stop("https 以外のURL", u);
    if (hostOf(u) !== ALLOWED_HOST) stop(`ホストが ${ALLOWED_HOST} ではありません`, `${u} (host: ${hostOf(u)})`);
    if (!/\/efootballhub22\/images\/player_cards\/\d+_l\.png$/.test(u)) {
      stop("URL が『抽出済みの選手カード画像 player_cards/{id}_l.png』の形式と一致しません", u);
    }
  }

  const results = [];
  for (const u of urls) results.push(await headOnly(u));

  // URL構造の共通性
  const ids = urls.map((u) => (u.match(/player_cards\/(\d+)_l\.png/) ?? [])[1]);
  const templates = urls.map((u, i) => u.replace(`${ids[i]}_l.png`, "{playerId}_l.png"));
  const sameTemplate = templates[0] === templates[1];

  const now = new Date().toISOString();
  const md = buildMarkdown({ results, ids, template: templates[0], sameTemplate, now });

  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
  await fs.writeFile(OUT_FILE, md, "utf8");
  console.log(`\n[head-check] 作成: ${path.relative(ROOT, OUT_FILE)}`);
  console.log(`[head-check] 実行リクエスト数: ${requestCount}/${MAX_REQUESTS}`);
}

function buildMarkdown({ results, ids, template, sameTemplate, now }) {
  const L = [];
  L.push("# 選手画像の配信方法 調査結果");
  L.push("");
  L.push(`調査日時: ${now}`);
  L.push("対象: Lionel Messi (89138556575063) / Fabio Cannavaro (88041460996837)");
  L.push("");
  L.push("## 実行した外部リクエスト（合計4回）");
  L.push("");
  L.push("- 個別ページ GET × 2（scripts/investigate-player-images.mjs）");
  L.push(`- efimg.com への HEAD × ${results.length}（scripts/head-check-images.mjs）`);
  L.push("- 画像バイナリのダウンロード・保存: 0。GET / Range GET: 未使用。");
  L.push("");
  L.push("## 1. 個別ページ");
  L.push("");
  L.push("| 選手 | ページURL | HTTP | 本文サイズ | 抽出候補数 |");
  L.push("|---|---|---|---|---|");
  for (const p of PAGE_FINDINGS) {
    L.push(`| ${p.name} | ${p.page} | ${p.status} | ${p.bytes} bytes | ${p.candidates} |`);
  }
  L.push("");
  L.push("- リダイレクト / ログイン要求 / Cookie 要求 / CAPTCHA: なし");
  L.push("");
  L.push("## 2. 抽出できた選手カード画像URL（ページ本文に実在。推測なし）");
  L.push("");
  L.push("| 選手 | 画像URL |");
  L.push("|---|---|");
  L.push("| Messi | https://efimg.com/efootballhub22/images/player_cards/89138556575063_l.png |");
  L.push("| Cannavaro | https://efimg.com/efootballhub22/images/player_cards/88041460996837_l.png |");
  L.push("");
  L.push("関連パターン（同一ページに多数の他選手カードで確認）:");
  L.push("");
  L.push("- カード画像: `https://efimg.com/efootballhub22/images/player_cards/{playerId}_l.png`");
  L.push("- ミニカード: `https://efimg.com/efootballhub22/images/mini-cards/mini-cards/{playerId}_l.png`");
  L.push("- 国籍アイコン: `https://efimg.com/efootballhub22/images/symbol/Nationality/{code}.png`（Messi=144 / Cannavaro=215）");
  L.push("- エンブレム: `https://efimg.com/efootballhub22/images/symbol/Emblem/e_XXXXXX.png` / `.../symbol/EmblemLC/emb_XXXX.png`");
  L.push("- eFHUB 自身の UI 画像は別ホスト: `https://efhub.com/icons/*`, `https://efhub.com/_next/image?url=...`");
  L.push("- 広告バッジ: `https://www.playwire.com/hubfs/...`（広告。対象外）");
  L.push("");
  L.push("## 3. efimg.com への HEAD 結果（実測）");
  L.push("");
  for (const r of results) {
    L.push(`### ${r.url}`);
    L.push("");
    L.push(`- HTTP: ${r.status}`);
    for (const k of HEADER_KEYS) if (r.headers[k] != null) L.push(`- ${k}: ${r.headers[k]}`);
    L.push(`- 画像形式（Content-Type から）: ${guessFormat(r.headers["content-type"])}`);
    L.push("");
  }
  L.push("## 4. 判定");
  L.push("");
  L.push("| 項目 | 結果 |");
  L.push("|---|---|");
  L.push("| 画像ホスト | **efimg.com**（eFHUB 本体 efhub.com とは別ドメイン） |");
  L.push(`| URL テンプレート | \`${template}\` |`);
  L.push(`| 2選手で同一テンプレート | ${sameTemplate ? "はい" : "いいえ"} |`);
  L.push("| 画像URLに選手ID（= player-index.json の i）が含まれるか | **はい** |");
  L.push("| カード違いの区別 | **カードごとに一意な選手ID を使うため、別カード = 別URL**（追加のカード種別コード不要） |");
  L.push("| 画像URLの自動生成 | **可能**（保存済み id をテンプレートに差し込む） |");
  L.push("| 個別ページからの抽出は必須か | **必須ではない**（id から組み立て可能。特殊カードの確認時のみ抽出が有用） |");
  L.push("");
  L.push("### 確認済み事項");
  L.push("- 上記 HEAD のステータス・ヘッダー（実測）。");
  L.push("- 選手カード画像URLのテンプレートと、2選手での一致。");
  L.push("- 個別ページ（efhub.com）に選手画像が efimg.com の絶対URLで直接記載されていること。");
  L.push("");
  L.push("### 推測事項");
  L.push("- `_l` は large（大サイズ）の意味。他サイズ（`_m` など）の有無は未確認。");
  L.push("- efimg.com は eFHUB の画像配信専用ドメイン（パスに `efootballhub22` を含むため）。");
  L.push("");
  L.push("### 未確認事項");
  L.push("- 画像が存在しないカードの応答（404 か 既定シルエット画像か）。");
  L.push("- efimg.com / efhub.com の画像利用に関する規約・robots.txt。");
  L.push("- 同一選手の複数カードでのミニカード/シンボルの挙動。");
  L.push("- HEAD で得られなかったヘッダー（あれば）。");
  L.push("");
  L.push("## 5. 推奨する Next.js 表示方式");
  L.push("");
  L.push("本プロジェクトの原則「画面は外部を直接呼ばない / 通常表示は自前データ」を踏まえた推奨:");
  L.push("");
  L.push("- **案A（推奨）: 自前プロキシ** — `/api/player-image/[id]` を作り、サーバー側で efimg.com から取得→キャッシュ→返す。");
  L.push("  - 画面（クライアント）は自前URLのみ参照。配信元を晒さない。");
  L.push("  - `next.config.mjs` の `images.remotePatterns` 変更が不要（同一オリジン扱い）。");
  L.push("  - 取得失敗時にプロキシがプレースホルダーを返せる。");
  L.push("- 案B: `next/image` 直リンク + `images.remotePatterns` に `efimg.com` のみ追加。最小実装だがクライアントが外部ホストへアクセス。");
  L.push("- 案C: 選手同期時に画像を自前ストレージへ事前ダウンロード。10万人規模に最適だが今回スコープ外（大量DL）。");
  L.push("");
  L.push("> 注: 今回のフェーズでは next.config.mjs / package.json / src/ を変更していません。次フェーズで案Aの実装計画を作成する想定。");
  L.push("");
  L.push("## 6. 推奨するキャッシュ方式");
  L.push("");
  L.push("- efimg.com の `Cache-Control` / `ETag`（上記実測値）を尊重。");
  L.push("- 案A採用時: プロキシ応答に `Cache-Control: public, max-age=86400, stale-while-revalidate=604800` を付与。");
  L.push("  任意で `src/data/image-cache/`（.gitignore 対象）へディスクキャッシュ。ETag による条件付きリクエストで再取得を最小化。");
  L.push("- `next/image` は最適化後の画像を `.next/cache/images` に自動キャッシュ（WebP/AVIF 変換込み）。");
  L.push("");
  L.push("## 7. プレースホルダー設計");
  L.push("");
  L.push("- ローカルの SVG シルエット部品を1つ用意（eFHUB の画像なしカードが白いシルエットだったのに合わせる）。");
  L.push("- 表示条件: 画像URL不明 / 取得失敗 / 404 / 画像でない Content-Type / タイムアウト。");
  L.push("- 案A: プロキシが配信元エラー時にプレースホルダー画像バイトを返す（サーバー側で完結）。");
  L.push("- 案B: `next/image` の `onError` でクライアント側フォールバック。");
  L.push("- 画像の読み込み失敗でカード描画をブロックしない（固定アスペクト比の枠 + `loading=\"lazy\"`）。");
  L.push("");
  L.push("## 8. 次の調査（今回スコープ外）");
  L.push("");
  L.push("- 同一選手の複数カード（例: Messi の 107/106/105）でURLを比較し、カード識別子の規則を確定。");
  L.push("- 画像が存在しないカードの応答確認。");
  L.push("- 他サイズ（`_m` など）の有無。");
  L.push("- eFHUB / efimg.com の規約・robots.txt 確認。");
  L.push("");
  return L.join("\n") + "\n";
}

main().catch((err) => stop("想定外のエラー", err?.stack ?? err));
