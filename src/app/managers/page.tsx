import { parseManagerListQuery } from "@/lib/managers/schemas";
import { getManagersLatestFetchedAt, listManagers, ManagerDataUnavailableError } from "@/lib/managers/repository";
import { ManagersPageView, ManagersUnavailableView, ManagersFailedView, ManagersSearchRejectedView } from "@/components/managers/ManagersPageView";
import { SearchInputRejectedError, checkSearchInput } from "@/lib/search/search-input";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const pick = (sp: SP, k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : null);

export default async function ManagersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  // 制御文字等を含む検索語は照会せず、安全な表示にする(上流の防御による拒否も同じ表示)。
  if (!checkSearchInput(pick(sp, "q")).ok) return <ManagersSearchRejectedView />;
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
  let rejected = false;
  try {
    result = await listManagers(q);
  } catch (err) {
    if (err instanceof ManagerDataUnavailableError) unavailable = true;
    else if (err instanceof SearchInputRejectedError) rejected = true;
    else failed = true;
  }

  if (unavailable) return <ManagersUnavailableView />;
  if (rejected) return <ManagersSearchRejectedView />;
  if (failed || !result) return <ManagersFailedView />;

  // データの時点(取り込み日時)。取得できなくても一覧は表示し、時点は「—」にする(推測の日時は出さない)。
  let importedAt: string | null = null;
  try {
    importedAt = await getManagersLatestFetchedAt();
  } catch {
    importedAt = null;
  }

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
      importedAt={importedAt}
    />
  );
}
