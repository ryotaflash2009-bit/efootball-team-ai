import { promises as fs } from "node:fs";
import path from "node:path";
import { dataMetaSchema, storedPlayersSchema } from "./schema";
import type { PlayerSummary, PlayersResult, SortKey } from "./types";

/**
 * データアクセス層。
 * 画面・内部APIはここだけを通してデータを読む。
 * 現在はローカル JSON を読む実装。将来はこの関数の中身を
 * PostgreSQL への問い合わせに差し替えれば、呼び出し側は変更不要。
 */

const DATA_DIR = path.join(process.cwd(), "src", "data");
const PLAYERS_FILE = path.join(DATA_DIR, "players.sample.json");
const META_FILE = path.join(DATA_DIR, "meta.json");

async function readJsonIfExists(file: string): Promise<unknown | null> {
  try {
    const text = await fs.readFile(file, "utf8");
    return JSON.parse(text) as unknown;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return null; // ファイル未生成 → 「データなし」として扱う
    throw err; // JSON パース失敗などは呼び出し側でエラー表示にする
  }
}

/** 保存済みの選手データとメタ情報を読み込む */
export async function loadPlayers(): Promise<PlayersResult> {
  const rawPlayers = await readJsonIfExists(PLAYERS_FILE);
  if (rawPlayers === null) {
    return { players: [], meta: null };
  }
  const parsed = storedPlayersSchema.parse(rawPlayers);

  const rawMeta = await readJsonIfExists(META_FILE);
  const meta = rawMeta === null ? null : dataMetaSchema.parse(rawMeta);

  return { players: parsed.players, meta };
}

/** 選手1件を ID で取得（見つからなければ null） */
export async function getPlayerById(id: string): Promise<{
  player: PlayerSummary | null;
  meta: PlayersResult["meta"];
}> {
  const { players, meta } = await loadPlayers();
  const player = players.find((p) => p.id === id) ?? null;
  return { player, meta };
}

// ---- 純粋関数（テスト対象。副作用なし） ----

/** 検索用の文字列正規化: 前後空白除去・小文字化・全角スペースを半角に */
export function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/　/g, " ");
}

/** キーワードで絞り込み（日本語名・英語名の部分一致、または選手IDの完全一致） */
export function filterPlayers(players: PlayerSummary[], query: string): PlayerSummary[] {
  const q = normalizeText(query);
  if (q === "") return players;
  const rawId = query.trim();
  return players.filter(
    (p) =>
      normalizeText(p.nameJa).includes(q) ||
      normalizeText(p.nameEn).includes(q) ||
      p.id === rawId,
  );
}

/** 並べ替え（元配列は変更しない） */
export function sortPlayers(players: PlayerSummary[], sort: SortKey): PlayerSummary[] {
  const arr = [...players];
  switch (sort) {
    case "ovr_asc":
      return arr.sort((a, b) => a.ovr - b.ovr || a.nameEn.localeCompare(b.nameEn));
    case "name":
      return arr.sort((a, b) => a.nameJa.localeCompare(b.nameJa, "ja"));
    case "ovr_desc":
    default:
      return arr.sort((a, b) => b.ovr - a.ovr || a.nameEn.localeCompare(b.nameEn));
  }
}

/** クエリ文字列を安全な SortKey に変換 */
export function parseSortKey(value: string | null | undefined): SortKey {
  return value === "ovr_asc" || value === "name" ? value : "ovr_desc";
}

/** 検索 + 並べ替え + 件数制限をまとめて適用 */
export function queryPlayers(
  players: PlayerSummary[],
  options: { q?: string; sort?: SortKey; limit?: number },
): { players: PlayerSummary[]; total: number } {
  const filtered = filterPlayers(players, options.q ?? "");
  const sorted = sortPlayers(filtered, options.sort ?? "ovr_desc");
  const total = sorted.length;
  const limited =
    typeof options.limit === "number" ? sorted.slice(0, options.limit) : sorted;
  return { players: limited, total };
}
