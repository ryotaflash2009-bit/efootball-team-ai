/**
 * 選手ブースターの定義カタログ（名前 → 対象能力）と、効果の証拠レベル。
 *
 * 証拠レベル（`evidenceLevel`）:
 *  - `game_client_verified` … KONAMI のゲームクライアント画面で変化量を直接確認したもの。**現状 0 件**。
 *  - `screenshot_verified` … 保存済みの外部ビルド画面（eFHUB ビルドツール）のスクリーンショットで、
 *      対象能力と上昇量を確認できたもの。ball-carrying / offence-creator の 2 種。
 *      **KONAMI のゲームクライアント画面での確認ではない。**
 *  - `external_cross_verified` … eFootball World（外部コミュニティDB）の個別選手ページの ScoreBar 差分
 *      （ブースターON − OFF）と、EFScout（外部DB）の定義が一致し、別カード 2 枚以上で反例がないもの（27 種）。
 *      **KONAMI 公式の計算結果として確認された値ではない。**
 *  - `effect_provisional` … 公開データ 1 系統のみ、または検証例が不足しているもの（SINGLE 6 種・レジェンド系 8 種）。
 *  - `conditional_unverified` … 発動条件があり、通常の最終値へ自動適用できないもの（total-package）。
 *      total-package は KONAMI 公式（「The Power of Many」）で発動条件の内容は判明しているが、
 *      条件（Game Plan の同一リーグ登録人数）を静的な育成画面・現状のスカッドデータでは評価できないため
 *      `conditional_unverified` を維持し、どのモードでも通常の最終値へは加算しない。詳細は
 *      `conditionText` / `docs/phase-total-package.md`。
 *
 * `confirmationStatus` は後方互換の派生値（game_client_verified / screenshot_verified / external_cross_verified → "confirmed"）。
 * 新しいコードは `evidenceLevel` を見ること。
 *
 * 各ブースターは「対象4能力それぞれに +level」。level は 1..maxLevel。
 */

export type BoosterCategory = "standard" | "special" | "single";
export type BoosterConfirmation = "confirmed" | "provisional";
export type BoosterEvidenceLevel =
  | "game_client_verified"
  | "screenshot_verified"
  | "external_cross_verified"
  | "effect_provisional"
  | "conditional_unverified";

export interface BoosterDef {
  key: string;
  nameEn: string;
  nameJa: string | null;
  category: BoosterCategory;
  /** 対象能力（World キー）。各能力へ +level。 */
  affectedStats: string[];
  maxLevel: number;
  /** 編成条件などがある（Total Package 等）。条件の内容は未確認。 */
  conditional: boolean;
  /** 効果（対象能力・上昇量）の証拠レベル。 */
  evidenceLevel: BoosterEvidenceLevel;
  /** 後方互換の派生値。game_client_verified / screenshot_verified / external_cross_verified → "confirmed"。 */
  confirmationStatus: BoosterConfirmation;
  evidence: string;
  /**
   * 発動条件の内容（判明している場合のみ）。`conditional: true` でも条件本文が未確認なら null。
   * total-package: KONAMI 公式「The Power of Many」で判明。
   */
  conditionText?: string | null;
  /**
   * 発動条件を現在のアプリデータ（静的な能力値・スカッド構成）で評価できるか。
   * false = 条件は判明していても評価不能 → どのモードでも通常の最終値へ加算しない。
   */
  conditionEvaluable?: boolean;
}

const EFSCOUT = "EFScout（外部コミュニティDB）boot.json referenceData.allBoosters の定義のみ";

/**
 * Total Package の発動条件（KONAMI 公式「The Power of Many」ブースター）。
 * 出所: KONAMI 公式 Version Info / J.LEAGUE Monthly MVP 告知（2026-08-28 確認）。
 */
const TP_CONDITION =
  "発動条件付き（KONAMI 公式「The Power of Many」）: このカードの対象リーグ（例: MEIJI YASUDA J1 LEAGUE / Trendyol Süper Lig / Brasileirão など、カードのリーグに対応）の選手を Game Plan に登録した人数で効果が変化する。1〜13 人で全対象能力 +1、14〜19 人で +2、20 人以上で +3。eFootball World の ScoreBar は条件を無視して最大（+3）を表示している。試合／Game Plan 構成に依存する効果のため、静的な育成画面や現状のスカッド機能では評価せず、通常の最終値へは加算しない。";
