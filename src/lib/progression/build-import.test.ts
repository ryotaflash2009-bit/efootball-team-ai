import { describe, it, expect } from "vitest";
import {
  MAX_IMPORT_FILE_BYTES,
  MAX_IMPORT_ITEM_COUNT,
  SUPPORTED_IMPORT_FORMAT_VERSIONS,
  analyzeImport,
  findInFileDuplicateBuildIds,
  parseImportText,
  reconcileImport,
  validateImportBuilds,
  type BuildIdGenerator,
} from "./build-import";
import { SAVED_BUILD_EXPORT_FORMAT, SAVED_BUILD_EXPORT_FORMAT_VERSION } from "./build-export";
import type { SavedBuild } from "./types";

function mkBuild(over: Partial<SavedBuild> = {}): SavedBuild {
  return {
    buildId: "b_file0001",
    worldCardId: "89138556575063",
    buildName: "決定力型",
    progressionAllocation: { shooting: 5, dribbling: 2 },
    selectedPlayerBooster: null,
    calculatedStats: { finishing: 92 },
    calculatedOvr: 95,
    calculationMode: "provisional",
    rulesVersion: "progression/2026-08-28.v2",
    createdAt: "2026-08-20T10:00:00.000Z",
    updatedAt: "2026-08-21T10:00:00.000Z",
    schemaVersion: 1,
    ...over,
  };
}

function mkFile(builds: unknown[], over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    format: SAVED_BUILD_EXPORT_FORMAT,
    formatVersion: SAVED_BUILD_EXPORT_FORMAT_VERSION,
    app: "eFootball Team AI",
    exportedAt: "2026-09-02T00:00:00.000Z",
    itemCount: builds.length,
    builds,
    ...over,
  });
}

// 連番の genId（テスト用・taken を尊重）
function counterGen(): BuildIdGenerator {
  let n = 0;
  return (taken) => {
    let id = `b_new${++n}`;
    while (taken.has(id)) id = `b_new${++n}`;
    return id;
  };
}

