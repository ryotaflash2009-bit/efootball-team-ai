import { buildScopedStorageKey } from "@/lib/local-storage-scope/keys";
import { DATA_KINDS, type DataKind, type StorageScope } from "@/lib/local-storage-scope/types";
import { parseMyTeamStorage } from "@/lib/user-cards/my-team-storage";
import { parseFavoritesStorage } from "@/lib/user-cards/favorites-storage";
import { parseTemplatesStorage } from "@/lib/squad/templates";
import { validateBuildsPayload } from "@/lib/progression/build-storage";
import { validateSquadsPayload } from "@/lib/squad/squad-storage";
import { DIAGNOSIS_HISTORY_MAX_BYTES, DIAGNOSIS_HISTORY_MAX_ENTRIES, diagnosisHistoryKey, readDiagnosisHistory } from "@/lib/squad/diagnosis-history";

/**
 * F-023b: 現在の領域（未ログインのゲスト / ログイン中のアカウント）のローカルデータを、まとめて
 * JSON へ書き出し・読み込み・削除する（純関数に近い形。ストレージと領域は呼び出し側が渡す）。
 *
 * - 対象: My Team・お気に入り・保存ビルド・保存スカッド・スカッドテンプレート・診断履歴。
 * - ファイルには領域の識別子（アカウントのハッシュ）・ユーザー ID・メールアドレスを入れない。
 *   どの領域へ読み込むかは、読み込む時点の領域で決まる（別アカウントへ持ち込むこともできる）。
 * - 読み込みは「全部か何もしないか」: 各項目を保存形式どおりに厳密に検証し、1つでも不正なら何も書かない。
 *   書き込み中に失敗したら、書き込む前の値へ戻す。
 * - 表示言語・サイドバー・一時状態（比較の選択など）は対象外。
 */
export const LOCAL_BACKUP_SCHEMA = "efb-local-backup/v1";
export const LOCAL_BACKUP_MAX_BYTES = 5 * 1024 * 1024;

export type BackupSection = DataKind | "diagnosisHistory";
export const BACKUP_SECTIONS: readonly BackupSection[] = [...DATA_KINDS, "diagnosisHistory"];

export function backupSectionKey(scope: StorageScope, section: BackupSection): string {
  return section === "diagnosisHistory" ? diagnosisHistoryKey(scope) : buildScopedStorageKey(scope, section);
}

export type SectionCounts = Partial<Record<BackupSection, number>>;

export interface LocalBackupFile {
  schema: typeof LOCAL_BACKUP_SCHEMA;
  app: "efootball-team-ai";
  exportedAt: string;
  sections: Partial<Record<BackupSection, unknown>>;
}

/** 1項目の厳密な検証（件数を返す）。保存形式の検証は各機能のコードを使う（別定義を作らない）。 */
export function validateSection(section: BackupSection, value: unknown): { ok: true; count: number } | { ok: false } {
  try {
    switch (section) {
      case "myTeam": {
        const raw = JSON.stringify(value);
        const r = parseMyTeamStorage(raw);
        const inputCount = Array.isArray((value as { records?: unknown })?.records) ? (value as { records: unknown[] }).records.length : -1;
        return r.warning === null && r.store.records.length === inputCount ? { ok: true, count: inputCount } : { ok: false };
      }
      case "favorites": {
        const r = parseFavoritesStorage(JSON.stringify(value));
        const inputCount = Array.isArray((value as { records?: unknown })?.records) ? (value as { records: unknown[] }).records.length : -1;
        return r.warning === null && r.store.records.length === inputCount ? { ok: true, count: inputCount } : { ok: false };
      }
      case "squadTemplates": {
        const r = parseTemplatesStorage(JSON.stringify(value));
        const list = Array.isArray(value) ? value : (value as { templates?: unknown })?.templates;
        const inputCount = Array.isArray(list) ? list.length : -1;
        return r.warning === null && r.templates.length === inputCount ? { ok: true, count: inputCount } : { ok: false };
      }
      case "myBuilds":
        return validateBuildsPayload(value);
      case "squads":
        return validateSquadsPayload(value);
      case "diagnosisHistory": {
        // 診断履歴の読み取りコードで、一時的な領域へ置いて読み戻す（壊れた項目が1件でもあれば拒否）。
        const mem = new Map<string, string>();
        const storage = {
          getItem: (k: string) => mem.get(k) ?? null,
          setItem: (k: string, v: string) => void mem.set(k, v),
          removeItem: (k: string) => void mem.delete(k),
        } as unknown as Storage;
        const scope: StorageScope = { kind: "guest" };
        const text = JSON.stringify(value);
        // 通常の保存と同じ上限（件数・容量）を超える履歴は読み込まない（通常の保存では作れない形のため）。
        if (new TextEncoder().encode(text).length > DIAGNOSIS_HISTORY_MAX_BYTES) return { ok: false };
        mem.set(diagnosisHistoryKey(scope), text);
        const read = readDiagnosisHistory({ storage: () => storage, scope: () => scope, now: () => new Date(0), randomId: () => "x" });
        const inputCount = Array.isArray((value as { entries?: unknown })?.entries) ? (value as { entries: unknown[] }).entries.length : -1;
        return read.corrupted === 0 && read.entries.length === inputCount && inputCount <= DIAGNOSIS_HISTORY_MAX_ENTRIES ? { ok: true, count: inputCount } : { ok: false };
      }
    }
  } catch {
    return { ok: false };
  }
}

