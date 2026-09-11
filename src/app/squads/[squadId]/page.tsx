import Link from "next/link";
import { SquadEditor } from "@/components/squad/SquadEditor";
import { SQUAD_ID_RE, BUILD_ID_RE } from "@/lib/squad/types";
import { isFormationId } from "@/lib/squad/formations";
import { worldCardIdSchema } from "@/lib/world/schemas";
import { PageContainer } from "@/components/ui/PageContainer";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonClasses } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;

export default async function SquadEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ squadId: string }>;
  searchParams: Promise<SP>;
}) {
  const { squadId } = await params;
  const sp = await searchParams;
  const decoded = decodeURIComponent(squadId);

  if (!SQUAD_ID_RE.test(decoded)) {
    return (
      <PageContainer width="wide">
        <EmptyState
          icon="search"
          variant="no-results"
          title="スカッドが見つかりません"
          description="スカッド ID の形式が正しくありません。"
          action={
            <Link href="/squads" className={buttonClasses("primary", "sm")}>
              スカッド一覧へ
            </Link>
          }
        />
      </PageContainer>
    );
  }

  const f = typeof sp.f === "string" && isFormationId(sp.f) ? sp.f : null;
  const cardParam = typeof sp.card === "string" ? sp.card : null;
  const pendingWorldCardId =
    cardParam && worldCardIdSchema.safeParse(cardParam).success ? cardParam : null;
  const buildParam = typeof sp.build === "string" ? sp.build : null;
  // カードIDが無効なら、孤立した保存ビルドIDだけを引き継がない(カードとビルドは常にセット)。
  const pendingBuildId =
    pendingWorldCardId && buildParam && BUILD_ID_RE.test(buildParam) ? buildParam : null;

  return (
    <PageContainer width="full">
      <SquadEditor
        squadId={decoded}
        initialFormationId={f}
        pendingWorldCardId={pendingWorldCardId}
        pendingBuildId={pendingBuildId}
      />
    </PageContainer>
  );
}
