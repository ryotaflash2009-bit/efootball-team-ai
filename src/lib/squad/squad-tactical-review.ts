import type { SquadDiagnosisResult, SquadDiagnosisCategoryId } from "./squad-diagnosis";
import { analyzeSquadDiagnosis, type CategoryRelationship } from "./squad-diagnosis-comments";
import type { SquadSlotResult, FormationDef } from "./types";

/**
 * 辛口コメント専用の「配置構造・戦術監査」（旧名: 詳細戦術監査）。
 *
 * 名称と対象範囲について:
 *  - この分析は、配置ポジション（フォーメーション座標・ライン構成）と、既存の確認済み8カテゴリ診断結果
 *    にもとづく**構造分析**であり、選手固有のプレースタイル連携・発動可否・AI挙動・実際の試合内動作の
 *    分析ではない。プレースタイル名は参考情報として文章に含めることはあるが、発動有無の判定には使用しない
 *    （本プロジェクト内に、プレースタイル名と発動対象ポジションの確認済み対応表が存在しないため）。
 *  - 役割タグ（`RoleTagId`）は、フォーメーションのポジションラベル（GK/CB/LB/…/CF）に対する一般的・構造的な
 *    分類（標準的なサッカーのポジション理論）にすぎず、「この選手が必ずこう動く」という断定ではない。
 *
 * 配置充足ゲート（今回追加）:
 *  - 先発の配置人数がごく少数（例: 2/11人）でも、既存8カテゴリ診断は算出可能な場合がある
 *    （`scoreSquadCategory` は対象フィールドプレイヤーが1人でもいれば非null のスコアを返す）。
 *    そのため、配置がごく少数でも `SquadDiagnosisResult.overall.score` が非nullになり得る。
 *  - 本モジュールはこの状態を独立して検知し（`assessTacticalCoverage`）、配置充足状況に応じた
 *    信頼度の上限（`overallConfidenceCap`）を全findingへ適用する。finding固有の信頼度と配置充足上限の
 *    うち低い方を最終表示信頼度として採用する（`CONFIDENCE_ORDER` にもとづく明示的な比較。文字列比較には
 *    依存しない）。
 *  - 配置が極端に不足する場合（`insufficient`）は、エリア別・役割別・局面別のfindingを生成せず、
 *    「配置不足のため分析範囲が限定的」という単一の案内だけを返す。数値上のカテゴリ差はこの案内の中で
 *    「参考情報」として言及することはあるが、独立した確定的な戦術findingとしては表示しない。
 *
 * 決定性:
 *  - 入力は「既存の `SquadDiagnosisResult`」と「既存の `buildSquad()` 出力が既に保持している先発の
 *    配置情報（`TacticalPlacementInput[]`）」だけ。新しい能力値計算・診断エンジンの再実行は一切行わない。
 *  - 同一入力からは常に同一の `TacticalReviewAnalysis` / `TacticalFinding[]` を返す
 *    （Math.random 不使用・日時非依存・入力オブジェクトを変更しない）。
 */

// ---------------------------------------------------------------------------
// 型
// ---------------------------------------------------------------------------

export type TacticalArea = "left" | "center" | "right" | "whole" | "unknown";
export type TacticalPhase = "buildUp" | "attack" | "defense" | "transitionToAttack" | "transitionToDefense" | "general";
export type FindingSeverity = "info" | "low" | "medium" | "high";
export type FindingConfidence = "high" | "medium" | "low" | "insufficient";

/** 信頼度の明示的な順序（低→高）。文字列比較・Object.keys順には依存しない。 */
export const CONFIDENCE_ORDER: FindingConfidence[] = ["insufficient", "low", "medium", "high"];

function capConfidence(intrinsic: FindingConfidence, cap: FindingConfidence): FindingConfidence {
  const intrinsicIdx = CONFIDENCE_ORDER.indexOf(intrinsic);
  const capIdx = CONFIDENCE_ORDER.indexOf(cap);
  return CONFIDENCE_ORDER[Math.min(intrinsicIdx, capIdx)];
}

export type TacticalFindingType =
  | "referenceError"
  | "dataInsufficient"
  | "coverageInsufficient"
  | "roleDuplication"
  | "roleShortage"
  | "categoryPhaseRisk"
  | "wellComplemented"
  | "inconclusive";

export interface TacticalFinding {
  id: string;
  type: TacticalFindingType;
  severity: FindingSeverity;
  /** 最終表示信頼度（finding固有の信頼度と配置充足上限のうち低い方）。 */
  confidence: FindingConfidence;
  area: TacticalArea;
  phase: TacticalPhase;
  title: string;
  summary: string;
  explanation: string;
  evidence: string[];
  /** 表示用（ポジション名＋選手名）。内部の slotId・worldCardId は含めない。 */
  affectedPlayers: string[];
  potentialRisk: string | null;
  recommendations: string[];
  limitations: string | null;
}

