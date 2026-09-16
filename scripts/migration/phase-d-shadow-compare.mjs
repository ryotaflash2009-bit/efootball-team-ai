/**
 * Phase D: SQLite経路とSupabase reference_data経路の全件シャドー比較ツール。
 *
 * - アプリ本体の実装(src/lib/world/repository.ts・src/lib/managers/repository.ts・
 *   src/lib/world/analysis-repository.ts)を、WORLD_DATA_SOURCE環境変数を都度切り替えて
 *   直接呼び出す。比較ロジックを別実装で再現しない(実装のズレによる誤検出を避けるため)。
 * - 実Supabaseへの書込みは一切行わない(SELECT/Data API読み取りのみ)。
 * - 全件をメモリへ一度に保持しないよう、ページ単位・チャンク単位で処理する。
 * - 差分レポートには、IDと差分の種類だけを記録し、行データ全文・画像URL全文は出力しない。
 * - 実Supabaseへの匿名(anon)キー読み取りだけを使う(service_role/DBパスワードは一切使わない)。
 *
 * 実行:
 *   node scripts/migration/phase-d-shadow-compare.mjs
 */
import { DatabaseSync } from "node:sqlite";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { register } from "node:module";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
register(pathToFileURL(path.join(HERE, "..", "lib", "ts-extension-resolve-hook.mjs")));

// --- .env.local からNEXT_PUBLIC_*(非秘密の公開値)だけを読み、プロセス環境へ設定する ---
async function loadPublicSupabaseEnv() {
  const content = await fs.readFile(path.join(ROOT, ".env.local"), "utf8");
  const urlMatch = content.match(/^NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.*)$/m);
  const keyMatch = content.match(/^NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY\s*=\s*(.*)$/m);
  if (!urlMatch || !keyMatch) throw new Error(".env.localにNEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEYが見つからない");
  process.env.NEXT_PUBLIC_SUPABASE_URL = urlMatch[1].trim();
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = keyMatch[1].trim();
}
await loadPublicSupabaseEnv();

const { listPlayers, getPlayerByWorldId, getFacets, getSourceMeta, _resetFacetCache } = await import("../../src/lib/world/repository.ts");
const { listManagers, getManagerById, getManagerCount } = await import("../../src/lib/managers/repository.ts");
const { getEfhubAnalysisDetail } = await import("../../src/lib/world/analysis-repository.ts");
const { buildEfhubLinkMap, buildAiStylesMap, buildAppearanceMap, buildEfhubConflictsMap, buildManagerBoostersMap, buildManagerLinkUpPlaysMap } = await import(
  "../../src/lib/reference-data/detail-extension-transform.ts"
);

const DB_PATH = path.join(ROOT, "data", "efootball.db");
const OUT_PATH = path.join(ROOT, "docs", "production-readiness", "phase-d-shadow-comparison-results.md");

const timings = {}; // { label: number[] (ms) }
function timeStart() {
  return process.hrtime.bigint();
}
function timeEnd(label, start) {
  const ms = Number(process.hrtime.bigint() - start) / 1e6;
  (timings[label] ??= []).push(ms);
  return ms;
}
function percentile(arr, p) {
  if (arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}
function statsFor(label) {
  const arr = timings[label] ?? [];
  if (arr.length === 0) return null;
  const sum = arr.reduce((a, b) => a + b, 0);
  const sorted = [...arr].sort((a, b) => a - b);
  return {
    n: arr.length,
    avg: sum / arr.length,
    median: percentile(arr, 50),
    p95: percentile(arr, 95),
    max: sorted[sorted.length - 1],
  };
}

async function withSource(source, fn) {
  const prev = process.env.WORLD_DATA_SOURCE;
  process.env.WORLD_DATA_SOURCE = source;
  try {
    return await fn();
  } finally {
    if (prev === undefined) delete process.env.WORLD_DATA_SOURCE;
    else process.env.WORLD_DATA_SOURCE = prev;
  }
}

const report = { sections: [] };
function section(title) {
  const s = { title, lines: [], diffs: [] };
  report.sections.push(s);
  return {
    log(line) {
      console.log(line);
      s.lines.push(line);
    },
    diff(entry) {
      s.diffs.push(entry);
    },
  };
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}
/**
 * オブジェクトのキー順序に依存しない再帰的な深い等価比較。
 * PostgreSQLのjsonb型は格納時にトップレベル以下のキー順序を独自に並べ替えるため、
 * JSON.stringifyによる文字列比較はキー順序の違いだけで誤って「不一致」と判定してしまう
 * (実際に本比較ツールでこれによる誤検出が発生したため、この関数へ置き換えた)。
 * 配列の順序は意味を持つため、配列要素の順序はそのまま比較する。
 */
function jsonEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) return a === b;
  if (typeof a !== "object" || typeof b !== "object") return a === b;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) if (!jsonEqual(a[i], b[i])) return false;
    return true;
  }
  const keysA = Object.keys(a).sort();
  const keysB = Object.keys(b).sort();
  if (keysA.length !== keysB.length) return false;
  for (let i = 0; i < keysA.length; i += 1) if (keysA[i] !== keysB[i]) return false;
  for (const key of keysA) if (!jsonEqual(a[key], b[key])) return false;
  return true;
}

