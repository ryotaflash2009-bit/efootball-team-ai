import type { StatBreakdown } from "@/lib/progression/types";
import type { SlotRole, CompatibilityStatus, StoredSquad } from "./types";
import { WORLD_CARD_ID_RE, BUILD_ID_RE } from "./types";
import type { SquadComputed } from "./types";
import type { SavedBuild } from "@/lib/progression/types";
import { statLabelJa } from "@/lib/world/stat-labels";

/**
 * スカッド診断（スカッド構成評価）の決定的な純関数エンジン。
 *
 * 設計原則（docs/milestones/2026-09-06-squad-diagnosis-foundation.md §5 参照）:
 *  - 同じ入力には常に同じ出力（Math.random 不使用・日時に依存しない）。
 *  - localStorage / SQLite / HTTP / DOM への一切のアクセスをしない（純関数のみ）。
 *  - 欠損データを 0 として扱わない（判定対象外として明示）。
 *  - ポジション別 OVR は使用しない（`StatBreakdown.finalValue` の 26 能力値のみを使用）。
 *  - 外部ランキング・全国上位率・勝率予測は一切生成しない。
 *  - この評価は「登録された選手能力・育成・配置にもとづくスカッド構成評価」であり、
 *    試合結果・プレイヤースキル・全国順位を示すものではない（`DIAGNOSIS_DISCLAIMER`）。
 */

// ---------------------------------------------------------------------------
// 定数（閾値・重みは必ずここに明示する。マジックナンバーを式に直書きしない）
// ---------------------------------------------------------------------------

export const SQUAD_DIAGNOSIS_RULES_VERSION = "squad-diagnosis/2026-09-06.v1";

export const DIAGNOSIS_DISCLAIMER =
  "この評価は、登録された選手能力・育成・配置にもとづくスカッド構成評価です。試合結果やプレイヤースキル、全国順位・勝率を保証するものではありません。";

/**
 * ランク閾値（0-100 のスコアに対する境界値）。
 * 根拠: eFootball のカード能力値は主力級で 80 台後半〜90 台、控え級で 40〜60 台に分布する傾向があるため、
 * S を「主力級が複数揃う」水準（85 以上）に絞り、D〜C を「明確な底上げの余地がある」水準（55 未満）に広く取る、
 * 5 段階の非等幅レンジを採用する。値は今後の実測データで見直す可能性があるが、初期版として固定する。
 * 降順（min の大きい順）で並べ、最初に一致した境界を採用する。
 */
export const DIAGNOSIS_TIER_THRESHOLDS: { tier: SquadDiagnosisTier; min: number }[] = [
  { tier: "S", min: 85 },
  { tier: "A", min: 70 },
  { tier: "B", min: 55 },
  { tier: "C", min: 40 },
  { tier: "D", min: 0 },
];

/** 選手配置の充足状況スコアの減点重み（100点満点からの減点式・根拠は各定数のコメント参照）。 */
export const SQUAD_COMPLETENESS_WEIGHTS = {
  /** 先発の空き枠 1 人あたり（11人全員欠けると 99 点減点＝ほぼ 0 点になる水準）。 */
  missingStarterPenalty: 9,
  /** 適性未確認（登録ポジション不明などで判定できない）配置 1 件あたり。 */
  unresolvedCompatibilityPenalty: 5,
  /** GK起用など明確な不適性の可能性がある配置 1 件あたり（未確認より重く減点）。 */
  gkMismatchPenalty: 8,
  /** ベンチが 0 人のときの追加減点（交代選手候補が全く無い状態）。 */
  emptyBenchPenalty: 3,
} as const;

/** ベンチ入れ替え候補を提案する際の「改善幅」の最小しきい値（ポイント）。僅差の入れ替えは提案しない。 */
export const BENCH_SWAP_IMPROVEMENT_THRESHOLD = 5;

/** 長所・弱点・改善候補の最大表示件数。 */
export const MAX_FINDINGS = 3;
export const MAX_SUGGESTIONS = 3;

// ---------------------------------------------------------------------------
// 評価カテゴリ定義（採用した項目のみ・単一の真実源）
// ---------------------------------------------------------------------------

