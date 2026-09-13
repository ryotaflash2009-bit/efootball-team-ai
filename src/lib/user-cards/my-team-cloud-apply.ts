import type { CloudMyTeamItem } from "@/lib/supabase/my-team-cloud-schema";
import { addToMyTeam, updateMyTeamRecord } from "./my-team-storage";
import type { MyTeamRecord } from "./types";

/**
 * クラウドから取得したMy Teamプレビューと、ローカルへの適用(Section 20)。
 *
 * 採用方式: 「不足分だけをローカルへ追加する(add missing only)」。
 *  - 既にローカルに存在するworldCardId(matching)は一切上書きしない
 *    (所有/使用状態・メモ・タグ等、ローカル側の値をそのまま維持する)。
 *  - ローカルにのみ存在するカード(local-only)は一切削除しない。
 *  - クラウドにのみ存在するカード(cloud-only)だけを、明示的な確認後に
 *    ローカルへ追加する。
 * この方式は非破壊的(削除・上書きが一切発生しない)なため、Section 20が
 * 要求する「置き換え」方式特有のバックアップ作成・二段階確認・失敗時ロールバック・
 * 適用前値のメモリ保持は不要になる(追加に失敗しても、それまでに追加できた分は
 * そのまま安全に残り、失敗分だけ再試行すればよい)。
 */

export interface MyTeamCloudApplyPreview {
  matchingCount: number;
  localOnlyCount: number;
  cloudOnlyItems: CloudMyTeamItem[];
  /** 既知のカードカタログと突き合わせたとき、cloud-onlyのうち解決できなかったworldCardId(任意)。 */
  unknownCardWorldIds: string[];
}

export function previewMyTeamCloudApply(
  localRecords: readonly MyTeamRecord[],
  cloudItems: readonly CloudMyTeamItem[],
  knownWorldCardIds?: ReadonlySet<string>,
): MyTeamCloudApplyPreview {
  const localIds = new Set(localRecords.map((r) => r.worldCardId));
  const cloudIds = new Set(cloudItems.map((i) => i.worldCardId));

  const matchingCount = cloudItems.filter((i) => localIds.has(i.worldCardId)).length;
  const localOnlyCount = localRecords.filter((r) => !cloudIds.has(r.worldCardId)).length;
  const cloudOnlyItems = cloudItems.filter((i) => !localIds.has(i.worldCardId));
  const unknownCardWorldIds = knownWorldCardIds
    ? cloudOnlyItems.filter((i) => !knownWorldCardIds.has(i.worldCardId)).map((i) => i.worldCardId)
    : [];

  return { matchingCount, localOnlyCount, cloudOnlyItems, unknownCardWorldIds };
}

export interface ApplyAddMissingResult {
  ok: boolean;
  addedCount: number;
  failedCount: number;
}

/** 明示確認後にのみ呼び出す。cloud-onlyの各カードをローカルへ追加する(既存レコードには触れない)。 */
export function applyAddMissingCloudItems(cloudOnlyItems: readonly CloudMyTeamItem[]): ApplyAddMissingResult {
  let addedCount = 0;
  let failedCount = 0;
  for (const item of cloudOnlyItems) {
    const result = addToMyTeam({
      worldCardId: item.worldCardId,
      ownershipStatus: item.ownershipStatus,
      usageStatus: item.usageStatus,
      note: item.note,
      tags: item.tags,
      selectedBuildId: item.selectedBuildId,
    });
    if (!result.ok) {
      failedCount += 1;
      continue;
    }
    addedCount += 1;
    if (item.favoriteBuildId) {
      updateMyTeamRecord(result.record.teamCardId, { favoriteBuildId: item.favoriteBuildId });
    }
  }
  return { ok: failedCount === 0, addedCount, failedCount };
}
