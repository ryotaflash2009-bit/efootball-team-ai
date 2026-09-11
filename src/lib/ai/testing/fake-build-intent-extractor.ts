import type { BuildIntentExtractor, BuildIntentExtractionRequest, BuildIntentExtractionResult } from "@/lib/ai/build-intent-extractor";
import { validateBuildIntentExtraction } from "@/lib/ai/build-intent-extractor";
import type { PrimaryGoalId } from "@/lib/progression/build-intent-analysis";

/**
 * テスト専用の決定的 fake 実装。ネットワーク通信を一切行わず、外部AIベンダーへも接続しない。
 *
 * 重要: このファイルは本番コード(APIルート・getBuildIntentExtractor() の解決先)から
 * 絶対に参照しないこと。あくまで、パイプライン全体(スキーマ検証・否定表現の扱い・
 * プロンプトインジェクション耐性・比較対象の解決)を外部通信なしで検証するためだけの
 * 単純なキーワード照合であり、実際のAI(自然言語理解)ではない。
 *
 * 単純な文字列照合であるため、「以前の指示を無視して」等の指示文を渡しても、
 * そもそも許可されたフィールド以外を生成するコードパス自体が存在しない
 * (構造的にプロンプトインジェクションが成立しない)。
 */

interface GroupKeyword {
  groupId: string;
  ja: string[];
  en: string[];
}

const GROUP_KEYWORDS: GroupKeyword[] = [
  { groupId: "shooting", ja: ["シュート", "決定力"], en: ["shoot", "finish", "scoring"] },
  { groupId: "passing", ja: ["パス"], en: ["pass"] },
  { groupId: "dribbling", ja: ["ドリブル", "ボールコントロール"], en: ["dribbl", "ball control"] },
  { groupId: "dexterity", ja: ["クイックネス", "瞬発力", "敏捷性", "スピード"], en: ["quickness", "dexterity", "speed", "acceleration"] },
  { groupId: "lowerBodyStrength", ja: ["脚力", "フィジカル"], en: ["lower body", "physical", "leg power"] },
  { groupId: "aerialStrength", ja: ["空中戦", "エアバトル"], en: ["aerial", "heading"] },
  { groupId: "defending", ja: ["守備", "ディフェンス"], en: ["defen"] },
];

const NEGATION_AVOID_OVERINVESTMENT_JA = ["上げすぎなくて", "上げすぎない", "上げなくて", "伸ばしすぎな"];
const NEGATION_AVOID_OVERINVESTMENT_EN = ["don't need to raise", "no need to raise", "don't over", "not over-invest", "already high"];
const NEGATION_IGNORE_JA = ["重視しない", "捨てる", "捨てている", "捨てたい", "重視していない"];
const NEGATION_IGNORE_EN = ["don't care about", "not prioritiz", "ignore", "give up on", "not important"];
const PRIORITY_HINT_JA = ["優先", "重視したい", "重視する"];
const PRIORITY_HINT_EN = ["prioriti", "focus on", "important"];
const SECONDARY_HINT_JA = ["最低限", "補助的"];
const SECONDARY_HINT_EN = ["minimal", "secondary", "at least"];
const PRESERVE_HINT_JA = ["維持したい", "残したい", "残し"];
const PRESERVE_HINT_EN = ["keep", "preserve", "maintain"];

const GOAL_KEYWORDS: { goal: PrimaryGoalId; ja: string[]; en: string[] }[] = [
  { goal: "dribbling", ja: ["ドリブル突破", "突破力", "1人を剥がせる", "剥がす"], en: ["dribble past", "beat a defender", "breakthrough"] },
  { goal: "scoring", ja: ["得点力", "決定力を重視"], en: ["scoring", "finishing ability"] },
  { goal: "passing", ja: ["チャンスメイク", "パス回し"], en: ["chance creation", "playmaking"] },
  { goal: "speed", ja: ["俊足", "スピード重視"], en: ["pure speed", "fast player"] },
  { goal: "physical", ja: ["フィジカル重視"], en: ["physical presence"] },
  { goal: "aerial", ja: ["空中戦重視"], en: ["aerial presence"] },
  { goal: "defense", ja: ["守備重視"], en: ["defensive solidity"] },
];

function windowContainsAny(text: string, index: number, needles: string[], radius = 20): boolean {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + radius);
  const window = text.slice(start, end);
  return needles.some((n) => window.includes(n));
}

