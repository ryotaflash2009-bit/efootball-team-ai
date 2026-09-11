import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";
import type { DatabaseSync as DatabaseSyncCtor } from "node:sqlite";

/**
 * `node:sqlite` は Node 24 標準（実験的）。バンドラに静的解決させたくないため
 * 実行時に require する（型は node-sqlite.d.ts のアンビエント宣言から借りる）。
 */
const nodeRequire = createRequire(import.meta.url);
const { DatabaseSync } = nodeRequire("node:sqlite") as {
  DatabaseSync: typeof DatabaseSyncCtor;
};

type DatabaseSync = DatabaseSyncCtor;

/**
 * eFootball World データ用の SQLite 接続（読み取り専用）。
 *
 * - `data/efootball.db` を readOnly で開く。書き込みは一切しない。
 * - 接続はプロセス内で 1 つだけ保持（リクエストごとに開かない）。
 * - DB 不在 / World テーブル不在は WorldDataUnavailableError で表現し、
 *   画面側は安全な日本語メッセージだけを出す（パス・SQL・内部エラーは出さない）。
 */

export const DB_PATH = path.join(process.cwd(), "data", "efootball.db");

export class WorldDataUnavailableError extends Error {
  readonly code = "WORLD_DATA_UNAVAILABLE";
  constructor(message = "World データが利用できません") {
    super(message);
    this.name = "WorldDataUnavailableError";
  }
}

export class WorldQueryError extends Error {
  readonly code = "WORLD_QUERY_FAILED";
  constructor(message = "World データの照会に失敗しました") {
    super(message);
    this.name = "WorldQueryError";
  }
}

let db: DatabaseSync | null = null;
let verified = false;

function openConnection(): DatabaseSync {
  if (!fs.existsSync(DB_PATH)) {
    throw new WorldDataUnavailableError("SQLite ファイルが見つかりません");
  }
  try {
    return new DatabaseSync(DB_PATH, { readOnly: true });
  } catch {
    throw new WorldDataUnavailableError("SQLite ファイルを開けません");
  }
}

function verifySchema(conn: DatabaseSync): void {
  const required = ["world_player_cards", "world_player_stats", "world_player_skills"];
  let names: Set<string>;
  try {
    const rows = conn
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as { name: string }[];
    names = new Set(rows.map((r) => r.name));
  } catch {
    throw new WorldDataUnavailableError("スキーマを確認できません");
  }
  for (const t of required) {
    if (!names.has(t)) {
      throw new WorldDataUnavailableError(`テーブル ${t} がありません`);
    }
  }
}

/** 読み取り専用接続を取得。初回のみスキーマ検証する。 */
export function getDb(): DatabaseSync {
  if (db && verified) return db;
  const conn = db ?? openConnection();
  verifySchema(conn);
  db = conn;
  verified = true;
  return db;
}

/** テスト用: 接続を閉じてキャッシュを捨てる。 */
export function _resetDb(): void {
  try {
    db?.close();
  } catch {
    /* ignore */
  }
  db = null;
  verified = false;
}