/**
 * 戦術分析への入力（1先発枠ぶん）。`buildSquad()` の出力（`SquadComputed.slots`）から
 * 呼び出し側が組み立てる、読み取り専用の最小データ。**未配置の枠も含めて渡すこと**
 * （配置充足状況の判定に必要なため。埋まっている枠だけを渡すと充足状況を誤判定する）。
 */
export interface TacticalPlacementInput {
  slotId: string;
  /** "LB" "CB" "DMF" 等のポジションラベル。 */
  position: string;
  /** 0(左)〜100(右)。 */
  x: number;
  /** 0(攻撃方向)〜100(自陣)。自由配置時は実座標。 */
  y: number;
  role: "GK" | "DF" | "MF" | "FW";
  /** フォーメーション上の守備的→攻撃的ライン番号（隣接判定に使用）。 */
  line: number;
  /** 表示名（解決済み）。 */
  nameLabel: string;
  playingStyle: string | null;
  playingStyleDefensive: string | null;
  /** 枠が埋まっているか（未配置なら false）。 */
  filled: boolean;
}

export type TacticalCoverage = "insufficient" | "limited" | "partial" | "full";

/** 配置充足状況の分析全体を表す（個々のfindingとは別に保持する、辛口専用の集約結果）。 */
export interface TacticalReviewAnalysis {
  coverage: TacticalCoverage;
  expectedFieldPlayerCount: number;
  placedFieldPlayerCount: number;
  /** 判定できたチャンネル（後方/中盤/前方）の数（0-3）。実座標にもとづく。 */
  verticalBandsCovered: number;
  /** 判定できたエリア（左/中央/右）の数（0-3）。 */
  areasCovered: number;
  /** 配置充足状況にもとづく信頼度の上限。全findingの最終信頼度はこれを超えない。 */
  overallConfidenceCap: FindingConfidence;
  canAnalyzeAreas: boolean;
  canAnalyzeAdjacency: boolean;
  canAnalyzeGlobalStructure: boolean;
  /** 分析全体に対する制限事項（個々のfindingで繰り返さず、ここへ集約する）。 */
  limitations: string[];
  findings: TacticalFinding[];
}

// ---------------------------------------------------------------------------
// 定数（閾値・分類基準を明示する）
// ---------------------------------------------------------------------------

/** x座標がこの値未満なら左側、この値超は右側。境界付近は中央に寄せ、無理に左右へ分類しない。 */
const AREA_LEFT_MAX = 40;
const AREA_RIGHT_MIN = 60;

/**
 * 前方/中盤/後方の判定に使う y座標の帯（自由配置時の実座標を優先して使う。フォーメーション上の
 * 静的な line 番号ではなく、実際の配置座標から判定する）。既存11フォーメーション定義
 * （`formations.ts`）の実測値を調査した結果、FWは y<30、DFは y>65 に収まり、
 * MF（DMF/CMF/LMF/RMF/AMFいずれも）は概ね y 34〜60 の範囲に収まるため、この2閾値を採用する。
 */
const VERTICAL_FRONT_MAX_Y = 30;
const VERTICAL_BACK_MIN_Y = 65;

function classifyVerticalBand(y: number): "back" | "mid" | "front" | "unknown" {
  if (!Number.isFinite(y)) return "unknown";
  if (y < VERTICAL_FRONT_MAX_Y) return "front";
  if (y > VERTICAL_BACK_MIN_Y) return "back";
  return "mid";
}

/**
 * 隣接関係の閾値。既存の11フォーメーション定義を調査した結果、同一ラインの隣接選手間は
 * x差 20〜26 程度、隣接ライン間の関係は x差 3〜23 程度に収まる一方、明らかに無関係な組み合わせ
 * （例: LBとRB、LMFとRMF）は x差 30 以上離れているため、「ライン差 1 以内 かつ x差 28 以内」を
 * 隣接の判定基準とする。
 */
const ADJACENCY_MAX_LINE_DIFF = 1;
const ADJACENCY_MAX_X_DIFF = 28;

/**
 * 配置充足状況の判定しきい値。全11フォーメーション定義（`formations.ts`）は、GKを除く
 * フィールドプレイヤー枠が常に10であることを確認済み（4-3-3〜5-3-2まで共通）。
 * - 4人未満: 前方/中盤/後方のうち複数チャンネルを跨いだ評価がほぼ不可能な水準として `insufficient`。
 * - 4〜6人、またはチャンネルが2つ以下: スカッド全体の評価には不十分だが、局所的な事実は確認できる
 *   可能性がある水準として `limited`。
 * - 7人以上かつ全チャンネル確認可能だが、欠員またはエリア未確認がある: `partial`。
 * - 期待人数ちょうど かつ 全チャンネル・全エリア確認可能: `full`。
 */
const COVERAGE_MIN_FOR_LIMITED = 4;
const COVERAGE_MIN_FOR_PARTIAL = 7;

