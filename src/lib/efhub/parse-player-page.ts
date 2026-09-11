import { parsedPlayerCardSchema, type ParsedPlayerCard } from "./card-schema";
import { PLAYER_MODEL_KEYS, STAT_KEYS } from "./masters";
import { PARSER_VERSION } from "./parser-version";

/**
 * eFHUB 個別選手ページ（HTML + RSC）から 1カード分の構造化データを抽出する。
 *
 * - 受信テキストは文字列としてのみ扱う。eval / Function / コード実行はしない。
 * - RSC は self.__next_f.push([...]) のペイロードを JSON.parse で復元して走査する。
 * - 中心 player オブジェクトは「playerId が期待IDと完全一致」かつ levelCap / overallRating /
 *   playingStyle を持つノードとして特定する。
 * - baseStats(26) / playerSkills / additionalPositions / playerModel が欠けたら
 *   ParserStructureError を投げる（推測で埋めない）。
 * - 最後に Zod で検証する。
 */

export class ParserStructureError extends Error {
  readonly details: Record<string, unknown>;
  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "ParserStructureError";
    this.details = { parserVersion: PARSER_VERSION, ...details };
  }
}

interface ParseOptions {
  /** このページが表すべき選手ID（URL 由来）。RSC 内の playerId と完全一致を必須にする。 */
  expectedPlayerId: string;
  /** 取得元 URL（来歴として保存） */
  sourceUrl: string;
  /** 取得日時（ISO 文字列）。省略時は現在時刻。 */
  fetchedAt?: string;
  /** player-index.json 由来の最大レベル OVR 候補（あれば）。 */
  ovrMax?: number | null;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** RSC フライトチャンクを取り出し、行ごとに JSON.parse できたノードを返す。 */
function extractRscNodes(html: string): unknown[] {
  const chunks: string[] = [];
  const re = /self\.__next_f\.push\(\[\s*\d+\s*,\s*("(?:[^"\\]|\\.)*")\s*\]\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      chunks.push(JSON.parse(m[1]) as string);
    } catch {
      /* skip */
    }
  }
  const flight = chunks.join("");
  const nodes: unknown[] = [];
  for (const row of flight.split("\n")) {
    const mm = row.match(/^[0-9a-f]+:(?:[A-Za-z]+\d*)?(.*)$/s);
    if (!mm) continue;
    const body = mm[1];
    if (!body || (body[0] !== "{" && body[0] !== "[")) continue;
    try {
      nodes.push(JSON.parse(body));
    } catch {
      /* skip — 実行はしない */
    }
  }
  return nodes;
}

function walk(roots: unknown[], visit: (node: Record<string, unknown>) => void): void {
  let count = 0;
  const stack: unknown[] = [...roots];
  while (stack.length) {
    const node = stack.pop();
    if (count++ > 200000) break;
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length && i < 2000; i++) stack.push(node[i]);
    } else if (isRecord(node)) {
      visit(node);
      for (const k of Object.keys(node)) stack.push(node[k]);
    }
  }
}

function findPlayerObject(nodes: unknown[], expectedPlayerId: string): Record<string, unknown> {
  let found: Record<string, unknown> | null = null;
  walk(nodes, (node) => {
    if (found) return;
    const idVal = node.playerId ?? node.id;
    if (
      idVal != null &&
      String(idVal) === expectedPlayerId &&
      "levelCap" in node &&
      "overallRating" in node &&
      "playingStyle" in node
    ) {
      found = node;
    }
  });
  if (!found) {
    throw new ParserStructureError("中心 player オブジェクトが見つかりません", { expectedPlayerId });
  }
  return found;
}

function findBaseStats(nodes: unknown[]): Record<string, number> {
  let found: Record<string, number> | null = null;
  walk(nodes, (node) => {
    if (found) return;
    let numeric = 0;
    for (const k of STAT_KEYS) if (typeof node[k] === "number") numeric++;
    if (numeric < STAT_KEYS.length) return; // 26キー全部そろっていなければ対象外
    const obj: Record<string, number> = {};
    for (const k of STAT_KEYS) obj[k] = node[k] as number;
    found = obj;
  });
  if (!found) {
    throw new ParserStructureError("baseStats（26能力値）が見つからないか不完全です", {
      expectedKeys: STAT_KEYS.length,
    });
  }
  return found;
}

function findStringArrayByKey(nodes: unknown[], key: string): string[] | null {
  let found: string[] | null = null;
  walk(nodes, (node) => {
    if (found) return;
    const v = node[key];
    if (Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === "string")) {
      found = v as string[];
    }
  });
  return found;
}

