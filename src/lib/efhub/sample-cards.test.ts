import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { parsedPlayerCardSchema } from "./card-schema";
import { STAT_KEYS } from "./masters";
import { KNOWN_PARSER_VERSIONS } from "./parser-version";

/**
 * カード保存フォーマット（Phase A の Zod スキーマ）の不変条件を検証する。
 *
 * 対象は `src/data/cards/`（ローカルの実データキャッシュ、gitignore対象・クリーン
 * checkoutには存在しない）ではなく、`__fixtures__/sample-cards/`（このテスト専用に
 * Git管理するfixture、`parse-player-page.test.ts`のgolden JSONと同一内容の複製）。
 * ファイル名をefhubCardIdに一致させる不変条件があるため、専用ディレクトリへ
 * efhubCardId名でコピーしている（parse-player-page.test.ts側の分かりやすい命名の
 * フィクスチャとは別ファイルとして扱う）。
 */

const CARDS_DIR = path.join(process.cwd(), "src", "lib", "efhub", "__fixtures__", "sample-cards");

async function listCardFiles(): Promise<string[]> {
  const entries = await fs.readdir(CARDS_DIR);
  return entries.filter((f) => /^[0-9]{1,20}\.json$/.test(f)).sort();
}

describe("保存済みカード（src/data/cards/）", () => {
  it("2件以上ある", async () => {
    expect((await listCardFiles()).length).toBeGreaterThanOrEqual(2);
  });

  it("全カードが Zod スキーマを通り、ファイル名 == efhubCardId、efhubCardId は一意", async () => {
    const files = await listCardFiles();
    const seen = new Set<string>();
    for (const f of files) {
      const raw = JSON.parse(await fs.readFile(path.join(CARDS_DIR, f), "utf8"));
      const parsed = parsedPlayerCardSchema.safeParse(raw);
      expect(parsed.success, `${f}: ${parsed.success ? "" : JSON.stringify(parsed.error?.issues?.slice(0, 5))}`).toBe(true);
      if (!parsed.success) continue;
      const card = parsed.data;
      expect(`${card.efhubCardId}.json`).toBe(f);
      expect(seen.has(card.efhubCardId), `duplicate ${card.efhubCardId}`).toBe(false);
      seen.add(card.efhubCardId);
    }
  });

  it("全カード: baseStats は STAT_KEYS と一致 / 値は 1..120 / parserVersion は既知 / playingStyleDefensive は任意", async () => {
    const files = await listCardFiles();
    for (const f of files) {
      const raw = JSON.parse(await fs.readFile(path.join(CARDS_DIR, f), "utf8"));
      const card = parsedPlayerCardSchema.parse(raw);
      expect(Object.keys(card.baseStats).sort(), f).toEqual([...STAT_KEYS].sort());
      for (const [k, v] of Object.entries(card.baseStats)) {
        expect(v, `${f}.${k}`).toBeGreaterThanOrEqual(1);
        expect(v, `${f}.${k}`).toBeLessThanOrEqual(120);
      }
      expect(KNOWN_PARSER_VERSIONS as readonly string[], f).toContain(card.parserVersion);
      expect(card.playerSkills.length, f).toBeGreaterThan(0);
      expect(card.playerSkills.every((s) => typeof s === "string"), f).toBe(true);
      expect(card.additionalPositions.every((p) => Number.isFinite(p.familiarity)), f).toBe(true);
      // playingStyleDefensive: 無ければ undefined、あれば非空文字列 or null
      if (card.playingStyleDefensive !== undefined && card.playingStyleDefensive !== null) {
        expect(typeof card.playingStyleDefensive, f).toBe("string");
        expect(card.playingStyleDefensive.length, f).toBeGreaterThan(0);
      }
    }
  });

  it("同一人物の別カードは efhubCardId と baseStats で区別できる（存在すれば）", async () => {
    const load = async (id: string) => {
      try {
        return parsedPlayerCardSchema.parse(JSON.parse(await fs.readFile(path.join(CARDS_DIR, `${id}.json`), "utf8")));
      } catch {
        return null;
      }
    };
    const pairs: [string, string][] = [
      ["89138556575063", "89136409091415"], // Messi
      ["88041460996837", "88045755964133"], // Cannavaro
    ];
    for (const [a, b] of pairs) {
      const ca = await load(a);
      const cb = await load(b);
      if (!ca || !cb) continue;
      expect(ca.efhubCardId).not.toBe(cb.efhubCardId);
      expect(JSON.stringify(ca.baseStats)).not.toBe(JSON.stringify(cb.baseStats));
    }
  });
});
