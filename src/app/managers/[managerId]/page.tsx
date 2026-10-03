import { notFound } from "next/navigation";
import { getManagerById, ManagerDataUnavailableError } from "@/lib/managers/repository";
import { MANAGER_ID_RE } from "@/lib/managers/schemas";
import { ManagerDetailView, ManagerUnavailableView } from "@/components/managers/ManagerDetailView";

export const runtime = "nodejs";
export const revalidate = 300;

export default async function ManagerDetailPage({ params }: { params: Promise<{ managerId: string }> }) {
  const { managerId } = await params;
  const decoded = decodeURIComponent(managerId);
  if (!MANAGER_ID_RE.test(decoded)) notFound();

  let manager: Awaited<ReturnType<typeof getManagerById>> = null;
  try {
    manager = await getManagerById(decoded);
  } catch (err) {
    if (err instanceof ManagerDataUnavailableError) return <ManagerUnavailableView />;
    throw err;
  }
  if (!manager) notFound();

  return <ManagerDetailView manager={manager} />;
}