const COVERAGE_CONFIDENCE_CAP: Record<TacticalCoverage, FindingConfidence> = {
  insufficient: "insufficient",
  limited: "low",
  partial: "medium",
  full: "high",
};

type RoleTagId = "advancing" | "receiving" | "linking" | "covering" | "wideOutlet";

/** 配置構造上の役割ラベル（選手固有の挙動ではなく、ポジションラベルに対する一般的な構造分類）。 */
const ROLE_TAG_LABELS: Record<RoleTagId, string> = {
  advancing: "配置構造上、前方へ進出する役割",
  receiving: "配置構造上、ボールを受ける役割",
  linking: "配置構造上、配球または中継を担う役割",
  covering: "配置構造上、後方をカバーする役割",
  wideOutlet: "配置構造上、幅を確保する役割",
};

/**
 * ポジションラベルに対する一般的・構造的な役割分類（標準的なサッカーのポジション理論にもとづく静的な
 * 対応表）。**選手固有のプレースタイル・AI挙動・確認済みの試合内動作を示すものではない**。
 * この選手が実際にその動きを必ず行うという意味ではなく、「この配置ラベルが一般的に担う構造上の位置関係」
 * という分類にとどまる。
 */
const STRUCTURAL_ROLE_BY_POSITION: Record<string, { tags: RoleTagId[]; relatedCategoryIds: SquadDiagnosisCategoryId[] }> = {
  GK: { tags: [], relatedCategoryIds: [] },
  CB: { tags: ["covering"], relatedCategoryIds: ["defense", "aerial"] },
  LB: { tags: ["wideOutlet", "covering"], relatedCategoryIds: ["defense", "attack"] },
  RB: { tags: ["wideOutlet", "covering"], relatedCategoryIds: ["defense", "attack"] },
  DMF: { tags: ["linking", "covering"], relatedCategoryIds: ["passBuildUp", "defense"] },
  CMF: { tags: ["linking"], relatedCategoryIds: ["passBuildUp", "dribblePossession"] },
  LMF: { tags: ["wideOutlet", "advancing"], relatedCategoryIds: ["attack", "passBuildUp"] },
  RMF: { tags: ["wideOutlet", "advancing"], relatedCategoryIds: ["attack", "passBuildUp"] },
  AMF: { tags: ["advancing", "receiving"], relatedCategoryIds: ["attack", "dribblePossession"] },
  LWF: { tags: ["advancing", "wideOutlet"], relatedCategoryIds: ["attack", "speed"] },
  RWF: { tags: ["advancing", "wideOutlet"], relatedCategoryIds: ["attack", "speed"] },
  CF: { tags: ["advancing"], relatedCategoryIds: ["attack", "aerial"] },
};

/** 役割の重複・不足を検出する際、「後方/中継」側とみなすタグ（advancingの偏りを打ち消す側）。 */
const COMPLEMENTARY_TAGS: RoleTagId[] = ["covering", "linking", "receiving"];

const AREA_ORDER: TacticalArea[] = ["left", "center", "right", "whole", "unknown"];
const AREA_LABELS: Record<TacticalArea, string> = {
  left: "左側",
  center: "中央",
  right: "右側",
  whole: "チーム全体",
  unknown: "分類不能",
};

/** 8カテゴリの矛盾候補（`CommentAnalysis.contradictions`）を局面へ対応づける固定表。 */
const CONTRADICTION_PHASE_MAP: Record<string, TacticalPhase> = {
  "attack:passBuildUp": "buildUp",
  "attack:dribblePossession": "attack",
  "speed:passBuildUp": "buildUp",
  "pressResistance:defense": "transitionToDefense",
  "counterAttack:speed": "transitionToAttack",
  "defense:aerial": "defense",
  "passBuildUp:dribblePossession": "buildUp",
  "attack:defense": "transitionToDefense",
  "defense:attack": "transitionToAttack",
};

const PHASE_LABELS: Record<TacticalPhase, string> = {
  buildUp: "ビルドアップ",
  attack: "攻撃",
  defense: "守備",
  transitionToAttack: "守備から攻撃への切り替え",
  transitionToDefense: "攻撃から守備への切り替え",
  general: "全般",
};

/** 主要findingの最大表示件数。 */
const MAX_MAIN_FINDINGS = 3;

// ---------------------------------------------------------------------------
// 配置充足状況の判定（今回追加）
// ---------------------------------------------------------------------------

