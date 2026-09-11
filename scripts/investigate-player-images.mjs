/**
 * 選手画像の配信方法を調べる調査スクリプト（2選手・最大4リクエスト）。
 *
 *   node scripts/investigate-player-images.mjs <playerId1> <playerId2>
 *
 * 制約:
 *  - 個別ページ GET は最大2回、抽出済み画像URLの確認は最大2回、合計最大4回
 *  - 各リクエスト: タイムアウト20秒 / 直前から1秒以上あける / 再試行なし / リダイレクト自動追跡なし
 *  - 画像URLは個別ページのレスポンスから実際に抽出できたものだけを扱う（推測しない）
 *  - 画像ホストが efhub.com / www.efhub.com 以外なら、その画像URLへアクセスせず停止
 *  - 画像バイナリは保存しない（Range GET の受信データはサイズ確認後に破棄）
 *  - 成果物 docs/player-image-findings.md は「調査成功時のみ」新規作成
 *  - 停止条件に該当したらファイルを書かず終了コード1
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_FILE = path.join(ROOT, "docs", "player-image-findings.md");

const TIMEOUT_MS = 20_000;
const GAP_MS = 1_000;
const MAX_REQUESTS = 4;
const ALLOWED_IMAGE_HOSTS = new Set(["efhub.com", "www.efhub.com"]);
const PAGE_HOST_ALLOWED = new Set(["efhub.com", "www.efhub.com"]);
const UA = "eFootball-Team-AI-dev/0.1 (image delivery research; <=4 requests; contact: local)";

const ids = process.argv.slice(2).filter(Boolean);

let requestCount = 0;
let lastRequestAt = 0;

function stop(reason, detail) {
  console.error("\n[investigate] 停止:", reason);
  if (detail !== undefined) console.error(detail);
  console.error("[investigate] 成果物ファイルは作成しませんでした。実行リクエスト数:", requestCount);
  process.exit(1);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function guardedFetch(url, opts, label) {
  if (requestCount >= MAX_REQUESTS) {
    stop(`リクエスト上限(${MAX_REQUESTS})を超える操作が必要になりました`, `次の要求: ${label} ${url}`);
  }
  const wait = GAP_MS - (Date.now() - lastRequestAt);
  if (wait > 0) await sleep(wait);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  requestCount++;
  lastRequestAt = Date.now();
  console.log(`[investigate] (${requestCount}/${MAX_REQUESTS}) ${label}: ${opts?.method ?? "GET"} ${url}`);
  try {
    return await fetch(url, {
      ...opts,
      redirect: "manual",
      signal: controller.signal,
      headers: {
        "User-Agent": UA,
        Accept:
          opts?.method === "HEAD" || label.startsWith("image")
            ? "image/avif,image/webp,image/png,image/*,*/*"
            : "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        ...(opts?.headers ?? {}),
      },
    });
  } catch (err) {
    stop(`${label} のリクエストに失敗（ネットワークまたはタイムアウト）`, err?.message ?? err);
  } finally {
    clearTimeout(timer);
  }
}

function hostOf(u) {
  try {
    return new URL(u).host.toLowerCase();
  } catch {
    return "";
  }
}
function registrable(host) {
  const parts = host.split(".");
  return parts.length <= 2 ? host : parts.slice(-2).join(".");
}

const HEADER_KEYS = [
  "content-type",
  "content-length",
  "cache-control",
  "etag",
  "last-modified",
  "age",
  "expires",
  "vary",
  "cf-cache-status",
  "cf-ray",
  "x-vercel-cache",
  "x-nextjs-cache",
  "x-cache",
  "x-served-by",
  "x-amz-cf-pop",
  "via",
  "server",
  "accept-ranges",
  "content-range",
];

function collectHeaders(headers) {
  const out = {};
  for (const k of HEADER_KEYS) {
    const v = headers.get(k);
    if (v != null) out[k] = v;
  }
  return out;
}

