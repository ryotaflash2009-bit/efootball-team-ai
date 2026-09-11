/**
 * カード付属ブースター（数値 ID）→ ブースター名・レベル・効果 の解決。
 *
 * 生データ（ID → 名称・レベル）は `booster-resolution-data.ts`（eFootball World = 外部DB の個別ページ表示）。
 * 効果（対象能力・上昇量）は名称一致で `booster-catalog.ts` を参照。証拠レベル:
 *  - game_client_verified … KONAMI のゲームクライアント画面で直接確認（現状 0 件）
 *  - screenshot_verified … 保存済みの外部ビルド画面のスクリーンショットで対象能力・上昇量を確認（ball-carrying / offence-creator）。KONAMI のゲームクライアント画面での確認ではない
 *  - external_cross_verified … World の ScoreBar 差分 と EFScout の定義が一致（27 種・KONAMI 公式実測ではない）
 *  - effect_provisional … 公開データ 1 系統のみ／検証例不足
 *  - conditional_unverified … total-package。効果候補（全26能力 +level）は整合、発動条件も KONAMI 公式で判明
 *      （Game Plan の同一リーグ登録人数で効果量が変化）だが、条件を評価できないため全モードで通常値へ未適用
 *
 * 発動方式（`activation`・効果名とは別軸）:
 *  - "fixed"         … 常時固定（青色）。証拠レベルに応じて自動適用。
 *  - "power_of_many" … Game Plan 依存で効果量が変化（金色）。**どのモードでも自動適用しない。**
 *      ユーザーが段階（+0/+1/+2/+3）を手動指定したときだけ、その効果名の対象能力へだけ反映。
 *      total-package（対象=全26能力）と、Ball Protection 等の名称付きブースター（対象=そのブースターの4能力）の両方に付く。
 *
 * 適用モード（`boosterApplicationMode`）ごとの「通常の最終値へ自動適用するか」（fixed のみ）:
 *  - strict   : game_client_verified ＋ screenshot_verified のみ
 *  - standard : 上記 + external_cross_verified（既定）
 *  - experimental : standard と同じ（試算値には provisional / conditional / 手動試算も加える）
 */

import { getBoosterDef, boosterDeltas, type BoosterDef, type BoosterEvidenceLevel } from "./booster-catalog";
import {
  BOOSTER_RESOLUTION_VERSION,
  WORLD_BOOST1_MAP,
  WORLD_BOOST2_MAP,
  EFHUB_BOOST_MAP,
  type BoosterActivationType,
  type ActivationEvidence,
} from "./booster-resolution-data";

export type { BoosterActivationType, ActivationEvidence } from "./booster-resolution-data";

export {
  BOOSTER_RESOLUTION_VERSION,
  BOOSTER_RESOLUTION_PREVIOUS_VERSIONS,
  WORLD_BOOST1_MAP,
  WORLD_BOOST2_MAP,
  EFHUB_BOOST_MAP,
  GAME_CLIENT_VERIFIED_KEYS,
  SCREENSHOT_VERIFIED_KEYS,
  GAME_MEASURED_KEYS,
  EXTERNAL_CROSS_VERIFIED_KEYS,
} from "./booster-resolution-data";

export type BoosterApplicationMode = "strict" | "standard" | "experimental";
export const DEFAULT_BOOSTER_MODE: BoosterApplicationMode = "standard";
export const BOOSTER_APPLICATION_MODES: {
  id: BoosterApplicationMode;
  label: string;
  description: string;
}[] = [
  {
    id: "strict",
    label: "厳密モード",
    description:
      "保存済みスクリーンショットで変化量を直接確認したブースターだけを適用します。KONAMI 公式ゲーム画面での確認済みを意味しません。適用の基準は効果内容（対象能力・上昇量）の証拠であり、発動方式（固定型 / Power of Many）の証拠は要求しません。",
  },
  {
    id: "standard",
    label: "標準モード（既定）",
    description:
      "上記に加え、eFootball World と EFScout の外部 2 ソースで効果が一致し複数カードで反例がないブースターを適用します。KONAMI 公式の計算結果として確認された値ではありません。適用の基準は効果内容の照合であり、発動方式は問いません。発動方式の証拠が不足するブースターは、Power of Many（条件型）である具体的な証拠がないため固定型と推定して暫定適用しています（「外部照合済み・固定型推定を含む」）。",
  },
  {
    id: "experimental",
    label: "実験モード",
    description:
      "標準モードに加え、検証中の付属ブースターと手動試算を「試算最終値」に別表示します（通常の最終値は変わりません）。有効化前に警告への同意が必要です。",
  },
];

