import { describe, it, expect } from "vitest";
// 監査ロジックは scripts 配下の依存ゼロ純モジュール（ランナーと共有）。
import {
  scanSource,
  scanDynamicNameEn,
  checkDictionary,
  parseLabelMap,
  stripBlockComments,
  stripLineComment,
  isAllowlisted,
  isExcludedFile,
  countAllowedTitleMentions,
  validateAllowlistEntry,
  isAllowlistEntryStale,
  ALLOWLIST,
  KNOWN_RULES,
  STAT_NAMES_EN,
  CATEGORY_NAMES_EN,
  AUDIT_DIRS,
} from "../../../scripts/lib/ja-label-audit.mjs";
import pkg from "../../../package.json";
import {
  STAT_LABEL_JA,
  GROUP_LABEL_JA,
  RADAR_AXIS_LABEL_JA,
  BUILD_MODE_LABEL_JA,
} from "./stat-labels";
import { WORLD_STAT_KEYS } from "./stats";
import { PROGRESSION_GROUP_IDS } from "@/lib/progression/stat-groups";
import { COMPARE_CATEGORIES } from "@/lib/comparison/categories";

describe("scanSource: JSX 主表示の英語能力値／育成カテゴリを検出", () => {
  it("JSX テキストノードの英語能力値名を検出（複数語）", () => {
    const v = scanSource("src/components/x.tsx", `      <dt>Offensive Awareness</dt>\n`);
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ file: "src/components/x.tsx", line: 1, name: "Offensive Awareness" });
  });

  it("JSX テキストノードの英語能力値名を検出（1 語・厳密 >Speed<）", () => {
    const v = scanSource("src/components/x.tsx", `<span>Speed</span>`);
    expect(v.map((x) => x.name)).toEqual(["Speed"]);
  });

  it("英語育成カテゴリ名を検出", () => {
    const v = scanSource("src/components/x.tsx", `        <h3>Lower Body Strength</h3>`);
    expect(v.map((x) => x.name)).toEqual(["Lower Body Strength"]);
  });

  it("title 属性の英語併記は許可（検出しない）", () => {
    expect(scanSource("src/components/x.tsx", `<dt title="Offensive Awareness">{statLabelJa(s.key)}</dt>`)).toEqual([]);
    expect(scanSource("src/components/x.tsx", "<span title={`Set Piece Taking`}>{jp}</span>")).toEqual([]);
  });

  it("nameEn 定義は許可（検出しない）", () => {
    expect(scanSource("src/components/x.tsx", `  nameEn: "Offensive Awareness",`)).toEqual([]);
    expect(scanSource("src/components/x.tsx", `  const nameEn = "Ball Control";`)).toEqual([]);
  });

  it("内部 stat key（camelCase）は検出しない", () => {
    expect(scanSource("src/components/x.tsx", `  const k = "offensiveAwareness";`)).toEqual([]);
    expect(scanSource("src/components/x.tsx", `  <Foo statKey="setPieceTaking" />`)).toEqual([]);
  });

  it("{式} は文字列リテラルではないため検出しない（{b.nameEn} 等）", () => {
    expect(scanSource("src/components/x.tsx", `        <option>{b.nameEn}</option>`)).toEqual([]);
    expect(scanSource("src/components/x.tsx", `        <span>{statLabelJa(s.key)}</span>`)).toEqual([]);
  });

  it("import / export / type / interface 行は検出しない", () => {
    expect(scanSource("src/components/x.tsx", `import { Shooting } from "./x";`)).toEqual([]);
    expect(scanSource("src/components/x.tsx", `type Passing = string;`)).toEqual([]);
  });

  it("行コメント・ブロックコメントは検出しない", () => {
    expect(scanSource("src/components/x.tsx", `  // Offensive Awareness を表示する`)).toEqual([]);
    expect(scanSource("src/components/x.tsx", `<div>{/* Ball Control */}</div>`)).toEqual([]);
    expect(scanSource("src/components/x.tsx", `/* Set Piece Taking */\n<div>ok</div>`)).toEqual([]);
  });

  it("テストの否定検査行は検出しない", () => {
    expect(
      scanSource("src/components/x.tsx", `    expect(html).not.toContain(">Offensive Awareness<");`),
    ).toEqual([]);
  });

  it("*.test.tsx / *.spec.tsx は丸ごと対象外", () => {
    expect(scanSource("src/components/x.test.tsx", `<dt>Offensive Awareness</dt>`)).toEqual([]);
    expect(scanSource("src/components/x.spec.tsx", `<dt>Ball Control</dt>`)).toEqual([]);
  });

  it(".ts / .mjs / .md は対象外（JSX ではない）", () => {
    expect(scanSource("src/lib/x.ts", `const label = "Offensive Awareness";`)).toEqual([]);
    expect(scanSource("scripts/x.mjs", `"Offensive Awareness"`)).toEqual([]);
    expect(scanSource("docs/x.md", `Offensive Awareness`)).toEqual([]);
  });

  it("title 以外のアクセシブル属性の英語は検出（aria-label）", () => {
    const v = scanSource("src/components/x.tsx", `  <input aria-label="Ball Control" />`);
    expect(v.map((x) => x.name)).toEqual(["Ball Control"]);
  });

  it("KONAMI ブースター名は {式} で描画されるため検出しない", () => {
    // 実アプリは <option>{b.nameEn}</option> 形式。リテラルの "Shooting" 単独は稀。
    expect(scanSource("src/components/x.tsx", `        {CONFIRMED_BOOSTERS.map((b) => (<option key={b.key}>{b.nameEn}</option>))}`)).toEqual([]);
  });

  it("英語選手名（>Lionel Messi< 等）は能力値名リストに無いので検出しない", () => {
    expect(scanSource("src/components/x.tsx", `<p>Lionel Messi</p>`)).toEqual([]);
  });

  it("複数違反・重複違反を行番号付きで返す", () => {
    const src = [
      `<dt>Offensive Awareness</dt>`,
      `<dt>Ball Control</dt>`,
      `<dd>Offensive Awareness</dd>`,
    ].join("\n");
    const v = scanSource("src/components/x.tsx", src);
    expect(v).toHaveLength(3);
    expect(v.map((x) => x.line)).toEqual([1, 2, 3]);
  });

  it("空ファイル・空行で落ちない", () => {
    expect(scanSource("src/components/x.tsx", "")).toEqual([]);
    expect(scanSource("src/components/x.tsx", "\n\n\n")).toEqual([]);
  });

  it("UTF-8 日本語混在で落ちない", () => {
    expect(scanSource("src/components/x.tsx", `<span>オフェンスセンス（Offensive Awareness）</span>`).length).toBe(1);
    expect(scanSource("src/components/x.tsx", `<span title="Offensive Awareness">オフェンスセンス</span>`)).toEqual([]);
  });
});

