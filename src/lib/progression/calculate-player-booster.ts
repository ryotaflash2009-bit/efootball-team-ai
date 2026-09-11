import { getBoosterDef, boosterDeltas, isConfirmedB2Candidate } from "./booster-catalog";
import {
  resolveAttachedBooster,
  appliesInMode,
  BOOSTER_RESOLUTION_VERSION,
  DEFAULT_BOOSTER_MODE,
  type BoosterApplicationMode,
} from "./booster-resolution";
import {
  CONDITIONAL_BOOSTER_RULES_VERSION,
  calculateConditionalBoosterDeltas,
  describeConditionalSelection,
  levelForConditionalSelection,
  parseTotalPackageSelection,
  validateConditionalBoosterSelection,
  type ConditionalBoosterSelection,
} from "./conditional-boosters";
import type {
  AppliedPlayerBooster,
  PlayerBoosterInfo,
  ProgressionCard,
  SelectedConditionalBooster,
  SelectedPlayerBooster,
} from "./types";

/**
 * 選手ブースターのレイヤー。証拠レベル別のデルタと、適用モードごとの採用値を返す。
 *
 * 付属ブースター（World `boost1`/`boost2`）を対応表で解決:
 *  - 発動方式 `activation === "power_of_many"`（金色・Game Plan 依存）… **自動では一切加算しない**（証拠レベルに関係なく）。
 *      ユーザーが段階（none/+1/+2/+3）を手動指定したときだけ `conditionalUserDeltas` へ、その効果名の対象能力へだけ反映。
 *      「条件反映後値」にのみ反映（標準最終値は変えない）。自動判定ではない。
 *      total-package（対象=全26能力）と Ball Protection 等の名称付き（対象=そのブースターの4能力）の両方。
 *  - それ以外（`activation === "fixed"`）… 証拠レベルで自動適用を判定:
 *      game_client_verified / screenshot_verified … 厳密/標準/実験 すべてで通常の最終値へ加算
 *      external_cross_verified … 標準/実験 で通常の最終値へ加算（厳密では試算のみ）
 *      effect_provisional … 通常には加算しない。実験モードの試算のみ
 *  - 対応表に無い ID … 加算しない
 * 手動選択ブースター（B2・`selectedPlayerBooster`）:
 *  - `isConfirmedB2Candidate` が true（証拠レベル confirmed ＋ B2 選択肢として適格）の選択は
 *    `confirmedB2Deltas` へ計上し、通常の最終値（standardFinalValue）へも反映する（本マイルストーンで追加）。
 *  - それ以外（未確認・条件付きの後方互換値など）は従来どおり「試算のみ」（`experimentalExtraDeltas` 経由）。
 *  - `manualTrialDeltas` は後方互換のため「選択した B2 の全件」を引き続き保持する（表示・既存テスト用）。
 * conditional（Power of Many の段階指定）とは別バケット。
 */

const UNRESOLVED_REASON =
  "このカードの数値IDは付属ブースター対応表（eFootball World の個別選手ページ由来）に含まれていません。名称を解決できないため能力値へは適用していません。";

export interface ResolvedConditionalSelection {
  boosterKey: string;
  nameEn: string;
  nameJa: string | null;
  selection: ConditionalBoosterSelection;
  level: number;
  description: string;
}

