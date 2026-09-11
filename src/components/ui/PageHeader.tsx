import type { ReactNode } from "react";
import Link from "next/link";
import { Icon, type IconName } from "./Icon";

/**
 * 全ページ共通の見出し。タイトル(h1)・説明(最大幅で2行程度に回り込む)・右側の主要操作・戻る導線。
 */
export function PageHeader({
  title,
  icon,
  description,
  actions,
  backHref,
  backLabel,
  meta,
}: {
  title: string;
  icon?: IconName;
  description?: ReactNode;
  actions?: ReactNode;
  backHref?: string;
  backLabel?: string;
  /** タイトル右の小さな指標（件数など） */
  meta?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 border-b border-border pb-5">
      {backHref ? (
        <Link
          href={backHref}
          className="inline-flex w-fit items-center gap-1 text-sm text-text-dim transition-colors hover:text-accent"
        >
          <Icon name="chevron-left" size={16} />
          {backLabel ?? "戻る"}
        </Link>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            {icon ? (
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-accent-soft text-accent">
                <Icon name={icon} size={20} />
              </span>
            ) : null}
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
            {meta ? <span className="ml-1 shrink-0 text-sm text-text-dim">{meta}</span> : null}
          </div>
          {description ? (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-dim">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
