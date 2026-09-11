/**
 * 日本語表記回帰監査 — 純ロジック（読み取り専用・依存ゼロ・ファイルを書き換えない）。
 *
 * 目的:
 *   選手詳細・比較・スカッド等のユーザー向け JSX 本文へ、英語の能力値名／育成カテゴリ名が
 *   「主表示」として再混入していないかを、構文解析なしの保守的な行スキャンで検出する。
 *   （title 属性への英語併記・内部 stat key / groupId・KONAMI ブースター名・英語選手名などは許可。）
 *
 * 2 種類の検出:
 *   1. 静的リテラル（rule A/B/C）: JSX テキスト / アクセシブル属性に英語能力値名の文字列。
 *   2. 動的式（rule dynamic-name-en-child）: JSX 子要素で {stat.nameEn} 等を直接描画。
 *
 * 使い方:
 *   scripts/audit-ja-stat-labels.mjs から import。テストは src/lib/world/ja-label-audit.test.ts。
 *   この 2 ファイル以外からは import しない（監査専用の内部モジュール）。
 *
 * このモジュールは fs / net を一切使わない。走査・出力・exit code はランナー側の責務。
 */

/** 26 能力値の英語表示名（src/lib/world/stats.ts の nameEn と一致）。 */
export const STAT_NAMES_EN = Object.freeze([
  "Offensive Awareness", "Ball Control", "Dribbling", "Tight Possession",
  "Low Pass", "Lofted Pass", "Finishing", "Heading", "Set Piece Taking", "Curl",
  "Defensive Awareness", "Tackling", "Aggression", "Defensive Engagement",
  "GK Awareness", "GK Catching", "GK Parrying", "GK Reflexes", "GK Reach",
  "Speed", "Acceleration", "Kicking Power", "Jumping", "Physical Contact",
  "Balance", "Stamina",
]);

/** 10 育成カテゴリの英語名（src/lib/progression/stat-groups.ts の nameEn と一致）。 */
export const CATEGORY_NAMES_EN = Object.freeze([
  "Shooting", "Passing", "Dribbling", "Dexterity", "Lower Body Strength",
  "Aerial Strength", "Defending", "Goalkeeping 1", "Goalkeeping 2", "Goalkeeping 3",
]);

/** 監査で走査するディレクトリ（ワークスペース相対）。 */
export const AUDIT_DIRS = Object.freeze([
  "src/app",
  "src/components",
  "src/lib",
  "scripts",
  "docs",
]);

/** 開かないディレクトリ（生成物・依存・機密・CLAUDE.md 除外）。 */
export const EXCLUDE_DIRS = Object.freeze([
  "node_modules", ".next", ".git", "coverage", "dist", "out",
  "screenshots", // CLAUDE.md 除外
]);

/**
 * 開かないファイル（CLAUDE.md 除外・機密メモ）。`isExcludedFile` で先頭一致も見る。
 * 監査は .tsx / .jsx しか読まないためこれらの .txt は元々読まれないが、明示しておく。
 */
export const EXCLUDE_FILES = Object.freeze([
  "claude-master-prompt.txt",
  "research.txt",
]);

/** CLAUDE.md 除外ファイルか（機密メモの表記ゆれに備えて先頭一致も見る）。 */
export function isExcludedFile(name) {
  if (EXCLUDE_FILES.includes(name)) return true;
  if (name.startsWith("千鳥") && name.endsWith(".txt")) return true;
  return false;
}

/** 監査で使う既知ルール名（allowlist の rule はこの中でなければならない）。 */
export const KNOWN_RULES = Object.freeze([
  "A:JSXテキスト",
  "B:JSXテキスト厳密",
  "C:アクセシブル属性",
  "dynamic-name-en-child",
]);

/**
 * dynamic-name-en-child が対象とする受け手（能力値・育成カテゴリを指す慣用名）。
 * ブースター（b / a / r）・監督（manager / detail）・選手やカード表示（player / card / d 等）の
 * nameEn は固有名詞であり英語表示可なので、ここに**含めない** = 検出しない。
 */
export const STAT_NAME_EN_RECEIVERS = Object.freeze([
  "stat", "stats", "s",
  "group", "groups", "g",
  "item", "def", "statDef", "groupDef",
]);

/**
 * 恒久的に許可する行（誤検出への最小限の例外）。理由を必ず書く。
 * 形式: { file, rule, expression, reason, reviewWhen, line? }
 *   - 行番号 line は任意（壊れやすいので基本使わない）。file + rule + expression で照合。
 *   - file だけの広い除外は禁止（validateAllowlistEntry が拒否する）。
 */
