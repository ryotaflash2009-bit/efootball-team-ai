import type { Dictionary } from "./ja";
import jaCore from "./ja";
import { JA_SPLIT_NAMESPACES } from "./ja-ns/all";

/** 完全な日本語の辞書（核 + 分けた名前空間）。監査・テスト・サーバー用。client の画面では使わない（全部を読み込むため）。 */
const jaFull = { ...jaCore, ...JA_SPLIT_NAMESPACES } as Dictionary;

export default jaFull;