/** eFootball World（外部DB）の ScoreBar 差分 と EFScout 定義 が一致（別カード2枚以上・反例0）。KONAMI 公式実測ではない。 */
const XVERIFIED =
  "eFootball World（外部コミュニティDB）の個別選手ページ: ScoreBar(ブースターON) − RSC baseAbilities(OFF) の差分 と EFScout（外部DB）の定義が一致（別カード2枚以上・delta==level・デュアル加算一致・反例0）。外部2ソースで整合。KONAMI のゲームクライアント画面での確認ではない。";
/** 保存済みの外部ビルド画面（eFHUB ビルドツール）のスクリーンショットで対象能力・上昇量を確認。KONAMI ゲームクライアント画面での確認ではない。 */
const SS_BALL_CARRYING =
  "screenshots/スクリーンショット 2026-08-28 020026.png（eFHUB ビルドツール・ユーザー保存）で「ボールキャリー +5」選択時に ドリブル/ボールキープ/スピード/ボディバランス へ緑の +5 を確認。KONAMI のゲームクライアント画面での確認ではない。+ eFootball World ScoreBar 差分 と EFScout 定義も一致。";
const SS_OFFENCE_CREATOR =
  "screenshots/image.png・image (1).png（eFHUB ビルドツール・ユーザー保存）で「攻撃の起点 +4」選択時に オフェンスセンス/ボールコントロール/グラウンダーパス/キック力 へ緑の +4 を確認。KONAMI のゲームクライアント画面での確認ではない。+ eFootball World ScoreBar 差分 と EFScout 定義も一致。";

const cs = (lvl: BoosterEvidenceLevel): BoosterConfirmation =>
  lvl === "game_client_verified" || lvl === "screenshot_verified" || lvl === "external_cross_verified"
    ? "confirmed"
    : "provisional";

/** 11 種の標準ブースター（+2〜+5）。 */
const STANDARD: Array<[string, string, string[], BoosterEvidenceLevel, string]> = [
  ["shooting", "Shooting", ["ballControl", "finishing", "kickingPower", "physicalContact"], "external_cross_verified", XVERIFIED],
  ["free-kick-taking", "Free-kick Taking", ["finishing", "setPieceTaking", "curl", "kickingPower"], "external_cross_verified", XVERIFIED],
  ["aerial", "Aerial", ["finishing", "heading", "physicalContact", "jumping"], "external_cross_verified", XVERIFIED],
  ["passing", "Passing", ["lowPass", "loftedPass", "curl", "kickingPower"], "external_cross_verified", XVERIFIED],
  ["ball-carrying", "Ball-carrying", ["dribbling", "tightPossession", "speed", "balance"], "screenshot_verified", SS_BALL_CARRYING],
  ["technique", "Technique", ["ballControl", "dribbling", "tightPossession", "lowPass"], "external_cross_verified", XVERIFIED],
  ["defending", "Defending", ["defensiveAwareness", "tackling", "acceleration", "jumping"], "external_cross_verified", XVERIFIED],
  ["duelling", "Duelling", ["defensiveAwareness", "tackling", "speed", "stamina"], "external_cross_verified", XVERIFIED],
  ["agility", "Agility", ["speed", "acceleration", "balance", "stamina"], "external_cross_verified", XVERIFIED],
  ["physicality", "Physicality", ["balance", "physicalContact", "jumping", "stamina"], "external_cross_verified", XVERIFIED],
  ["goalkeeping", "Goalkeeping", ["gkAwareness", "gkCatching", "gkParrying", "gkReflexes"], "external_cross_verified", XVERIFIED],
];

