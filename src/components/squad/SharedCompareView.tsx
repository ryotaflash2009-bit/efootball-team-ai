"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { buttonClasses } from "@/components/ui/Button";
import { DiagnosisComparisonCard, useCompareTexts } from "./DiagnosisComparisonCard";
import { decodeCompareShare, type CompareShareDecode } from "@/lib/squad/diagnosis-compare";

/** 共有された改善前後の比較（読み取り専用・fragment だけから復元・サーバー通信なし）。 */
export function SharedCompareView() {
  const { c } = useCompareTexts();
  const [state, setState] = useState<CompareShareDecode | null>(null);

  useEffect(() => {
    const read = () => setState(decodeCompareShare(window.location.hash));
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  if (!state) {
    return (
      <p role="status" className="mt-6 text-sm text-text-dim">
        {c("loading")}
      </p>
    );
  }
  if (!state.ok) {
    const body =
      state.reason === "unsupported_version" ? c("unsupportedBody") : state.reason === "empty" ? c("emptyBody") : state.reason === "rules_mismatch" ? c("rulesMismatch") : c("invalidBody");
    return (
      <div className="mt-6" data-share-state="error" data-share-reason={state.reason}>
        <PageHeader title={c("invalidTitle")} icon="squad" />
        <p className="mt-4 text-sm text-text-dim">{body}</p>
        <Link href="/" className={`${buttonClasses("secondary", "sm")} mt-4`}>
          {c("openSite")}
        </Link>
      </div>
    );
  }
  return (
    <div className="mt-6 flex flex-col gap-4" data-share-state="ok">
      <PageHeader title={c("pageTitle")} icon="squad" />
      <DiagnosisComparisonCard comparison={state.comparison} />
      <p className="text-2xs text-text-muted">{c("viewerNote")}</p>
      <Link href="/" className={`${buttonClasses("secondary", "sm")} self-start`}>
        {c("openSite")}
      </Link>
    </div>
  );
}
