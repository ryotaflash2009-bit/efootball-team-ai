import { describe, it, expect } from "vitest";
import { SQUADS_CLOUD_MODE, isSquadsCloudAvailable } from "./squads-cloud-mode";
import { isLocalDevHostname } from "./local-dev";

describe("保存スカッドのクラウド保存の公開の状態（2026-10-11）", () => {
  it("本番の表を作るまでは無効（fail closed）", () => {
    expect(SQUADS_CLOUD_MODE).toBe("disabled");
  });
  it("無効の間は本番・プレビューのホストでは開かない・ローカルの ?squadsCloudPreview=1 だけ開く・有効なら常に開く", () => {
    expect(isSquadsCloudAvailable("efootball-team-ai.vercel.app", "?squadsCloudPreview=1", isLocalDevHostname, "disabled")).toBe(false);
    expect(isSquadsCloudAvailable("localhost", "", isLocalDevHostname, "disabled")).toBe(false);
    expect(isSquadsCloudAvailable("localhost", "?squadsCloudPreview=1", isLocalDevHostname, "disabled")).toBe(true);
    expect(isSquadsCloudAvailable("efootball-team-ai.vercel.app", "", isLocalDevHostname, "enabled")).toBe(true);
  });
});
