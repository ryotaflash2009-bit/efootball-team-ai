"use client";

import { useCallback, useRef, useState } from "react";
import { resolveCardImageSources } from "@/lib/world/image";
import { WorldCardImage } from "@/components/world/WorldCardImage";
import {
  calculateSnapCandidate,
  DEFAULT_SNAP_SETTINGS,
  type AlignGuide,
  type PlacementRef,
  type SnapSettings,
} from "@/lib/squad/position-snapping";
import type { SquadSlotResult, CompatibilityStatus } from "@/lib/squad/types";
import { useT } from "@/lib/i18n/LocaleContext";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";

const COMPAT_DOT: Record<CompatibilityStatus, string> = {
  exact: "bg-accent",
  related: "bg-yellow-300",
  unresolved: "bg-yellow-300",
  gkMismatch: "bg-danger",
  empty: "bg-border",
};

function useCompatTitles(): Record<CompatibilityStatus, string> {
  const t = useT();
  return {
    exact: t("squadPitch", "compatExactTitle"),
    related: t("squadPitch", "compatRelatedTitle"),
    unresolved: t("squadPitch", "compatUnresolvedTitle"),
    gkMismatch: t("squadPitch", "compatMismatchTitle"),
    empty: t("squadPitch", "compatEmptyTitle"),
  };
}

export interface SquadPitchSnapContext {
  placements: PlacementRef[];
  settings: SnapSettings;
  showGuides: boolean;
  showGrid: boolean;
}

/**
 * ピッチ。スロット座標は formation 定義 or 保存済み x/y(%) をそのまま使う。
 * 縦長（aspect 68:105）・攻撃方向が上。タップ/クリックで選択、ドラッグで自由配置。
 */
