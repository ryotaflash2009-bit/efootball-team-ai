import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  WORLD_SOURCE_COLUMNS,
  WorldSourceParseError,
  buildWorldSearchRequest,
  checkUpdatedAtSortContract,
  evaluateWorldIncrementalPage,
  normalizeWorldPlayerRecord,
  parseWorldSearchPage,
  toWorldSourceRow,
  type WorldIncrementalContext,
} from "./source-world";
import { UPDATE_TABLE_CONTRACTS } from "./update-contract";

const fixture = JSON.parse(readFileSync(path.join(__dirname, "__fixtures__", "source", "world-players-synthetic.json"), "utf8")) as { players: unknown[] };
const FETCHED_AT = "2026-09-23T00:00:00Z";

function reasonOf(fn: () => unknown): string | null {
  try {
    fn();
    return null;
  } catch (e) {
    return e instanceof WorldSourceParseError ? e.reason : "other";
  }
}

describe("World parser", () => {
  it("players配列とpagination情報を読み、本文のSHA-256を記録する", () => {
    const body = JSON.stringify({ players: fixture.players, totalCount: 7, totalPages: 1, pageSize: 500, hasNext: false });
    const page = parseWorldSearchPage(body);
    expect(page.players.length).toBe(7);
    expect(page.totalCount).toBe(7);
    expect(page.hasNext).toBe(false);
    expect(page.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(page.bodyBytes).toBe(Buffer.byteLength(body));
  });

  it("JSONでない本文はparse_error、構造変化はschema_drift", () => {
    expect(reasonOf(() => parseWorldSearchPage("<html>"))).toBe("parse_error");
    expect(reasonOf(() => parseWorldSearchPage("[]"))).toBe("schema_drift");
    expect(reasonOf(() => parseWorldSearchPage('{"items":[]}'))).toBe("schema_drift");
    expect(reasonOf(() => parseWorldSearchPage('{"players":{}}'))).toBe("schema_drift");
    expect(reasonOf(() => parseWorldSearchPage('{"players":[],"totalCount":"10"}'))).toBe("schema_drift");
    expect(reasonOf(() => parseWorldSearchPage('{"players":[],"totalPages":-1}'))).toBe("schema_drift");
    expect(reasonOf(() => parseWorldSearchPage('{"players":[],"hasNext":"no"}'))).toBe("schema_drift");
    expect(reasonOf(() => parseWorldSearchPage('{"players":[]}'))).toBeNull();
  });

  it("requestはpage 1以上だけ", () => {
    expect(buildWorldSearchRequest(1, "UPDATED_AT").body).toContain('"sortBy":"UPDATED_AT"');
    expect(() => buildWorldSearchRequest(0, "CREATED_AT")).toThrow();
    expect(() => buildWorldSearchRequest(1.5, "CREATED_AT")).toThrow();
  });
});

describe("World source row", () => {
  const results = fixture.players.map((p) => toWorldSourceRow(normalizeWorldPlayerRecord(p), FETCHED_AT));

  it("正常な3件を受理し、境界違反の4件を理由付きでrejectする(補正しない)", () => {
    expect(results.filter((r) => r.ok).length).toBe(3);
    const rejected = results.filter((r) => !r.ok).map((r) => (r.ok ? null : r.rejection));
    expect(rejected.map((r) => r!.identity)).toEqual([null, "900000000000005", "900000000000006", "900000000000007"]);
    expect(rejected[0]!.reasons.join()).toMatch(/world_card_id/);
    expect(rejected[1]!.reasons.join()).toMatch(/image_url.*許可ホスト外/);
    expect(rejected[1]!.reasons.join()).toMatch(/ovr_baseが0以上の整数ではない/);
    expect(rejected[2]!.reasons.join()).toMatch(/name_enが空/);
    expect(rejected[3]!.reasons.join()).toMatch(/updatedAt/);
  });

  it("列集合は契約のProduction列の部分集合で、volatile列・eFHUB由来列を含まない", () => {
    const contract = UPDATE_TABLE_CONTRACTS.world_player_cards;
    for (const col of WORLD_SOURCE_COLUMNS) expect(contract.productionColumns).toContain(col);
    for (const col of ["efhub_card_id", "efhub_conflicts", ...contract.volatileColumns]) expect(WORLD_SOURCE_COLUMNS).not.toContain(col);
    const first = results[0];
    if (!first.ok) throw new Error("unreachable");
    expect(Object.keys(first.row).sort()).toEqual([...WORLD_SOURCE_COLUMNS, "fetched_at"].sort());
  });

  it("型変換: boostは十進文字列・statsは数値だけ・timestampはUTC ms・name_sort_keyはASCII小文字化", () => {
    const [a, b, c] = results.filter((r) => r.ok).map((r) => (r.ok ? r.row : null)!);
    expect(a.boost1).toBe("12");
    expect(c.boost1).toBe("3.5");
    expect(b.boost1).toBeNull();
    expect(Object.keys(b.stats as object).sort()).toEqual(["gkAwareness", "gkCatching", "gkParrying", "gkReach", "gkReflexes"]);
    expect((b.stats as Record<string, number>).gkParrying).toBe(80);
    expect(b.appearance_updated_at).toBe("2026-09-18T23:30:00.000Z");
    expect(b.skills).toEqual(["GK Long Throw"]);
    expect(a.name_sort_key).toBe("synthetic forward");
    expect(a.fetched_at).toBe("2026-09-23T00:00:00.000Z");
    expect(c.skills).toEqual([]);
    expect(c.ai_styles).toEqual([]);
    expect(c.appearance).toBeNull();
  });

  it("不正なfetchedAtはreject", () => {
    const r = toWorldSourceRow(normalizeWorldPlayerRecord(fixture.players[0]), "2026-09-23");
    expect(r.ok).toBe(false);
  });
});

describe("World incremental planner", () => {
  const ctx = (over: Partial<WorldIncrementalContext> = {}): WorldIncrementalContext => ({
    previousMaxUpdatedAt: "2026-09-10T00:00:00.000Z",
    previousFirstPageHash: "h-prev",
    knownUpdatedAt: new Map([
      ["1", "2026-09-10T00:00:00.000Z"],
      ["2", "2026-09-01T00:00:00.000Z"],
      ["3", "2026-08-01T00:00:00.000Z"],
    ]),
    maxPages: 15,
    ...over,
  });
  const row = (id: string, u: string | null) => ({ world_card_id: id, appearance_updated_at: u });

  it("先頭pageがUPDATED_AT降順でない・欠損が半数超ならblocked(別方式へ自動で切り替えない)", () => {
    expect(checkUpdatedAtSortContract([row("1", "2026-01-01T00:00:00.000Z"), row("2", "2026-02-01T00:00:00.000Z")])).toBe(false);
    expect(checkUpdatedAtSortContract([row("1", null), row("2", null), row("3", "2026-01-01T00:00:00.000Z")])).toBe(false);
    expect(checkUpdatedAtSortContract([])).toBe(false);
    const r = evaluateWorldIncrementalPage(ctx(), 1, { contentHash: "h", totalPages: 5 }, [row("1", "2026-01-01T00:00:00.000Z"), row("2", "2026-02-01T00:00:00.000Z")], null);
    expect(r.decision).toBe("blocked_sort_contract");
  });

  it("先頭pageのcontent hashが前回と同じなら変化なしで停止", () => {
    const r = evaluateWorldIncrementalPage(ctx(), 1, { contentHash: "h-prev", totalPages: 5 }, [row("1", "2026-09-10T00:00:00.000Z")], null);
    expect(r.decision).toBe("stop_no_change");
  });

  it("新規・updatedAt変化・前回最大より新しいものを候補にし、変化なしは数える", () => {
    const rows = [row("9", "2026-09-22T00:00:00.000Z"), row("2", "2026-09-15T00:00:00.000Z"), row("1", "2026-09-10T00:00:00.000Z"), row("3", "2026-08-01T00:00:00.000Z")];
    const r = evaluateWorldIncrementalPage(ctx(), 1, { contentHash: "h-new", totalPages: 5 }, rows, null);
    expect(r.decision).toBe("continue");
    expect(r.newIds).toEqual(["9"]);
    expect(r.changedIds).toEqual(["2"]);
    expect(r.unchangedCount).toBe(2);
    expect(r.maxUpdatedAtSeen).toBe("2026-09-22T00:00:00.000Z");
  });

  it("2page目以降で全件が既知・無変化なら早期停止、最終page・max pagesでも停止", () => {
    const known = [row("1", "2026-09-10T00:00:00.000Z"), row("3", "2026-08-01T00:00:00.000Z")];
    expect(evaluateWorldIncrementalPage(ctx(), 2, { contentHash: "x", totalPages: 5 }, known, null).decision).toBe("stop_all_known");
    const fresh = [row("8", "2026-09-21T00:00:00.000Z")];
    expect(evaluateWorldIncrementalPage(ctx(), 5, { contentHash: "x", totalPages: 5 }, fresh, null).decision).toBe("stop_last_page");
    expect(evaluateWorldIncrementalPage(ctx({ maxPages: 2 }), 2, { contentHash: "x", totalPages: 5 }, fresh, null).decision).toBe("stop_max_pages");
    expect(() => evaluateWorldIncrementalPage(ctx({ maxPages: 0 }), 2, { contentHash: "x", totalPages: 5 }, fresh, null)).toThrow();
  });

  it("前回状態が無い初回は全件を新規候補にする", () => {
    const r = evaluateWorldIncrementalPage(
      ctx({ previousMaxUpdatedAt: null, previousFirstPageHash: null, knownUpdatedAt: new Map() }),
      1,
      { contentHash: "h", totalPages: 1 },
      [row("5", "2026-09-22T00:00:00.000Z"), row("6", "2026-09-21T00:00:00.000Z")],
      null,
    );
    expect(r.newIds).toEqual(["5", "6"]);
    expect(r.decision).toBe("stop_last_page");
  });
});
