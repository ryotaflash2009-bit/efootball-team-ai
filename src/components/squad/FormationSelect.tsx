"use client";

import { FORMATIONS } from "@/lib/squad/formations";
import { useT } from "@/lib/i18n/LocaleContext";

export function FormationSelect({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (formationId: string) => void;
  id?: string;
}) {
  const t = useT();
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={t("formationSelect", "ariaLabel")}
      className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
    >
      {FORMATIONS.map((f) => (
        <option key={f.id} value={f.id}>
          {f.name}
        </option>
      ))}
    </select>
  );
}