describe("scanDynamicNameEn: JSX 子要素の {stat.nameEn} 直接表示を検出", () => {
  const one = (src: string) => scanDynamicNameEn("src/components/x.tsx", src);

  it("単一行 <span>{stat.nameEn}</span> を検出", () => {
    const v = one(`<span>{stat.nameEn}</span>`);
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ line: 1, name: "{stat.nameEn}", rule: "dynamic-name-en-child" });
  });
  it("<div>{group.nameEn}</div> / <td>{s.nameEn}</td> / <option>{item.nameEn}</option>", () => {
    expect(one(`<div>{group.nameEn}</div>`).map((x) => x.name)).toEqual(["{group.nameEn}"]);
    expect(one(`<td>{s.nameEn}</td>`).map((x) => x.name)).toEqual(["{s.nameEn}"]);
    expect(one(`<option>{item.nameEn}</option>`).map((x) => x.name)).toEqual(["{item.nameEn}"]);
  });
  it("空白を含む式 { stat.nameEn } も検出", () => {
    expect(one(`<span>{ stat.nameEn }</span>`)).toHaveLength(1);
  });
  it("限定的な複数行 JSX を検出", () => {
    const v = one(["<span>", "  {stat.nameEn}", "</span>"].join("\n"));
    expect(v).toHaveLength(1);
    expect(v[0].line).toBe(2);
  });
  it("title={stat.nameEn} は属性なので検出しない", () => {
    expect(one(`<dt title={stat.nameEn}>{statLabelJa(stat.key)}</dt>`)).toEqual([]);
  });
  it("aria-label={statLabelJa(stat.key)} は検出しない（nameEn 式ではない）", () => {
    expect(one(`<button aria-label={statLabelJa(stat.key)}>+</button>`)).toEqual([]);
  });
  it("変数代入 const value = stat.nameEn は検出しない", () => {
    expect(one(`  const value = stat.nameEn;`)).toEqual([]);
  });
  it("return オブジェクト return { nameEn: stat.nameEn } は検出しない", () => {
    expect(one(`  return { nameEn: stat.nameEn };`)).toEqual([]);
  });
  it("console.log(stat.nameEn) は検出しない", () => {
    expect(one(`  console.log(stat.nameEn);`)).toEqual([]);
    expect(one(`<div>{console.log(stat.nameEn)}</div>`)).toEqual([]);
  });
  it("受け手が固有名詞（booster/manager/player）は検出しない", () => {
    expect(one(`<option>{b.nameEn}</option>`)).toEqual([]);
    expect(one(`<p>{manager.nameEn}</p>`)).toEqual([]);
    expect(one(`<h3>{detail.nameEn}</h3>`)).toEqual([]);
    expect(one(`<span>{d.nameEn}</span>`)).toEqual([]);
  });
  it("{x.nameEn || fallback} / {x.nameEn ?? y} は「単純」ではないので検出しない", () => {
    expect(one(`<p>{stat.nameEn || "（なし）"}</p>`)).toEqual([]);
    expect(one(`<p>{s.nameEn ?? "-"}</p>`)).toEqual([]);
  });
  it("コメント・import・テストは検出しない", () => {
    expect(one(`  // <span>{stat.nameEn}</span>`)).toEqual([]);
    expect(one(`<div>{/* {stat.nameEn} */}</div>`)).toEqual([]);
    expect(one(`import { stat } from "./x";`)).toEqual([]);
    expect(scanDynamicNameEn("src/components/x.test.tsx", `<span>{stat.nameEn}</span>`)).toEqual([]);
  });
  it(".ts / .md は対象外", () => {
    expect(scanDynamicNameEn("src/lib/x.ts", `<span>{stat.nameEn}</span>`)).toEqual([]);
  });
  it("GroupRow.tsx の {group.nameEn} は allowlisted フラグが付く", () => {
    const v = scanDynamicNameEn(
      "src/components/world/progression/GroupRow.tsx",
      ["<p>", "  {group.nameEn}", "</p>"].join("\n"),
    );
    expect(v).toHaveLength(1);
    expect(v[0].allowlisted).toBe(true);
  });
});

