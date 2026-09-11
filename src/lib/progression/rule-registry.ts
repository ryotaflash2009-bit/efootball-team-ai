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
      "育成・選手ブースター・監督補正を含む最終能力値の上限。暫定で99にクランプしている。",
    formula: "finalValue = min(STAT_CAPS.final.value, uncappedValue)  // STAT_CAPS.final.confidence = unresolved",
    source: ["（証拠なし）基礎値の実測を最終値の上限へ流用しない方針"],
    evidence:
      "基礎値338,234件は99超過なしだが、これは『基礎値』の観測であり、育成/ブースター/監督補正を含む最終値の上限が99である証拠ではない。progressionStatCap / playerBoosterStatCap / managerBoosterStatCap / finalStatCap はすべて未確認。",
    testedCards: [],
    exceptions: "100以上が確認されたら STAT_CAPS.final の値だけ変更（エンジンの作り直し不要）。",
    confirmationStatus: "unresolved",
    rulesVersion: V2,
    verifiedAt: "2026-08-28",
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
    description: "Passing / Dribbling / Dexterity / Lower Body Strength / Aerial Strength / Defending / GK1-3 の正確な対象能力値。",
    formula: null,
    source: [
      "screenshot（グループ名のみ）",
      "位置優先のヒント（CB=Defending+Aerial, SB=Lower Body+Dexterity）",
    ],
    evidence: "グループ名は判明。各グループの対象能力値は本アプリの暫定割当（26能力を重複なく10分割）。個別の完全な matrix は未確認。",
    testedCards: [],
    exceptions: "多数（未確認）。",
    confirmationStatus: "provisional",
    rulesVersion: V2,
    verifiedAt: "2026-08-28",
  },
  {
    ruleId: "cost.staged",
    ruleName: "育成ポイントの段階コスト",
    description:
      "グループへの配分が増えるほど、次の1段階に必要なポイントが増える。本アプリは「5段階ごとに +1」で近似。**provisional**。",
    formula: "costForNextLevel(currentLevel) = 1 + floor(currentLevel / 5)  // 近似",
    source: [
      "pesmastery.com（\"1 point for Shooting 0→1\" … \"when Shooting reaches 5, need 2 points for 5→6\"）",
      "gamingonphone / 検索結果（\"the number of progression points required increases as you allocate more\"）",
    ],
    evidence:
      "確認できているのは境界の一部だけ: (a) 配分0→1 のコストは 1pt、(b) 配分5→6 のコストは 2pt（pesmastery の実例1件）。コスト増加が存在すること自体は複数ソース。**「5段階ごとに +1」という一般化、および 9段階目以降・13段階目以降のコストはすべて外挿であり confirmed ではない。**",
    testedCards: [],
    exceptions:
      "9段階目以降/13段階目以降のコストは外挿。1→5 の各段階の正確なコスト、カード別・ゲームバージョン別の差異も未確認。",
    confirmationStatus: "provisional",
    rulesVersion: V2,
    verifiedAt: "2026-08-28",
  },
  {
    ruleId: "progression.per-level-gain",
    ruleName: "グループ配分1段階あたりの能力上昇",
    description: "グループへ1段階配分すると、そのグループの対象能力値がそれぞれ +1 される（99上限）。",
    formula: "statDelta = min(99 - base, groupLevel)",
    source: ["複数ソース（\"one investment moves several related numbers at once\"）", "screenshot のスライダー1本＝1グループ"],
    evidence: "「複数能力が同時に上がる」は確認。正確な上昇量（重み付き/一律）は未確認。本アプリは一律 +1/段階で近似。",
    testedCards: [],
    exceptions: "能力別の重み・上限（+n）は未確認。",
    confirmationStatus: "provisional",
    rulesVersion: V2,
    verifiedAt: "2026-08-28",
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
    description: "ブースターは名前とレベルNを持ち、固定の対象能力へ +N する（例: ボールキャリー+5 → ドリブル/ボールキープ/スピード/ボディバランス +5、Fantasista+2 → Ball Control/Dribbling/Finishing/Balance +2）。",
    formula: "statDelta = boosterLevel (対象能力のみ)",
    source: [
      "screenshot 020026（ボールキャリー +5）",
      "検索結果（Fantasista +2 → Ball Control/Dribbling/Finishing/Balance +2）",
    ],
    evidence: "効果の形（レベルN → 対象能力へ +N）は確認。ただし World `boost1`/`boost2`（1-162）および eFHUB `boostId`（1028-1192）から名前・レベル・対象への対応表が取得できない（両ID体系は別物、参照テーブル未公開）。",
    testedCards: [],
    exceptions: "適用不可（ID→効果の対応が不明）。適用順序（育成前/後）も未確認。",
    confirmationStatus: "unresolved",
    rulesVersion: V2,
    verifiedAt: "2026-08-28",
  },
  {
    ruleId: "manager.correction",
    ruleName: "監督補正",
    description: "監督の戦術習熟度・監督ブースターにより特定能力へ補正（\"{stat} +1\" 表記）。",
    formula: null,
    source: ["eFHUB RSC メッセージ（managerBoosts, managerBoostPlusOne=\"{stat} +1\"）"],
    evidence: "存在は確認。適用順序・対象・重複規則は未確認。",
    testedCards: [],
    exceptions: "実装なし（レイヤーのみ用意）。",
    confirmationStatus: "unresolved",
    rulesVersion: V2,
    verifiedAt: "2026-08-28",
  },
];

export function rulesByStatus(status: RuleConfidence): RuleRecord[] {
  return RULE_REGISTRY.filter((r) => r.confirmationStatus === status);
}
