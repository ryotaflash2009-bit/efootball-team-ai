/**
 * World 画像の実取得確認（限定的・承認済み）。
 *   node scripts/verify-world-images.mjs
 *
 * - 起動中の本番サーバー（localhost:3000）の内部プロキシ経由でのみ確認する。
 * - 内部プロキシが外部へ出るのは d1zxa6glxh8sq9.cloudfront.net のみ（サーバー側で許可ホスト検証）。
 * - 外部 GET の累計は各レスポンスの X-Image-Upstream-Requests で数える。
 *   累計が MAX_EXTERNAL(10) に達したら即停止。
 * - 1 リクエストずつ順次（同時 1）。ディスク保存なし。
 * - 結果は docs/black-box-tests/world-images.md へ。
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const REPORT = path.join(ROOT, "docs", "black-box-tests", "world-images.md");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const MAX_EXTERNAL = 10;

let externalTotal = 0;
const results = [];
const rows = [];

function record(name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
}

/** 内部プロキシへ 1 回アクセスし、外部 GET 累計を更新する */
async function proxyGet(pathname, { allowExternal = true } = {}) {
  if (externalTotal >= MAX_EXTERNAL && allowExternal) {
    return { capped: true, status: 0 };
  }
  const r = await fetch(BASE + pathname, { redirect: "manual" });
  const buf = new Uint8Array(await r.arrayBuffer());
  const upstream = Number(r.headers.get("x-image-upstream-requests") ?? "0");
  if (Number.isFinite(upstream)) externalTotal += upstream;
  return {
    status: r.status,
    contentType: (r.headers.get("content-type") ?? "").toLowerCase(),
    placeholder: r.headers.get("x-image-placeholder") === "1",
    cacheState: r.headers.get("x-image-cache"),
    reason: r.headers.get("x-image-reason"),
    bytes: buf.byteLength,
    upstream,
  };
}

const MB = 1024 * 1024;

function classify(res) {
  const okImage =
    res.status === 200 && res.contentType.startsWith("image/") && !res.placeholder && res.bytes > 0 && res.bytes <= 3 * MB;
  return okImage ? "IMAGE" : res.placeholder ? "PLACEHOLDER" : `HTTP ${res.status}`;
}

