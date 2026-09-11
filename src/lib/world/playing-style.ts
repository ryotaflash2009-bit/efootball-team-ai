/**
 * プレースタイル正規化層（表示専用の言語非依存な識別子への変換・純関数のみ）。
 *
 * 背景・根拠: `docs/playing-style-ledger.md`（プレースタイル規則台帳）。
 *
 * 設計原則:
 *  - **発動対象ポジション・発動可否は一切扱わない**（`docs/playing-style-ledger.md` §4のとおり、
 *    プレースタイル名と発動対象ポジションの確認済み対応表は本プロジェクト内に存在しないため）。
 *  - 同一入力からは常に同一の結果を返す純関数のみ。SQLite / localStorage / HTTP / DOM へは一切アクセスしない。
 *  - **大文字小文字・ハイフン・空白だけを無制限に自動吸収しない。** 確認済みの別名（`PLAYING_STYLE_ALIASES`）
 *    だけを明示的に管理し、それ以外は前後の空白除去だけを行った上で完全一致判定する。
 *  - 攻撃（offensive・`playingStyle`）と守備（defensive・`playingStyleDefensive`）は**統合しない**。
 *    同じ英語表記が両方に現れる場合（Basic / Box-to-Box / Anchor Man）でも、`attribute` で区別したまま扱う。
 *  - AIプレースタイル（`aiStyles`）は通常のプレースタイルとは別の語彙・別の関数（`normalizeAiPlayingStyle`）で
 *    扱う。canonicalId の名前空間・別名テーブルを共有しない。
 *  - 未知の値を `Basic` や「値なし」へ勝手に変換しない。`"$undefined"` のような異常値、`"-"` のような
 *    AIプレースタイル側の未知記号を、正式なプレースタイルとして登録しない。
 *  - `canonicalId` はこのモジュールのために新規に付与した表示・照合専用の内部識別子であり、
 *    ユーザー向け画面には出さない（画面には既存の英語表記 `rawValue` / `canonicalEnglishName` を表示する）。
 */

// ---------------------------------------------------------------------------
// 型
// ---------------------------------------------------------------------------

/** 攻撃（`playingStyle`）か守備（`playingStyleDefensive`）か。統合しない。 */
export type PlayingStyleAttribute = "offensive" | "defensive";

/** 値の出所（監査・観察用のメタ情報。正規化の判定ロジックそのものには使用しない）。 */
export type PlayingStyleSource = "world" | "efhub" | "linkUp" | "other";

export type PlayingStyleStatus =
  /** 確認済みの正規表記に完全一致した。 */
  | "known"
  /** 確認済みの別名（表記揺れ）に完全一致し、正規表記へ解決できた。 */
  | "aliasMatched"
  /** 値が `"Basic"`（攻撃・守備どちらの欄にも現れる既定値相当。意味の断定はしない）。 */
  | "basic"
  /** 値が null / undefined / 空文字（trim後）。 */
  | "empty"
  /** `"$undefined"` 等、データ由来の異常値と確認済み。 */
  | "anomaly"
  /** 既知の正規表記・別名のいずれにも一致しない未知の値。 */
  | "unknown"
  /** 別の属性（攻撃⇔守備）や別概念の確認済み名称と一致するが、今回の呼び出し文脈には該当しない。 */
  | "notApplicable";

export interface NormalizedPlayingStyle {
  /** このモジュール内だけの内部識別子。ユーザー向け表示には使用しない。known/aliasMatched/basic/notApplicable時のみ非null。 */
  canonicalId: string | null;
  /** 正規表記の英語名（確認済みデータ上の表記そのもの）。 */
  canonicalEnglishName: string | null;
  /** 元の生データ（trimしない・そのまま保持）。 */
  rawValue: string | null;
  status: PlayingStyleStatus;
  source: PlayingStyleSource;
  attribute: PlayingStyleAttribute;
  /** aliasMatched のときだけ、一致した別名の生表記（trim後）。 */
  matchedAlias: string | null;
}

export type AiPlayingStyleStatus =
  /** 確認済みのAIプレースタイル名に完全一致。 */
  | "known"
  /** `"-"` など、AIプレースタイル側の未知記号（異常値ではなく、意味未確認のプレースホルダーとして扱う）。 */
  | "unknownMarker"
  /** 値が null / undefined / 空文字（trim後）。 */
  | "empty"
  /** 既知のAIプレースタイル名・既知の記号のいずれにも一致しない未知の値。 */
  | "unknown";

export interface NormalizedAiPlayingStyle {
  rawValue: string | null;
  canonicalEnglishName: string | null;
  status: AiPlayingStyleStatus;
  source: PlayingStyleSource;
}

// ---------------------------------------------------------------------------
// 確認済みレジストリ（`docs/playing-style-ledger.md` §5-1・§5-2 と一致させること）
// ---------------------------------------------------------------------------

