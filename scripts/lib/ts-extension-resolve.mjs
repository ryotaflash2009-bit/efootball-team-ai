/**
 * Node の型の除去（.ts の直接実行）用の resolve hook。拡張子なしの相対 import（"./ja" 等）に ".ts" を補う。
 * 監査スクリプトが、分割した日本語の辞書（ja-ns/*.ts）を含む完全な辞書を読むため（2026-10-04）。
 */
export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (err) {
    if ((specifier.startsWith("./") || specifier.startsWith("../")) && !/\.[cm]?[jt]s$/.test(specifier)) return next(`${specifier}.ts`, context);
    throw err;
  }
}