export function SquadPitch({
  slots,
  selectedSlotId,
  onSlotClick,
  moveActive = false,
  moveSourceSlotId = null,
  onSlotDragStart,
  onSlotDrop,
  onFreeDrop,
  posAdjustSlotId = null,
  snapContext,
}: {
  slots: SquadSlotResult[];
  selectedSlotId: string | null;
  onSlotClick: (slotId: string) => void;
  moveActive?: boolean;
  moveSourceSlotId?: string | null;
  onSlotDragStart?: (slotId: string) => void;
  onSlotDrop?: (slotId: string) => void;
  /** ピッチ内の任意座標へドロップ / タップ（正規化 0–100・y=0 が前線）。opts.disableSnap は Alt キー。 */
  onFreeDrop?: (x: number, y: number, opts?: { disableSnap?: boolean }) => void;
  posAdjustSlotId?: string | null;
  /** 配置補助（スナップ・ガイド・グリッド） */
  snapContext?: SquadPitchSnapContext;
}) {
  const t = useT();
  const compatTitles = useCompatTitles();
  const fillSp = (s: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((acc, [key, val]) => acc.replace(`{${key}}`, val), s);
  const guideLabel = useCallback(
    (kind: string): string =>
      kind === "horizontal"
        ? t("squadPitch", "guideHorizontalLabel")
        : kind === "center"
          ? t("squadPitch", "guideCenterLabel")
          : kind === "symmetry"
            ? t("squadPitch", "guideSymmetryLabel")
            : kind,
    [t],
  );
  const [preview, setPreview] = useState<{
    x: number;
    y: number;
    guides: AlignGuide[];
    snapApplied: boolean;
    label: string;
  } | null>(null);
  const rafRef = useRef<number | null>(null);

  const toNorm = (ev: { clientX: number; clientY: number; currentTarget: HTMLElement }) => {
    const r = ev.currentTarget.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return null;
    const x = ((ev.clientX - r.left) / r.width) * 100;
    const y = ((ev.clientY - r.top) / r.height) * 100;
    return { x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)) };
  };

  const settings = snapContext?.settings ?? DEFAULT_SNAP_SETTINGS;
  const previewSlot = slots.find((s) => s.slotId === moveSourceSlotId);

  function schedulePreview(clientX: number, clientY: number, container: HTMLElement, altKey: boolean) {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const r = container.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      const rawX = Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100));
      const rawY = Math.min(100, Math.max(0, ((clientY - r.top) / r.height) * 100));
      const snap = calculateSnapCandidate({
        movingSlotId: moveSourceSlotId ?? "",
        proposedX: rawX,
        proposedY: rawY,
        existingPlacements: snapContext?.placements ?? [],
        settings,
        disableSnap: altKey,
      });
      setPreview({
        x: snap.x,
        y: snap.y,
        guides: snap.guides,
        snapApplied: snap.snapApplied,
        label: snap.snapApplied
          ? fillSp(t("squadPitch", "snapLabelTemplate"), { types: snap.snapTypes.map(guideLabel).join(" / ") })
          : t("squadPitch", "freePlacementLabel"),
      });
    });
  }
  const clearPreview = () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setPreview(null);
  };

  const showGuides = snapContext?.showGuides ?? false;
  const showGrid = snapContext?.showGrid ?? false;

  return (
    <div className="mx-auto w-full max-w-[600px]">
      <div
        className={`pitch-turf relative aspect-[68/105] w-full overflow-hidden rounded-lg border ${
          posAdjustSlotId ? "border-accent ring-2 ring-accent/50" : "border-border-strong"
        }`}
        onDragOver={(ev) => {
          if (!onFreeDrop) return;
          ev.preventDefault();
          schedulePreview(ev.clientX, ev.clientY, ev.currentTarget, ev.altKey);
        }}
        onDragLeave={clearPreview}
        onDrop={(ev) => {
          if (!onFreeDrop) return;
          ev.preventDefault();
          const alt = ev.altKey;
          clearPreview();
          const n = toNorm(ev);
          if (n) onFreeDrop(n.x, n.y, { disableSnap: alt });
        }}
        onClick={(ev) => {
          if (!posAdjustSlotId || !onFreeDrop) return;
          const n = toNorm(ev);
          if (n) onFreeDrop(n.x, n.y);
        }}
      >
        {/* ピッチのライン（装飾） */}
        <div className="pointer-events-none absolute inset-3 rounded border border-white/20" />
        <div className="pointer-events-none absolute left-3 right-3 top-1/2 h-px bg-white/20" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20" />
        <div className="pointer-events-none absolute left-1/2 top-3 h-10 w-28 -translate-x-1/2 border border-white/20" />
        <div className="pointer-events-none absolute bottom-3 left-1/2 h-10 w-28 -translate-x-1/2 border border-white/20" />

        {/* 配置グリッド（10% 刻み・カードより背面・操作を邪魔しない） */}
        {showGrid ? (
          <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
            {[10, 20, 30, 40, 60, 70, 80, 90].map((p) => (
              <div key={`v${p}`} className="absolute top-0 bottom-0 w-px bg-white/5" style={{ left: `${p}%` }} />
            ))}
            {[10, 20, 30, 40, 50, 60, 70, 80, 90].map((p) => (
              <div key={`h${p}`} className="absolute left-0 right-0 h-px bg-white/5" style={{ top: `${p}%` }} />
            ))}
          </div>
        ) : null}

        {/* 中央線（常時ごく薄く） */}
        <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-white/10" aria-hidden />

        {/* 整列ガイド（ドラッグ中・showGuides） */}
        {showGuides && preview
          ? preview.guides.map((g, i) => (
              <div
                key={`${g.kind}-${i}`}
                className={`pointer-events-none absolute z-30 ${
                  g.kind === "horizontal" ? "left-0 right-0 h-px" : "inset-y-0 w-px"
                } ${g.kind === "symmetry" ? "bg-yellow-300/70" : g.kind === "center" ? "bg-accent/70" : "bg-accent/60"}`}
                style={g.kind === "horizontal" ? { top: `${g.at}%` } : { left: `${g.at}%` }}
              >
                <span
                  className={`absolute rounded bg-black/75 px-1 text-[8px] text-white ${
                    g.kind === "horizontal" ? "left-1 -translate-y-1/2" : "top-1 left-1"
                  }`}
                >
                  {g.label}
                </span>
              </div>
            ))
          : null}

        {/* ドラッグ中の候補位置ゴースト */}
        {preview && previewSlot ? (
          <div
            className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${preview.x}%`, top: `${preview.y}%` }}
          >
            <span
              className={`block w-11 overflow-hidden rounded border-2 sm:w-12 ${
                preview.snapApplied ? "border-accent" : "border-white/70"
              } opacity-60`}
            >
              {previewSlot.entry ? (
                <WorldCardImage
                  sources={resolveCardImageSources({
                    worldCardId: previewSlot.entry.display.worldCardId,
                    efhubCardId: previewSlot.entry.display.efhubCardId,
                    hasEfhubLink: previewSlot.entry.display.hasEfhubLink,
                    hasWorldImage: previewSlot.entry.display.imageUrlCandidate != null,
                    hasWorldMobileImage: previewSlot.entry.display.mobileImageUrlCandidate != null,
                  })}
                  alt=""
                  size="card"
                />
              ) : (
                <span className="block aspect-[3/4] w-full bg-surface-2" />
              )}
            </span>
            <span className="mt-0.5 block rounded bg-black/80 px-1 text-center text-[8px] text-white">
              {preview.label}
            </span>
          </div>
        ) : null}

        {slots.map((s) => {
          const selected = s.slotId === selectedSlotId;
          const isMoveSource = moveActive && s.slotId === moveSourceSlotId;
          const isMoveTarget = moveActive && s.slotId !== moveSourceSlotId;
          const e = s.entry;
          const img = e
            ? resolveCardImageSources({
                worldCardId: e.display.worldCardId,
                efhubCardId: e.display.efhubCardId,
                hasEfhubLink: e.display.hasEfhubLink,
                hasWorldImage: e.display.imageUrlCandidate != null,
                hasWorldMobileImage: e.display.mobileImageUrlCandidate != null,
              })
            : [];
          const name = e
            ? e.display.nameJa ||
              e.display.nameEn ||
              fillSp(t("squadBuildPanel", "cardFallbackNameTemplate"), { id: e.display.worldCardId })
            : null;
          return (
            <button
              key={s.slotId}
              type="button"
              onClick={(ev) => {
                if (posAdjustSlotId) ev.stopPropagation();
                onSlotClick(s.slotId);
              }}
              draggable={!!e && !!onSlotDragStart}
              onDragStart={() => onSlotDragStart?.(s.slotId)}
              onDragEnd={clearPreview}
              onDragOver={(ev) => {
                if (onSlotDrop) ev.preventDefault();
              }}
              onDrop={(ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                clearPreview();
                onSlotDrop?.(s.slotId);
              }}
              aria-label={
                (isMoveTarget
                  ? t("squadPitch", "moveTargetPrefix")
                  : isMoveSource
                    ? t("squadPitch", "moveSourcePrefix")
                    : "") +
                (e
                  ? fillSp(t("squadPitch", "occupiedSlotAriaTemplate"), {
                      position: s.position,
                      name: name ?? "",
                      compat: compatTitles[s.compatibility.status],
                    }) + (isMoveTarget ? t("squadPitch", "moveTargetSwapSuffix") : "")
                  : fillSp(t("squadPitch", "emptySlotAriaTemplate"), { position: s.position }) +
                    (isMoveTarget ? t("squadPitch", "moveTargetMoveHereLabel") : t("squadPitch", "addPlayerLabel")))
              }
              style={{ left: `${s.x}%`, top: `${s.y}%` }}
              className={`absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center ${
                selected || isMoveSource ? "z-20" : "z-10"
              } ${isMoveTarget ? "rounded ring-2 ring-accent/60" : ""} ${isMoveSource ? "opacity-40" : ""}`}
            >
              {e ? (
                <span
                  className={`relative block w-11 overflow-hidden rounded border sm:w-12 ${
                    selected || isMoveSource ? "border-accent ring-2 ring-accent" : "border-white/40"
                  }`}
                >
                  <WorldCardImage sources={img} alt={name ?? ""} size="card" />
                  <span className="absolute left-0 top-0 rounded-br bg-black/75 px-1 text-[10px] font-black leading-tight text-accent">
                    {e.displayedOvr ?? e.baseOvr ?? "–"}
                  </span>
                  <span
                    className={`absolute right-0 top-0 h-2 w-2 rounded-bl ${COMPAT_DOT[s.compatibility.status]}`}
                    title={compatTitles[s.compatibility.status]}
                  />
                  {s.isCaptain ? (
                    <span className="absolute bottom-0 left-0 rounded-tr bg-accent px-1 text-[9px] font-black text-accent-ink">
                      C
                    </span>
                  ) : null}
                </span>
              ) : (
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded border border-dashed text-lg sm:h-12 sm:w-12 ${
                    selected ? "border-accent text-accent" : "border-white/40 text-white/60"
                  }`}
                >
                  ＋
                </span>
              )}
              <span className="mt-0.5 max-w-[60px] truncate rounded bg-black/70 px-1 text-[9px] leading-tight text-white">
                {s.position}
                {name ? ` · ${name}` : ""}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
