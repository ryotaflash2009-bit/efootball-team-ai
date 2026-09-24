import { readFileSync } from "node:fs";
import path from "node:path";
import { buildWorldSearchBody, normalizeWorldPlayerRecord, toWorldSourceRow } from "../source-world";
import { buildInsertRow } from "../update-diff";
import type { RecordedWorldPage, WorldProductionState } from "../stage4-world";
import { SEED_BATCH_ID, T0, seedImportBatch } from "./stage4-fixtures";

/**
 * World専用リハーサルのテスト用合成データ(実データではない)。
 * 現在のProduction 4件に対し、upstream 5件で次の差分になる:
 *   #1 card_ratingだけ変更 / #2 ovr_max(構造的な)変更 / #3 appearanceだけ違う(保持列 → 更新しない) / #4 変更なし / #5 追加
 */

const FIX = path.join(__dirname, "source");
const TEMPLATE = (JSON.parse(readFileSync(path.join(FIX, "world-players-synthetic.json"), "utf8")) as { players: Record<string, unknown>[] }).players[0];
const NAIVE = "2026-04-01T00:00:00";

export function worldPlayer(i: number, patch: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...TEMPLATE,
    id: `90000000000000${i}`,
    name: `Synthetic World Player ${i}`,
    nameJp: `合成 World 選手 ${i}`,
    appearance: { ...((TEMPLATE.appearance as object) ?? {}), updatedAt: NAIVE },
    ...patch,
  };
}

/** Production形の現在行(#1〜#4)。 */
export function currentWorldRows(): Record<string, unknown>[] {
  return [1, 2, 3, 4].map((i) => {
    const r = toWorldSourceRow(normalizeWorldPlayerRecord(worldPlayer(i)), T0);
    if (!r.ok) throw new Error("fixture world row");
    return { ...buildInsertRow("world_player_cards", r.row), dataset_version: "v0", import_batch_id: SEED_BATCH_ID, created_at: T0, updated_at: T0 };
  });
}

/** upstreamの5件(差分は上のコメントのとおり)。 */
export function upstreamPlayers(opts: { removeFourth?: boolean; updatedAt?: string } = {}): Record<string, unknown>[] {
  const at = (p: Record<string, unknown>) => (opts.updatedAt ? { ...p, appearance: { ...(p.appearance as object), updatedAt: opts.updatedAt } } : p);
  const list = [
    worldPlayer(1, { rating: "9" }),
    worldPlayer(2, { maxOverall: 104 }),
    worldPlayer(3, { appearance: { ...((TEMPLATE.appearance as object) ?? {}), updatedAt: NAIVE, jumpingHeight: 71 } }),
    worldPlayer(4),
    worldPlayer(5),
  ].map(at);
  return opts.removeFourth ? list.filter((p) => p.id !== "900000000000004") : list;
}

/** 2 pageに分けた記録済み応答(page size 3)。 */
export function recordedWorldPages(players: readonly Record<string, unknown>[] = upstreamPlayers()): RecordedWorldPage[] {
  const size = 3;
  const totalPages = Math.max(1, Math.ceil(players.length / size));
  return Array.from({ length: totalPages }, (_, i) => ({
    page: i + 1,
    requestBody: buildWorldSearchBody(i + 1, "CREATED_AT"),
    status: 200,
    contentType: "application/json",
    bodyText: JSON.stringify({ players: players.slice(i * size, (i + 1) * size), totalCount: players.length, totalPages, pageSize: size, hasNext: i + 1 < totalPages }),
  }));
}

export function worldState(rows = currentWorldRows(), importBatches: Record<string, unknown>[] = [seedImportBatch()]): WorldProductionState {
  return {
    world: rows,
    importBatches,
    counts: { world_player_cards: rows.length, managers: 0, import_batches: importBatches.length },
    managersMaxUpdatedAt: null,
    worldMaxAppearanceUpdatedAt: "2026-04-01T00:00:00.000Z",
  };
}