export const ALLOWLIST = Object.freeze([
  {
    file: "src/components/world/progression/GroupRow.tsx",
    rule: "dynamic-name-en-child",
    expression: "{group.nameEn}",
    reason:
      "未使用のデッドコードだが、既存の安全方針により変更・削除禁止。現在の画面から到達しないことを確認済み。再利用または表示経路追加時に日本語化（groupLabelJa）が必要。",
    reviewWhen:
      "GroupRow.tsx がいずれかの画面／コンポーネントから import・描画されたとき、または GroupRow.tsx が削除されたとき。",
  },
]);

const ALL_NAMES = [...STAT_NAMES_EN, ...CATEGORY_NAMES_EN]
  .filter((v, i, a) => a.indexOf(v) === i)
  .sort((a, b) => b.length - a.length);

// タブ (09) / 改行 (0A,0D) 以外の C0 制御文字 + DEL。リテラル制御文字を書かないため new RegExp。
const CONTROL_CHARS = new RegExp("[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]");

/** ブロックコメントを空白へ（行番号は維持）。 */
export function stripBlockComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

/** 行内の `//` コメント以降を素朴に除去（監査の保守的側へ倒す）。 */
export function stripLineComment(line) {
  const i = line.indexOf("//");
  return i >= 0 ? line.slice(0, i) : line;
}

function isBoundaryChar(ch) {
  return ch === undefined || !/[A-Za-z]/.test(ch);
}

/** relPath / lineNo / name / rule が ALLOWLIST に一致するか。 */
export function isAllowlisted(relPath, lineNo, name, rule) {
  return ALLOWLIST.some(
    (a) =>
      a.file === relPath &&
      (a.rule === undefined || a.rule === rule) &&
      (a.expression === undefined || a.expression === name) &&
      (a.line === undefined || a.line === lineNo),
  );
}

/**
 * 1 ファイル分の静的リテラル違反を返す。.tsx / .jsx 以外、および *.test.* / *.spec.* は空配列。
 * @param {string} relPath ワークスペース相対パス（"/" 区切り）
 * @param {string} content ファイル内容（UTF-8）
 * @returns {{file:string,line:number,name:string,rule:string,excerpt:string}[]}
 */