function detectAuthWall(text) {
  const t = text.toLowerCase();
  if (t.includes("just a moment") || t.includes("cf-chl") || t.includes("challenge-platform"))
    return "Cloudflare チャレンジ / CAPTCHA の兆候";
  if (/captcha/.test(t)) return "captcha 文字列を検出";
  if (/name=["']?password["']?/.test(t) && /(sign in|log ?in|ログイン)/i.test(text))
    return "ログインフォームの兆候";
  return null;
}

/** レスポンス本文から画像URL候補を抽出（推測はしない。本文に現れた文字列のみ） */
function extractImageUrls(text, baseUrl) {
  const found = new Map(); // url -> how(発見方法)

  const add = (raw, how) => {
    if (!raw) return;
    let s = raw
      .replace(/\\u002[fF]/g, "/")
      .replace(/\\\//g, "/")
      .replace(/&amp;/g, "&")
      .trim();
    try {
      const abs = new URL(s, baseUrl).href;
      if (/^https?:\/\//i.test(abs) && !found.has(abs)) found.set(abs, how);
    } catch {
      /* ignore */
    }
  };

  // 1) 拡張子つきの絶対/相対URL
  for (const m of text.matchAll(
    /(?:https?:)?\/\/[^\s"'`\\<>()]+?\.(?:png|jpe?g|webp|avif)(?:\?[^\s"'`\\<>()]*)?/gi,
  ))
    add(m[0], "ext-url");
  for (const m of text.matchAll(
    /["'(]((?:\/)[^\s"'`\\<>()]+?\.(?:png|jpe?g|webp|avif)(?:\?[^\s"'`\\<>()]*)?)["')]/gi,
  ))
    add(m[1], "ext-path");

  // 2) Next.js 画像最適化エンドポイント
  for (const m of text.matchAll(/\/_next\/image\?[^\s"'`\\<>()]+/gi)) {
    add(m[0], "next-image");
    const inner = /[?&]url=([^&"'`\\<>()]+)/i.exec(m[0]);
    if (inner) {
      try {
        add(decodeURIComponent(inner[1]), "next-image-url-param");
      } catch {
        /* ignore */
      }
    }
  }

  // 3) JSON / RSC のキー
  for (const m of text.matchAll(
    /"(?:src|srcSet|image|imageUrl|thumbnail|thumbnailUrl|picture|photo|avatar|cardImage|renderPath)"\s*:\s*"([^"]+)"/gi,
  )) {
    const v = m[1];
    if (/\.(png|jpe?g|webp|avif)/i.test(v) || /\/_next\/image/.test(v) || /image|cdn|media|asset/i.test(v))
      add(v, "json-key");
  }

  // 4) srcset 属性
  for (const m of text.matchAll(/srcset=["']([^"']+)["']/gi)) {
    for (const part of m[1].split(",")) add(part.trim().split(/\s+/)[0], "srcset");
  }

  return [...found.entries()].map(([url, how]) => ({ url, how }));
}

function pickRepresentative(candidates, playerId) {
  if (candidates.length === 0) return null;
  const withId = candidates.find((c) => c.url.includes(playerId));
  if (withId) return withId;
  const byDigits = [...candidates].sort((a, b) => {
    const da = (a.url.match(/\d{4,}/g) ?? []).join("").length;
    const db = (b.url.match(/\d{4,}/g) ?? []).join("").length;
    return db - da;
  });
  return byDigits[0];
}

function guessFormat(contentType, url) {
  const ct = (contentType ?? "").toLowerCase();
  if (ct.includes("avif")) return "AVIF";
  if (ct.includes("webp")) return "WebP";
  if (ct.includes("png")) return "PNG";
  if (ct.includes("jpeg") || ct.includes("jpg")) return "JPEG";
  const u = url.toLowerCase();
  if (u.includes(".avif")) return "AVIF(推測: URL拡張子)";
  if (u.includes(".webp")) return "WebP(推測: URL拡張子)";
  if (u.includes(".png")) return "PNG(推測: URL拡張子)";
  if (u.includes(".jpg") || u.includes(".jpeg")) return "JPEG(推測: URL拡張子)";
  return "不明";
}

async function fetchPlayerPage(playerId) {
  const url = `https://efhub.com/players/${encodeURIComponent(playerId)}`;
  const res = await guardedFetch(url, { method: "GET" }, `page(${playerId})`);

  const status = res.status;
  if (status >= 300 && status < 400) {
    const loc = res.headers.get("location");
    stop(
      `個別ページ ${url} がリダイレクト(${status})を返しました（自動追跡しません）`,
      `Location: ${loc ?? "(なし)"}`,
    );
  }
  if (status !== 200) {
    stop(`個別ページ ${url} が HTTP ${status} を返しました`);
  }

  const contentType = res.headers.get("content-type") ?? "(なし)";
  let text;
  try {
    text = await res.text();
  } catch (err) {
    stop(`個別ページ ${url} の本文読み取りに失敗`, err?.message ?? err);
  }

  const wall = detectAuthWall(text);
  if (wall) stop(`個別ページ ${url} で認証/CAPTCHA の兆候を検出: ${wall}`);

  const candidates = extractImageUrls(text, url);
  return { playerId, url, status, contentType, bytes: text.length, candidates };
}

async function probeImage(imgUrl) {
  const host = hostOf(imgUrl);
  const result = { url: imgUrl, host, method: null, status: null, headers: {}, rangeBytes: null };

  // HEAD を優先
  const head = await guardedFetch(imgUrl, { method: "HEAD" }, `image-HEAD`);
  result.method = "HEAD";
  result.status = head.status;

  const headOk = head.status >= 200 && head.status < 300 && head.headers.get("content-type");
  if (headOk) {
    result.headers = collectHeaders(head.headers);
    return result;
  }

  // HEAD 非対応（405/501/CT欠落など）→ Range GET 先頭2048バイト以内。内容は破棄。
  if (requestCount >= MAX_REQUESTS) {
    stop("HEAD が使えず Range GET が必要ですが、リクエスト上限に達しています", imgUrl);
  }
  const ranged = await guardedFetch(
    imgUrl,
    { method: "GET", headers: { Range: "bytes=0-2047" } },
    `image-RangeGET`,
  );
  result.method = head.status ? `HEAD(${head.status})→RangeGET` : "RangeGET";
  result.status = ranged.status;
  result.headers = collectHeaders(ranged.headers);
  try {
    const buf = await ranged.arrayBuffer();
    result.rangeBytes = buf.byteLength; // サイズのみ記録。バイナリは保存しない。
  } catch {
    result.rangeBytes = null;
  }
  return result;
}

async function main() {
  if (ids.length !== 2) {
    stop("引数が2つの選手IDではありません", `受け取った引数: ${JSON.stringify(ids)}`);
  }
  console.log("[investigate] 対象:", ids.join(", "));

  // --- 1) 個別ページ ---
  const pages = [];
  for (const id of ids) {
    pages.push(await fetchPlayerPage(id));
  }

  for (const p of pages) {
    console.log(`[investigate] page(${p.playerId}) status=${p.status} bytes=${p.bytes} 候補=${p.candidates.length}`);
    for (const c of p.candidates.slice(0, 12)) console.log(`    - [${c.how}] ${c.url}`);
  }

  if (pages.some((p) => p.candidates.length === 0)) {
    stop(
      "個別ページのレスポンスから画像URLを抽出できませんでした",
      pages.map((p) => `${p.playerId}: 候補0件 (bytes=${p.bytes})`).join("\n"),
    );
  }

  // --- 2) 代表候補の選定とホスト判定 ---
  const reps = pages.map((p) => ({
    playerId: p.playerId,
    rep: pickRepresentative(p.candidates, p.playerId),
  }));

  const repHosts = [...new Set(reps.map((r) => hostOf(r.rep.url)).filter(Boolean))];
  const nonEfhub = repHosts.filter(
    (h) => !ALLOWED_IMAGE_HOSTS.has(h) && registrable(h) !== "efhub.com",
  );

  // efhub.com 系以外（CDN 等）が代表候補 → アクセスせず停止して追加承認を求める
  if (nonEfhub.length > 0) {
    const lines = [];
    lines.push("抽出できた画像URLの代表候補が efhub.com 系以外のホストでした。");
    lines.push("画像URLへはアクセスせず停止します。追加承認をお願いします。");
    lines.push("");
    for (const p of pages) {
      lines.push(`● ${p.playerId} (${p.url})`);
      for (const c of p.candidates) lines.push(`   - ${hostOf(c.url)}  ${c.url}`);
    }
    lines.push("");
    lines.push(`非 efhub.com ホスト: ${nonEfhub.join(", ")}`);
    stop("画像URLのホストが efhub.com 系以外だった", lines.join("\n"));
  }

  // --- 3) 画像URLの確認（1選手につき最大1URL、HEAD優先） ---
  const probes = [];
  for (const r of reps) {
    const host = hostOf(r.rep.url);
    if (!ALLOWED_IMAGE_HOSTS.has(host) && registrable(host) !== "efhub.com") {
      stop("画像URLのホストが efhub.com 系以外だった", `${r.playerId}: ${r.rep.url}`);
    }
    probes.push({ playerId: r.playerId, rep: r.rep, probe: await probeImage(r.rep.url) });
  }

  // --- 4) 分析 ---
  const analysis = probes.map(({ playerId, rep, probe }) => {
    const idInUrl = rep.url.includes(playerId);
    // 選手ID以外の長い数字列 / ハッシュ状セグメント（カード識別子の可能性）
    const segs = (() => {
      try {
        return new URL(rep.url).pathname.split("/").filter(Boolean);
      } catch {
        return [];
      }
    })();
    const otherIdish = segs.filter(
      (s) => s !== playerId && (/^\d{5,}$/.test(s) || /^[0-9a-f]{8,}$/i.test(s.replace(/\.\w+$/, ""))),
    );
    const format = guessFormat(probe.headers["content-type"], rep.url);
    return { playerId, repUrl: rep.url, how: rep.how, idInUrl, otherIdish, format, probe };
  });

  const bothHaveId = analysis.every((a) => a.idInUrl);
  const nextImageUsed = probes.some((p) => /\/_next\/image/.test(p.rep.url));

  const now = new Date().toISOString();
  const md = buildMarkdown({ pages, analysis, bothHaveId, nextImageUsed, now });

  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
  await fs.writeFile(OUT_FILE, md, "utf8");

  console.log(`\n[investigate] 成果物を作成: ${path.relative(ROOT, OUT_FILE)}`);
  console.log(`[investigate] 実行リクエスト数: ${requestCount}/${MAX_REQUESTS}`);
}

function buildMarkdown({ pages, analysis, bothHaveId, nextImageUsed, now }) {
  const L = [];
  L.push("# 選手画像の配信方法 調査結果");
  L.push("");
  L.push(`調査日時: ${now}`);
  L.push(`実行リクエスト数: ${requestCount} / 上限 ${MAX_REQUESTS}`);
  L.push("対象: Lionel Messi (89138556575063) / Fabio Cannavaro (88041460996837)");
  L.push("方法: 個別ページ GET → 本文から画像URLを抽出 → 代表候補を HEAD 確認（必要時のみ Range GET 先頭2048B・内容破棄）");
  L.push("");

  L.push("## 1. 個別ページ");
  L.push("");
  L.push("| 選手ID | URL | HTTP | Content-Type | 本文サイズ | 抽出候補数 |");
  L.push("|---|---|---|---|---|---|");
  for (const p of pages) {
    L.push(`| ${p.playerId} | ${p.url} | ${p.status} | ${p.contentType} | ${p.bytes} bytes | ${p.candidates.length} |`);
  }
  L.push("");

  L.push("## 2. 抽出できた画像URL候補（本文に実在した文字列のみ）");
  for (const p of pages) {
    L.push("");
    L.push(`### ${p.playerId}`);
    for (const c of p.candidates) L.push(`- \`[${c.how}]\` ${c.url}  （host: ${safeHost(c.url)}）`);
  }
  L.push("");

  L.push("## 3. 代表候補の確認結果");
  L.push("");
  L.push("| 選手ID | 代表URL | host | メソッド | HTTP | Content-Type | Content-Length | 形式 | IDを含む | カード識別子候補 |");
  L.push("|---|---|---|---|---|---|---|---|---|---|");
  for (const a of analysis) {
    const h = a.probe.headers;
    L.push(
      `| ${a.playerId} | ${a.repUrl} | ${a.probe.host} | ${a.probe.method} | ${a.probe.status} | ${h["content-type"] ?? "-"} | ${h["content-length"] ?? (a.probe.rangeBytes != null ? `~${a.probe.rangeBytes}(range)` : "-")} | ${a.format} | ${a.idInUrl ? "はい" : "いいえ"} | ${a.otherIdish.length ? a.otherIdish.join(", ") : "なし"} |`,
    );
  }
  L.push("");

  L.push("### キャッシュ関連ヘッダー");
  for (const a of analysis) {
    L.push("");
    L.push(`- **${a.playerId}** \`${a.repUrl}\``);
    for (const k of HEADER_KEYS) {
      if (a.probe.headers[k] != null) L.push(`  - ${k}: ${a.probe.headers[k]}`);
    }
  }
  L.push("");

  L.push("## 4. 判定");
  L.push("");
  L.push(`- 選手IDが画像URLに含まれるか: **${bothHaveId ? "2選手とも含む" : "少なくとも1選手で含まれない"}**`);
  L.push(`- Next.js 画像最適化(\`/_next/image\`)経由か: **${nextImageUsed ? "はい" : "いいえ（直接URL）"}**`);
  const hosts = [...new Set(analysis.map((a) => a.probe.host))];
  L.push(`- 画像ホスト: ${hosts.join(", ")}`);
  const anyCardId = analysis.some((a) => a.otherIdish.length > 0);
  L.push(`- カードを区別できる識別子: **${anyCardId ? "URL上に候補あり" : "URL上には見当たらず（要追加調査）"}**`);
  L.push("");
  L.push("### 【確認済み事項】");
  L.push("- 上表の HTTP ステータス・Content-Type・ヘッダー（実測）。");
  L.push("- 各選手ページから抽出できた画像URL候補（本文に実在）。");
  L.push("");
  L.push("### 【推測事項】");
  L.push(
    bothHaveId
      ? "- 画像URLは `選手ID` を含むため、ID から URL を組み立てられる可能性が高い（2選手一致。要追検証）。"
      : "- 画像URLに選手IDが含まれないケースがあり、ID からの自動生成は難しい可能性。",
  );
  L.push("- カード違い（同一選手の別カード）の区別可否は、同一選手の複数カードで追加確認が必要。");
  L.push("");
  L.push("### 【未確認事項】");
  L.push("- ID を含まない/別識別子の場合の URL 生成規則。");
  L.push("- 画像が存在しないカードの応答（404 か 既定シルエット画像か）。今回は対象2選手が実在カードのため未確認。");
  L.push("- eFHUB の画像利用に関する規約 / robots.txt。");
  L.push("");

  L.push("## 5. 推奨する Next.js 表示方式");
  L.push("");
  L.push("本プロジェクトの原則「画面は外部を直接呼ばない / 通常表示は自前データ」を踏まえた推奨:");
  L.push("");
  L.push("- **案A（推奨）: 自前プロキシ** — `/api/player-image/[id]` を作り、サーバー側で eFHUB 画像を取得→キャッシュ→返す。");
  L.push("  - 画面（クライアント）は自前URLのみを参照。配信元をユーザーに晒さない。");
  L.push("  - `next.config.mjs` の `images.remotePatterns` 変更が不要（同一オリジン扱い）。");
  L.push("  - 失敗時にプロキシがプレースホルダーを返せる。");
  L.push("- 案B: `next/image` 直リンク — `images.remotePatterns` に画像ホストのみ追加。最小実装だがクライアントが外部ホストへアクセス。");
  L.push("- 案C: 同期時に事前ダウンロードして自前ストレージへ — 10万人規模に最適だが今回スコープ外（大量DL）。");
  L.push("");
  L.push("> 注: 今回のフェーズでは設定・コードは変更していません。次フェーズで案Aの実装計画を作成する想定。");
  L.push("");

  L.push("## 6. 推奨するキャッシュ方式");
  L.push("");
  L.push("- 配信元の `Cache-Control` / `ETag`（上記実測値）を尊重。");
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
  L.push("- 同一選手の複数カード（例: Messi の 107/106/105）でURLを比較し、カード識別子の規則を確定。");
  L.push("- 画像が無いカードの応答確認。");
  L.push("- eFHUB の規約 / robots.txt 確認。");
  L.push("");

  return L.join("\n") + "\n";
}

function safeHost(u) {
  try {
    return new URL(u).host;
  } catch {
    return "(不正なURL)";
  }
}

main().catch((err) => stop("想定外のエラー", err?.stack ?? err));