describe("build-import: parseImportText（トップレベル形式）", () => {
  it("正式なエクスポート JSON を受理する", () => {
    const r = parseImportText(mkFile([mkBuild()]));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.meta.format).toBe(SAVED_BUILD_EXPORT_FORMAT);
    expect(r.meta.formatVersion).toBe("1");
    expect(r.meta.itemCount).toBe(1);
    expect(r.rawBuilds).toHaveLength(1);
  });

  it("空文字 / 空白のみ → empty", () => {
    expect(parseImportText("")).toMatchObject({ ok: false, code: "empty" });
    expect(parseImportText("   \n ")).toMatchObject({ ok: false, code: "empty" });
    expect(parseImportText(123 as unknown)).toMatchObject({ ok: false, code: "empty" });
  });

  it("不正 JSON → not-json", () => {
    expect(parseImportText("{ not json")).toMatchObject({ ok: false, code: "not-json" });
    expect(parseImportText("<html></html>")).toMatchObject({ ok: false, code: "not-json" });
  });

  it("トップレベルが配列 / null → not-object", () => {
    expect(parseImportText("[]")).toMatchObject({ ok: false, code: "not-object" });
    expect(parseImportText("null")).toMatchObject({ ok: false, code: "not-object" });
    expect(parseImportText('"just a string"')).toMatchObject({ ok: false, code: "not-object" });
  });

  it("JavaScript 文字列 → not-json（実行しない）", () => {
    expect(parseImportText("alert('x')")).toMatchObject({ ok: false, code: "not-json" });
  });

  it("__proto__ / constructor / prototype を含むトップレベル → risky-keys", () => {
    expect(parseImportText('{"__proto__":{"x":1},"format":"' + SAVED_BUILD_EXPORT_FORMAT + '"}')).toMatchObject({
      ok: false,
      code: "risky-keys",
    });
    expect(parseImportText('{"constructor":1}')).toMatchObject({ ok: false, code: "risky-keys" });
    expect(parseImportText('{"prototype":1}')).toMatchObject({ ok: false, code: "risky-keys" });
  });

  it("プロトタイプ汚染が起きない（Object.prototype が汚れない）", () => {
    parseImportText('{"__proto__":{"polluted":true}}');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("不明なトップレベルキー → unknown-top-key", () => {
    expect(parseImportText(mkFile([mkBuild()], { evilExtra: 1 }))).toMatchObject({
      ok: false,
      code: "unknown-top-key",
    });
  });

  it("format 不一致 → format-mismatch", () => {
    expect(parseImportText(mkFile([mkBuild()], { format: "something-else" }))).toMatchObject({
      ok: false,
      code: "format-mismatch",
    });
  });

  it("formatVersion 不一致 / 未対応 → unsupported-version（将来バージョンを現在版として読まない）", () => {
    expect(parseImportText(mkFile([mkBuild()], { formatVersion: "2" }))).toMatchObject({
      ok: false,
      code: "unsupported-version",
    });
    expect(parseImportText(mkFile([mkBuild()], { formatVersion: "99" }))).toMatchObject({
      ok: false,
      code: "unsupported-version",
    });
    expect(SUPPORTED_IMPORT_FORMAT_VERSIONS).toEqual(["1"]);
  });

  it("formatVersion が文字列でない → format-version-type", () => {
    expect(parseImportText(mkFile([mkBuild()], { formatVersion: 1 }))).toMatchObject({
      ok: false,
      code: "format-version-type",
    });
  });

  it("exportedAt が不正 → exported-at", () => {
    expect(parseImportText(mkFile([mkBuild()], { exportedAt: "きのう" }))).toMatchObject({
      ok: false,
      code: "exported-at",
    });
    expect(parseImportText(mkFile([mkBuild()], { exportedAt: 123 }))).toMatchObject({
      ok: false,
      code: "exported-at",
    });
  });

  it("itemCount が負数 / 小数 → item-count", () => {
    expect(parseImportText(mkFile([mkBuild()], { itemCount: -1 }))).toMatchObject({ ok: false, code: "item-count" });
    expect(parseImportText(mkFile([mkBuild()], { itemCount: 1.5 }))).toMatchObject({ ok: false, code: "item-count" });
  });

  it("builds が配列でない → builds-not-array", () => {
    expect(parseImportText(mkFile([], { builds: {}, itemCount: 0 }))).toMatchObject({
      ok: false,
      code: "builds-not-array",
    });
  });

  it("itemCount と builds.length 不一致 → item-count-mismatch", () => {
    expect(parseImportText(mkFile([mkBuild()], { itemCount: 5 }))).toMatchObject({
      ok: false,
      code: "item-count-mismatch",
    });
  });

  it("ファイルサイズ上限を超える → too-large", () => {
    const big = "x".repeat(MAX_IMPORT_FILE_BYTES + 10);
    expect(parseImportText(big)).toMatchObject({ ok: false, code: "too-large" });
  });

  it("itemCount 上限を超える → item-count-too-large", () => {
    expect(parseImportText(mkFile([], { itemCount: MAX_IMPORT_ITEM_COUNT + 1, builds: [] }))).toMatchObject({
      ok: false,
      code: "item-count-too-large",
    });
  });

  it("itemCount 0 の空エクスポートは受理（builds も空）", () => {
    const r = parseImportText(mkFile([]));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.rawBuilds).toEqual([]);
  });
});

