import { getPlayerByWorldId } from "@/lib/world/repository";
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
    for (let i = 0; i < state.ids.length; i++) {
      const detail = getPlayerByWorldId(state.ids[i]);
      if (!detail) continue;
      let managerCtx = null;
      const mid = state.managerIds[i];
      if (mid != null) {
        const m = getManagerById(mid);
        if (m) managerCtx = managerToContext(m);
      }
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