function assessTacticalCoverage(placements: TacticalPlacementInput[]): {
  coverage: TacticalCoverage;
  expectedFieldPlayerCount: number;
  placedFieldPlayerCount: number;
  verticalBandsCovered: number;
  areasCovered: number;
} {
  const fieldSlots = placements.filter((p) => p.role !== "GK");
  const expected = fieldSlots.length;
  const placedField = fieldSlots.filter((p) => p.filled);
  const placedCount = placedField.length;
  const bands = new Set(placedField.map((p) => classifyVerticalBand(p.y)).filter((b) => b !== "unknown"));
  const areas = new Set(placedField.map((p) => classifyArea(p.x)));

  let coverage: TacticalCoverage;
  if (placedCount < COVERAGE_MIN_FOR_LIMITED || bands.size <= 1) {
    coverage = "insufficient";
  } else if (placedCount < COVERAGE_MIN_FOR_PARTIAL || bands.size < 3) {
    coverage = "limited";
  } else if (placedCount < expected || areas.size < 3) {
    coverage = "partial";
  } else {
    coverage = "full";
  }

  return {
    coverage,
    expectedFieldPlayerCount: expected,
    placedFieldPlayerCount: placedCount,
    verticalBandsCovered: bands.size,
    areasCovered: areas.size,
  };
}

// ---------------------------------------------------------------------------
// 幾何分類（確定座標からの決定的な導出。ゲーム内挙動の推測は含まない）
// ---------------------------------------------------------------------------

function classifyArea(x: number): TacticalArea {
  if (!Number.isFinite(x)) return "unknown";
  if (x < AREA_LEFT_MAX) return "left";
  if (x > AREA_RIGHT_MIN) return "right";
  return "center";
}

interface FilledPlacement extends TacticalPlacementInput {
  area: TacticalArea;
  roleTags: RoleTagId[];
  relatedCategoryIds: SquadDiagnosisCategoryId[];
}

function toFilledPlacements(placements: TacticalPlacementInput[]): FilledPlacement[] {
  return placements
    .filter((p) => p.filled && p.role !== "GK")
    .map((p) => {
      const def = STRUCTURAL_ROLE_BY_POSITION[p.position] ?? { tags: [], relatedCategoryIds: [] };
      return { ...p, area: classifyArea(p.x), roleTags: def.tags, relatedCategoryIds: def.relatedCategoryIds };
    });
}

/** 隣接ペア（両方とも先発・GK以外）をフォーメーション座標から決定的に求める。 */
function findAdjacentPairs(placements: FilledPlacement[]): [FilledPlacement, FilledPlacement][] {
  const pairs: [FilledPlacement, FilledPlacement][] = [];
  for (let i = 0; i < placements.length; i++) {
    for (let j = i + 1; j < placements.length; j++) {
      const a = placements[i];
      const b = placements[j];
      if (Math.abs(a.line - b.line) <= ADJACENCY_MAX_LINE_DIFF && Math.abs(a.x - b.x) <= ADJACENCY_MAX_X_DIFF) {
        pairs.push([a, b]);
      }
    }
  }
  return pairs;
}

function playerLabel(p: TacticalPlacementInput): string {
  return `${p.position}・${p.nameLabel}`;
}

// ---------------------------------------------------------------------------
// finding生成: 参照エラー / データ不足（最優先・単独。配置充足状況にかかわらず表示）
// ---------------------------------------------------------------------------

function blockingFinding(result: SquadDiagnosisResult): TacticalFinding | null {
  if (result.dataQuality.brokenSavedBuildRefCount > 0) {
    return {
      id: "tactical-reference-error",
      type: "referenceError",
      severity: "high",
      confidence: "insufficient",
      area: "whole",
      phase: "general",
      title: "保存ビルド参照エラーの解消が先決です",
      summary: `保存ビルドの参照エラーが${result.dataQuality.brokenSavedBuildRefCount}件あります。`,
      explanation: "参照が解決しない選手が含まれるため、配置構造にもとづく分析は行いません。",
      evidence: [`保存ビルド参照エラー: ${result.dataQuality.brokenSavedBuildRefCount}件`],
      affectedPlayers: [],
      potentialRisk: null,
      recommendations: ["該当する枠の保存ビルドを選び直してください。"],
      limitations: "参照エラーが解消するまで、配置構造にもとづく分析は制限されます。",
    };
  }
  if (result.overall.score == null) {
    return {
      id: "tactical-data-insufficient",
      type: "dataInsufficient",
      severity: "high",
      confidence: "insufficient",
      area: "whole",
      phase: "general",
      title: "配置情報が不足しており分析を行えません",
      summary: "先発にフィールドプレイヤーが配置されておらず、分析できる材料がありません。",
      explanation: "エリア・隣接関係・局面別のいずれの分析も、先発配置が確定していることが前提となります。",
      evidence: ["先発の判定可能カテゴリ: 0"],
      affectedPlayers: [],
      potentialRisk: null,
      recommendations: ["先発にフィールドプレイヤーを配置してください。"],
      limitations: "先発配置が確定するまで、配置構造にもとづく分析は行えません。",
    };
  }
  return null;
}

