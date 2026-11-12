import { describe, it, expect } from "vitest";
import {
  buildSourceRatingsIndex,
  compareStats,
  countSameNameOvrCards,
  extraStatEntries,
  isCardLevelMatch,
  isLocalRequest,
  isSourceRatingsEnabled,
  matchCard,
  nameKey,
  parseOverall,
  parseRank,
  positionsCompatible,
  recordBadgeRating,
  recordOveralls,
  resolveRecordCards,
  sourceRatingsFileSchema,
  unknownRecordEntries,
  type ResolverCard,
  type SourceCardRef,
} from "./source-ratings";
import { STAT_LABEL_JA } from "@/lib/world/stat-labels";

// 2026-11-02 のクローラーの実データ（形のまま・一部の項目だけ）
const game8Mbappe = {
  source: "A",
  card_id: null,
  player_name: "キリアンエムバペ",
  position: "CF",
  sub_positions: [],
  rating_or_tier: "1位 / 総合値: 107",
  team_and_nationality: "マドリーチャマルティンB / フランス",
  play_style: "攻撃: ラインブレイカー / 守備: アウトレットプレイヤー",
  skills: ["シザーズ", "ダブルタッチ"],
  stats_and_boosters: { 最大総合値: "107", オフェンスセンス: "81", スピード: "81", ブースター1: "アジリティ", 利き足: "右足" },
  source_table_type: "最強選手TOP5枠",
  fetched_at: "2026-11-02T14:51:24",
};
const pesdbMbappe = {
  source: "C",
  card_id: "52904601956478",
  player_name: "Kylian Mbappé",
  position: "CF",
  sub_positions: ["LMF", "RMF"],
  rating_or_tier: "総合値: 97",
  team_and_nationality: "Madrid Chamartin B / France",
  play_style: "攻撃: Goal Poacher / 守備: Basic",
  skills: ["Double Touch", "Sole Control"],
  stats_and_boosters: { 最大総合値: "98", オフェンスセンス: "89", スピード: "90", COMスキル: "Trickster" },
  source_table_type: "新着選手一覧",
  fetched_at: "2026-11-02T14:51:24",
  features: "クローラー側で増えた項目",
};
const labLewandowski = {
  source: "B",
  card_id: "123236838841410",
  player_name: "ロベルト レヴァンドフスキ",
  position: "CF",
  rating_or_tier: "総合値: 102",
  stats_and_boosters: {},
};

const file = sourceRatingsFileSchema.parse({
  schema_version: 1,
  generated_at: "2026-11-02T15:29:14",
  sources: { A: { fetched_at: "2026-11-02T14:51:24", count: 1 }, B: { fetched_at: "2026-11-02T14:51:24", count: 1 }, C: { fetched_at: "2026-11-02T14:51:24", count: 1 } },
  players: [
    { name_key: "キリアンエムバペ", records: [game8Mbappe] },
    { name_key: "KylianMbappé", records: [pesdbMbappe] },
    { name_key: "ロベルトレヴァンドフスキ", records: [labLewandowski] },
  ],
});
const index = buildSourceRatingsIndex(file);

const card = (over: Partial<SourceCardRef>): SourceCardRef => ({
  worldCardId: "1",
  nameJa: "キリアン エムバペ",
  nameEn: "Kylian Mbappé",
  registeredPosition: "CF",
  ovrMax: 107,
  ...over,
});

describe("isSourceRatingsEnabled", () => {
  it("next dev のときだけ有効（本番・test・未設定・想定外の値は無効）", () => {
    expect(isSourceRatingsEnabled("development")).toBe(true);
    expect(isSourceRatingsEnabled("production")).toBe(false);
    expect(isSourceRatingsEnabled("test")).toBe(false);
    expect(isSourceRatingsEnabled(undefined)).toBe(false);
    expect(isSourceRatingsEnabled("Development")).toBe(false);
  });
});