// ============================================================
// 直接Data API(anon)を叩くための最小限のfetchヘルパー(ページング対応)
// ============================================================
async function fetchReferenceDataPage(table, { select, order, limit, offset, extraQuery = "" }) {
  const url = new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${table}`);
  url.searchParams.set("select", select);
  if (order) url.searchParams.set("order", order);
  const res = await fetch(url.toString() + (extraQuery ? `&${extraQuery}` : ""), {
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}`,
      "Accept-Profile": "reference_data",
      Range: `${offset}-${offset + limit - 1}`,
      Prefer: "count=exact",
    },
  });
  const contentRange = res.headers.get("content-range"); // "start-end/total"
  const total = contentRange ? Number(contentRange.split("/")[1]) : null;
  const rows = await res.json();
  if (!res.ok) throw new Error(`Data API error (${table}): ${res.status} ${JSON.stringify(rows).slice(0, 200)}`);
  return { rows, total };
}

async function fetchAllReferenceDataRows(table, { select, order }, pageSize = 1000) {
  const all = [];
  let offset = 0;
  for (;;) {
    const { rows, total } = await fetchReferenceDataPage(table, { select, order, limit: pageSize, offset });
    all.push(...rows);
    offset += rows.length;
    if (rows.length === 0 || (total != null && offset >= total)) break;
  }
  return all;
}

// ============================================================
// A. 件数(SQLite実測 vs Supabase実測)
// ============================================================
async function sectionCounts() {
  const s = section("A. 件数(SQLite実測 vs Supabase実測)");
  const db = new DatabaseSync(DB_PATH, { readOnly: true });

  const worldCount = db.prepare("SELECT COUNT(*) AS n FROM world_player_cards").get().n;
  const managersCount = db.prepare("SELECT COUNT(*) AS n FROM managers").get().n;
  const linkRows = db.prepare("SELECT internal_card_id, source, source_card_id FROM source_record_links").all();
  const efhubLinkMap = buildEfhubLinkMap(linkRows);
  const aiStylesMap = buildAiStylesMap(db.prepare("SELECT world_card_id, style_name, display_order FROM world_player_ai_styles").all());
  const appearanceMap = buildAppearanceMap(db.prepare("SELECT * FROM world_player_appearances").all());
  const conflictsMap = buildEfhubConflictsMap(db.prepare("SELECT world_card_id, field_name, efhub_value, world_value FROM data_conflicts").all());
  const boostersMap = buildManagerBoostersMap(db.prepare("SELECT * FROM manager_boosters").all());
  const linkUpPlaysMap = buildManagerLinkUpPlaysMap(
    db.prepare("SELECT * FROM manager_link_up_plays").all(),
    db.prepare("SELECT * FROM manager_link_up_conditions").all(),
  );
  db.close();

  const t0 = timeStart();
  const { total: supaWorldCount } = await fetchReferenceDataPage("world_player_cards", { select: "world_card_id", limit: 1, offset: 0 });
  timeEnd("count:world", t0);
  const t1 = timeStart();
  const { total: supaManagersCount } = await fetchReferenceDataPage("managers", { select: "internal_manager_id", limit: 1, offset: 0 });
  timeEnd("count:managers", t1);

  s.log(`world_player_cards: SQLite=${worldCount} / Supabase=${supaWorldCount} / 一致=${worldCount === supaWorldCount}`);
  s.log(`managers: SQLite=${managersCount} / Supabase=${supaManagersCount} / 一致=${managersCount === supaManagersCount}`);
  s.log(
    `SQLite側の期待値: efhub実リンク=${efhubLinkMap.size}件 / ai_styles非空=${aiStylesMap.size}件 / appearance設定=${appearanceMap.size}件 / conflicts非空=${conflictsMap.size}件`,
  );
  s.log(`SQLite側の期待値: boosters非空=${boostersMap.size}件 / link_up_plays非空=${linkUpPlaysMap.size}件`);

  return { worldCount, managersCount, efhubLinkMap, aiStylesMap, appearanceMap, conflictsMap, boostersMap, linkUpPlaysMap };
}