/** 配置が極端に不足している場合の単独案内（数値上のカテゴリ差は「参考情報」として言及するにとどめる）。 */
function coverageInsufficientFinding(
  result: SquadDiagnosisResult,
  cov: ReturnType<typeof assessTacticalCoverage>,
): TacticalFinding {
  const analysis = analyzeSquadDiagnosis(result);
  const evidence = [`先発フィールドプレイヤー配置: ${cov.placedFieldPlayerCount}/${cov.expectedFieldPlayerCount}人`];
  let numericNote = "";
  const top = analysis.contradictions[0];
  if (top) {
    evidence.push(
      `参考情報（数値上の傾向）: ${top.highCategory.label}（${top.highCategory.score}点）と${top.lowCategory.label}（${top.lowCategory.score}点）に${top.gap}点の差`,
    );
    numericNote = `${top.highCategory.label}と${top.lowCategory.label}には数値上の差がありますが、`;
  }
  return {
    id: "tactical-coverage-insufficient",
    type: "coverageInsufficient",
    severity: "medium",
    confidence: "insufficient",
    area: "whole",
    phase: "general",
    title: "配置構造分析: 先発配置が不足しています",
    summary: `現在は先発配置が${cov.placedFieldPlayerCount}/${cov.expectedFieldPlayerCount}人のため、エリア別連携や局面別リスクを十分な信頼度で評価できません。`,
    explanation: `${numericNote}スカッド全体の戦術的な問題として断定できる段階ではありません。数値上のカテゴリ差は参考情報にとどまります。`,
    evidence,
    affectedPlayers: [],
    potentialRisk: null,
    recommendations: ["先発配置を完成させた後、配置構造・戦術監査を再確認してください。"],
    limitations: "配置人数が少ないため、エリア別・局面別の詳細な分析は行っていません。",
  };
}

// ---------------------------------------------------------------------------
// finding生成: エリア別の役割重複・後方/中継不足
// ---------------------------------------------------------------------------

function areaRoleFindings(placements: FilledPlacement[], result: SquadDiagnosisResult): TacticalFinding[] {
  const findings: TacticalFinding[] = [];
  const categoriesById = new Map(result.categories.map((c) => [c.id, c]));
  const adjacentPairs = findAdjacentPairs(placements);

  for (const area of ["left", "center", "right"] as const) {
    const inArea = placements.filter((p) => p.area === area);
    if (inArea.length < 2) continue;

    const advancing = inArea.filter((p) => p.roleTags.includes("advancing"));
    const complementary = inArea.filter((p) => p.roleTags.some((t) => COMPLEMENTARY_TAGS.includes(t)));
    const uncomplementedAdjacentAdvancingPairs = adjacentPairs.filter(
      ([a, b]) =>
        a.area === area &&
        b.area === area &&
        a.roleTags.includes("advancing") &&
        b.roleTags.includes("advancing") &&
        !a.roleTags.some((t) => COMPLEMENTARY_TAGS.includes(t)) &&
        !b.roleTags.some((t) => COMPLEMENTARY_TAGS.includes(t)),
    );

    if (advancing.length >= 2 && complementary.length === 0) {
      const relatedIds = Array.from(new Set(advancing.flatMap((p) => p.relatedCategoryIds)));
      const weakRelated = relatedIds
        .map((id) => categoriesById.get(id))
        .filter((c): c is NonNullable<typeof c> => !!c && c.score != null && (c.tier === "D" || c.tier === "C"));

      const evidence = [
        `${AREA_LABELS[area]}に「${ROLE_TAG_LABELS.advancing}」に該当する配置が${advancing.length}人（${advancing.map(playerLabel).join(" / ")}）`,
        `${AREA_LABELS[area]}で後方をカバーまたは中継を担う配置構造上の役割は見つかりません`,
      ];
      for (const c of weakRelated) {
        evidence.push(`既存診断: ${c.label}が${c.tier}ランク（${c.score}点）`);
      }
      if (uncomplementedAdjacentAdvancingPairs.length > 0) {
        const [a, b] = uncomplementedAdjacentAdvancingPairs[0];
        evidence.push(`隣接する${playerLabel(a)}と${playerLabel(b)}が、いずれも配置構造上前方へ進出する役割で補完役が確認できません`);
      }

      const anyUnresolved = inArea.some((p) => p.role !== "DF" && p.role !== "MF" && p.role !== "FW");
      findings.push({
        id: `tactical-role-dup-${area}`,
        type: "roleDuplication",
        severity: weakRelated.length > 0 ? "high" : "medium",
        confidence: anyUnresolved ? "low" : weakRelated.length > 0 ? "high" : "medium",
        area,
        phase: "transitionToDefense",
        title: `${AREA_LABELS[area]}で前方へ進出する配置構造上の役割が重複しています`,
        summary: `${AREA_LABELS[area]}に前方へ進出する配置構造上の役割が集中しており、後方を補完する役割が見当たりません。`,
        explanation: `${AREA_LABELS[area]}の配置は前方への関与に偏っており、ボールを失った直後の対応を支える配置構造上の役割が確認できません。`,
        evidence,
        affectedPlayers: advancing.map(playerLabel),
        potentialRisk: `ボールを失った直後、${AREA_LABELS[area]}のスペースが残り、他のエリアが対応を迫られる可能性があります。`,
        recommendations: [
          `${AREA_LABELS[area]}へ後方または内側を補完できる役割の選手・保存ビルドの配置を検討する`,
          weakRelated.length > 0 ? `${weakRelated[0].label}に関わる選手の育成・配置を見直す` : `${AREA_LABELS[area]}の役割分担を見直す`,
        ],
        limitations: anyUnresolved ? "一部の枠の情報が不確実なため、確信度は限定的です。" : null,
      });
    }
  }
  return findings;
}