describe("isLocalRequest", () => {
  const req = (h: Record<string, string>) => isLocalRequest(new Headers(h));
  it("localhost・127.0.0.1・[::1] からだけ受け付ける（ポートの有無は問わない）", () => {
    expect(req({ host: "localhost:3000" })).toBe(true);
    expect(req({ host: "127.0.0.1" })).toBe(true);
    expect(req({ host: "[::1]:3000" })).toBe(true);
    expect(req({ host: "LOCALHOST:3000" })).toBe(true);
  });
  it("LAN の IP・外部のドメイン・似せたドメイン・Host なしは拒否する", () => {
    expect(req({ host: "192.168.1.20:3000" })).toBe(false);
    expect(req({ host: "example.com" })).toBe(false);
    expect(req({ host: "localhost.example.com:3000" })).toBe(false);
    expect(req({})).toBe(false);
  });
  it("トンネル・プロキシ経由（X-Forwarded-Host がローカル以外）は拒否する", () => {
    expect(req({ host: "localhost:3000", "x-forwarded-host": "abc.ngrok.app" })).toBe(false);
    expect(req({ host: "localhost:3000", "x-forwarded-host": "localhost:3000, evil.example" })).toBe(false);
    expect(req({ host: "localhost:3000", "x-forwarded-host": "localhost:3000" })).toBe(true);
  });
});

describe("sourceRatingsFileSchema", () => {
  it("想定外の項目は捨てずに残す（全項目をそのまま持つ）", () => {
    const c = file.players[1].records[0];
    expect(unknownRecordEntries(c)).toEqual([["features", "クローラー側で増えた項目"]]);
  });
  it("足りない項目は既定値で埋める", () => {
    const b = file.players[2].records[0];
    expect(b.skills).toEqual([]);
    expect(b.sub_positions).toEqual([]);
    expect(b.play_style).toBe("");
  });
  it("サイト名の別名（A/B/C 以外）・版の違い・形の違いは受け付けない", () => {
    const bad = (patch: object) => sourceRatingsFileSchema.safeParse({ schema_version: 1, generated_at: "x", sources: {}, players: [{ name_key: "k", records: [{ ...game8Mbappe, ...patch }] }] }).success;
    expect(bad({})).toBe(true);
    expect(bad({ source: "game8" })).toBe(false);
    expect(bad({ skills: "シザーズ" })).toBe(false);
    expect(sourceRatingsFileSchema.safeParse({ schema_version: 2, generated_at: "x", sources: {}, players: [] }).success).toBe(false);
  });
});

describe("nameKey", () => {
  it("空白・中黒・アクセント・大文字小文字・全角の違いを吸収する", () => {
    expect(nameKey("キリアン エムバペ")).toBe(nameKey("キリアンエムバペ"));
    expect(nameKey("キリアン・エムバペ")).toBe(nameKey("キリアンエムバペ"));
    expect(nameKey("Kylian Mbappé")).toBe(nameKey("KYLIAN MBAPPE"));
    expect(nameKey("Ｊｏãｏ Ｖｉｃｔｏｒ")).toBe(nameKey("Joao Victor"));
  });
  it("日本語の濁点は区別する", () => {
    expect(nameKey("バーチャット")).not.toBe(nameKey("ハーチャット"));
  });
});

describe("parseOverall / parseRank / recordOveralls", () => {
  it("統一表記から総合値と順位を読む", () => {
    expect(parseOverall("1位 / 総合値: 107")).toBe(107);
    expect(parseRank("1位 / 総合値: 107")).toBe(1);
    expect(parseOverall("総合値: 97")).toBe(97);
    expect(parseRank("総合値: 97")).toBeNull();
    expect(parseOverall("不明")).toBeNull();
  });
  it("表記の総合値と個別ページの最大総合値を両方候補にする", () => {
    expect(recordOveralls(file.players[1].records[0]).sort()).toEqual([97, 98]);
    expect(recordOveralls(file.players[0].records[0])).toEqual([107]);
  });
});

describe("positionsCompatible", () => {
  it("攻略サイトの表記を World の登録ポジションに読み替える", () => {
    expect(positionsCompatible("CF", "CF")).toBe(true);
    expect(positionsCompatible("WG", "RWF")).toBe(true);
    expect(positionsCompatible("SB", "LB")).toBe(true);
    expect(positionsCompatible("OMF", "AMF")).toBe(true);
    expect(positionsCompatible("CB", "CF")).toBe(false);
  });
  it("どちらかが不明なら絞り込みに使わない", () => {
    expect(positionsCompatible("", "CF")).toBe(true);
    expect(positionsCompatible("不明", "CF")).toBe(true);
    expect(positionsCompatible("CF", null)).toBe(true);
  });
});

// ローカルの World（2026-11-04）の実際のカード ID。ソース C のエムバペ（52904601956478）と下位 20 ビット（110718）が同じ別のカード。
const WORLD_MBAPPE_OTHER = "52894132973694";
// ソース B のレヴァンドフスキ（123236838841410）と下位 20 ビット（40002）が同じ World のカード。
const WORLD_LEWANDOWSKI = "52901649095746";
// 下位 20 ビットが違う（別人）カード ID。
const OTHER_PERSON_ID = "88043608522894";

