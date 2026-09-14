import { z } from "zod";
import { PROGRESSION_RULES_VERSION } from "@/lib/progression/constants";
import { isFormationId, getFormation, DEFAULT_FORMATION_ID } from "./formations";
import { isPlacementRole } from "./role-inference";
import {
  MAX_SQUADS,
  MAX_SUBSTITUTES,
  SQUAD_BUILD_MODES,
  SQUAD_COORDINATE_VERSION,
  SQUAD_ID_RE,
  SQUAD_NAME_MAX,
  SQUAD_SCHEMA_VERSION,
  SLOT_ID_RE,
  SUB_ID_RE,
  WORLD_CARD_ID_RE,
  BUILD_ID_RE,
} from "./types";
import type { StoredSquad, SquadListEntry } from "./types";
import { getCurrentScope } from "@/lib/local-storage-scope/current-scope-store";
import { buildScopedStorageKey } from "@/lib/local-storage-scope/keys";

/**
 * スカッドのローカル保存（localStorage、アカウント別スコープ対応）。
 * - 外部アカウント・クラウド同期なし。
 * - SSR / localStorage 不可 / 壊れた JSON でも呼び出し側がクラッシュしないよう安全な既定値を返す。
 * - 読み込み時に Zod で検証し、壊れたエントリは黙って捨てる。
 * - Windows 上のファイルは一切触らない。削除はブラウザ内のユーザー作成データのみ。
 *
 * アカウント別スコープ対応(Stage 4): 実際に読み書きするキーは、現在解決済みのスコープ
 * (`current-scope-store.ts`)に応じて動的に決まる(`my-team-storage.ts`/`build-storage.ts`と同じ方針)。
 * スコープ未解決(認証状態確認中)の間は、読み込みは常に空、書き込みは常に拒否する。アカウント分離前の
 * 共通キー(`efb:squads:v1`)は、この通常モジュールからは一切読み書きしない(レガシー領域は
 * `local-storage-scope`の移行機能だけが扱う)。このモジュール自体はキャッシュ/スナップショットを
 * 持たない(build-storage.tsと同じ)ため、スコープ切替時の再読込は呼び出し側(各コンポーネント)が
 * `subscribeCurrentScope`で自ら行う。
 */

/** 現在のスコープにおけるスカッドの実際のlocalStorageキー。スコープ未解決ならnull。 */
export function getActiveSquadsStorageKey(): string | null {
  const scope = getCurrentScope();
  if (!scope) return null;
  return buildScopedStorageKey(scope, "squads");
}

const buildModeSchema = z.enum(["none", "attack", "defense", "balance", "gk"]);

const boostersSchema = z
  .array(
    z.object({
      slot: z.union([z.literal(1), z.literal(2)]),
      boosterKey: z.string().regex(/^[a-z0-9-]{1,48}$/),
      level: z.number().int().min(1).max(6),
    }),
  )
  .max(2)
  .optional()
  .catch(undefined);

/** Total Package 等の条件付き付属ブースターのユーザー手動指定（このカード固有）。 */
const conditionalBoostersSchema = z
  .array(
    z.object({
      boosterKey: z.string().regex(/^[a-z0-9-]{1,48}$/),
      selection: z.enum(["none", "league_1_13", "league_14_19", "league_20_plus"]),
    }),
  )
  .max(4)
  .optional()
  .catch(undefined);

const coordSchema = z
  .number()
  .refine((n) => Number.isFinite(n), { message: "coord not finite" })
  .transform((n) => Math.min(100, Math.max(0, n)))
  .optional()
  .catch(undefined);

// スロットは寛容にパースする（1 つ壊れても正常スロットは維持）。不正な worldCardId は null 扱い、
// slotId は normalizeSquad がフォーメーション定義で照合し直すので緩め。
const storedSlotSchema = z.object({
  slotId: z.string().regex(SLOT_ID_RE).catch(""),
  worldCardId: z
    .string()
    .regex(WORLD_CARD_ID_RE)
    .nullable()
    .catch(null),
  buildMode: buildModeSchema.catch("none"),
  savedBuildId: z.string().regex(BUILD_ID_RE).nullable().catch(null),
  boosters: boostersSchema,
  conditionalBoosters: conditionalBoostersSchema,
  x: coordSchema,
  y: coordSchema,
  roleOverride: z.string().regex(/^[A-Za-z]{1,4}$/).nullable().optional().catch(null),
});

const storedSubSchema = z.object({
  subId: z.string().regex(SUB_ID_RE).catch(""),
  // 不正なら空文字。normalizeSquad が WORLD_CARD_ID_RE で弾く。
  worldCardId: z.string().catch(""),
  buildMode: buildModeSchema.catch("none"),
  savedBuildId: z.string().regex(BUILD_ID_RE).nullable().catch(null),
  boosters: boostersSchema,
  conditionalBoosters: conditionalBoostersSchema,
});