function findAllIndices(haystack: string, needle: string): number[] {
  const out: number[] = [];
  let from = 0;
  for (;;) {
    const i = haystack.indexOf(needle, from);
    if (i < 0) break;
    out.push(i);
    from = i + needle.length;
  }
  return out;
}

/** 単純なキーワード照合による決定的抽出(テスト専用)。 */
export class FakeBuildIntentExtractor implements BuildIntentExtractor {
  async extract(request: BuildIntentExtractionRequest): Promise<BuildIntentExtractionResult> {
    const text = request.freeText;
    const lower = text.toLowerCase();
    const isJa = request.locale === "ja";

    const priorityGroups = new Set<string>();
    const secondaryGroups = new Set<string>();
    const avoidOverinvestmentGroups = new Set<string>();
    const intentionallyIgnoredGroups = new Set<string>();
    const strengthsToPreserve = new Set<string>();
    const evidence: string[] = [];

    for (const kw of GROUP_KEYWORDS) {
      const needles = isJa ? kw.ja : kw.en;
      for (const needle of needles) {
        const haystack = isJa ? text : lower;
        const target = isJa ? needle : needle.toLowerCase();
        const indices = findAllIndices(haystack, target);
        for (const idx of indices) {
          const avoidNeedles = isJa ? NEGATION_AVOID_OVERINVESTMENT_JA : NEGATION_AVOID_OVERINVESTMENT_EN;
          const ignoreNeedles = isJa ? NEGATION_IGNORE_JA : NEGATION_IGNORE_EN;
          const priorityNeedles = isJa ? PRIORITY_HINT_JA : PRIORITY_HINT_EN;
          const secondaryNeedles = isJa ? SECONDARY_HINT_JA : SECONDARY_HINT_EN;
          const preserveNeedles = isJa ? PRESERVE_HINT_JA : PRESERVE_HINT_EN;

          if (windowContainsAny(haystack, idx, ignoreNeedles, 25)) {
            intentionallyIgnoredGroups.add(kw.groupId);
          } else if (windowContainsAny(haystack, idx, avoidNeedles, 25)) {
            avoidOverinvestmentGroups.add(kw.groupId);
          } else if (windowContainsAny(haystack, idx, preserveNeedles, 20)) {
            strengthsToPreserve.add(kw.groupId);
          } else if (windowContainsAny(haystack, idx, secondaryNeedles, 20)) {
            secondaryGroups.add(kw.groupId);
          } else if (windowContainsAny(haystack, idx, priorityNeedles, 20)) {
            priorityGroups.add(kw.groupId);
          }
          if (evidence.length < 5) {
            const start = Math.max(0, idx - 10);
            const end = Math.min(text.length, idx + needle.length + 10);
            evidence.push(text.slice(start, end));
          }
        }
      }
    }

    let primaryGoal: PrimaryGoalId = "unspecified";
    for (const g of GOAL_KEYWORDS) {
      const needles = isJa ? g.ja : g.en;
      if (needles.some((n) => (isJa ? text.includes(n) : lower.includes(n.toLowerCase())))) {
        primaryGoal = g.goal;
        break;
      }
    }

    const intendedPositions = request.availablePositions.filter((p) => new RegExp(`(^|[^A-Za-z])${p}([^A-Za-z]|$)`, "i").test(text));

    let comparisonTargetBuildId: string | null = null;
    const comparisonFocusGroups = new Set<string>();
    for (const build of request.availableComparisonBuilds) {
      if (text.includes(build.buildName) || lower.includes(build.buildName.toLowerCase())) {
        comparisonTargetBuildId = build.buildId;
        for (const g of priorityGroups) comparisonFocusGroups.add(g);
        break;
      }
    }

    const ambiguities: string[] = [];

    const raw = {
      intendedPositions,
      primaryGoal,
      priorityGroups: [...priorityGroups],
      secondaryGroups: [...secondaryGroups],
      normalGroups: [],
      avoidOverinvestmentGroups: [...avoidOverinvestmentGroups],
      intentionallyIgnoredGroups: [...intentionallyIgnoredGroups],
      comparisonTargetBuildId,
      comparisonFocusGroups: [...comparisonFocusGroups],
      strengthsToPreserve: [...strengthsToPreserve],
      ambiguities,
      confidence: priorityGroups.size > 0 || primaryGoal !== "unspecified" ? "medium" : "low",
      evidence,
    };

    const extraction = validateBuildIntentExtraction(raw, {
      availablePositions: request.availablePositions,
      availableComparisonBuildIds: request.availableComparisonBuilds.map((b) => b.buildId),
    });

    return { ok: true, extraction };
  }
}