export function scanSource(relPath, content) {
  if (!/\.(t|j)sx$/.test(relPath)) return [];
  if (/\.(test|spec)\.(t|j)sx$/.test(relPath)) return [];

  const out = [];
  const lines = stripBlockComments(content).split(/\r?\n/);

  for (let li = 0; li < lines.length; li++) {
    const lineNo = li + 1;
    const line = stripLineComment(lines[li]);
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^(import|export)\b/.test(trimmed)) continue;
    if (/^(type|interface|enum)\s/.test(trimmed)) continue;
    // テストの否定検査など（保険。*.test.tsx は既に除外済み）
    if (/\b(expect|toContain|toMatch|toEqual)\b|\bit\(|\bdescribe\(/.test(line)) continue;

    for (const name of ALL_NAMES) {
      let from = 0;
      let idx;
      while ((idx = line.indexOf(name, from)) !== -1) {
        from = idx + name.length;
        if (!isBoundaryChar(line[idx - 1]) || !isBoundaryChar(line[idx + name.length])) continue;

        const pre = line.slice(0, idx);
        const post = line.slice(idx + name.length);

        // --- 許可コンテキスト ---
        // title 属性 / prop（英語併記 OK）
        if (/\btitle\s*[:=]\s*(\{\s*[`"']|[`"'])[^`"']*$/.test(pre)) continue;
        // nameEn 定義（既存 World / booster データ）
        if (/\bnameEn\s*[:=]\s*[`"'][^`"']*$/.test(pre)) continue;

        const hasSpace = /\s/.test(name);
        let rule = null;

        // Rule A: JSX テキストノード（複数語）: >…NAME…<
        if (hasSpace && /(^|>)[^<>]*$/.test(pre) && /^[^<>]*</.test(post)) {
          rule = "A:JSXテキスト";
        }
        // Rule B: JSX テキストノード（1 語・厳密）: >NAME<
        else if (!hasSpace && />\s*$/.test(pre) && /^\s*</.test(post)) {
          rule = "B:JSXテキスト厳密";
        }
        // Rule C: title 以外のユーザー向け属性
        else if (
          /\b(aria-label|aria-valuetext|aria-description|placeholder|alt)\s*=\s*(\{\s*[`"']|[`"'])[^`"']*$/.test(pre)
        ) {
          rule = "C:アクセシブル属性";
        }

        if (!rule) continue;
        if (isAllowlisted(relPath, lineNo, name, rule)) continue;

        out.push({
          file: relPath,
          line: lineNo,
          name,
          rule,
          excerpt: trimmed.length > 120 ? trimmed.slice(0, 117) + "…" : trimmed,
        });
      }
    }
  }
  return out;
}

/**
 * JSX 子要素で `{stat.nameEn}` 等を直接描画している箇所を「ユーザー向け英語表示候補」として返す。
 * 「確定違反」ではなく候補（未許可で残ると exit 1）。
 *
 * 対象: `{<受け手>.nameEn}` が JSX 子要素位置にあり、受け手が STAT_NAME_EN_RECEIVERS のもの。
 * 非対象: `title={x.nameEn}` などの属性、`const v = x.nameEn`、`return { nameEn: x.nameEn }`、
 *         `console.log(x.nameEn)`、テンプレートリテラル内、`{x.nameEn || ...}` / `{x.nameEn ?? ...}`、
 *         受け手が b/a/manager/player/card などの固有名詞、コメント、import/export、テスト。
 *
 * @returns {{file:string,line:number,name:string,rule:string,excerpt:string,allowlisted:boolean}[]}
 */
export function scanDynamicNameEn(relPath, content) {
  if (!/\.(t|j)sx$/.test(relPath)) return [];
  if (/\.(test|spec)\.(t|j)sx$/.test(relPath)) return [];

  const lines = stripBlockComments(content).split(/\r?\n/).map(stripLineComment);
  const out = [];
  const exprRe = /\{\s*([A-Za-z_$][\w$]*)\s*\.\s*nameEn\s*\}/g;

  const prevNonEmpty = (i) => {
    for (let j = i - 1; j >= 0; j--) if (lines[j].trim()) return lines[j].trim();
    return "";
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    if (/^(import|export)\b/.test(line.trim())) continue;
    if (/\b(expect|toContain|toMatch|toEqual)\b|\bit\(|\bdescribe\(/.test(line)) continue;

    exprRe.lastIndex = 0;
    let m;
    while ((m = exprRe.exec(line)) !== null) {
      const receiver = m[1];
      if (!STAT_NAME_EN_RECEIVERS.includes(receiver)) continue;

      const pre = line.slice(0, m.index);
      // 属性値（title={...} / aria-label={...} 等）
      if (/[A-Za-z][\w-]*\s*=\s*$/.test(pre)) continue;
      // 関数呼び出し引数・オブジェクト値・代入・テンプレート・return
      if (/[(,=`]\s*$/.test(pre)) continue;
      if (/\breturn\s*$/.test(pre)) continue;
      if (/\bnameEn\s*:\s*$/.test(pre)) continue;

      // JSX 子要素位置か
      const sameLineChild =
        /(?:[A-Za-z0-9"'}\/)\]]|^)\s*>[^<>={}]*$/.test(pre) && !/=>\s*$/.test(pre);
      const prev = prevNonEmpty(i);
      const multiLineChild =
        /^[\s{]*$/.test(pre) &&
        /(?:[A-Za-z0-9"'}\/)\]])>\s*$/.test(prev) &&
        !/=>\s*$/.test(prev);

      if (!sameLineChild && !multiLineChild) continue;

      const lineNo = i + 1;
      const name = `{${receiver}.nameEn}`;
      out.push({
        file: relPath,
        line: lineNo,
        name,
        rule: "dynamic-name-en-child",
        excerpt: line.trim().length > 120 ? line.trim().slice(0, 117) + "…" : line.trim(),
        allowlisted: isAllowlisted(relPath, lineNo, name, "dynamic-name-en-child"),
      });
    }
  }
  return out;
}

/**
 * その .tsx / .jsx 内で「許可された英語併記」（title 属性に英語能力値名がある行）の件数。
 * 参考表示のみ。違反ではない。
 * @returns {number}
 */
export function countAllowedTitleMentions(relPath, content) {
  if (!/\.(t|j)sx$/.test(relPath)) return 0;
  let n = 0;
  for (const line of stripBlockComments(content).split(/\r?\n/)) {
    const l = stripLineComment(line);
    for (const name of ALL_NAMES) {
      const idx = l.indexOf(name);
      if (idx < 0) continue;
      const pre = l.slice(0, idx);
      if (/\btitle\s*[:=]\s*(\{\s*[`"']|[`"'])[^`"']*$/.test(pre)) n++;
    }
  }
  return n;
}

/** allowlist エントリの構造検証（fs 不要）。@returns {string[]} 問題点（空 = OK） */
export function validateAllowlistEntry(entry) {
  const problems = [];
  const f = entry.file;
  if (typeof f !== "string" || f.trim() === "") {
    problems.push("file が空");
  } else {
    if (f.startsWith("/") || /^[A-Za-z]:/.test(f) || f.includes("\\")) problems.push("file が相対パスでない");
    if (f.includes("..")) problems.push("file に .. を含む");
    if (!/\.[jt]sx?$/.test(f)) problems.push("file が単一の .ts(x)/.js(x) を指していない");
    if (!AUDIT_DIRS.some((d) => f.startsWith(d + "/"))) problems.push("file が監査対象ディレクトリ外");
  }
  if (!KNOWN_RULES.includes(entry.rule)) problems.push(`rule が未知: ${String(entry.rule)}`);
  if (typeof entry.expression !== "string" || entry.expression.trim() === "") {
    problems.push("expression が空（file だけの広い除外は禁止）");
  }
  if (typeof entry.reason !== "string" || entry.reason.trim().length < 10) {
    problems.push("reason が空／短すぎる");
  }
  return problems;
}

/**
 * allowlist エントリが stale（対象ファイルが無い／登録式が見つからない）か。
 * @param {object} entry
 * @param {string|null|undefined} content 対象ファイルの内容（読めなければ null）
 */
export function isAllowlistEntryStale(entry, content) {
  if (content === null || content === undefined) return true;
  if (entry.expression && !content.includes(entry.expression)) return true;
  return false;
}

/**
 * `const NAME[: type] = { key: "値", ... }` の 1 オブジェクトリテラルを {key:値} へ。
 * stat-labels.ts の各辞書に合わせた素朴パーサ（依存を増やさないため）。
 * @returns {Record<string,string>|null}
 */
export function parseLabelMap(text, constName) {
  const re = new RegExp(`const\\s+${constName}\\s*(?::[^=]*)?=\\s*\\{([\\s\\S]*?)\\n\\}`);
  const m = re.exec(text);
  if (!m) return null;
  /** @type {Record<string,string>} */
  const out = {};
  const entryRe = /(?:^|[,{])\s*(?:"([^"]+)"|'([^']+)'|([A-Za-z_$][\w$]*))\s*:\s*"([^"]*)"/g;
  let e;
  while ((e = entryRe.exec(m[1])) !== null) {
    out[e[1] ?? e[2] ?? e[3]] = e[4];
  }
  return out;
}

/**
 * 表示辞書の完全性チェック（純関数）。
 * @param {{
 *   statLabels: Record<string,string>,
 *   groupLabels: Record<string,string>,
 *   radarAxisLabels: Record<string,string>,
 *   buildModeLabels: Record<string,string>,
 *   statKeys: string[],
 *   groupIds: string[],
 *   radarAxisIds: string[],
 *   buildModeValues: string[],
 * }} input
 * @returns {string[]} 問題点（空 = OK）
 */
export function checkDictionary(input) {
  /** @type {string[]} */
  const problems = [];
  // < > （HTML 様）とタブ以外の制御文字を不正とみなす
  const badChar = (v) => /[<>]/.test(v) || CONTROL_CHARS.test(v);

  const checkMap = (label, map, keys) => {
    for (const k of keys) {
      const v = map[k];
      if (v === undefined || v === null) problems.push(`${label}: キー未登録 "${k}"`);
      else if (typeof v !== "string" || v.trim() === "") problems.push(`${label}: 空ラベル "${k}"`);
      else if (badChar(v)) problems.push(`${label}: 不正な文字を含む "${k}"`);
      else if (v === k) problems.push(`${label}: 英語 fallback のまま "${k}"`);
    }
    for (const k of Object.keys(map)) {
      if (!keys.includes(k)) problems.push(`${label}: 余分なキー "${k}"`);
    }
    const seen = new Map();
    for (const k of keys) {
      const v = map[k];
      if (!v) continue;
      if (seen.has(v)) problems.push(`${label}: 日本語ラベル重複 "${v}"（${seen.get(v)} と ${k}）`);
      else seen.set(v, k);
    }
  };

  checkMap("能力値辞書(STAT_LABEL_JA)", input.statLabels, input.statKeys);
  checkMap("育成カテゴリ辞書(GROUP_LABEL_JA)", input.groupLabels, input.groupIds);
  checkMap("レーダー軸辞書(RADAR_AXIS_LABEL_JA)", input.radarAxisLabels, input.radarAxisIds);
  checkMap("育成方針辞書(BUILD_MODE_LABEL_JA)", input.buildModeLabels, input.buildModeValues);

  // 「ドリブル」は能力値 dribbling と 育成カテゴリ dribbling の両方に存在する（意図的・別文脈）。
  // GK1 / GK2 / GK3 も育成カテゴリとして正しい。→ 辞書をまたいだ重複は検査しない。
  return problems;
}