describe("matchCard", () => {
  it("カード番号の一致を最優先にする（cardId）", () => {
    const m = matchCard(index, card({ worldCardId: "52904601956478", ovrMax: 98 }));
    expect(m[0]).toMatchObject({ kind: "cardId", record: { source: "C" } });
  });
  it("カード番号の人物のキーが同じなら samePerson（名前の表記が違っても当たる）", () => {
    const m = matchCard(index, card({ worldCardId: WORLD_MBAPPE_OTHER, nameJa: "表記の違う名前", nameEn: null, ovrMax: 97 }));
    expect(m).toEqual([{ kind: "samePerson", record: expect.objectContaining({ source: "C" }) }]);
    const lw = matchCard(index, card({ worldCardId: WORLD_LEWANDOWSKI, nameJa: "ロベルト レヴァンドフスキ", nameEn: "Robert Lewandowski", ovrMax: 96 }));
    expect(lw.map((x) => [x.kind, x.record.source])).toEqual([["samePerson", "B"]]);
  });
  it("カード番号を持つ記録は、名前と総合値が同じでも別人のカードには結び付けない（同名の別人）", () => {
    const m = matchCard(index, card({ worldCardId: OTHER_PERSON_ID, ovrMax: 98 }));
    expect(m.some((x) => x.record.source === "C")).toBe(false);
  });
  it("カード番号の無い記録は、名前と総合値（最大総合値を含む）とポジションが合えば nameOvr", () => {
    const m = matchCard(index, card({ worldCardId: OTHER_PERSON_ID, ovrMax: 107 }));
    expect(m.find((x) => x.record.source === "A")?.kind).toBe("nameOvr");
  });
  it("総合値が違えば nameOnly（別のカード向けの参考）", () => {
    const m = matchCard(index, card({ ovrMax: 101 }));
    expect(m.find((x) => x.record.source === "A")?.kind).toBe("nameOnly");
  });
  it("ポジションが合わなければ nameOvr にしない", () => {
    const m = matchCard(index, card({ ovrMax: 107, registeredPosition: "CB" }));
    expect(m.find((x) => x.record.source === "A")?.kind).toBe("nameOnly");
  });
  it("同じ記録を二重に返さない（日本語名と英語名の両方で当たっても 1 回）", () => {
    const m = matchCard(index, card({ worldCardId: WORLD_MBAPPE_OTHER, ovrMax: 107 }));
    expect(new Set(m.map((x) => x.record)).size).toBe(m.length);
  });
  it("確からしい順（cardId → nameOvr → samePerson → nameOnly）に並べる", () => {
    expect(matchCard(index, card({ worldCardId: "52904601956478", ovrBase: 97, ovrMax: 107 })).map((x) => x.kind)).toEqual(["cardId", "nameOvr"]);
    expect(matchCard(index, card({ worldCardId: WORLD_MBAPPE_OTHER, ovrMax: 101 })).map((x) => x.kind)).toEqual(["samePerson", "nameOnly"]);
  });
  it("参考の種類（総合値が食い違うカード番号・同じ選手の別カード・名前だけ）は、このカードのものとして結び付けない", () => {
    expect(
      ["cardId", "stats", "typeLevelOvr", "statsNear", "crossSource", "nameOvr", "candidate", "cardIdConflict", "samePerson", "nameOnly"].filter((k) => isCardLevelMatch(k as never)),
    ).toEqual(["cardId", "stats", "typeLevelOvr", "statsNear", "crossSource", "nameOvr", "candidate"]);
  });
  it("最大総合値が不明なカード（暫定）は、総合値の違いを食い違いにしない", () => {
    const m = matchCard(index, card({ worldCardId: "52904601956478", ovrBase: 96, ovrMax: null }));
    expect(m.find((x) => x.record.source === "C")?.kind).toBe("cardId");
  });
  it("カード番号が同じでも、Lv 上限が違えば cardIdConflict", () => {
    const leveled = buildSourceRatingsIndex(sourceRatingsFileSchema.parse({ schema_version: 1, generated_at: "x", sources: {}, players: [{ name_key: "k", records: [{ ...pesdbMbappe, stats_and_boosters: { 最大総合値: "98", Lv上限: "32" } }] }] }));
    expect(matchCard(leveled, card({ worldCardId: "52904601956478", ovrMax: 98, maximumLevel: 35 }))[0].kind).toBe("cardIdConflict");
    expect(matchCard(leveled, card({ worldCardId: "52904601956478", ovrMax: 98, maximumLevel: 32 }))[0].kind).toBe("cardId");
    expect(matchCard(leveled, card({ worldCardId: "52904601956478", ovrMax: 98, maximumLevel: null }))[0].kind).toBe("cardId");
  });
  it("カード番号が同じでも、総合値が初期・最大のどちらとも違えば cardIdConflict（実データ: 86 の記録に 97 のカードの番号）", () => {
    const m = matchCard(index, card({ worldCardId: "52904601956478", ovrBase: 90, ovrMax: 101 }));
    expect(m.find((x) => x.record.source === "C")?.kind).toBe("cardIdConflict");
    const base = matchCard(index, card({ worldCardId: "52904601956478", ovrBase: 97, ovrMax: 101 }));
    expect(base.find((x) => x.record.source === "C")?.kind).toBe("cardId");
  });
  it("名前が無いカード・該当なしは空。カード番号の形が違う記録は名前で扱う", () => {
    expect(matchCard(index, card({ worldCardId: OTHER_PERSON_ID, nameJa: null, nameEn: null }))).toEqual([]);
    expect(matchCard(index, card({ worldCardId: OTHER_PERSON_ID, nameJa: "存在しない選手", nameEn: "Nobody" }))).toEqual([]);
    const odd = buildSourceRatingsIndex(sourceRatingsFileSchema.parse({ schema_version: 1, generated_at: "x", sources: {}, players: [{ name_key: "k", records: [{ ...game8Mbappe, card_id: "abc" }] }] }));
    expect(matchCard(odd, card({ worldCardId: OTHER_PERSON_ID, ovrMax: 107 })).map((x) => x.kind)).toEqual(["nameOvr"]);
  });
});

