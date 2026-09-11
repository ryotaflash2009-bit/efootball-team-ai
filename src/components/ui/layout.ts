/** ページ本文の最大幅バリアント。ページ種別に応じて選ぶ。 */
export type ContainerWidth = "regular" | "wide" | "xwide" | "full";

export const CONTAINER_MAXW: Record<ContainerWidth, string> = {
  regular: "max-w-content",
  wide: "max-w-content-wide",
  xwide: "max-w-content-xwide",
  full: "max-w-content-full",
};
