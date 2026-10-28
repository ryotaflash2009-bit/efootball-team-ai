"use client";

import "@/lib/i18n/dictionaries/ja-ns/worldPlayerCard";
import { useT } from "@/lib/i18n/LocaleContext";
import { useMyTeam } from "@/lib/user-cards/hooks";

/**
 * My Team で「所持」のカードに出す「所持済み」の印（2026-10-28）。ブラウザーの中だけで判定する。
 * 呼び出し側は next/dynamic（ssr: false）で読み込み、My Team の読み込み（認証の状態の確認を含む）を最初の JS から外す。
 */
export function OwnedMark({ worldCardId, className, testId }: { worldCardId: string; className: string; testId: string }) {
  const t = useT();
  const { getByWorldId } = useMyTeam();
  const rec = getByWorldId(worldCardId);
  if (!rec || rec.ownershipStatus !== "owned" || rec.deletedAt) return null;
  return (
    <span className={className} data-testid={testId}>
      {t("worldPlayerCard", "ownedBadge")}
    </span>
  );
}
