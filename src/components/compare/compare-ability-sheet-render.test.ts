import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "@/lib/i18n/LocaleContext";
import { buildComparison, comparisonPlayerAllocation } from "@/lib/comparison/build-comparison";
import type { ComparisonPlayerInput } from "@/lib/comparison/types";
import type { ProgressionCard } from "@/lib/progression/types";
import { MESSI_BIGTIME, CANNAVARO_EPIC } from "@/lib/progression/fixtures";
import { CompareAbilityEditSheet } from "./CompareAbilityEditSheet";
import { CompareTrainingPanel } from "./CompareTrainingPanel";

const noop = () => undefined;
function input(card: ProgressionCard, savedAllocation: Record<string, number> | null = null): ComparisonPlayerInput {
  return {
    card,
    display: {
      worldCardId: card.worldCardId, nameEn: card.nameEn, nameJa: card.nameJa, cardType: card.cardType,
      registeredPosition: card.registeredPosition, playingStyle: null, playingStyleDefensive: null, nationality: null,
      region: null, league: null, team: null, age: null, height: null, weight: null, preferredFoot: null,
      boost1: card.boost1, boost2: card.boost2, playerSkills: [], aiStyles: [], imageSources: [],
    },
    buildMode: "none",
    savedAllocation,
    manager: null,
  } as unknown as ComparisonPlayerInput;
}

describe("比較画面の「能力から育成」シート（DOM）", () => {
  const players = [input(MESSI_BIGTIME, { dribbling: 3 }), input(CANNAVARO_EPIC)];
  const comparison = buildComparison(players);
  const html = renderToStaticMarkup(
    createElement(
      LocaleProvider,
      null,
      createElement(CompareAbilityEditSheet, {
        players,
        comparison,
        allocations: players.map(comparisonPlayerAllocation),
        index: 0,
        onIndex: noop,
        onClose: noop,
        onSetLevel: noop,
        onAdjustLevel: noop,
        onBuildSaved: noop,
        onSaveAs: noop,
      }),
    ),
  );

  it("モーダルのダイアログで、編集中の選手を題名と説明に明示する", () => {
    expect(html).toMatch(/role="dialog" aria-modal="true" aria-labelledby="compare-ability-sheet-title"/);
    expect(html).toContain(">リオネル メッシ を育成</h2>");
    expect(html).toContain("比較 1 人目。変更はこの選手だけに反映されます");
    expect(html).toContain("比較へ戻る");
  });

  it("選手の切替タブ（選択中は aria-selected）と、他の選手の値の手がかり", () => {
    expect(html).toMatch(/role="tab" aria-selected="true"[^>]*>1\. リオネル メッシ/);
    expect(html).toMatch(/role="tab" aria-selected="false"[^>]*>2\. ファビオ カンナヴァーロ/);
    expect(html).toContain("能力をタップすると、他の選手の同じ能力値を並べて表示します");
  });

  it("同じ能力値一覧・下部パネル（未選択バー）を使い、配分があり未保存なら「未保存」", () => {
    expect(html).toContain('data-testid="ability-direct-list"');
    expect(html).toContain('data-testid="progression-dock-idle"');
    expect(html).toMatch(/data-dirty="true"/);
  });

  it("育成パネルに「能力から育成」の入口（読み上げに選手名）", () => {
    const panel = renderToStaticMarkup(
      createElement(
        LocaleProvider,
        null,
        createElement(CompareTrainingPanel, {
          name: "リオネル メッシ",
          isGk: false,
          groups: comparison.players[0].result.groups,
          points: comparison.players[0].result.points,
          canProgress: true,
          hasManualAllocation: true,
          embedded: true,
          onSetLevel: noop,
          onAdjustLevel: noop,
          onAutoProfile: noop,
          onReset: noop,
          onOpenAbilityEditor: noop,
        }),
      ),
    );
    expect(panel).toMatch(/aria-label="リオネル メッシ を能力から育成" data-testid="compare-open-ability-editor"[^>]*>能力から育成</);
  });
});
