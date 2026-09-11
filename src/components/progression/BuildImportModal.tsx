"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SavedBuild } from "@/lib/progression/types";
import type { WorldPlayerListItem } from "@/lib/world/types";
import { generateUniqueBuildId, importBuilds, listAllBuilds } from "@/lib/progression/build-storage";
import {
  IMPORT_FORMAT_LABEL,
  IMPORT_FORMAT_VERSION_LABEL,
  MAX_IMPORT_FILE_BYTES,
  MAX_IMPORT_ITEM_COUNT,
  analyzeImport,
  reconcileImport,
  type ImportParseErrorCode,
  type ImportPlan,
} from "@/lib/progression/build-import";
import { buildAllocationRows, resolveBuildRuleStatus } from "@/lib/progression/my-builds";
import { readUploadedTextFile } from "@/lib/browser-upload";
import { Modal } from "@/components/ui/Overlay";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Surface } from "@/components/ui/Surface";
import { Icon } from "@/components/ui/Icon";
import { useT, useLocale } from "@/lib/i18n/LocaleContext";
import { resolvePlayerDisplayName } from "@/lib/i18n/display-name";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";

type Step = "select" | "error" | "preview" | "confirm" | "saving" | "done" | "savefail";

function useSafetyLines(): string[] {
  const t = useT();
  return [
    t("buildImportModal", "safetyLine1"),
    t("buildImportModal", "safetyLine2"),
    t("buildImportModal", "safetyLine3"),
    t("buildImportModal", "safetyLine4"),
    t("buildImportModal", "safetyLine5"),
    t("buildImportModal", "safetyLine6"),
    t("buildImportModal", "safetyLine7"),
  ];
}

const gen = (taken: ReadonlySet<string>) => generateUniqueBuildId(taken);

function describeParseErrorLocalized(
  code: ImportParseErrorCode,
  tim: (k: keyof Dictionary["buildImportModal"]) => string,
): string {
  switch (code) {
    case "empty":
      return tim("parseErrorEmpty");
    case "too-large":
    case "item-count-too-large":
      return tim("parseErrorTooLarge");
    case "not-json":
      return tim("parseErrorNotJson");
    case "not-object":
    case "builds-not-array":
      return tim("parseErrorNotObject");
    case "risky-keys":
    case "unknown-top-key":
      return tim("parseErrorUnsafeKeys");
    case "format-mismatch":
      return tim("parseErrorFormatMismatch");
    case "format-version-type":
    case "unsupported-version":
      return tim("parseErrorUnsupportedVersion");
    case "exported-at":
      return tim("parseErrorExportedAt");
    case "item-count":
      return tim("parseErrorItemCount");
    case "item-count-mismatch":
      return tim("parseErrorItemCountMismatch");
    default:
      return tim("parseErrorGeneric");
  }
}

