/**
 * カード付属ブースター（数値 ID）→ ブースター名・レベルの対応表 → SQLite。
 *   node scripts/sync-booster-resolution.mjs
 *
 * - 外部アクセス 0。src/lib/progression/booster-resolution-data.ts（生データ・リーフ）と
 *   booster-catalog.ts（効果カタログ・リーフ）を読み込み、player_booster_source_mappings へ UPSERT。
 * - world_player_cards を **読み取り専用**で走査し、boost を持つカードの解決結果を
 *   player_card_resolved_boosters へ書き込む（派生データ・非破壊）。
 * - 既存の World / eFHUB / 監督 / 既存ブースター定義データには一切書き込まない。
 * - World boost1 と boost2 は別々の source（'world_boost1' / 'world_boost2'）で保存。
 */
import { openDb } from "./sqlite/db.mjs";
import {
  BOOSTER_RESOLUTION_VERSION,
  WORLD_BOOST1_MAP,
  WORLD_BOOST2_MAP,
  EFHUB_BOOST_MAP,
} from "../src/lib/progression/booster-resolution-data.ts";
import { BOOSTER_CATALOG } from "../src/lib/progression/booster-catalog.ts";

const nowIso = () => new Date().toISOString();
const DEF = new Map(BOOSTER_CATALOG.map((b) => [b.key, b]));

/**
 * 証拠レベル + 発動方式で解決。effect_status には evidenceLevel をそのまま格納。
 * activation_type は "fixed" | "power_of_many"（金色・Game Plan 依存）。
 * auto_apply（標準モードで通常の最終値へ自動適用するか）は
 *   activation === "fixed" かつ evidenceLevel ∈ {game_client_verified, screenshot_verified, external_cross_verified}。
 * power_of_many はどの証拠レベルでも auto_apply = 0（ユーザー段階指定のみ）。
 */
const STRICT_LEVELS = new Set(["game_client_verified", "screenshot_verified"]);
function resolve(entry) {
  const def = DEF.get(entry.key);
  if (!def) return null;
  const lv = Math.max(1, Math.min(def.maxLevel, entry.level));
  const evidenceLevel = def.evidenceLevel;
  const activation = entry.activation ?? (def.conditional ? "power_of_many" : "fixed");
  const isFixed = activation === "fixed";
  // v8: 発動方式の証拠。明示指定を優先。derived fixed → provisional、derived total-package → official_verified。
  const activationEvidence =
    entry.activationEvidence ??
    (entry.activation == null
      ? def.conditional
        ? "official_verified"
        : "provisional"
      : "external_cross_verified");
  const appliesStandard =
    isFixed && (STRICT_LEVELS.has(evidenceLevel) || evidenceLevel === "external_cross_verified");
  return { def, level: lv, effectStatus: evidenceLevel, activation, activationEvidence, autoApply: appliesStandard };
}

const db = await openDb();

// --- 古い DB へ v2 追加列を非破壊で補完 ---
const cols = new Set(db.prepare("PRAGMA table_info(player_booster_source_mappings)").all().map((r) => r.name));
for (const [name, ddl] of [
  ["resolved_name", "TEXT"],
  ["resolved_level", "INTEGER"],
  ["affected_stats_json", "TEXT"],
  ["per_level_delta", "INTEGER"],
  ["condition_note", "TEXT"],
  ["verified_card_count", "INTEGER NOT NULL DEFAULT 0"],
  ["conflicting_card_count", "INTEGER NOT NULL DEFAULT 0"],
  ["activation_type", "TEXT"], // v7: 'fixed' | 'power_of_many' | 'live_update' | 'unresolved'
  ["activation_evidence", "TEXT"], // v8: 'official_verified' | 'screenshot_verified' | 'external_cross_verified' | 'provisional' | 'unresolved' | 'conflicted'
]) {
  if (!cols.has(name)) {
    db.exec(`ALTER TABLE player_booster_source_mappings ADD COLUMN ${name} ${ddl}`);
    console.log(`[resolution] 列追加: ${name}`);
  }
}

