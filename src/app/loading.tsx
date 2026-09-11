import { PageContainer } from "@/components/ui/PageContainer";
import { LoadingState } from "@/components/ui/LoadingState";
import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <PageContainer>
      <div className="flex flex-col gap-5">
        <Skeleton className="h-9 w-48" />
        <LoadingState variant="cards" />
      </div>
    </PageContainer>
  );
}
