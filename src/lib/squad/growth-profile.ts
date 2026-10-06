import type { DiagnosisHistoryEntry } from "./diagnosis-history";
import { SHARE_CATEGORY_IDS } from "./squad-diagnosis-share-url";
import type { SquadDiagnosisCategoryId, SquadDiagnosisTier } from "./squad-diagnosis";

/**
 * F-061 成長プロフィール（ブラウザー内の版・純関数）。
 * - 入力は F-060 の診断履歴（この端末・このアカウントのスコープ）。外部送信・サーバー保存なし。
 * - スカッドごとに、最新と同じ診断規則の版の履歴だけを日付順に並べる（規則が違う点数どうしを比べない）。
 * - 2件以上あるスカッドだけ: 総合点の推移、最初→最新の差、最も伸びたカテゴリ、弱点（C/D）から A 以上になったカテゴリ。
 * - v2（2026-10-07）: 最高点とその日・最も下がったカテゴリ・新しい弱点（A/S から C/D）・連続で上がった回数。
 */
export const GROWTH_PROFILE_RULES_VERSION = "growth-profile/2026-10-07.v2";
export const MAX_GROWTH_SQUADS = 5;

type CategoryId = Exclude<SquadDiagnosisCategoryId, "squadCompleteness">;

export interface GrowthSquad {
  squadId: string;
  squadLabel: string;
  rulesVersion: string;
  /** 日付順の総合点（点数が無い履歴は除く）。 */
  points: { savedAt: string; date: string; overall: number }[];
  first: number;
  latest: number;
  delta: number;
  /** 最初と最新の両方で点数があるカテゴリのうち、最も伸びたもの（伸びが無ければ null）。 */
  mostImproved: { categoryId: CategoryId; from: number; to: number; delta: number } | null;
  /** 最初は C / D、最新は A / S になったカテゴリ。 */
  overcameWeaknesses: CategoryId[];
  /** 規則の版が違うため除いた履歴の件数。 */
  excludedOtherRules: number;
  /** 最高の総合点と、その日（同点は早い方）。 */
  peak: { overall: number; date: string };
  /** 最初と最新の両方で点数があるカテゴリのうち、最も下がったもの（下がっていなければ null）。 */
  mostDeclined: { categoryId: CategoryId; from: number; to: number; delta: number } | null;
  /** 最初は A / S、最新は C / D になったカテゴリ。 */
  newWeaknesses: CategoryId[];
  /** 最新から遡って、前回より総合点が上がった回数（連続）。 */
  improvingStreak: number;
}

const WEAK: readonly SquadDiagnosisTier[] = ["C", "D"];
const STRONG: readonly SquadDiagnosisTier[] = ["S", "A"];

export function buildGrowthProfile(entries: readonly DiagnosisHistoryEntry[]): GrowthSquad[] {
  const bySquad = new Map<string, DiagnosisHistoryEntry[]>();
  for (const e of entries) {
    const list = bySquad.get(e.squadId);
    if (list) list.push(e);
    else bySquad.set(e.squadId, [e]);
  }
  const out: GrowthSquad[] = [];
  for (const [squadId, list] of bySquad) {
    const sorted = [...list].sort((a, b) => (a.savedAt < b.savedAt ? -1 : a.savedAt > b.savedAt ? 1 : a.id < b.id ? -1 : 1));
    const latestEntry = sorted[sorted.length - 1];
    const rules = latestEntry.payload.r;
    const same = sorted.filter((e) => e.payload.r === rules);
    const rated = same.filter((e) => typeof e.payload.o[0] === "number");
    if (rated.length < 2) continue;
    const first = rated[0];
    const last = rated[rated.length - 1];
    let mostImproved: GrowthSquad["mostImproved"] = null;
    let mostDeclined: GrowthSquad["mostDeclined"] = null;
    const overcame: CategoryId[] = [];
    const newWeak: CategoryId[] = [];
    for (const id of SHARE_CATEGORY_IDS as readonly CategoryId[]) {
      const [fs, ft] = first.payload.c[id] ?? [null, null];
      const [ls, lt] = last.payload.c[id] ?? [null, null];
      if (typeof fs === "number" && typeof ls === "number") {
        const d = ls - fs;
        if (d > 0 && (!mostImproved || d > mostImproved.delta)) mostImproved = { categoryId: id, from: fs, to: ls, delta: d };
        if (d < 0 && (!mostDeclined || d < mostDeclined.delta)) mostDeclined = { categoryId: id, from: fs, to: ls, delta: d };
      }
      if (ft && lt && WEAK.includes(ft) && STRONG.includes(lt)) overcame.push(id);
      if (ft && lt && STRONG.includes(ft) && WEAK.includes(lt)) newWeak.push(id);
    }
    out.push({
      squadId,
      squadLabel: latestEntry.squadLabel,
      rulesVersion: rules,
      points: rated.map((e) => ({ savedAt: e.savedAt, date: e.payload.d, overall: e.payload.o[0] as number })),
      first: first.payload.o[0] as number,
      latest: last.payload.o[0] as number,
      delta: (last.payload.o[0] as number) - (first.payload.o[0] as number),
      mostImproved,
      overcameWeaknesses: overcame,
      excludedOtherRules: sorted.length - same.length,
      peak: rated.reduce((best, e) => ((e.payload.o[0] as number) > best.overall ? { overall: e.payload.o[0] as number, date: e.payload.d } : best), { overall: first.payload.o[0] as number, date: first.payload.d }),
      mostDeclined,
      newWeaknesses: newWeak,
      improvingStreak: (() => {
        let n = 0;
        for (let i = rated.length - 1; i > 0 && (rated[i].payload.o[0] as number) > (rated[i - 1].payload.o[0] as number); i--) n++;
        return n;
      })(),
    });
  }
  // 最近更新したスカッドから。
  out.sort((a, b) => {
    const la = a.points[a.points.length - 1].savedAt;
    const lb = b.points[b.points.length - 1].savedAt;
    return la < lb ? 1 : la > lb ? -1 : a.squadId < b.squadId ? -1 : 1;
  });
  return out.slice(0, MAX_GROWTH_SQUADS);
}