export type SquadDiagnosisCategoryId =
  | "attack"
  | "defense"
  | "aerial"
  | "speed"
  | "passBuildUp"
  | "dribblePossession"
  | "pressResistance"
  | "counterAttack"
  | "squadCompleteness";

/** 無料版で表示する候補（docs §11）。他は Pro 版候補として区別する。 */
export const FREE_TIER_CATEGORY_IDS: SquadDiagnosisCategoryId[] = ["attack", "defense", "aerial"];

interface AbilityCategoryDef {
  id: Exclude<SquadDiagnosisCategoryId, "squadCompleteness">;
  label: string;
  /** 採用した対象能力値（World 26キー）。既存カテゴリ定義（COMPARE_CATEGORIES / stat-groups.ts）と整合させたものを優先採用。 */
  statKeys: string[];
  /** この能力集合をどこから採用したか（根拠表示用）。 */
  source: string;
}

/**
 * 採用した8項目。GK専用能力（gkAwareness 等）は対象外（GKとフィールドプレイヤーを区別するため）。
 * 同じ能力が複数カテゴリに現れる場合があるが、各能力は最大3カテゴリまでに留め、
 * 実際のサッカーにおける役割の重複（例: heading は攻撃のヘディングシュートと空中戦の両方に関係）を根拠とする
 * （§5「同じ能力を複数項目へ無制限に重複加点しない」＝無制限の重複を避ける趣旨であり、限定的な重複は許容）。
 */
export const ABILITY_CATEGORIES: AbilityCategoryDef[] = [
  {
    id: "attack",
    label: "攻撃",
    statKeys: ["offensiveAwareness", "finishing", "heading", "setPieceTaking", "curl"],
    source: "既存の比較カテゴリ定義（COMPARE_CATEGORIES.attack）と同一の能力集合を採用",
  },
  {
    id: "defense",
    label: "守備",
    statKeys: ["defensiveAwareness", "tackling", "aggression", "defensiveEngagement"],
    source: "既存の比較カテゴリ定義（COMPARE_CATEGORIES.defense）と同一の能力集合を採用",
  },
  {
    id: "aerial",
    label: "空中戦",
    statKeys: ["heading", "jumping", "physicalContact"],
    source: "既存の育成カテゴリ定義（stat-groups.ts の aerialStrength）と同一の能力集合を採用",
  },
  {
    id: "speed",
    label: "スピード",
    statKeys: ["speed", "acceleration"],
    source: "既存の比較カテゴリ定義（COMPARE_CATEGORIES.speed）と同一の能力集合を採用",
  },
  {
    id: "passBuildUp",
    label: "パス・ビルドアップ",
    statKeys: ["lowPass", "loftedPass", "ballControl"],
    source: "グラウンダーパス・フライパスに、パス精度を支えるボールコントロールを加えた集合",
  },
  {
    id: "dribblePossession",
    label: "ドリブル・ボール保持",
    statKeys: ["ballControl", "dribbling", "tightPossession"],
    source: "既存の比較カテゴリ定義（COMPARE_CATEGORIES.dribble）と同一の能力集合を採用",
  },
  {
    id: "pressResistance",
    label: "プレス適性",
    statKeys: ["aggression", "stamina", "speed", "acceleration"],
    source: "プレッシングに関与する運動量・寄せの速さに関する能力の集合",
  },
  {
    id: "counterAttack",
    label: "カウンター適性",
    statKeys: ["speed", "acceleration", "offensiveAwareness"],
    source: "速攻の推進力（スピード）と飛び出しの判断（オフェンスセンス）に関する能力の集合",
  },
];

// ---------------------------------------------------------------------------
// 型
// ---------------------------------------------------------------------------

export type SquadDiagnosisTier = "S" | "A" | "B" | "C" | "D";
export type FindingKind = "ability" | "compatibility" | "referenceError" | "config";
export type SavedBuildRefStatus = "none" | "ok" | "missing" | "world-card-mismatch" | "invalid-build-id" | "unknown";