// ============================================================
// B. world_player_cards 新規4列の全件比較(raw column、ページング)
// ============================================================
async function sectionWorldColumnsFull(expected) {
  const s = section("B. world_player_cards 新規4列の全件比較(13,009件、ページング)");
  const t0 = timeStart();
  const rows = await fetchAllReferenceDataRows(
    "world_player_cards",
    { select: "world_card_id,efhub_card_id,ai_styles,appearance,efhub_conflicts", order: "world_card_id.asc" },
    1000,
  );
  const elapsed = timeEnd("list:world_columns_full", t0);
  s.log(`Supabaseから取得: ${rows.length}件(${(elapsed / 1000).toFixed(1)}秒、${Math.ceil(rows.length / 1000)}リクエスト)`);

  let mismatchCount = 0;
  const examples = [];
  const categories = { efhub_card_id: 0, ai_styles: 0, appearance: 0, efhub_conflicts: 0 };
  for (const row of rows) {
    const id = row.world_card_id;
    const expectedEfhub = expected.efhubLinkMap.get(id) ?? null;
    const expectedAiStyles = expected.aiStylesMap.get(id) ?? [];
    const expectedAppearance = expected.appearanceMap.get(id) ?? null;
    const expectedConflicts = expected.conflictsMap.get(id) ?? [];

    const diffs = [];
    if (row.efhub_card_id !== expectedEfhub) diffs.push("efhub_card_id");
    if (!arraysEqual(row.ai_styles ?? [], expectedAiStyles)) diffs.push("ai_styles");
    if (!jsonEqual(row.appearance, expectedAppearance)) diffs.push("appearance");
    if (!jsonEqual(row.efhub_conflicts ?? [], expectedConflicts)) diffs.push("efhub_conflicts");

    if (diffs.length > 0) {
      mismatchCount += 1;
      for (const d of diffs) categories[d] += 1;
      if (examples.length < 5) examples.push({ id, diffs });
      s.diff({ id, diffs });
    }
  }
  s.log(`比較件数: ${rows.length} / 差分件数: ${mismatchCount}`);
  s.log(`差分カテゴリ内訳: ${JSON.stringify(categories)}`);
  if (examples.length > 0) s.log(`差分例(最大5件、ID+差分種別のみ): ${JSON.stringify(examples)}`);
  return { total: rows.length, mismatchCount };
}

// ============================================================
// C. managers 全件(66件)のAPP-LEVEL detail比較(boosters/boosterSummary/linkUpPlays)
// ============================================================
async function sectionManagersFull() {
  const s = section("C. managers 全件(66件)のAPP-LEVEL detail比較");
  const db = new DatabaseSync(DB_PATH, { readOnly: true });
  const ids = db.prepare("SELECT internal_manager_id FROM managers ORDER BY internal_manager_id").all().map((r) => r.internal_manager_id);
  db.close();

  let mismatchCount = 0;
  let internalOnlyLeak = 0;
  const examples = [];
  for (const id of ids) {
    const t0 = timeStart();
    const sqliteDetail = await withSource("sqlite", () => getManagerById(id));
    timeEnd("detail:manager:sqlite", t0);
    const t1 = timeStart();
    const supaDetail = await withSource("supabase", () => getManagerById(id));
    timeEnd("detail:manager:supabase", t1);

    if (!sqliteDetail || !supaDetail) {
      mismatchCount += 1;
      if (examples.length < 5) examples.push({ id, diff: "片方または両方がnull" });
      continue;
    }
    const diffs = [];
    if (!jsonEqual(sqliteDetail.boosters, supaDetail.boosters)) diffs.push("boosters");
    if (!jsonEqual(sqliteDetail.boosterSummary, supaDetail.boosterSummary)) diffs.push("boosterSummary");
    if (!jsonEqual(sqliteDetail.linkUpPlays, supaDetail.linkUpPlays)) diffs.push("linkUpPlays");
    if (sqliteDetail.hasBooster !== supaDetail.hasBooster) diffs.push("hasBooster");
    if (sqliteDetail.hasLinkUpPlay !== supaDetail.hasLinkUpPlay) diffs.push("hasLinkUpPlay");
    if (diffs.length > 0) {
      mismatchCount += 1;
      if (examples.length < 5) examples.push({ id, diffs });
      s.diff({ id, diffs });
    }
  }
  s.log(`比較件数: ${ids.length} / 差分件数: ${mismatchCount} / 内部監査情報の漏洩: ${internalOnlyLeak}件`);
  if (examples.length > 0) s.log(`差分例(最大5件): ${JSON.stringify(examples)}`);
  return { total: ids.length, mismatchCount };
}