export interface PlayerBoosterResult {
  boosters: PlayerBoosterInfo[];
  mode: BoosterApplicationMode;
  /** 現在モードで通常の最終値へ加算する分（＝ StatBreakdown.playerBoosterDelta の元）。 */
  appliedDeltas: Record<string, number>;
  /** 内訳（付属のみ・証拠レベル別）。game_client_verified ＋ screenshot_verified ぶん。 */
  gameMeasuredDeltas: Record<string, number>;
  externalVerifiedDeltas: Record<string, number>;
  /** 通常には乗らないが「試算最終値」には乗る分（検証中の付属 + 条件手動指定 + 手動試算）。 */
  experimentalExtraDeltas: Record<string, number>;
  /** 内訳（表示用）。 */
  provisionalAttachedDeltas: Record<string, number>;
  /** 条件付き付属の「最大効果候補」（全能力 +level）。自動では最終値に一切足さない。表示用。 */
  conditionalAttachedDeltas: Record<string, number>;
  /** ユーザーが手動指定した条件段階ぶん（全対象能力へ +段階値）。「条件反映後値」に反映。 */
  conditionalUserDeltas: Record<string, number>;
  manualTrialDeltas: Record<string, number>;
  /**
   * 手動選択した B2 のうち `isConfirmedB2Candidate` が true な分のみ（全対象能力へ +level）。
   * 通常の最終値（standardFinalValue）へ反映する。`manualTrialDeltas` の部分集合。
   */
  confirmedB2Deltas: Record<string, number>;
  /** ユーザーが手動指定した条件段階（"none" 以外のみ）。 */
  conditionalSelections: ResolvedConditionalSelection[];
  selection: {
    applied: AppliedPlayerBooster[];
    note: string;
    anyProvisional: boolean;
  };
  attached: {
    autoAppliedKeys: string[];
    resolvedNames: string[];
    note: string;
  };
  evidenceSummary: {
    gameMeasured: string[];
    externalCrossVerified: string[];
    provisional: string[];
    conditional: string[];
    unresolvedIds: number[];
  };
  note: string;
}

