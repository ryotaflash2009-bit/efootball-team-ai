import { promises as fs } from "node:fs";
import path from "node:path";
import { parsedPlayerCardSchema, type ParsedPlayerCard } from "./card-schema";

/**
 * Phase A のカード保存層（JSON ファイル）。
 * Phase C 以降でこの関数の中身を SQLite / PostgreSQL アクセスへ差し替える。
 * 呼び出し側はこのモジュールだけを通してカードを読み書きする。
 */

export const DEFAULT_CARDS_DIR = path.join(process.cwd(), "src", "data", "cards");

/** 直列化（保存前に Zod 検証） */
export function serializeCard(card: ParsedPlayerCard): string {
  const validated = parsedPlayerCardSchema.parse(card);
  return JSON.stringify(validated, null, 2) + "\n";
}

/** 逆直列化（読み込み後に Zod 検証） */
export function deserializeCard(text: string): ParsedPlayerCard {
  return parsedPlayerCardSchema.parse(JSON.parse(text));
}

export function cardFilePath(efhubCardId: string, dir: string = DEFAULT_CARDS_DIR): string {
  if (!/^[0-9]{1,20}$/.test(efhubCardId)) {
    throw new Error(`invalid efhubCardId: ${JSON.stringify(efhubCardId)}`);
  }
  return path.join(dir, `${efhubCardId}.json`);
}

export async function saveCard(card: ParsedPlayerCard, dir: string = DEFAULT_CARDS_DIR): Promise<string> {
  await fs.mkdir(dir, { recursive: true });
  const file = cardFilePath(card.efhubCardId, dir);
  await fs.writeFile(file, serializeCard(card), "utf8");
  return file;
}

export async function loadCard(
  efhubCardId: string,
  dir: string = DEFAULT_CARDS_DIR,
): Promise<ParsedPlayerCard | null> {
  const file = cardFilePath(efhubCardId, dir);
  try {
    return deserializeCard(await fs.readFile(file, "utf8"));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function listCardIds(dir: string = DEFAULT_CARDS_DIR): Promise<string[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  return entries
    .filter((f) => /^[0-9]{1,20}\.json$/.test(f))
    .map((f) => f.replace(/\.json$/, ""))
    .sort();
}
