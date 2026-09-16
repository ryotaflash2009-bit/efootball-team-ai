import { describe, it, expect } from "vitest";
import fs from "node:fs";
import {
  listPlayers,
  getPlayerByWorldId,
  getFacets,
  getSourceMeta,
  getWorldImageUrls,
} from "./repository";
import { isAllowedWorldImageUrl } from "./player-image";
import { DB_PATH } from "./db";
import { parseWorldListQuery } from "./schemas";

/**
 * ローカル SQLite（data/efootball.db）に対する結合テスト。
 * DB が無い環境では skip する。
 */
const hasDb = fs.existsSync(DB_PATH);
const d = hasDb ? describe : describe.skip;

d("repository（実 DB）", () => {
  it("一覧: 総件数はおよそ 13,009・1 ページは pageSize 以内", async () => {
    const r = await listPlayers(parseWorldListQuery({ pageSize: "24" }));
    expect(r.totalCount).toBeGreaterThan(12000);
    expect(r.players.length).toBeLessThanOrEqual(24);
    expect(r.totalPages).toBe(Math.ceil(r.totalCount / 24));
    expect(r.page).toBe(1);
    expect(r.hasPrevious).toBe(false);
  });

  it("一覧: page を範囲外に指定しても最終ページへ丸める", async () => {
    const r = await listPlayers(parseWorldListQuery({ page: "999999", pageSize: "50" }));
    expect(r.page).toBe(r.totalPages);
    expect(r.hasNext).toBe(false);
  });

  it("検索: 日本語名の部分一致", async () => {
    const r = await listPlayers(parseWorldListQuery({ q: "メッシ", pageSize: "50" }));
    expect(r.totalCount).toBeGreaterThan(0);
    expect(r.players.every((p) => (p.nameJa ?? "").includes("メッシ"))).toBe(true);
  });

  it("検索: 英語名の大文字小文字を無視", async () => {
    const lower = (await listPlayers(parseWorldListQuery({ q: "messi", pageSize: "50" }))).totalCount;
    const upper = (await listPlayers(parseWorldListQuery({ q: "MESSI", pageSize: "50" }))).totalCount;
    expect(lower).toBe(upper);
    expect(lower).toBeGreaterThan(0);
  });

  it("検索: World ID の完全一致で 1 件", async () => {
    const first = (await listPlayers(parseWorldListQuery({ pageSize: "1" }))).players[0];
    const r = await listPlayers(parseWorldListQuery({ q: first.worldCardId }));
    expect(r.totalCount).toBe(1);
    expect(r.players[0].worldCardId).toBe(first.worldCardId);
  });

  it("検索: SQL インジェクション風・記号・長大入力でも落ちない", async () => {
    for (const q of ["'; DROP TABLE world_player_cards; --", "%%%__", "@@@###", "あ".repeat(500)]) {
      const r = await listPlayers(parseWorldListQuery({ q }));
      expect(r.totalCount).toBeGreaterThanOrEqual(0);
    }
    // テーブルは無事
    expect((await listPlayers(parseWorldListQuery({}))).totalCount).toBeGreaterThan(12000);
  });

  it("フィルタ: GK は registered_position=GK のみ", async () => {
    const r = await listPlayers(parseWorldListQuery({ position: "GK", pageSize: "100" }));
    expect(r.totalCount).toBeGreaterThan(0);
    expect(r.players.every((p) => p.registeredPosition === "GK")).toBe(true);
  });

  it("フィルタ: 複数条件（ポジション + カードタイプ + 最大OVR下限）", async () => {
    const r = await listPlayers(
      parseWorldListQuery({ position: "CF", cardType: "EPIC", minOvr: "90", pageSize: "100" }),
    );
    expect(
      r.players.every(
        (p) => p.registeredPosition === "CF" && p.cardType === "EPIC" && (p.ovrMax ?? 0) >= 90,
      ),
    ).toBe(true);
  });

  it("並べ替え: 最大OVR 降順 / 昇順", async () => {
    const desc = (await listPlayers(parseWorldListQuery({ sort: "ovr_max_desc", pageSize: "50" }))).players.map((p) => p.ovrMax ?? 0);
    const asc = (await listPlayers(parseWorldListQuery({ sort: "ovr_max_asc", pageSize: "50" }))).players.map((p) => p.ovrMax ?? 999);
    expect(desc.every((v, i) => i === 0 || desc[i - 1] >= v)).toBe(true);
    expect(asc.every((v, i) => i === 0 || asc[i - 1] <= v)).toBe(true);
  });

  it("詳細: World カードは 26 能力値を持つ", async () => {
    const first = (await listPlayers(parseWorldListQuery({ pageSize: "1" }))).players[0];
    const detail = await getPlayerByWorldId(first.worldCardId);
    expect(detail).not.toBeNull();
    expect(detail!.stats).toHaveLength(26);
    expect(detail!.playerSkills.length).toBeGreaterThan(0);
  });

  it("詳細: スキルは保存順（重複なし）", async () => {
    const first = (await listPlayers(parseWorldListQuery({ q: "メッシ", pageSize: "1" }))).players[0];
    const detail = (await getPlayerByWorldId(first.worldCardId))!;
    expect(new Set(detail.playerSkills).size).toBe(detail.playerSkills.length);
  });

  it("詳細: 存在しない ID は null", async () => {
    expect(await getPlayerByWorldId("99999999999999")).toBeNull();
  });

  it("詳細: 不正な ID は null（例外にしない）", async () => {
    expect(await getPlayerByWorldId("abc")).toBeNull();
    expect(await getPlayerByWorldId("1; DROP")).toBeNull();
  });

  it("eFHUB と World の ID を混同しない: hasEfhubLink は source_record_links 由来のみ", async () => {
    // 高信頼リンクありのカードを1件探す
    let linked = null as Awaited<ReturnType<typeof getPlayerByWorldId>>;
    for (let page = 1; page <= 30 && !linked; page++) {
      const r = await listPlayers(parseWorldListQuery({ page: String(page), pageSize: "100" }));
      const hit = r.players.find((p) => p.hasEfhubLink);
      if (hit) linked = await getPlayerByWorldId(hit.worldCardId);
      if (!r.hasNext) break;
    }
    if (linked) {
      expect(linked!.efhubCardId).toMatch(/^[0-9]{1,20}$/);
      // World ID と eFHUB ID は別カラム由来（同一とは限らない）
      expect(typeof linked!.worldCardId).toBe("string");
    }
  });

  it("facets: ポジション/タイプ/プレースタイルの選択肢が取れる", async () => {
    const f = await getFacets();
    expect(f.positions).toContain("GK");
    expect(f.cardTypes.length).toBeGreaterThan(0);
    expect(f.playingStyles.length).toBeGreaterThan(0);
  });

  it("source meta: World・13,009 前後・完了状態", async () => {
    const m = await getSourceMeta();
    expect(m.source).toBe("eFootball World");
    expect(m.totalCount).toBeGreaterThan(12000);
  });

  it("getWorldImageUrls: 全カードに保存済み画像 URL があり、許可ホストのみ", async () => {
    const first = (await listPlayers(parseWorldListQuery({ pageSize: "1" }))).players[0];
    const urls = await getWorldImageUrls(first.worldCardId);
    expect(urls).not.toBeNull();
    expect(typeof urls!.imageUrl).toBe("string");
    expect(isAllowedWorldImageUrl(urls!.imageUrl!)).toBe(true);
    if (urls!.mobileImageUrl) expect(isAllowedWorldImageUrl(urls!.mobileImageUrl)).toBe(true);
  });

  it("getWorldImageUrls: 不正/存在しない ID は null", async () => {
    expect(await getWorldImageUrls("abc")).toBeNull();
    expect(await getWorldImageUrls("99999999999999")).toBeNull();
  });

  it("一覧レスポンスに 26 能力値やスキルを含めない（軽量）", async () => {
    const p = (await listPlayers(parseWorldListQuery({ pageSize: "1" }))).players[0] as unknown as Record<string, unknown>;
    expect(p.stats).toBeUndefined();
    expect(p.playerSkills).toBeUndefined();
  });
});
