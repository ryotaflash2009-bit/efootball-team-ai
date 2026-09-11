/**
 * カード付属ブースター（数値ID）→ ブースター名・レベルの生データ（依存なしのリーフモジュール）。
 *
 * 出所: **eFootball World（外部コミュニティDB・KONAMI 公式サイトではない）** の個別選手ページ
 *   （`/player/{worldCardId}`）が、各カードの付属ブースターを「<name> +<level>」の形で表示している。
 *   これを外部ページ表示で観測した（2026-08-28、外部合計 90 リクエスト）。
 *   → ID → 名称・レベル は「外部ページ表示で名称確認済み」。
 *   複数カードで同じ ID が同じ名称・レベルになることを確認（反例 0・競合 0）。
 *
 * 重要:
 *  - World `boost1` と `boost2` は **別の ID 体系**（同じ数値でも別ブースター。
 *    例: `boost1=73` は Strength +3、`boost2=73` は Ball Control +6）。
 *  - World の ID と eFHUB の `boost_id` も別体系。
 *  - **番号の近さから効果を推測しない。** ここに載るのは実際に観測できた ID のみ。
 */

export const BOOSTER_RESOLUTION_VERSION = "player-booster-resolution/2026-08-30.v8";
/**
 * v1 → v2 → v3（効果確認の拡大）→ v4（証拠レベルの再分類）→ v5（game_measured を正確な名称へ）
 * → v6（Total Package の発動条件を KONAMI 公式で確認）→ v7（発動方式 `activation` を分離）
 * → v8（発動方式の証拠レベル `activationEvidence` を分離・fixed の大半を「推定（provisional）」と明示）。
 * ID → 名称・レベルの対応はすべて維持（追加のみ）。
 * v7: KONAMI 公式「The Power of Many」は **複数の効果名に付く発動方式**であると確認。
 *     効果名（`key`）と発動方式（`activation`）を分離。`activation` 省略時は `def.conditional` から導出:
 *       total-package（catalog `conditional: true`）→ "power_of_many"、それ以外 → "fixed"。
 *     World `boost2=44`（Ball Protection）は Messi 89138556575063 のユーザー実測で **金色 = 可変（power_of_many）** と確定。
 * v8: 発動方式の証拠を効果の証拠（`evidenceLevel`）と分離（`activationEvidence`・`docs/phase-booster-activation-types.md`）。
 *     - `total-package`（boost1=83）… power_of_many / `official_verified`（KONAMI 公式 Version Info で明記）。
 *     - `ball-protection`（boost2=44）… power_of_many / `screenshot_verified`（ユーザー実測 + 3カード3リーグ）。
 *     - それ以外の解決済み fixed（World boost1 70 ID / boost2 13 ID）… activation は fixed だが `activationEvidence: "provisional"`。
 *       青/金の判別材料（eFHUB HTML/CSS・World RSC 生ペイロード・ゲーム内実測）が未確認で、
 *       **ScoreBar 差分だけでは「固定 +N」と「Power of Many 最大 +N」を区別できない**。
 *       ただし現在自動適用中の 1,931 カードは一括停止しない（証拠のある ID のみ変更・§13）。
 *     計算挙動は不変（fixed は evidenceLevel に応じて自動適用 / power_of_many は全モード未適用）。
 */
export const BOOSTER_RESOLUTION_PREVIOUS_VERSIONS = [
  "player-booster-resolution/2026-08-28.v1",
  "player-booster-resolution/2026-08-28.v2",
  "player-booster-resolution/2026-08-28.v3",
  "player-booster-resolution/2026-08-28.v4",
  "player-booster-resolution/2026-08-28.v5",
  "player-booster-resolution/2026-08-28.v6",
  "player-booster-resolution/2026-08-28.v7",
];

/**
 * 発動方式。効果名（`key`）とは別軸。
 *  - "fixed"        … 常時固定効果（青色）。証拠レベルに応じて標準/厳密モードへ自動適用。
 *  - "power_of_many" … Game Plan の Activation Condition 該当選手数で効果量が変化（金色）。
 *      自動判定不可のため、どのモードでも自動適用しない。ユーザーが段階（+0/+1/+2/+3）を手動指定したときだけ
 *      その効果名の **対象能力へだけ** 反映（Total Package は対象=全26能力、Ball Protection は対象=4能力）。
 *  - "live_update"  … Live Update Rating（フォーム）連動で発動（KONAMI 公式で存在は確認）。静的育成画面では評価不能・未適用。
 *      **現在この方式と確定できた World ID は 0 件**（内部データにも該当ブースターなし）。推測で割り当てない。
 *  - "unresolved"   … 発動方式を確認できない。
 */
export type BoosterActivationType = "fixed" | "power_of_many" | "live_update" | "unresolved";

