import Link from "next/link";
import { notFound } from "next/navigation";
import { PageContainer } from "@/components/ui/PageContainer";
import { getPlayerGuide, PLAYER_GUIDES } from "@/lib/seo/player-guides";
import { pageMetadata } from "@/lib/seo/page-metadata";

/**
 * 選手ごとの解説の記事（2026-10-08・土台）。記事は src/content/player-guides.json に人が書く。
 * 下書き（published: false）は noindex。記事から選手の詳細とチーム診断のツールへ案内する。
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return PLAYER_GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getPlayerGuide(slug);
  if (!guide) return {};
  return pageMetadata({
    path: `/players/guide/${guide.slug}`,
    title: `${guide.title} | TeamAIXI`,
    description: guide.description,
    noindex: !guide.published,
  });
}

export default async function PlayerGuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getPlayerGuide(slug);
  if (!guide) notFound();
  return (
    <PageContainer width="regular">
      <article className="flex flex-col gap-5">
        <header className="flex flex-col gap-2">
          <p className="text-xs text-text-dim">選手の解説{guide.published ? "" : "（下書き）"}</p>
          <h1 className="text-2xl font-bold">{guide.title}</h1>
          <p className="text-sm text-text-dim">{guide.description}</p>
          <p className="text-2xs text-text-muted">更新: {guide.updatedAt}</p>
        </header>
        {guide.sections.map((s) => (
          <section key={s.heading} className="rounded-card border border-border bg-surface p-4">
            <h2 className="text-lg font-semibold">{s.heading}</h2>
            <p className="mt-2 whitespace-pre-line text-sm text-text">{s.body}</p>
          </section>
        ))}
        <nav className="flex flex-wrap gap-3" aria-label="関連のページ">
          <Link href={`/players/world/${guide.worldCardId}`} className="rounded-md border border-border px-4 py-2 text-sm hover:border-accent">
            この選手の能力値と育成計算を見る
          </Link>
          <Link href="/squads" className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">
            チーム診断を試す（スカッドを作る）
          </Link>
        </nav>
        <p className="text-2xs text-text-muted">本サイトは KONAMI とは関係のない非公式のファンツールです。</p>
      </article>
    </PageContainer>
  );
}
