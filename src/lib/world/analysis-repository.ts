import { getDb } from "./db";
import { WORLD_CARD_ID_RE } from "./schemas";
import { getWorldDataSource } from "@/lib/reference-data/runtime/data-source";
import { getEfhubAnalysisDetailFromSupabase } from "@/lib/reference-data/runtime/analysis-source";

/**
 * 選手分析レール用の追加読み取り（すべて読み取り専用・すべて任意）。
 *
 * eFHUB 個別ページから取り込んだ 19 カード分の詳細（`player_cards` ほか）に
 * カード ID が一致するときだけ、プレーヤーモデル 11 項目・ポジション適性・COM スキル・
 * 状態値（逆足/フォーム/怪我耐性）を返す。無ければ null（World データだけで表示する）。
 *
 * - `player_cards.efhub_card_id` は World カード ID と同じ長桁 ID（19 件の実測で一致）。
 * - どのクエリが失敗しても全体を壊さない（テーブル未作成の環境でも null / [] を返す）。
 * - SQLite への書き込みは一切しない。
 */

export interface EfhubAnalysisPosition {
  code: string;
  /** 適性度の生値（1 = 部分 / 2 = 高・段階の意味は暫定解釈）。登録ポジションは null。 */
  familiarity: number | null;
  isRegistered: boolean;
}

export interface EfhubAnalysisDetail {
  cardId: string;
  nameEn: string | null;
  registeredPosition: string | null;
  /** 逆足頻度の生値（意味の段階表記は未確認）。 */
  weakFootUsage: number | null;
  /** 逆足精度の生値（意味の段階表記は未確認）。 */
  weakFootAccuracy: number | null;
  /** フォームの生値（意味の段階表記は未確認）。 */
  form: number | null;
  /** コンディション安定度の生値（意味の段階表記は未確認）。 */
  conditionValue: number | null;
  /** 怪我耐性の生値（意味の段階表記は未確認）。 */
  injuryResistance: number | null;
  /** player_model_json をパースしたもの（存在する数値キーのみ）。 */
  playerModel: Record<string, number> | null;
  positions: EfhubAnalysisPosition[];
  comSkills: string[];
  playerSkills: string[];
}

type Row = Record<string, unknown>;

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "bigint") return Number(v);
  return null;
}

function tableExists(db: ReturnType<typeof getDb>, name: string): boolean {
  try {
    return (
      db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?").get(name) != null
    );
  } catch {
    return false;
  }
}

function safeAll(db: ReturnType<typeof getDb>, sql: string, arg: string): Row[] {
  try {
    return db.prepare(sql).all(arg) as Row[];
  } catch {
    return [];
  }
}

export async function getEfhubAnalysisDetail(cardId: string): Promise<EfhubAnalysisDetail | null> {
  if (getWorldDataSource() === "supabase") return getEfhubAnalysisDetailFromSupabase(cardId);
  return getEfhubAnalysisDetailSqlite(cardId);
}

function getEfhubAnalysisDetailSqlite(cardId: string): EfhubAnalysisDetail | null {
  if (!WORLD_CARD_ID_RE.test(cardId)) return null;

  let db: ReturnType<typeof getDb>;
  try {
    db = getDb();
  } catch {
    return null;
  }
  if (!tableExists(db, "player_cards")) return null;

  let card: Row | undefined;
  try {
    card = db
      .prepare(
        `SELECT efhub_card_id, name_en, registered_position, weak_foot_usage, weak_foot_accuracy,
                form, condition_value, injury_resistance, player_model_json
         FROM player_cards WHERE efhub_card_id = ?`,
      )
      .get(cardId) as Row | undefined;
  } catch {
    return null;
  }
  if (!card) return null;

  let playerModel: Record<string, number> | null = null;
  if (typeof card.player_model_json === "string" && card.player_model_json !== "") {
    try {
      const obj = JSON.parse(card.player_model_json);
      if (obj && typeof obj === "object") {
        const m: Record<string, number> = {};
        for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
          if (typeof v === "number" && Number.isFinite(v)) m[k] = v;
        }
        if (Object.keys(m).length > 0) playerModel = m;
      }
    } catch {
      /* 壊れた JSON は無視 */
    }
  }

  const positions: EfhubAnalysisPosition[] = safeAll(
    db,
    "SELECT position_code, familiarity, is_registered FROM player_card_positions WHERE efhub_card_id = ? ORDER BY is_registered DESC, position_code ASC",
    cardId,
  )
    .map((r) => ({
      code: typeof r.position_code === "string" ? r.position_code : "",
      familiarity: num(r.familiarity),
      isRegistered: r.is_registered === 1 || r.is_registered === true,
    }))
    .filter((p) => p.code !== "");

  const comSkills = safeAll(
    db,
    "SELECT skill_key FROM player_card_com_skills WHERE efhub_card_id = ? ORDER BY display_order ASC",
    cardId,
  )
    .map((r) => (typeof r.skill_key === "string" ? r.skill_key : ""))
    .filter(Boolean);

  const playerSkills = safeAll(
    db,
    "SELECT skill_key FROM player_card_skills WHERE efhub_card_id = ? ORDER BY display_order ASC",
    cardId,
  )
    .map((r) => (typeof r.skill_key === "string" ? r.skill_key : ""))
    .filter(Boolean);

  return {
    cardId,
    nameEn: typeof card.name_en === "string" ? card.name_en : null,
    registeredPosition: typeof card.registered_position === "string" ? card.registered_position : null,
    weakFootUsage: num(card.weak_foot_usage),
    weakFootAccuracy: num(card.weak_foot_accuracy),
    form: num(card.form),
    conditionValue: num(card.condition_value),
    injuryResistance: num(card.injury_resistance),
    playerModel,
    positions,
    comSkills,
    playerSkills,
  };
}
