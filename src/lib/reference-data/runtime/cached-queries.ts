import { unstable_cache } from "next/cache";
import { listPlayers, getFacets, getSourceMeta, getPlayerByWorldId } from "@/lib/world/repository";
import { getEfhubAnalysisDetail } from "@/lib/world/analysis-repository";
import { listManagers, getManagerById, getManagerCount, getManagersLatestFetchedAt } from "@/lib/managers/repository";

/**
 * 公開の参照データ（選手・監督）の照会の結果を、サーバーで短時間（REFERENCE_CACHE_SECONDS）共有する（2026-10-04）。
 *
 * - 対象は全員に同じ公開データだけ。利用者ごとのデータ・認証済みのデータ・ローカルのデータは入れない。
 * - key は照会の引数そのもの（検索語・絞り込み・並び順・ページ・ID）。言語で結果は変わらない（表示言語は client で切り替える）。
 * - 例外（データが使えない・不正な検索語）は cache しない（unstable_cache は成功した結果だけを保存する）。
 * - 参照データは自動更新の Apply でだけ変わる。Apply の後は最大 REFERENCE_CACHE_SECONDS 秒で新しい値になる
 *   （選手詳細の revalidate・公開 API の max-age と同じ 300 秒）。古い値を「最新」とは表示しない（画面の「取得日時」は結果に含まれる値）。
 * - 画面遷移のたびに Supabase へ同じ照会を繰り返していた待ち（遷移 0.9〜1.5 秒）を短くするため。
 */
export const REFERENCE_CACHE_SECONDS = 300;
const opts = { revalidate: REFERENCE_CACHE_SECONDS, tags: ["reference-data"] };

export const cachedListPlayers = unstable_cache(listPlayers, ["reference:listPlayers:v1"], opts);
export const cachedGetFacets = unstable_cache(getFacets, ["reference:getFacets:v1"], opts);
export const cachedGetSourceMeta = unstable_cache(getSourceMeta, ["reference:getSourceMeta:v1"], opts);
export const cachedGetPlayerByWorldId = unstable_cache(getPlayerByWorldId, ["reference:getPlayerByWorldId:v1"], opts);
export const cachedGetEfhubAnalysisDetail = unstable_cache(getEfhubAnalysisDetail, ["reference:getEfhubAnalysisDetail:v1"], opts);
export const cachedListManagers = unstable_cache(listManagers, ["reference:listManagers:v1"], opts);
export const cachedGetManagerById = unstable_cache(getManagerById, ["reference:getManagerById:v1"], opts);
export const cachedGetManagerCount = unstable_cache(getManagerCount, ["reference:getManagerCount:v1"], opts);
export const cachedGetManagersLatestFetchedAt = unstable_cache(getManagersLatestFetchedAt, ["reference:getManagersLatestFetchedAt:v1"], opts);