/**
 * 発動方式の証拠レベル（効果の `evidenceLevel` とは別軸）。
 *  - "official_verified"       … KONAMI 公式がそのブースターの発動方式を明記
 *  - "screenshot_verified"     … ユーザー提供の画面で段階変化 or 条件表示を確認
 *  - "external_cross_verified" … 複数の独立外部ソースで発動方式が一致し、カード対応も確認
 *  - "provisional"             … 状況証拠のみ（色系列・slot 位置など）。カード単位の裏取り不足 → 「推定」
 *  - "unresolved"              … 発動方式不明
 *  - "conflicted"              … 同一 World ID で異なる発動方式の証拠あり
 */
export type ActivationEvidence =
  | "official_verified"
  | "screenshot_verified"
  | "external_cross_verified"
  | "provisional"
  | "unresolved"
  | "conflicted";

/** マップの1エントリ。`activation` 省略 = `def.conditional` から導出。 */
export interface BoosterMapEntry {
  key: string;
  level: number;
  activation?: BoosterActivationType;
  /** 発動方式の証拠。省略時は解決層で導出（explicit power_of_many → external_cross_verified、derived fixed → provisional）。 */
  activationEvidence?: ActivationEvidence;
}

/** World 個別選手ページで観測した boost1 ID → { catalog key, level }（71 ID）。 */
export const WORLD_BOOST1_MAP: Record<number, BoosterMapEntry> = {
  1: { key: "accuracy", level: 2 },
  2: { key: "accuracy", level: 3 },
  3: { key: "aerial", level: 2 },
  4: { key: "aerial", level: 3 },
  5: { key: "aerial-block", level: 2 },
  6: { key: "aerial-block", level: 3 },
  7: { key: "agility", level: 2 },
  8: { key: "agility", level: 3 },
  9: { key: "balancer", level: 2 },
  10: { key: "balancer", level: 3 },
  11: { key: "ball-protection", level: 2 },
  12: { key: "ball-protection", level: 3 },
  13: { key: "ball-carrying", level: 2 },
  14: { key: "ball-carrying", level: 3 },
  15: { key: "ball-carrying", level: 5 }, // Messi 89136409091415 + George Best 89136677522134・screenshot 020026
  27: { key: "breakthrough", level: 2 },
  28: { key: "breakthrough", level: 3 },
  29: { key: "counter", level: 2 },
  30: { key: "counter", level: 3 },
  31: { key: "crossing", level: 2 },
  32: { key: "crossing", level: 3 },
  33: { key: "defending", level: 2 },
  34: { key: "defending", level: 3 },
  35: { key: "duelling", level: 2 },
  36: { key: "duelling", level: 3 },
  37: { key: "fantasista", level: 2 },
  38: { key: "fantasista", level: 3 },
  39: { key: "free-kick-taking", level: 2 },
  40: { key: "free-kick-taking", level: 3 },
  41: { key: "goalkeeping", level: 2 },
  42: { key: "goalkeeping", level: 3 },
  43: { key: "hard-worker", level: 2 },
  44: { key: "hard-worker", level: 3 },
  49: { key: "off-the-ball", level: 2 },
  50: { key: "off-the-ball", level: 3 },
  51: { key: "offence-creator", level: 2 },
  52: { key: "offence-creator", level: 3 },
  53: { key: "passing", level: 2 },
  54: { key: "passing", level: 3 },
  55: { key: "physicality", level: 2 },
  56: { key: "physicality", level: 3 },
  57: { key: "rebuilding", level: 2 },
  58: { key: "rebuilding", level: 3 },
  60: { key: "regista", level: 2 },
  61: { key: "regista", level: 3 },
  62: { key: "saving", level: 2 },
  63: { key: "saving", level: 3 },
  64: { key: "shooting", level: 2 },
  65: { key: "shooting", level: 3 },
  67: { key: "shutdown", level: 2 },
  68: { key: "shutdown", level: 3 },
  70: { key: "stealing", level: 2 },
  71: { key: "stealing", level: 3 },
  72: { key: "strength", level: 2 },
  73: { key: "strength", level: 3 },
  75: { key: "strikers-instinct", level: 2 },
  76: { key: "strikers-instinct", level: 3 },
  78: { key: "technique", level: 2 },
  79: { key: "technique", level: 3 },
  83: { key: "total-package", level: 3, activation: "power_of_many", activationEvidence: "official_verified" }, // 独立した効果名（≈全26能力）・341カード・KONAMI 公式で発動方式確認（v6）
  85: { key: "technique", level: 4 },
  87: { key: "strikers-instinct", level: 4 },
  88: { key: "crossing", level: 4 },
  90: { key: "accuracy", level: 4 },
  91: { key: "breakthrough", level: 4 },
  144: { key: "duelling", level: 4 },
  145: { key: "off-the-ball", level: 4 },
  148: { key: "agility", level: 4 },
  149: { key: "balancer", level: 4 },
  156: { key: "hard-worker", level: 4 },
  157: { key: "offence-creator", level: 4 }, // Tielemans 106799730583961・screenshot image.png（攻撃の起点 +4）
};

