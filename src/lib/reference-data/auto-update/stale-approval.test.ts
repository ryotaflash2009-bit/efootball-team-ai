import { describe, it, expect } from "vitest";
import { staleApprovalRunsToCancel } from "../../../../scripts/lib/stale-approval.mjs";

const NOW = "2026-10-11T00:00:00Z";
const hoursAgo = (h: number) => new Date(Date.parse(NOW) - h * 3_600_000).toISOString();

describe("古い承認待ちの Production Apply の取り消し（2026-10-11）", () => {
  it("2026-10-09 の実例: 承認待ち 40 時間・保留 31 時間 → 両方取り消す", () => {
    const r = staleApprovalRunsToCancel({
      now: "2026-10-10T19:00:00Z",
      runs: [
        { id: 37877548531, status: "waiting", createdAt: "2026-10-09T03:04:07Z" },
        { id: 37960339182, status: "pending", createdAt: "2026-10-09T16:36:31Z" },
        { id: 37877407672, status: "completed", createdAt: "2026-10-09T03:02:17Z" },
      ],
    });
    expect(r).toEqual({ cancel: [37877548531, 37960339182], kept: 0 });
  });
  it("24 時間より新しい承認待ちは残す（本人が承認できる）・実行中と完了には触れない", () => {
    const r = staleApprovalRunsToCancel({
      now: NOW,
      runs: [
        { id: 1, status: "waiting", createdAt: hoursAgo(23) },
        { id: 2, status: "in_progress", createdAt: hoursAgo(48) },
        { id: 3, status: "completed", createdAt: hoursAgo(48) },
        { id: 4, status: "queued", createdAt: hoursAgo(25) },
      ],
    });
    expect(r).toEqual({ cancel: [4], kept: 1 });
  });
  it("他の workflow の run・壊れた値・未来の時刻は対象外", () => {
    const r = staleApprovalRunsToCancel({
      now: NOW,
      runs: [
        { id: 5, status: "waiting", createdAt: hoursAgo(48), workflowPath: ".github/workflows/reference-data-production-backup.yml" },
        { id: 6, status: "waiting", createdAt: "bad" },
        { id: 7, status: "waiting", createdAt: hoursAgo(-1) },
        { id: 8, status: "waiting", createdAt: hoursAgo(30), workflowPath: ".github/workflows/reference-data-production-apply.yml" },
      ],
    });
    expect(r).toEqual({ cancel: [8], kept: 0 });
    expect(staleApprovalRunsToCancel({ now: "bad", runs: [{ id: 9, status: "waiting", createdAt: hoursAgo(48) }] }).cancel).toEqual([]);
  });
});
