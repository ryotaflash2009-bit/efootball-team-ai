import { describe, it, expect } from "vitest";
import { BUILDS_CLOUD_MODE, isBuildsCloudAvailable } from "./builds-cloud-mode";
import { isLocalDevHostname } from "./local-dev";

describe("保存ビルドのクラウド保存の公開の状態（2026-10-11）", () => {
  it("本番の表を作るまでは無効（fail closed）", () => {
    expect(BUILDS_CLOUD_MODE).toBe("disabled");
  });
  it("無効の間は本番・プレビューのホストでは開かない・ローカルの ?buildsCloudPreview=1 だけ開く・有効なら常に開く", () => {
    expect(isBuildsCloudAvailable("efootball-team-ai.vercel.app", "?buildsCloudPreview=1", isLocalDevHostname, "disabled")).toBe(false);
    expect(isBuildsCloudAvailable("localhost", "", isLocalDevHostname, "disabled")).toBe(false);
    expect(isBuildsCloudAvailable("localhost", "?buildsCloudPreview=1", isLocalDevHostname, "disabled")).toBe(true);
    expect(isBuildsCloudAvailable("efootball-team-ai.vercel.app", "", isLocalDevHostname, "enabled")).toBe(true);
  });
});