/** 拡張の標準系（+2〜+6）。 */
const EXTENDED: Array<[string, string, string[], number, BoosterEvidenceLevel, string]> = [
  ["strikers-instinct", "Striker's Instinct", ["offensiveAwareness", "ballControl", "finishing", "acceleration"], 5, "external_cross_verified", XVERIFIED],
  ["shutdown", "Shutdown", ["defensiveAwareness", "defensiveEngagement", "tackling", "speed"], 5, "external_cross_verified", XVERIFIED],
  ["hard-worker", "Hard Worker", ["aggression", "acceleration", "physicalContact", "stamina"], 5, "external_cross_verified", XVERIFIED],
  ["saving", "Saving", ["gkAwareness", "gkParrying", "gkReflexes", "gkReach"], 5, "external_cross_verified", XVERIFIED],
  ["crossing", "Crossing", ["loftedPass", "curl", "speed", "stamina"], 5, "external_cross_verified", XVERIFIED],
  ["fantasista", "Fantasista", ["ballControl", "dribbling", "finishing", "balance"], 5, "external_cross_verified", XVERIFIED],
  ["regista", "Regista", ["tightPossession", "lowPass", "defensiveAwareness", "tackling"], 4, "external_cross_verified", XVERIFIED],
  ["rebuilding", "Rebuilding", ["lowPass", "defensiveAwareness", "defensiveEngagement", "aggression"], 4, "external_cross_verified", XVERIFIED],
  ["accuracy", "Accuracy", ["lowPass", "loftedPass", "finishing", "kickingPower"], 4, "external_cross_verified", XVERIFIED],
  ["offence-creator", "Offence Creator", ["offensiveAwareness", "ballControl", "lowPass", "kickingPower"], 4, "screenshot_verified", SS_OFFENCE_CREATOR],
  ["ball-protection", "Ball Protection", ["ballControl", "tightPossession", "balance", "physicalContact"], 4, "external_cross_verified", XVERIFIED],
  ["balancer", "Balancer", ["offensiveAwareness", "defensiveAwareness", "acceleration", "stamina"], 4, "external_cross_verified", XVERIFIED],
  ["counter", "Counter", ["lowPass", "defensiveEngagement", "tackling", "physicalContact"], 3, "external_cross_verified", XVERIFIED],
  ["aerial-block", "Aerial Block", ["heading", "defensiveAwareness", "physicalContact", "jumping"], 3, "external_cross_verified", XVERIFIED],
  ["breakthrough", "Breakthrough", ["dribbling", "kickingPower", "speed", "physicalContact"], 4, "external_cross_verified", XVERIFIED],
  ["strength", "Strength", ["kickingPower", "speed", "physicalContact", "jumping"], 4, "external_cross_verified", XVERIFIED],
  ["off-the-ball", "Off the Ball", ["offensiveAwareness", "speed", "acceleration", "stamina"], 4, "external_cross_verified", XVERIFIED],
  ["stealing", "Stealing", ["tackling", "aggression", "acceleration", "physicalContact"], 4, "external_cross_verified", XVERIFIED],
];

/** 単一能力 +1（"○○ +6" 表記だが実際は特定1能力を強化）。観測が各1デュアルカードのみ → effect_provisional。 */
const SINGLE: Array<[string, string, string]> = [
  ["single-aggression", "Aggression", "aggression"],
  ["single-balance", "Balance", "balance"],
  ["single-ball-control", "Ball Control", "ballControl"],
  ["single-jump", "Jump", "jumping"],
  ["single-physical-contact", "Physical Contact", "physicalContact"],
  ["single-speed", "Speed", "speed"],
];

/** レジェンド／特殊。total-package は条件未確認、他はカード付属として未観測 → effect_provisional。 */
const SPECIAL: Array<[string, string, string[], boolean]> = [
  ["total-package", "Total Package", [
    "offensiveAwareness", "ballControl", "dribbling", "tightPossession", "lowPass", "loftedPass",
    "finishing", "setPieceTaking", "curl", "heading", "defensiveAwareness", "defensiveEngagement",
    "tackling", "aggression", "kickingPower", "speed", "acceleration", "balance", "physicalContact",
    "jumping", "gkAwareness", "gkCatching", "gkParrying", "gkReflexes", "gkReach", "stamina",
  ], true],
  ["bearer-of-fate", "Bearer of Fate", ["finishing", "heading", "speed", "acceleration"], false],
  ["son-of-god", "Son of God", ["dribbling", "lowPass", "finishing", "kickingPower"], false],
  ["king-of-football", "King of Football", ["dribbling", "tightPossession", "balance", "physicalContact"], false],
  ["le-petit-prince", "Le Petit Prince", ["offensiveAwareness", "lowPass", "finishing", "kickingPower"], false],
  ["magical", "Magical", ["offensiveAwareness", "dribbling", "tightPossession", "acceleration"], false],
  ["striking", "Striking", ["offensiveAwareness", "kickingPower", "acceleration", "physicalContact"], false],
  ["natural-born", "Natural-born", ["offensiveAwareness", "ballControl", "dribbling", "finishing"], false],
  ["the-undisputed", "The Undisputed", ["offensiveAwareness", "ballControl", "dribbling", "physicalContact"], false],
];

