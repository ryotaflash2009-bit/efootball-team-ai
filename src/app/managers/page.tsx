import { parseManagerListQuery } from "@/lib/managers/schemas";
import { listManagers, ManagerDataUnavailableError } from "@/lib/managers/repository";
import { ManagersPageView, ManagersUnavailableView, ManagersFailedView } from "@/components/managers/ManagersPageView";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const pick = (sp: SP, k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : null);

export default async function ManagersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const q = parseManagerListQuery({
    page: pick(sp, "page"),
    pageSize: pick(sp, "pageSize"),
    q: pick(sp, "q"),
    sort: pick(sp, "sort"),
    hasBooster: pick(sp, "hasBooster"),
    hasLinkUpPlay: pick(sp, "hasLinkUpPlay"),
  });

  let result: Awaited<ReturnType<typeof listManagers>> | null = null;
  let unavailable = false;
  let failed = false;
  try {
    result = listManagers(q);
  } catch (err) {
    if (err instanceof ManagerDataUnavailableError) unavailable = true;
    else failed = true;
  }

  if (unavailable) return <ManagersUnavailableView />;
  if (failed || !result) return <ManagersFailedView />;

  const hasFilters = !!(q.query || q.hasBooster != null || q.hasLinkUpPlay != null);
  const hrefFor = (p: number) => {
    const sq = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && v && k !== "page") sq.set(k, v);
    if (p > 1) sq.set("page", String(p));
    const s = sq.toString();
    return s ? `/managers?${s}` : "/managers";
  };
  const from = result.totalCount === 0 ? 0 : (result.page - 1) * result.pageSize + 1;
  const to = Math.min(result.page * result.pageSize, result.totalCount);

  return (
    <ManagersPageView
      result={result}
      hasFilters={hasFilters}
      prevHref={hrefFor(result.page - 1)}
      nextHref={hrefFor(result.page + 1)}
      from={from}
      to={to}
    />
  );
}
