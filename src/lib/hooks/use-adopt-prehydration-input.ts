"use client";

import { useEffect, type RefObject } from "react";

/**
 * hydration の前に入力された文字を取りこぼさない（2026-10-05）。
 * 画面の HTML が表示されてから JS が動き出すまでの間に検索欄へ入力すると、その文字は DOM にはあっても React の state には無い。
 * マウントの時点で入力欄の値が state と違えば、その値を採用して通常の入力と同じ処理（検索の予約等）を行う。違わなければ何もしない。
 */
export function useAdoptPreHydrationInput(ref: RefObject<HTMLInputElement | null>, stateValue: string, adopt: (value: string) => void): void {
  useEffect(() => {
    const v = ref.current?.value ?? "";
    if (v !== stateValue) adopt(v);
    // マウントの時だけ確認する。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/**
 * 絞り込みの select も同じ（2026-10-05）。描画した値を data-rendered-value に、URL の項目名を data-adopt-param に持たせる。
 * マウントの時点で値が描画した値と違う select（hydration の前に選ばれた）があれば、まとめて 1 回の画面遷移で適用する。
 */
export function useAdoptPreHydrationSelects(container: RefObject<HTMLElement | null>, apply: (next: Record<string, string | null>) => void): void {
  useEffect(() => {
    const next: Record<string, string | null> = {};
    for (const el of container.current?.querySelectorAll<HTMLSelectElement>("select[data-adopt-param]") ?? []) {
      const param = el.dataset.adoptParam;
      if (param && el.value !== (el.dataset.renderedValue ?? "")) next[param] = el.value || null;
    }
    if (Object.keys(next).length > 0) apply(next);
    // マウントの時だけ確認する。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
