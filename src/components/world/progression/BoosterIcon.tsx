import type { BoosterActivationType } from "@/lib/progression/types";

/**
 * カード付属ブースターの独自アイコン（インライン SVG・外部画像/パッケージなし）。
 * eFHUB のロゴは複製しない。Team AI デザインシステムの色トークンに合わせた六角形 + 抽象記号。
 *
 * 色だけで種別を区別させない前提。呼び出し側は必ずラベル文字も併記する。
 * ここでも role="img" + aria-label を持たせ、枠線・内部記号でも区別する。
 */
export type BoosterIconVariant =
  | "fixed"
  | "power_of_many"
  | "live_update"
  | "unresolved"
  | "provisional";

const META: Record<BoosterIconVariant, { label: string; ring: string; text: string; fill: string }> = {
  fixed: {
    label: "固定ブースター",
    ring: "border-info/50",
    text: "text-info",
    fill: "bg-info/10",
  },
  power_of_many: {
    label: "Power of Many（金色・可変）ブースター",
    ring: "border-warning/60",
    text: "text-warning",
    fill: "bg-warning/10",
  },
  live_update: {
    label: "Live Update 連動ブースター",
    ring: "border-border-strong",
    text: "text-text-dim",
    fill: "bg-surface-3",
  },
  unresolved: {
    label: "未解決ブースター",
    ring: "border-border-strong",
    text: "text-text-muted",
    fill: "bg-surface-2",
  },
  provisional: {
    label: "効果検証中ブースター",
    ring: "border-border-strong",
    text: "text-text-dim",
    fill: "bg-surface-3",
  },
};

/** 内部記号（stroke ベース・currentColor）。種別ごとに形が違う。 */
function Glyph({ variant }: { variant: BoosterIconVariant }) {
  switch (variant) {
    case "fixed":
      // 上向き矢印（固定量の上昇）
      return <path d="M12 16.5v-8M8.5 12 12 8.5 15.5 12" />;
    case "power_of_many":
      // 三段の上昇バー（人数で段階が変わる）
      return <path d="M8 16.5v-2.5M12 16.5v-5M16 16.5v-7.5" />;
    case "live_update":
      // 波形（実データ連動）
      return <path d="M7 13.5c1.5 0 1.5-3 3-3s1.5 3 3 3 1.5-3 3-3" />;
    case "unresolved":
      // 疑問符
      return <path d="M9.6 10a2.4 2.4 0 1 1 3.3 2.2c-.8.4-1.4 1-1.4 2M11.5 16.4h.01" />;
    case "provisional":
      // 波ダッシュ（暫定）
      return <path d="M7.5 12.5c1-1.4 2-1.4 3 0s2 1.4 3 0 2-1.4 3 0" />;
  }
}

export function boosterIconVariant(input: {
  activationType?: BoosterActivationType;
  resolved: boolean;
  autoApplied: boolean;
  evidenceLevel?: string;
}): BoosterIconVariant {
  if (input.activationType === "power_of_many") return "power_of_many";
  if (!input.resolved) return "unresolved";
  if (input.autoApplied) return "fixed";
  return "provisional";
}

export function BoosterIcon({
  variant,
  size = 22,
  className = "",
}: {
  variant: BoosterIconVariant;
  size?: number;
  className?: string;
}) {
  const m = META[variant];
  return (
    <span
      role="img"
      aria-label={m.label}
      className={`inline-grid shrink-0 place-items-center rounded-md border ${m.ring} ${m.fill} ${m.text} ${className}`}
      style={{ width: size + 8, height: size + 8 }}
    >
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 2.6 20.5 7.3v9.4L12 21.4 3.5 16.7V7.3z" />
        <Glyph variant={variant} />
      </svg>
    </span>
  );
}
