"use client";

import "@/lib/i18n/dictionaries/ja-ns/auth";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/LocaleContext";
import { Button, buttonClasses } from "@/components/ui/Button";
import { detectInAppBrowser, externalBrowserUrl, shareableAuthUrl, type InAppBrowserInfo } from "@/lib/auth/in-app-browser";
import { resolveSafeInternalPath } from "@/lib/supabase/safe-redirect";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";

type AuthKey = keyof Dictionary["auth"];
const isSafe = (p: string) => resolveSafeInternalPath(p, "") === p;

/**
 * アプリ内ブラウザーの案内（2026-10-11）。検出は User-Agent による推測（補助の情報）なので、ログインは止めない（Google のボタンは出したまま）。
 * - OS に合わせた手順だけを出す（iPhone では「Chrome で開く」のボタンを出さない）。LINE はブラウザーで開くリンク、Android は Chrome の intent。
 * - コピーする URL は origin＋パス＋安全な next だけ（認証のコード・callback の URL は含めない）。
 * - `force` のとき（Google の失敗の後）は、判定に関係なく一般の案内を出す。
 */
export function InAppBrowserNotice({ force = false }: { force?: boolean }) {
  const t = useT();
  const ta = (key: AuthKey) => t("auth", key);
  const [info, setInfo] = useState<InAppBrowserInfo | null>(null);
  const [href, setHref] = useState<string | null>(null);
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");
  useEffect(() => {
    setInfo(detectInAppBrowser(navigator.userAgent));
    setHref(shareableAuthUrl(window.location.href, isSafe));
  }, []);

  if (!info || !href) return null;
  if (!info.inApp && !force) return null;

  if (!info.inApp) {
    return (
      <p className="text-xs text-text-muted" data-testid="oauth-browser-hint">
        {ta("oauthFailedBrowserHint")}
      </p>
    );
  }

  const external = externalBrowserUrl(href, info);
  const steps: AuthKey = info.os === "ios" ? "inAppStepsIos" : info.os === "android" ? "inAppStepsAndroid" : "inAppStepsOther";

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(href ?? "");
      setCopy("copied");
    } catch {
      setCopy("failed");
    }
  }

  return (
    <section
      className="flex flex-col gap-2 rounded-md border border-warning/50 bg-warning/10 p-3 text-sm"
      aria-labelledby="in-app-browser-title"
      data-testid="in-app-browser-notice"
      data-in-app={info.app ?? ""}
      data-os={info.os}
    >
      <p id="in-app-browser-title" className="font-semibold text-text">
        {ta("inAppTitle")}
      </p>
      <p className="text-text-dim">{ta("inAppBody")}</p>
      <p className="text-text-dim">{ta(steps)}</p>
      <div className="flex flex-wrap gap-2">
        {external ? (
          <a href={external} className={buttonClasses("primary", "sm")} data-testid="in-app-open-external" rel="noopener">
            {info.app === "line" ? ta("inAppOpenExternalLine") : ta("inAppOpenExternal")}
          </a>
        ) : null}
        <Button type="button" variant="secondary" size="sm" onClick={handleCopy} data-testid="in-app-copy-url">
          {ta("inAppCopyUrl")}
        </Button>
      </div>
      {copy !== "idle" ? (
        <p role="status" className="text-xs text-text-dim">
          {copy === "copied" ? ta("inAppCopied") : ta("inAppCopyFailed")}
        </p>
      ) : null}
      <p className="text-xs text-text-muted">{ta("inAppAfterOpen")}</p>
    </section>
  );
}
