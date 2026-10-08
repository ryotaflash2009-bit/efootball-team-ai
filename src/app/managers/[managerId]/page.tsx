import { notFound } from "next/navigation";
import { cachedGetManagerById } from "@/lib/reference-data/runtime/cached-queries";
import { getManagerById, ManagerDataUnavailableError } from "@/lib/managers/repository";
import { MANAGER_ID_RE } from "@/lib/managers/schemas";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { breadcrumbJsonLd } from "@/lib/seo/structured-data";
import { ManagerDetailView, ManagerUnavailableView } from "@/components/managers/ManagerDetailView";

export const runtime = "nodejs";
export const revalidate = 300;

/** 監督ごとの題名・説明（2026-10-08）。監督名はデータの表記のまま（翻訳しない）。 */
export async function generateMetadata({ params }: { params: Promise<{ managerId: string }> }) {
  const { managerId } = await params;
  const decoded = decodeURIComponent(managerId);
  if (!MANAGER_ID_RE.test(decoded)) return {};
  try {
    const m = await cachedGetManagerById(decoded);
    if (!m) return {};
    return pageMetadata({
      path: `/managers/${decoded}`,
      title: `${m.nameEn}（監督）の戦術の適性・ブースター | TeamAIXI`,
      description: `イーフト（eFootball™）の監督 ${m.nameEn} の戦術の適性・監督ブースター・Link-Up Play を確認できます。`,
    });
  } catch {
    return {};
  }
}

export default async function ManagerDetailPage({ params }: { params: Promise<{ managerId: string }> }) {
  const { managerId } = await params;
  const decoded = decodeURIComponent(managerId);
  if (!MANAGER_ID_RE.test(decoded)) notFound();

  let manager: Awaited<ReturnType<typeof getManagerById>> = null;
  try {
    manager = await cachedGetManagerById(decoded);
  } catch (err) {
    if (err instanceof ManagerDataUnavailableError) return <ManagerUnavailableView />;
    throw err;
  }
  if (!manager) notFound();

  return (
    <>
      <JsonLdScript data={breadcrumbJsonLd([{ name: "ホーム", path: "/" }, { name: "監督一覧", path: "/managers" }, { name: manager.nameEn, path: `/managers/${decoded}` }])} />
      <ManagerDetailView manager={manager} />
    </>
  );
}
