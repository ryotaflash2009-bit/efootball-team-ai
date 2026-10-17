import { describe, it, expect } from "vitest";
import fixture from "./__fixtures__/pesmaster-calibration.json";
import {
  extractPesMasterPlayer,
  parseFeaturedIds,
  mapPesMasterPlayer,
  nextProvisionalCards,
  idsToFetch,
  nameSortKey,
  personKey,
  learnAliases,
  SEED_ALIASES,
  PROVISIONAL_SOURCE,
} from "../../../../scripts/lib/pesmaster-provisional.mjs";
import { personKeyOf } from "@/lib/world/person-identity";
import { validProvisionalRows, PROVISIONAL_SCHEMA, getProvisionalRow, listProvisionalRows } from "./provisional-cards";
import { computeNameSortKey } from "../name-sort-key";

type Fx = { pm: Record<string, unknown>; world: Record<string, unknown> & { stats: Record<string, number> } };
const FX = fixture as Fx[];
const NOW = "2026-10-15T06:00:00.000Z";

describe("PES Master → 暫定のカード（2026-10-15・両方にあるカードで確かめた対応）", () => {
  it("World と同じ値になる: カードの種類・ポジション・利き足・プレースタイル（攻撃・守備）・チーム・国籍・能力値 26", () => {
    for (const { pm, world } of FX) {
      const r = mapPesMasterPlayer(pm, { fetchedAt: NOW });
      expect(r.ok, String(pm.name)).toBe(true);
      if (!r.ok) continue;
      expect(r.row).toMatchObject({
        card_type: world.cardType,
        registered_position: world.registeredPosition,
        preferred_foot: world.preferredFoot,
        playing_style: world.playingStyle,
        playing_style_def: world.playingStyleDefensive,
        team: world.team,
        nationality: world.nationality,
        source: PROVISIONAL_SOURCE,
      });
      expect(r.row?.stats).toEqual(world.stats);
    }
  });

  it("最大レベル 0（不明）は null（推測しない）・最大 OVR は持たない・画像・ブースター・日本語名は null", () => {
    const r = mapPesMasterPlayer({ ...FX[0].pm, max_level: 0 }, { fetchedAt: NOW });
    expect(r.ok && r.row).toMatchObject({ maximum_level: null, ovr_max: null, image_url: null, boost1: null, name_ja: null, max_level_source: null });
    const r2 = mapPesMasterPlayer({ ...FX[0].pm, max_level: 34 }, { fetchedAt: NOW });
    expect(r2.ok && r2.row).toMatchObject({ maximum_level: 34, max_level_source: "pesmaster_user_submitted" });
  });

  it("必須の値が欠ける・知らない種類は入れない（理由を返す）", () => {
    expect(mapPesMasterPlayer({ ...FX[0].pm, card_type: 99 }, { fetchedAt: NOW })).toMatchObject({ ok: false, reason: "unknown_card_type:99/1" });
    expect(mapPesMasterPlayer({ ...FX[0].pm, position: 40 }, { fetchedAt: NOW })).toMatchObject({ ok: false, reason: "unknown_position:40" });
    expect(mapPesMasterPlayer({ ...FX[0].pm, finishing: "x" }, { fetchedAt: NOW })).toMatchObject({ ok: false, reason: "bad_stat:finishing" });
    expect(mapPesMasterPlayer({ ...FX[0].pm, name: " " }, { fetchedAt: NOW })).toMatchObject({ ok: false, reason: "no_name" });
    expect(mapPesMasterPlayer({ ...FX[0].pm, fake: 1 }, { fetchedAt: NOW })).toMatchObject({ ok: false, reason: "fake" });
    expect(mapPesMasterPlayer(null, { fetchedAt: NOW })).toMatchObject({ ok: false });
  });

  it("並べ替えのキーはアプリの computeNameSortKey と同じ", () => {
    for (const n of ["Lionel Messi", "Zlatan Ibrahimović", "ÁLVARO", "endo"]) expect(nameSortKey(n)).toBe(computeNameSortKey(n));
  });

  it("ページから選手（文字列の中の括弧に惑わされない）と注目カードの ID を取り出す", () => {
    const html = `<script>const x = 1; const player = {"id":123456789012345,"name":"A {b}","nested":{"k":"}"}}; const y = 2;</script>`;
    expect(extractPesMasterPlayer(html)).toEqual({ id: 123456789012345, name: "A {b}", nested: { k: "}" } });
    expect(extractPesMasterPlayer("<html></html>")).toBeNull();
    expect(parseFeaturedIds(`<a href="/a/efootball-2022/player/105864501411930/">x</a><a href="/b/efootball-2022/player/105864501411930/">y</a><a href="/c/efootball-2022/player/12/">z</a>`)).toEqual(["105864501411930"]);
  });

  it("次の一覧: World に載ったものは外す・新しいものは入れる・最初に見つけた日時は保つ・ID の順", () => {
    const row = (id: string, extra: Record<string, unknown> = {}) => ({ world_card_id: id, name_en: id, fetched_at: NOW, ...extra });
    const next = nextProvisionalCards({
      previous: [row("200", { first_seen_at: "2026-10-10T00:00:00Z" }), row("300", { first_seen_at: "2026-10-11T00:00:00Z" })],
      fetched: [row("200", { name_en: "updated" }), row("100")],
      worldIds: new Set(["300"]),
      now: NOW,
    });
    expect(next.map((r: { world_card_id: string }) => r.world_card_id)).toEqual(["100", "200"]);
    expect(next[1]).toMatchObject({ name_en: "updated", first_seen_at: "2026-10-10T00:00:00Z" });
    expect(next[0]).toMatchObject({ first_seen_at: NOW });
  });

  it("取り直し: 新しい ID・最大レベルが不明で 24 時間たったものだけ（World にあるものは読まない）", () => {
    const prev = [
      { world_card_id: "1", maximum_level: null, fetched_at: "2026-10-14T00:00:00Z" },
      { world_card_id: "2", maximum_level: null, fetched_at: "2026-10-15T05:00:00Z" },
      { world_card_id: "3", maximum_level: 30, fetched_at: "2026-10-01T00:00:00Z" },
    ];
    expect(idsToFetch({ featuredIds: ["4", "2", "5"], previous: prev, worldIds: new Set(["5"]), now: NOW })).toEqual(["4", "1"]);
  });
});

