/**
 * 監督画像の取得可能性の調査。
 *   node scripts/investigate-manager-photos.mjs
 *
 * 外部アクセス: raw.githubusercontent.com / github.com への GET のみ・最大10回・逐次・間隔3秒・20秒・再試行なし・
 *   Cookie/Authorization/APIキーなし・redirect 非追跡。
 * ソース: amine250/efootball-managers（現在 managers.json 取得に使用中の公開リポジトリ）。
 * 代表画像は ./data/manager-photos-probe/ へ一時保存（ワークスペース内・目視確認用）。
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const PROBE_DIR = path.join(ROOT, "data", "manager-photos-probe");
const REPO_RAW = "https://raw.githubusercontent.com/amine250/efootball-managers/main";
const UA = "eFootball-Team-AI-dev/0.1 (manager photo availability check; contact: project owner)";
const TIMEOUT_MS = 20_000;
const GAP_MS = 3_000;

// 直前の実行で 2 回（robots x2）使用済み。合計 10 回を超えないよう開始値を 2 とする。
let requestCount = 2;
const log = [];

async function safeGet(url, { binary = false } = {}) {
  if (requestCount >= 10) throw new Error("STOP: 外部アクセス上限(10)に達しました");
  if (requestCount > 0) await new Promise((r) => setTimeout(r, GAP_MS));
  requestCount++;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: binary ? "image/*" : "text/plain, */*" },
    });
  } finally {
    clearTimeout(t);
  }

  const status = res.status;
  const ct = res.headers.get("content-type") ?? "";
  const cl = res.headers.get("content-length");
  const loc = res.headers.get("location");
  const setCookie = [...res.headers.keys()].some((k) => k.toLowerCase() === "set-cookie");
  const entry = { n: requestCount, url, status, contentType: ct, contentLength: cl, location: loc, setCookie };

  if (status === 401) { entry.stop = "HTTP 401（認証要求）"; log.push(entry); throw new Error(`STOP: 401 ${url}`); }
  if (status === 403) { entry.stop = "HTTP 403"; log.push(entry); throw new Error(`STOP: 403 ${url}`); }
  if (status === 429) { entry.stop = "HTTP 429"; log.push(entry); throw new Error(`STOP: 429 ${url}`); }
  // 注: レスポンスの set-cookie は記録のみ。Cookie ヘッダーは送らず保存もしないため「Cookie が必要」ではない。
  //     認証/CAPTCHA/ログインへのリダイレクトのみ停止条件とする。
  if (status >= 300 && status < 400 && /login|signin|captcha|sso/i.test(loc ?? "")) {
    entry.stop = `認証系リダイレクト → ${loc}`;
    log.push(entry);
    throw new Error(`STOP: 認証系リダイレクト ${url}`);
  }
  if (status >= 300 && status < 400) {
    entry.note = `redirect（追跡しない） → ${loc}`;
    log.push(entry);
    return { ...entry, body: null, bytes: null };
  }

  let body = null;
  let bytes = null;
  if (status === 200) {
    if (binary) {
      const ab = await res.arrayBuffer();
      bytes = Buffer.from(ab);
      entry.bytesLen = bytes.length;
      entry.magic = bytes.slice(0, 8).toString("hex");
    } else {
      body = (await res.text()).slice(0, 20_000);
      entry.bodyLen = body.length;
    }
  }
  log.push(entry);
  return { ...entry, body, bytes };
}

function isPng(buf) {
  return buf && buf.length > 8 && buf.slice(0, 8).toString("hex") === "89504e470d0a1a0a";
}
function isJpeg(buf) {
  return buf && buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
}

async function main() {
  await fs.mkdir(PROBE_DIR, { recursive: true });
  const findings = { requests: [], images: [], summary: {} };

  // 1. robots.txt（github.com。raw は前回 404 を確認済み）
  const robotsGh = await safeGet("https://github.com/robots.txt");
  findings.robots = {
    raw: { status: 404, note: "前回実行で確認: raw.githubusercontent.com は root に robots.txt なし（404・14バイト）" },
    github: { status: robotsGh.status, body: robotsGh.body },
  };

  // 2. README（利用条件）
  const readme = await safeGet(`${REPO_RAW}/README.md`);
  findings.readme = { status: readme.status, body: readme.body };

  // 3. 代表監督の画像
  const targets = [
    ["conte", "conte.png"],
    ["deschamps", "deschamps.png"],
    ["deschamps2", "deschamps2.png"],
    ["beckenbauer", "beckenbauer.png"],
    ["nophoto", "nophoto.png"],
  ];
  for (const [label, file] of targets) {
    if (requestCount >= 10) {
      findings.images.push({ label, file, skipped: "外部アクセス上限" });
      continue;
    }
    const r = await safeGet(`${REPO_RAW}/data/photos/${file}`, { binary: true });
    const rec = {
      label,
      file,
      url: `${REPO_RAW}/data/photos/${file}`,
      status: r.status,
      contentType: r.contentType,
      contentLength: r.contentLength,
      bytesLen: r.bytesLen ?? null,
      isPng: isPng(r.bytes),
      isJpeg: isJpeg(r.bytes),
      under3MB: (r.bytesLen ?? 0) <= 3 * 1024 * 1024,
      redirected: r.status >= 300 && r.status < 400 ? r.location : null,
    };
    findings.images.push(rec);
    if (r.status === 200 && r.bytes) {
      const ext = isPng(r.bytes) ? "png" : isJpeg(r.bytes) ? "jpg" : "bin";
      await fs.writeFile(path.join(PROBE_DIR, `${label}.${ext}`), r.bytes);
    }
  }

  findings.requests = log;
  findings.summary = {
    totalRequests: requestCount,
    host: "raw.githubusercontent.com",
    allImagesPng: findings.images.every((i) => i.skipped || i.isPng),
    allUnder3MB: findings.images.every((i) => i.skipped || i.under3MB),
    anyRedirect: findings.images.some((i) => i.redirected),
    anySetCookie: log.some((e) => e.setCookie),
  };

  await fs.writeFile(
    path.join(PROBE_DIR, "_findings.json"),
    JSON.stringify(findings, null, 2),
    "utf8",
  );

  console.log("=== robots.txt (raw.githubusercontent.com) ===");
  console.log(findings.robots.raw.status, "\n" + (findings.robots.raw.body ?? "(なし)").slice(0, 1500));
  console.log("\n=== robots.txt (github.com) 抜粋 ===");
  console.log(findings.robots.github.status, "\n" + (findings.robots.github.body ?? "(なし)").slice(0, 800));
  console.log("\n=== README 抜粋 ===");
  console.log(findings.readme.status, "\n" + (findings.readme.body ?? "(なし)").slice(0, 3000));
  console.log("\n=== 画像 ===");
  console.log(JSON.stringify(findings.images, null, 2));
  console.log("\n=== サマリー ===");
  console.log(JSON.stringify(findings.summary, null, 2));
  console.log(`\n合計外部アクセス: ${requestCount} 回 / 保存先: data/manager-photos-probe/`);
}

main().catch((err) => {
  console.error("調査中断:", err.message ?? err);
  console.error(`ここまでの外部アクセス: ${requestCount} 回`);
  console.error(JSON.stringify(log, null, 2));
  process.exit(1);
});