describe("resolveRecordCards", () => {
  const fullStats = Object.fromEntries(Object.keys(STAT_LABEL_JA).map((k, i) => [k, 50 + i]));
  const statLabels = Object.fromEntries(Object.entries(STAT_LABEL_JA).map(([k, label]) => [label, String(fullStats[k])]));
  const resolverCard = (over: Partial<ResolverCard>): ResolverCard => ({
    worldCardId: "1",
    nameJa: "キリアン エムバペ",
    nameEn: "Kylian Mbappé",
    cardType: "EPIC",
    maximumLevel: 32,
    ovrBase: 86,
    ovrMax: 102,
    stats: {},
    ...over,
  });
  const fileOf = (record: Record<string, unknown>, ...more: Record<string, unknown>[]) =>
    sourceRatingsFileSchema.parse({ schema_version: 1, generated_at: "x", sources: {}, players: [{ name_key: "k", records: [{ ...game8Mbappe, ...record }, ...more.map((m) => ({ ...game8Mbappe, ...m }))] }] });
  const recordOf = (f: ReturnType<typeof fileOf>) => f.players[0].records[0];

  it("26 能力値がすべて同じカードが 1 枚なら stats（順位用の総合値がカードと違っても特定できる）", () => {
    const out = resolveRecordCards(fileOf({ stats_and_boosters: { 最大総合値: "107", ...statLabels } }), [
      resolverCard({ stats: fullStats }),
      resolverCard({ worldCardId: "2", stats: { ...fullStats, speed: 1 } }),
    ]);
    expect(recordOf(out)).toMatchObject({ resolved_by: "stats", resolved_card_ids: ["1"] });
    const idx = buildSourceRatingsIndex(out);
    expect(matchCard(idx, card({ worldCardId: "1", ovrMax: 102 }))[0].kind).toBe("stats");
    expect(matchCard(idx, card({ worldCardId: "2", ovrMax: 107 }))[0].kind).toBe("nameOnly");
  });
  it("能力値が 1 つでも欠けた記録は能力値で特定しない", () => {
    const out = resolveRecordCards(fileOf({ stats_and_boosters: { オフェンスセンス: "50" } }), [resolverCard({ stats: fullStats })]);
    expect(recordOf(out).resolved_by).toBeNull();
  });
  it("同じ能力値のカードが複数なら候補を全部残し、確定にしない（candidate）", () => {
    const out = resolveRecordCards(fileOf({ stats_and_boosters: statLabels }), [resolverCard({ stats: fullStats }), resolverCard({ worldCardId: "2", stats: fullStats })]);
    expect(recordOf(out).resolved_card_ids).toEqual(["1", "2"]);
    expect(matchCard(buildSourceRatingsIndex(out), card({ worldCardId: "2" }))[0].kind).toBe("candidate");
  });
  it("種別・Lv 上限・初期総合値が同じカードが 1 枚なら typeLevelOvr（ポジションでは絞らない）", () => {
    const out = resolveRecordCards(fileOf({ position: "DMF", rating_or_tier: "7位 / 総合値: 86", stats_and_boosters: { カード種別: "エピック", Lv上限: "32" } }), [
      resolverCard({}),
      resolverCard({ worldCardId: "2", maximumLevel: 35 }),
      resolverCard({ worldCardId: "3", cardType: "SHOWTIME" }),
    ]);
    expect(recordOf(out)).toMatchObject({ resolved_by: "typeLevelOvr", resolved_card_ids: ["1"] });
  });
  it("種別を決められない表記・総合値の違うカードでは特定しない", () => {
    const potw = resolveRecordCards(fileOf({ rating_or_tier: "総合値: 86", stats_and_boosters: { カード種別: "POTW 24 Aug '23" } }), [resolverCard({})]);
    expect(recordOf(potw).resolved_by).toBeNull();
    const other = resolveRecordCards(fileOf({ rating_or_tier: "総合値: 90", stats_and_boosters: { カード種別: "エピック" } }), [resolverCard({})]);
    expect(recordOf(other).resolved_by).toBeNull();
  });
  it("Lv 上限が分からない候補（暫定のカード）は、同じかもしれないとして残す", () => {
    const out = resolveRecordCards(fileOf({ rating_or_tier: "総合値: 86", stats_and_boosters: { カード種別: "エピック", Lv上限: "32" } }), [resolverCard({}), resolverCard({ worldCardId: "2", maximumLevel: null })]);
    expect(recordOf(out).resolved_card_ids).toEqual(["1", "2"]);
  });
  it("カードデータに無いカード番号の記録も候補に入れ、新しいカードと取り違えて確定にしない", () => {
    const out = resolveRecordCards(
      fileOf(
        { source: "B", rating_or_tier: "総合値: 86", stats_and_boosters: { カード種別: "エピック", Lv上限: "32" } },
        { source: "B", card_id: "52904601956478", rating_or_tier: "総合値: 86", stats_and_boosters: { カード種別: "エピック", Lv上限: "32" } },
      ),
      [resolverCard({})],
    );
    expect(recordOf(out).resolved_card_ids).toEqual(["1", "52904601956478"]);
  });
  it("カードデータに無いカードでも、他のソースの記録と 26 能力値が同じなら特定する", () => {
    const out = resolveRecordCards(fileOf({ stats_and_boosters: statLabels }, { source: "C", card_id: "52904601956478", stats_and_boosters: statLabels }), [resolverCard({})]);
    expect(recordOf(out)).toMatchObject({ resolved_by: "stats", resolved_card_ids: ["52904601956478"] });
  });
  it("候補が複数でも、他のソースが特定したカードが 1 枚なら crossSource。同じソースの記録では絞らない", () => {
    const row = { source: "B", rating_or_tier: "総合値: 86", stats_and_boosters: { カード種別: "エピック" } };
    const cards = [resolverCard({ stats: fullStats }), resolverCard({ worldCardId: "2" })];
    const out = resolveRecordCards(fileOf(row, { source: "A", stats_and_boosters: statLabels }), cards);
    expect(recordOf(out)).toMatchObject({ resolved_by: "crossSource", resolved_card_ids: ["1"] });
    expect(matchCard(buildSourceRatingsIndex(out), card({ worldCardId: "1", ovrMax: 102 })).map((m) => m.kind)).toContain("crossSource");
    const same = resolveRecordCards(fileOf(row, { source: "B", stats_and_boosters: statLabels }), cards);
    expect(recordOf(same).resolved_card_ids).toEqual(["1", "2"]);
  });
  it("能力値が数項目だけずれる記録は、種別・Lv 上限が同じカードの中でほぼ一致が 1 枚だけなら statsNear", () => {
    const off = { ...statLabels, [STAT_LABEL_JA.speed]: "1", [STAT_LABEL_JA.finishing]: "1" };
    const row = { stats_and_boosters: { ...off, 選手タイプ: "エピック", "最大Lv/ポイント": "Lv.32 / 62" } };
    const near = resolveRecordCards(fileOf(row), [resolverCard({ stats: fullStats }), resolverCard({ worldCardId: "2", stats: {} })]);
    expect(recordOf(near)).toMatchObject({ resolved_by: "statsNear", resolved_card_ids: ["1"] });
    expect(matchCard(buildSourceRatingsIndex(near), card({ worldCardId: "1", ovrMax: 102 }))[0].kind).toBe("statsNear");
    // Lv 上限が違う・2 番目も近いときは絞らない
    expect(recordOf(resolveRecordCards(fileOf(row), [resolverCard({ maximumLevel: 35, stats: fullStats })])).resolved_by).toBeNull();
    const twin = resolveRecordCards(fileOf(row), [resolverCard({ stats: fullStats }), resolverCard({ worldCardId: "2", stats: { ...fullStats, curl: 0 } })]);
    expect(recordOf(twin).resolved_by).toBeNull();
  });
  it("カード番号を持つ記録・同名のカードが無い記録はそのまま", () => {
    const withId = resolveRecordCards(fileOf({ card_id: "52904601956478", stats_and_boosters: statLabels }), [resolverCard({ stats: fullStats })]);
    expect(recordOf(withId).resolved_by).toBeNull();
    const noName = resolveRecordCards(fileOf({ player_name: "存在しない選手", stats_and_boosters: statLabels }), [resolverCard({ stats: fullStats })]);
    expect(recordOf(noName).resolved_by).toBeNull();
  });
  it("突き合わせの結果は「その他」の項目に出さない", () => {
    const out = resolveRecordCards(fileOf({ stats_and_boosters: statLabels }), [resolverCard({ stats: fullStats })]);
    expect(unknownRecordEntries(recordOf(out))).toEqual([]);
  });
});

