import { getPlayerByWorldId } from "@/lib/world/repository";
import { cachedGetManagerById, cachedGetPlayerByWorldId } from "@/lib/reference-data/runtime/cached-queries";
import { getManagerById } from "@/lib/managers/repository";
import { WorldDataUnavailableError } from "@/lib/world/db";
import { parseComparisonState } from "@/lib/comparison/schemas";
import { worldDetailToComparisonInput } from "@/lib/comparison/from-world";
import { managerToContext } from "@/lib/managers/to-context";
import { ComparisonBoard } from "@/components/compare/ComparisonBoard";
import type { ComparisonPlayerInput } from "@/lib/comparison/types";
import { PageContainer } from "@/components/ui/PageContainer";
import { ComparePageHeader, ComparePageDataUnavailable } from "@/components/compare/ComparePageHeader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const pick = (sp: SP, k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : null);

export default async function ComparePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const state = parseComparisonState({
    ids: pick(sp, "ids"),
    b: pick(sp, "b"),
    m: pick(sp, "m"),
    tp: pick(sp, "tp"),
    al: pick(sp, "al"),
  });

  const inputs: ComparisonPlayerInput[] = [];
  let dataError = false;
  try {
    // 選手・監督の照会は互いに独立なので並行して行う（直列だと選手の数だけ待ちが積み重なっていた。2026-10-04）。
    // 表示の順序は URL の順のまま。照会の失敗は従来どおり下の catch で扱う。
    const loaded = await Promise.all(
      state.ids.map(async (id, i) => {
        const mid = state.managerIds[i];
        const [detail, m] = await Promise.all([cachedGetPlayerByWorldId(id), mid != null ? cachedGetManagerById(mid) : Promise.resolve(null)]);
        return { detail, m };
      }),
    );
    for (let i = 0; i < state.ids.length; i++) {
      const { detail, m } = loaded[i];
      if (!detail) continue;
      const managerCtx = m ? managerToContext(m) : null;
      inputs.push(
        worldDetailToComparisonInput(detail, {
          buildMode: state.buildModes[i],
          manager: managerCtx,
          conditionalTier: state.conditionalTiers?.[i],
          savedAllocation: state.allocations?.[i] ?? null,
        }),
      );
    }
  } catch (err) {
    if (err instanceof WorldDataUnavailableError) dataError = true;
    else throw err;
  }

  if (dataError) {
    return (
      <PageContainer width="xwide">
        <ComparePageDataUnavailable />
      </PageContainer>
    );
  }

  return (
    <PageContainer width="xwide">
      <div className="flex flex-col gap-5">
        <ComparePageHeader />
        <ComparisonBoard initialInputs={inputs} />
      </div>
    </PageContainer>
  );
}
