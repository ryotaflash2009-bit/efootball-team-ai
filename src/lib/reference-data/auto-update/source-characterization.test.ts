import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  normalizeWorldPlayer,
  STAT_KEY_MAP,
  WORLD_STAT_KEYS as SCRIPT_WORLD_STAT_KEYS,
  WORLD_SEARCH_URL as SCRIPT_WORLD_SEARCH_URL,
  WORLD_PAGE_SIZE as SCRIPT_WORLD_PAGE_SIZE,
  WORLD_TIMEOUT_MS as SCRIPT_WORLD_TIMEOUT_MS,
  looksSensitive,
} from "../../../../scripts/sqlite/world.mjs";
import { transformWorldPlayerCard, type WorldPlayerCardSqliteRow } from "../migration-transform";
import { buildAiStylesMap, buildAppearanceMap, buildManagerBoostersMap, buildManagerLinkUpPlaysMap } from "../detail-extension-transform";
import {
  WORLD_PAGE_SIZE,
  WORLD_SEARCH_URL,
  WORLD_SOURCE_LABEL,
  WORLD_STAT_KEYS,
  buildWorldSearchBody,
  normalizeWorldPlayerRecord,
  toWorldSourceRow,
} from "./source-world";
import { MANAGERS_URL, MANAGER_SOURCE_LABEL, managerStatNameToKey, toManagerSourceRow, type ManagerSourceRow } from "./source-managers";
import { SOURCE_ENDPOINTS, detectSensitiveSignals } from "./source-transport";
import { normalizeTimestamp } from "./update-contract";

/**
 * Characterization: Phase Bのsource層が既存の取得スクリプト・移行transformと同じ結果を返すことを固定する。
 * 既存スクリプトは変更しない。sync-*.mjsは import時にmain()を実行する(DBへ書き込む)ため import せず、
 * 共有module(scripts/sqlite/world.mjs)の純関数と、スクリプト本文の定数だけを照合する。
 */

const FIXTURE_DIR = path.join(__dirname, "__fixtures__", "source");
const REPO_ROOT = path.resolve(__dirname, "..", "..", "..", "..");
const worldFixture = JSON.parse(readFileSync(path.join(FIXTURE_DIR, "world-players-synthetic.json"), "utf8")) as { players: unknown[] };
const managersFixture = JSON.parse(readFileSync(path.join(FIXTURE_DIR, "managers-synthetic.json"), "utf8")) as unknown[];
const FETCHED_AT = "2026-09-23T00:00:00.000Z";

describe("characterization: World normalizer = scripts/sqlite/world.mjs normalizeWorldPlayer", () => {
  it("fixtureの全件(境界値を含む)で既存normalizerと完全に同じ出力", () => {
    expect(worldFixture.players.length).toBeGreaterThanOrEqual(7);
    for (const p of worldFixture.players) expect(normalizeWorldPlayerRecord(p)).toEqual(normalizeWorldPlayer(p));
  });

  it("入力がobjectでない・空でも既存normalizerと同じ(例外にしない)", () => {
    for (const p of [{}, { id: 0 }, { id: "", name: 1 }, { appearance: "x" }, { appearance: {} }]) {
      expect(normalizeWorldPlayerRecord(p)).toEqual(normalizeWorldPlayer(p));
    }
  });

  it("定数(URL・page size・timeout・26能力値キー)が既存スクリプトと一致", () => {
    expect(WORLD_SEARCH_URL).toBe(SCRIPT_WORLD_SEARCH_URL);
    expect(SOURCE_ENDPOINTS["efootball-world"].url).toBe(SCRIPT_WORLD_SEARCH_URL);
    expect(WORLD_PAGE_SIZE).toBe(SCRIPT_WORLD_PAGE_SIZE);
    expect(SOURCE_ENDPOINTS["efootball-world"].timeoutMs).toBe(SCRIPT_WORLD_TIMEOUT_MS);
    expect([...WORLD_STAT_KEYS]).toEqual(SCRIPT_WORLD_STAT_KEYS);
  });

  it("request bodyが既存スクリプトと同じbyte列(key順を含む)", () => {
    expect(buildWorldSearchBody(3, "CREATED_AT")).toBe(JSON.stringify({ page: 3, size: SCRIPT_WORLD_PAGE_SIZE, sortBy: "CREATED_AT", sortOrder: "DESC" }));
    expect(buildWorldSearchBody(1, "UPDATED_AT")).toBe(JSON.stringify({ page: 1, size: SCRIPT_WORLD_PAGE_SIZE, sortBy: "UPDATED_AT", sortOrder: "DESC" }));
  });

  it("本文の機微情報判定が既存looksSensitiveと同じ", () => {
    for (const t of ['{"access_token": 1}', '{"password":"x"}', '{"email": "a"}', "Set-Cookie", '{"ok":1}', '{"api_key" :1}']) {
      expect(detectSensitiveSignals(t)).toEqual(looksSensitive(t));
    }
  });

  it("既存sourceラベル(world)・既存sync本文の定数と一致", () => {
    const initial = readFileSync(path.join(REPO_ROOT, "scripts", "sync-world-players-initial.mjs"), "utf8");
    const incremental = readFileSync(path.join(REPO_ROOT, "scripts", "sync-world-players-incremental.mjs"), "utf8");
    expect(initial).toContain(`"${WORLD_SOURCE_LABEL}", WORLD_SEARCH_URL`);
    expect(incremental).toContain(`"${WORLD_SOURCE_LABEL}", WORLD_SEARCH_URL`);
    expect(incremental).toContain(": 15;"); // --max-pages既定値
  });
});

