import { z } from "zod";
import { getFormation, DEFAULT_FORMATION_ID, isFormationId } from "./formations";
import {
  MAX_SQUAD_TEMPLATES,
  SQUAD_COORDINATE_VERSION,
  SQUAD_TEMPLATE_STORAGE_KEY,
  SQUAD_TEMPLATE_STORAGE_VERSION,
  SQUAD_NAME_MAX,
} from "./types";
import type { StoredSquad } from "./types";
import { ROLE_INFERENCE_VERSION } from "./role-inference";
import {
  cloneSquadData,
  emptySquad,
  newSquadId,
  newSubId,
  saveSquad,
  type SquadSaveResult,
} from "./squad-storage";

/**
 * スカッドテンプレート（通常スカッドとは別ストア）。
 *  - 空テンプレート: フォーメーションだけ（選手なし）。
 *  - 完全テンプレート: 選手・自由配置座標・監督・役割・ベンチも含む。
 *  - テンプレートから作成した通常スカッドはテンプレートと完全に独立（参照共有しない）。
 *  - 1 件壊れても他を失わないよう要素ごとに検証する。localStorage 全消去はしない。
 */

const TEMPLATE_ID_RE = /^tpl_[A-Za-z0-9]{6,32}$/;

export type SquadTemplateType = "empty" | "full";

export interface SquadTemplate {
  templateId: string;
  templateName: string;
  description: string;
  templateType: SquadTemplateType;
  /** 完全テンプレートのスカッド本体（squadId/日時は作成時に振り直す）。空テンプレートは formation だけ意味を持つ。 */
  squad: StoredSquad;
  coordinateVersion: string;
  roleInferenceVersion: string;
  sourceSquadId: string | null;
  source: "local";
  syncStatus: "local_only";
  createdAt: string;
  updatedAt: string;
}

const storedSlotShape = z
  .object({
    slotId: z.string().catch(""),
    worldCardId: z.string().regex(/^[0-9]{1,20}$/).nullable().catch(null),
    buildMode: z.string().catch("none"),
    savedBuildId: z.string().nullable().catch(null),
    x: z.number().optional().catch(undefined),
    y: z.number().optional().catch(undefined),
    roleOverride: z.string().nullable().optional().catch(null),
  })
  .passthrough();

const squadShape = z
  .object({
    squadId: z.string(),
    squadName: z.string().min(1).max(SQUAD_NAME_MAX),
    formationId: z.string(),
    managerId: z.number().int().positive().nullable().catch(null),
    slots: z.array(storedSlotShape).max(11),
    substitutes: z.array(z.object({ subId: z.string() }).passthrough()).max(12).catch([]),
    captainSlotId: z.string().nullable().catch(null),
    setPieces: z.object({}).passthrough().catch({ corners: null, freeKicks: null, penalties: null }),
    linkUp: z.object({}).passthrough().catch({ centerPieceSlotId: null, keyManSlotId: null }),
    rulesVersion: z.string().catch(""),
    schemaVersion: z.number().int().catch(1),
    createdAt: z.string().catch(""),
    updatedAt: z.string().catch(""),
  })
  .passthrough();

const templateSchema = z.object({
  templateId: z.string().regex(TEMPLATE_ID_RE),
  templateName: z.string().min(1).max(80),
  description: z.string().max(300).catch(""),
  templateType: z.enum(["empty", "full"]).catch("full"),
  squad: squadShape,
  coordinateVersion: z.string().max(80).catch(SQUAD_COORDINATE_VERSION),
  roleInferenceVersion: z.string().max(80).catch(ROLE_INFERENCE_VERSION),
  sourceSquadId: z.string().nullable().catch(null),
  source: z.literal("local").catch("local"),
  syncStatus: z.literal("local_only").catch("local_only"),
  createdAt: z.string().catch(""),
  updatedAt: z.string().catch(""),
});

function getStorage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const k = "__efb_tpl_probe__";
    window.localStorage.setItem(k, "1");
    window.localStorage.removeItem(k);
    return window.localStorage;
  } catch {
    return null;
  }
}

