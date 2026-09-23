import { describe, it, expect } from "vitest";
import { evaluateBackupContentPolicy, failedContentPolicyReasons, PRODUCTION_BACKUP_CONTENT_POLICY } from "./backup-content-policy";
import { BACKUP_TARGET_TABLES } from "./backup-target";

const HEALTHY = { world_player_cards: 13009, managers: 66, player_card_analysis: 19, import_batches: 8 };

describe("PRODUCTION_BACKUP_CONTENT_POLICY(空Backupの拒否、workflow Run #6の回帰テスト)", () => {
  it("対象4テーブルすべてに最低件数が定義されている(対象テーブル固定)", () => {
    expect(Object.keys(PRODUCTION_BACKUP_CONTENT_POLICY.minimumRowsByTable).sort()).toEqual([...BACKUP_TARGET_TABLES].sort());
    for (const t of BACKUP_TARGET_TABLES) expect(PRODUCTION_BACKUP_CONTENT_POLICY.minimumRowsByTable[t]).toBeGreaterThanOrEqual(1);
    expect(PRODUCTION_BACKUP_CONTENT_POLICY.minimumTotalRows).toBeGreaterThanOrEqual(1);
  });

  it("policyは凍結されており、実行時に閾値を弱められない", () => {
    expect(Object.isFrozen(PRODUCTION_BACKUP_CONTENT_POLICY)).toBe(true);
    expect(Object.isFrozen(PRODUCTION_BACKUP_CONTENT_POLICY.minimumRowsByTable)).toBe(true);
  });

  it("正常なnon-emptyの件数は合格する", () => {
    expect(failedContentPolicyReasons(HEALTHY, PRODUCTION_BACKUP_CONTENT_POLICY)).toEqual([]);
  });

  it("UI表示件数を固定値として要求しない(件数が変わっても1件以上なら合格する)", () => {
    expect(failedContentPolicyReasons({ world_player_cards: 1, managers: 1, player_card_analysis: 1, import_batches: 1 }, PRODUCTION_BACKUP_CONTENT_POLICY)).toEqual([]);
  });

  it("Run #6のmanifestと同じ条件(全4テーブル0行)を拒否する", () => {
    const reasons = failedContentPolicyReasons({ world_player_cards: 0, managers: 0, player_card_analysis: 0, import_batches: 0 }, PRODUCTION_BACKUP_CONTENT_POLICY);
    expect(reasons.length).toBe(4);
    for (const t of BACKUP_TARGET_TABLES) expect(reasons.join(" ")).toContain(t);
  });

  for (const table of BACKUP_TARGET_TABLES) {
    it(`${table}だけが0行でも拒否する`, () => {
      const reasons = failedContentPolicyReasons({ ...HEALTHY, [table]: 0 }, PRODUCTION_BACKUP_CONTENT_POLICY);
      expect(reasons.length).toBe(1);
      expect(reasons[0]).toContain(table);
    });
  }

  it("全テーブル合計0件を拒否する(最低件数0の緩いpolicyを渡された場合でも)", () => {
    const lax = { minimumRowsByTable: { world_player_cards: 0, managers: 0, player_card_analysis: 0, import_batches: 0 }, minimumTotalRows: 1 };
    const reasons = failedContentPolicyReasons({ world_player_cards: 0, managers: 0, player_card_analysis: 0, import_batches: 0 }, lax);
    expect(reasons.join(" ")).toMatch(/合計/);
  });

  it("対象テーブルの欠落(expected core tables missing)を拒否する", () => {
    const { managers: _omitted, ...missing } = HEALTHY;
    expect(failedContentPolicyReasons(missing, PRODUCTION_BACKUP_CONTENT_POLICY).join(" ")).toContain("managers");
  });

  it("rowCounts自体が無い・null・非objectを拒否する", () => {
    expect(evaluateBackupContentPolicy(null, PRODUCTION_BACKUP_CONTENT_POLICY).some((c) => !c.ok)).toBe(true);
    expect(evaluateBackupContentPolicy(undefined, PRODUCTION_BACKUP_CONTENT_POLICY).some((c) => !c.ok)).toBe(true);
  });

  it("数値でない・整数でない・負の行数を拒否する", () => {
    expect(failedContentPolicyReasons({ ...HEALTHY, managers: "66" }, PRODUCTION_BACKUP_CONTENT_POLICY).length).toBe(1);
    expect(failedContentPolicyReasons({ ...HEALTHY, managers: 1.5 }, PRODUCTION_BACKUP_CONTENT_POLICY).length).toBe(1);
    expect(failedContentPolicyReasons({ ...HEALTHY, managers: -1 }, PRODUCTION_BACKUP_CONTENT_POLICY).length).toBe(1);
    expect(failedContentPolicyReasons({ ...HEALTHY, managers: Number.NaN }, PRODUCTION_BACKUP_CONTENT_POLICY).length).toBe(1);
  });

  it("対象外テーブル(利用者データ等)がrowCountsに含まれていれば拒否する", () => {
    expect(failedContentPolicyReasons({ ...HEALTHY, my_team_snapshots: 5 }, PRODUCTION_BACKUP_CONTENT_POLICY).join(" ")).toContain("my_team_snapshots");
  });

  it("policy側に対象テーブルの定義が無ければ拒否する(fail closed)", () => {
    const incomplete = { minimumRowsByTable: { world_player_cards: 1 }, minimumTotalRows: 1 };
    expect(failedContentPolicyReasons(HEALTHY, incomplete).length).toBe(3);
  });
});
