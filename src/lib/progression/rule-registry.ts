import type { RuleConfidence } from "./types";

/**
 * 育成規則の証拠台帳。各規則の根拠・検証状態を1箇所に集約する。
 * confirmed: 複数の独立ソースで一致 / provisional: 有力だが検証不足 /
 * unresolved: 意味・式が不明 / unsupported: 現データで実装不能。
 */
export interface RuleRecord {
  ruleId: string;
  ruleName: string;
  description: string;
  formula: string | null;
  source: string[];
  evidence: string;
  testedCards: string[];
  exceptions: string;
  confirmationStatus: RuleConfidence;
  rulesVersion: string;
  verifiedAt: string;
}

const V2 = "progression/2026-08-28.v2";

export const RULE_REGISTRY: RuleRecord[] = [
  {
    ruleId: "points.per-level",
    ruleName: "レベルアップあたりの育成ポイント",
    description: "プレイヤーレベルが1上がるごとに育成ポイントを2得る。",
    formula: "pointsGained(levelUps) = levelUps * 2",
    source: [
      "screenshots/スクリーンショット 2026-08-28 020026.png（レベル上限34 → 「ポイント 0 / 66」= 33×2）",
      "pesmastery.com/efootball-level-up-guide/（\"Each increase in level gives you 2 progression points\"）",
      "gamingonphone.com eFootball 2026 Progression Points ガイド（同記述）",
    ],
    evidence: "3つの独立ソースで一致。screenshot の実数値 66 = (34-1)×2 とも整合。",
    testedCards: ["89138556575063 (Messi, Lv32→62)", "88041460996837 (Cannavaro, Lv27→52)"],
    exceptions: "レベル1カード（レベルアップ0回）は0ポイント。",
    confirmationStatus: "confirmed",
    rulesVersion: V2,
    verifiedAt: "2026-08-28",
  },
  {
    ruleId: "points.total",
    ruleName: "最大レベル時の総育成ポイント",
    description: "最大レベルまで上げたときの総ポイントは (最大レベル − 1) × 2。",
    formula: "totalPoints(maxLevel) = maxLevel > 1 ? (maxLevel - 1) * 2 : 0",
    source: ["points.per-level と同じ", "screenshot 020026 の 66 = (34-1)×2"],
    evidence: "per-level=2 が confirmed で、レベル1始点も screenshot と整合。全カード共通かは要検証（例外未確認）。",
    testedCards: ["89138556575063", "88041460996837", "106788187832737"],
    exceptions: "TRENDING / 育成不可カードは対象外（progression.eligibility 参照）。",
    confirmationStatus: "confirmed",
    rulesVersion: V2,
    verifiedAt: "2026-08-28",
  },
  {
    ruleId: "stat.cap.base",
    ruleName: "基礎能力値の上限",
    description: "レベル1の基礎能力値は99が上限。",
    formula: "baseValue = min(99, storedBaseValue)",
    source: [
      "SQLite world_player_stats 338,234件（stat_kind='base'）の実測（最小40 / 最大99 / 99超え 0件）",
      "gamemarket.gg（能力値は \"roughly 40 to 99\"）",
    ],
    evidence: "保存済み基礎値33万件 + 外部記述で一致。",
    testedCards: ["全13,009カードの基礎値"],
    exceptions: "なし（基礎値について）。",
    confirmationStatus: "confirmed",
    rulesVersion: V2,
    verifiedAt: "2026-08-28",
  },
  {
    ruleId: "stat.cap.final",
    ruleName: "最終能力値の上限（育成・ブースター・監督補正込み）",
    description:
      "基礎＋育成は 99 で止まり、選手のブースター・監督のブースターはその上に足す（99 を超えられる）。最終値に上限は設けない。",
    formula: "finalValue = max(STAT_FLOOR, min(99, base + progression) + playerBooster + managerBooster)",
    source: [
      "KONAMI 公式 eFootball v3.00 Version Info「Boosters … allow players to perform beyond the normal ceiling of 99」",
      "eFHUB の育成シミュレーター（applyProgression は min(99)・applyManagerBoosts と applyPlayerBoost は止めない・2026-10-09 照合）",
    ],
    evidence:
      "公式の説明と eFHUB の計算が一致（2026-10-09）。基礎値 338,234 件の 99 以下は『基礎値』の観測で、ブースター込みの値の上限ではない。",
    testedCards: ["booster.test.ts（基礎 99 ＋ ブースター 5 → 104・育成は 99 で止まる）"],
    exceptions: "監督の『チームの戦術の適性』の補正（eFHUB の managerSkill）は TeamAIXI では計算しない（eFHUB の内部の表のため）。",
    confirmationStatus: "confirmed",
    rulesVersion: V2,
    verifiedAt: "2026-10-09",
  },
  {
    ruleId: "progression.grouped",
    ruleName: "育成はグループ単位",
    description: "育成ポイントは約10のグループ（カテゴリ）へ配分し、1配分で関連する複数の能力値が同時に上がる。",
    formula: null,
    source: [
      "screenshot 020026（育成パネルに10スライダー）",
      "eFHUB RSC キー（shooting/passing/dribbling/dexterity/lowerBodyStrength/aerialStrength/defending/gk1/gk2/gk3）",
      "pesmastery / gamemarket / mobilegaminghub（\"roughly ten grouped categories\", \"one investment moves several related numbers\"）",
    ],
    evidence:
      "英語グループ名（Shooting/Passing/…/GK1-3）は複数ソースで一致。1配分＝関連能力を同時上昇 も複数ソースで一致。**日本語の正式グループ名は未確認**（screenshot の日本語表記も判読が曖昧。Shooting は「シュート」を候補とし『撮影』とは訳さない）。",
    testedCards: [],
    exceptions: "GK グループはフィールド選手でも表示される（screenshot）。日本語名は仮称。",
    confirmationStatus: "confirmed",
    rulesVersion: V2,
    verifiedAt: "2026-08-28",
  },
  {
    ruleId: "group.shooting.stats",
    ruleName: "Shooting グループの対象能力値",
    description: "Shooting は Finishing / Set Piece Taking（Place Kicking）/ Curl を上げる。",
    formula: null,
    source: [
      "pesmastery.com（\"Shooting affects Finishing, Set Pieces, and Curl\"）",
      "gamemarket.gg（\"Shooting bundles Finishing, Place Kicking and Curl\"）",
      "mobilegaminghub.com（同旨）",
    ],
    evidence: "3ソースで一致。",
    testedCards: [],
    exceptions: "なし（判明分）。",
    confirmationStatus: "confirmed",
    rulesVersion: V2,
    verifiedAt: "2026-08-28",
  },
  {
    ruleId: "group.other.stats",
    ruleName: "Shooting 以外のグループの対象能力値",
    description: "Passing / Dribbling / Dexterity / Lower Body Strength / Aerial Strength / Defending / GK1-3 の対象能力値（eFHUB基準・Jumping は Aerial Strength と GK 1 の両方）。",
    formula: "stat-groups.ts の PROGRESSION_GROUPS",
    source: [
      "eFHUB の育成シミュレーター（PROGRESSION_SLIDERS の affectedStats・2026-10-09 照合）",
      "Dexterity = Offensive Awareness・Acceleration・Balance は外部ガイドのヒントとも一致",
    ],
    evidence: "eFHUB の定義と照合し、以前の暫定の割当と違った 6 カテゴリを直した（docs/product/progression-efhub-crosscheck-2026-10-09.md）。ゲームの公式の発表ではない（KONAMI は一覧を公開していない）。",
    testedCards: ["stat-groups-efhub.test.ts"],
    exceptions: "eFHUB基準。ゲーム内の表示と違う例が見つかれば、その画面を根拠に直す。",
    confirmationStatus: "confirmed",
    rulesVersion: V2,
    verifiedAt: "2026-10-09",
  },
  {
    ruleId: "cost.staged",
    ruleName: "育成ポイントの段階コスト",
    description:
      "カテゴリのレベル L に上げるコストは ceil(L/4)（1〜4 段階 1pt・5〜8 段階 2pt・9〜12 段階 3pt …）。2026-10-08 より前に保存したビルドは、本人が再計算するまで旧規則（5 段階ごと）のまま。",
    formula: "costForNextLevel(currentLevel) = 1 + floor(currentLevel / 4)  // 現行 staged-2026-10-08（旧 staged-2026-08-28 は / 5）",
    source: [
      "eFHUB の育成シミュレーター（cost = Math.ceil(level / 4)・2026-10-09 照合）",
      "efootballlab（4 段階ごと）・本人の確認（2026-10-08）",
    ],
    evidence: "eFHUB の計算・外部の記述・本人の確認が一致。境界 0→1・3→4・4→5・7→8・8→9 をテストで固定（cost-rule-v3.test.ts・stat-groups-efhub.test.ts）。",
    testedCards: ["cost-rule-v3.test.ts", "black-box-cost-rule.mjs"],
    exceptions: "旧規則のビルドは保存した時の規則で数える（自動では再計算しない）。",
    confirmationStatus: "confirmed",
    rulesVersion: V2,
    verifiedAt: "2026-10-09",
  },
  {
    ruleId: "progression.per-level-gain",
    ruleName: "グループ配分1段階あたりの能力上昇",
    description: "グループへ1段階配分すると、そのグループの対象能力値がそれぞれ +1 される（基礎＋育成は 99 で止まる）。",
    formula: "progressed = min(99, base + Σ groupLevel(対象のカテゴリ))",
    source: ["eFHUB の育成シミュレーター（applyProgression: 対象能力に +level・Math.min(99)・2026-10-09 照合）"],
    evidence: "eFHUB の計算と一致（一律 +1/段階・重みなし）。",
    testedCards: ["stat-groups-efhub.test.ts"],
    exceptions: "eFHUB基準（ゲームの公式の発表ではない）。",
    confirmationStatus: "confirmed",
    rulesVersion: V2,
    verifiedAt: "2026-10-09",
  },
  {
    ruleId: "progression.eligibility",
    ruleName: "育成不可カードの判定",
    description: "TRENDING（POTW 等）カード、または最大レベルが1のカードは育成できない。",
    formula: "canProgress = cardType !== 'TRENDING' && maximumLevel > 1",
    source: [
      "pesmastery.com（\"Trending players — Able Level up: No\"）",
      "SQLite 実測（TRENDING 3,502件すべて maxLevel=1 / maxLevel=1 の 2,801件で ovr_max == ovr_base）",
    ],
    evidence: "外部記述 + 実測で一致。",
    testedCards: ["52902186095121 (TRENDING, Lv1)", "全 TRENDING 3,502件"],
    exceptions: "maxLevel=1 だが ovr_max≠ovr_base の TRENDING が 701件（差 1-2、育成ではなく別要因とみられる）。",
    confirmationStatus: "confirmed",
    rulesVersion: V2,
    verifiedAt: "2026-08-28",
  },
  {
    ruleId: "ovr.calc",
    ruleName: "OVR の計算",
    description: "OVR は登録ポジションで重み付けした能力値の要約。",
    formula: null,
    source: ["gamemarket.gg（\"a weighted summary of attributes weighted for the player's registered position\"）"],
    evidence: "計算の形（ポジション別加重）は確認。具体的な重みは非公開。",
    testedCards: [],
    exceptions: "重み・丸め・特殊補正は未確認。本アプリは暫定重みで概算（推定OVR）。",
    confirmationStatus: "provisional",
    rulesVersion: V2,
    verifiedAt: "2026-08-28",
  },
  {
    ruleId: "booster.effect",
    ruleName: "選手ブースターの効果",
    description: "ブースターは名前とレベルNを持ち、固定の対象能力へ +N する。育成の後（基礎＋育成を 99 で止めた後）に足し、99 を超えられる。",
    formula: "final = min(99, base + progression) + Σ boosterLevel (対象能力のみ)",
    source: [
      "KONAMI 公式 v3.00 Version Info（Boosters は通常の上限 99 を超えられる）",
      "eFHUB の育成シミュレーター（applyPlayerBoost: 対象能力に +値・育成の後・止めない・2026-10-09 照合）",
      "screenshot 020026（ボールキャリー +5）",
    ],
    evidence: "効果の形（レベル N → 対象能力へ +N）・適用の順序（育成の後）・上限（なし）を確認。カードごとの付属ブースターの特定は証拠の段階つき（booster-list の 5 段階・ブースター一覧の画面）。",
    testedCards: ["booster.test.ts"],
    exceptions: "付属ブースターの特定が外部 1 ソースだけのもの（効果未確定）は標準の最終値に入れない。条件つきの段階（Total Package 等）は利用者の手動指定だけ。",
    confirmationStatus: "confirmed",
    rulesVersion: V2,
    verifiedAt: "2026-10-09",
  },
  {
    ruleId: "manager.correction",
    ruleName: "監督補正",
    description: "監督のブースターは対象能力へ +1（\"{stat} +1\"）。育成の後に足し、99 を超えられる。戦術の適性（チームの戦術の熟練度）による補正は計算しない。",
    formula: "final = min(99, base + progression) + playerBoosters + managerBoosters(+1)",
    source: [
      "eFHUB（applyManagerBoosts: 対象能力に +1・止めない・2026-10-09 照合・表示 \"{stat} +1\"）",
      "amine250 managers.json + コミュニティの照合（監督ごとの対象能力）",
    ],
    evidence: "監督ブースターの効果（+1）と順序は eFHUB と一致。対象能力が確認済みの効果だけを適用（未確認は適用しない）。",
    testedCards: ["calculate-manager-booster のテスト"],
    exceptions: "戦術の適性の補正（eFHUB の managerSkill の倍率の表）は eFHUB の内部データのため使わない（RIGHTS_OR_ACCESS_BLOCKED）。",
    confirmationStatus: "confirmed",
    rulesVersion: V2,
    verifiedAt: "2026-10-09",
  },
];

export function rulesByStatus(status: RuleConfidence): RuleRecord[] {
  return RULE_REGISTRY.filter((r) => r.confirmationStatus === status);
}