/** 攻撃プレースタイル（World `playing_style`・21種類）。根拠: 台帳§5-1。 */
export const KNOWN_OFFENSIVE_PLAYING_STYLES: Record<string, string> = {
  basic: "Basic",
  holePlayer: "Hole Player",
  goalPoacher: "Goal Poacher",
  creativePlaymaker: "Creative Playmaker",
  boxToBox: "Box-to-Box",
  prolificWinger: "Prolific Winger",
  buildUp: "Build Up",
  attackingFullBack: "Attacking Full-back",
  orchestrator: "Orchestrator",
  deepLyingForward: "Deep-lying Forward",
  foxInTheBox: "Fox in the Box",
  roamingFlank: "Roaming Flank",
  anchorMan: "Anchor Man",
  defensiveFullBack: "Defensive Full-back",
  extraFrontman: "Extra Frontman",
  fullBackFinisher: "Full-back Finisher",
  crossSpecialist: "Cross Specialist",
  targetMan: "Target Man",
  classicNo10: "Classic No. 10",
  dummyRunner: "Dummy Runner",
  highLineGk: "High Line GK",
};

/**
 * 守備プレースタイル（World `playing_style_def`・14種類）。根拠: 台帳§5-2。
 * `basic` / `boxToBox` / `anchorMan` は攻撃と同じ識別子を再利用する（同一の英語表記のため）。
 * ただし `attribute` フィールドにより、攻撃側の判定結果と混同されることはない。
 */
export const KNOWN_DEFENSIVE_PLAYING_STYLES: Record<string, string> = {
  basic: "Basic",
  boxToBox: "Box-to-Box",
  theDestroyer: "The Destroyer",
  attackingGk: "Attacking GK",
  anchorMan: "Anchor Man",
  defensiveGk: "Defensive GK",
  frontLinePressure: "Front Line Pressure",
  passDisruptor: "Pass Disruptor",
  frontLinePoacher: "Front Line Poacher",
  allActionDefender: "All-action Defender",
  highLineMaster: "High Line Master",
  coveringRole: "Covering Role",
  attackOutlet: "Attack Outlet",
  sweeperGk: "Sweeper GK",
};

/**
 * 確認済みの別名（表記揺れ）。根拠: 台帳§5-3・§6（eFHUB(19件) vs World(13,009件)の突き合わせで確認）。
 *
 * ここに登録するのは「同じ属性（攻撃/守備）の欄どうしで、綴り・区切り文字・大文字小文字だけが異なる」
 * ことを確認できた組み合わせだけに限定する。
 *
 * `Destroyer` / `Defensive Goalkeeper`（いずれもeFHUBの**攻撃**欄 `playing_style_name` に実在する値）は、
 * 実装検証の過程で意図的に**別名登録しなかった**。`The Destroyer` / `Defensive GK` はWorldの**守備**欄
 * `playing_style_def` 専用の値であり、この2つを同一視するには「攻撃欄の値を守備欄の概念へ読み替える」
 * という、属性をまたいだ推測が必要になる。これは「playingStyleとplayingStyleDefensiveを統合しない」
 * という要件に反するため、名称が似ていても統合しない（`unknown` として扱う）。
 * 同様に `Offensive Wingback` / `Offensive Goalkeeper`（eFHUB）も、Worldに完全一致する値が無く、
 * 類似する値（`Attacking Full-back` / `Attacking GK`）との同一性を確認できる根拠が無いため登録しない。
 */
export interface PlayingStyleAlias {
  /** 別名の生表記（trim済み・大文字小文字を保持したまま完全一致で照合する）。 */
  rawValue: string;
  attribute: PlayingStyleAttribute;
  canonicalId: string;
}

export const PLAYING_STYLE_ALIASES: readonly PlayingStyleAlias[] = [
  { rawValue: "Box To Box", attribute: "offensive", canonicalId: "boxToBox" },
  { rawValue: "Deep-Lying Forward", attribute: "offensive", canonicalId: "deepLyingForward" },
  { rawValue: "Fox In The Box", attribute: "offensive", canonicalId: "foxInTheBox" },
];

/** 確認済みの異常値（データ破損・パース由来の artifact と確認済み）。根拠: 台帳§5-3・§6。 */
export const PLAYING_STYLE_ANOMALY_VALUES: ReadonlySet<string> = new Set(["$undefined"]);

/** AIプレースタイル（World `world_player_ai_styles.style_name`・8種類）。根拠: 台帳§5-4。通常プレースタイルとは別語彙。 */
export const KNOWN_AI_PLAYING_STYLES: ReadonlySet<string> = new Set([
  "Long Ranger",
  "Mazing Run",
  "Speeding Bullet",
  "Incisive Run",
  "Long Ball Expert",
  "Trickster",
  "Early Cross",
]);

/** AIプレースタイル側の未知記号（意味未確認のプレースホルダー。異常値ではない）。根拠: 台帳§5-4・§6。 */
export const AI_PLAYING_STYLE_UNKNOWN_MARKERS: ReadonlySet<string> = new Set(["-"]);

// ---------------------------------------------------------------------------
// 内部ユーティリティ
// ---------------------------------------------------------------------------

function registryOf(attribute: PlayingStyleAttribute): Record<string, string> {
  return attribute === "offensive" ? KNOWN_OFFENSIVE_PLAYING_STYLES : KNOWN_DEFENSIVE_PLAYING_STYLES;
}