/**
 * スカッド全体の条件付きブースター設定（将来の Game Plan 自動対応の器）。
 * 現状 evaluationMode は常に "manual"（ユーザー指定のみ・自動照合しない）。
 */
const conditionalSquadSettingsSchema = z
  .object({
    targetLeague: z.string().max(120).nullable().catch(null),
    registeredPlayerCount: z.number().int().min(0).max(99).nullable().catch(null),
    conditionTier: z
      .enum(["none", "league_1_13", "league_14_19", "league_20_plus"])
      .catch("none"),
    evaluationMode: z.enum(["manual", "automatic", "unsupported"]).catch("manual"),
  })
  .optional()
  .catch(undefined);

const squadSchema = z.object({
  squadId: z.string().regex(SQUAD_ID_RE),
  squadName: z.string().min(1).max(SQUAD_NAME_MAX),
  formationId: z.string(),
  managerId: z.number().int().positive().max(1_000_000_000).nullable(),
  slots: z.array(storedSlotSchema).max(11),
  substitutes: z.array(storedSubSchema).max(MAX_SUBSTITUTES),
  captainSlotId: z.string().regex(SLOT_ID_RE).nullable().catch(null),
  setPieces: z
    .object({
      corners: z.string().regex(SLOT_ID_RE).nullable().catch(null),
      freeKicks: z.string().regex(SLOT_ID_RE).nullable().catch(null),
      penalties: z.string().regex(SLOT_ID_RE).nullable().catch(null),
    })
    .catch({ corners: null, freeKicks: null, penalties: null }),
  linkUp: z
    .object({
      centerPieceSlotId: z.string().regex(SLOT_ID_RE).nullable().catch(null),
      keyManSlotId: z.string().regex(SLOT_ID_RE).nullable().catch(null),
    })
    .catch({ centerPieceSlotId: null, keyManSlotId: null }),
  conditionalSettings: conditionalSquadSettingsSchema,
  coordinateVersion: z.string().max(80).optional().catch(undefined),
  rulesVersion: z.string(),
  schemaVersion: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

type Store = StoredSquad[];

function getStorage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const k = "__efb_probe__";
    window.localStorage.setItem(k, "1");
    window.localStorage.removeItem(k);
    return window.localStorage;
  } catch {
    return null;
  }
}

/** 保存済みスカッドを正規化する（フォーメーション整合・重複カード除去・上限）。 */
function normalizeSquad(raw: StoredSquad): StoredSquad {
  const formationId = isFormationId(raw.formationId) ? raw.formationId : DEFAULT_FORMATION_ID;
  const formation = getFormation(formationId);
  const validSlotIds = new Set(formation.slots.map((s) => s.slotId));

  const validRole = (v: unknown): string | undefined =>
    typeof v === "string" && isPlacementRole(v) ? v : undefined;
  const inRange = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100;

  const seen = new Set<string>();
  const slots = formation.slots.map((fs) => {
    const found = raw.slots.find((s) => s.slotId === fs.slotId);
    let worldCardId = found?.worldCardId ?? null;
    if (worldCardId && (seen.has(worldCardId) || !WORLD_CARD_ID_RE.test(worldCardId))) {
      worldCardId = null;
    }
    if (worldCardId) seen.add(worldCardId);
    // 座標: 旧データや欠損は formation 既定へ補完（一括変換はしない・開いたスカッドだけ）。
    // x/y 片方だけの欠損・範囲外も既定へ。
    const hasCoords = inRange(found?.x) && inRange(found?.y);
    return {
      slotId: fs.slotId,
      worldCardId,
      buildMode: SQUAD_BUILD_MODES.includes(found?.buildMode as never) ? found!.buildMode : "none",
      savedBuildId: worldCardId ? (found?.savedBuildId ?? null) : null,
      boosters: worldCardId ? (found?.boosters ?? undefined) : undefined,
      conditionalBoosters: worldCardId ? (found?.conditionalBoosters ?? undefined) : undefined,
      x: hasCoords ? (found!.x as number) : fs.x,
      y: hasCoords ? (found!.y as number) : fs.y,
      roleOverride: worldCardId ? (validRole(found?.roleOverride) ?? null) : null,
    };
  });

  const substitutes = raw.substitutes
    .filter((s) => WORLD_CARD_ID_RE.test(s.worldCardId))
    .filter((s) => {
      if (seen.has(s.worldCardId)) return false;
      seen.add(s.worldCardId);
      return true;
    })
    .slice(0, MAX_SUBSTITUTES)
    .map((s) => ({ ...s, boosters: s.boosters ?? undefined, conditionalBoosters: s.conditionalBoosters ?? undefined }));

  const captainSlotId =
    raw.captainSlotId && validSlotIds.has(raw.captainSlotId) && slots.some((s) => s.slotId === raw.captainSlotId && s.worldCardId)
      ? raw.captainSlotId
      : null;

  const fixSlotRef = (id: string | null): string | null =>
    id && validSlotIds.has(id) ? id : null;

  return {
    ...raw,
    formationId,
    coordinateVersion: raw.coordinateVersion ?? SQUAD_COORDINATE_VERSION,
    slots,
    substitutes,
    captainSlotId,
    setPieces: {
      corners: fixSlotRef(raw.setPieces?.corners ?? null),
      freeKicks: fixSlotRef(raw.setPieces?.freeKicks ?? null),
      penalties: fixSlotRef(raw.setPieces?.penalties ?? null),
    },
    linkUp: {
      centerPieceSlotId: fixSlotRef(raw.linkUp?.centerPieceSlotId ?? null),
      keyManSlotId: fixSlotRef(raw.linkUp?.keyManSlotId ?? null),
    },
  };
}

