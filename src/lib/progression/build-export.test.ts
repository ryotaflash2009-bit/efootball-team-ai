import { describe, it, expect } from "vitest";
import {
  SAVED_BUILD_EXPORT_FORMAT,
  SAVED_BUILD_EXPORT_FORMAT_VERSION,
  SAVED_BUILD_EXPORT_APP,
  buildExport,
  buildExportFilename,
  buildSavedBuildExportFile,
  canonicalizeExportBuild,
  dedupeExportBuilds,
  reconcileAllExport,
  reconcileSelectionExport,
  safeBuildRef,
  serializeSavedBuildExport,
  sortExportBuilds,
  validateExportBuilds,
} from "./build-export";
import type { SavedBuild } from "./types";

function makeBuild(over: Partial<SavedBuild> = {}): SavedBuild {
  return {
    buildId: "b_alpha001",
    worldCardId: "89138556575063",
    buildName: "決定力型",
    progressionAllocation: { shooting: 5, dribbling: 3 },
    selectedPlayerBooster: null,
    calculatedStats: { finishing: 92, dribbling: 90 },
    calculatedOvr: 95,
    calculationMode: "provisional",
    rulesVersion: "progression/2026-08-28.v2",
    createdAt: "2026-08-30T10:00:00.000Z",
    updatedAt: "2026-08-31T10:00:00.000Z",
    schemaVersion: 1,
    ...over,
  };
}