export const BOOSTER_CATALOG: BoosterDef[] = [
  ...STANDARD.map(([key, nameEn, stats, lvl, ev]) => ({
    key, nameEn, nameJa: null, category: "standard" as const,
    affectedStats: stats, maxLevel: 5, conditional: false,
    evidenceLevel: lvl, confirmationStatus: cs(lvl), evidence: ev,
  })),
  ...EXTENDED.map(([key, nameEn, stats, maxLevel, lvl, ev]) => ({
    key, nameEn, nameJa: null, category: "standard" as const,
    affectedStats: stats, maxLevel, conditional: false,
    evidenceLevel: lvl, confirmationStatus: cs(lvl), evidence: ev,
  })),
  ...SINGLE.map(([key, nameEn, stat]) => ({
    key, nameEn, nameJa: null, category: "single" as const,
    affectedStats: [stat], maxLevel: 6, conditional: false,
    evidenceLevel: "effect_provisional" as const, confirmationStatus: "provisional" as const,
    evidence: EFSCOUT + " ＋ デュアルカード1枚の ScoreBar 差分（検証例が不足）",
  })),
  ...SPECIAL.map(([key, nameEn, stats, cond]) => ({
    key, nameEn, nameJa: null, category: "special" as const,
    affectedStats: stats, maxLevel: cond ? 5 : 4, conditional: cond,
    evidenceLevel: (cond ? "conditional_unverified" : "effect_provisional") as BoosterEvidenceLevel,
    confirmationStatus: "provisional" as const,
    evidence: cond
      ? "効果候補（全26能力へ +level）は eFootball World の ScoreBar 差分 と EFScout 定義で整合。発動条件の内容は KONAMI 公式「The Power of Many」で判明（Game Plan の同一リーグ登録人数で +1/+2/+3）。ただし条件を静的データ・現状のスカッドでは評価できないため通常の最終値へは未適用。"
      : EFSCOUT + "（カード付属として未観測）",
    conditionText: cond ? TP_CONDITION : null,
    conditionEvaluable: cond ? false : true,
  })),
];

/** screenshot・公式表記で確認できた日本語名のみ（未確認は null のまま）。 */
const NAME_JA: Record<string, string> = {
  "ball-carrying": "ボールキャリー",
  "offence-creator": "攻撃の起点",
  fantasista: "ファンタジスタ",
};
for (const b of BOOSTER_CATALOG) b.nameJa = NAME_JA[b.key] ?? null;

const BY_KEY = new Map(BOOSTER_CATALOG.map((b) => [b.key, b]));

export function getBoosterDef(key: string | null | undefined): BoosterDef | undefined {
  return key == null ? undefined : BY_KEY.get(key);
}

/** ブースター def + level → 能力キーごとの delta。 */
export function boosterDeltas(def: BoosterDef, level: number): Record<string, number> {
  const lv = Math.max(1, Math.min(def.maxLevel, Math.trunc(level)));
  const out: Record<string, number> = {};
  for (const k of def.affectedStats) out[k] = (out[k] ?? 0) + lv;
  return out;
}

// ---------------------------------------------------------------------------
// B2（ユーザーが選択する追加ブースター）選択肢としての適格性
// ---------------------------------------------------------------------------

/**
 * この定義を「B2」（ユーザーが手動で選ぶ追加ブースターの試算）の選択肢に含めてよいか。
 * `conditional: true`（現状 total-package のみ）は Power of Many 専用の条件付きブースターであり、
 * 段階指定は `conditionalBoosterSelections` / `ConditionalBoosterControl` の専用 UI で扱う。
 * B2 の通常選択欄（`selectedPlayerBooster`）へ混ぜて「なし/選択/リセット」の単純な 1 段階選択に
 * してしまうと、Power of Many の発動条件（Game Plan 依存）と誤認させるため除外する。
 * この関数は表示上の選択肢を絞るだけで、既存の保存値・計算（`calculatePlayerBooster`）は変更しない。
 */
export function isB2SelectableCandidate(def: Pick<BoosterDef, "conditional">): boolean {
  return !def.conditional;
}

/**
 * 「確認済み」= 効果（対象能力・上昇量）の証拠レベルが `confirmed`（screenshot_verified /
 * external_cross_verified / game_client_verified）で、かつ B2 選択肢として適格（Power of Many 除外）。
 * B2 の正式候補（通常表示へ昇格できる候補）を判定する単一の真実源。
 * 「コードに定義がある」だけでなく、証拠レベルという明確な基準に基づく。
 */
export function isConfirmedB2Candidate(def: Pick<BoosterDef, "confirmationStatus" | "conditional">): boolean {
  return def.confirmationStatus === "confirmed" && isB2SelectableCandidate(def);
}

/** カタログのバージョン（保存データの互換判定用）。 */
export const BOOSTER_CATALOG_VERSION = "booster-catalog/2026-08-28.total-package-1";
export const BOOSTER_CATALOG_PREVIOUS_VERSIONS = [
  "booster-catalog/2026-08-28.efscout-1",
  "booster-catalog/2026-08-28.world-measured-1",
  "booster-catalog/2026-08-28.evidence-levels-1",
  "booster-catalog/2026-08-28.evidence-levels-2",
];