export function BuildImportLauncher({
  builds,
  cards,
  available,
  stale,
  onReload,
}: {
  builds: SavedBuild[];
  cards: Map<string, WorldPlayerListItem>;
  available: boolean;
  stale: boolean;
  onReload: () => void;
}) {
  const [open, setOpen] = useState(false);
  const t = useT();
  const safetyLines = useSafetyLines();

  return (
    <Surface tone="inset" padding="sm" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{t("buildImportModal", "launcherHeading")}</p>
          <p className="mt-0.5 text-2xs text-text-muted">
            {t("buildImportModal", "launcherDescriptionPrefix")}
            <b>{t("buildImportModal", "addBoldLabel")}</b>
            {t("buildImportModal", "launcherDescriptionSuffix")}
          </p>
          <ul className="mt-1 list-disc pl-4 text-2xs text-text-muted">
            {safetyLines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
        <Button
          variant="secondary"
          size="md"
          iconLeft="sliders"
          onClick={() => setOpen(true)}
          disabled={!available}
          aria-haspopup="dialog"
        >
          {t("buildImportModal", "launcherButton")}
        </Button>
      </div>
      {!available ? (
        <p className="text-2xs text-warning">{t("buildImportModal", "unavailableNote")}</p>
      ) : null}

      {open ? (
        <BuildImportModal
          builds={builds}
          cards={cards}
          stale={stale}
          onReload={onReload}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </Surface>
  );
}

function BuildImportModal({
  builds,
  cards,
  stale,
  onReload,
  onClose,
}: {
  builds: SavedBuild[];
  cards: Map<string, WorldPlayerListItem>;
  stale: boolean;
  onReload: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const tim = useCallback((k: keyof Dictionary["buildImportModal"]) => t("buildImportModal", k), [t]);
  const fillIm = useCallback(
    (s: string, vars: Record<string, string>) => Object.entries(vars).reduce((acc, [key, val]) => acc.replace(`{${key}}`, val), s),
    [],
  );
  const [step, setStep] = useState<Step>("select");
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [fileText, setFileText] = useState<string | null>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [validateInfo, setValidateInfo] = useState<{ invalid: number; valid: number } | null>(null);
  const [duplicateIds, setDuplicateIds] = useState<string[] | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const [result, setResult] = useState<{ saved: number; newIds: number } | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const readToken = useRef(0);
  const buildsRef = useRef(builds);
  buildsRef.current = builds;

  const resetFile = useCallback(() => {
    setFileName(null);
    setFileSize(null);
    setFileText(null);
    setPlan(null);
    setErrorMsg(null);
    setValidateInfo(null);
    setDuplicateIds(null);
    setConflict(null);
  }, []);

  const runAnalyze = useCallback((text: string, current: SavedBuild[]) => {
    const res = analyzeImport(text, current, gen);
    if (res.ok) {
      setPlan(res.plan);
      setErrorMsg(null);
      setValidateInfo(null);
      setDuplicateIds(null);
      setStep("preview");
      return;
    }
    setPlan(null);
    if (res.stage === "parse") {
      setErrorMsg(describeParseErrorLocalized(res.code, tim));
      setValidateInfo(null);
      setDuplicateIds(null);
    } else if (res.stage === "validate") {
      setErrorMsg(fillIm(tim("validateErrorTemplate"), { invalid: String(res.invalidCount), valid: String(res.validCount) }));
      setValidateInfo({ invalid: res.invalidCount, valid: res.validCount });
      setDuplicateIds(null);
    } else {
      setErrorMsg(fillIm(tim("duplicateErrorTemplate"), { count: String(res.duplicateBuildIds.length) }));
      setDuplicateIds(res.duplicateBuildIds);
      setValidateInfo(null);
    }
    setStep("error");
  }, [tim, fillIm]);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    // 同じファイルを続けて選べるように入力値をクリア
    e.target.value = "";
    if (!file) return;

    const token = ++readToken.current;
    setBusy(true);
    setConflict(null);
    setErrorMsg(null);
    setStep("select");

    const read = await readUploadedTextFile(file, MAX_IMPORT_FILE_BYTES);
    if (token !== readToken.current) return; // 新しいファイルが選ばれた
    setBusy(false);

    if (!read.ok) {
      resetFile();
      setFileName(file.name);
      setFileSize(typeof file.size === "number" ? file.size : null);
      setErrorMsg(
        read.reason === "too-large"
          ? fillIm(tim("tooLargeTemplate"), { max: (MAX_IMPORT_FILE_BYTES / 1_000_000).toFixed(0) })
          : read.reason === "no-file-api"
            ? tim("noFileApiError")
            : tim("readFailedError"),
      );
      setStep("error");
      return;
    }

    setFileName(file.name);
    setFileSize(typeof file.size === "number" ? file.size : read.text.length);
    setFileText(read.text);
    runAnalyze(read.text, buildsRef.current);
  }

  // 別タブ更新後の再読込などで builds が変わったら、プレビュー/確認中は再解析する
  useEffect(() => {
    if (!fileText) return;
    if (step === "preview" || step === "confirm") {
      runAnalyze(fileText, builds);
      if (step === "confirm") setStep("preview");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [builds]);

  function handleReloadExisting() {
    onReload();
    setConflict(null);
    if (fileText) runAnalyze(fileText, listAllBuilds());
  }

  function pickAnotherFile() {
    resetFile();
    setStep("select");
    // input は resetFile 後に開く
    setTimeout(() => inputRef.current?.click(), 0);
  }

  function doImport() {
    if (!plan || busy || stale) return;
    setBusy(true);
    setStep("saving");
    setConflict(null);
    setErrorMsg(null);

    const fresh = listAllBuilds();
    const rec = reconcileImport(plan, fresh, gen);
    if (!rec.ok) {
      setBusy(false);
      setConflict(
        fillIm(tim("importConflictTemplate"), {
          added: String(rec.addedExisting.length),
          removed: String(rec.removedExisting.length),
          changed: String(rec.changedExisting.length),
        }),
      );
      runAnalyze(fileText ?? "", fresh);
      return;
    }

    const saved = importBuilds(rec.builds, { expectedExistingBuildIds: rec.expectedExistingBuildIds });
    if (!saved.ok) {
      setBusy(false);
      if (saved.code === "conflict") {
        setConflict(tim("saveConflictNote"));
        setStep("preview");
        runAnalyze(fileText ?? "", listAllBuilds());
        return;
      }
      setErrorMsg(
        saved.code === "quota" ? tim("quotaError") : saved.code === "storage" ? tim("storageError") : tim("genericSaveError"),
      );
      setStep("savefail");
      return;
    }

    // 保存後の再検証
    const after = listAllBuilds();
    const afterIds = new Set(after.map((b) => b.buildId));
    const allPresent = rec.builds.every((b) => afterIds.has(b.buildId));
    if (!allPresent || after.length !== fresh.length + rec.builds.length) {
      setBusy(false);
      setErrorMsg(tim("reverifyFailedNote"));
      setStep("savefail");
      onReload();
      return;
    }

    setBusy(false);
    setResult({ saved: saved.saved, newIds: rec.collisionCount });
    setStep("done");
    onReload();
  }

  const staleBlocked = stale && (step === "preview" || step === "confirm");

  const titleByStep: Record<Step, string> = {
    select: tim("titleSelect"),
    error: tim("titleError"),
    preview: tim("titlePreview"),
    confirm: tim("titleConfirm"),
    saving: tim("titleSaving"),
    done: tim("titleDone"),
    savefail: tim("titleSaveFail"),
  };

  return (
    <Modal open onClose={onClose} title={titleByStep[step]} size="lg">
      <div className="flex flex-col gap-3 text-sm">
        {staleBlocked ? (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-2 rounded border border-info/50 bg-info/10 px-2 py-1.5 text-2xs text-info"
          >
            <Icon name="refresh" size={14} className="shrink-0" />
            <span>{tim("staleBlockedText")}</span>
            <button
              type="button"
              onClick={handleReloadExisting}
              className="rounded border border-info/50 px-2 py-0.5 font-semibold hover:bg-info/10"
            >
              {tim("reloadExistingButton")}
            </button>
          </div>
        ) : null}
        {conflict ? (
          <div role="alert" className="rounded border border-warning/50 bg-warning/10 px-2 py-1.5 text-2xs text-warning">
            {conflict}
          </div>
        ) : null}

        {(step === "select" || step === "error") && (
          <SelectStep
            inputRef={inputRef}
            busy={busy}
            fileName={fileName}
            fileSize={fileSize}
            errorMsg={step === "error" ? errorMsg : null}
            validateInfo={validateInfo}
            duplicateIds={duplicateIds}
            onFileChange={onFileChange}
          />
        )}

        {step === "preview" && plan ? (
          <PreviewStep plan={plan} cards={cards} fileName={fileName} fileSize={fileSize} />
        ) : null}

        {step === "confirm" && plan ? (
          <ConfirmPanel plan={plan} disabled={busy || staleBlocked} onCancel={() => setStep("preview")} onConfirm={doImport} />
        ) : null}

        {step === "saving" ? (
          <p role="status" aria-live="polite" className="text-sm text-text-dim">
            {tim("savingText")}
          </p>
        ) : null}

        {step === "done" && result ? (
          <div className="flex flex-col gap-2">
            <p aria-live="polite" className="rounded border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
              {fillIm(tim("doneMessageTemplate"), { count: String(result.saved) })}
              {result.newIds > 0 ? fillIm(tim("doneNewIdsTemplate"), { count: String(result.newIds) }) : ""}
            </p>
            <p className="text-2xs text-text-muted">{tim("doneManageNote")}</p>
          </div>
        ) : null}

        {step === "savefail" ? (
          <p role="alert" className="rounded border border-danger/50 bg-danger/10 px-3 py-2 text-sm text-danger">
            {errorMsg ?? tim("saveFailFallback")}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
          {step === "preview" ? (
            <>
              <Button variant="ghost" size="sm" onClick={onClose}>
                {tim("cancelButton")}
              </Button>
              <Button variant="ghost" size="sm" onClick={pickAnotherFile}>
                {tim("pickAnotherFileButton")}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleReloadExisting}>
                {tim("reloadExistingButton")}
              </Button>
              <Button
                variant="primary"
                size="md"
                iconLeft="sliders"
                onClick={() => setStep("confirm")}
                disabled={busy || staleBlocked || plan == null || plan.saveCount === 0}
              >
                {fillIm(tim("importButtonTemplate"), { count: String(plan?.saveCount ?? 0) })}
              </Button>
            </>
          ) : step === "error" ? (
            <>
              <Button variant="ghost" size="sm" onClick={onClose}>
                {tim("cancelButton")}
              </Button>
              <Button variant="primary" size="md" onClick={pickAnotherFile}>
                {tim("pickAnotherFileButton")}
              </Button>
            </>
          ) : step === "done" || step === "savefail" ? (
            <Button variant="primary" size="md" onClick={onClose}>
              {tim("closeButton")}
            </Button>
          ) : step === "select" ? (
            <Button variant="ghost" size="sm" onClick={onClose}>
              {tim("cancelButton")}
            </Button>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}

function SelectStep({
  inputRef,
  busy,
  fileName,
  fileSize,
  errorMsg,
  validateInfo,
  duplicateIds,
  onFileChange,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  busy: boolean;
  fileName: string | null;
  fileSize: number | null;
  errorMsg: string | null;
  validateInfo: { invalid: number; valid: number } | null;
  duplicateIds: string[] | null;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const t = useT();
  const tim = (k: keyof Dictionary["buildImportModal"]) => t("buildImportModal", k);
  const fillIm = (s: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((acc, [key, val]) => acc.replace(`{${key}}`, val), s);
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded border border-border bg-surface-2/40 p-2 text-2xs text-text-dim">
        <p className="font-semibold">{tim("supportedFilesHeading")}</p>
        <ul className="mt-1 list-disc pl-4">
          <li>
            {tim("supportedFile1Prefix")}
            <code>{IMPORT_FORMAT_LABEL}</code>
            {tim("supportedFile1Middle")}
            <code>{IMPORT_FORMAT_VERSION_LABEL}</code>
            {tim("supportedFile1Suffix")}
          </li>
          <li>{tim("supportedFile2")}</li>
          <li>
            {fillIm(tim("supportedFile3Template"), {
              maxSize: (MAX_IMPORT_FILE_BYTES / 1_000_000).toFixed(0),
              maxCount: String(MAX_IMPORT_ITEM_COUNT),
            })}
          </li>
          <li>{tim("supportedFile4")}</li>
        </ul>
      </div>

      <label className="flex flex-col gap-1 text-xs font-medium text-text-dim">
        {tim("selectFileLabel")}
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          onChange={onFileChange}
          disabled={busy}
          className="rounded border border-border bg-surface px-2 py-1.5 text-sm file:mr-2 file:rounded file:border-0 file:bg-surface-3 file:px-2 file:py-1 file:text-xs"
        />
      </label>
      <p className="text-2xs text-text-muted">{tim("selectFileHint")}</p>

      {busy ? (
        <p role="status" aria-live="polite" className="text-2xs text-text-dim">
          {tim("validatingText")}
        </p>
      ) : null}

      {fileName ? (
        <p className="text-2xs text-text-muted">
          {fillIm(tim("selectedFileTemplate"), { name: fileName })}
          {fileSize != null ? fillIm(tim("selectedFileSizeTemplate"), { size: formatBytes(fileSize) }) : ""}
        </p>
      ) : null}

      {errorMsg ? (
        <div role="alert" className="rounded border border-danger/50 bg-danger/10 px-2 py-1.5 text-2xs text-danger">
          <p>{errorMsg}</p>
          {validateInfo ? (
            <p className="mt-1 text-text-dim">
              {fillIm(tim("validateInfoTemplate"), { invalid: String(validateInfo.invalid), valid: String(validateInfo.valid) })}
            </p>
          ) : null}
          {duplicateIds && duplicateIds.length > 0 ? (
            <p className="mt-1 break-all text-text-dim">
              {fillIm(tim("duplicateIdsTemplate"), { ids: duplicateIds.join(", ") })}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function PreviewStep({
  plan,
  cards,
  fileName,
  fileSize,
}: {
  plan: ImportPlan;
  cards: Map<string, WorldPlayerListItem>;
  fileName: string | null;
  fileSize: number | null;
}) {
  const t = useT();
  const { locale } = useLocale();
  const tim = (k: keyof Dictionary["buildImportModal"]) => t("buildImportModal", k);
  const fillIm = (s: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((acc, [key, val]) => acc.replace(`{${key}}`, val), s);
  return (
    <div className="flex flex-col gap-3">
      <Surface tone="inset" padding="sm" className="text-2xs">
        <p className="text-xs font-semibold text-text-dim">{tim("fileHeading")}</p>
        <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 sm:grid-cols-3">
          <Field label={tim("fileNameLabel")} value={fileName ?? "—"} />
          <Field label={tim("fileSizeLabel")} value={fileSize != null ? formatBytes(fileSize) : "—"} />
          <Field label="format" value={plan.meta.format} />
          <Field label="formatVersion" value={plan.meta.formatVersion} />
          <Field label="exportedAt" value={plan.meta.exportedAt} />
          <Field label="itemCount" value={String(plan.meta.itemCount)} />
        </dl>
      </Surface>

      <Surface tone="inset" padding="sm" className="text-2xs">
        <p className="text-xs font-semibold text-text-dim">{tim("validationHeading")}</p>
        <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 sm:grid-cols-3">
          <Field label={tim("validCountLabel")} value={String(plan.items.length)} />
          <Field label={tim("plannedSaveCountLabel")} value={String(plan.saveCount)} strong />
          <Field label={tim("collisionCountLabel")} value={String(plan.collisionCount)} warn={plan.collisionCount > 0} />
        </dl>
        <p className="mt-1 text-text-muted" aria-live="polite">
          {fillIm(tim("saveCountNoteTemplate"), { count: String(plan.saveCount) })}
        </p>
      </Surface>

      <details open className="rounded border border-border bg-surface-2/30 [&_summary]:list-none">
        <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs font-semibold text-text-dim">
          <Icon name="list" size={14} />
          {fillIm(tim("targetBuildsSummaryTemplate"), { count: String(plan.items.length) })}
        </summary>
        <ul className="max-h-72 overflow-y-auto border-t border-border/60">
          {plan.items.map((it) => {
            const card = cards.get(it.worldCardId) ?? null;
            const name = resolvePlayerDisplayName(
              card ?? {},
              locale,
              fillIm(t("squadBuildPanel", "cardFallbackNameTemplate"), { id: it.worldCardId }),
            );
            const rule = resolveBuildRuleStatus(it.rulesVersion);
            const ruleLabel = rule.isV2
              ? t("buildUsage", "ruleCurrentLabel")
              : rule.isLegacy
                ? t("buildUsage", "ruleLegacyLabel")
                : t("buildUsage", "ruleUnknownLabel");
            const active = buildAllocationRows(it.build.progressionAllocation)
              .filter((r) => r.level > 0)
              .map((r) => `${r.label} Lv${r.level}`)
              .join(" / ");
            return (
              <li key={it.originalBuildId} className="border-b border-border/60 px-3 py-2 text-2xs last:border-b-0">
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-xs font-semibold">{it.buildName}</span>
                  <Badge tone={rule.isV2 ? "neutral" : "warning"} size="xs">
                    {ruleLabel}
                  </Badge>
                  {it.collision ? (
                    <Badge tone="warning" size="xs">
                      {tim("newBuildIdBadge")}
                    </Badge>
                  ) : null}
                  {it.pom ? <Badge tone="outline" size="xs">{tim("pomBadge")}</Badge> : null}
                  {it.experimental ? <Badge tone="outline" size="xs">{tim("experimentalBadge")}</Badge> : null}
                </div>
                <p className="mt-0.5 text-text-dim">
                  {name}
                  {card?.nameEn ? <span className="text-text-muted"> / {card.nameEn}</span> : null}
                </p>
                <p className="mt-0.5 break-all text-text-muted">
                  {fillIm(tim("worldIdOriginalTemplate"), { worldId: it.worldCardId, originalId: it.originalBuildId })}
                  {it.collision ? fillIm(tim("finalBuildIdTemplate"), { finalId: it.finalBuildId }) : tim("noChangeLabel")}
                </p>
                <p className="mt-0.5 text-text-dim">{fillIm(tim("rulesVersionTemplate"), { version: it.rulesVersion })}</p>
                <p className="mt-0.5 text-text-dim">
                  {fillIm(tim("allocationLabelTemplate"), { allocation: active || t("squadBuildPanel", "noAllocationBase") })}
                </p>
                <p className="mt-0.5 text-text-muted">
                  {fillIm(tim("createdUpdatedNoteTemplate"), { created: it.createdAt, updated: it.updatedAt })}
                </p>
              </li>
            );
          })}
        </ul>
      </details>

      <div className="rounded border border-border bg-surface-2/40 p-2 text-2xs text-text-dim">
        <p className="font-semibold">{tim("unaffectedHeading")}</p>
        <ul className="mt-1 list-disc pl-4">
          <li>{tim("unaffected1")}</li>
          <li>{tim("unaffected2")}</li>
          <li>{tim("unaffected3")}</li>
          <li>{tim("unaffected4")}</li>
          <li>{tim("unaffected5")}</li>
        </ul>
        <p className="mt-1">{tim("unaffectedFootnote")}</p>
      </div>
    </div>
  );
}

function ConfirmPanel({
  plan,
  disabled,
  onCancel,
  onConfirm,
}: {
  plan: ImportPlan;
  disabled: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = useT();
  const tim = (k: keyof Dictionary["buildImportModal"]) => t("buildImportModal", k);
  const fillIm = (s: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((acc, [key, val]) => acc.replace(`{${key}}`, val), s);
  return (
    <div
      role="alertdialog"
      aria-labelledby="import-confirm-title"
      aria-describedby="import-confirm-desc"
      className="rounded border border-accent/40 bg-accent-soft/20 p-3"
    >
      <p id="import-confirm-title" className="text-sm font-semibold">
        {fillIm(tim("confirmTitleTemplate"), { count: String(plan.saveCount) })}
      </p>
      <ul id="import-confirm-desc" className="mt-1 list-disc pl-4 text-2xs text-text-dim">
        <li>{tim("confirmNote1")}</li>
        <li>
          {plan.collisionCount > 0
            ? fillIm(tim("confirmCollisionTemplate"), { count: String(plan.collisionCount) })
            : tim("confirmNoCollision")}
        </li>
        <li>{tim("confirmNote2")}</li>
        <li>{tim("confirmNote3")}</li>
      </ul>
      <div className="mt-2 flex flex-wrap justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={disabled}>
          {tim("cancelButton")}
        </Button>
        <Button variant="primary" size="md" onClick={onConfirm} disabled={disabled}>
          {tim("confirmButton")}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  strong,
  warn,
}: {
  label: string;
  value: string;
  strong?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-text-muted">{label}</dt>
      <dd className={`break-all ${warn ? "text-warning" : ""} ${strong ? "font-bold" : ""}`}>{value}</dd>
    </div>
  );
}

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}
