import type { Dictionary } from "./ja";

/**
 * 日本語の辞書の名前空間の登録先（2026-10-04）。核（ja.ts）以外の名前空間は ja-ns/<名前空間>.ts を import した時点で登録される。
 * その名前空間を使うファイルは、必ず ja-ns/<名前空間> を import する（ja-namespace-imports.test.ts で確認）。
 */
const SPLIT: Partial<Dictionary> = {};

export function registerJaNamespace<N extends keyof Dictionary>(ns: N, value: Dictionary[N]): void {
  SPLIT[ns] = value;
}

export function jaSplitNamespace<N extends keyof Dictionary>(ns: N): Dictionary[N] | undefined {
  return SPLIT[ns];
}
