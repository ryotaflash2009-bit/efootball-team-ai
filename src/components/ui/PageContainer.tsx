import type { ReactNode } from "react";
import { CONTAINER_MAXW, type ContainerWidth } from "./layout";

/**
 * ページ本文のラッパー。中央寄せ＋最大幅＋左右余白。
 * data-list: データ一覧 / 詳細 → wide、比較 → xwide、スカッド → full、文章 → regular。
 */
export function PageContainer({
  width = "wide",
  children,
  className = "",
}: {
  width?: ContainerWidth;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full ${CONTAINER_MAXW[width]} px-4 py-5 sm:px-6 lg:px-8 lg:py-7 ${className}`}>
      {children}
    </div>
  );
}