describe("build-export: buildExport（構築）", () => {
  it("保存ビルド 0 件は empty（ダウンロードを開始しない）", () => {
    const r = buildExport({ rawBuilds: [], exportedAt: "2026-09-02T00:00:00.000Z" });
    expect(r).toEqual({ ok: false, reason: "empty" });
  });

  it("1 件 / 複数件 / 全件: itemCount は builds.length と一致し format 固定", () => {
    for (const n of [1, 2, 5]) {
      const builds = Array.from({ length: n }, (_, i) =>
        makeBuild({ buildId: `b_${i}`, updatedAt: `2026-08-${10 + i}T00:00:00.000Z` }),
      );
      const r = buildExport({ rawBuilds: builds, exportedAt: "2026-09-02T12:00:00.000Z" });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.file.format).toBe(SAVED_BUILD_EXPORT_FORMAT);
      expect(r.file.formatVersion).toBe(SAVED_BUILD_EXPORT_FORMAT_VERSION);
      expect(r.file.app).toBe(SAVED_BUILD_EXPORT_APP);
      expect(r.file.exportedAt).toBe("2026-09-02T12:00:00.000Z");
      expect(r.file.itemCount).toBe(n);
      expect(r.file.builds).toHaveLength(n);
      expect(r.file.itemCount).toBe(r.file.builds.length);
    }
  });

  it("format は固定文字列・formatVersion は固定値（rulesVersion / schemaVersion とは別物）", () => {
    const r = buildExport({ rawBuilds: [makeBuild()], exportedAt: "x" });
    if (!r.ok) throw new Error("expected ok");
    expect(r.file.format).toBe("efootball-team-ai-saved-builds");
    expect(r.file.formatVersion).toBe("1");
    // 保存ビルドの rulesVersion / schemaVersion は builds 内にそのまま残る
    expect(r.file.builds[0].rulesVersion).toBe("progression/2026-08-28.v2");
    expect(r.file.builds[0].schemaVersion).toBe(1);
  });

  it("同一 buildId は 1 件に畳む（itemCount も一致）", () => {
    const r = buildExport({
      rawBuilds: [makeBuild({ buildId: "b_dup" }), makeBuild({ buildId: "b_dup", buildName: "別名" })],
      exportedAt: "x",
    });
    if (!r.ok) throw new Error("expected ok");
    expect(r.file.builds).toHaveLength(1);
    expect(r.file.itemCount).toBe(1);
    expect(r.file.builds[0].buildName).toBe("決定力型"); // 最初の 1 件
  });

  it("並び順は決定的（更新日時の新しい順 → buildId 順・入力順に依存しない）", () => {
    const a = makeBuild({ buildId: "b_a", updatedAt: "2026-08-10T00:00:00.000Z" });
    const b = makeBuild({ buildId: "b_b", updatedAt: "2026-08-20T00:00:00.000Z" });
    const c = makeBuild({ buildId: "b_c", updatedAt: "2026-08-20T00:00:00.000Z" });
    const r1 = buildExport({ rawBuilds: [a, b, c], exportedAt: "x" });
    const r2 = buildExport({ rawBuilds: [c, a, b], exportedAt: "x" });
    if (!r1.ok || !r2.ok) throw new Error("expected ok");
    expect(r1.file.builds.map((x) => x.buildId)).toEqual(["b_b", "b_c", "b_a"]);
    expect(r1.json).toBe(r2.json);
  });

  it("元の配列・要素を変更しない（非破壊）", () => {
    const builds = [makeBuild({ buildId: "b_x", progressionAllocation: { z: 2, a: 1 } })];
    const before = JSON.stringify(builds);
    buildExport({ rawBuilds: builds, exportedAt: "x" });
    expect(JSON.stringify(builds)).toBe(before);
  });

  it("出力は JSON として再パースでき、UTF-8 の日本語ビルド名を保持する", () => {
    const r = buildExport({
      rawBuilds: [makeBuild({ buildName: "メッシ 決定力＋ドリブル型（右利き）" })],
      exportedAt: "x",
    });
    if (!r.ok) throw new Error("expected ok");
    const round = JSON.parse(r.json);
    expect(round.builds[0].buildName).toBe("メッシ 決定力＋ドリブル型（右利き）");
    expect(round.itemCount).toBe(round.builds.length);
  });

  it("大きな worldCardId を文字列のまま保持（Number 化しない）", () => {
    const big = "12345678901234567890";
    const r = buildExport({ rawBuilds: [makeBuild({ worldCardId: big })], exportedAt: "x" });
    if (!r.ok) throw new Error("expected ok");
    expect(r.file.builds[0].worldCardId).toBe(big);
    expect(typeof r.file.builds[0].worldCardId).toBe("string");
    expect(r.json).toContain(`"worldCardId": "${big}"`);
  });

  it("配分 / Power of Many 指定 / 実験的試算 / calculatedOvr 欠損(null) を保持", () => {
    const r = buildExport({
      rawBuilds: [
        makeBuild({
          progressionAllocation: { shooting: 7, passing: 4, defending: 0 },
          conditionalBoosterSelections: [{ boosterKey: "total-package", selection: "league_20_plus" }],
          selectedPlayerBooster: 83,
          calculatedOvr: null,
          calculationMode: "unsupported",
        }),
      ],
      exportedAt: "x",
    });
    if (!r.ok) throw new Error("expected ok");
    const b = r.file.builds[0];
    expect(b.progressionAllocation).toEqual({ defending: 0, passing: 4, shooting: 7 });
    expect(b.conditionalBoosterSelections).toEqual([
      { boosterKey: "total-package", selection: "league_20_plus" },
    ]);
    expect(b.selectedPlayerBooster).toBe(83);
    expect(b.calculatedOvr).toBeNull();
    expect(r.json).toContain('"calculatedOvr": null');
  });

  it("conditionalBoosterSelections 未指定ならキー自体を出さない（既存保存仕様）", () => {
    const r = buildExport({ rawBuilds: [makeBuild()], exportedAt: "x" });
    if (!r.ok) throw new Error("expected ok");
    expect("conditionalBoosterSelections" in r.file.builds[0]).toBe(false);
    expect(r.json).not.toContain("conditionalBoosterSelections");
  });
});