const before = {
  world_player_cards: db.prepare("SELECT COUNT(*) n FROM world_player_cards").get().n,
  player_index_entries: db.prepare("SELECT COUNT(*) n FROM player_index_entries").get().n,
  player_cards: db.prepare("SELECT COUNT(*) n FROM player_cards").get().n,
  managers: db.prepare("SELECT COUNT(*) n FROM managers").get().n,
  player_booster_definitions: db.prepare("SELECT COUNT(*) n FROM player_booster_definitions").get().n,
};
console.log("[resolution] 既存データ（事前）:", JSON.stringify(before));

const run = db
  .prepare("INSERT INTO player_booster_resolution_runs (started_at, status, resolution_version) VALUES (?, 'running', ?)")
  .run(nowIso(), BOOSTER_RESOLUTION_VERSION);
const runId = Number(run.lastInsertRowid);
const at = nowIso();

// カードごとの ID 使用数（verified_card_count 用）
const b1cardCount = {}, b2cardCount = {};
for (const c of db.prepare("SELECT boost1, boost2 FROM world_player_cards WHERE boost1<>0 OR boost2<>0").all()) {
  if (c.boost1) b1cardCount[c.boost1] = (b1cardCount[c.boost1] || 0) + 1;
  if (c.boost2) b2cardCount[c.boost2] = (b2cardCount[c.boost2] || 0) + 1;
}

const upMap = db.prepare(`
  INSERT INTO player_booster_source_mappings
    (source, source_booster_id, internal_booster_key, level, name_status, effect_status, auto_apply,
     confidence_score, evidence_count, evidence, source_url, resolution_version, verified_at,
     resolved_name, resolved_level, affected_stats_json, per_level_delta, condition_note,
     verified_card_count, conflicting_card_count, activation_type, activation_evidence)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(source, source_booster_id) DO UPDATE SET
    internal_booster_key=excluded.internal_booster_key, level=excluded.level,
    name_status=excluded.name_status, effect_status=excluded.effect_status,
    auto_apply=excluded.auto_apply, confidence_score=excluded.confidence_score,
    evidence=excluded.evidence, source_url=excluded.source_url,
    resolution_version=excluded.resolution_version, verified_at=excluded.verified_at,
    resolved_name=excluded.resolved_name, resolved_level=excluded.resolved_level,
    affected_stats_json=excluded.affected_stats_json, per_level_delta=excluded.per_level_delta,
    condition_note=excluded.condition_note, verified_card_count=excluded.verified_card_count,
    conflicting_card_count=excluded.conflicting_card_count, activation_type=excluded.activation_type,
    activation_evidence=excluded.activation_evidence
`);
const upCard = db.prepare(`
  INSERT INTO player_card_resolved_boosters
    (world_card_id, slot, source_booster_id, internal_booster_key, resolved_name, level, applied,
     confirmation_status, resolution_reason, resolution_version, resolved_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(world_card_id, slot) DO UPDATE SET
    source_booster_id=excluded.source_booster_id, internal_booster_key=excluded.internal_booster_key,
    resolved_name=excluded.resolved_name, level=excluded.level, applied=excluded.applied,
    confirmation_status=excluded.confirmation_status, resolution_reason=excluded.resolution_reason,
    resolution_version=excluded.resolution_version, resolved_at=excluded.resolved_at
`);