export function calculatePlayerBooster(
  card: ProgressionCard,
  selected: SelectedPlayerBooster[] = [],
  mode: BoosterApplicationMode = DEFAULT_BOOSTER_MODE,
  conditionalSelections: SelectedConditionalBooster[] = [],
): PlayerBoosterResult {
  const gameMeasuredDeltas: Record<string, number> = {};
  const externalVerifiedDeltas: Record<string, number> = {};
  const provisionalAttachedDeltas: Record<string, number> = {};
  const conditionalAttachedDeltas: Record<string, number> = {};
  const conditionalUserDeltas: Record<string, number> = {};
  const manualTrialDeltas: Record<string, number> = {};
  const confirmedB2Deltas: Record<string, number> = {};
  const unconfirmedManualTrialDeltas: Record<string, number> = {};

  const add = (target: Record<string, number>, src: Record<string, number>) => {
    for (const [k, d] of Object.entries(src)) target[k] = (target[k] ?? 0) + d;
  };

  // 条件段階の手動指定を boosterKey → selection に正規化（不正は捨てる）。
  const conditionBySelection = new Map<string, ConditionalBoosterSelection>();
  for (const c of validateConditionalBoosterSelection(conditionalSelections)) {
    conditionBySelection.set(c.boosterKey, c.selection);
  }

  const overriddenSlots = new Set(selected.map((s) => s.slot));

  const boosters: PlayerBoosterInfo[] = [];
  const autoAppliedKeys: string[] = [];
  const resolvedNames: string[] = [];
  const conditionalSelectionsResolved: ResolvedConditionalSelection[] = [];
  const evidenceSummary: PlayerBoosterResult["evidenceSummary"] = {
    gameMeasured: [],
    externalCrossVerified: [],
    provisional: [],
    conditional: [],
    unresolvedIds: [],
  };

  for (const [slot, id] of [
    [1, card.boost1],
    [2, card.boost2],
  ] as const) {
    if (id == null || id === 0) continue;
    if (overriddenSlots.has(slot)) continue; // 手動試算が優先
    const r = resolveAttachedBooster("world", slot, id);
    if (!r) {
      evidenceSummary.unresolvedIds.push(id);
      boosters.push({
        slot,
        boosterId: id,
        boosterKey: null,
        boosterNameEn: null,
        boosterNameJa: null,
        level: null,
        affectedStats: [],
        delta: null,
        perStatDelta: {},
        condition: null,
        source: "world",
        ruleVersion: BOOSTER_RESOLUTION_VERSION,
        nameStatus: "unresolved",
        evidenceLevel: "unresolved",
        confirmationStatus: "unresolved",
        autoApplied: false,
        unresolvedReason: UNRESOLVED_REASON,
      });
      continue;
    }

    const label = `${r.nameEn} +${r.level}`;
    resolvedNames.push(label);
    const isPoM = r.activation === "power_of_many";
    const appliedNow = appliesInMode(r.evidenceLevel, mode, r.activation);

    // ユーザーの段階指定（Power of Many のみ）。指定なしは "none"。
    let conditionSelection: ConditionalBoosterSelection = "none";
    let conditionLevel = 0;

    if (isPoM) {
      // 金色・Game Plan 依存。自動では最終値へ足さない。「最大効果候補」は表示専用。
      add(conditionalAttachedDeltas, r.perStatDelta);
      evidenceSummary.conditional.push(label);
      conditionSelection = conditionBySelection.get(r.boosterKey) ?? "none";
      conditionLevel = levelForConditionalSelection(conditionSelection);
      if (conditionSelection !== "none") {
        // その効果名の対象能力へだけ +段階値（Ball Protection なら4能力、Total Package なら26能力）。
        const d = calculateConditionalBoosterDeltas(r.boosterKey, conditionSelection);
        add(conditionalUserDeltas, d);
        conditionalSelectionsResolved.push({
          boosterKey: r.boosterKey,
          nameEn: r.nameEn,
          nameJa: r.nameJa,
          selection: conditionSelection,
          level: conditionLevel,
          description: describeConditionalSelection(conditionSelection),
        });
      }
    } else if (
      r.evidenceLevel === "game_client_verified" ||
      r.evidenceLevel === "screenshot_verified"
    ) {
      add(gameMeasuredDeltas, r.perStatDelta);
      evidenceSummary.gameMeasured.push(label);
    } else if (r.evidenceLevel === "external_cross_verified") {
      add(externalVerifiedDeltas, r.perStatDelta);
      evidenceSummary.externalCrossVerified.push(label);
    } else {
      add(provisionalAttachedDeltas, r.perStatDelta);
      evidenceSummary.provisional.push(label);
    }
    if (appliedNow) autoAppliedKeys.push(r.boosterKey);

    boosters.push({
      slot,
      boosterId: id,
      boosterKey: r.boosterKey,
      boosterNameEn: r.nameEn,
      boosterNameJa: r.nameJa,
      level: r.level,
      affectedStats: r.affectedStats,
      delta: appliedNow ? Object.values(r.perStatDelta).reduce((a, b) => a + b, 0) : null,
      perStatDelta: r.perStatDelta,
      condition: r.conditional ? "発動条件付き（内容未確認）" : null,
      source: "world",
      ruleVersion: BOOSTER_RESOLUTION_VERSION,
      nameStatus: "external_page_confirmed",
      evidenceLevel: r.evidenceLevel,
      confirmationStatus: appliedNow ? "confirmed" : "provisional",
      autoApplied: appliedNow,
      unresolvedReason: r.reason,
      conditionText: r.conditionText,
      conditionEvaluable: r.conditionEvaluable,
      activationType: r.activation,
      activationEvidence: r.activationEvidence,
      activationConfirmed: r.activationConfirmed,
      manualConditional: isPoM,
      conditionSelection: isPoM ? conditionSelection : undefined,
      conditionLevel: isPoM ? conditionLevel : undefined,
    });
  }

  // 手動試算ブースター（常に「試算のみ」）
  const applied: AppliedPlayerBooster[] = [];
  let anyProvisional = false;
  const usedSlots = new Set<number>();
  for (const sel of selected) {
    if (usedSlots.has(sel.slot)) continue;
    const def = getBoosterDef(sel.boosterKey);
    if (!def) continue;
    usedSlots.add(sel.slot);
    const level = Math.max(1, Math.min(def.maxLevel, Math.trunc(sel.level)));
    const confirmedB2 = isConfirmedB2Candidate(def);
    if (!confirmedB2) anyProvisional = true;
    const deltas = boosterDeltas(def, level);
    add(manualTrialDeltas, deltas);
    if (confirmedB2) add(confirmedB2Deltas, deltas);
    else add(unconfirmedManualTrialDeltas, deltas);
    applied.push({
      slot: sel.slot,
      boosterKey: def.key,
      level,
      nameEn: def.nameEn,
      affectedStats: def.affectedStats,
      applied: true,
      confirmationStatus: def.confirmationStatus,
      conditional: def.conditional,
    });
  }

  // ---- モードごとの採用値 ----
  const appliedDeltas: Record<string, number> = {};
  add(appliedDeltas, gameMeasuredDeltas);
  if (mode !== "strict") add(appliedDeltas, externalVerifiedDeltas);

  // 試算最終値の追加分。**自動の conditionalAttachedDeltas は含めない**。
  // 確認済み B2（confirmedB2Deltas）は標準最終値へ既に反映済みのため、二重加算を避けてここには含めない。
  const experimentalExtraDeltas: Record<string, number> = {};
  if (mode === "strict") add(experimentalExtraDeltas, externalVerifiedDeltas);
  add(experimentalExtraDeltas, provisionalAttachedDeltas);
  add(experimentalExtraDeltas, conditionalUserDeltas);
  add(experimentalExtraDeltas, unconfirmedManualTrialDeltas);

  const confirmedB2Count = applied.filter((a) => isConfirmedB2Candidate(getBoosterDef(a.boosterKey)!)).length;
  const selNote =
    applied.length === 0
      ? "B2 ブースターは指定されていません。"
      : confirmedB2Count === applied.length
        ? "選択した B2 ブースターは、対象能力の通常の最終値・比較の順位・チーム集計に反映します。"
        : confirmedB2Count === 0
          ? "手動試算ブースターは「試算最終値」にのみ反映します（通常の最終値・比較の順位・チーム集計には含めません）。"
          : "選択した B2 ブースターのうち確認済みの分は通常の最終値へ反映し、未確認の分は「試算最終値」にのみ反映します（通常の最終値・比較の順位・チーム集計には含めません）。";

  const hasAttached = boosters.length > 0;
  const anyApplied = autoAppliedKeys.length > 0;
  const anyResolved = boosters.some((b) => b.nameStatus === "external_page_confirmed");
  const hasConditionalSelection = conditionalSelectionsResolved.length > 0;
  const attachedNote = !hasAttached
    ? "このカードに付属する選手ブースターはありません。"
    : anyApplied
      ? mode === "strict"
        ? "スクリーンショットで実測済みの付属ブースターを通常の最終値へ適用しています（厳密モード）。適用の基準は効果内容の証拠で、発動方式（固定型 / Power of Many）は問いません。"
        : "効果内容を外部2ソースで照合した付属ブースターを通常の最終値へ適用しています（標準モード）。KONAMI 公式の確定値ではありません。発動方式の証拠が不足するものは、Power of Many（条件型）である具体的証拠がないため固定型と推定して暫定適用しています。"
      : hasConditionalSelection
        ? "編成条件付き付属ブースターの段階をユーザーが手動指定しています。標準最終値は変えず「条件反映後値」にのみ反映します。アプリが編成人数を自動検証した値ではありません。"
        : anyResolved
          ? "付属ブースターの名称は確認できましたが、現在のモードでは通常の最終値へ適用していません（実験モードで試算できます）。"
          : "付属ブースターの数値IDを対応表で解決できませんでした。能力値へは適用していません。";

  return {
    boosters,
    mode,
    appliedDeltas,
    gameMeasuredDeltas,
    externalVerifiedDeltas,
    experimentalExtraDeltas,
    provisionalAttachedDeltas,
    conditionalAttachedDeltas,
    conditionalUserDeltas,
    manualTrialDeltas,
    confirmedB2Deltas,
    conditionalSelections: conditionalSelectionsResolved,
    selection: { applied, note: selNote, anyProvisional },
    attached: { autoAppliedKeys, resolvedNames, note: attachedNote },
    evidenceSummary,
    note: attachedNote,
  };
}

/** 旧 API 互換。 */
export function emptyPlayerBoosterResult(): PlayerBoosterResult {
  return {
    boosters: [],
    mode: DEFAULT_BOOSTER_MODE,
    appliedDeltas: {},
    gameMeasuredDeltas: {},
    externalVerifiedDeltas: {},
    experimentalExtraDeltas: {},
    provisionalAttachedDeltas: {},
    conditionalAttachedDeltas: {},
    conditionalUserDeltas: {},
    manualTrialDeltas: {},
    confirmedB2Deltas: {},
    conditionalSelections: [],
    selection: { applied: [], note: "", anyProvisional: false },
    attached: { autoAppliedKeys: [], resolvedNames: [], note: "" },
    evidenceSummary: {
      gameMeasured: [],
      externalCrossVerified: [],
      provisional: [],
      conditional: [],
      unresolvedIds: [],
    },
    note: "",
  };
}

export { CONDITIONAL_BOOSTER_RULES_VERSION, parseTotalPackageSelection };