function findAdditionalPositions(nodes: unknown[]): { position: string; familiarity: number }[] {
  let found: { position: string; familiarity: number }[] | null = null;
  walk(nodes, (node) => {
    if (found) return;
    const v = node.additionalPositions;
    if (
      Array.isArray(v) &&
      v.every(
        (x) =>
          isRecord(x) && typeof x.position === "string" && typeof x.familiarity === "number",
      )
    ) {
      found = v.map((x) => ({
        position: (x as Record<string, unknown>).position as string,
        familiarity: (x as Record<string, unknown>).familiarity as number,
      }));
    }
  });
  if (!found) {
    throw new ParserStructureError("additionalPositions 配列が見つかりません", {});
  }
  return found;
}

function str(node: Record<string, unknown>, key: string, fallback = ""): string {
  const v = node[key];
  return typeof v === "string" ? v : v == null ? fallback : String(v);
}

function num(node: Record<string, unknown>, key: string): number {
  const v = node[key];
  const n = typeof v === "string" ? Number(v) : v;
  if (typeof n !== "number" || !Number.isFinite(n)) {
    throw new ParserStructureError(`player.${key} が数値ではありません`, { key, value: v });
  }
  return n;
}

/** メイン関数 */
export function parsePlayerPage(html: string, opts: ParseOptions): ParsedPlayerCard {
  if (!/^[0-9]{1,20}$/.test(opts.expectedPlayerId)) {
    throw new ParserStructureError("expectedPlayerId が不正です（数字1〜20桁）", {
      expectedPlayerId: opts.expectedPlayerId,
    });
  }

  const nodes = extractRscNodes(html);
  if (nodes.length === 0) {
    throw new ParserStructureError("RSC ペイロードを1件も復元できませんでした", {});
  }

  const player = findPlayerObject(nodes, opts.expectedPlayerId);
  const baseStats = findBaseStats(nodes);
  const additionalPositions = findAdditionalPositions(nodes);

  const playerSkills =
    findStringArrayByKey(nodes, "playerSkills") ??
    (() => {
      throw new ParserStructureError("playerSkills 配列が見つかりません", {});
    })();

  const comSkillsRaw = player.comSkills;
  const comSkills = Array.isArray(comSkillsRaw) && comSkillsRaw.every((x) => typeof x === "string")
    ? (comSkillsRaw as string[])
    : [];

  const modelRaw = player.playerModel;
  if (!isRecord(modelRaw)) {
    throw new ParserStructureError("player.playerModel が見つかりません", {});
  }
  const playerModel: Record<string, number> = {};
  for (const k of PLAYER_MODEL_KEYS) {
    const v = modelRaw[k];
    if (typeof v !== "number") {
      throw new ParserStructureError(`playerModel.${k} が数値ではありません`, { key: k, value: v });
    }
    playerModel[k] = v;
  }

  const draft: ParsedPlayerCard = {
    efhubCardId: String(player.playerId ?? player.id),
    slug: str(player, "slug"),
    nameEn: str(player, "name"),
    nameJa: str(player, "nameJa"),
    nameZh: str(player, "nameZh"),

    registeredPosition: str(player, "position"),
    playingStyleName: str(player, "playingStyle"),
    playingStyleDefensive:
      typeof player.playingStyleDefensive === "string" && player.playingStyleDefensive !== ""
        ? player.playingStyleDefensive
        : null,
    playerTypeCode: num(player, "playerType"),

    ovrBase: num(player, "overallRating"),
    ovrMax: opts.ovrMax ?? null,

    age: num(player, "age"),
    heightCm: num(player, "height"),
    weightKg: num(player, "weight"),
    preferredFoot: str(player, "preferredFoot"),

    weakFootUsage: num(player, "weakFootUsage"),
    weakFootAccuracy: num(player, "weakFootAccuracy"),
    form: num(player, "form"),
    condition: num(player, "condition"),
    injuryResistance: num(player, "injuryResistance"),

    levelCap: num(player, "levelCap"),

    boostId1: num(player, "boostId"),
    boostId2: num(player, "boostId2"),

    gpValue: num(player, "gpValue"),
    countryId: num(player, "countryId"),
    leagueId: num(player, "leagueId"),
    leagueName: str(player, "league"),
    teamId: str(player, "teamId"),
    teamName: str(player, "team"),
    imageUrl: str(player, "imageUrl"),
    datapackId: num(player, "datapackId"),

    baseStats: baseStats as ParsedPlayerCard["baseStats"],
    playerSkills,
    comSkills,
    additionalPositions,
    playerModel: playerModel as ParsedPlayerCard["playerModel"],

    parserVersion: PARSER_VERSION,
    source: "efhub",
    sourceUrl: opts.sourceUrl,
    fetchedAt: opts.fetchedAt ?? new Date().toISOString(),
  };

  const result = parsedPlayerCardSchema.safeParse(draft);
  if (!result.success) {
    throw new ParserStructureError("抽出データが Zod 検証に失敗しました", {
      issues: result.error.issues.slice(0, 20),
    });
  }
  return result.data;
}