const REASON = {
  game_client_verified: "名称・レベルは eFootball World（外部DB）の表示、対象能力・上昇量は KONAMI のゲームクライアント画面で直接確認。厳密/標準モードで通常の最終値へ適用。",
  screenshot_verified: "名称・レベルは eFootball World（外部DB）の表示、対象能力・上昇量は保存済みの外部ビルド画面のスクリーンショットで確認（KONAMI のゲームクライアント画面での確認ではない）。厳密/標準モードで通常の最終値へ適用。",
  external_cross_verified: "名称・レベルは eFootball World（外部DB）の表示、効果は World の ScoreBar 差分 と EFScout（外部DB）の定義が一致（別カード2枚以上・反例0）。標準モードで通常の最終値へ適用。KONAMI 公式実測ではない。",
  conditional_unverified: "名称・レベル・効果候補（全26能力 +level）は外部2ソースで整合。発動条件は KONAMI 公式「The Power of Many」で判明。条件を評価できないため、どのモードでも通常の最終値へは適用しない（ユーザー段階指定のみ）。",
  effect_provisional: "名称・レベルは外部ページ表示で確認。効果は公開データ1系統のみ／検証例不足のため通常の最終値へは適用しない（実験モードで試算のみ）。",
  unresolved: "対応表に無い数値ID。名称を解決できていません。能力値へは適用しない。",
  // v7: 発動方式が power_of_many（金色）の名称付きブースター（fixed 版が別に存在）。
  power_of_many: "この World ブースターID は金色・可変（KONAMI 公式「The Power of Many」）と確認済み（Ball Protection: Messi 89138556575063 のユーザー実測で段階変更により対象4能力が各 -1 / OVR 94→93）。Game Plan の同一リーグ登録人数を当アプリで自動確認できないため、標準最終値へは自動適用しない。ユーザーが段階（+0/+1/+2/+3）を指定したときだけ、その効果名の対象能力へだけ「条件反映後値」に試算として反映する。カード本来の付属情報は上書きしない。",
};
const agg = { mappingRows: 0, boosted: 0, s1: 0, s2: 0, s1tot: 0, s2tot: 0, auto: 0, named: 0, unresolved: 0 };

db.exec("BEGIN");
try {
  const tables = [
    ["world_boost1", WORLD_BOOST1_MAP, b1cardCount, "eFootball World（外部DB）/player/{id} の個別選手ページ表示（観測 2026-08-28）"],
    ["world_boost2", WORLD_BOOST2_MAP, b2cardCount, "eFootball World（外部DB）/player/{id}（デュアルカードの slot2 表示）"],
    ["efhub", EFHUB_BOOST_MAP, {}, "同一カードの World 側表示から確認（1 カードずつ）"],
  ];
  for (const [source, map, cardCount, ev] of tables) {
    for (const [idStr, entry] of Object.entries(map)) {
      const r = resolve(entry);
      if (!r) continue;
      const isPoM = r.activation === "power_of_many";
      const conf =
        source === "efhub" ? 0.6 : STRICT_LEVELS.has(r.effectStatus) ? 0.9 : r.autoApply ? 0.8 : 0.65;
      const conditionNote = isPoM
        ? REASON.power_of_many
        : r.def.conditional
          ? (r.def.conditionText ?? "発動条件付き（内容未確認）")
          : null;
      upMap.run(
        source, Number(idStr), entry.key, r.level, "confirmed", r.effectStatus, r.autoApply ? 1 : 0,
        conf, 1, ev, "https://efootball-world.com/player/", BOOSTER_RESOLUTION_VERSION, at,
        r.def.nameEn, r.level, JSON.stringify(r.def.affectedStats), r.level,
        conditionNote,
        source === "efhub" ? 1 : (cardCount[Number(idStr)] || 0), 0,
        r.activation, r.activationEvidence,
      );
      agg.mappingRows++;
    }
  }

  const cards = db
    .prepare("SELECT world_card_id, boost1, boost2 FROM world_player_cards WHERE boost1<>0 OR boost2<>0")
    .all();
  for (const c of cards) {
    agg.boosted++;
    let cardAuto = false, cardNamed = false, cardUnres = false;
    for (const [slot, id] of [[1, c.boost1], [2, c.boost2]]) {
      if (!id) continue;
      if (slot === 1) agg.s1tot++; else agg.s2tot++;
      const map = slot === 2 ? WORLD_BOOST2_MAP : WORLD_BOOST1_MAP;
      const hit = map[id];
      const r = hit ? resolve(hit) : null;
      const isPoM = r && r.activation === "power_of_many";
      // total-package は既存ラベル conditional_unverified を維持。名称付き PoM（ball-protection ID 44 等）は power_of_many。
      const status = r
        ? isPoM && r.effectStatus !== "conditional_unverified"
          ? "power_of_many"
          : r.effectStatus
        : "unresolved";
      if (r && slot === 1) agg.s1++;
      if (r && slot === 2) agg.s2++;
      if (r && r.autoApply) cardAuto = true;
      else if (!r) cardUnres = true;
      else cardNamed = true;
      upCard.run(
        c.world_card_id, slot, id, r ? hit.key : null, r ? r.def.nameEn : null, r ? r.level : null,
        r && r.autoApply ? 1 : 0, status, REASON[status] ?? status, BOOSTER_RESOLUTION_VERSION, at,
      );
    }
    if (cardAuto) agg.auto++;
    else if (cardNamed) agg.named++;
    else if (cardUnres) agg.unresolved++;
  }
  db.exec("COMMIT");
} catch (err) {
  db.exec("ROLLBACK");
  db.prepare("UPDATE player_booster_resolution_runs SET status='failed', finished_at=? WHERE id=?").run(nowIso(), runId);
  console.error("[resolution] 失敗:", err.message, err.stack);
  db.close();
  process.exit(1);
}