describe("allowlist: 構造検証と stale 検出", () => {
  const groupRowEntry = ALLOWLIST.find((a) => a.file.endsWith("GroupRow.tsx"))!;

  it("ALLOWLIST は GroupRow の 1 件のみ", () => {
    expect(ALLOWLIST).toHaveLength(1);
    expect(groupRowEntry.rule).toBe("dynamic-name-en-child");
    expect(groupRowEntry.expression).toBe("{group.nameEn}");
  });
  it("現行の GroupRow エントリは構造問題ゼロ", () => {
    expect(validateAllowlistEntry(groupRowEntry)).toEqual([]);
  });
  it("絶対パス・.. ・非相対を拒否", () => {
    expect(validateAllowlistEntry({ ...groupRowEntry, file: "C:/x/GroupRow.tsx" }).length).toBeGreaterThan(0);
    expect(validateAllowlistEntry({ ...groupRowEntry, file: "src/../GroupRow.tsx" }).length).toBeGreaterThan(0);
    expect(validateAllowlistEntry({ ...groupRowEntry, file: "src\\a\\GroupRow.tsx" }).length).toBeGreaterThan(0);
  });
  it("監査対象外ディレクトリ・非単一ファイルを拒否", () => {
    expect(validateAllowlistEntry({ ...groupRowEntry, file: "other/x.tsx" }).length).toBeGreaterThan(0);
    expect(validateAllowlistEntry({ ...groupRowEntry, file: "src/components" }).some((p) => p.includes("単一"))).toBe(true);
  });
  it("未知の rule を拒否", () => {
    expect(validateAllowlistEntry({ ...groupRowEntry, rule: "made-up" }).some((p) => p.includes("rule"))).toBe(true);
  });
  it("空の expression（file だけの広い除外）を拒否", () => {
    expect(validateAllowlistEntry({ ...groupRowEntry, expression: "" }).some((p) => p.includes("expression"))).toBe(true);
  });
  it("空／短すぎる reason を拒否", () => {
    expect(validateAllowlistEntry({ ...groupRowEntry, reason: "" }).some((p) => p.includes("reason"))).toBe(true);
    expect(validateAllowlistEntry({ ...groupRowEntry, reason: "短い" }).some((p) => p.includes("reason"))).toBe(true);
  });
  it("KNOWN_RULES に dynamic-name-en-child を含む", () => {
    expect(KNOWN_RULES).toContain("dynamic-name-en-child");
  });
  it("stale 検出: 式がある内容→false / 式が無い内容→true / null→true", () => {
    expect(isAllowlistEntryStale(groupRowEntry, `<p>\n  {group.nameEn}\n</p>`)).toBe(false);
    expect(isAllowlistEntryStale(groupRowEntry, `<p>{groupLabelJa(group.groupId)}</p>`)).toBe(true);
    expect(isAllowlistEntryStale(groupRowEntry, null)).toBe(true);
  });
});