export function isTemplateStorageAvailable(): boolean {
  return getStorage() != null;
}

export function parseTemplatesStorage(raw: string | null): { templates: SquadTemplate[]; warning: string | null } {
  if (!raw) return { templates: [], warning: null };
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { templates: [], warning: "テンプレートの保存データが壊れていたため空にしました。" };
  }
  if (json && typeof json === "object" && !Array.isArray(json)) {
    const obj = json as { storageVersion?: unknown; templates?: unknown };
    if (typeof obj.storageVersion === "string" && !obj.storageVersion.startsWith("squad-templates-storage/")) {
      return { templates: [], warning: `未知の保存バージョン（${obj.storageVersion}）のため空にしました。` };
    }
    json = obj.templates;
  }
  if (!Array.isArray(json)) return { templates: [], warning: null };
  const out: SquadTemplate[] = [];
  const seen = new Set<string>();
  for (const item of json) {
    const p = templateSchema.safeParse(item);
    if (!p.success) continue;
    if (seen.has(p.data.templateId)) continue;
    seen.add(p.data.templateId);
    out.push(p.data as unknown as SquadTemplate);
  }
  return { templates: out, warning: null };
}

function readStore(): SquadTemplate[] {
  const ls = getStorage();
  if (!ls) return [];
  return parseTemplatesStorage(ls.getItem(SQUAD_TEMPLATE_STORAGE_KEY)).templates;
}

function writeStore(list: SquadTemplate[]): boolean {
  const ls = getStorage();
  if (!ls) return false;
  try {
    ls.setItem(
      SQUAD_TEMPLATE_STORAGE_KEY,
      JSON.stringify({
        storageVersion: SQUAD_TEMPLATE_STORAGE_VERSION,
        updatedAt: new Date().toISOString(),
        templates: list.slice(0, MAX_SQUAD_TEMPLATES),
      }),
    );
    return true;
  } catch {
    return false;
  }
}

export function newTemplateId(): string {
  const rnd =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 16)
      : Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
  return `tpl_${rnd}`;
}