/** World 個別選手ページで観測した boost2 ID → { catalog key, level }（14 ID・boost1 とは別体系）。 */
export const WORLD_BOOST2_MAP: Record<number, BoosterMapEntry> = {
  30: { key: "shooting", level: 3 },
  31: { key: "strength", level: 3 },
  32: { key: "accuracy", level: 3 },
  36: { key: "strikers-instinct", level: 3 },
  40: { key: "physicality", level: 3 },
  42: { key: "breakthrough", level: 3 },
  // Messi 89138556575063（金色スロット）でユーザーが段階を下げると対象4能力だけ各 -1 / OVR 94→93 を実測（2026-08-29）。
  // → 固定 +3 ではなく power_of_many（最大 +3）。標準適用を停止しユーザー段階指定へ。
  // 補強証拠（v8）: 同 ID の 3 カード（Messi=American Cup / Michael Olise=European Cup / Kamada Daichi=Other）が別リーグ
  //   → Activation Condition がカード固有 = Power of Many 版の傍証。boost1 の固定 Ball Protection（ID 11/12）とは別 ID。
  44: { key: "ball-protection", level: 3, activation: "power_of_many", activationEvidence: "screenshot_verified" },
  52: { key: "hard-worker", level: 3 },
  56: { key: "offence-creator", level: 3 },
  70: { key: "technique", level: 3 },
  73: { key: "single-ball-control", level: 6 },
  75: { key: "single-speed", level: 6 },
  76: { key: "single-balance", level: 6 },
  77: { key: "single-aggression", level: 6 },
};

/**
 * eFHUB `player_cards.boost_id_1/2` → { catalog key, level }。
 * 同一カード（World と efhub で card_id が一致）の World 側表示から確認できた分のみ。
 */
export const EFHUB_BOOST_MAP: Record<number, BoosterMapEntry> = {
  1028: { key: "technique", level: 3 }, // Xavi 88040387117922（World slot1=79 = Technique +3）
  1033: { key: "goalkeeping", level: 3 }, // Edwin van der Sar 88038776505238（World slot1=42 = Goalkeeping +3）
};

/**
 * KONAMI のゲームクライアント画面で変化量を直接確認できたブースター（game_client_verified）。
 * **現状 0 件**（`booster-catalog.ts` にも 0 件）。
 */
export const GAME_CLIENT_VERIFIED_KEYS: readonly string[] = [];

/**
 * 保存済みの外部ビルド画面（eFHUB ビルドツール）のスクリーンショットで対象能力・上昇量を確認できたブースター
 * （screenshot_verified）。※ KONAMI のゲームクライアント画面での確認ではない。
 * `booster-catalog.ts` の `evidenceLevel === "screenshot_verified"` と一致（`booster.test.ts` で検証）。
 */
export const SCREENSHOT_VERIFIED_KEYS: readonly string[] = ["ball-carrying", "offence-creator"];

/** @deprecated v5 で `SCREENSHOT_VERIFIED_KEYS` へ改名。互換のため残す。 */
export const GAME_MEASURED_KEYS: readonly string[] = SCREENSHOT_VERIFIED_KEYS;

/**
 * eFootball World（外部DB）の ScoreBar 差分 と EFScout（外部DB）の定義が一致し、
 * 別カード 2 枚以上で反例がないブースター（external_cross_verified・27 種）。
 * **KONAMI 公式の計算結果として確認された値ではない。**
 * `booster-catalog.ts` の `evidenceLevel === "external_cross_verified"` と一致。
 */
export const EXTERNAL_CROSS_VERIFIED_KEYS: readonly string[] = [
  // STANDARD（ball-carrying を除く 10）
  "shooting", "free-kick-taking", "aerial", "passing", "technique",
  "defending", "duelling", "agility", "physicality", "goalkeeping",
  // EXTENDED（offence-creator を除く 17）
  "strikers-instinct", "shutdown", "hard-worker", "saving", "crossing", "fantasista",
  "regista", "rebuilding", "accuracy", "ball-protection", "balancer",
  "counter", "aerial-block", "breakthrough", "strength", "off-the-ball", "stealing",
];

/**
 * @deprecated v4+ で証拠レベルに分離。
 * 「標準モードで自動適用してよいキー」= game_client_verified ∪ screenshot_verified ∪ external_cross_verified。互換のため残す。
 */
export const CONFIRMED_EFFECT_KEYS: readonly string[] = [
  ...GAME_CLIENT_VERIFIED_KEYS,
  ...SCREENSHOT_VERIFIED_KEYS,
  ...EXTERNAL_CROSS_VERIFIED_KEYS,
];
