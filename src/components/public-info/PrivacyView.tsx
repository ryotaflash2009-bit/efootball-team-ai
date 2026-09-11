"use client";

import { useT } from "@/lib/i18n/LocaleContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { Surface } from "@/components/ui/Surface";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";

type PrivacyKey = keyof Dictionary["privacy"];

export function PrivacyView() {
  const t = useT();
  const tp = (key: PrivacyKey) => t("privacy", key);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={tp("heading")} icon="shield" description={tp("intro")} />

      <Surface tone="inset" padding="sm" className="text-xs text-warning">
        {tp("draftNotice")}
      </Surface>

      <Surface padding="md">
        <p className="text-sm font-semibold text-text">{tp("dataStoredHeading")}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-dim">
          <li>{tp("dataStoredFavorites")}</li>
          <li>{tp("dataStoredMyTeam")}</li>
          <li>{tp("dataStoredOwnershipStatus")}</li>
          <li>{tp("dataStoredSavedBuilds")}</li>
          <li>{tp("dataStoredAllocation")}</li>
          <li>{tp("dataStoredBuildIntent")}</li>
          <li>{tp("dataStoredSavedSquads")}</li>
          <li>{tp("dataStoredJsonImportContent")}</li>
          <li>{tp("dataStoredUiSettings")}</li>
        </ul>
      </Surface>

      <Surface tone="inset" padding="md">
        <p className="text-sm font-semibold text-text">{tp("dataNotStoredHeading")}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-dim">
          <li>{tp("dataNotStoredName")}</li>
          <li>{tp("dataNotStoredEmail")}</li>
          <li>{tp("dataNotStoredAddress")}</li>
          <li>{tp("dataNotStoredPhone")}</li>
          <li>{tp("dataNotStoredPayment")}</li>
          <li>{tp("dataNotStoredPassword")}</li>
          <li>{tp("dataNotStoredAccount")}</li>
          <li>{tp("dataNotStoredAiConversation")}</li>
          <li>{tp("dataNotStoredFreeformOldInput")}</li>
          <li>{tp("dataNotStoredDiagnosisPng")}</li>
          <li>{tp("dataNotStoredBestXiResults")}</li>
        </ul>
      </Surface>

      <Surface padding="md">
        <p className="text-sm font-semibold text-text">{tp("storageLocationHeading")}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-dim">
          <li>{tp("storageLocationBrowserOnly")}</li>
          <li>{tp("storageLocationNoServerAccount")}</li>
          <li>{tp("storageLocationNoSync")}</li>
          <li>{tp("storageLocationNoAutoMigration")}</li>
          <li>{tp("storageLocationNoCloudBackup")}</li>
          <li className="text-warning">{tp("storageLocationDeletionRisk")}</li>
        </ul>
      </Surface>

      <Surface padding="md">
        <p className="text-sm font-semibold text-text">{tp("externalTransmissionHeading")}</p>
        <p className="mt-2 text-xs font-semibold text-text-dim">{tp("externalTransmissionInAppApiIntro")}</p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-text-dim">
          <li>{tp("externalTransmissionInAppApiWorldData")}</li>
          <li>{tp("externalTransmissionInAppApiImageProxy")}</li>
        </ul>
        <p className="mt-3 text-xs font-semibold text-text-dim">{tp("externalTransmissionBrowserOnlyIntro")}</p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-text-dim">
          <li>{tp("externalTransmissionNoThirdParty")}</li>
          <li>{tp("externalTransmissionNoGenerativeAi")}</li>
          <li>{tp("externalTransmissionNoAnalytics")}</li>
          <li>{tp("externalTransmissionNoAds")}</li>
        </ul>
      </Surface>

      <Surface tone="outline" padding="sm" className="text-sm text-text-dim">
        <p className="text-xs font-semibold text-text">{tp("cookieHeading")}</p>
        <p className="mt-1">{tp("cookieBody")}</p>
      </Surface>

      <Surface tone="outline" padding="sm" className="text-sm text-text-dim">
        <p className="text-xs font-semibold text-text">{tp("futureChangesHeading")}</p>
        <p className="mt-1">{tp("futureChangesBody")}</p>
      </Surface>

      <p className="text-2xs text-text-muted">{tp("specialistReviewNotice")}</p>
    </div>
  );
}