function otherAttributeOf(attribute: PlayingStyleAttribute): PlayingStyleAttribute {
  return attribute === "offensive" ? "defensive" : "offensive";
}

function findCanonicalIdByName(registry: Record<string, string>, name: string): string | null {
  for (const [id, englishName] of Object.entries(registry)) {
    if (englishName === name) return id;
  }
  return null;
}

function findAlias(trimmed: string, attribute: PlayingStyleAttribute): PlayingStyleAlias | null {
  for (const alias of PLAYING_STYLE_ALIASES) {
    if (alias.attribute === attribute && alias.rawValue === trimmed) return alias;
  }
  return null;
}

// ---------------------------------------------------------------------------
// 正規化（通常プレースタイル: 攻撃/守備）
// ---------------------------------------------------------------------------

/**
 * 攻撃/守備プレースタイルの生データを正規化する純関数。
 * 同一の `(rawValue, attribute, source)` からは常に同一の結果を返す。入力を変更しない。
 */
export function normalizePlayingStyle(
  rawValue: string | null | undefined,
  attribute: PlayingStyleAttribute,
  source: PlayingStyleSource,
): NormalizedPlayingStyle {
  const raw = rawValue ?? null;
  const trimmed = raw != null ? raw.trim() : "";

  const base = { rawValue: raw, source, attribute };

  if (raw == null || trimmed === "") {
    return { ...base, canonicalId: null, canonicalEnglishName: null, status: "empty", matchedAlias: null };
  }

  if (PLAYING_STYLE_ANOMALY_VALUES.has(trimmed)) {
    return { ...base, canonicalId: null, canonicalEnglishName: null, status: "anomaly", matchedAlias: null };
  }

  if (trimmed === "Basic") {
    return { ...base, canonicalId: "basic", canonicalEnglishName: "Basic", status: "basic", matchedAlias: null };
  }

  const registry = registryOf(attribute);
  const directId = findCanonicalIdByName(registry, trimmed);
  if (directId) {
    return { ...base, canonicalId: directId, canonicalEnglishName: trimmed, status: "known", matchedAlias: null };
  }

  const alias = findAlias(trimmed, attribute);
  if (alias) {
    return {
      ...base,
      canonicalId: alias.canonicalId,
      canonicalEnglishName: registry[alias.canonicalId] ?? null,
      status: "aliasMatched",
      matchedAlias: trimmed,
    };
  }

  // 他方の属性（攻撃⇔守備）の確認済み名称と一致する場合は、別概念・別属性として区別する
  // （「似た名前だから統合する」のではなく、属性が違う既知の名称であることを明示するだけ）。
  const otherAttribute = otherAttributeOf(attribute);
  const otherRegistry = registryOf(otherAttribute);
  const otherId = findCanonicalIdByName(otherRegistry, trimmed);
  if (otherId) {
    return {
      ...base,
      canonicalId: otherId,
      canonicalEnglishName: otherRegistry[otherId],
      status: "notApplicable",
      matchedAlias: null,
    };
  }

  return { ...base, canonicalId: null, canonicalEnglishName: null, status: "unknown", matchedAlias: null };
}

/**
 * 2つの正規化結果が「同一のプレースタイル」とみなせるかどうかを判定する。
 * `canonicalId` だけでなく `attribute` も一致することを必須にする（攻撃/守備を混同しないため）。
 * どちらかの `canonicalId` が null（empty/anomaly/unknown/notApplicable）の場合は false を返す
 * （呼び出し側は必要に応じて既存の生文字列比較へフォールバックすること）。
 */
export function arePlayingStylesEquivalent(a: NormalizedPlayingStyle, b: NormalizedPlayingStyle): boolean {
  if (a.canonicalId == null || b.canonicalId == null) return false;
  return a.canonicalId === b.canonicalId && a.attribute === b.attribute;
}

// ---------------------------------------------------------------------------
// 正規化（AIプレースタイル・通常プレースタイルとは別語彙）
// ---------------------------------------------------------------------------

/**
 * AIプレースタイルの生データを正規化する純関数。通常プレースタイル（攻撃/守備）とは
 * canonicalId・別名テーブルを共有しない別関数。
 */
export function normalizeAiPlayingStyle(
  rawValue: string | null | undefined,
  source: PlayingStyleSource,
): NormalizedAiPlayingStyle {
  const raw = rawValue ?? null;
  const trimmed = raw != null ? raw.trim() : "";

  if (raw == null || trimmed === "") {
    return { rawValue: raw, canonicalEnglishName: null, status: "empty", source };
  }
  if (AI_PLAYING_STYLE_UNKNOWN_MARKERS.has(trimmed)) {
    return { rawValue: raw, canonicalEnglishName: null, status: "unknownMarker", source };
  }
  if (KNOWN_AI_PLAYING_STYLES.has(trimmed)) {
    return { rawValue: raw, canonicalEnglishName: trimmed, status: "known", source };
  }
  return { rawValue: raw, canonicalEnglishName: null, status: "unknown", source };
}