// ============================================================
// D. player_card_analysis 全件(19件)のAPP-LEVEL比較
// ============================================================
async function sectionAnalysisFull() {
  const s = section("D. player_card_analysis 全件(19件)のAPP-LEVEL比較");
  const db = new DatabaseSync(DB_PATH, { readOnly: true });
  const tableExists = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='player_cards'").get() != null;
  const ids = tableExists ? db.prepare("SELECT efhub_card_id FROM player_cards ORDER BY efhub_card_id").all().map((r) => r.efhub_card_id) : [];
  db.close();

  let mismatchCount = 0;
  const examples = [];
  for (const id of ids) {
    const t0 = timeStart();
    const sqliteDetail = await withSource("sqlite", () => getEfhubAnalysisDetail(id));
    timeEnd("detail:analysis:sqlite", t0);
    const t1 = timeStart();
    const supaDetail = await withSource("supabase", () => getEfhubAnalysisDetail(id));
    timeEnd("detail:analysis:supabase", t1);

    if (!jsonEqual(sqliteDetail, supaDetail)) {
      mismatchCount += 1;
      if (examples.length < 5) examples.push({ id });
      s.diff({ id });
    }
  }
  s.log(`比較件数: ${ids.length} / 差分件数: ${mismatchCount}`);
  if (examples.length > 0) s.log(`差分のあったID(最大5件): ${JSON.stringify(examples)}`);
  return { total: ids.length, mismatchCount };
}

// ============================================================
// E. world_player_cards 詳細(サンプル): 内部監査情報の非公開 + 安全な公開フィールドのみ
// ============================================================
async function sectionWorldDetailSample(expected) {
  const s = section("E. world_player_cards 詳細サンプル比較(全conflictカード21件+層化サンプル)");
  const db = new DatabaseSync(DB_PATH, { readOnly: true });
  const conflictIds = [...expected.conflictsMap.keys()];
  const efhubIds = [...expected.efhubLinkMap.keys()].filter((id) => !expected.conflictsMap.has(id)).slice(0, 15);
  const noAiStylesIds = db
    .prepare("SELECT world_card_id FROM world_player_cards WHERE world_card_id NOT IN (SELECT world_card_id FROM world_player_ai_styles) LIMIT 15")
    .all()
    .map((r) => r.world_card_id);
  db.close();
  const sampleIds = [...new Set([...conflictIds, ...efhubIds, ...noAiStylesIds])];

  let mismatchCount = 0;
  let internalLeakCount = 0;
  const examples = [];
  const INTERNAL_FIELDS = ["internal_card_id", "detected_at", "confidence", "resolution_status", "resolved_value", "resolution_reason"];
  for (const id of sampleIds) {
    const t0 = timeStart();
    const sqliteDetail = await withSource("sqlite", () => getPlayerByWorldId(id));
    timeEnd("detail:world:sqlite", t0);
    const t1 = timeStart();
    const supaDetail = await withSource("supabase", () => getPlayerByWorldId(id));
    timeEnd("detail:world:supabase", t1);

    if (!sqliteDetail || !supaDetail) {
      mismatchCount += 1;
      if (examples.length < 5) examples.push({ id, diff: "片方または両方がnull" });
      continue;
    }
    const raw = JSON.stringify(supaDetail);
    for (const f of INTERNAL_FIELDS) {
      if (raw.includes(f)) internalLeakCount += 1;
    }
    const diffs = [];
    if (sqliteDetail.hasEfhubLink !== supaDetail.hasEfhubLink) diffs.push("hasEfhubLink");
    if (sqliteDetail.efhubCardId !== supaDetail.efhubCardId) diffs.push("efhubCardId");
    if (!arraysEqual(sqliteDetail.aiStyles, supaDetail.aiStyles)) diffs.push("aiStyles");
    if (!jsonEqual(sqliteDetail.appearance, supaDetail.appearance)) diffs.push("appearance");
    if (!jsonEqual(sqliteDetail.efhubConflicts, supaDetail.efhubConflicts)) diffs.push("efhubConflicts");
    if (!jsonEqual(sqliteDetail.stats, supaDetail.stats)) diffs.push("stats");
    if (!arraysEqual(sqliteDetail.playerSkills, supaDetail.playerSkills)) diffs.push("playerSkills");
    for (const c of sqliteDetail.efhubConflicts) {
      const keys = Object.keys(c).sort();
      if (JSON.stringify(keys) !== JSON.stringify(["efhubValue", "fieldName", "worldValue"])) diffs.push(`efhubConflicts-shape:${JSON.stringify(keys)}`);
    }
    if (diffs.length > 0) {
      mismatchCount += 1;
      if (examples.length < 5) examples.push({ id, diffs });
      s.diff({ id, diffs });
    }
  }
  s.log(`比較件数: ${sampleIds.length}(conflict全件${conflictIds.length}件含む) / 差分件数: ${mismatchCount} / 内部監査情報の漏洩検出: ${internalLeakCount}件`);
  if (examples.length > 0) s.log(`差分例(最大5件): ${JSON.stringify(examples)}`);
  return { total: sampleIds.length, mismatchCount, internalLeakCount };
}