db.prepare(`
  UPDATE player_booster_resolution_runs SET status='done', finished_at=?, mapping_row_count=?,
    boosted_card_count=?, slot1_resolved=?, slot2_resolved=?, auto_applied_cards=?, provisional_cards=?,
    unresolved_cards=?, conflict_count=0,
    notes='v8: 発動方式の証拠 activation_evidence を分離。total-package(boost1=83)=power_of_many/official_verified、ball-protection(boost2=44)=power_of_many/screenshot_verified（+3カード3リーグの傍証）。それ以外の解決済み fixed（boost1 70 ID / boost2 13 ID）は activation=fixed だが activation_evidence=provisional（＝推定。青/金の判別材料が未確認・ScoreBar 差分だけでは固定 +N と Power of Many 最大 +N を区別不可）。計算挙動は不変（fixed は evidenceLevel に応じ自動適用 / power_of_many は全モード未適用）。証拠のある World ID のみ変更。1,931 カードの標準自動適用は一括停止しない。Live Update 方式に確定できた World ID は 0 件。'
  WHERE id=?
`).run(nowIso(), agg.mappingRows, agg.boosted, agg.s1, agg.s2, agg.auto, agg.named, agg.unresolved, runId);

const after = {
  world_player_cards: db.prepare("SELECT COUNT(*) n FROM world_player_cards").get().n,
  player_index_entries: db.prepare("SELECT COUNT(*) n FROM player_index_entries").get().n,
  player_cards: db.prepare("SELECT COUNT(*) n FROM player_cards").get().n,
  managers: db.prepare("SELECT COUNT(*) n FROM managers").get().n,
  player_booster_definitions: db.prepare("SELECT COUNT(*) n FROM player_booster_definitions").get().n,
};
for (const k of Object.keys(before)) {
  if (before[k] !== after[k]) {
    console.error(`[resolution] 既存データ件数が変化: ${k} ${before[k]} → ${after[k]} — 中断`);
    db.close();
    process.exit(1);
  }
}

console.log(`[resolution] version=${BOOSTER_RESOLUTION_VERSION}  対応表=${agg.mappingRows} 件`);
console.log(
  `[resolution] boosted=${agg.boosted}  slot1 ${agg.s1}/${agg.s1tot} (${(100 * agg.s1 / agg.s1tot).toFixed(1)}%)  slot2 ${agg.s2}/${agg.s2tot} (${(100 * agg.s2 / agg.s2tot).toFixed(1)}%)`,
);
console.log(`[resolution] 標準モードで自動適用カード=${agg.auto}  名称のみ=${agg.named}  未解決=${agg.unresolved}`);
console.log("[resolution] 整合性 OK（既存データ不変・非破壊）");
db.close();