async function main() {
  // 一覧先頭ページ（順序固定）を取得（画像取得なし）
  const listResp = await fetch(`${BASE}/api/world/players?pageSize=24&sort=ovr_max_desc`);
  const list = await listResp.json();
  const first24 = list.players.map((p) => ({
    id: p.worldCardId,
    name: p.nameEn,
    efhub: p.hasEfhubLink,
    hasImg: p.imageUrlCandidate != null,
    hasMob: p.mobileImageUrlCandidate != null,
  }));
  record("一覧API 先頭24件を取得（外部アクセスなし）", first24.length === 24, `${first24.length} 件`);

  // ---- 代表カード ----
  const MESSI_NOLINK = "89138556575063"; // eFHUB リンクなし・World 通常画像
  const MESSI_LINK = "89136409091415"; // eFHUB リンクあり・mobile もあり

  // 1. eFHUB リンクなしの Messi → World 通常画像プロキシ
  let res = await proxyGet(`/api/world/player-image/${MESSI_NOLINK}`);
  rows.push({ label: "代表1: eFHUB リンクなし Messi", id: MESSI_NOLINK, result: classify(res), bytes: res.bytes, upstream: res.upstream });
  record("代表1: eFHUB リンクなし Messi の World 通常画像が取得できる", classify(res) === "IMAGE", `${classify(res)} ${(res.bytes / 1024).toFixed(0)}KB up=${res.upstream}`);

  // 3.（= 代表1 と同じ経路）World 通常画像を使用するカード → 別カードでもう1件
  const otherPlain = first24.find((c) => !c.efhub && c.hasImg && c.id !== MESSI_NOLINK);
  res = await proxyGet(`/api/world/player-image/${otherPlain.id}`);
  rows.push({ label: `代表3: World 通常画像カード (${otherPlain.name})`, id: otherPlain.id, result: classify(res), bytes: res.bytes, upstream: res.upstream });
  record("代表3: World 通常画像カードが取得できる", classify(res) === "IMAGE", `${otherPlain.name} ${classify(res)} up=${res.upstream}`);

  // 2. eFHUB リンクありの Messi
  //    UI 上は eFHUB プロキシ(efimg)が優先。ここでは World プロキシ経路そのものを確認。
  const efimg = await proxyGet(`/api/player-image/${MESSI_LINK}`, { allowExternal: true });
  externalTotal += 1; // efimg.com への GET（承認済みホスト）も累計に含める
  rows.push({ label: "代表2a: eFHUB リンクあり Messi / eFHUB プロキシ(efimg)", id: MESSI_LINK, result: classify(efimg), bytes: efimg.bytes, upstream: "-" });
  record("代表2a: eFHUB リンクあり Messi は eFHUB プロキシ(efimg)で画像が出る", classify(efimg) === "IMAGE", `${classify(efimg)} ${(efimg.bytes / 1024).toFixed(0)}KB`);

  res = await proxyGet(`/api/world/player-image/${MESSI_LINK}`);
  rows.push({ label: "代表2b: eFHUB リンクあり Messi / World プロキシ経路", id: MESSI_LINK, result: classify(res), bytes: res.bytes, upstream: res.upstream });
  record("代表2b: 同カードの World プロキシ経路も画像が出る", classify(res) === "IMAGE", `${classify(res)} up=${res.upstream}`);

  // 4. World モバイル画像へのフォールバック確認（?variant=mobile）
  res = await proxyGet(`/api/world/player-image/${MESSI_LINK}?variant=mobile`);
  rows.push({ label: "代表4: World モバイル画像 (?variant=mobile)", id: MESSI_LINK, result: classify(res), bytes: res.bytes, upstream: res.upstream });
  record("代表4: World モバイル画像が取得できる", classify(res) === "IMAGE", `${classify(res)} up=${res.upstream}`);

  // 5. 存在しない World カード ID（外部アクセスなしでプレースホルダー）
  res = await proxyGet(`/api/world/player-image/99999999999999`);
  rows.push({ label: "代表5: 存在しない World ID", id: "99999999999999", result: classify(res), bytes: res.bytes, upstream: res.upstream });
  record("代表5: 存在しない ID はプレースホルダー & 外部アクセス 0", res.placeholder && res.upstream === 0, `${classify(res)} up=${res.upstream}`);

  // 6. 不正な World カード ID（400・外部アクセスなし）
  res = await proxyGet(`/api/world/player-image/abc`);
  rows.push({ label: "代表6: 不正な World ID", id: "abc", result: classify(res), bytes: res.bytes, upstream: res.upstream });
  record("代表6: 不正な ID は 400 & 外部アクセス 0", res.status === 400 && res.upstream === 0, `HTTP ${res.status} up=${res.upstream}`);
  res = await proxyGet(`/api/world/player-image/${encodeURIComponent("1;DROP")}`);
  record("代表6b: SQL 風 ID も 400 & 外部アクセス 0", res.status === 400 && res.upstream === 0, `HTTP ${res.status}`);

  // ---- 一覧先頭ページのサンプル（残り予算内で複数枚） ----
  const sampleTargets = first24
    .filter((c) => c.hasImg && ![MESSI_NOLINK, MESSI_LINK, otherPlain.id].includes(c.id))
    .slice(0, 4);
  let sampleImages = 0;
  const sampleDetail = [];
  for (const c of sampleTargets) {
    if (externalTotal >= MAX_EXTERNAL) {
      record("先頭ページ画像サンプル: 予算上限で打ち切り", true, `external=${externalTotal}/${MAX_EXTERNAL}`);
      break;
    }
    const r = await proxyGet(`/api/world/player-image/${c.id}`);
    const cls = classify(r);
    sampleDetail.push(`${c.name}:${cls}`);
    if (cls === "IMAGE") sampleImages += 1;
    rows.push({ label: `先頭ページ ${c.name}`, id: c.id, result: cls, bytes: r.bytes, upstream: r.upstream });
  }
  record(
    "先頭ページのサンプル画像がすべて正常取得できる",
    sampleImages === sampleTargets.length && sampleImages > 0,
    `${sampleImages}/${sampleTargets.length}  [${sampleDetail.join(", ")}]`,
  );

  // 先頭24件の推定: 全カードに World 画像 URL があり、サンプルが全部 IMAGE なら「先頭24件は全て正常画像想定」
  const first24Placeholder = first24.filter((c) => !c.hasImg).length;
  record(
    "先頭24件: World 画像 URL を持つ枚数",
    first24.filter((c) => c.hasImg).length === 24,
    `${first24.filter((c) => c.hasImg).length}/24（NO IMAGE 想定 ${first24Placeholder}）`,
  );

  // ---- 3MB 上限（実データで超過は無いはずだが記録） ----
  const maxBytes = Math.max(0, ...rows.filter((r) => r.result === "IMAGE").map((r) => r.bytes));
  record("取得画像はすべて 3MB 以内", maxBytes <= 3 * MB, `最大 ${(maxBytes / 1024).toFixed(0)}KB`);

  record(`外部 GET 累計は ${MAX_EXTERNAL} 回以内`, externalTotal <= MAX_EXTERNAL, `${externalTotal} 回`);

  await write();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n[verify-world-images] 外部GET累計: ${externalTotal}/${MAX_EXTERNAL}`);
  console.log(`[verify-world-images] ${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) process.exit(1);
}

async function write() {
  const failed = results.filter((r) => !r.pass);
  const L = [
    "# World 画像 実取得確認",
    "",
    `実行日時: ${new Date().toISOString()}`,
    `対象: ${BASE}（内部プロキシ経由）`,
    `許可外部ホスト: d1zxa6glxh8sq9.cloudfront.net（GET のみ / 同時1 / 20秒 / 再試行なし / リダイレクト非追跡）`,
    `外部 GET 累計: **${externalTotal} / ${MAX_EXTERNAL}**`,
    "",
    "## 個別カードの結果",
    "",
    "| カード | worldCardId | 結果 | サイズ | 外部GET |",
    "|---|---|---|---|---|",
    ...rows.map((r) => `| ${r.label} | ${r.id} | ${r.result} | ${r.result === "IMAGE" ? (r.bytes / 1024).toFixed(0) + "KB" : "-"} | ${r.upstream} |`),
    "",
    "## チェック項目",
    "",
    "| 結果 | 項目 | 詳細 |",
    "|---|---|---|",
    ...results.map((r) => `| ${r.pass ? "PASS" : "FAIL"} | ${r.name} | ${(r.detail || "").replace(/\|/g, "\\|")} |`),
    "",
    `## 判定: ${failed.length === 0 ? "全項目 PASS" : failed.length + " 件 FAIL"}`,
    "",
  ];
  await fs.mkdir(path.dirname(REPORT), { recursive: true });
  await fs.writeFile(REPORT, L.join("\n") + "\n", "utf8");
  console.log(`[verify-world-images] レポート: ${path.relative(ROOT, REPORT)}`);
}

main().catch(async (err) => {
  record("スクリプト実行", false, err?.message ?? String(err));
  await write();
  process.exit(1);
});