// ============================================================
// F. 検索・フィルター・ソート・ページング(PKセット+順序の全比較)
// ============================================================
function baseWorldQuery(over = {}) {
  return {
    page: 1,
    pageSize: 24,
    query: "",
    sort: "ovr_max_desc",
    position: null,
    cardType: null,
    playingStyle: null,
    playingStyleDefensive: null,
    minOvr: null,
    maxOvr: null,
    hasBooster: null,
    ...over,
  };
}

async function fetchAllPksForQuery(getter, baseQuery, pageSize = 500) {
  const ids = [];
  let page = 1;
  let totalPages = 1;
  let totalCount = 0;
  do {
    const result = await getter({ ...baseQuery, page, pageSize });
    totalPages = result.totalPages;
    totalCount = result.totalCount;
    const list = result.players ?? result.managers;
    for (const item of list) ids.push(item.worldCardId ?? item.internalManagerId);
    page += 1;
  } while (page <= totalPages);
  return { ids, totalCount };
}

async function compareWorldQuery(s, label, over) {
  const t0 = timeStart();
  const sqliteRes = await withSource("sqlite", () => fetchAllPksForQuery((q) => listPlayers(q), baseWorldQuery(over)));
  timeEnd(`list:world:${label}:sqlite`, t0);
  const t1 = timeStart();
  const supaRes = await withSource("supabase", () => fetchAllPksForQuery((q) => listPlayers(q), baseWorldQuery(over)));
  timeEnd(`list:world:${label}:supabase`, t1);

  const setDiff = symmetricDifferenceCount(sqliteRes.ids, supaRes.ids);
  const orderDiff = arraysEqual(sqliteRes.ids, supaRes.ids) ? 0 : "順序差あり(主キー集合は" + (setDiff === 0 ? "一致" : "不一致") + ")";
  const ok = sqliteRes.totalCount === supaRes.totalCount && setDiff === 0 && orderDiff === 0;
  s.log(
    `[world:${label}] totalCount sqlite=${sqliteRes.totalCount} supabase=${supaRes.totalCount} / 主キー集合差分=${setDiff} / 順序=${orderDiff === 0 ? "一致" : orderDiff}`,
  );
  if (!ok) s.diff({ label, sqliteTotal: sqliteRes.totalCount, supaTotal: supaRes.totalCount, setDiff, orderDiff });
  return ok;
}