function readStore(): Store {
  const ls = getStorage();
  if (!ls) return [];
  const key = getActiveSquadsStorageKey();
  if (!key) return []; // スコープ未解決: 安全な空値(書き込みは行わない)
  try {
    const raw = ls.getItem(key);
    if (!raw) return [];
    const json = JSON.parse(raw);
    if (!Array.isArray(json)) return [];
    // スカッド 1 件が壊れていても他は読めるよう、要素ごとに検証する（全消ししない）。
    const valid: StoredSquad[] = [];
    for (const item of json) {
      const parsed = squadSchema.safeParse(item);
      if (parsed.success) valid.push(parsed.data as StoredSquad);
    }
    // 同一 squadId の重複を排除
    const dedup = Array.from(new Map(valid.map((s) => [s.squadId, s])).values());
    return dedup.map(normalizeSquad);
  } catch {
    return [];
  }
}

function writeStore(store: Store): boolean {
  const ls = getStorage();
  if (!ls) return false;
  const key = getActiveSquadsStorageKey();
  if (!key) return false; // スコープ未解決の間は書き込みを拒否する
  try {
    ls.setItem(key, JSON.stringify(store.slice(0, MAX_SQUADS)));
    return true;
  } catch {
    return false;
  }
}

export function isSquadStorageAvailable(): boolean {
  return getStorage() != null;
}

function randomId(prefix: string, len: number): string {
  const rnd =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "")
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `${prefix}${rnd.slice(0, len)}`;
}

export function newSquadId(): string {
  return randomId("sq_", 16);
}
export function newSubId(): string {
  return randomId("sub_", 10);
}

