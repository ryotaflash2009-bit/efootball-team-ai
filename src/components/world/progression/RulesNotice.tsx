import "@/lib/i18n/dictionaries/ja-ns/progressionTab";
import type { ProgressionResult } from "@/lib/progression/types";
import { useLocale, useT } from "@/lib/i18n/LocaleContext";
import { rulesByStatus } from "@/lib/progression/rule-registry";
import { UNSUPPORTED_RULES_EN, ruleText } from "@/lib/progression/rule-registry-en";
import type { Locale } from "@/lib/i18n/locale";
import { localizeLibText } from "@/lib/progression/lib-text-en";

const MODE_LABEL_KEY = {
  confirmed: "ruModeConfirmed",
  provisional: "ruModeProvisional",
  unsupported: "ruModeUnsupported",
} as const;

/**
 * 規則一覧の表示文（言語別）。日本語はエンジンの出力（result の各配列）をそのまま使う。
 * 英語は RULE_REGISTRY を ruleText で英語化し、エンジン固有の追加項目（未対応規則）は訳表で置換する。
 */
function localizedRules(
  status: "confirmed" | "provisional" | "unresolved",
  fromEngine: string[],
  locale: Locale,
): string[] {
  if (locale === "ja") return fromEngine;
  const registry = rulesByStatus(status).map((r) => {
    const tx = ruleText(r, locale);
    return `${tx.ruleName}: ${tx.description}`;
  });
  const extra = fromEngine.slice(registry.length).map((s) => UNSUPPORTED_RULES_EN[s] ?? s);
  return [...registry, ...extra];
}

/**
 * 計算モード・規則バージョン・確認状態・警告の表示。
 * 未確認の規則を確定値のように見せないための注記帯。
 */
export function RulesNotice({ result }: { result: ProgressionResult }) {
  const t = useT();
  const tp = (k: Parameters<typeof t<"progressionTab">>[1]) => t("progressionTab", k);
  const { locale, displayLocale } = useLocale();
  const modeKey = MODE_LABEL_KEY[result.calculationMode as keyof typeof MODE_LABEL_KEY];
  return (
    <div className="rounded-md border border-border bg-surface-2/40 p-3 text-xs">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span
          className={`rounded px-2 py-0.5 font-bold ${
            result.calculationMode === "confirmed"
              ? "bg-lime-400/15 text-lime-300"
              : "bg-yellow-400/15 text-yellow-300"
          }`}
        >
          {modeKey ? tp(modeKey) : result.calculationMode}
        </span>
        <span className="text-text-dim">{tp("ruRulesVersion").replace("{version}", result.rulesVersion)}</span>
        {result.isLegacyInput ? (
          <span className="rounded bg-yellow-400/15 px-2 py-0.5 text-yellow-300">{tp("ruLegacyMigrated")}</span>
        ) : null}
      </div>

      {result.warnings.length > 0 ? (
        <ul className="mt-2 list-disc space-y-0.5 ps-4 text-yellow-300/90">
          {result.warnings.map((w, i) => (
            <li key={i}>{localizeLibText(w, displayLocale)}</li>
          ))}
        </ul>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-text-dim">
        <span>{tp("ruCapsHeading")}</span>
        <span>{tp("ruCapBase").replace("{value}", String(result.statCaps.base.value))}
          <span className="text-lime-300">{tp("ruCapConfirmed")}</span>{tp("ruCapClose")}</span>
        <span>{tp("ruCapProgression").replace("{value}", String(result.statCaps.progression.value))}
          <span className="text-yellow-300">{tp("ruCapUnconfirmed")}</span>{tp("ruCapClose")}</span>
        <span>{tp("ruCapBooster").replace("{value}", String(result.statCaps.playerBooster.value))}
          <span className="text-yellow-300">{tp("ruCapUnconfirmed")}</span>{tp("ruCapClose")}</span>
        <span>{tp("ruCapFinal").replace("{value}", String(result.statCaps.final.value))}
          <span className="text-yellow-300">{tp("ruCapUnconfirmedClamp")}</span>{tp("ruCapClose")}</span>
      </div>

      <details className="mt-2">
        <summary className="cursor-pointer text-text-dim">{tp("ruShowRuleStatus")}</summary>
        <div className="mt-2 space-y-2">
          <RuleList title={tp("ruListConfirmed")} items={localizedRules("confirmed", result.confirmedRules, locale)} tone="ok" />
          <RuleList
            title={tp("ruListProvisional")}
            items={localizedRules("provisional", result.provisionalRules, locale)}
            tone="warn"
          />
          <RuleList
            title={tp("ruListUnresolved")}
            items={localizedRules("unresolved", result.unresolvedRules, locale)}
            tone="dim"
          />
        </div>
      </details>
    </div>
  );
}

function RuleList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "ok" | "warn" | "dim";
}) {
  const color =
    tone === "ok" ? "text-lime-300" : tone === "warn" ? "text-yellow-300" : "text-text-dim";
  return (
    <div>
      <p className={`font-semibold ${color}`}>{title}</p>
      <ul className="mt-0.5 list-disc space-y-0.5 ps-4 text-text-dim">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}
