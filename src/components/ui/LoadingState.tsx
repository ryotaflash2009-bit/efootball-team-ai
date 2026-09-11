import { Skeleton } from "./Skeleton";

/**
 * ローディング中の骨格。ページ構造を維持し、高さが大きく動かないようにする。
 */
export function LoadingState({
  variant = "cards",
  count = 12,
}: {
  variant?: "cards" | "list" | "detail" | "table" | "pitch" | "compare";
  count?: number;
}) {
  if (variant === "list") {
    return (
      <div className="flex flex-col gap-2" aria-busy="true" aria-label="読み込み中">
        {Array.from({ length: count }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }
  if (variant === "detail") {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label="読み込み中">
        <div className="flex gap-4">
          <Skeleton className="h-48 w-36 shrink-0" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (variant === "table") {
    return <Skeleton className="h-96 w-full" aria-label="読み込み中" />;
  }
  if (variant === "pitch") {
    return (
      <div className="mx-auto w-full max-w-[520px]" aria-busy="true" aria-label="読み込み中">
        <Skeleton className="aspect-[68/105] w-full" />
      </div>
    );
  }
  if (variant === "compare") {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true" aria-label="読み込み中">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-64 w-full" />
        ))}
      </div>
    );
  }
  return (
    <div
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
      aria-busy="true"
      aria-label="読み込み中"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-card border border-border bg-surface p-3">
          <Skeleton className="aspect-[3/4] w-full" />
          <Skeleton className="mt-2 h-4 w-3/4" />
          <Skeleton className="mt-1.5 h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

/** 後方互換: 旧 LoadingCards の置き換え */
export function LoadingCards({ count = 12 }: { count?: number }) {
  return <LoadingState variant="cards" count={count} />;
}
