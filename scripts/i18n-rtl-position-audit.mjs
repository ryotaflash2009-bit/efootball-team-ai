/**
 * 物理的な左右の位置（Tailwind の left-/right-/translate-x とインライン style の left/right）の分類（RTL の準備）。
 *
 *   node scripts/i18n-rtl-position-audit.mjs          … docs/i18n/rtl-position-utilities.md を書き出す
 *   node scripts/i18n-rtl-position-audit.mjs --check  … 未分類の指定があれば終了コード 1（書き出さない）
 *
 * 分類（ファイル単位・行の内容で判定）:
 * - KEEP_GEOMETRY: 鏡像にしてはいけない（ピッチ上の座標・中央寄せ・左右対称の帯）。RTL でもそのまま。
 * - TO_LOGICAL: UI の角・端（バッジ・閉じるボタン・ドロワー・固定列・入力欄のアイコン）。RTL を公開する前に start-/end- へ。
 * - DECIDE: 値の向き（スライダー）。RTL で左右を反転するかを決めてから直す。
 * - DECORATIVE: 装飾（ぼかしの円）。どちらでもよい。
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");
const CHECK = process.argv.includes("--check");

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = path.join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".tsx") && !p.includes(".test.")) out.push(p);
  }
  return out;
}

const CLASS_RE = /(?<=^|["'`\s{])(-?(?:left|right)-[^\s"'`}]+|-?translate-x-[^\s"'`}]+)/g;
const STYLE_RE = /\b(left|right):\s*(?=[`$p0-9])/g;

function classify(file, line, token) {
  const f = file.replace(/\\/g, "/");
  if (/translate-x-1\/2/.test(token) || /left-1\/2/.test(token)) return "KEEP_GEOMETRY"; // 中央寄せ（方向に依存しない）
  if (/squad\/(SquadPitch|MiniPitch|CompareMiniPitch)\.tsx|best-xi\/BestXiView\.tsx/.test(f)) {
    // ピッチ: 座標・ライン・左右対称の帯は残す。スロットのカードの角のバッジだけは UI。
    if (/rounded-(ee|es|ss|se)/.test(line)) return "TO_LOGICAL";
    return "KEEP_GEOMETRY";
  }
  if (/\bleft-\d+\b.*\bright-\d+\b|\bleft-0 right-0\b/.test(line) && /^(left|right)-\d+$/.test(token)) return "KEEP_GEOMETRY"; // 左右対称の帯
  if (/CategorySlider\.tsx/.test(f)) return "DECIDE";
  if (/blur-3xl/.test(line)) return "DECORATIVE";
  return "TO_LOGICAL";
}

const rows = [];
for (const file of walk(SRC)) {
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    for (const m of line.matchAll(CLASS_RE)) rows.push({ file, line: i + 1, token: m[1], kind: "class", cls: classify(file, line, m[1]), text: line.trim() });
    for (const m of line.matchAll(STYLE_RE)) rows.push({ file, line: i + 1, token: `style ${m[1]}`, kind: "style", cls: classify(file, line, `style-${m[1]}`), text: line.trim() });
  });
}

const rel = (f) => "./" + path.relative(ROOT, f).replace(/\\/g, "/");
const count = (k, c) => rows.filter((r) => r.kind === k && (!c || r.cls === c)).length;
const ORDER = ["KEEP_GEOMETRY", "TO_LOGICAL", "DECIDE", "DECORATIVE"];
const LABEL = {
  KEEP_GEOMETRY: "そのまま（ピッチの座標・中央寄せ・左右対称の帯。鏡像にしない）",
  TO_LOGICAL: "論理プロパティへ（start-/end-。RTL を公開する前に置き換える。LTR の見た目は変わらない）",
  DECIDE: "要決定（スライダーの値の向き。RTL で反転するかを決めてから）",
  DECORATIVE: "装飾（どちらでもよい）",
};

if (CHECK) {
  const unknown = rows.filter((r) => !ORDER.includes(r.cls));
  if (unknown.length) {
    console.error(unknown.map((r) => `${rel(r.file)}:${r.line} ${r.token}`).join("\n"));
    process.exit(1);
  }
  console.log(`[rtl-position-audit] ${count("class")} class tokens, ${count("style")} inline styles; all classified`);
  process.exit(0);
}

let md = `# 物理的な左右の位置の分類（RTL の準備）\n\n`;
md += `\`node scripts/i18n-rtl-position-audit.mjs\` が生成する（手で編集しない）。RTL の言語（ar など）は公開しない方針のため、置き換えは RTL を公開するときに行う。\n`;
md += `余白・文字揃え・枠線・角丸は 2026-10-06 に論理プロパティへ置き換え済み（architecture.md §9）。ここに残るのは位置の指定だけ。\n\n`;
md += `| 分類 | class（Tailwind） | inline style |\n|---|---:|---:|\n`;
for (const c of ORDER) md += `| ${LABEL[c]} | ${count("class", c)} | ${count("style", c)} |\n`;
md += `| **合計** | **${count("class")}** | **${count("style")}** |\n\n`;
for (const c of ORDER) {
  const rs = rows.filter((r) => r.cls === c);
  if (!rs.length) continue;
  md += `## ${LABEL[c]}\n\n| 場所 | 指定 |\n|---|---|\n`;
  for (const r of rs) md += `| \`${rel(r.file)}:${r.line}\` | \`${r.token}\` |\n`;
  md += "\n";
}
md += `## 注意\n\n- \`TO_LOGICAL\` のうち、角丸がすでに論理（\`rounded-ee\` など）で位置が物理（\`left-0\`）の組み合わせは、RTL で角丸だけが反転してずれる。置き換えるときは位置と角丸をそろえる。\n- ピッチ（スカッド・ベスト11）の x 座標はゲームのポジション（左サイド・右サイド）を表すため、RTL でも鏡像にしない。\n`;
writeFileSync(path.join(ROOT, "docs/i18n/rtl-position-utilities.md"), md);
console.log(`[rtl-position-audit] ${count("class")} class tokens, ${count("style")} inline styles → docs/i18n/rtl-position-utilities.md`);
for (const c of ORDER) console.log(`  ${c}: class ${count("class", c)}, style ${count("style", c)}`);
