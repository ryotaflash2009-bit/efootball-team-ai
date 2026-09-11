"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageContainer } from "@/components/ui/PageContainer";
import { useT } from "@/lib/i18n/LocaleContext";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <PageContainer width="regular">
      <ErrorState
        title={t("pageError", "title")}
        description={t("pageError", "description")}
        onRetry={reset}
        homeHref="/"
        code={error.digest}
      />
    </PageContainer>
  );
}
