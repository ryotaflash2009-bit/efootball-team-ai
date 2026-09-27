"use client";

import { useEffect, useState } from "react";
import { isValidValueCounts, toCumulative, type CumulativeDistribution } from "./distribution";

/**
 * クライアント: /api/percentiles/world-base を1回だけ取得して、範囲ごとの累積分布にする（ページ間で共有）。
 * 取得できない・照合できないときは "unavailable"（画面は照合できない旨を表示し、値は出さない）。
 */
export type WorldBasePercentiles =
  | { state: "loading" }
  | { state: "unavailable" }
  | { state: "ready"; generatedAt: string; recordCount: number; scopes: Map<string, Map<string, CumulativeDistribution>> };

let pending: Promise<WorldBasePercentiles> | null = null;

async function load(): Promise<WorldBasePercentiles> {
  try {
    const res = await fetch("/api/percentiles/world-base");
    if (!res.ok) return { state: "unavailable" };
    const body = (await res.json()) as { status?: string; generatedAt?: string; recordCount?: number; scopes?: Record<string, { stats?: Record<string, unknown> }> };
    if (body.status !== "valid" || !body.scopes || typeof body.generatedAt !== "string" || typeof body.recordCount !== "number") return { state: "unavailable" };
    const scopes = new Map<string, Map<string, CumulativeDistribution>>();
    for (const [scopeKey, scope] of Object.entries(body.scopes)) {
      const m = new Map<string, CumulativeDistribution>();
      for (const [statKey, vc] of Object.entries(scope?.stats ?? {})) if (isValidValueCounts(vc)) m.set(statKey, toCumulative(vc));
      scopes.set(scopeKey, m);
    }
    return { state: "ready", generatedAt: body.generatedAt, recordCount: body.recordCount, scopes };
  } catch {
    return { state: "unavailable" };
  }
}

/** enabled が false の間は取得しない（比較画面のトグルなど）。 */
export function useWorldBasePercentiles(enabled = true): WorldBasePercentiles {
  const [value, setValue] = useState<WorldBasePercentiles>({ state: "loading" });
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    if (!pending) pending = load();
    void pending.then((v) => {
      if (alive) setValue(v);
      if (v.state === "unavailable") pending = null; // 次の表示で取り直せるように
    });
    return () => {
      alive = false;
    };
  }, [enabled]);
  return value;
}