/** 効果の証拠レベル（後方互換の別名）。`booster-catalog` の `BoosterEvidenceLevel` と同じ。 */
export type BoosterEffectEvidence = BoosterEvidenceLevel;

export interface ResolvedAttachedBooster {
  slot: 1 | 2;
  source: "world" | "efhub";
  boosterId: number;
  boosterKey: string;
  nameEn: string;
  nameJa: string | null;
  level: number;
  affectedStats: string[];
  /** 対象能力ごとの delta（level ぶん）。証拠レベルを問わず「候補値」として持つ。 */
  perStatDelta: Record<string, number>;
  conditional: boolean;
  /** 名称・レベルの確認状態（eFootball World の外部ページ表示由来）。 */
  nameStatus: "external_page_confirmed";
  /** 効果の証拠レベル。 */
  evidenceLevel: BoosterEvidenceLevel;
  /** 発動条件の内容（判明している場合のみ）。未確認なら null。 */
  conditionText: string | null;
  /** 発動条件を現在のアプリデータで評価できるか（条件なし or 評価可能なら true）。 */
  conditionEvaluable: boolean;
  /**
   * 発動方式。"power_of_many" は金色・Game Plan 依存でどのモードでも自動適用しない（ユーザー段階指定のみ）。
   * "fixed" は青色・証拠レベルに応じて自動適用。"live_update" / "unresolved" も自動適用しない。
   */
  activation: BoosterActivationType;
  /** 発動方式の証拠レベル（効果の evidenceLevel とは別軸）。derived fixed は "provisional"（＝推定）。 */
  activationEvidence: ActivationEvidence;
  /** activation が確実に確認できているか（"fixed (推定)" を UI で明示するため）。 */
  activationConfirmed: boolean;
  /** 厳密モードで通常の最終値へ自動適用するか（fixed かつ game_client_verified/screenshot_verified）。 */
  appliesInStrict: boolean;
  /** 標準モードで通常の最終値へ自動適用するか（fixed かつ 上記 ＋ external_cross_verified）。 */
  appliesInStandard: boolean;
  reason: string;
}

function reasonFor(
  lvl: BoosterEvidenceLevel,
  activation: BoosterActivationType,
  nameEn: string,
  activationEvidence: ActivationEvidence = "provisional",
): string {
  if (activation === "power_of_many") {
    return `${nameEn} は Game Plan 依存で効果量が変化する発動方式（KONAMI 公式「The Power of Many」・金色）です。対象リーグの Game Plan 登録人数を当アプリでは自動確認できないため、どのモードでも通常の最終値へは自動適用しません。ユーザーが段階（+0/+1/+2/+3）を手動指定したときだけ、この効果名の対象能力へだけ試算として反映します。`;
  }
  if (activation === "live_update") {
    return `${nameEn} は Live Update Rating（フォーム）連動で発動する方式です。静的な育成画面では発動状態を評価できないため、通常の最終値へは自動適用しません。`;
  }
  if (activation === "unresolved") {
    return `${nameEn} の発動方式を確認できていません。安全のため通常の最終値へは自動適用しません。`;
  }
  const provisionalNote =
    activationEvidence === "provisional"
      ? "（発動方式は「固定」と推定。青色/金色の判別材料は未確認で、ScoreBar 差分だけでは固定 +N と Power of Many 最大 +N を区別できません）"
      : "";
  switch (lvl) {
    case "game_client_verified":
      return `KONAMI のゲームクライアント画面で変化量を直接確認。厳密モードでも通常の最終値へ適用。${provisionalNote}`;
    case "screenshot_verified":
      return `保存済みの外部ビルド画面（eFHUB ビルドツール）のスクリーンショットで対象能力・上昇量を確認。KONAMI のゲームクライアント画面での確認ではありません（＋ eFootball World の ScoreBar 差分 と EFScout の定義も一致）。厳密モードでも通常の最終値へ適用。${provisionalNote}`;
    case "external_cross_verified":
      return `eFootball World（外部DB）の ScoreBar 差分 と EFScout（外部DB）の定義が一致・別カード2枚以上で反例0。標準モードで通常の最終値へ適用。KONAMI 公式実測ではありません。${provisionalNote}`;
    case "conditional_unverified":
      return "名称・レベルは外部ページ表示で確認。効果候補も外部2ソースで整合。発動条件（KONAMI 公式「The Power of Many」）は判明していますが、その条件を静的な育成画面・現状のスカッドデータでは評価できないため、どのモードでも通常の最終値へは適用しません（実験モードで最大効果の試算のみ）。";
    default:
      return "名称・レベルは外部ページ表示で確認。効果は公開データ1系統のみ／検証例不足のため、通常の最終値へは適用しません（実験モードで試算のみ）。";
  }
}

