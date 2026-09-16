/**
 * `reference_data.player_card_analysis`からのSupabase読み取り(公開参照専用、SELECTのみ)。
 *
 * SQLite側は`player_cards`+`player_card_positions`+`player_card_com_skills`+
 * `player_card_skills`の4テーブルJOINだったが、Postgres側は移行時に1テーブルへ
 * 統合済みのため、この経路はSELECT 2回(分析本体+名前/ポジションの参照)で完結する。
 *
 * 既知の制約(Phase Dシャドー比較で実測確認、推測ではない):
 * - `name_en`は`player_card_analysis.efhub_name_en`(レガシーeFHUB由来、SQLite側
 *   `player_cards.name_en`と同じ値を保持する専用列)から取得する。通常のWorld選手名
 *   (`world_player_cards.name_en`、ダイアクリティカルマーク保持・正規化済み)とは
 *   意図的に別物として扱う(ユーザーの明示判断: 既存SQLiteの表示仕様を変更しない)。
 *   この列は追加migrationの適用と差分データ投入が完了するまで存在しないため、
 *   それまでは常にnullを返す(docs/production-readiness/sql/
 *   extend-player-card-analysis-name-schema.sql)。
 * - `positions`配列の並び順は初回投入時にDB挿入順のまま格納されており、SQLite側の
 *   ライブクエリが適用する`is_registered DESC, position_code ASC`という並び順と
 *   異なる場合がある(要素の集合・値そのものは完全一致、順序のみの差)。データ自体を
 *   書き換えず、読み取り時に同じ並び順を適用することでこの差を解消している
 *   (下記`toPositions`)。
 */
import type { ReferenceDataClient } from "./supabase-client";
import { WORLD_CARD_ID_RE } from "@/lib/world/schemas";
import type { EfhubAnalysisDetail, EfhubAnalysisPosition } from "@/lib/world/analysis-repository";
import { getReferenceDataClient } from "./supabase-client";
import { normalizeClientError, normalizeQueryError } from "./errors";

type Row = Record<string, unknown>;

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

/**
 * SQLite側のライブクエリ("ORDER BY is_registered DESC, position_code ASC")と
 * 同じ並び順になるよう、読み取り時に安定ソートする(格納時の順序に依存しない)。
 */
function toPositions(v: unknown): EfhubAnalysisPosition[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((item): EfhubAnalysisPosition | null => {
      if (!item || typeof item !== "object") return null;
      const o = item as Record<string, unknown>;
      const code = typeof o.code === "string" ? o.code : "";
      if (code === "") return null;
      return {
        code,
        familiarity: num(o.familiarity),
        isRegistered: o.isRegistered === true,
      };
    })
    .filter((p): p is EfhubAnalysisPosition => p != null)
    .sort((a, b) => {
      if (a.isRegistered !== b.isRegistered) return a.isRegistered ? -1 : 1;
      return a.code.localeCompare(b.code);
    });
}

function toStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x !== "");
}

function toPlayerModel(v: unknown): Record<string, number> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === "number" && Number.isFinite(val)) out[k] = val;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export async function getEfhubAnalysisDetailFromSupabase(cardId: string, client?: ReferenceDataClient): Promise<EfhubAnalysisDetail | null> {
  if (!WORLD_CARD_ID_RE.test(cardId)) return null;

  let c: ReferenceDataClient;
  try {
    c = client ?? getReferenceDataClient();
  } catch (err) {
    throw normalizeClientError(err, { operation: "analysis.detail" });
  }

  const { data, error, status } = await c.from("player_card_analysis").select("*").eq("world_card_id", cardId).maybeSingle();
  if (error) throw normalizeQueryError(error, { operation: "analysis.detail", status });
  if (!data) return null;
  const row = data as Row;

  // registered_positionは同一world_card_idのworld_player_cardsから補う(既存レスポンス形状を維持するため)。
  // nameEnはplayer_card_analysis自身のefhub_name_en列から取る(world_player_cards.name_enとは別物)。
  const nameEn = typeof row.efhub_name_en === "string" ? row.efhub_name_en : null;
  let registeredPosition: string | null = null;
  const {
    data: cardData,
    error: cardError,
    status: cardStatus,
  } = await c.from("world_player_cards").select("registered_position").eq("world_card_id", cardId).maybeSingle();
  if (cardError) throw normalizeQueryError(cardError, { operation: "analysis.detail", status: cardStatus });
  if (cardData) {
    registeredPosition = typeof (cardData as Row).registered_position === "string" ? ((cardData as Row).registered_position as string) : null;
  }

  return {
    cardId,
    nameEn,
    registeredPosition,
    weakFootUsage: num(row.weak_foot_usage),
    weakFootAccuracy: num(row.weak_foot_accuracy),
    form: num(row.form),
    conditionValue: num(row.condition_value),
    injuryResistance: num(row.injury_resistance),
    playerModel: toPlayerModel(row.player_model),
    positions: toPositions(row.positions),
    comSkills: toStringArray(row.com_skills),
    playerSkills: toStringArray(row.player_skills),
  };
}
