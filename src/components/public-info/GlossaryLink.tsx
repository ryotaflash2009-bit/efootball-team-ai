"use client";

import "@/lib/i18n/dictionaries/ja-ns/glossary";
import Link from "next/link";
import { useT } from "@/lib/i18n/LocaleContext";
import { Icon } from "@/components/ui/Icon";

/** 用語集の該当の項目へのリンク（2026-10-20）。anchor は GlossaryView の GLOSSARY_TERMS の id。 */
export function GlossaryLink({ anchor, className = "" }: { anchor: string; className?: string }) {
  const t = useT();
  return (
    <Link href={`/glossary#${anchor}`} className={`inline-flex w-fit items-center gap-1 text-xs text-accent hover:underline ${className}`} data-testid="glossary-link">
      <Icon name="info" size={12} />
      {t("glossary", "linkLabel")}
    </Link>
  );
}