export function listTemplates(): SquadTemplate[] {
  return readStore().slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getTemplate(templateId: string): SquadTemplate | null {
  return readStore().find((t) => t.templateId === templateId) ?? null;
}

export type TemplateSaveResult = { ok: true; template: SquadTemplate } | { ok: false; error: string };

/** 既存スカッドから完全テンプレートを作る（自由配置座標も含む・独立コピー）。 */
export function saveTemplateFromSquad(
  squad: StoredSquad,
  templateName: string,
  description = "",
): TemplateSaveResult {
  const name = String(templateName ?? "").trim().slice(0, 80);
  if (!name) return { ok: false, error: "テンプレート名を入力してください" };
  const now = new Date().toISOString();
  const store = readStore();
  if (store.length >= MAX_SQUAD_TEMPLATES) {
    return { ok: false, error: `テンプレートは最大 ${MAX_SQUAD_TEMPLATES} 件です` };
  }
  const template: SquadTemplate = {
    templateId: newTemplateId(),
    templateName: name,
    description: String(description ?? "").trim().slice(0, 300),
    templateType: "full",
    squad: cloneSquadData(squad),
    coordinateVersion: squad.coordinateVersion ?? SQUAD_COORDINATE_VERSION,
    roleInferenceVersion: ROLE_INFERENCE_VERSION,
    sourceSquadId: squad.squadId,
    source: "local",
    syncStatus: "local_only",
    createdAt: now,
    updatedAt: now,
  };
  if (!writeStore([template, ...store])) return { ok: false, error: "この環境ではテンプレートを保存できません" };
  return { ok: true, template };
}

/** 空テンプレート（フォーメーションだけ）。 */
export function createEmptyTemplate(templateName: string, formationId: string): TemplateSaveResult {
  const name = String(templateName ?? "").trim().slice(0, 80);
  if (!name) return { ok: false, error: "テンプレート名を入力してください" };
  const fid = isFormationId(formationId) ? formationId : DEFAULT_FORMATION_ID;
  const now = new Date().toISOString();
  const store = readStore();
  if (store.length >= MAX_SQUAD_TEMPLATES) {
    return { ok: false, error: `テンプレートは最大 ${MAX_SQUAD_TEMPLATES} 件です` };
  }
  const template: SquadTemplate = {
    templateId: newTemplateId(),
    templateName: name,
    description: "",
    templateType: "empty",
    squad: emptySquad(name, fid),
    coordinateVersion: SQUAD_COORDINATE_VERSION,
    roleInferenceVersion: ROLE_INFERENCE_VERSION,
    sourceSquadId: null,
    source: "local",
    syncStatus: "local_only",
    createdAt: now,
    updatedAt: now,
  };
  if (!writeStore([template, ...store])) return { ok: false, error: "この環境ではテンプレートを保存できません" };
  return { ok: true, template };
}

export function renameTemplate(templateId: string, name: string): TemplateSaveResult {
  const trimmed = String(name ?? "").trim().slice(0, 80);
  if (!trimmed) return { ok: false, error: "テンプレート名を入力してください" };
  const store = readStore();
  const idx = store.findIndex((t) => t.templateId === templateId);
  if (idx < 0) return { ok: false, error: "テンプレートが見つかりません" };
  store[idx] = { ...store[idx], templateName: trimmed, updatedAt: new Date().toISOString() };
  if (!writeStore(store)) return { ok: false, error: "この環境ではテンプレートを更新できません" };
  return { ok: true, template: store[idx] };
}

/** テンプレート 1 件だけ削除（localStorage 全消去はしない）。 */
export function deleteTemplate(templateId: string): { ok: boolean; error?: string } {
  const store = readStore().filter((t) => t.templateId !== templateId);
  if (!writeStore(store)) return { ok: false, error: "この環境ではテンプレートを更新できません" };
  return { ok: true };
}

/** テンプレートから新規スカッドを作る。テンプレートとは完全に独立（deep copy + 新 ID）。 */
export function createSquadFromTemplate(templateId: string, squadName?: string): SquadSaveResult {
  const t = getTemplate(templateId);
  if (!t) return { ok: false, error: "テンプレートが見つかりません" };
  const now = new Date().toISOString();
  const cloned = cloneSquadData(t.squad);
  const fresh: StoredSquad = {
    ...cloned,
    squadId: newSquadId(),
    squadName: String(squadName ?? "").trim().slice(0, SQUAD_NAME_MAX) || t.templateName.slice(0, SQUAD_NAME_MAX),
    substitutes: cloned.substitutes.map((s) => ({ ...s, subId: newSubId() })),
    coordinateVersion: t.coordinateVersion,
    createdAt: now,
    updatedAt: now,
  };
  return saveSquad(fresh);
}

/** テンプレート一覧表示用の要約。 */
export interface SquadTemplateSummary {
  templateId: string;
  templateName: string;
  description: string;
  templateType: SquadTemplateType;
  formationId: string;
  formationName: string;
  startingCount: number;
  benchCount: number;
  hasManager: boolean;
  hasCustomPositioning: boolean;
  updatedAt: string;
}

export function listTemplateSummaries(): SquadTemplateSummary[] {
  return listTemplates().map((t) => {
    const fdef = new Map(getFormation(t.squad.formationId).slots.map((s) => [s.slotId, s]));
    const custom = t.squad.slots.some((sl) => {
      if (!sl.worldCardId) return false;
      if (sl.roleOverride) return true;
      const fs = fdef.get(sl.slotId);
      if (!fs || sl.x == null || sl.y == null) return false;
      return Math.abs(sl.x - fs.x) > 1.5 || Math.abs(sl.y - fs.y) > 1.5;
    });
    return {
      templateId: t.templateId,
      templateName: t.templateName,
      description: t.description,
      templateType: t.templateType,
      formationId: t.squad.formationId,
      formationName: getFormation(t.squad.formationId).name,
      startingCount: t.squad.slots.filter((s) => s.worldCardId).length,
      benchCount: t.squad.substitutes.length,
      hasManager: t.squad.managerId != null,
      hasCustomPositioning: custom,
      updatedAt: t.updatedAt,
    };
  });
}
