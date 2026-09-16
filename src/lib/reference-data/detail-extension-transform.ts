/**
 * 既存reference_dataテーブル(world_player_cards 13,009件・managers 66件)への
 * 詳細フィールド追加(efhub_card_id/ai_styles/appearance/efhub_conflicts/
 * boosters/link_up_plays)を、SQLite正本の行データから組み立てる純関数群。
 *
 * 実Supabase・実PostgreSQLへは一切接続しない。ここでの関数はすべて
 * 「読み取り済みのプレーンオブジェクト → 変換後オブジェクト」の純粋な変換であり、
 * 副作用(ファイル書込み・ネットワーク通信)を持たない。
 *
 * この差分投入は、既存13,009/66/19件を再投入する初回投入とは別物であり、
 * 既存行の他カラムには一切触れず、新規追加した列だけをUPDATEする設計を前提にする
 * (実際のUPDATE実行はreal-import-detail-extension-orchestrator.tsが担う)。
 */

export interface SourceRecordLinkRow {
  internal_card_id: number;
  source: "world" | "efhub" | string;
  source_card_id: string;
}

/** world_card_id → efhub_card_id の1:1対応表(source_record_links由来)。 */
export function buildEfhubLinkMap(rows: readonly SourceRecordLinkRow[]): Map<string, string> {
  const byInternalId = new Map<number, { world?: string; efhub?: string }>();
  for (const r of rows) {
    const entry = byInternalId.get(r.internal_card_id) ?? {};
    if (r.source === "world") entry.world = r.source_card_id;
    else if (r.source === "efhub") entry.efhub = r.source_card_id;
    byInternalId.set(r.internal_card_id, entry);
  }
  const map = new Map<string, string>();
  for (const { world, efhub } of byInternalId.values()) {
    if (world && efhub) map.set(world, efhub);
  }
  return map;
}

export interface AiStyleRow {
  world_card_id: string;
  style_name: string;
  display_order: number;
}

/** world_card_id → AIスタイル名の配列(display_order順)。対応が無いカードはこのMapに現れない(呼び出し側は既定で空配列扱いする)。 */
export function buildAiStylesMap(rows: readonly AiStyleRow[]): Map<string, string[]> {
  const grouped = new Map<string, AiStyleRow[]>();
  for (const r of rows) {
    const arr = grouped.get(r.world_card_id) ?? [];
    arr.push(r);
    grouped.set(r.world_card_id, arr);
  }
  const map = new Map<string, string[]>();
  for (const [id, arr] of grouped) {
    map.set(
      id,
      [...arr].sort((a, b) => a.display_order - b.display_order).map((r) => r.style_name),
    );
  }
  return map;
}

export interface AppearanceRow {
  world_card_id: string;
  position: string | null;
  leg_coverage_radius: number | null;
  arm_coverage_radius: number | null;
  torso_collision: number | null;
  jumping_height: number | null;
  dribble_height: number | null;
  leg_length: number | null;
  ranks_json: string | null;
  updated_at: string | null;
}

export interface AppearanceValue {
  position: string | null;
  legCoverageRadius: number | null;
  armCoverageRadius: number | null;
  torsoCollision: number | null;
  jumpingHeight: number | null;
  dribbleHeight: number | null;
  legLength: number | null;
  ranks: unknown | null;
  updatedAt: string | null;
}

function parseJsonSafely(value: string | null): unknown | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/** world_card_id → appearance(体格・順位情報)。1カード1件(SQLite側で1:1関係を確認済み)。 */
export function buildAppearanceMap(rows: readonly AppearanceRow[]): Map<string, AppearanceValue> {
  const map = new Map<string, AppearanceValue>();
  for (const r of rows) {
    map.set(r.world_card_id, {
      position: r.position,
      legCoverageRadius: r.leg_coverage_radius,
      armCoverageRadius: r.arm_coverage_radius,
      torsoCollision: r.torso_collision,
      jumpingHeight: r.jumping_height,
      dribbleHeight: r.dribble_height,
      legLength: r.leg_length,
      ranks: parseJsonSafely(r.ranks_json),
      updatedAt: r.updated_at,
    });
  }
  return map;
}

export interface DataConflictRow {
  world_card_id: string | null;
  field_name: string;
  efhub_value: string | null;
  world_value: string | null;
  /** 内部監査専用フィールド。安全な公開用サマリーには含めない(呼び出し側で受け取らない設計にする)。 */
}

export interface SafeConflictSummary {
  fieldName: string;
  efhubValue: string | null;
  worldValue: string | null;
}

/**
 * world_card_id → 安全な競合サマリーの配列。
 * internal_card_id/detected_at/confidence/resolution_status/resolved_value/resolution_reasonという
 * 内部監査専用フィールドは、この関数の入力にも出力にも一切含めない(公開すべきでないため)。
 */