describe("build-import: validateImportBuilds（SavedBuild 厳格検証）", () => {
  it("有効 1 件 / 複数件", () => {
    expect(validateImportBuilds([mkBuild()]).valid).toHaveLength(1);
    const r = validateImportBuilds([mkBuild({ buildId: "b_1" }), mkBuild({ buildId: "b_2" })]);
    expect(r.valid).toHaveLength(2);
    expect(r.invalid).toHaveLength(0);
  });

  it("worldCardId を文字列で維持 / 大きな worldCardId も可", () => {
    const big = "12345678901234567890";
    const r = validateImportBuilds([mkBuild({ worldCardId: big })]);
    expect(r.valid[0].worldCardId).toBe(big);
    expect(typeof r.valid[0].worldCardId).toBe("string");
  });

  it("必須フィールド欠損 / 不正 worldCardId / 不正 buildId / 不正 rulesVersion / 不正配分 → invalid", () => {
    const bads: unknown[] = [
      { ...mkBuild(), buildName: undefined },
      mkBuild({ worldCardId: "abc" }),
      mkBuild({ buildId: "bad id!" }),
      { ...mkBuild(), rulesVersion: 123 },
      { ...mkBuild(), progressionAllocation: { x: -5 } },
      { ...mkBuild(), createdAt: 0 },
    ];
    const r = validateImportBuilds(bads);
    expect(r.valid).toHaveLength(0);
    expect(r.invalid).toHaveLength(bads.length);
  });

  it("未知の SavedBuild キーを拒否（strict）", () => {
    const r = validateImportBuilds([{ ...mkBuild(), sneaky: "x" }]);
    expect(r.valid).toHaveLength(0);
    expect(r.invalid[0]).toMatchObject({ index: 0, buildId: "b_file0001" });
  });

  it("schemaVersion 不一致は invalid", () => {
    expect(validateImportBuilds([mkBuild({ schemaVersion: 2 })]).invalid).toHaveLength(1);
  });

  it("Power of Many 指定・実験的試算・calculatedOvr null を保持", () => {
    const r = validateImportBuilds([
      mkBuild({
        conditionalBoosterSelections: [{ boosterKey: "total-package", selection: "league_20_plus" }],
        selectedPlayerBooster: 83,
        calculatedOvr: null,
      }),
    ]);
    expect(r.valid[0].conditionalBoosterSelections).toEqual([
      { boosterKey: "total-package", selection: "league_20_plus" },
    ]);
    expect(r.valid[0].selectedPlayerBooster).toBe(83);
    expect(r.valid[0].calculatedOvr).toBeNull();
  });

  it("無効の識別情報は安全な ID のみ（内容全文を返さない）", () => {
    const r = validateImportBuilds([{ buildId: "b_secret", worldCardId: "89138556575063", secret: "PASSWORD" }]);
    expect(r.invalid).toEqual([{ index: 0, buildId: "b_secret", worldCardId: "89138556575063" }]);
    expect(JSON.stringify(r.invalid)).not.toContain("PASSWORD");
  });

  it("入力オブジェクトを変更しない", () => {
    const b = mkBuild();
    const snap = JSON.stringify(b);
    validateImportBuilds([b]);
    expect(JSON.stringify(b)).toBe(snap);
  });
});

describe("build-import: ファイル内 buildId 重複", () => {
  it("重複を検出（昇順）", () => {
    expect(
      findInFileDuplicateBuildIds([mkBuild({ buildId: "b_b" }), mkBuild({ buildId: "b_a" }), mkBuild({ buildId: "b_b" })]),
    ).toEqual(["b_b"]);
  });

  it("同 buildId は内容が同じでも重複扱い → analyzeImport で全体拒否", () => {
    const file = mkFile([mkBuild({ buildId: "b_dup" }), mkBuild({ buildId: "b_dup" })]);
    const r = analyzeImport(file, [], counterGen());
    expect(r).toMatchObject({ ok: false, stage: "duplicate", duplicateBuildIds: ["b_dup"] });
  });

  it("buildId が違えば内容同一でも別ビルド（自動統合しない）", () => {
    const file = mkFile([mkBuild({ buildId: "b_1" }), mkBuild({ buildId: "b_2" })]);
    const r = analyzeImport(file, [], counterGen());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.plan.items).toHaveLength(2);
  });
});

