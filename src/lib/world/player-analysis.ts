import type { WorldPlayerDetail, WorldMetricRank } from "./types";
import type { EfhubAnalysisDetail } from "./analysis-repository";

/**
 * 選手分析レール用の表示データを組み立てる純関数。
 *
 * 方針:
 *  - **既存の育成/ブースター/監督計算には一切触れない。** 表示用データの整形だけ。
 *  - データが無い項目は「ソース未収録」等として返す（架空値・0 埋め・推測をしない）。
 *  - ポジション別 OVR は現行データのどのソースにも無いため数値を返さない（適性のみ）。
 *  - プレーヤーモデル値・状態値の「段階の意味」は未確認 → 生値と確認状態だけ返す。
 */

export type PositionConfirmation = "suitability_only" | "unresolved";
export type TraitConfirmation = "fact" | "raw_unverified" | "missing";
export type PositionCellKind = "registered" | "suitable" | "partial" | "none";

export interface AnalysisPositionCell {
  code: string;
  kind: PositionCellKind;
  /** eFHUB 由来の適性度生値（意味の段階は暫定）。 */
  familiarity: number | null;
}

export interface AnalysisMetric {
  key: string;
  label: string;
  value: number | null;
  overallRank: WorldMetricRank | null;
  positionRank: WorldMetricRank | null;
}

export interface AnalysisModelField {
  key: string;
  label: string;
  value: number | null;
}

export interface AnalysisTrait {
  key: string;
  label: string;
  value: number | string | null;
  confirmation: TraitConfirmation;
}

export interface PlayerAnalysis {
  positions: {
    confirmation: PositionConfirmation;
    registered: string | null;
    grid: (AnalysisPositionCell | null)[][];
    suitableCodes: string[];
    /** eFHUB 詳細のあるカードの、登録＋副ポジションの適性度生値（意味の段階は暫定）。 */
    familiarityRows: { code: string; familiarity: number | null; isRegistered: boolean }[];
    /** 情報源の表記。 */
    source: string;
    ovrNote: string;
    suitabilityNote: string;
  };
  physical: {
    metrics: AnalysisMetric[];
    hasRanks: boolean;
    note: string;
  };
  model: {
    source: "efhub_detail" | "world_partial" | "none";
    fields: AnalysisModelField[];
    availableCount: number;
    note: string;
  };
  skills: {
    playerSkills: string[];
    aiStyles: string[];
    comSkillsFallback: string[];
    highlightAvailable: boolean;
    note: string;
  };
  traits: {
    fields: AnalysisTrait[];
    note: string;
  };
}

/** プレーヤーモデル 11 項目のキー → 日本語表示名（ユーザー提供 + screenshots 2026-08-29 194846 で 1:1 確認）。 */
export const PLAYER_MODEL_LABELS: { key: string; label: string }[] = [
  { key: "armLength", label: "腕の長さ" },
  { key: "shoulderWidth", label: "肩幅" },
  { key: "neckLength", label: "首の長さ" },
  { key: "chestMeasurement", label: "胸囲" },
  { key: "neckSize", label: "首のサイズ" },
  { key: "shoulderHeight", label: "肩の高さ" },
  { key: "legLength", label: "脚の長さ" },
  { key: "thighSize", label: "太もものサイズ" },
  { key: "waistSize", label: "ウエストサイズ" },
  { key: "armSize", label: "腕のサイズ" },
  { key: "calfSize", label: "ふくらはぎのサイズ" },
];

/** 物理データ 5 項目のキー → 日本語表示名（ユーザー提供 + screenshots 194846 で確認）。 */
export const PHYSICAL_METRIC_LABELS: { key: string; label: string }[] = [
  { key: "legCoverageRadius", label: "脚カバー半径" },
  { key: "armCoverageRadius", label: "腕カバー半径" },
  { key: "jumpingHeight", label: "ジャンプ高" },
  { key: "torsoCollision", label: "胴体衝突" },
  { key: "dribbleHeight", label: "脚の長さ基準の身長" },
];

/** ポジショングリッドのテンプレート（当アプリ内部コード表記に統一。null = 空マス）。 */
export const POSITION_GRID_TEMPLATE: (string | null)[][] = [
  ["LWF", "CF", "RWF"],
  [null, "SS", null],
  ["LMF", "AMF", "RMF"],
  ["LWB", "CMF", "RWB"],
  ["LB", "DMF", "RB"],
  [null, "CB", null],
  [null, "GK", null],
];