describe("npm run verify（ローカル複合品質コマンド）", () => {
  const scripts = (pkg as { scripts: Record<string, string> }).scripts;
  it("verify が存在し audit:ja-labels / typecheck / lint / test を含む", () => {
    expect(scripts.verify).toBeTruthy();
    for (const s of ["audit:ja-labels", "typecheck", "lint", "test"]) {
      expect(scripts.verify).toContain(`npm run ${s}`);
    }
  });
  it("verify は build を含まない", () => {
    expect(scripts.verify).not.toContain("build");
  });
  it("実行順序は audit → typecheck → lint → test", () => {
    const idx = ["audit:ja-labels", "typecheck", "lint", "test"].map((s) => scripts.verify.indexOf(`npm run ${s}`));
    expect(idx.every((i) => i >= 0)).toBe(true);
    expect(idx).toEqual([...idx].sort((a, b) => a - b));
  });
  it("エラーを握りつぶさない（|| true / exit 0 強制なし）", () => {
    expect(scripts.verify).not.toMatch(/\|\|\s*true/);
    expect(scripts.verify).not.toMatch(/exit\s+0/);
    expect(scripts.verify).not.toMatch(/SilentlyContinue/);
  });
  it("&& 連結のみ（PowerShell / bash 専用構文なし）", () => {
    expect(scripts.verify).toMatch(/^npm run [\w:-]+( && npm run [\w:-]+)+$/);
  });
  it("既存 script は不変", () => {
    expect(scripts.dev).toBe("next dev");
    expect(scripts.build).toBe("next build");
    expect(scripts.start).toBe("next start");
    expect(scripts.lint).toBe("next lint");
    expect(scripts.typecheck).toBe("tsc --noEmit");
    expect(scripts.test).toBe("vitest run");
    expect(scripts["audit:ja-labels"]).toBe("node scripts/audit-ja-stat-labels.mjs");
  });
});

