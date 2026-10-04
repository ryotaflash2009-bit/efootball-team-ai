import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 radarMode（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const radarMode: Dictionary["radarMode"] = {
  base: "基礎",
  progressed: "育成後",
  standard: "標準",
  conditional: "条件反映後",
  experimental: "実験",
  };

registerJaNamespace("radarMode", radarMode);

export default radarMode;