export function listSquads(): StoredSquad[] {
  return readStore().slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** 先発スロットの座標が formation 既定から離れているか（= 自由配置あり）。 */
export function hasCustomPositioning(squad: StoredSquad): boolean {
  const formation = getFormation(squad.formationId);
  const byId = new Map(formation.slots.map((s) => [s.slotId, s]));
  return squad.slots.some((sl) => {
    if (!sl.worldCardId) return false;
    const fs = byId.get(sl.slotId);
    if (!fs || sl.x == null || sl.y == null) return false;
    if (sl.roleOverride) return true;
    return Math.abs(sl.x - fs.x) > 1.5 || Math.abs(sl.y - fs.y) > 1.5;
  });
}

export function listSquadEntries(): SquadListEntry[] {
  return listSquads().map((s) => ({
    squadId: s.squadId,
    squadName: s.squadName,
    formationId: s.formationId,
    formationName: getFormation(s.formationId).name,
    managerId: s.managerId,
    startingCount: s.slots.filter((x) => x.worldCardId).length,
    benchCount: s.substitutes.length,
    updatedAt: s.updatedAt,
    createdAt: s.createdAt,
    rulesOutdated: s.rulesVersion !== PROGRESSION_RULES_VERSION,
    hasCustomPositioning: hasCustomPositioning(s),
  }));
}

export function getSquad(squadId: string): StoredSquad | null {
  if (!SQUAD_ID_RE.test(squadId)) return null;
  return readStore().find((s) => s.squadId === squadId) ?? null;
}

export function emptySquad(name: string, formationId = DEFAULT_FORMATION_ID): StoredSquad {
  const now = new Date().toISOString();
  const formation = getFormation(formationId);
  return {
    squadId: newSquadId(),
    squadName: String(name ?? "").trim().slice(0, SQUAD_NAME_MAX) || "新しいスカッド",
    formationId: formation.id,
    managerId: null,
    slots: formation.slots.map((fs) => ({
      slotId: fs.slotId,
      worldCardId: null,
      buildMode: "none" as const,
      savedBuildId: null,
      x: fs.x,
      y: fs.y,
      roleOverride: null,
    })),
    substitutes: [],
    captainSlotId: null,
    setPieces: { corners: null, freeKicks: null, penalties: null },
    linkUp: { centerPieceSlotId: null, keyManSlotId: null },
    coordinateVersion: SQUAD_COORDINATE_VERSION,
    rulesVersion: PROGRESSION_RULES_VERSION,
    schemaVersion: SQUAD_SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
  };
}

export type SquadSaveResult = { ok: true; squad: StoredSquad } | { ok: false; error: string };

export function saveSquad(squad: StoredSquad): SquadSaveResult {
  const name = String(squad.squadName ?? "").trim().slice(0, SQUAD_NAME_MAX);
  if (!name) return { ok: false, error: "スカッド名を入力してください（1〜50文字）" };
  if (!SQUAD_ID_RE.test(squad.squadId)) return { ok: false, error: "スカッドIDが不正です" };

  const next: StoredSquad = normalizeSquad({
    ...squad,
    squadName: name,
    rulesVersion: PROGRESSION_RULES_VERSION,
    schemaVersion: SQUAD_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
  });

  const parsed = squadSchema.safeParse(next);
  if (!parsed.success) return { ok: false, error: "スカッドの形式が不正です" };

  const store = readStore();
  const idx = store.findIndex((s) => s.squadId === next.squadId);
  if (idx >= 0) store[idx] = next;
  else {
    if (store.length >= MAX_SQUADS) return { ok: false, error: `保存できるスカッドは最大 ${MAX_SQUADS} 件です` };
    store.push(next);
  }
  if (!writeStore(store)) return { ok: false, error: "この環境ではスカッドを保存できません（localStorage 不可）" };
  return { ok: true, squad: next };
}

export function renameSquad(squadId: string, name: string): SquadSaveResult {
  const existing = getSquad(squadId);
  if (!existing) return { ok: false, error: "対象のスカッドが見つかりません" };
  const trimmed = String(name ?? "").trim().slice(0, SQUAD_NAME_MAX);
  if (!trimmed) return { ok: false, error: "スカッド名を入力してください（1〜50文字）" };
  return saveSquad({ ...existing, squadName: trimmed });
}

/** 深いコピー（配列・入れ子オブジェクトを複製元と共有しない）。 */
export function cloneSquadData(src: StoredSquad): StoredSquad {
  return {
    ...src,
    slots: src.slots.map((s) => ({
      ...s,
      boosters: s.boosters ? s.boosters.map((b) => ({ ...b })) : s.boosters,
      conditionalBoosters: s.conditionalBoosters ? s.conditionalBoosters.map((b) => ({ ...b })) : s.conditionalBoosters,
    })),
    substitutes: src.substitutes.map((s) => ({
      ...s,
      boosters: s.boosters ? s.boosters.map((b) => ({ ...b })) : s.boosters,
      conditionalBoosters: s.conditionalBoosters ? s.conditionalBoosters.map((b) => ({ ...b })) : s.conditionalBoosters,
    })),
    setPieces: { ...src.setPieces },
    linkUp: { ...src.linkUp },
    conditionalSettings: src.conditionalSettings ? { ...src.conditionalSettings } : undefined,
  };
}

export function duplicateSquad(squadId: string, name?: string): SquadSaveResult {
  const existing = getSquad(squadId);
  if (!existing) return { ok: false, error: "対象のスカッドが見つかりません" };
  const now = new Date().toISOString();
  const taken = new Set(listSquads().map((s) => s.squadName));
  const desired = String(name ?? "").trim().slice(0, SQUAD_NAME_MAX) || `${existing.squadName} のコピー`;
  let finalName = desired.slice(0, SQUAD_NAME_MAX);
  for (let i = 2; taken.has(finalName) && i < 100; i++) {
    finalName = `${desired} ${i}`.slice(0, SQUAD_NAME_MAX);
  }
  const copy: StoredSquad = {
    ...cloneSquadData(existing),
    squadId: newSquadId(),
    squadName: finalName,
    substitutes: cloneSquadData(existing).substitutes.map((s) => ({ ...s, subId: newSubId() })),
    createdAt: now,
    updatedAt: now,
  };
  return saveSquad(copy);
}

/** ブラウザ内のユーザー作成スカッドのみ削除する。 */
export function deleteSquad(squadId: string): { ok: boolean; error?: string } {
  if (!SQUAD_ID_RE.test(squadId)) return { ok: false, error: "スカッドIDが不正です" };
  if (!getStorage()) return { ok: false, error: "この環境ではスカッドを更新できません（localStorage 不可）" };
  const store = readStore().filter((s) => s.squadId !== squadId);
  if (!writeStore(store)) return { ok: false, error: "この環境ではスカッドを更新できません" };
  return { ok: true };
}