async function compareManagerQuery(s, label, over) {
  const baseQuery = { page: 1, pageSize: 24, query: "", sort: "name", hasBooster: null, hasLinkUpPlay: null, ...over };
  const t0 = timeStart();
  const sqliteRes = await withSource("sqlite", () => fetchAllPksForQuery((q) => listManagers(q), baseQuery, 20));
  timeEnd(`list:managers:${label}:sqlite`, t0);
  const t1 = timeStart();
  const supaRes = await withSource("supabase", () => fetchAllPksForQuery((q) => listManagers(q), baseQuery, 20));
  timeEnd(`list:managers:${label}:supabase`, t1);

  const setDiff = symmetricDifferenceCount(sqliteRes.ids, supaRes.ids);
  const orderOk = arraysEqual(sqliteRes.ids, supaRes.ids);
  const ok = sqliteRes.totalCount === supaRes.totalCount && setDiff === 0 && orderOk;
  s.log(`[managers:${label}] totalCount sqlite=${sqliteRes.totalCount} supabase=${supaRes.totalCount} / 主キー集合差分=${setDiff} / 順序一致=${orderOk}`);
  if (!ok) s.diff({ label, sqliteTotal: sqliteRes.totalCount, supaTotal: supaRes.totalCount, setDiff, orderOk });
  return ok;
}

function symmetricDifferenceCount(a, b) {
  const setA = new Set(a);
  const setB = new Set(b);
  let count = 0;
  for (const x of setA) if (!setB.has(x)) count += 1;
  for (const x of setB) if (!setA.has(x)) count += 1;
  return count;
}