describe("精度の改善（2026-10-16・正式なデータに置き換わった 57 枚との比較から）", () => {
  it("人物のキーはアプリの personKeyOf と同じ（下位 20 ビット）", () => {
    for (const id of ["89138556575063", "105864501411930", "88045755828950"]) expect(personKey(id)).toBe(personKeyOf(id));
    expect(personKey("x")).toBeNull();
  });

  it("同じ人物の別のカードから引いた日本語名・国籍を使う（無ければ PES Master の値）", () => {
    const r = mapPesMasterPlayer(FX[0].pm, { fetchedAt: NOW, nameJa: "リオネル メッシ", nationality: "Argentina" });
    expect(r.ok && r.row).toMatchObject({ name_ja: "リオネル メッシ", nationality: "Argentina", pm_nat_name: "Argentina" });
    const r2 = mapPesMasterPlayer(FX[0].pm, { fetchedAt: NOW });
    expect(r2.ok && r2.row).toMatchObject({ name_ja: null, nationality: FX[0].pm.nat_name });
  });

  it("表記の対応: 確認済みの初期値（Turkey→Türkiye・Czech Republic→Czechia）＋正式なデータに置き換わったカードから学ぶ", () => {
    expect(SEED_ALIASES.nationality).toMatchObject({ Turkey: "Türkiye", "Czech Republic": "Czechia" });
    const next = learnAliases({
      aliases: { nationality: { Korea: "Korea Republic" }, league: {} },
      graduated: [
        { row: { pm_nat_name: "Ivory Coast", pm_league_name: "Lega Italia" }, official: { nationality: "Côte d'Ivoire", league: "Italian League" } },
        { row: { pm_nat_name: "Argentina", pm_league_name: "Premier League" }, official: { nationality: "Argentina", league: "Premier League" } },
        { row: { pm_nat_name: null }, official: { nationality: "Brazil" } },
      ],
    });
    expect(next.nationality).toMatchObject({ Turkey: "Türkiye", Korea: "Korea Republic", "Ivory Coast": "Côte d'Ivoire" });
    expect(next.nationality).not.toHaveProperty("Argentina");
    expect(next.league).toEqual({ "Lega Italia": "Italian League" });
  });
});

describe("アプリが読む暫定のカードの JSON", () => {
  const good = { world_card_id: "105864501411930", name_en: "X", source: "pesmaster.com", stats: Object.fromEntries(Array.from({ length: 26 }, (_, i) => [`k${i}`, 70])) };
  it("形の正しい行だけを使う（版・ID・名前・取得元・能力値 26・重複）", () => {
    expect(validProvisionalRows({ schema: "other", cards: [good] })).toEqual([]);
    const rows = validProvisionalRows({
      schema: PROVISIONAL_SCHEMA,
      cards: [good, { ...good }, { ...good, world_card_id: "bad" }, { ...good, world_card_id: "105864501411931", name_en: " " }, { ...good, world_card_id: "105864501411932", source: "efootball-world.com" }, { ...good, world_card_id: "105864501411933", stats: { a: 1 } }],
    });
    expect(rows.map((r) => r.world_card_id)).toEqual(["105864501411930"]);
  });

  it("同梱の JSON はすべて検証を通り、ID で引ける", () => {
    const rows = listProvisionalRows();
    for (const r of rows) expect(getProvisionalRow(String(r.world_card_id))).toBe(r);
  });
});