/** 1選手ぶんの、診断エンジンへの入力（先発・ベンチ共通形状）。 */
export interface SquadDiagnosisPlayerInput {
  /** 先発は slotId、ベンチは subId。安定ソート用。 */
  key: string;
  worldCardId: string | null;
  nameJa: string | null;
  nameEn: string | null;
  registeredPosition: string | null;
  /** 先発のみ（配置ポジションから判定済み）。ベンチは null（ピッチに配置されていないため）。 */
  role: SlotRole | null;
  /** 先発の配置ポジション。ベンチは null。 */
  assignedPosition: string | null;
  compatibilityStatus: CompatibilityStatus | null;
  isCaptain: boolean;
  /** カードが解決できたか（World by-ids で解決済みか）。 */
  cardResolved: boolean;
  /** 解決済みの26能力値内訳（標準モード・保存ビルド適用後）。cardResolved が false なら null。 */
  stats: StatBreakdown[] | null;
  savedBuildId: string | null;
  savedBuildStatus: SavedBuildRefStatus;
}

export interface SquadDiagnosisInput {
  squadId: string;
  squadName: string;
  updatedAt: string;
  formationId: string;
  /** フォーメーションの全スロット分（未配置は cardResolved=false）。 */
  starters: SquadDiagnosisPlayerInput[];
  bench: SquadDiagnosisPlayerInput[];
  managerId: number | null;
  /** managerId はあるが監督詳細を解決できなかった場合 false。 */
  managerResolved: boolean;
  managerApplied: boolean;
}

export interface SquadDiagnosisEvidenceItem {
  label: string;
  value: string;
}

export interface SquadDiagnosisCategory {
  id: SquadDiagnosisCategoryId;
  label: string;
  /** 0-100（整数）。判定対象外なら null。 */
  score: number | null;
  tier: SquadDiagnosisTier | null;
  /** free = 無料版で表示・pro = 詳細版のみ。 */
  visibility: "free" | "pro";
  /** 対象になった選手数。 */
  sampleSize: number;
  /** 判定できない場合の理由（"判定対象外" 等）。判定できた場合は算出方法の要約。 */
  note: string;
  evidence: SquadDiagnosisEvidenceItem[];
}

export interface SquadDiagnosisFinding {
  id: string;
  kind: FindingKind;
  categoryId: SquadDiagnosisCategoryId | null;
  label: string;
  detail: string;
}

export interface SquadDiagnosisSuggestion {
  id: string;
  label: string;
  detail: string;
}

export interface SquadDiagnosisDataQuality {
  filledStartingSlots: number;
  totalStartingSlots: number;
  benchCount: number;
  /** filledStartingSlots / totalStartingSlots（%・整数）。 */
  coveragePercent: number;
  unresolvedCompatibilityCount: number;
  gkMismatchCount: number;
  missingSavedBuildCount: number;
  brokenSavedBuildRefCount: number;
  /** worldCardId は設定されているがカードを解決できなかった枠（先発+ベンチ）。空き枠とは区別する。 */
  unresolvedCardCount: number;
  unresolvedManager: boolean;
  /** 判定対象外になったカテゴリのラベル一覧。 */
  unratedCategoryLabels: string[];
}

/** 無料版で見せる候補（docs §11）。詳細版とは別に、コード構造上も分離する。 */
export interface SquadDiagnosisBasicSummary {
  overallScore: number | null;
  overallTier: SquadDiagnosisTier | null;
  categories: { id: SquadDiagnosisCategoryId; label: string; score: number | null; tier: SquadDiagnosisTier | null }[];
  topStrength: SquadDiagnosisFinding | null;
  topWeakness: SquadDiagnosisFinding | null;
  dataCoveragePercent: number;
  disclaimer: string;
}

export interface SquadDiagnosisResult {
  rulesVersion: string;
  squadId: string;
  squadName: string;
  overall: { score: number | null; tier: SquadDiagnosisTier | null; note: string };
  /** 全カテゴリ（squadCompleteness 含む）。無料/詳細の切り分けは各要素の visibility で判定。 */
  categories: SquadDiagnosisCategory[];
  strengths: SquadDiagnosisFinding[];
  weaknesses: SquadDiagnosisFinding[];
  suggestions: SquadDiagnosisSuggestion[];
  dataQuality: SquadDiagnosisDataQuality;
  disclaimer: string;
  /** 無料版で表示する最小サマリー（詳細情報を含まない）。 */
  basicSummary: SquadDiagnosisBasicSummary;
}

// ---------------------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------------------