/**
 * カード付属ブースターの数値 ID を解決する。
 * @returns 解決できなければ null（＝対応表に無い ID）。
 */
export function resolveAttachedBooster(
  source: "world" | "efhub",
  slot: 1 | 2,
  boostId: number | null | undefined,
): ResolvedAttachedBooster | null {
  if (boostId == null || boostId === 0) return null;
  const table =
    source === "efhub" ? EFHUB_BOOST_MAP : slot === 2 ? WORLD_BOOST2_MAP : WORLD_BOOST1_MAP;
  const hit = table[boostId];
  if (!hit) return null;
  const def: BoosterDef | undefined = getBoosterDef(hit.key);
  if (!def) return null;
  const level = Math.max(1, Math.min(def.maxLevel, hit.level));
  const evidenceLevel = def.evidenceLevel;
  const activation: BoosterActivationType =
    hit.activation ?? (def.conditional ? "power_of_many" : "fixed");
  const isFixed = activation === "fixed";
  // 発動方式の証拠: 明示指定を優先。無ければ derived fixed → "provisional"、明示 PoM → "external_cross_verified"。
  const activationEvidence: ActivationEvidence =
    hit.activationEvidence ??
    (hit.activation == null
      ? def.conditional
        ? "official_verified" // total-package（catalog conditional・KONAMI 公式）
        : "provisional" // derived fixed（青/金の判別材料が未確認）
      : "external_cross_verified");
  const activationConfirmed =
    activationEvidence === "official_verified" ||
    activationEvidence === "screenshot_verified" ||
    activationEvidence === "external_cross_verified";
  return {
    slot,
    source,
    boosterId: boostId,
    boosterKey: def.key,
    nameEn: def.nameEn,
    nameJa: def.nameJa,
    level,
    affectedStats: def.affectedStats,
    perStatDelta: boosterDeltas(def, level),
    conditional: def.conditional || !isFixed,
    nameStatus: "external_page_confirmed",
    evidenceLevel,
    conditionText: def.conditionText ?? null,
    conditionEvaluable: isFixed ? (def.conditionEvaluable ?? !def.conditional) : false,
    activation,
    activationEvidence,
    activationConfirmed,
    appliesInStrict: isFixed && STRICT_LEVELS.has(evidenceLevel),
    appliesInStandard: isFixed && (STRICT_LEVELS.has(evidenceLevel) || evidenceLevel === "external_cross_verified"),
    reason: reasonFor(evidenceLevel, activation, def.nameEn, activationEvidence),
  };
}

/** 厳密モードで通常の最終値へ適用する証拠レベル。 */
const STRICT_LEVELS = new Set<BoosterEvidenceLevel>(["game_client_verified", "screenshot_verified"]);