/** ビルドアップの中継役（DMF/CMF等）が先発に確認できず、既存のパス・ビルドアップ評価も低い場合。 */
function buildUpShortageFinding(placements: FilledPlacement[], result: SquadDiagnosisResult): TacticalFinding | null {
  const hasLinking = placements.some((p) => p.roleTags.includes("linking"));
  if (hasLinking) return null;
  const passCategory = result.categories.find((c) => c.id === "passBuildUp");
  if (!passCategory || passCategory.score == null || (passCategory.tier !== "C" && passCategory.tier !== "D")) return null;

  return {
    id: "tactical-buildup-shortage",
    type: "roleShortage",
    severity: "medium",
    confidence: "medium",
    area: "whole",
    phase: "buildUp",
    title: "ビルドアップの中継役が確認できません",
    summary: "後方と前方をつなぐ、配置構造上の配球・中継役に該当する配置が見当たりません。",
    explanation: "DMF・CMFに相当する配置が無い、またはその枠が空いているため、後方から前方への経路を支える配置構造上の役割が確認できません。",
    evidence: [
      "先発に「配置構造上、配球または中継を担う役割」に対応する配置（DMF・CMF等）が見当たりません",
      `既存診断: パス・ビルドアップが${passCategory.tier}ランク（${passCategory.score}点）`,
    ],
    affectedPlayers: [],
    potentialRisk: "中央を制限された場合、前方へボールを運ぶ経路が単調になる可能性があります。",
    recommendations: ["中盤に中継を担える所持選手・保存ビルドの配置を検討する", "パス・ビルドアップに関わる能力の育成を見直す"],
    limitations: null,
  };
}

// ---------------------------------------------------------------------------
// finding生成: 既存の8カテゴリ矛盾候補 → 局面別リスクへの再解釈（新規スコア計算なし）
// ---------------------------------------------------------------------------

function contradictionToPhaseFinding(rel: CategoryRelationship, index: number): TacticalFinding | null {
  const key = `${rel.highCategory.id}:${rel.lowCategory.id}`;
  const phase = CONTRADICTION_PHASE_MAP[key];
  if (!phase) return null;
  return {
    id: `tactical-phase-risk-${index}`,
    type: "categoryPhaseRisk",
    severity: rel.gap >= 30 ? "high" : "medium",
    confidence: "high",
    area: "whole",
    phase,
    title: `${PHASE_LABELS[phase]}局面での構造的リスク`,
    summary: rel.description,
    explanation: `既存診断の${rel.highCategory.label}（${rel.highCategory.tier}・${rel.highCategory.score}点）と${rel.lowCategory.label}（${rel.lowCategory.tier}・${rel.lowCategory.score}点）の差にもとづく、${PHASE_LABELS[phase]}局面での構造上の傾向です。`,
    evidence: [
      `${rel.highCategory.label}: ${rel.highCategory.tier}ランク（${rel.highCategory.score}点）`,
      `${rel.lowCategory.label}: ${rel.lowCategory.tier}ランク（${rel.lowCategory.score}点）`,
      `点差: ${rel.gap}点`,
    ],
    affectedPlayers: [],
    potentialRisk: `${PHASE_LABELS[phase]}の局面で、${rel.lowCategory.label}の低さが構成上の弱点として表れる可能性があります。`,
    recommendations: [`${rel.lowCategory.label}に関わる選手の配置・育成を優先して見直す`],
    limitations: null,
  };
}

// ---------------------------------------------------------------------------
// 優先順位付け・件数制限
// ---------------------------------------------------------------------------

const TYPE_PRIORITY: Record<TacticalFindingType, number> = {
  referenceError: 0,
  dataInsufficient: 1,
  coverageInsufficient: 2,
  roleDuplication: 3,
  roleShortage: 4,
  categoryPhaseRisk: 5,
  wellComplemented: 6,
  inconclusive: 6,
};

const SEVERITY_RANK: Record<FindingSeverity, number> = { high: 0, medium: 1, low: 2, info: 3 };

function sortFindings(findings: TacticalFinding[]): TacticalFinding[] {
  return [...findings].sort((a, b) => {
    if (TYPE_PRIORITY[a.type] !== TYPE_PRIORITY[b.type]) return TYPE_PRIORITY[a.type] - TYPE_PRIORITY[b.type];
    if (SEVERITY_RANK[a.severity] !== SEVERITY_RANK[b.severity]) return SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    return AREA_ORDER.indexOf(a.area) - AREA_ORDER.indexOf(b.area);
  });
}