const MODEL_KEY_SET = new Set(PLAYER_MODEL_LABELS.map((m) => m.key));

/**
 * 「値の大きい順」の順位を、値が大きいほど 100 に近いパーセンタイルへ変換する。
 * ranks_json の rank は 1 = 最大値。`(total − rank) / total` = その値以下のカードの割合。
 * 例: rank 12,733 / 13,009 → 2（＝この値より小さいカードは約 2% だけ = 小さい値）。
 * ranks_json の `topPercent`（≒ rank/total）は「上位◯%」と読むと誤解を生むため使わない。
 */
export function valuePercentile(m: { rank: number; total: number }): number {
  if (m.total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(((m.total - m.rank) / m.total) * 100)));
}

function metricValue(detail: WorldPlayerDetail, key: string): number | null {
  const a = detail.appearance;
  if (!a) return null;
  switch (key) {
    case "legCoverageRadius":
      return a.legCoverageRadius;
    case "armCoverageRadius":
      return a.armCoverageRadius;
    case "jumpingHeight":
      return a.jumpingHeight;
    case "torsoCollision":
      return a.torsoCollision;
    case "dribbleHeight":
      return a.dribbleHeight;
    default:
      return null;
  }
}

export function buildPlayerAnalysis(
  detail: WorldPlayerDetail,
  efhub: EfhubAnalysisDetail | null,
): PlayerAnalysis {
  // eFHUB 詳細のカード同一性を軽く確認（ID 一致 + 登録ポジション一致）。ずれていれば使わない。
  const efhubOk =
    efhub != null &&
    efhub.cardId === detail.worldCardId &&
    (efhub.registeredPosition == null ||
      detail.registeredPosition == null ||
      efhub.registeredPosition === detail.registeredPosition);
  const eff = efhubOk ? efhub : null;

  // ── ポジション適性 ──
  const posByCode = new Map<string, { familiarity: number | null; isRegistered: boolean }>();
  for (const p of eff?.positions ?? []) {
    posByCode.set(p.code, { familiarity: p.familiarity, isRegistered: p.isRegistered });
  }
  const registered = detail.registeredPosition;
  const grid = POSITION_GRID_TEMPLATE.map((row) =>
    row.map((code): AnalysisPositionCell | null => {
      if (code == null) return null;
      const hit = posByCode.get(code);
      const isReg = code === registered || hit?.isRegistered === true;
      let kind: PositionCellKind = "none";
      if (isReg) kind = "registered";
      else if (hit) kind = (hit.familiarity ?? 0) >= 2 ? "suitable" : "partial";
      return { code, kind, familiarity: hit?.familiarity ?? null };
    }),
  );
  const suitableCodes = grid
    .flat()
    .filter((c): c is AnalysisPositionCell => c != null && (c.kind === "suitable" || c.kind === "partial"))
    .map((c) => c.code);
  const familiarityRows = [...(eff?.positions ?? [])]
    .map((p) => ({ code: p.code, familiarity: p.familiarity, isRegistered: p.isRegistered }))
    .sort((a, b) => Number(b.isRegistered) - Number(a.isRegistered) || a.code.localeCompare(b.code));

  // ── 物理データ ──
  const ranks = detail.appearance?.ranks ?? null;
  const metrics: AnalysisMetric[] = PHYSICAL_METRIC_LABELS.map(({ key, label }) => ({
    key,
    label,
    value: metricValue(detail, key),
    overallRank: ranks?.[key]?.overall ?? null,
    positionRank: ranks?.[key]?.position ?? null,
  }));
  const hasRanks = metrics.some((m) => m.overallRank != null);

  // ── プレーヤーモデル ──
  let modelSource: PlayerAnalysis["model"]["source"] = "none";
  const modelFields: AnalysisModelField[] = PLAYER_MODEL_LABELS.map(({ key, label }) => {
    let value: number | null = null;
    if (eff?.playerModel && key in eff.playerModel && MODEL_KEY_SET.has(key)) {
      value = eff.playerModel[key];
    } else if (key === "legLength" && detail.appearance?.legLength != null) {
      value = detail.appearance.legLength;
    }
    return { key, label, value };
  });
  const availableCount = modelFields.filter((f) => f.value != null).length;
  if (eff?.playerModel && availableCount >= PLAYER_MODEL_LABELS.length - 2) modelSource = "efhub_detail";
  else if (availableCount > 0) modelSource = "world_partial";

  // ── スキル ──
  const aiStyles = dedupe((detail.aiStyles ?? []).map((s) => s.trim()).filter((s) => s !== "" && s !== "-"));
  const comSkillsFallback =
    aiStyles.length === 0
      ? dedupe((eff?.comSkills ?? []).map(camelToTitle).filter(Boolean))
      : [];

  // ── その他特性 ──
  const traits: AnalysisTrait[] = [
    { key: "preferredFoot", label: "利き足", value: detail.preferredFoot ?? null, confirmation: detail.preferredFoot ? "fact" : "missing" },
    { key: "height", label: "身長", value: detail.height != null ? `${detail.height} cm` : null, confirmation: detail.height != null ? "fact" : "missing" },
    { key: "weight", label: "体重", value: detail.weight != null ? `${detail.weight} kg` : null, confirmation: detail.weight != null ? "fact" : "missing" },
    { key: "age", label: "年齢", value: detail.age ?? null, confirmation: detail.age != null ? "fact" : "missing" },
    trait("weakFootUsage", "逆足頻度", eff?.weakFootUsage),
    trait("weakFootAccuracy", "逆足精度", eff?.weakFootAccuracy),
    trait("form", "フォーム", eff?.form),
    trait("conditionValue", "コンディション安定度", eff?.conditionValue),
    trait("injuryResistance", "怪我耐性", eff?.injuryResistance),
  ];

  return {
    positions: {
      confirmation: eff ? "suitability_only" : "unresolved",
      registered,
      grid,
      suitableCodes,
      familiarityRows,
      source: eff
        ? "登録ポジション: eFootball World ／ 副ポジション適性: eFHUB 個別ページ"
        : "登録ポジション: eFootball World（副ポジション適性はこのカードのソースに未収録）",
      ovrNote:
        "ポジション別 OVR は、計算規則を確認できていないため表示していません。KONAMI は算式・重みを公開しておらず、複数カードの表示値サンプルも 1 件しか得られていません（推測で算式を作りません）。",
      suitabilityNote: eff
        ? "eFHUB 個別ページ由来の副ポジション適性です。適性度の生値 1 / 2 の意味（部分適性 / 高適性）は暫定解釈です。"
        : "このカードのソースには副ポジション適性が未収録です（登録ポジションのみ確認済み）。",
    },
    physical: {
      metrics,
      hasRanks,
      note: hasRanks
        ? "順位は eFootball World の順位集計時点の全カード実データで「値の大きい順」に並べたもの（1 位 = 最大値）。母数は集計時点の件数で、現在の収録件数とは異なる場合があります。パーセンタイルは 100 に近いほど値が大きいことを表します。ゲーム内での正確な作用は追加検証中の内部値です。"
        : "内部モデル値です。相対評価（順位・パーセンタイル）は準備中です。",
    },
    model: {
      source: modelSource,
      fields: modelFields,
      availableCount,
      note:
        modelSource === "efhub_detail"
          ? "eFHUB 個別ページ由来の内部モデル値です。単位・尺度は未確認のため cm 等は付けません。数値が大きいほど実寸が比例して大きいとは限りません。"
          : modelSource === "world_partial"
            ? "このカードのソースには一部のモデル値だけが収録されています。残りは未収録です。"
            : "このカードのソースにはプレーヤーモデル値が未収録です。",
    },
    skills: {
      playerSkills: dedupe((detail.playerSkills ?? []).map((s) => s.trim()).filter(Boolean)),
      aiStyles,
      comSkillsFallback,
      highlightAvailable: false,
      note: "Highlight Skill / Skill FX の判別情報は現行データに未収録のため、すべて「選手スキル」として表示します（推測で分類しません）。",
    },
    traits: {
      fields: traits,
      note: "逆足頻度・精度・フォーム・怪我耐性は生値です。段階の意味（低い/普通/高い等）は KONAMI 公式の表記を確認できていないため、数値のまま表示します。",
    },
  };
}

function trait(key: string, label: string, value: number | null | undefined): AnalysisTrait {
  return {
    key,
    label,
    value: value ?? null,
    confirmation: value == null ? "missing" : "raw_unverified",
  };
}

function dedupe(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of arr) {
    if (!seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

function camelToTitle(s: string): string {
  return s
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}