/** 現在の領域のデータを書き出す。読めない（壊れた）項目は書き出さず、件数に含めない。 */
export function exportLocalBackup(ls: Storage, scope: StorageScope, now: Date): { file: LocalBackupFile; counts: SectionCounts; skipped: BackupSection[] } {
  const sections: Partial<Record<BackupSection, unknown>> = {};
  const counts: SectionCounts = {};
  const skipped: BackupSection[] = [];
  for (const section of BACKUP_SECTIONS) {
    const raw = ls.getItem(backupSectionKey(scope, section));
    if (raw == null) continue;
    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      skipped.push(section);
      continue;
    }
    const v = validateSection(section, value);
    if (!v.ok) {
      skipped.push(section);
      continue;
    }
    sections[section] = value;
    counts[section] = v.count;
  }
  return { file: { schema: LOCAL_BACKUP_SCHEMA, app: "efootball-team-ai", exportedAt: now.toISOString(), sections }, counts, skipped };
}

export type ParseFailure = "too_large" | "not_json" | "not_backup" | "unknown_section" | "invalid_section" | "empty";

export function parseLocalBackup(text: string): { ok: true; file: LocalBackupFile; counts: SectionCounts } | { ok: false; reason: ParseFailure; section?: BackupSection } {
  if (new TextEncoder().encode(text).length > LOCAL_BACKUP_MAX_BYTES) return { ok: false, reason: "too_large" };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, reason: "not_json" };
  }
  const f = json as Partial<LocalBackupFile> | null;
  // 想定外の項目は受け付けない（`__proto__` などの名前も含めて、自分の項目名だけを見る）。
  const TOP_KEYS = ["schema", "app", "exportedAt", "sections"];
  if (f && typeof f === "object" && !Array.isArray(f) && Object.keys(f).some((k) => !TOP_KEYS.includes(k))) return { ok: false, reason: "not_backup" };
  if (!f || typeof f !== "object" || f.schema !== LOCAL_BACKUP_SCHEMA || f.app !== "efootball-team-ai" || typeof f.exportedAt !== "string" || Number.isNaN(Date.parse(f.exportedAt)) || !f.sections || typeof f.sections !== "object" || Array.isArray(f.sections)) {
    return { ok: false, reason: "not_backup" };
  }
  const counts: SectionCounts = {};
  for (const [name, value] of Object.entries(f.sections)) {
    if (!(BACKUP_SECTIONS as readonly string[]).includes(name)) return { ok: false, reason: "unknown_section" };
    const v = validateSection(name as BackupSection, value);
    if (!v.ok) return { ok: false, reason: "invalid_section", section: name as BackupSection };
    counts[name as BackupSection] = v.count;
  }
  if (Object.keys(counts).length === 0) return { ok: false, reason: "empty" };
  return { ok: true, file: f as LocalBackupFile, counts };
}

/**
 * 読み込み: ファイルにある項目だけを、現在の領域の同じ項目と置き換える（ファイルに無い項目は変えない）。
 * 失敗したら、書き込む前の値へ戻す。
 */
export function importLocalBackup(ls: Storage, scope: StorageScope, file: LocalBackupFile): { ok: true; written: BackupSection[] } | { ok: false; rolledBack: boolean } {
  const targets = (Object.keys(file.sections) as BackupSection[]).filter((s) => BACKUP_SECTIONS.includes(s));
  const before = new Map<string, string | null>();
  for (const s of targets) before.set(backupSectionKey(scope, s), ls.getItem(backupSectionKey(scope, s)));
  try {
    for (const s of targets) {
      const key = backupSectionKey(scope, s);
      const text = JSON.stringify(file.sections[s]);
      ls.setItem(key, text);
      if (ls.getItem(key) !== text) throw new Error("verify");
    }
    return { ok: true, written: targets };
  } catch {
    let rolledBack = true;
    for (const [key, value] of before) {
      try {
        if (value == null) ls.removeItem(key);
        else ls.setItem(key, value);
      } catch {
        rolledBack = false;
      }
    }
    return { ok: false, rolledBack };
  }
}

/** 現在の領域のデータを削除する（他の領域・表示設定・レガシー領域には触れない）。読み戻して確認する。 */
export function deleteCurrentScopeData(ls: Storage, scope: StorageScope): { ok: boolean; removed: BackupSection[]; failed: BackupSection[] } {
  const removed: BackupSection[] = [];
  const failed: BackupSection[] = [];
  for (const s of BACKUP_SECTIONS) {
    const key = backupSectionKey(scope, s);
    try {
      if (ls.getItem(key) == null) continue;
      ls.removeItem(key);
      if (ls.getItem(key) == null) removed.push(s);
      else failed.push(s);
    } catch {
      failed.push(s);
    }
  }
  return { ok: failed.length === 0, removed, failed };
}

/** 現在の領域にある項目と件数（削除・書き出しの前の表示用）。 */
export function summarizeCurrentScope(ls: Storage, scope: StorageScope): SectionCounts {
  return exportLocalBackup(ls, scope, new Date(0)).counts;
}