function applyCap(finding: TacticalFinding, cap: FindingConfidence): TacticalFinding {
  const capped = capConfidence(finding.confidence, cap);
  if (capped === finding.confidence) return finding;
  return { ...finding, confidence: capped };
}

// ---------------------------------------------------------------------------
// メイン
// ---------------------------------------------------------------------------

/**
 * 辛口コメント専用の「配置構造・戦術監査」を行い、配置充足状況の集約結果（`TacticalReviewAnalysis`）を返す。
 * `placements` には、先発フォーメーションの全枠（未配置を含む）を渡すこと。渡さない場合
 * （呼び出し側が配置情報を用意できない場合）は、配置充足状況を検証できないため、信頼度上限を
 * `medium` として扱い、既存カテゴリ矛盾にもとづく局面別リスクだけを生成する（エリア・役割分析は行わない）。
 */
export function buildTacticalReview(
  result: SquadDiagnosisResult,
  placements: TacticalPlacementInput[] | null,
): TacticalReviewAnalysis {
  const blocking = blockingFinding(result);
  if (blocking) {
    return {
      coverage: "insufficient",
      expectedFieldPlayerCount: 0,
      placedFieldPlayerCount: 0,
      verticalBandsCovered: 0,
      areasCovered: 0,
      overallConfidenceCap: "insufficient",
      canAnalyzeAreas: false,
      canAnalyzeAdjacency: false,
      canAnalyzeGlobalStructure: false,
      limitations: [blocking.limitations ?? ""].filter(Boolean),
      findings: [blocking],
    };
  }

  if (!placements) {
    // 配置情報が渡されない場合は充足状況を検証できないため、安全側で medium を上限とする。
    const analysis = analyzeSquadDiagnosis(result);
    const findings = analysis.contradictions
      .map((rel, i) => contradictionToPhaseFinding(rel, i))
      .filter((f): f is TacticalFinding => f != null)
      .map((f) => applyCap(f, "medium"));
    const sorted = sortFindings(findings).slice(0, MAX_MAIN_FINDINGS);
    const limitations = ["配置情報が渡されていないため、エリア別・役割別の分析は行っていません。信頼度は medium 以下に制限しています。"];
    if (sorted.length === 0) {
      return {
        coverage: "limited",
        expectedFieldPlayerCount: 0,
        placedFieldPlayerCount: 0,
        verticalBandsCovered: 0,
        areasCovered: 0,
        overallConfidenceCap: "medium",
        canAnalyzeAreas: false,
        canAnalyzeAdjacency: false,
        canAnalyzeGlobalStructure: false,
        limitations,
        findings: [inconclusiveFinding(limitations)],
      };
    }
    return {
      coverage: "limited",
      expectedFieldPlayerCount: 0,
      placedFieldPlayerCount: 0,
      verticalBandsCovered: 0,
      areasCovered: 0,
      overallConfidenceCap: "medium",
      canAnalyzeAreas: false,
      canAnalyzeAdjacency: false,
      canAnalyzeGlobalStructure: false,
      limitations,
      findings: sorted,
    };
  }

  const cov = assessTacticalCoverage(placements);

  if (cov.coverage === "insufficient") {
    const finding = coverageInsufficientFinding(result, cov);
    return {
      coverage: cov.coverage,
      expectedFieldPlayerCount: cov.expectedFieldPlayerCount,
      placedFieldPlayerCount: cov.placedFieldPlayerCount,
      verticalBandsCovered: cov.verticalBandsCovered,
      areasCovered: cov.areasCovered,
      overallConfidenceCap: "insufficient",
      canAnalyzeAreas: false,
      canAnalyzeAdjacency: false,
      canAnalyzeGlobalStructure: false,
      limitations: [finding.limitations ?? ""].filter(Boolean),
      findings: [finding],
    };
  }

  const cap = COVERAGE_CONFIDENCE_CAP[cov.coverage];
  const filled = toFilledPlacements(placements);
  const findings: TacticalFinding[] = [];

  findings.push(...areaRoleFindings(filled, result).map((f) => applyCap(f, cap)));
  // 「中継役が存在しない」はスカッド全体に対する否定的な断定であり、未配置の枠に本来配置される
  // はずの役割を見落としているだけの可能性がある（配置不足と役割不足の混同を避ける）。
  // そのため、大半の枠が確定している partial/full のときだけ生成する（limited では生成しない）。
  if (cov.coverage === "partial" || cov.coverage === "full") {
    const shortage = buildUpShortageFinding(filled, result);
    if (shortage) findings.push(applyCap(shortage, cap));
  }

  const analysis = analyzeSquadDiagnosis(result);
  analysis.contradictions.forEach((rel, i) => {
    const f = contradictionToPhaseFinding(rel, i);
    if (f) findings.push(applyCap(f, cap));
  });

  const sorted = sortFindings(findings);
  const main = sorted.slice(0, MAX_MAIN_FINDINGS);

  const limitations: string[] = [];
  if (cov.coverage !== "full") {
    limitations.push(
      `先発フィールドプレイヤーの配置は${cov.placedFieldPlayerCount}/${cov.expectedFieldPlayerCount}人です。分析の信頼度は${cap}が上限です。`,
    );
  }

  if (main.length === 0) {
    const finding = cov.coverage === "full" || cov.coverage === "partial" ? wellComplementedFinding() : inconclusiveFinding(limitations);
    return {
      coverage: cov.coverage,
      expectedFieldPlayerCount: cov.expectedFieldPlayerCount,
      placedFieldPlayerCount: cov.placedFieldPlayerCount,
      verticalBandsCovered: cov.verticalBandsCovered,
      areasCovered: cov.areasCovered,
      overallConfidenceCap: cap,
      canAnalyzeAreas: true,
      canAnalyzeAdjacency: true,
      canAnalyzeGlobalStructure: cov.coverage !== "limited",
      limitations,
      findings: [finding],
    };
  }

  return {
    coverage: cov.coverage,
    expectedFieldPlayerCount: cov.expectedFieldPlayerCount,
    placedFieldPlayerCount: cov.placedFieldPlayerCount,
    verticalBandsCovered: cov.verticalBandsCovered,
    areasCovered: cov.areasCovered,
    overallConfidenceCap: cap,
    canAnalyzeAreas: true,
    canAnalyzeAdjacency: true,
    canAnalyzeGlobalStructure: cov.coverage !== "limited",
    limitations,
    findings: main,
  };
}

