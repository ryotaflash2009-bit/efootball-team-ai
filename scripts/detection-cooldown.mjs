/**
 * 上流（eFootball World）が HTTP 429 を返したあとの「待つ時間」（2026-10-24）。
 *
 *   node scripts/detection-cooldown.mjs check  <state.json> [confirm]   … 待つ時間の中なら上流へ行かずに失敗（exit 1）
 *   node scripts/detection-cooldown.mjs record <state.json> <summary.json> … World の取得が http_429 なら待つ時間を記録
 *   node scripts/detection-cooldown.mjs clear  <state.json>              … 検出が成功したら待つ時間を消す（取得元が戻ったらすぐ毎時に戻す）
 *
 * - 2026-10-20 から上流がサイト全体に機械判定（Vercel Security Checkpoint）をかけ、毎時の検出がすべて 429 になった。
 *   2026-10-25 本人の指示「自動更新の頻度は落とすな」: 待つ時間は 55 分（毎時の定期の検出は毎回たずねる）。
 *   同じ 1 時間の中で重なった実行（watchdog・手動の再実行）だけを上流へ行かせない。
 * - 待つ時間の中の run は「失敗」で終える（成功にすると、検出の遅れの見張りが止まっていることに気づけない）。
 * - 本人が手で `detect-force` を選んだときは待たない。
 * - 上流へは一切アクセスしない（このスクリプトはファイルを読み書きするだけ）。
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const COOLDOWN_MS = 55 * 60 * 1000;

/** 待つ時間の中か（壊れた値・未設定は「待たない」）。 */
export function inCooldown(state, now = Date.now(), confirm = "") {
  if (confirm === "detect-force") return false;
  const until = state && typeof state.until === "string" ? Date.parse(state.until) : Number.NaN;
  return Number.isFinite(until) && now < until;
}

/** 検出の結果の要約に「World の取得の http_429」があるか（監督など別の取得元の 429 では待たない）。 */
export function summaryHas429(summary) {
  return JSON.stringify(summary ?? {}).includes("world_player_cards:source_fetch:http_429");
}

export function nextCooldown(now = Date.now()) {
  return { until: new Date(now + COOLDOWN_MS).toISOString(), reason: "http_429", recordedAt: new Date(now).toISOString() };
}

function readJson(p) {
  try {
    return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null;
  } catch {
    return null;
  }
}

function main(argv) {
  const [cmd, statePath, third] = argv;
  if (cmd === "check") {
    const state = readJson(statePath);
    if (inCooldown(state, Date.now(), third ?? "")) {
      console.log(`::error::upstream returned HTTP 429; waiting until ${state.until} before asking again (no upstream request in this run)`);
      return 1;
    }
    console.log("cooldown: none");
    return 0;
  }
  if (cmd === "record") {
    const summary = readJson(third);
    if (!summaryHas429(summary)) {
      console.log("cooldown: not recorded (no http_429)");
      return 0;
    }
    const next = nextCooldown();
    mkdirSync(path.dirname(statePath), { recursive: true });
    writeFileSync(statePath, JSON.stringify(next) + "\n", "utf8");
    console.log(`cooldown: recorded until ${next.until}`);
    return 0;
  }
  if (cmd === "clear") {
    if (existsSync(statePath)) writeFileSync(statePath, JSON.stringify({ until: null, clearedAt: new Date().toISOString() }) + "\n", "utf8");
    console.log("cooldown: cleared");
    return 0;
  }
  console.error("usage: detection-cooldown.mjs check <state> [confirm] | record <state> <summary> | clear <state>");
  return 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
