/** localStorageへの安全なアクセス(プライベートモード等での例外を握りつぶす)。 */
export function getSafeLocalStorage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const probe = "__efb_scope_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

/** 指定キーの生JSON値を安全に読む(壊れたJSON・アクセス不可はnull)。 */
export function readRawJson(key: string): unknown {
  const ls = getSafeLocalStorage();
  if (!ls) return null;
  let raw: string | null;
  try {
    raw = ls.getItem(key);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