/** NaN・Infinity を安全に弾く（0-100 へクランプ・整数丸め）。 */
function safeScore(n: number): number | null {
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function determineDiagnosisGrade(score: number): SquadDiagnosisTier {
  for (const t of DIAGNOSIS_TIER_THRESHOLDS) {
    if (score >= t.min) return t.tier;
  }
  return "D";
}

function statValueOf(stats: StatBreakdown[], key: string): number | null {
  const s = stats.find((x) => x.key === key);
  return s ? s.finalValue : null;
}

/** 1選手の、あるカテゴリの対象能力平均（全キーが揃わない = 未解決のケースは呼び出し側で除外済み）。 */
function perPlayerCategoryValue(stats: StatBreakdown[], statKeys: string[]): number | null {
  const vals = statKeys.map((k) => statValueOf(stats, k)).filter((v): v is number => v != null);
  if (vals.length !== statKeys.length) return null; // 一部でも解決できない能力があれば安全側で不算入
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

// ---------------------------------------------------------------------------
// メイン
// ---------------------------------------------------------------------------

export function scoreSquadCategory(
  def: AbilityCategoryDef,
  starters: SquadDiagnosisPlayerInput[],
): SquadDiagnosisCategory {
  const eligible = starters.filter(
    (s) => s.cardResolved && s.stats != null && s.role != null && s.role !== "GK",
  );
  const perPlayer = eligible
    .map((s) => ({ s, v: perPlayerCategoryValue(s.stats!, def.statKeys) }))
    .filter((x): x is { s: SquadDiagnosisPlayerInput; v: number } => x.v != null);

  if (perPlayer.length === 0) {
    return {
      id: def.id,
      label: def.label,
      score: null,
      tier: null,
      visibility: FREE_TIER_CATEGORY_IDS.includes(def.id) ? "free" : "pro",
      sampleSize: 0,
      note: "判定対象外（対象となるフィールドプレイヤーが先発にいません）",
      evidence: [
        { label: "対象能力", value: def.statKeys.map((k) => statLabelJa(k)).join(" / ") },
        { label: "採用理由", value: def.source },
      ],
    };
  }

  const rawAvg = perPlayer.reduce((a, b) => a + b.v, 0) / perPlayer.length;
  const score = safeScore(rawAvg);
  const tier = score != null ? determineDiagnosisGrade(score) : null;
  const sorted = [...perPlayer].sort((a, b) => b.v - a.v);
  const top = sorted[0];
  const bottom = sorted[sorted.length - 1];

  return {
    id: def.id,
    label: def.label,
    score,
    tier,
    visibility: FREE_TIER_CATEGORY_IDS.includes(def.id) ? "free" : "pro",
    sampleSize: perPlayer.length,
    note: `先発の対象フィールドプレイヤー ${perPlayer.length} 人（GK除く）の対象能力平均（標準最終値）`,
    evidence: [
      { label: "対象選手数", value: `${perPlayer.length}人` },
      { label: "使用した能力", value: def.statKeys.map((k) => statLabelJa(k)).join(" / ") },
      { label: "採用理由", value: def.source },
      { label: "平均値", value: `${Math.round(rawAvg * 10) / 10}` },
      { label: "最高", value: `${top.s.nameJa ?? top.s.nameEn ?? top.s.key}（${Math.round(top.v * 10) / 10}）` },
      { label: "最低", value: `${bottom.s.nameJa ?? bottom.s.nameEn ?? bottom.s.key}（${Math.round(bottom.v * 10) / 10}）` },
    ],
  };
}

function scoreSquadCompleteness(input: SquadDiagnosisInput): SquadDiagnosisCategory {
  const filled = input.starters.filter((s) => s.cardResolved);
  const missingStarters = input.starters.length - filled.length;
  const unresolvedCompat = input.starters.filter((s) => s.compatibilityStatus === "unresolved").length;
  const gkMismatch = input.starters.filter((s) => s.compatibilityStatus === "gkMismatch").length;
  const w = SQUAD_COMPLETENESS_WEIGHTS;
  const raw =
    100 -
    missingStarters * w.missingStarterPenalty -
    unresolvedCompat * w.unresolvedCompatibilityPenalty -
    gkMismatch * w.gkMismatchPenalty -
    (input.bench.length === 0 ? w.emptyBenchPenalty : 0);
  const score = safeScore(raw);
  const tier = score != null ? determineDiagnosisGrade(score) : null;
  return {
    id: "squadCompleteness",
    label: "選手配置の充足状況",
    score,
    tier,
    visibility: "pro",
    sampleSize: filled.length,
    note: "先発の配置人数・適性・ベンチ人数から減点方式で算出（能力値は使用しない）",
    evidence: [
      { label: "先発配置", value: `${filled.length} / ${input.starters.length} 人` },
      { label: "ベンチ人数", value: `${input.bench.length} 人` },
      { label: "適性未確認", value: `${unresolvedCompat} 件` },
      { label: "不適性の可能性", value: `${gkMismatch} 件` },
      { label: "減点重み", value: `未配置×${w.missingStarterPenalty} / 適性未確認×${w.unresolvedCompatibilityPenalty} / 不適性×${w.gkMismatchPenalty} / ベンチ0人×${w.emptyBenchPenalty}` },
    ],
  };
}

function buildFindings(
  input: SquadDiagnosisInput,
  categories: SquadDiagnosisCategory[],
): { strengths: SquadDiagnosisFinding[]; weaknesses: SquadDiagnosisFinding[] } {
  const abilityCats = categories.filter((c) => c.id !== "squadCompleteness" && c.score != null);

  const strengthCandidates: SquadDiagnosisFinding[] = [...abilityCats]
    .filter((c) => c.tier === "S" || c.tier === "A")
    .sort((a, b) => (b.score! - a.score!) || a.id.localeCompare(b.id))
    .map((c) => ({
      id: `strength-ability-${c.id}`,
      kind: "ability" as const,
      categoryId: c.id,
      label: c.label,
      detail: `${c.label}の評価が高水準です（ランク${c.tier}・${c.score}点）。`,
    }));

  const weaknessCandidates: SquadDiagnosisFinding[] = [];

  // 優先度1: 参照エラー（削除済みsavedBuildId参照）
  for (const p of [...input.starters, ...input.bench]) {
    if (p.savedBuildStatus !== "none" && p.savedBuildStatus !== "ok") {
      weaknessCandidates.push({
        id: `weakness-ref-${p.key}`,
        kind: "referenceError",
        categoryId: null,
        label: `${p.nameJa ?? p.nameEn ?? p.key}の保存ビルド参照`,
        detail: `保存ビルドの参照が解決できません（状態: ${p.savedBuildStatus}）。データの誤りではなく、削除・付け替え等により参照が古くなっている可能性があります。`,
      });
    }
  }
  // 優先度2: 配置適性（GK不適性 > 未確認）
  for (const s of input.starters) {
    if (s.cardResolved && s.compatibilityStatus === "gkMismatch") {
      weaknessCandidates.push({
        id: `weakness-compat-${s.key}`,
        kind: "compatibility",
        categoryId: null,
        label: `${s.nameJa ?? s.nameEn ?? s.key}の配置適性`,
        detail: `登録ポジション（${s.registeredPosition ?? "不明"}）と配置（${s.assignedPosition}）が大きく異なる可能性があります（能力値は変更していません）。`,
      });
    }
  }
  // 優先度3: 能力面の弱点（ランク D → C の順）
  for (const tier of ["D", "C"] as const) {
    for (const c of [...abilityCats].filter((c) => c.tier === tier).sort((a, b) => a.score! - b.score! || a.id.localeCompare(b.id))) {
      weaknessCandidates.push({
        id: `weakness-ability-${c.id}`,
        kind: "ability",
        categoryId: c.id,
        label: c.label,
        detail: `${c.label}の評価が低水準です（ランク${c.tier}・${c.score}点）。`,
      });
    }
  }
  // 優先度4: 選手配置の充足状況が低い
  const completeness = categories.find((c) => c.id === "squadCompleteness");
  if (completeness && completeness.score != null && completeness.score < 70) {
    weaknessCandidates.push({
      id: "weakness-completeness",
      kind: "config",
      categoryId: "squadCompleteness",
      label: "選手配置の充足状況",
      detail: `先発の配置・適性に改善余地があります（${completeness.score}点）。詳細は根拠を参照してください。`,
    });
  }

  return {
    strengths: strengthCandidates.slice(0, MAX_FINDINGS),
    weaknesses: weaknessCandidates.slice(0, MAX_FINDINGS),
  };
}

export function suggestSquadImprovements(
  input: SquadDiagnosisInput,
  categories: SquadDiagnosisCategory[],
): SquadDiagnosisSuggestion[] {
  const suggestions: SquadDiagnosisSuggestion[] = [];

  // 1) 削除済み参照
  const brokenRefs = [...input.starters, ...input.bench].filter(
    (p) => p.savedBuildStatus !== "none" && p.savedBuildStatus !== "ok",
  );
  if (brokenRefs.length > 0) {
    suggestions.push({
      id: "suggest-broken-ref",
      label: "保存ビルド参照の見直し",
      detail: `${brokenRefs.map((p) => p.nameJa ?? p.nameEn ?? p.key).join(" / ")} の保存ビルド参照が解決できません。保存ビルドを選び直してください（自動修復はしません）。`,
    });
  }

  // 2) 保存ビルド未設定（先発・カード解決済みのみ対象）
  const missingBuild = input.starters.filter((s) => s.cardResolved && s.savedBuildStatus === "none");
  if (missingBuild.length > 0) {
    suggestions.push({
      id: "suggest-missing-build",
      label: "保存ビルドの設定",
      detail: `${missingBuild.map((s) => s.nameJa ?? s.nameEn ?? s.key).join(" / ")} は保存ビルド未設定のため、育成後の完成状態を十分に反映していません。育成・ブースターを反映した保存ビルドを設定すると、より実態に近い評価になります。`,
    });
  }

  // 3) 配置適性
  const compatIssues = input.starters.filter(
    (s) => s.cardResolved && (s.compatibilityStatus === "gkMismatch" || s.compatibilityStatus === "unresolved"),
  );
  if (compatIssues.length > 0) {
    suggestions.push({
      id: "suggest-compat",
      label: "配置の見直し",
      detail: `${compatIssues.map((s) => `${s.nameJa ?? s.nameEn ?? s.key}（${s.assignedPosition}）`).join(" / ")} の配置適性を確認してください。`,
    });
  }

  // 4) 先発の空き
  const missingCount = input.starters.filter((s) => !s.cardResolved).length;
  if (missingCount > 0) {
    suggestions.push({
      id: "suggest-fill-starters",
      label: "先発の空き枠",
      detail: `先発が ${input.starters.length - missingCount}/${input.starters.length} 人です。空き枠へ選手を配置すると評価の精度が上がります。`,
    });
  }

  // 5) ベンチ入れ替え候補（最も評価が低い能力カテゴリについてのみ・改善幅がしきい値以上のときだけ）
  const weakestAbility = [...categories]
    .filter((c) => c.id !== "squadCompleteness" && c.score != null)
    .sort((a, b) => a.score! - b.score!)[0];
  if (weakestAbility) {
    const def = ABILITY_CATEGORIES.find((c) => c.id === weakestAbility.id);
    if (def) {
      const starterVals = input.starters
        .filter((s) => s.cardResolved && s.stats && s.role !== "GK")
        .map((s) => ({ s, v: perPlayerCategoryValue(s.stats!, def.statKeys) }))
        .filter((x): x is { s: SquadDiagnosisPlayerInput; v: number } => x.v != null)
        .sort((a, b) => a.v - b.v);
      const benchVals = input.bench
        .filter((s) => s.cardResolved && s.stats)
        .map((s) => ({ s, v: perPlayerCategoryValue(s.stats!, def.statKeys) }))
        .filter((x): x is { s: SquadDiagnosisPlayerInput; v: number } => x.v != null)
        .sort((a, b) => b.v - a.v);
      const worstStarter = starterVals[0];
      const bestBench = benchVals[0];
      if (worstStarter && bestBench && bestBench.v - worstStarter.v >= BENCH_SWAP_IMPROVEMENT_THRESHOLD) {
        suggestions.push({
          id: "suggest-bench-swap",
          label: "ベンチ入れ替え候補",
          detail: `${def.label}について、ベンチの${bestBench.s.nameJa ?? bestBench.s.nameEn}（${Math.round(bestBench.v)}）は先発の${worstStarter.s.nameJa ?? worstStarter.s.nameEn}（${Math.round(worstStarter.v)}）より高い値です。入れ替えを検討できます（自動適用はしません）。`,
        });
      }
    }
  }

  return suggestions.slice(0, MAX_SUGGESTIONS);
}

export function calculateDataCoverage(input: SquadDiagnosisInput, categories: SquadDiagnosisCategory[]): SquadDiagnosisDataQuality {
  const filled = input.starters.filter((s) => s.cardResolved).length;
  const total = input.starters.length;
  const unresolvedCompatibilityCount = input.starters.filter((s) => s.compatibilityStatus === "unresolved").length;
  const gkMismatchCount = input.starters.filter((s) => s.compatibilityStatus === "gkMismatch").length;
  const missingSavedBuildCount = input.starters.filter((s) => s.cardResolved && s.savedBuildStatus === "none").length;
  const brokenSavedBuildRefCount = [...input.starters, ...input.bench].filter(
    (p) => p.savedBuildStatus !== "none" && p.savedBuildStatus !== "ok",
  ).length;
  const unresolvedCardCount = [...input.starters, ...input.bench].filter(
    (p) => p.worldCardId != null && !p.cardResolved,
  ).length;
  return {
    filledStartingSlots: filled,
    totalStartingSlots: total,
    benchCount: input.bench.length,
    coveragePercent: total > 0 ? Math.round((filled / total) * 100) : 0,
    unresolvedCompatibilityCount,
    gkMismatchCount,
    missingSavedBuildCount,
    brokenSavedBuildRefCount,
    unresolvedCardCount,
    unresolvedManager: input.managerId != null && !input.managerResolved,
    unratedCategoryLabels: categories.filter((c) => c.score == null).map((c) => c.label),
  };
}

export function diagnoseSquad(input: SquadDiagnosisInput): SquadDiagnosisResult {
  const abilityCategories = ABILITY_CATEGORIES.map((def) => scoreSquadCategory(def, input.starters));
  const completeness = scoreSquadCompleteness(input);
  const categories = [...abilityCategories, completeness];

  const computable = abilityCategories.filter((c) => c.score != null);
  const overallScore = computable.length > 0 ? safeScore(computable.reduce((a, c) => a + c.score!, 0) / computable.length) : null;
  const overallTier = overallScore != null ? determineDiagnosisGrade(overallScore) : null;
  const overallNote =
    overallScore != null
      ? `判定可能な ${computable.length}/${abilityCategories.length} 項目の単純平均`
      : "判定対象外（有効な評価項目がありません。先発にフィールドプレイヤーを配置してください）";

  const { strengths, weaknesses } = buildFindings(input, categories);
  const suggestions = suggestSquadImprovements(input, categories);
  const dataQuality = calculateDataCoverage(input, categories);

  const freeCats = categories.filter((c) => FREE_TIER_CATEGORY_IDS.includes(c.id));
  const basicSummary: SquadDiagnosisBasicSummary = {
    overallScore,
    overallTier,
    categories: freeCats.map((c) => ({ id: c.id, label: c.label, score: c.score, tier: c.tier })),
    topStrength: strengths[0] ?? null,
    topWeakness: weaknesses[0] ?? null,
    dataCoveragePercent: dataQuality.coveragePercent,
    disclaimer: DIAGNOSIS_DISCLAIMER,
  };

  return {
    rulesVersion: SQUAD_DIAGNOSIS_RULES_VERSION,
    squadId: input.squadId,
    squadName: input.squadName,
    overall: { score: overallScore, tier: overallTier, note: overallNote },
    categories,
    strengths,
    weaknesses,
    suggestions,
    dataQuality,
    disclaimer: DIAGNOSIS_DISCLAIMER,
    basicSummary,
  };
}

// ---------------------------------------------------------------------------
// データ解決層（純関数・既存の解決済みデータを整形するだけ。localStorage/HTTP/SQLite へは触れない）
// ---------------------------------------------------------------------------

function classifySavedBuildRef(
  savedBuildId: string | null,
  worldCardId: string | null,
  buildsById: Map<string, SavedBuild>,
): SavedBuildRefStatus {
  if (!savedBuildId) return "none";
  if (!BUILD_ID_RE.test(savedBuildId)) return "invalid-build-id";
  const build = buildsById.get(savedBuildId);
  if (!build) return "missing";
  if (!worldCardId || !WORLD_CARD_ID_RE.test(worldCardId)) return "unknown";
  if (build.worldCardId !== worldCardId) return "world-card-mismatch";
  return "ok";
}

/**
 * `buildSquad()` の出力（SquadComputed）と元の StoredSquad から、診断エンジンへの入力を組み立てる。
 * 純関数（新しい fetch・localStorage アクセスはしない）。呼び出し側が既に解決済みの
 * `computed` / `squad` / `buildsById`（既存 `savedBuildsByCard` を Map 化したもの）だけを使う。
 */
export function buildSquadDiagnosisInput(params: {
  squad: StoredSquad;
  computed: SquadComputed;
  buildsById: Map<string, SavedBuild>;
  managerResolved: boolean;
}): SquadDiagnosisInput {
  const { squad, computed, buildsById, managerResolved } = params;
  const storedSlotById = new Map(squad.slots.map((s) => [s.slotId, s]));
  const storedSubById = new Map(squad.substitutes.map((s) => [s.subId, s]));

  const starters: SquadDiagnosisPlayerInput[] = computed.slots.map((slot) => {
    const stored = storedSlotById.get(slot.slotId) ?? null;
    const worldCardId = stored?.worldCardId ?? null;
    const savedBuildId = stored?.savedBuildId ?? null;
    if (!slot.entry) {
      return {
        key: slot.slotId,
        worldCardId,
        nameJa: null,
        nameEn: null,
        registeredPosition: null,
        role: slot.role,
        assignedPosition: slot.position,
        compatibilityStatus: slot.compatibility.status,
        isCaptain: slot.isCaptain,
        cardResolved: false,
        stats: null,
        savedBuildId,
        savedBuildStatus: classifySavedBuildRef(savedBuildId, worldCardId, buildsById),
      };
    }
    return {
      key: slot.slotId,
      worldCardId,
      nameJa: slot.entry.display.nameJa,
      nameEn: slot.entry.display.nameEn,
      registeredPosition: slot.entry.display.registeredPosition,
      role: slot.role,
      assignedPosition: slot.position,
      compatibilityStatus: slot.compatibility.status,
      isCaptain: slot.isCaptain,
      cardResolved: true,
      stats: slot.entry.result.stats,
      savedBuildId,
      savedBuildStatus: classifySavedBuildRef(savedBuildId, worldCardId, buildsById),
    };
  });

  const resolvedSubIds = new Set(computed.substitutes.map((s) => s.subId));
  const bench: SquadDiagnosisPlayerInput[] = [
    ...computed.substitutes.map((sub) => {
      const stored = storedSubById.get(sub.subId) ?? null;
      const worldCardId = stored?.worldCardId ?? sub.display.worldCardId ?? null;
      const savedBuildId = stored?.savedBuildId ?? null;
      return {
        key: sub.subId,
        worldCardId,
        nameJa: sub.display.nameJa,
        nameEn: sub.display.nameEn,
        registeredPosition: sub.display.registeredPosition,
        role: null,
        assignedPosition: null,
        compatibilityStatus: null,
        isCaptain: false,
        cardResolved: true,
        stats: sub.result.stats,
        savedBuildId,
        savedBuildStatus: classifySavedBuildRef(savedBuildId, worldCardId, buildsById),
      };
    }),
    // buildSquad は解決できなかったベンチ枠（worldCardId 未解決・読込中・エラー）を
    // 結果配列から除外するため、元データと突き合わせて「未解決」として補う（0値に変換しない）。
    ...squad.substitutes
      .filter((sub) => !resolvedSubIds.has(sub.subId))
      .map((sub) => ({
        key: sub.subId,
        worldCardId: sub.worldCardId,
        nameJa: null,
        nameEn: null,
        registeredPosition: null,
        role: null,
        assignedPosition: null,
        compatibilityStatus: null,
        isCaptain: false,
        cardResolved: false,
        stats: null,
        savedBuildId: sub.savedBuildId,
        savedBuildStatus: classifySavedBuildRef(sub.savedBuildId, sub.worldCardId, buildsById),
      })),
  ];

  return {
    squadId: squad.squadId,
    squadName: squad.squadName,
    updatedAt: squad.updatedAt,
    formationId: squad.formationId,
    starters,
    bench,
    managerId: squad.managerId,
    managerResolved,
    managerApplied: computed.manager.applied,
  };
}