/**
 * ある証拠レベル・発動方式が指定モードで「通常の最終値へ自動適用」されるか。
 * power_of_many はどのモードでも false（ユーザー段階指定のみ）。
 */
export function appliesInMode(
  lvl: BoosterEvidenceLevel,
  mode: BoosterApplicationMode,
  activation: BoosterActivationType = "fixed",
): boolean {
  if (activation !== "fixed") return false; // power_of_many / live_update / unresolved はどのモードでも自動適用しない
  if (STRICT_LEVELS.has(lvl)) return true;
  if (lvl === "external_cross_verified") return mode === "standard" || mode === "experimental";
  return false;
}

/** 対応表に載っている ID 数（集計・テスト用）。 */
export const RESOLUTION_COVERAGE = {
  worldBoost1Ids: Object.keys(WORLD_BOOST1_MAP).length,
  worldBoost2Ids: Object.keys(WORLD_BOOST2_MAP).length,
  efhubBoostIds: Object.keys(EFHUB_BOOST_MAP).length,
};

/**
 * 発動方式の証拠の内訳（対応表に載っている全 ID・source 別）。
 * 「confirmed fixed は 0 件、fixed の大半は推定（provisional）」を単一の真実源にするための集計。
 * カード数ではなく **World ブースターID 数**（＋eFHUB 2 ID）。標準適用カード数は SQLite / scan スクリプトが集計。
 */
export function auditActivation(): {
  world: { confirmedFixedIdCount: number; provisionalFixedIdCount: number; confirmedPowerOfManyIdCount: number; unresolvedActivationIdCount: number };
  withEfhub: { confirmedFixedIdCount: number; provisionalFixedIdCount: number; confirmedPowerOfManyIdCount: number };
  /** 標準モードで自動適用中のカード数（v8 時点の確定値・SQLite の resolved_boosters applied=1 distinct と一致）。 */
  standardAppliedCardCount: number;
  /** 条件段階を指定できるカード数（total-package 341 + ball-protection 3）。 */
  conditionalSelectableCardCount: number;
} {
  const tally = (
    entries: { slot: 1 | 2; source: "world" | "efhub"; boostId: number }[],
  ) => {
    let confirmedFixed = 0, provisionalFixed = 0, confirmedPoM = 0, unresolvedActivation = 0;
    for (const e of entries) {
      const r = resolveAttachedBooster(e.source, e.slot, e.boostId);
      if (!r) {
        unresolvedActivation += 1;
        continue;
      }
      if (r.activation === "power_of_many") {
        if (r.activationConfirmed) confirmedPoM += 1;
        else unresolvedActivation += 1;
      } else if (r.activation === "fixed") {
        if (r.activationConfirmed) confirmedFixed += 1;
        else provisionalFixed += 1;
      } else {
        unresolvedActivation += 1;
      }
    }
    return { confirmedFixedIdCount: confirmedFixed, provisionalFixedIdCount: provisionalFixed, confirmedPowerOfManyIdCount: confirmedPoM, unresolvedActivationIdCount: unresolvedActivation };
  };
  const worldEntries = [
    ...Object.keys(WORLD_BOOST1_MAP).map((id) => ({ slot: 1 as const, source: "world" as const, boostId: Number(id) })),
    ...Object.keys(WORLD_BOOST2_MAP).map((id) => ({ slot: 2 as const, source: "world" as const, boostId: Number(id) })),
  ];
  const efhubEntries = Object.keys(EFHUB_BOOST_MAP).map((id) => ({ slot: 1 as const, source: "efhub" as const, boostId: Number(id) }));
  const w = tally(worldEntries);
  const we = tally([...worldEntries, ...efhubEntries]);
  return {
    world: w,
    withEfhub: {
      confirmedFixedIdCount: we.confirmedFixedIdCount,
      provisionalFixedIdCount: we.provisionalFixedIdCount,
      confirmedPowerOfManyIdCount: we.confirmedPowerOfManyIdCount,
    },
    standardAppliedCardCount: 1931,
    conditionalSelectableCardCount: 344,
  };
}