function wellComplementedFinding(): TacticalFinding {
  return {
    id: "tactical-well-complemented",
    type: "wellComplemented",
    severity: "info",
    confidence: "medium",
    area: "whole",
    phase: "general",
    title: "明確な連携上の欠陥は確認できません",
    summary: "確認可能な範囲では、配置構造・既存診断カテゴリの間に明確な矛盾は見当たりません。",
    explanation: "エリア別の役割重複・不足、既存診断の主要なカテゴリ間矛盾のいずれも、十分な根拠を伴っては検出されませんでした。",
    evidence: [],
    affectedPlayers: [],
    potentialRisk: null,
    recommendations: [],
    limitations: null,
  };
}

/** 「問題なし」ではなく「評価できない」ことを明示する（配置不足でfindingが無かった場合に使う）。 */
function inconclusiveFinding(limitations: string[]): TacticalFinding {
  return {
    id: "tactical-inconclusive",
    type: "inconclusive",
    severity: "info",
    confidence: "low",
    area: "whole",
    phase: "general",
    title: "評価できる範囲が限られています",
    summary: "現在の配置情報では、明確な欠陥の有無を判断できるだけの根拠が揃っていません。",
    explanation: "「問題が無い」のではなく「確認可能な範囲では判断できない」状態です。配置を進めると、より具体的な分析が可能になります。",
    evidence: [],
    affectedPlayers: [],
    potentialRisk: null,
    recommendations: ["先発配置を進めた後、配置構造・戦術監査を再確認してください。"],
    limitations: limitations.length > 0 ? limitations.join(" ") : null,
  };
}

/**
 * 後方互換用の薄いラッパー。`TacticalFinding[]` だけが必要な既存呼び出し向け。
 * 新規コードは `buildTacticalReview` を使用すること（配置充足状況・上限信頼度・分析全体の制限を取得できる）。
 */
export function buildTacticalFindings(
  result: SquadDiagnosisResult,
  placements: TacticalPlacementInput[] | null,
): TacticalFinding[] {
  return buildTacticalReview(result, placements).findings;
}

// ---------------------------------------------------------------------------
// アダプタ: 既存の `buildSquad()` 出力から `TacticalPlacementInput[]` を組み立てる
// ---------------------------------------------------------------------------

/**
 * `SquadComputed`（`buildSquad()` の既存出力）が既に保持している先発配置情報だけから
 * `TacticalPlacementInput[]` を組み立てる、純粋な読み取り専用の変換（能力値・診断の再計算はしない）。
 * `computed.slots` は未配置の枠も含めてフォーメーションの全枠ぶん存在するため、そのまま渡せば
 * 配置充足状況の判定に必要な情報がすべて揃う。
 */
export function buildTacticalPlacementInputs(params: { formation: FormationDef; slots: SquadSlotResult[] }): TacticalPlacementInput[] {
  const lineBySlotId = new Map(params.formation.slots.map((s) => [s.slotId, s.line]));
  return params.slots.map((s) => {
    const display = s.entry?.display ?? null;
    return {
      slotId: s.slotId,
      position: s.position,
      x: s.x,
      y: s.y,
      role: s.role,
      line: lineBySlotId.get(s.slotId) ?? 0,
      nameLabel: display?.nameJa || display?.nameEn || "選手未設定",
      playingStyle: display?.playingStyle ?? null,
      playingStyleDefensive: display?.playingStyleDefensive ?? null,
      filled: s.entry != null,
    };
  });
}
