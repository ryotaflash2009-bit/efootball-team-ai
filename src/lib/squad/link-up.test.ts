import { describe, it, expect } from "vitest";
import { evaluateLinkUpPlay, evaluateLinkUpPlays, type LinkUpPlayer } from "./link-up";
import type { LinkUpPlay } from "@/lib/managers/types";

const play = (cp: LinkUpPlay["centerPiece"], km: LinkUpPlay["keyMan"]): LinkUpPlay => ({
  name: "Test Link-Up",
  centerPiece: cp,
  keyMan: km,
  confirmationStatus: "provisional",
});

const players: LinkUpPlayer[] = [
  { slotId: "cf", assignedPosition: "CF", registeredPosition: "CF", playingStyle: "Goal Poacher" },
  { slotId: "amf", assignedPosition: "AMF", registeredPosition: "AMF", playingStyle: "Creative Playmaker" },
  { slotId: "lcb", assignedPosition: "CB", registeredPosition: "CB", playingStyle: null },
];

const sel = { centerPieceSlotId: null, keyManSlotId: null };

describe("Link-Up Play 発動条件の照合", () => {
  it("両条件に合致選手がいる → met", () => {
    const e = evaluateLinkUpPlay(
      play(
        { role: "centerPiece", playingStyle: "Goal Poacher", positions: ["CF"] },
        { role: "keyMan", playingStyle: "Creative Playmaker", positions: ["AMF"] },
      ),
      players,
      sel,
    );
    expect(e.status).toBe("met");
    expect(e.centerPiece.matchingSlotIds).toEqual(["cf"]);
    expect(e.keyMan.matchingSlotIds).toEqual(["amf"]);
  });

  it("片方だけ合致 → partial", () => {
    const e = evaluateLinkUpPlay(
      play(
        { role: "centerPiece", playingStyle: "Goal Poacher", positions: ["CF"] },
        { role: "keyMan", playingStyle: "Box-to-Box", positions: ["CMF"] },
      ),
      players,
      sel,
    );
    expect(e.status).toBe("partial");
  });

  it("どちらも合致なし → unmet", () => {
    const e = evaluateLinkUpPlay(
      play(
        { role: "centerPiece", playingStyle: "Target Man", positions: ["CF"] },
        { role: "keyMan", playingStyle: "Anchor Man", positions: ["DMF"] },
      ),
      players,
      sel,
    );
    expect(e.status).toBe("unmet");
  });

  it("条件データ不足 → indeterminate", () => {
    const e = evaluateLinkUpPlay(play(null, { role: "keyMan", playingStyle: null, positions: [] }), players, sel);
    expect(e.status).toBe("indeterminate");
  });

  it("ポジションのみ条件（playingStyle なし）でも判定できる", () => {
    const e = evaluateLinkUpPlay(
      play(
        { role: "centerPiece", playingStyle: null, positions: ["CF", "SS"] },
        { role: "keyMan", playingStyle: null, positions: ["CB"] },
      ),
      players,
      sel,
    );
    expect(e.status).toBe("met");
    expect(e.centerPiece.matchingSlotIds).toEqual(["cf"]);
    expect(e.keyMan.matchingSlotIds).toEqual(["lcb"]);
  });

  it("手動選択が条件を満たすか判定", () => {
    const e = evaluateLinkUpPlay(
      play(
        { role: "centerPiece", playingStyle: "Goal Poacher", positions: ["CF"] },
        { role: "keyMan", playingStyle: "Creative Playmaker", positions: ["AMF"] },
      ),
      players,
      { centerPieceSlotId: "cf", keyManSlotId: "lcb" },
    );
    expect(e.centerPiece.selectedSatisfies).toBe(true);
    expect(e.keyMan.selectedSatisfies).toBe(false);
  });

  it("evaluateLinkUpPlays: plays なしは空配列", () => {
    expect(evaluateLinkUpPlays(null, players, sel)).toEqual([]);
    expect(evaluateLinkUpPlays([], players, sel)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// プレースタイル正規化層の接続（確認済み表記揺れによる不一致の防止・既存挙動は変えない）
// ---------------------------------------------------------------------------
describe("Link-Up Play とプレースタイル正規化層の接続", () => {
  it("確認済みの表記揺れ（選手側がeFHUB表記）でも一致する: Box To Box → Box-to-Box", () => {
    const p: LinkUpPlayer[] = [{ slotId: "s1", assignedPosition: "CMF", registeredPosition: "CMF", playingStyle: "Box To Box" }];
    const e = evaluateLinkUpPlay(
      play({ role: "centerPiece", playingStyle: "Box-to-Box", positions: [] }, null),
      p,
      sel,
    );
    expect(e.centerPiece.matchingSlotIds).toEqual(["s1"]);
  });

  it("確認済みの表記揺れ（条件側がeFHUB表記）でも一致する: Fox In The Box → Fox in the Box", () => {
    const p: LinkUpPlayer[] = [{ slotId: "s1", assignedPosition: "CF", registeredPosition: "CF", playingStyle: "Fox in the Box" }];
    const e = evaluateLinkUpPlay(
      play({ role: "centerPiece", playingStyle: "Fox In The Box", positions: [] }, null),
      p,
      sel,
    );
    expect(e.centerPiece.matchingSlotIds).toEqual(["s1"]);
  });

  it("表記揺れの解決範囲を超える異なるプレースタイルは一致しない（誤って統合しない）", () => {
    const p: LinkUpPlayer[] = [{ slotId: "s1", assignedPosition: "CF", registeredPosition: "CF", playingStyle: "Target Man" }];
    const e = evaluateLinkUpPlay(
      play({ role: "centerPiece", playingStyle: "Goal Poacher", positions: [] }, null),
      p,
      sel,
    );
    expect(e.centerPiece.matchingSlotIds).toEqual([]);
  });

  it("異常値($undefined)を持つ選手はどの条件にも一致しない（既定値へフォールバックしない）", () => {
    const p: LinkUpPlayer[] = [{ slotId: "s1", assignedPosition: "CF", registeredPosition: "CF", playingStyle: "$undefined" }];
    const e = evaluateLinkUpPlay(
      play({ role: "centerPiece", playingStyle: "Goal Poacher", positions: [] }, null),
      p,
      sel,
    );
    expect(e.centerPiece.matchingSlotIds).toEqual([]);
  });

  it("未知の値どうしは、既存の大小無視の完全一致比較へフォールバックして一致する（回帰確認）", () => {
    const p: LinkUpPlayer[] = [{ slotId: "s1", assignedPosition: "CF", registeredPosition: "CF", playingStyle: "Some Future Style" }];
    const e = evaluateLinkUpPlay(
      play({ role: "centerPiece", playingStyle: "some future style", positions: [] }, null),
      p,
      sel,
    );
    expect(e.centerPiece.matchingSlotIds).toEqual(["s1"]);
  });

  it("回帰確認: 実際に運用されている10種類のLink-Up Play条件値は、正規化接続の前後で判定が変わらない", () => {
    // docs/playing-style-ledger.md §5-5（manager_link_up_conditions.playing_styleの実データ10種類）。
    // これらはすべてWorldのplaying_styleと完全一致することを監査済みのため、
    // 正規化層を経由しても素の大小無視比較と同じ結果になるはずである。
    const confirmedConditionValues = [
      "Creative Playmaker",
      "Goal Poacher",
      "Prolific Winger",
      "Orchestrator",
      "Fox in the Box",
      "Cross Specialist",
      "Hole Player",
      "Build Up",
      "Box-to-Box",
      "Attacking Full-back",
    ];
    for (const styleValue of confirmedConditionValues) {
      const matchingPlayer: LinkUpPlayer[] = [{ slotId: "match", assignedPosition: "CF", registeredPosition: "CF", playingStyle: styleValue }];
      const nonMatchingPlayer: LinkUpPlayer[] = [{ slotId: "nomatch", assignedPosition: "CF", registeredPosition: "CF", playingStyle: "Anchor Man" }];
      const e1 = evaluateLinkUpPlay(play({ role: "centerPiece", playingStyle: styleValue, positions: [] }, null), matchingPlayer, sel);
      expect(e1.centerPiece.matchingSlotIds, `${styleValue} should match itself`).toEqual(["match"]);
      const e2 = evaluateLinkUpPlay(play({ role: "centerPiece", playingStyle: styleValue, positions: [] }, null), nonMatchingPlayer, sel);
      expect(e2.centerPiece.matchingSlotIds, `${styleValue} should not match Anchor Man`).toEqual([]);
    }
  });
});
