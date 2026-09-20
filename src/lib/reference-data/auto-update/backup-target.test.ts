import { describe, it, expect } from "vitest";
import { BACKUP_TARGET_TABLES, checkBackupTargetAllowed, checkBackupTargetSetExact } from "./backup-target";

describe("BACKUP_TARGET_TABLES", () => {
  it("参照データ4テーブルだけを含む(過不足なし)", () => {
    expect([...BACKUP_TARGET_TABLES].sort()).toEqual(
      ["world_player_cards", "managers", "player_card_analysis", "import_batches"].sort(),
    );
  });
});

describe("checkBackupTargetAllowed", () => {
  it("許可リスト内の4テーブルはいずれも合格する", () => {
    for (const t of BACKUP_TARGET_TABLES) {
      expect(checkBackupTargetAllowed(t).ok).toBe(true);
    }
  });

  it("auth.usersを明示的に拒否する", () => {
    expect(checkBackupTargetAllowed("auth.users").ok).toBe(false);
  });

  it("my_team_snapshotsを明示的に拒否する", () => {
    expect(checkBackupTargetAllowed("my_team_snapshots").ok).toBe(false);
  });

  it("rls_probe_recordsを明示的に拒否する", () => {
    expect(checkBackupTargetAllowed("rls_probe_records").ok).toBe(false);
  });

  it("許可リストに無い任意のテーブル名を拒否する(外部入力からの自由指定を防ぐ)", () => {
    expect(checkBackupTargetAllowed("some_other_table").ok).toBe(false);
    expect(checkBackupTargetAllowed("reference_data_ops.update_jobs").ok).toBe(false);
  });
});

describe("checkBackupTargetSetExact", () => {
  it("許可リストと完全一致する集合は合格する", () => {
    expect(checkBackupTargetSetExact([...BACKUP_TARGET_TABLES]).ok).toBe(true);
  });

  it("1件でも欠落していれば不合格", () => {
    expect(checkBackupTargetSetExact(["world_player_cards", "managers"]).ok).toBe(false);
  });

  it("想定外のテーブルが混入していれば不合格", () => {
    expect(checkBackupTargetSetExact([...BACKUP_TARGET_TABLES, "my_team_snapshots"]).ok).toBe(false);
  });
});