/** 既存sync(SQLite書込み)→既存移行transform(PG行)の結果を、source rowと比較するための再現。 */
function scriptPipelinePgRow(raw: unknown) {
  const c = normalizeWorldPlayer(raw);
  const id = c.world_card_id as string;
  const sqliteRow = {
    world_card_id: c.world_card_id,
    name_en: c.name_en,
    name_ja: c.name_ja,
    card_type: c.card_type,
    registered_position: c.registered_position,
    nationality: c.nationality,
    region: c.region,
    league: c.league,
    team: c.team,
    ovr_base: c.ovr_base,
    ovr_max: c.ovr_max,
    maximum_level: c.maximum_level,
    card_rating: c.card_rating,
    playing_style: c.playing_style,
    playing_style_def: c.playing_style_def,
    preferred_foot: c.preferred_foot,
    age: c.age,
    height: c.height,
    weight: c.weight,
    image_url: c.image_url,
    mobile_image_url: c.mobile_image_url,
    boost1: c.boost1,
    boost2: c.boost2,
    source: "world",
    source_url: SCRIPT_WORLD_SEARCH_URL,
    appearance_updated_at: c.appearance_updated_at,
    fetched_at: FETCHED_AT,
  } as unknown as WorldPlayerCardSqliteRow;
  const stats = SCRIPT_WORLD_STAT_KEYS.filter((k: string) => typeof c.stats[k] === "number").map((k: string) => ({ world_card_id: id, stat_key: k, value: c.stats[k] as number }));
  const skills = c.skills.map((s: string, i: number) => ({ world_card_id: id, skill_name: s, display_order: i }));
  const pg = transformWorldPlayerCard(sqliteRow, stats, skills, "v", "00000000-0000-4000-8000-000000000000");
  const ai = buildAiStylesMap(c.aiStyles.map((s: string, i: number) => ({ world_card_id: id, style_name: s, display_order: i })));
  const app = c.appearance ? buildAppearanceMap([{ world_card_id: id, ...c.appearance }]) : new Map();
  return { pg, aiStyles: ai.get(id) ?? [], appearance: app.get(id) ?? null };
}

describe("characterization: World source row = 既存sync→移行transform→detail extensionのPG行", () => {
  it("受理される全fixture行で、upstream由来列がすべて一致する", () => {
    let compared = 0;
    for (const raw of worldFixture.players) {
      const result = toWorldSourceRow(normalizeWorldPlayerRecord(raw), FETCHED_AT);
      if (!result.ok) continue;
      compared++;
      const { pg, aiStyles, appearance } = scriptPipelinePgRow(raw);
      const row = result.row;
      for (const col of [
        "world_card_id", "name_en", "name_ja", "card_type", "registered_position", "nationality", "region", "league", "team",
        "ovr_base", "ovr_max", "maximum_level", "card_rating", "playing_style", "playing_style_def", "preferred_foot", "age",
        "height", "weight", "image_url", "mobile_image_url", "stats", "skills", "source", "source_url",
      ] as const) {
        expect(row[col], `${pg.world_card_id}.${col}`).toEqual(pg[col]);
      }
      // PGのboost列はtext。数値は既存移行と同じくpgが十進表記の文字列として格納する。
      expect(row.boost1).toEqual(pg.boost1 == null ? null : String(pg.boost1));
      expect(row.boost2).toEqual(pg.boost2 == null ? null : String(pg.boost2));
      expect(row.appearance_updated_at).toEqual(pg.appearance_updated_at == null ? null : normalizeTimestamp(pg.appearance_updated_at));
      expect(row.ai_styles).toEqual(aiStyles);
      expect(row.appearance).toEqual(appearance);
    }
    expect(compared).toBe(3);
  });
});