describe("build-export: データ除外（SavedBuild の正式フィールドだけ出力）", () => {
  const EXCLUDED_KEYS = [
    "selectedBuildId",
    "favoriteBuildId",
    "ownershipStatus",
    "usageStatus",
    "tags",
    "note",
    "savedBuildId",
    "teamCardId",
    "localRecordId",
    "deletedAt",
    "syncStatus",
  ];

  it("SavedBuild にない同名フィールドを混ぜても出力に含めない（savedBuildSchema が strip）", () => {
    const dirty = {
      ...makeBuild(),
      selectedBuildId: "b_alpha001",
      favoriteBuildId: "b_alpha001",
      ownershipStatus: "owned",
      usageStatus: "main",
      tags: ["主力"],
      note: "個人メモ: 大事な情報",
      savedBuildId: "b_alpha001",
      teamCardId: "tc_x",
      localRecordId: "lr_x",
      deletedAt: null,
      syncStatus: "local_only",
    };
    const r = buildExport({ rawBuilds: [dirty], exportedAt: "x" });
    if (!r.ok) throw new Error("expected ok");
    const b = r.file.builds[0] as unknown as Record<string, unknown>;
    for (const k of EXCLUDED_KEYS) expect(k in b).toBe(false);
    expect(r.json).not.toContain("個人メモ");
    expect(r.json).not.toContain("主力");
    expect(r.json).not.toContain("syncStatus");
  });

  it("出力トップレベルは format/formatVersion/app/exportedAt/itemCount/builds のみ", () => {
    const r = buildExport({ rawBuilds: [makeBuild()], exportedAt: "x" });
    if (!r.ok) throw new Error("expected ok");
    expect(Object.keys(r.file).sort()).toEqual(
      ["app", "builds", "exportedAt", "format", "formatVersion", "itemCount"].sort(),
    );
  });

  it("環境情報・パス・server.pid などを示唆する語を含まない", () => {
    const r = buildExport({ rawBuilds: [makeBuild(), makeBuild({ buildId: "b_2" })], exportedAt: "x" });
    if (!r.ok) throw new Error("expected ok");
    expect(/server\.pid|dev-err\.log|process\.env|C:\\\\|efootball\.db/.test(r.json)).toBe(false);
  });
});

describe("build-export: スキーマ検証（無効があれば全体停止）", () => {
  it("全件有効なら valid にすべて入る", () => {
    const { valid, invalid } = validateExportBuilds([makeBuild(), makeBuild({ buildId: "b_2" })]);
    expect(valid).toHaveLength(2);
    expect(invalid).toHaveLength(0);
  });

  it("1 件無効 → buildExport は invalid を返し、部分成功にしない", () => {
    const bad = { ...makeBuild({ buildId: "b_bad" }), progressionAllocation: { x: -5 } };
    const r = buildExport({ rawBuilds: [makeBuild(), bad], exportedAt: "x" });
    expect(r.ok).toBe(false);
    if (r.ok || r.reason !== "invalid") throw new Error("expected invalid");
    expect(r.invalidCount).toBe(1);
    expect(r.validCount).toBe(1);
  });

  it("複数件中 1 件無効でも全体停止（有効分だけ書き出さない）", () => {
    const bad = { hello: "world" };
    const r = buildExport({
      rawBuilds: [makeBuild({ buildId: "b_1" }), bad, makeBuild({ buildId: "b_3" })],
      exportedAt: "x",
    });
    if (r.ok || r.reason !== "invalid") throw new Error("expected invalid");
    expect(r.invalidCount).toBe(1);
  });

  it("無効ビルドのエラー情報は安全な ID だけ（内容全文・localStorage を出さない）", () => {
    const bad = { buildId: "b_secret", worldCardId: "89138556575063", secretNote: "PASSWORD=hunter2" };
    const r = buildExport({ rawBuilds: [bad], exportedAt: "x" });
    if (r.ok || r.reason !== "invalid") throw new Error("expected invalid");
    expect(r.invalidRefs).toEqual([{ buildId: "b_secret", worldCardId: "89138556575063" }]);
    expect(JSON.stringify(r.invalidRefs)).not.toContain("hunter2");
  });

  it("safeBuildRef は正規表現に合う ID だけ拾う", () => {
    expect(safeBuildRef({ buildId: "b_ok", worldCardId: "123" })).toEqual({
      buildId: "b_ok",
      worldCardId: "123",
    });
    expect(safeBuildRef({ buildId: "bad id!", worldCardId: "abc" })).toEqual({
      buildId: null,
      worldCardId: null,
    });
    expect(safeBuildRef(null)).toEqual({ buildId: null, worldCardId: null });
  });

  it("無効ビルドを修復・削除・0配分化しない（入力は不変）", () => {
    const bad = { ...makeBuild({ buildId: "b_bad" }), rulesVersion: 123 };
    const snap = JSON.stringify(bad);
    buildExport({ rawBuilds: [bad], exportedAt: "x" });
    expect(JSON.stringify(bad)).toBe(snap);
  });
});

