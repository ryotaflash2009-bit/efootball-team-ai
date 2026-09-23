"use client";

import { useT } from "@/lib/i18n/LocaleContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { Surface } from "@/components/ui/Surface";
import { Icon } from "@/components/ui/Icon";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";
import { resolveSupportChannels } from "@/lib/public-info/support-config";

type SupportKey = keyof Dictionary["support"];

const MAIL_LINK_CLASS =
  "inline-flex min-h-[36px] items-center gap-1.5 rounded-md border border-accent bg-accent-soft px-3 text-xs font-semibold text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent hover:brightness-110";

function buildMailtoUrl(email: string, subject: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}`;
}

export function SupportView() {
  const t = useT();
  const ts = (key: SupportKey) => t("support", key);
  const channels = resolveSupportChannels();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={ts("heading")} icon="info" description={ts("intro")} />

      {!channels.hasAnyChannel ? (
        <Surface tone="inset" padding="sm" className="flex items-start gap-2 text-sm text-warning">
          <Icon name="warning" size={16} className="mt-0.5 shrink-0" />
          <span>{ts("notConfiguredNotice")}</span>
        </Surface>
      ) : (
        <Surface tone="inset" padding="md">
          <p className="text-sm text-text-dim">{ts("sharedChannelIntro")}</p>
          <p className="mt-2 text-xs font-semibold text-text-dim">{ts("sharedChannelEmailLabel")}</p>
          <p className="mt-0.5 break-all text-sm font-semibold text-text">{channels.supportEmail}</p>
        </Surface>
      )}

      {channels.hasAnyChannel ? (
        <Surface tone="outline" padding="sm">
          <p className="text-xs font-semibold text-text-dim">{ts("safetyNoticeHeading")}</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-xs text-text-dim">
            <li>{ts("safetyNoPassword")}</li>
            <li>{ts("safetyNoAuthCode")}</li>
            <li>{ts("safetyNoRecoveryCode")}</li>
            <li>{ts("safetyNoPaymentInfo")}</li>
            <li>{ts("safetyNoUnnecessaryPersonalInfo")}</li>
          </ul>
        </Surface>
      ) : null}

      <Surface tone="inset" padding="md">
        <p className="text-sm font-semibold text-text">{ts("betaLimitsHeading")}</p>
        <p className="mt-1.5 text-sm text-text-dim">{ts("betaLimitsIntro")}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-dim">
          <li>{ts("betaLimitData")}</li>
          <li>{ts("betaLimitStorage")}</li>
          <li>{ts("betaLimitRecommendation")}</li>
          <li>{ts("betaLimitChanges")}</li>
        </ul>
        <p className="mt-2 text-sm text-text-dim">{ts("betaLimitsFeedback")}</p>
      </Surface>

      <Surface padding="md">
        <p className="text-sm font-semibold text-text">{ts("generalContactHeading")}</p>
        <p className="mt-1.5 text-sm text-text-dim">{ts("generalContactIntro")}</p>
        {channels.supportEmail ? (
          <a
            href={buildMailtoUrl(channels.supportEmail, ts("mailtoSubjectGeneral"))}
            aria-label={ts("mailtoAriaGeneral")}
            className={`${MAIL_LINK_CLASS} mt-2`}
          >
            <Icon name="external" size={12} />
            {ts("sendMailButtonLabel")}
          </a>
        ) : (
          <p className="mt-1.5 text-sm text-text-muted">{ts("generalContactUnset")}</p>
        )}
        {channels.issueTrackerUrl ? (
          <p className="mt-2 text-sm text-text-dim">
            {ts("issueTrackerLabel")}:{" "}
            <a href={channels.issueTrackerUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-accent hover:underline">
              {channels.issueTrackerUrl}
              <Icon name="external" size={12} className="ml-1 inline-block align-text-top" />
            </a>
          </p>
        ) : null}
      </Surface>

      <Surface tone="outline" padding="md">
        <p className="text-sm font-semibold text-text">{ts("bugReportHeading")}</p>
        <p className="mt-1.5 text-sm text-text-dim">{ts("bugReportAlphaParticipantNotice")}</p>
        <p className="mt-1.5 text-sm text-text-dim">{ts("bugReportIntro")}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-dim">
          <li>{ts("bugReportFieldPage")}</li>
          <li>{ts("bugReportFieldSteps")}</li>
          <li>{ts("bugReportFieldExpected")}</li>
          <li>{ts("bugReportFieldActual")}</li>
          <li>{ts("bugReportFieldBrowser")}</li>
          <li>{ts("bugReportFieldWidth")}</li>
          <li>{ts("bugReportFieldErrorMessage")}</li>
        </ul>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-text-muted">
          <li>{ts("bugReportNoPersonalData")}</li>
          <li>{ts("bugReportNoUnsolicitedJsonAttachment")}</li>
          <li>{ts("bugReportCheckScreenshot")}</li>
        </ul>
        {channels.supportEmail ? (
          <a
            href={buildMailtoUrl(channels.supportEmail, ts("mailtoSubjectBugReport"))}
            aria-label={ts("mailtoAriaBugReport")}
            className={`${MAIL_LINK_CLASS} mt-3`}
          >
            <Icon name="external" size={12} />
            {ts("sendMailButtonLabel")}
          </a>
        ) : null}
      </Surface>

      <Surface padding="md">
        <p className="text-sm font-semibold text-text">{ts("rightsHolderHeading")}</p>
        <p className="mt-1.5 text-sm text-text-dim">{ts("rightsHolderContactIntro")}</p>
        <p className="mt-1.5 text-sm text-text-dim">{ts("rightsHolderIntro")}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-dim">
          <li>{ts("rightsHolderFieldContent")}</li>
          <li>{ts("rightsHolderFieldUrl")}</li>
          <li>{ts("rightsHolderFieldRightType")}</li>
          <li>{ts("rightsHolderFieldContactInfo")}</li>
          <li>{ts("rightsHolderFieldRequestedAction")}</li>
          <li>{ts("rightsHolderFieldEvidence")}</li>
          <li>{ts("rightsHolderFieldReplyTo")}</li>
        </ul>
        {channels.rightsContactEmail ? (
          <a
            href={buildMailtoUrl(channels.rightsContactEmail, ts("mailtoSubjectRights"))}
            aria-label={ts("mailtoAriaRights")}
            className={`${MAIL_LINK_CLASS} mt-3`}
          >
            <Icon name="external" size={12} />
            {ts("sendMailButtonLabel")}
          </a>
        ) : (
          <p className="mt-2 text-sm text-text-muted">{ts("rightsHolderUnsetNotice")}</p>
        )}
      </Surface>

      <Surface tone="inset" padding="sm">
        <p className="text-xs font-semibold text-text-dim">{ts("privacyContactHeading")}</p>
        <p className="mt-1 text-sm text-text-dim">{ts("privacyContactIntro")}</p>
        {channels.privacyContactEmail ? (
          <a
            href={buildMailtoUrl(channels.privacyContactEmail, ts("mailtoSubjectPrivacy"))}
            aria-label={ts("mailtoAriaPrivacy")}
            className={`${MAIL_LINK_CLASS} mt-2`}
          >
            <Icon name="external" size={12} />
            {ts("sendMailButtonLabel")}
          </a>
        ) : (
          <p className="mt-1 text-sm text-text-muted">{ts("privacyContactUnsetNotice")}</p>
        )}
      </Surface>

      <p className="text-2xs text-text-muted">{ts("noSubmissionFormNotice")}</p>
      <p className="text-2xs text-text-muted">{ts("draftNotice")}</p>
    </div>
  );
}