describe("checkDictionary: 表示辞書の完全性", () => {
  const base = () => ({
    statLabels: { ...STAT_LABEL_JA },
    groupLabels: { ...GROUP_LABEL_JA },
    radarAxisLabels: { ...RADAR_AXIS_LABEL_JA },
    buildModeLabels: { ...BUILD_MODE_LABEL_JA },
    statKeys: [...WORLD_STAT_KEYS],
    groupIds: [...PROGRESSION_GROUP_IDS],
    radarAxisIds: COMPARE_CATEGORIES.map((c) => c.id),
    buildModeValues: ["none", "attack", "defense", "balance", "gk"],
  });

  it("現行の辞書は問題ゼロ", () => {
    expect(checkDictionary(base())).toEqual([]);
  });

  it("キー未登録を検出", () => {
    const i = base();
    delete (i.statLabels as Record<string, string>).finishing;
    expect(checkDictionary(i).some((p) => p.includes("キー未登録") && p.includes("finishing"))).toBe(true);
  });

  it("空ラベルを検出", () => {
    const i = base();
    (i.groupLabels as Record<string, string>).shooting = "  ";
    expect(checkDictionary(i).some((p) => p.includes("空ラベル"))).toBe(true);
  });

  it("HTML 様の文字を検出", () => {
    const i = base();
    (i.statLabels as Record<string, string>).finishing = "<b>決定力</b>";
    expect(checkDictionary(i).some((p) => p.includes("不正な文字"))).toBe(true);
  });

  it("英語 fallback のまま（value === key）を検出", () => {
    const i = base();
    (i.statLabels as Record<string, string>).finishing = "finishing";
    expect(checkDictionary(i).some((p) => p.includes("fallback"))).toBe(true);
  });

  it("意図しない日本語ラベル重複を検出", () => {
    const i = base();
    (i.statLabels as Record<string, string>).finishing = i.statLabels.heading;
    expect(checkDictionary(i).some((p) => p.includes("日本語ラベル重複"))).toBe(true);
  });

  it("余分なキーを検出", () => {
    const i = base();
    (i.statLabels as Record<string, string>).madeUpStat = "架空";
    expect(checkDictionary(i).some((p) => p.includes("余分なキー"))).toBe(true);
  });

  it("能力値 dribbling と 育成カテゴリ dribbling がどちらも「ドリブル」でも問題にしない", () => {
    expect(checkDictionary(base())).toEqual([]);
    expect(STAT_LABEL_JA.dribbling).toBe("ドリブル");
    expect(GROUP_LABEL_JA.dribbling).toBe("ドリブル");
  });
});

describe("parseLabelMap", () => {
  it("stat-labels.ts 形式の const オブジェクトを {key:値} へ", () => {
    const text = [
      `export const FOO_JA: Record<string, string> = {`,
      `  alpha: "アルファ",`,
      `  "beta-2": "ベータ",`,
      `};`,
    ].join("\n");
    expect(parseLabelMap(text, "FOO_JA")).toEqual({ alpha: "アルファ", "beta-2": "ベータ" });
  });
  it("見つからなければ null", () => {
    expect(parseLabelMap(`const OTHER = {};`, "FOO_JA")).toBeNull();
  });
});

describe("補助関数", () => {
  it("stripBlockComments は行番号を保つ", () => {
    const out = stripBlockComments("a\n/* x\ny */\nb");
    expect(out.split("\n")).toHaveLength(4);
    expect(out.split("\n")[3]).toBe("b");
  });
  it("stripLineComment", () => {
    expect(stripLineComment(`const a = 1; // Ball Control`)).toBe("const a = 1; ");
  });
  it("isExcludedFile: 機密メモを先頭一致で除外", () => {
    expect(isExcludedFile("claude-master-prompt.txt")).toBe(true);
    expect(isExcludedFile("千鳥 打合せメモ　20260829.txt")).toBe(true);
    expect(isExcludedFile("PlayerCard.tsx")).toBe(false);
  });
  it("isAllowlisted: 現状 allowlist は空", () => {
    expect(isAllowlisted("src/components/x.tsx", 1, "Speed")).toBe(false);
  });
  it("countAllowedTitleMentions", () => {
    expect(countAllowedTitleMentions("x.tsx", `<i title="Ball Control">ボールコントロール</i>`)).toBe(1);
    expect(countAllowedTitleMentions("x.tsx", `<i>Ball Control</i>`)).toBe(0);
  });
});

describe("監査対象の宣言", () => {
  it("STAT_NAMES_EN は 26 / CATEGORY_NAMES_EN は 10", () => {
    expect(STAT_NAMES_EN).toHaveLength(26);
    expect(CATEGORY_NAMES_EN).toHaveLength(10);
  });
  it("AUDIT_DIRS は src / scripts / docs を含みワークスペース相対のみ", () => {
    expect(AUDIT_DIRS).toContain("src/components");
    for (const d of AUDIT_DIRS) {
      expect(d.startsWith("/")).toBe(false);
      expect(d.includes("..")).toBe(false);
      expect(d.includes(":")).toBe(false);
    }
  });
});
