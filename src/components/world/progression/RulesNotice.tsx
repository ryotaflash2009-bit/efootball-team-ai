import type { ProgressionResult } from "@/lib/progression/types";

const MODE_LABEL: Record<string, string> = {
  confirmed: "確定（基礎値のみ）",
  provisional: "検証中（暫定規則を使用）",
  unsupported: "未対応",
};

/**
 * 計算モード・規則バージョン・確認状態・警告の表示。
 * 未確認の規則を確定値のように見せないための注記帯。
 */
export function RulesNotice({ result }: { result: ProgressionResult }) {
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
          {MODE_LABEL[result.calculationMode] ?? result.calculationMode}
        </span>
        <span className="text-text-dim">規則: {result.rulesVersion}</span>
        {result.isLegacyInput ? (
          <span className="rounded bg-yellow-400/15 px-2 py-0.5 text-yellow-300">旧規則の配分を移行して表示中</span>
        ) : null}
      </div>

      {result.warnings.length > 0 ? (
        <ul className="mt-2 list-disc space-y-0.5 pl-4 text-yellow-300/90">
          {result.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-text-dim">
        <span>能力値上限:</span>
        <span>基礎 {result.statCaps.base.value}（
          <span className="text-lime-300">確認済</span>）</span>
        <span>育成後 {result.statCaps.progression.value}（
          <span className="text-yellow-300">未確認</span>）</span>
        <span>ブースター後 {result.statCaps.playerBooster.value}（
          <span className="text-yellow-300">未確認</span>）</span>
        <span>最終 {result.statCaps.final.value}（
          <span className="text-yellow-300">未確認・暫定クランプ</span>）</span>
      </div>

      <details className="mt-2">
        <summary className="cursor-pointer text-text-dim">規則の確認状態を表示</summary>
        <div className="mt-2 space-y-2">
          <RuleList title="確認済み" items={result.confirmedRules} tone="ok" />
          <RuleList title="有力だが未確定（検証中）" items={result.provisionalRules} tone="warn" />
          <RuleList title="未確認 / 追加調査中" items={result.unresolvedRules} tone="dim" />
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
      <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-text-dim">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}
