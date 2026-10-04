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