export function buildEfhubConflictsMap(rows: readonly DataConflictRow[]): Map<string, SafeConflictSummary[]> {
  const map = new Map<string, SafeConflictSummary[]>();
  for (const r of rows) {
    if (!r.world_card_id) continue;
    const arr = map.get(r.world_card_id) ?? [];
    arr.push({ fieldName: r.field_name, efhubValue: r.efhub_value, worldValue: r.world_value });
    map.set(r.world_card_id, arr);
  }
  return map;
}

export interface ManagerBoosterRow {
  internal_manager_id: number;
  display_order: number;
  stat_name_en: string;
  stat_key: string | null;
  delta: number;
  raw_value: string;
  application_condition: string | null;
  confirmation_status: string;
}

export interface ManagerBoosterValue {
  statNameEn: string;
  statKey: string | null;
  delta: number;
  rawValue: string;
  applicationCondition: string | null;
  confirmationStatus: string;
}

/** internal_manager_id → ブースター効果の配列(display_order順)。 */
export function buildManagerBoostersMap(rows: readonly ManagerBoosterRow[]): Map<number, ManagerBoosterValue[]> {
  const grouped = new Map<number, ManagerBoosterRow[]>();
  for (const r of rows) {
    const arr = grouped.get(r.internal_manager_id) ?? [];
    arr.push(r);
    grouped.set(r.internal_manager_id, arr);
  }
  const map = new Map<number, ManagerBoosterValue[]>();
  for (const [id, arr] of grouped) {
    map.set(
      id,
      [...arr]
        .sort((a, b) => a.display_order - b.display_order)
        .map((r) => ({
          statNameEn: r.stat_name_en,
          statKey: r.stat_key,
          delta: r.delta,
          rawValue: r.raw_value,
          applicationCondition: r.application_condition,
          confirmationStatus: r.confirmation_status,
        })),
    );
  }
  return map;
}

export interface ManagerLinkUpPlayRow {
  id: number;
  internal_manager_id: number;
  display_order: number;
  name: string;
  confirmation_status: string;
}

export interface ManagerLinkUpConditionRow {
  link_up_play_id: number;
  role: "centerPiece" | "keyMan" | string;
  playing_style: string | null;
  positions_json: string;
}

export interface LinkUpConditionValue {
  role: "centerPiece" | "keyMan";
  playingStyle: string | null;
  positions: string[];
}

export interface ManagerLinkUpPlayValue {
  name: string;
  centerPiece: LinkUpConditionValue | null;
  keyMan: LinkUpConditionValue | null;
  confirmationStatus: string;
}

function parsePositionsJson(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    /* 壊れたJSONは空配列扱い */
  }
  return [];
}

/** internal_manager_id → Link-up Playの配列(display_order順、centerPiece/keyManを結合)。 */
export function buildManagerLinkUpPlaysMap(
  playRows: readonly ManagerLinkUpPlayRow[],
  conditionRows: readonly ManagerLinkUpConditionRow[],
): Map<number, ManagerLinkUpPlayValue[]> {
  const conditionsByPlayId = new Map<number, ManagerLinkUpConditionRow[]>();
  for (const c of conditionRows) {
    const arr = conditionsByPlayId.get(c.link_up_play_id) ?? [];
    arr.push(c);
    conditionsByPlayId.set(c.link_up_play_id, arr);
  }

  const grouped = new Map<number, ManagerLinkUpPlayRow[]>();
  for (const p of playRows) {
    const arr = grouped.get(p.internal_manager_id) ?? [];
    arr.push(p);
    grouped.set(p.internal_manager_id, arr);
  }

  const map = new Map<number, ManagerLinkUpPlayValue[]>();
  for (const [managerId, plays] of grouped) {
    const sorted = [...plays].sort((a, b) => a.display_order - b.display_order);
    map.set(
      managerId,
      sorted.map((play) => {
        const conds = conditionsByPlayId.get(play.id) ?? [];
        const pick = (role: "centerPiece" | "keyMan"): LinkUpConditionValue | null => {
          const c = conds.find((x) => x.role === role);
          if (!c) return null;
          return { role, playingStyle: c.playing_style, positions: parsePositionsJson(c.positions_json) };
        };
        return {
          name: play.name,
          centerPiece: pick("centerPiece"),
          keyMan: pick("keyMan"),
          confirmationStatus: play.confirmation_status,
        };
      }),
    );
  }
  return map;
}

/** 与えられたIDの集合のうち、対象テーブル(world_player_cards/managers)の既知の主キー集合に存在しないものを検出する。 */
export function findOrphanIds(ids: Iterable<string>, knownIds: ReadonlySet<string>): string[] {
  return [...ids].filter((id) => !knownIds.has(id));
}