describe("build-export: 全件エクスポートの競合検出", () => {
  it("確認後に追加 / 削除 / 差し替えがあれば conflict", () => {
    const a = makeBuild({ buildId: "b_a" });
    const b = makeBuild({ buildId: "b_b" });
    const snap = ["b_a", "b_b"];
    expect(reconcileAllExport(snap, [a, b])).toEqual({ ok: true });
    expect(reconcileAllExport(snap, [a, b, makeBuild({ buildId: "b_c" })])).toMatchObject({
      ok: false,
      reason: "conflict",
      added: ["b_c"],
    });
    expect(reconcileAllExport(snap, [a])).toMatchObject({ ok: false, removed: ["b_b"] });
    expect(reconcileAllExport(snap, [a, makeBuild({ buildId: "b_z" })])).toMatchObject({
      ok: false,
      added: ["b_z"],
      removed: ["b_b"],
    });
  });
});

describe("build-export: 選択エクスポートの再検証", () => {
  const a = makeBuild({ buildId: "b_a", worldCardId: "111", updatedAt: "2026-08-31T00:00:00.000Z" });
  const b = makeBuild({ buildId: "b_b", worldCardId: "222", updatedAt: "2026-08-30T00:00:00.000Z" });
  const target = (x: SavedBuild) => ({ buildId: x.buildId, worldCardId: x.worldCardId, updatedAt: x.updatedAt });

  it("選択 1 件 / 複数件が変化なしなら ok（対象ビルドを返す）", () => {
    expect(reconcileSelectionExport([target(a)], [a, b])).toEqual({ ok: true, builds: [a] });
    const r = reconcileSelectionExport([target(a), target(b)], [a, b]);
    expect(r).toEqual({ ok: true, builds: [a, b] });
  });

  it("選択 0 件はダウンロードを開始しない（empty）", () => {
    expect(reconcileSelectionExport([], [a, b])).toEqual({ ok: false, reason: "empty" });
  });

  it("同一 buildId の重複指定は 1 件に畳む", () => {
    const r = reconcileSelectionExport([target(a), target(a)], [a, b]);
    expect(r).toEqual({ ok: true, builds: [a] });
  });

  it("対象が削除されていれば removed（書き出さない）", () => {
    const r = reconcileSelectionExport([target(a), target(b)], [a]);
    expect(r).toMatchObject({ ok: false, reason: "conflict", removed: ["b_b"], changed: [] });
  });

  it("updatedAt が変わっていれば changed（最新状態で続行しない）", () => {
    const a2 = { ...a, updatedAt: "2026-09-01T00:00:00.000Z" };
    const r = reconcileSelectionExport([target(a)], [a2, b]);
    expect(r).toMatchObject({ ok: false, reason: "conflict", changed: ["b_a"] });
  });

  it("worldCardId が変わっていれば changed（文字列完全一致で判定）", () => {
    const a2 = { ...a, worldCardId: "999" };
    const r = reconcileSelectionExport([target(a)], [a2]);
    expect(r).toMatchObject({ ok: false, reason: "conflict", changed: ["b_a"] });
  });

  it("名前変更（updatedAt も変わる）は changed 扱い", () => {
    const renamed = { ...a, buildName: "新しい名前", updatedAt: "2026-09-02T00:00:00.000Z" };
    expect(reconcileSelectionExport([target(a)], [renamed])).toMatchObject({
      ok: false,
      changed: ["b_a"],
    });
  });
});

