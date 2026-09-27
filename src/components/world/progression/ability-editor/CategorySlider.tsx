"use client";

import { useRef, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { levelForKey, levelFromRatio, type GroupSliderModel } from "@/lib/progression/ability-direct-editor";

/**
 * 育成カテゴリの横スライダー（値 = カテゴリレベル。消費ポイントではない）。
 *
 * - 指・マウスのドラッグで複数レベルを一気に動かす。整数レベルへ snap し、到達可能上限で止まる。
 * - ドラッグ中はプレビューだけを更新し、指を離したときにビルドへ反映する（onDragEnd）。
 * - pointercancel（縦スクロールへの移行など）はドラッグを取り消して元のレベルへ戻す。
 * - touch-action: pan-y で縦スクロールはブラウザーに任せ、横方向の操作だけをスライダーが受け取る。
 * - キーボード: ← → ↑ ↓ で ±1、Home で 0、End で到達可能上限（すぐに反映）。
 */
export function CategorySlider({
  model,
  level,
  dragging,
  blocked,
  disabled,
  label,
  valueText,
  describedBy,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
  onKeyLevel,
}: {
  model: GroupSliderModel;
  /** 表示するレベル（ドラッグ中はプレビュー）。 */
  level: number;
  dragging: boolean;
  blocked: boolean;
  disabled: boolean;
  label: string;
  valueText: string;
  describedBy?: string;
  onDragStart: (level: number) => void;
  onDragMove: (requestedLevel: number) => void;
  /** 指を離した時点で要求されたレベル（最新のポインター位置。描画待ちの値に依存しない）。 */
  onDragEnd: (requestedLevel: number) => void;
  onDragCancel: () => void;
  onKeyLevel: (level: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const rectRef = useRef<{ left: number; width: number } | null>(null);
  const activePointer = useRef<number | null>(null);
  const lastRequested = useRef<number>(model.current);
  const max = Math.max(model.absoluteMax, 1);
  const pct = (v: number) => `${(Math.min(Math.max(v, 0), max) / max) * 100}%`;
  const inactive = disabled || model.absoluteMax <= 0;

  const requestedFrom = (clientX: number) => {
    const r = rectRef.current;
    if (!r || r.width <= 0) return model.current;
    return levelFromRatio((clientX - r.left) / r.width, model.absoluteMax);
  };

  function handlePointerDown(e: PointerEvent<HTMLDivElement>) {
    if (inactive || (e.pointerType === "mouse" && e.button !== 0)) return;
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    rectRef.current = { left: rect.left, width: rect.width };
    activePointer.current = e.pointerId;
    el.setPointerCapture?.(e.pointerId);
    onDragStart(model.current);
    lastRequested.current = requestedFrom(e.clientX);
    onDragMove(lastRequested.current);
  }
  function handlePointerMove(e: PointerEvent<HTMLDivElement>) {
    if (activePointer.current !== e.pointerId) return;
    lastRequested.current = requestedFrom(e.clientX);
    onDragMove(lastRequested.current);
  }
  function finish(e: PointerEvent<HTMLDivElement>, commit: boolean) {
    if (activePointer.current !== e.pointerId) return;
    activePointer.current = null;
    rectRef.current = null;
    if (commit) onDragEnd(lastRequested.current);
    else onDragCancel();
  }
  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (inactive) return;
    const next = levelForKey(e.key, model);
    if (next == null) return;
    e.preventDefault();
    if (next !== model.current) onKeyLevel(next);
  }

  const style = { touchAction: "pan-y" } as CSSProperties;

  return (
    <div
      className="cat-slider relative min-w-0 flex-1 select-none"
      data-dragging={dragging ? "true" : "false"}
      data-blocked={blocked ? "true" : "false"}
    >
      <div
        ref={trackRef}
        role="slider"
        tabIndex={inactive ? -1 : 0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={model.absoluteMax}
        aria-valuenow={level}
        aria-valuetext={valueText}
        aria-describedby={describedBy}
        aria-disabled={inactive || undefined}
        data-testid="category-slider"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(e) => finish(e, true)}
        onPointerCancel={(e) => finish(e, false)}
        onLostPointerCapture={(e) => finish(e, true)}
        onKeyDown={handleKeyDown}
        style={style}
        className={`relative h-11 cursor-pointer rounded-md outline-none ${inactive ? "cursor-not-allowed opacity-40" : ""}`}
      >
        <div className="cat-slider-track pointer-events-none absolute inset-x-0 top-1/2 h-2.5 -translate-y-1/2 overflow-hidden rounded-full">
          {model.reachableMax < model.absoluteMax ? (
            <div
              className="cat-slider-blocked absolute inset-y-0"
              style={{ left: pct(model.reachableMax), right: 0 }}
              aria-hidden="true"
            />
          ) : null}
          <div className="cat-slider-fill absolute inset-y-0 left-0 rounded-full" style={{ width: pct(level) }} />
          {level !== model.current ? (
            <div
              className="absolute inset-y-0 w-0.5 bg-text/80"
              style={{ left: pct(model.current) }}
              aria-hidden="true"
            />
          ) : null}
        </div>
        <div
          className="cat-slider-thumb pointer-events-none absolute top-1/2 h-6 w-6 rounded-full"
          style={{ left: pct(level), transform: "translate(-50%, -50%) scale(var(--thumb-scale, 1))" }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
