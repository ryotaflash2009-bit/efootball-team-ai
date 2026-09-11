import type { ReactElement, SVGProps } from "react";

/**
 * インライン SVG アイコン集（外部パッケージなし）。
 * stroke ベース・currentColor。24x24 グリッド。
 */
export type IconName =
  | "home"
  | "players"
  | "managers"
  | "compare"
  | "squad"
  | "tier"
  | "pack"
  | "community"
  | "search"
  | "filter"
  | "chevron-right"
  | "chevron-left"
  | "chevron-down"
  | "close"
  | "menu"
  | "plus"
  | "minus"
  | "check"
  | "arrow-right"
  | "arrow-left"
  | "sparkles"
  | "shirt"
  | "whistle"
  | "shield"
  | "grid"
  | "list"
  | "info"
  | "warning"
  | "external"
  | "refresh"
  | "star"
  | "trophy"
  | "database"
  | "sliders"
  | "swap"
  | "trash"
  | "copy"
  | "pencil"
  | "collapse"
  | "expand";

const PATHS: Record<IconName, ReactElement> = {
  home: <path d="M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5" />,
  players: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20c.7-3.3 3-5 5.5-5s4.8 1.7 5.5 5" />
      <path d="M16 5.2A3 3 0 0 1 16 11M20.5 20c-.4-2-1.3-3.4-2.6-4.2" />
    </>
  ),
  managers: (
    <>
      <circle cx="12" cy="7" r="3.4" />
      <path d="M5 20c.8-3.8 3.4-5.8 7-5.8s6.2 2 7 5.8" />
      <path d="M12 3v1.2M8.8 4.2l.6 1M15.2 4.2l-.6 1" />
    </>
  ),
  compare: (
    <>
      <path d="M12 3v18" />
      <path d="M6 7 3 12l3 5M18 7l3 5-3 5" />
      <path d="M3.5 12H8M16 12h4.5" />
    </>
  ),
  squad: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="2" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M3.5 12h3.5M17 12h3.5M12 3.5v3.2M12 17.3v3.2" />
    </>
  ),
  tier: (
    <>
      <path d="M4 6h16M4 12h16M4 18h16" />
      <rect x="4" y="4" width="4" height="4" rx="1" />
    </>
  ),
  pack: (
    <>
      <path d="M12 3 3 7.5v9L12 21l9-4.5v-9L12 3Z" />
      <path d="M3 7.5 12 12l9-4.5M12 12v9" />
    </>
  ),
  community: (
    <>
      <circle cx="8" cy="9" r="2.6" />
      <circle cx="16" cy="9" r="2.6" />
      <path d="M3.5 19c.6-2.8 2.4-4.2 4.5-4.2S12 16.2 12.5 19M11.5 19c.6-2.8 2.4-4.2 4.5-4.2s3.9 1.4 4.5 4.2" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-3.6-3.6" />
    </>
  ),
  filter: <path d="M4 5h16l-6 7.5V20l-4-2v-5.5L4 5Z" />,
  "chevron-right": <path d="m9 5 7 7-7 7" />,
  "chevron-left": <path d="m15 5-7 7 7 7" />,
  "chevron-down": <path d="m5 9 7 7 7-7" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  check: <path d="m5 13 4 4L19 7" />,
  "arrow-right": <path d="M5 12h14M13 5l7 7-7 7" />,
  "arrow-left": <path d="M19 12H5M11 5l-7 7 7 7" />,
  sparkles: (
    <>
      <path d="M12 4.5 13.6 9 18 10.5 13.6 12 12 16.5 10.4 12 6 10.5 10.4 9 12 4.5Z" />
      <path d="M18.5 4v3M20 5.5h-3M6 16v3M7.5 17.5h-3" />
    </>
  ),
  shirt: <path d="M8 3 4 6l2 3 1-.7V21h10V8.3l1 .7 2-3-4-3-1.5 1.5a3 3 0 0 1-5 0L8 3Z" />,
  whistle: (
    <>
      <path d="M3 12a5 5 0 0 0 5 5h4l6 3v-6a6 6 0 0 0-6-6H8a5 5 0 0 0-5 4Z" />
      <path d="M14 3v4M17 4l-2 3M11 4l2 3" />
    </>
  ),
  shield: <path d="M12 3 5 5.5v6c0 4.5 3 7.7 7 9 4-1.3 7-4.5 7-9v-6L12 3Z" />,
  grid: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </>
  ),
  list: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
  warning: (
    <>
      <path d="M12 4 2.5 20h19L12 4Z" />
      <path d="M12 10v4M12 17h.01" />
    </>
  ),
  external: <path d="M14 4h6v6M20 4l-9 9M18 14v5H5V6h5" />,
  refresh: <path d="M4 12a8 8 0 0 1 13.7-5.6L20 8M20 4v4h-4M20 12a8 8 0 0 1-13.7 5.6L4 16M4 20v-4h4" />,
  star: <path d="m12 4 2.5 5.2 5.5.8-4 3.9 1 5.6L12 17l-5 2.5 1-5.6-4-3.9 5.5-.8L12 4Z" />,
  trophy: (
    <>
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M9 20h6M12 14v6" />
    </>
  ),
  database: (
    <>
      <ellipse cx="12" cy="5.5" rx="7.5" ry="3" />
      <path d="M4.5 5.5v13c0 1.6 3.4 3 7.5 3s7.5-1.4 7.5-3v-13M4.5 12c0 1.6 3.4 3 7.5 3s7.5-1.4 7.5-3" />
    </>
  ),
  sliders: <path d="M4 8h10M18 8h2M4 16h4M12 16h8M14 5v6M8 13v6" />,
  swap: <path d="M7 4 4 7l3 3M4 7h11M17 20l3-3-3-3M20 17H9" />,
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />,
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M4 16V4h12" />
    </>
  ),
  pencil: <path d="M4 20h4L20 8l-4-4L4 16v4ZM14 6l4 4" />,
  collapse: <path d="M9 5 4 12l5 7M20 12H5" />,
  expand: <path d="m15 5 5 7-5 7M4 12h15" />,
};

/** テスト・ツール用: 定義済みアイコン名の一覧。 */
export const ICON_NAMES = Object.keys(PATHS) as IconName[];
export function iconHasPath(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(PATHS, name);
}

export function Icon({
  name,
  size = 20,
  className,
  ...rest
}: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