describe("characterization: managers.json normalizer = scripts/sync-managers.mjs", () => {
  const script = readFileSync(path.join(REPO_ROOT, "scripts", "sync-managers.mjs"), "utf8");

  it("source・URL・id形式・alias・Link-up既定名がスクリプト本文と一致", () => {
    expect(script).toContain(`const SOURCE = "${MANAGER_SOURCE_LABEL}";`);
    expect(script).toContain(`"${MANAGERS_URL}"`);
    expect(SOURCE_ENDPOINTS["managers-json"].url).toBe(MANAGERS_URL);
    expect(script).toContain("/^[A-Za-z0-9_-]{1,64}$/");
    expect(script).toContain("`Link-Up ${i + 1}`");
    for (const alias of ['"attacking awareness": "offensiveAwareness"', '"ball winning": "tackling"', '"aerial reach": "gkReach"', '"gk high reach": "gkReach"']) {
      expect(script).toContain(alias);
    }
    expect(script).not.toMatch(/retry|再試行する/i);
    expect(SOURCE_ENDPOINTS["managers-json"].maxAttempts).toBe(1);
  });

  it("能力名→Worldキーの対応がSTAT_KEY_MAP(name_en)と一致", () => {
    for (const [worldKey, , nameEn] of STAT_KEY_MAP as [string, string, string][]) {
      expect(managerStatNameToKey(nameEn)).toBe(worldKey);
      expect(managerStatNameToKey(`  ${nameEn.toUpperCase()} `)).toBe(worldKey);
    }
  });

  it("boosters・link_up_playsがdetail extension(buildManager*Map)と同じ形", () => {
    const result = toManagerSourceRow(managersFixture[0], FETCHED_AT);
    if (!result.ok) throw new Error("fixture[0]は受理されるはず");
    const row: ManagerSourceRow = result.row;
    // 既存syncがSQLiteへ書く行(manager_boosters/manager_link_up_*)を再現し、既存extension transformへ通す。
    const boosterRows = [
      { internal_manager_id: 1, display_order: 0, stat_name_en: "Speed", stat_key: "speed", delta: 2, raw_value: "+2", application_condition: null, confirmation_status: "confirmed" },
      { internal_manager_id: 1, display_order: 1, stat_name_en: "Attacking Awareness", stat_key: "offensiveAwareness", delta: 1, raw_value: "+1 (when leading)", application_condition: null, confirmation_status: "confirmed" },
      { internal_manager_id: 1, display_order: 2, stat_name_en: "Unknown Future Stat", stat_key: null, delta: 0, raw_value: "plus two", application_condition: null, confirmation_status: "confirmed" },
    ];
    expect(row.boosters).toEqual(buildManagerBoostersMap(boosterRows).get(1));
    const plays = [
      { id: 10, internal_manager_id: 1, display_order: 0, name: "Synthetic Link", confirmation_status: "provisional" },
      { id: 11, internal_manager_id: 1, display_order: 1, name: "Link-Up 2", confirmation_status: "provisional" },
    ];
    const conds = [
      { link_up_play_id: 10, role: "centerPiece", playing_style: "Hole Player", positions_json: JSON.stringify(["AMF", "SS"]) },
      { link_up_play_id: 10, role: "keyMan", playing_style: "Goal Poacher", positions_json: JSON.stringify(["CF", "9"]) },
      { link_up_play_id: 11, role: "centerPiece", playing_style: null, positions_json: JSON.stringify([]) },
    ];
    expect(row.link_up_plays).toEqual(buildManagerLinkUpPlaysMap(plays, conds).get(1));
  });
});
