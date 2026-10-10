import { emptySquad, newSubId } from "@/lib/squad/squad-storage";
import { MAX_SUBSTITUTES, type StoredSquad } from "@/lib/squad/types";
import type { BestXiBenchResult } from "./bench";
import type { BestXiSelectionResult } from "./types";

/**
 * AIベストイレブンの結果から新しいスカッドを作る（2026-10-11）。保存はしない（呼び出し側が saveSquad）。
 *
 * - フォーメーションは結果のもの。先発は結果のスロット（slotId が一致する枠）に置く。空きの枠は空のまま。
 * - 保存ビルドの候補は、そのビルドをスロットに設定する（savedBuildId）。基礎値の候補は設定なし。
 * - 控えは控えの選考の順に、最大 MAX_SUBSTITUTES 枚。先発と同じカードは入れない（念のため）。
 * - 監督・キャプテン・セットプレー・連携は未設定（スカッドの画面で決める）。
 */
export function bestXiToSquad(result: BestXiSelectionResult, bench: BestXiBenchResult | null, squadName: string): StoredSquad {
  const squad = emptySquad(squadName, result.formationId);
  const bySlot = new Map(result.slots.map((s) => [s.slotId, s.candidate]));
  squad.slots = squad.slots.map((slot) => {
    const c = bySlot.get(slot.slotId);
    return c ? { ...slot, worldCardId: c.worldCardId, savedBuildId: c.source === "build" ? c.buildId : null } : slot;
  });
  const starters = new Set(result.slots.map((s) => s.candidate.worldCardId));
  const seen = new Set<string>();
  squad.substitutes = (bench?.entries ?? [])
    .filter((e) => !starters.has(e.candidate.worldCardId) && !seen.has(e.candidate.worldCardId) && seen.add(e.candidate.worldCardId))
    .slice(0, MAX_SUBSTITUTES)
    .map((e) => ({
      subId: newSubId(),
      worldCardId: e.candidate.worldCardId,
      buildMode: "none" as const,
      savedBuildId: e.candidate.source === "build" ? e.candidate.buildId : null,
    }));
  return squad;
}
