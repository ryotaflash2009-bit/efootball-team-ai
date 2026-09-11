import { SquadListBoard } from "@/components/squad/SquadListBoard";
import { PageContainer } from "@/components/ui/PageContainer";
import { worldCardIdSchema } from "@/lib/world/schemas";
import { BUILD_ID_RE } from "@/lib/squad/types";

export const metadata = {
  title: "スカッド | eFootball Team AI",
};

export default async function SquadsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const cardParam = typeof sp.card === "string" ? sp.card : null;
  const pendingCard = cardParam && worldCardIdSchema.safeParse(cardParam).success ? cardParam : null;
  const buildParam = typeof sp.build === "string" ? sp.build : null;
  // My Teamの「スカッドで使用」から引き継ぐ保存ビルドID。カードIDが無効な場合はビルドも無視する
  // (カードとビルドは常にセットで扱う。孤立したビルドIDだけを引き継がない)。
  const pendingBuild = pendingCard && buildParam && BUILD_ID_RE.test(buildParam) ? buildParam : null;

  return (
    <PageContainer>
      <SquadListBoard pendingWorldCardId={pendingCard} pendingBuildId={pendingBuild} />
    </PageContainer>
  );
}