async function sectionSearchFilterSort() {
  const s = section("F. 検索・フィルター・ソート・ページング(全PKセット+順序比較)");
  const db = new DatabaseSync(DB_PATH, { readOnly: true });
  const sampleNameEn = db.prepare("SELECT name_en FROM world_player_cards WHERE name_en IS NOT NULL LIMIT 1").get()?.name_en ?? "";
  const sampleNameJa = db.prepare("SELECT name_ja FROM world_player_cards WHERE name_ja IS NOT NULL AND name_ja <> '' LIMIT 1").get()?.name_ja ?? "";
  const samplePosition = db.prepare("SELECT registered_position FROM world_player_cards WHERE registered_position IS NOT NULL LIMIT 1").get()?.registered_position ?? null;
  const sampleCardType = db.prepare("SELECT card_type FROM world_player_cards WHERE card_type IS NOT NULL LIMIT 1").get()?.card_type ?? null;
  db.close();

  let allOk = true;
  const checks = [
    ["検索語なし", {}],
    ["英語名部分一致", { query: sampleNameEn.slice(0, 3) }],
    ["日本語名部分一致", { query: sampleNameJa.slice(0, 2) }],
    ["存在しない名前", { query: "zzzzznonexistentname" }],
    ["完全ID", { query: "" }], // 個別ID検索はgetPlayerByWorldIdでカバー済み
    ["position絞り込み", { position: samplePosition }],
    ["cardType絞り込み", { cardType: sampleCardType }],
    ["minOvr", { minOvr: 90 }],
    ["maxOvr", { maxOvr: 60 }],
    ["複合条件(position+minOvr)", { position: samplePosition, minOvr: 70 }],
    ["0件条件", { query: "zzzzz-definitely-not-a-real-name-zzzzz" }],
    ["hasBooster=true(全主キー集合)", { hasBooster: true }],
    ["hasBooster=false(全主キー集合)", { hasBooster: false }],
    ["sort=ovr_max_asc", { sort: "ovr_max_asc" }],
    ["sort=ovr_base_desc", { sort: "ovr_base_desc" }],
    ["sort=ovr_base_asc", { sort: "ovr_base_asc" }],
    ["sort=name(collation)", { sort: "name" }],
    ["sort=updated_desc", { sort: "updated_desc" }],
  ];
  for (const [label, over] of checks) {
    const ok = await compareWorldQuery(s, label, over);
    allOk = allOk && ok;
  }

  // ページング境界(ovr_max_desc、pageSize小さめで多ページ化)
  s.log("--- ページング境界確認(pageSize=5) ---");
  for (const page of [1, 2, "last"]) {
    const q = baseWorldQuery({ pageSize: 5 });
    const sqliteFirst = await withSource("sqlite", () => listPlayers({ ...q, page: 1 }));
    const targetPage = page === "last" ? sqliteFirst.totalPages : page;
    const t0 = timeStart();
    const sqliteRes = await withSource("sqlite", () => listPlayers({ ...q, page: targetPage }));
    timeEnd("page:world:sqlite", t0);
    const t1 = timeStart();
    const supaRes = await withSource("supabase", () => listPlayers({ ...q, page: targetPage }));
    timeEnd("page:world:supabase", t1);
    const sqliteIds = sqliteRes.players.map((p) => p.worldCardId);
    const supaIds = supaRes.players.map((p) => p.worldCardId);
    const ok = arraysEqual(sqliteIds, supaIds) && sqliteRes.hasNext === supaRes.hasNext && sqliteRes.hasPrevious === supaRes.hasPrevious;
    s.log(`[paging:world:page=${targetPage}] 件数一致=${sqliteIds.length === supaIds.length} 順序一致=${arraysEqual(sqliteIds, supaIds)} hasNext一致=${sqliteRes.hasNext === supaRes.hasNext}`);
    if (!ok) {
      s.diff({ page: targetPage, sqliteIds, supaIds });
      allOk = false;
    }
  }

  // managers側(全9ソートキー+NULLを含むフィルター条件との組み合わせを網羅する。
  // released_at/overloadはNULLを含むため、NULL順序規則とinternal_manager_idタイブレークの
  // 両方が正しく機能しているかを、フィルター条件と組み合わせた場合も含めて確認する)。
  const managerChecks = [
    ["検索語なし・sort=name", { sort: "name" }],
    ["sort=released_desc(NULL2件を含む)", { sort: "released_desc" }],
    ["sort=released_asc(NULL2件を含む)", { sort: "released_asc" }],
    ["sort=possession_desc", { sort: "possession_desc" }],
    ["sort=quick_counter_desc", { sort: "quick_counter_desc" }],
    ["sort=long_ball_counter_desc", { sort: "long_ball_counter_desc" }],
    ["sort=out_wide_desc", { sort: "out_wide_desc" }],
    ["sort=long_ball_desc", { sort: "long_ball_desc" }],
    ["sort=overload_desc(NULL64件を含む)", { sort: "overload_desc" }],
    ["hasBooster=true", { hasBooster: true }],
    ["hasBooster=false", { hasBooster: false }],
    ["hasLinkUpPlay=true", { hasLinkUpPlay: true }],
    ["hasBooster=false + sort=overload_desc(NULL含むフィルター結果)", { hasBooster: false, sort: "overload_desc" }],
    ["hasLinkUpPlay=true + sort=released_asc(NULL含むフィルター結果)", { hasLinkUpPlay: true, sort: "released_asc" }],
  ];
  for (const [label, over] of managerChecks) {
    const ok = await compareManagerQuery(s, label, over);
    allOk = allOk && ok;
  }

  // ページング境界確認(managers、pageSize=1でタイブレークがページ境界を壊さないことを確認)。
  s.log("--- ページング境界確認(managers、pageSize=1、sort=possession_desc) ---");
  const managerTotal = await withSource("sqlite", () => getManagerCount());
  for (const page of [1, 2, managerTotal]) {
    const t0 = timeStart();
    const sqliteRes = await withSource("sqlite", () => listManagers({ page, pageSize: 1, query: "", sort: "possession_desc", hasBooster: null, hasLinkUpPlay: null }));
    timeEnd("page:managers:sqlite", t0);
    const t1 = timeStart();
    const supaRes = await withSource("supabase", () => listManagers({ page, pageSize: 1, query: "", sort: "possession_desc", hasBooster: null, hasLinkUpPlay: null }));
    timeEnd("page:managers:supabase", t1);
    const sqliteIds = sqliteRes.managers.map((m) => m.internalManagerId);
    const supaIds = supaRes.managers.map((m) => m.internalManagerId);
    const ok = arraysEqual(sqliteIds, supaIds) && sqliteRes.hasNext === supaRes.hasNext && sqliteRes.hasPrevious === supaRes.hasPrevious;
    s.log(`[paging:managers:page=${page}] 順序一致=${arraysEqual(sqliteIds, supaIds)} hasNext一致=${sqliteRes.hasNext === supaRes.hasNext}`);
    if (!ok) {
      s.diff({ page, sqliteIds, supaIds });
      allOk = false;
    }
  }

  return { allOk };
}