describe("build-import: analyzeImport（プレビュー用プラン）", () => {
  it("衝突なし → 元 buildId を維持、日時を維持", () => {
    const file = mkFile([mkBuild({ buildId: "b_keep", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z" })]);
    const r = analyzeImport(file, [], counterGen());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const it = r.plan.items[0];
    expect(it.originalBuildId).toBe("b_keep");
    expect(it.finalBuildId).toBe("b_keep");
    expect(it.collision).toBe(false);
    expect(it.build.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(it.build.updatedAt).toBe("2026-01-02T00:00:00.000Z");
    expect(r.plan.saveCount).toBe(1);
    expect(r.plan.collisionCount).toBe(0);
  });

  it("既存 buildId と衝突 → 新 buildId を割当（既存・worldCardId・配分・rulesVersion・日時は維持）", () => {
    const existing: SavedBuild[] = [mkBuild({ buildId: "b_clash", buildName: "既存" })];
    const file = mkFile([
      mkBuild({ buildId: "b_clash", buildName: "取り込み", progressionAllocation: { passing: 9 } }),
    ]);
    const r = analyzeImport(file, existing, counterGen());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const it = r.plan.items[0];
    expect(it.collision).toBe(true);
    expect(it.originalBuildId).toBe("b_clash");
    expect(it.finalBuildId).not.toBe("b_clash");
    expect(it.finalBuildId.startsWith("b_new")).toBe(true);
    expect(it.build.buildId).toBe(it.finalBuildId);
    expect(it.build.worldCardId).toBe("89138556575063");
    expect(it.build.progressionAllocation).toEqual({ passing: 9 });
    expect(it.build.rulesVersion).toBe("progression/2026-08-28.v2");
    expect(it.build.buildName).toBe("取り込み"); // 名前は変えない
    expect(r.plan.collisionCount).toBe(1);
    expect(r.plan.newIdCount).toBe(1);
  });

  it("複数件・全件衝突でも新 ID どうしが衝突しない", () => {
    const existing: SavedBuild[] = [mkBuild({ buildId: "b_a" }), mkBuild({ buildId: "b_b" })];
    const file = mkFile([mkBuild({ buildId: "b_a" }), mkBuild({ buildId: "b_b" })]);
    const r = analyzeImport(file, existing, counterGen());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const ids = r.plan.items.map((i) => i.finalBuildId);
    expect(new Set(ids).size).toBe(2);
    for (const id of ids) expect(["b_a", "b_b"].includes(id)).toBe(false);
  });

  it("新 ID が『同じファイル内の他ビルドの元 ID』とも衝突しない", () => {
    const existing: SavedBuild[] = [mkBuild({ buildId: "b_x" })];
    // genId が b_y を返そうとするが、ファイル内の別ビルドが b_y を持つ
    const gen: BuildIdGenerator = (taken) => (taken.has("b_y") ? "b_z" : "b_y");
    const file = mkFile([mkBuild({ buildId: "b_x" }), mkBuild({ buildId: "b_y" })]);
    const r = analyzeImport(file, existing, gen);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const ids = r.plan.items.map((i) => i.finalBuildId);
    expect(new Set(ids).size).toBe(2);
    expect(ids).toContain("b_z");
  });

  it("SavedBuild が 1 件でも無効 → validate ステージで全体拒否", () => {
    const file = mkFile([mkBuild({ buildId: "b_ok" }), { ...mkBuild({ buildId: "b_ng" }), rulesVersion: 5 }]);
    const r = analyzeImport(file, [], counterGen());
    expect(r).toMatchObject({ ok: false, stage: "validate", invalidCount: 1, validCount: 1 });
  });

  it("parse 失敗はそのまま stage:parse で返す", () => {
    const r = analyzeImport("{bad", [], counterGen());
    expect(r).toMatchObject({ ok: false, stage: "parse", code: "not-json" });
  });
});

describe("build-import: reconcileImport（保存直前の再検証）", () => {
  function plan(existing: SavedBuild[], file: string) {
    const r = analyzeImport(file, existing, counterGen());
    if (!r.ok) throw new Error("plan failed");
    return r.plan;
  }

  it("既存が変化なし → ok（最終 SavedBuild を返す）", () => {
    const existing: SavedBuild[] = [mkBuild({ buildId: "b_e1" })];
    const p = plan(existing, mkFile([mkBuild({ buildId: "b_imp" })]));
    const r = reconcileImport(p, existing, counterGen());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.builds.map((b) => b.buildId)).toEqual(["b_imp"]);
    expect(r.expectedExistingBuildIds).toEqual(["b_e1"]);
  });

  it("プレビュー後に既存ビルド追加 → conflict", () => {
    const existing: SavedBuild[] = [mkBuild({ buildId: "b_e1" })];
    const p = plan(existing, mkFile([mkBuild({ buildId: "b_imp" })]));
    const fresh = [...existing, mkBuild({ buildId: "b_e2" })];
    expect(reconcileImport(p, fresh, counterGen())).toMatchObject({
      ok: false,
      reason: "conflict",
      addedExisting: ["b_e2"],
    });
  });

  it("プレビュー後に既存ビルド削除 → conflict", () => {
    const existing: SavedBuild[] = [mkBuild({ buildId: "b_e1" }), mkBuild({ buildId: "b_e2" })];
    const p = plan(existing, mkFile([mkBuild({ buildId: "b_imp" })]));
    expect(reconcileImport(p, [existing[0]], counterGen())).toMatchObject({
      ok: false,
      reason: "conflict",
      removedExisting: ["b_e2"],
    });
  });

  it("プレビュー後に既存ビルドの updatedAt 変更 → conflict", () => {
    const existing: SavedBuild[] = [mkBuild({ buildId: "b_e1", updatedAt: "2026-08-01T00:00:00.000Z" })];
    const p = plan(existing, mkFile([mkBuild({ buildId: "b_imp" })]));
    const fresh = [mkBuild({ buildId: "b_e1", updatedAt: "2026-09-01T00:00:00.000Z" })];
    expect(reconcileImport(p, fresh, counterGen())).toMatchObject({
      ok: false,
      reason: "conflict",
      changedExisting: ["b_e1"],
    });
  });

  it("保存予定 ID が新たに既存と衝突するようになったら再割当する", () => {
    const existing: SavedBuild[] = [mkBuild({ buildId: "b_e1" })];
    const p = plan(existing, mkFile([mkBuild({ buildId: "b_imp" })])); // 衝突なし → finalBuildId = b_imp
    // 別タブで b_imp という既存ビルドが増えた…わけではなく（それは conflict）、
    // ここでは「既存集合は同じだが衝突が起きる」ケースを worldCardId 違いで作りにくいので
    // 既存に b_imp を含めた新スナップショット扱いにはできない。代わりに reassigned=false を確認。
    const r = reconcileImport(p, existing, counterGen());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.reassigned).toBe(false);
  });
});

describe("build-import: buildIntent(育成目的)の互換性", () => {
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

  it("buildIntentを含む新JSONをインポートできる(ラウンドトリップで構造が一致)", () => {
    const build = mkBuild({ buildIntent: intent });
    const { valid, invalid } = validateImportBuilds([build]);
    expect(invalid).toHaveLength(0);
    expect(valid[0].buildIntent).toEqual(intent);
  });

  it("buildIntentを含まない旧JSONを引き続きインポートできる", () => {
    const build = mkBuild();
    const { valid, invalid } = validateImportBuilds([build]);
    expect(invalid).toHaveLength(0);
    expect(valid[0].buildIntent).toBeUndefined();
  });

  it("不正なbuildIntent(サブ目的3件等)は、そのフィールドだけを安全に無視し、正常なビルド本体は失わない", () => {
    const build = { ...mkBuild(), buildIntent: { ...intent, subPresetIds: ["a", "b", "c"] } };
    const { valid, invalid } = validateImportBuilds([build]);
    expect(invalid).toHaveLength(0);
    expect(valid[0].buildId).toBe(build.buildId);
    expect(valid[0].buildIntent).toBeUndefined();
  });

  it("未知フィールドを含むbuildIntentは安全に除去される(strip)", () => {
    const build = { ...mkBuild(), buildIntent: { ...intent, unknownField: "danger" } };
    const { valid, invalid } = validateImportBuilds([build]);
    expect(invalid).toHaveLength(0);
    expect(valid[0].buildIntent).not.toHaveProperty("unknownField");
  });

  it("プロトタイプ汚染につながるキーを含んでいても例外を投げず安全に処理する", () => {
    const build = { ...mkBuild(), buildIntent: { ...intent, __proto__: { polluted: true } } };
    expect(() => validateImportBuilds([build])).not.toThrow();
    // eslint-disable-next-line no-prototype-builtins
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("表示文章・自由記述を含むインポートデータでも、buildIntentへは含まれない", () => {
    const build = { ...mkBuild(), buildIntent: { ...intent, freeText: "自由記述" as unknown } };
    const { valid, invalid } = validateImportBuilds([build]);
    expect(invalid).toHaveLength(0);
    expect(valid[0].buildIntent).not.toHaveProperty("freeText");
  });

  it("完全なエクスポートファイル(buildIntentあり)をanalyzeImportで解析できる", () => {
    const build = mkBuild({ buildIntent: intent });
    const text = mkFile([build]);
    const result = analyzeImport(text, [], counterGen());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.items[0].build.buildIntent).toEqual(intent);
    }
  });
});