describe("build-export: ファイル名", () => {
  it("既定形式 efootball-team-ai-builds-YYYY-MM-DD-HHMMSS-mmmZ.json（UTC）", () => {
    const d = new Date("2026-09-02T13:45:01.238Z");
    expect(buildExportFilename(d)).toBe("efootball-team-ai-builds-2026-09-02-134501-238Z.json");
  });

  it("禁止文字・パス区切り・空白・制御文字を含まない", () => {
    const name = buildExportFilename(new Date("2026-01-05T04:03:02.001Z"));
    expect(/^[A-Za-z0-9._-]+$/.test(name)).toBe(true);
    expect(/[<>:"/\\|?*]/.test(name)).toBe(false);
  });

  it("同じ秒でもミリ秒で区別できる", () => {
    const a = buildExportFilename(new Date("2026-09-02T13:45:01.100Z"));
    const b = buildExportFilename(new Date("2026-09-02T13:45:01.900Z"));
    expect(a).not.toBe(b);
  });

  it("不正な Date は固定名にフォールバック", () => {
    expect(buildExportFilename(new Date("nope"))).toBe("efootball-team-ai-builds-export.json");
  });
});

describe("build-export: 正規化と直列化", () => {
  it("canonicalizeExportBuild はレコードキーをソートしフィールド順を固定", () => {
    const b = canonicalizeExportBuild(
      makeBuild({ progressionAllocation: { z: 1, a: 2, m: 3 }, calculatedStats: { y: 9, b: 8 } }),
    );
    expect(Object.keys(b.progressionAllocation)).toEqual(["a", "m", "z"]);
    expect(Object.keys(b.calculatedStats)).toEqual(["b", "y"]);
    expect(Object.keys(b)).toEqual([
      "buildId",
      "worldCardId",
      "buildName",
      "progressionAllocation",
      "selectedPlayerBooster",
      "calculatedStats",
      "calculatedOvr",
      "calculationMode",
      "rulesVersion",
      "createdAt",
      "updatedAt",
      "schemaVersion",
    ]);
  });

  it("serializeSavedBuildExport は 2 スペースインデントの JSON（BOM なし）", () => {
    const file = buildSavedBuildExportFile([makeBuild()], "2026-09-02T00:00:00.000Z");
    const json = serializeSavedBuildExport(file);
    expect(json.startsWith("{")).toBe(true); // 先頭に BOM がない
    expect(json).toContain('\n  "format": "efootball-team-ai-saved-builds"');
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("dedupeExportBuilds / sortExportBuilds は非破壊", () => {
    const arr = [makeBuild({ buildId: "b_2" }), makeBuild({ buildId: "b_1" })];
    const snap = JSON.stringify(arr);
    dedupeExportBuilds(arr);
    sortExportBuilds(arr);
    expect(JSON.stringify(arr)).toBe(snap);
  });
});

describe("build-export: buildIntent(育成目的)の含め方", () => {
  const intent = {
    intentSchemaVersion: 1,
    mainPresetId: "dribble-to-shot",
    subPresetIds: ["hard-to-dispossess"],
    primaryGoal: "dribbling" as const,
    intendedPositions: ["CF"],
    groupPriorities: { shooting: "priority" as const },
    avoidOverinvestmentGroups: [],
    intentionallyIgnoredGroups: [],
    strengthsToPreserve: ["dribbling"],
    comparisonTargetBuildId: null,
    comparisonFocusGroups: [],
    source: "preset" as const,
    userModified: false,
    updatedAt: "2026-09-10T00:00:00.000Z",
  };

  it("buildIntentがあるビルドはエクスポートへ含める", () => {
    const build = makeBuild({ buildIntent: intent });
    const out = canonicalizeExportBuild(build);
    expect(out.buildIntent).toEqual(intent);
  });

  it("buildIntentがない旧ビルドはキー自体を出さない", () => {
    const build = makeBuild();
    const out = canonicalizeExportBuild(build);
    expect(out.buildIntent).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(out, "buildIntent")).toBe(false);
  });

  it("buildIntentの配列フィールドを決定的な順序へ正規化する", () => {
    const build = makeBuild({ buildIntent: { ...intent, subPresetIds: ["hard-to-dispossess"], avoidOverinvestmentGroups: ["passing", "dribbling"] } });
    const out = canonicalizeExportBuild(build);
    expect(out.buildIntent?.avoidOverinvestmentGroups).toEqual(["dribbling", "passing"]);
  });

  it("表示文章・自由記述・診断結果を含まない(既存フィールドのみ)", () => {
    const build = makeBuild({ buildIntent: intent });
    const json = JSON.stringify(canonicalizeExportBuild(build));
    expect(json).not.toMatch(/headline|achievementItems|freeText|primaryConcern/);
  });

  it("エクスポート全体の検証(validateExportBuilds)を通る", () => {
    const build = makeBuild({ buildIntent: intent });
    const { valid, invalid } = validateExportBuilds([build]);
    expect(invalid).toHaveLength(0);
    expect(valid[0].buildIntent).toBeDefined();
  });
});