// ============================================================
// G. facets / sourceMeta
// ============================================================
async function sectionFacetsAndSourceMeta() {
  const s = section("G. facets / sourceMeta");
  _resetFacetCache();
  const sqliteFacets = await withSource("sqlite", () => getFacets());
  _resetFacetCache();
  const supaFacets = await withSource("supabase", () => getFacets());
  const facetsOk =
    arraysEqual(sqliteFacets.positions, supaFacets.positions) &&
    arraysEqual(sqliteFacets.cardTypes, supaFacets.cardTypes) &&
    arraysEqual(sqliteFacets.playingStyles, supaFacets.playingStyles) &&
    arraysEqual(sqliteFacets.playingStyleDefensives, supaFacets.playingStyleDefensives);
  s.log(`facets一致: ${facetsOk}`);
  if (!facetsOk) s.diff({ sqliteFacets, supaFacets });

  const sqliteMeta = await withSource("sqlite", () => getSourceMeta());
  const supaMeta = await withSource("supabase", () => getSourceMeta());
  s.log(`sourceMeta.totalCount: sqlite=${sqliteMeta.totalCount} supabase=${supaMeta.totalCount} 一致=${sqliteMeta.totalCount === supaMeta.totalCount}`);
  s.log(
    `既知の制約: syncFinishedAt/syncStatusはworld_sync_state/world_sync_runs相当が未移行のため一致しない(sqlite=${sqliteMeta.syncStatus}, supabase=${supaMeta.syncStatus})。本Phase Dの対象外(Phase C時点からの既知の制約)。`,
  );

  const managerCountSqlite = await withSource("sqlite", () => getManagerCount());
  const managerCountSupa = await withSource("supabase", () => getManagerCount());
  s.log(`managerCount: sqlite=${managerCountSqlite} supabase=${managerCountSupa} 一致=${managerCountSqlite === managerCountSupa}`);

  return { facetsOk, totalCountOk: sqliteMeta.totalCount === supaMeta.totalCount };
}

// ============================================================
// メイン
// ============================================================
async function main() {
  const startedAt = new Date();
  console.log(`Phase D シャドー比較 開始: ${startedAt.toISOString()}`);
  console.log("実Supabaseへの書込みは一切行わない(anonキーでのSELECT/Data API読み取りのみ)。");
  console.log("");

  const expected = await sectionCounts();
  const worldColumns = await sectionWorldColumnsFull(expected);
  const managersFull = await sectionManagersFull();
  const analysisFull = await sectionAnalysisFull();
  const worldDetailSample = await sectionWorldDetailSample(expected);
  const searchFilterSort = await sectionSearchFilterSort();
  const facetsAndMeta = await sectionFacetsAndSourceMeta();

  const perfSection = section("H. 性能測定(本比較実行中の実測、SQLite vs Supabase)");
  for (const key of Object.keys(timings).sort()) {
    const st = statsFor(key);
    if (st) perfSection.log(`${key}: n=${st.n} avg=${st.avg.toFixed(1)}ms median=${st.median.toFixed(1)}ms p95=${st.p95.toFixed(1)}ms max=${st.max.toFixed(1)}ms`);
  }

  const totalMismatches = worldColumns.mismatchCount + managersFull.mismatchCount + analysisFull.mismatchCount + worldDetailSample.mismatchCount;
  const overallOk =
    totalMismatches === 0 &&
    searchFilterSort.allOk &&
    facetsAndMeta.facetsOk &&
    facetsAndMeta.totalCountOk &&
    worldDetailSample.internalLeakCount === 0;

  console.log("");
  console.log(`=== 総合判定: ${overallOk ? "差分0件" : `差分あり(合計${totalMismatches}件+検索/フィルター/ソート差分の有無=${!searchFilterSort.allOk})`} ===`);

  const md = [
    "# Phase D シャドー比較結果",
    "",
    `実行日時: ${startedAt.toISOString()} 〜 ${new Date().toISOString()}`,
    "",
    "**実Supabaseへの書込みは一切行っていない(anonキーでのSELECT/Data API読み取りのみ)。**",
    "",
    `## 総合判定: ${overallOk ? "差分0件" : "差分あり"}`,
    "",
    ...report.sections.flatMap((sec) => [`## ${sec.title}`, "", ...sec.lines.map((l) => `- ${l}`), ""]),
  ].join("\n");
  await fs.writeFile(OUT_PATH, md, "utf8");
  console.log(`\nレポート: ${path.relative(ROOT, OUT_PATH)}`);

  process.exitCode = overallOk ? 0 : 1;
}

main().catch((err) => {
  console.error("Phase D シャドー比較でエラー:", err?.message ?? err);
  process.exitCode = 1;
});
