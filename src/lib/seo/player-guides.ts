import data from "@/content/player-guides.json";

/**
 * 選手ごとの解説の記事（2026-10-08・土台）。記事は `src/content/player-guides.json` に人が書く。
 * - `published: false` の記事は noindex で、sitemap に載せない（下書き・仮の構成のまま検索に出さない）。
 * - slug は英小文字・数字・ハイフン。worldCardId は World のカード ID（選手の詳細・チーム診断への導線に使う）。
 * - 大量の自動生成はしない（検索エンジンのスパムの扱いを避ける）。
 */
export interface PlayerGuideSection {
  heading: string;
  body: string;
}

export interface PlayerGuide {
  slug: string;
  worldCardId: string;
  title: string;
  description: string;
  published: boolean;
  updatedAt: string;
  sections: PlayerGuideSection[];
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const WORLD_ID_RE = /^[0-9]{1,20}$/;

export function validatePlayerGuides(raw: unknown): PlayerGuide[] {
  const list = (raw as { guides?: unknown })?.guides;
  if (!Array.isArray(list)) throw new Error("player-guides: guides is not an array");
  const seen = new Set<string>();
  return list.map((g, i) => {
    const o = g as Record<string, unknown>;
    if (typeof o.slug !== "string" || !SLUG_RE.test(o.slug) || o.slug.length > 80) throw new Error(`player-guides[${i}]: invalid slug`);
    if (seen.has(o.slug)) throw new Error(`player-guides[${i}]: duplicate slug`);
    seen.add(o.slug);
    if (typeof o.worldCardId !== "string" || !WORLD_ID_RE.test(o.worldCardId)) throw new Error(`player-guides[${i}]: invalid worldCardId`);
    if (typeof o.title !== "string" || !o.title.trim() || o.title.length > 80) throw new Error(`player-guides[${i}]: invalid title`);
    if (typeof o.description !== "string" || !o.description.trim() || o.description.length > 200) throw new Error(`player-guides[${i}]: invalid description`);
    if (typeof o.published !== "boolean") throw new Error(`player-guides[${i}]: published must be boolean`);
    if (typeof o.updatedAt !== "string" || Number.isNaN(Date.parse(o.updatedAt))) throw new Error(`player-guides[${i}]: invalid updatedAt`);
    if (!Array.isArray(o.sections) || o.sections.length === 0) throw new Error(`player-guides[${i}]: sections required`);
    const sections = o.sections.map((s, j) => {
      const so = s as Record<string, unknown>;
      if (typeof so.heading !== "string" || typeof so.body !== "string") throw new Error(`player-guides[${i}].sections[${j}]: invalid`);
      return { heading: so.heading, body: so.body };
    });
    return { slug: o.slug, worldCardId: o.worldCardId, title: o.title, description: o.description, published: o.published, updatedAt: o.updatedAt, sections };
  });
}

export const PLAYER_GUIDES: readonly PlayerGuide[] = validatePlayerGuides(data);

export function getPlayerGuide(slug: string): PlayerGuide | null {
  return PLAYER_GUIDES.find((g) => g.slug === slug) ?? null;
}

export function publishedPlayerGuides(): PlayerGuide[] {
  return PLAYER_GUIDES.filter((g) => g.published);
}
