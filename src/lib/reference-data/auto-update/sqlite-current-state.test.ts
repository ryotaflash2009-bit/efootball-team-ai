import { describe, it, expect } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { buildManagerCurrentRowsFromSqlite, buildWorldCurrentRowsFromSqlite } from "./sqlite-current-state";
import { assumeUtcIfNaiveIso, normalizeWorldPlayerRecord, toWorldSourceRow } from "./source-world";
import { canonicalizeUpdateRow, computeUpdateRowChecksum } from "./update-contract";
import { buildInsertRow, mergeSourceIntoCurrent } from "./update-diff";

function fixtureDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    create table world_player_cards (world_card_id text, name_en text, name_ja text, card_type text, registered_position text, nationality text, region text, league text, team text,
      ovr_base integer, ovr_max integer, maximum_level integer, card_rating text, playing_style text, playing_style_def text, preferred_foot text, age integer, height integer, weight integer,
      image_url text, mobile_image_url text, boost1 integer, boost2 integer, likes_count integer, source text, source_url text, appearance_updated_at text, fetched_at text, world_sync_run_id integer);
    create table world_player_stats (world_card_id text, stat_key text, stat_kind text, value integer);
    create table world_player_skills (world_card_id text, skill_name text, display_order integer);
    create table source_record_links (internal_card_id integer, source text, source_card_id text);
    create table world_player_ai_styles (world_card_id text, style_name text, display_order integer);
    create table world_player_appearances (world_card_id text, position text, leg_coverage_radius real, arm_coverage_radius real, torso_collision real, jumping_height real, dribble_height real, leg_length real, ranks_json text, updated_at text);
    create table data_conflicts (world_card_id text, field_name text, efhub_value text, world_value text);
    create table managers (internal_manager_id integer, source text, source_manager_id text, name_en text, name_ja text, team_name text, nationality text, age integer, released_at text,
      possession_game integer, quick_counter integer, long_ball_counter integer, out_wide integer, long_ball integer, overload integer, manager_rating text, coaching_affinity text, formation text,
      has_booster integer, has_link_up_play integer, booster_confirmation text, photo_path text, source_url text, fetched_at text, manager_sync_run_id integer);
    create table manager_boosters (internal_manager_id integer, display_order integer, stat_name_en text, stat_key text, delta integer, raw_value text, application_condition text, confirmation_status text);
    create table manager_link_up_plays (id integer, internal_manager_id integer, display_order integer, name text, confirmation_status text);
    create table manager_link_up_conditions (link_up_play_id integer, role text, playing_style text, positions_json text);
  `);
  db.exec(`
    insert into world_player_cards values ('900000000000001','Synthetic Forward',null,'Epic','CF',null,null,null,'Example FC',98,103,42,'5',null,null,null,27,183,78,
      'https://d1zxa6glxh8sq9.cloudfront.net/player_900000000000001_1700000000.webp',null,12,7,10,'world','https://efootball-world.com/api/proxy/v1/api/players/search','2026-04-28T17:17:02.021292','2026-04-29T00:00:00.000Z',1);
    insert into world_player_stats values ('900000000000001','speed','base',88),('900000000000001','finishing','base',96);
    insert into world_player_skills values ('900000000000001','Heading',0),('900000000000001','First-time Shot',1);
    insert into source_record_links values (1,'world','900000000000001'),(1,'efhub','123');
    insert into world_player_ai_styles values ('900000000000001','Long Ranger',0);
    insert into managers values (1,'amine250','synthetic-manager-1','Synthetic Manager',null,null,null,null,'2026-01-15',88,75,60,-3,55,null,null,null,null,1,0,'confirmed','x.png','https://raw.githubusercontent.com/amine250/efootball-managers/main/data/managers.json','2026-04-29T00:00:00.000Z',1);
    insert into manager_boosters values (1,0,'Speed','speed',2,'+2',null,'confirmed');
  `);
  return db;
}

describe("assumeUtcIfNaiveIso", () => {
  it("タイムゾーン無しのISO(日付T時刻)だけをUTCとして扱い、他の形式は変えない", () => {
    expect(assumeUtcIfNaiveIso("2026-04-28T17:17:02.021292")).toBe("2026-04-28T17:17:02.021292Z");
    expect(assumeUtcIfNaiveIso("2026-04-28T17:17")).toBe("2026-04-28T17:17Z");
    expect(assumeUtcIfNaiveIso("2026-04-28T17:17:02Z")).toBe("2026-04-28T17:17:02Z");
    expect(assumeUtcIfNaiveIso("2026-04-28T17:17:02+09:00")).toBe("2026-04-28T17:17:02+09:00");
    expect(assumeUtcIfNaiveIso("2026-04-28 17:17:02")).toBe("2026-04-28 17:17:02");
    expect(assumeUtcIfNaiveIso("2026-04-28T17:17:02.1234567")).toBe("2026-04-28T17:17:02.1234567");
  });

  it("upstreamのタイムゾーン無し値は受理され、空白区切りは引き続きrejectされる", () => {
    const ok = toWorldSourceRow(normalizeWorldPlayerRecord({ id: "900000000000009", name: "X", appearance: { updatedAt: "2026-04-28T17:17:02.021292" } }), "2026-09-23T00:00:00Z");
    expect(ok.ok && ok.row.appearance_updated_at).toBe("2026-04-28T17:17:02.021Z");
    const bad = toWorldSourceRow(normalizeWorldPlayerRecord({ id: "900000000000009", name: "X", appearance: { updatedAt: "2026-04-28 17:17:02" } }), "2026-09-23T00:00:00Z");
    expect(bad.ok).toBe(false);
  });
});

describe("SQLiteからProduction形の現在行を再構成する(読み取り専用)", () => {
  it("World: 契約の正規化に合格し、boostは文字列・eFHUB/AI/appearanceを反映・SQLite専用列を含まない", () => {
    const [row] = buildWorldCurrentRowsFromSqlite(fixtureDb());
    expect(() => canonicalizeUpdateRow("world_player_cards", row)).not.toThrow();
    expect(row).toMatchObject({ boost1: "12", boost2: "7", efhub_card_id: "123", ai_styles: ["Long Ranger"], appearance: null, efhub_conflicts: [], name_sort_key: "synthetic forward", stats: { speed: 88, finishing: 96 }, skills: ["Heading", "First-time Shot"], import_batch_id: null });
    expect(row).not.toHaveProperty("likes_count");
    expect(row).not.toHaveProperty("world_sync_run_id");
  });

  it("World: 同じupstream値から作ったsource rowと比較すると変更なし(形の一致)", () => {
    const [current] = buildWorldCurrentRowsFromSqlite(fixtureDb());
    const res = toWorldSourceRow(
      normalizeWorldPlayerRecord({
        id: "900000000000001", name: "Synthetic Forward", type: "Epic", position: "CF", team: "Example FC", overallRating: 98, maxOverall: 103, maximumLevel: 42, rating: "5",
        age: 27, height: 183, weight: 78, imageUrl: "https://d1zxa6glxh8sq9.cloudfront.net/player_900000000000001_1700000000.webp", boost1: 12, boost2: 7,
        speed: 88, finishing: 96, skills: ["Heading", "First-time Shot"], aiStyles: ["Long Ranger"], appearance: { updatedAt: "2026-04-28T17:17:02.021292" },
      }),
      "2026-09-23T00:00:00Z",
    );
    if (!res.ok) throw new Error(res.rejection.reasons.join());
    // 既存syncのsourceラベル(world)とsource_urlも一致する。appearanceはsearch応答側に無いため保持列として現在値を使う。
    const merged = mergeSourceIntoCurrent("world_player_cards", current, res.row);
    expect(computeUpdateRowChecksum("world_player_cards", merged)).toBe(computeUpdateRowChecksum("world_player_cards", current));
    expect(buildInsertRow("world_player_cards", res.row).source).toBe("world");
  });

  it("managers: 契約の正規化に合格し、boolean・boosters・link-upを反映し、photo_path等を含まない", () => {
    const [m] = buildManagerCurrentRowsFromSqlite(fixtureDb());
    expect(() => canonicalizeUpdateRow("managers", m)).not.toThrow();
    expect(m).toMatchObject({ has_booster: true, has_link_up_play: false, boosters: [{ statKey: "speed", delta: 2 }], link_up_plays: [], name_sort_key: "synthetic manager" });
    expect(m).not.toHaveProperty("photo_path");
    expect(m).not.toHaveProperty("manager_sync_run_id");
  });
});