describe("recordBadgeRating", () => {
  const record = (position: string, rating: string) => sourceRatingsFileSchema.parse({ schema_version: 1, generated_at: "x", sources: {}, players: [{ name_key: "k", records: [{ ...game8Mbappe, position, rating_or_tier: rating }] }] }).players[0].records[0];
  it("順位にポジションを添える。不明・空なら順位だけ", () => {
    expect(recordBadgeRating(record("CF", "2位 / 総合値: 97"))).toBe("CF 2位 / 総合値: 97");
    expect(recordBadgeRating(record("不明", "2位 / 総合値: 97"))).toBe("2位 / 総合値: 97");
    expect(recordBadgeRating(record("", ""))).toBe("—");
  });
});

describe("countSameNameOvrCards", () => {
  it("同名・同総合値の World カードの枚数（このカードを含む）", () => {
    const cards = [
      { nameJa: "キリアン エムバペ", nameEn: "Kylian Mbappé", ovrMax: 101 },
      { nameJa: "キリアン エムバペ", nameEn: "Kylian Mbappé", ovrMax: 101 },
      { nameJa: "キリアン エムバペ", nameEn: "Kylian Mbappé", ovrMax: 98 },
      { nameJa: "別の選手", nameEn: "Other", ovrMax: 101 },
    ];
    expect(countSameNameOvrCards(cards, card({ ovrMax: 101 }))).toBe(2);
    expect(countSameNameOvrCards(cards, card({ ovrMax: 98 }))).toBe(1);
  });
});

describe("compareStats / extraStatEntries", () => {
  const cardStats = [
    { key: "offensiveAwareness", value: 81 },
    { key: "speed", value: 85 },
  ];
  it("26 項目を World の順で並べ、差を出す（無い値は null）", () => {
    const rows = compareStats(file.players[0].records[0], cardStats);
    expect(rows).toHaveLength(26);
    expect(rows.find((r) => r.key === "offensiveAwareness")).toMatchObject({ labelJa: "オフェンスセンス", source: 81, card: 81, diff: 0 });
    expect(rows.find((r) => r.key === "speed")).toMatchObject({ source: 81, card: 85, diff: -4 });
    expect(rows.find((r) => r.key === "stamina")).toMatchObject({ source: null, card: null, diff: null });
  });
  it("26 能力値以外の項目は全部、記録の順のまま返す", () => {
    expect(extraStatEntries(file.players[0].records[0])).toEqual([
      ["最大総合値", "107"],
      ["ブースター1", "アジリティ"],
      ["利き足", "右足"],
    ]);
  });
});
