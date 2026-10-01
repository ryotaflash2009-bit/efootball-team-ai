import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildDetectionNotification } from "../../../../scripts/lib/reference-data-notify.mjs";

const ROOT = path.resolve(__dirname, "..", "..", "..", "..");
const RUN = { conclusion: "success", runId: "36340696128", runUrl: "https://github.com/owner/repo/actions/runs/36340696128" };
const summary = (overall: string, extra: Record<string, unknown> = {}) => ({
  overall,
  world: { decision: overall, recordCount: 13300, appliedRecordCount: 13297, sourceChecksum12: "0123456789ab", signals: ["record_count_drop"], ...extra },
  managers: { decision: "no_change", recordCount: 67, appliedRecordCount: 67, sourceChecksum12: "8c1d654ec48e", signals: [] },
});

describe("参照データ更新の通知（Issue 本文）", () => {
  it("変化なしで成功したときは通知しない", () => {
    expect(buildDetectionNotification(summary("no_change"), RUN)).toEqual({ notify: false, reason: "no_change" });
    expect(buildDetectionNotification(null, { ...RUN, conclusion: "cancelled" })).toMatchObject({ notify: false });
  });

  it("更新あり・要確認・失敗は通知し、次の手順を書く", () => {
    const up = buildDetectionNotification(summary("update_available"), RUN);
    expect(up).toMatchObject({ notify: true });
    if (!up.notify) return;
    expect(up.title).toContain("update available");
    expect(up.body).toContain("13300");
    expect(up.body).toContain("0123456789ab");
    expect(up.body).toContain("F-071");
    expect(buildDetectionNotification(summary("attention_required"), RUN)).toMatchObject({ notify: true });
    const failed = buildDetectionNotification(null, { ...RUN, conclusion: "failure" });
    expect(failed).toMatchObject({ notify: true });
    if (failed.notify) expect(failed.title).toContain("failed");
  });

  it("要約の値は許可した形だけを使う（URL・任意の文字列・行データを本文へ出さない）", () => {
    const evil = summary("update_available", { sourceChecksum12: "<script>alert(1)</script>", signals: ["https://evil.example/x", "ok_signal"], recordCount: "13300; rm -rf" });
    const n = buildDetectionNotification(evil, { ...RUN, runUrl: "https://evil.example/runs/1" });
    if (!n.notify) throw new Error("expected notification");
    // 要約から来た値に山かっこ・外部 URL・任意の文字列が残らない（許可した形だけを通す）。
    expect(n.body).not.toContain("<");
    expect(n.body).not.toContain(">");
    expect(n.body).not.toContain("evil.example");
    expect(n.body).not.toContain("rm -rf");
    expect(n.body).toContain("ok_signal");
    expect(n.body).toContain("checksum ?");
  });
});

describe("reference-data-update-notify.yml の静的監査", () => {
  const wf = readFileSync(path.join(ROOT, ".github", "workflows", "reference-data-update-notify.yml"), "utf8");
  const code = wf.split("\n").filter((l) => !/^\s*#/.test(l)).join("\n");

  it("起動は検出 workflow の完了だけ", () => {
    expect(code).toMatch(/workflow_run:\s*\n\s+workflows: \["Reference data update detection"\]\s*\n\s+types: \[completed\]/);
    expect(code).not.toMatch(/^\s*(schedule|push|pull_request|pull_request_target|workflow_dispatch|repository_dispatch)\s*:/m);
  });

  it("権限は contents: read・actions: read・issues: write だけ。Secret・Environment・Production の entry を使わない", () => {
    expect(code).toMatch(/^permissions:\s*\n\s+contents: read\s*\n\s+actions: read\s*\n\s+issues: write\s*$/m);
    expect(code).not.toMatch(/secrets\.|environment:/);
    expect(code).not.toMatch(/run-production|run-update-orchestrator|tsconfig\.(production|backup)|git (commit|push)|gh (workflow|pr) /);
  });

  it("イベントの値はシェルへ直接埋め込まず、環境変数で渡す", () => {
    const runBlocks = [...code.matchAll(/run: \|\n([\s\S]*?)(?=\n\s{6}- name:|\n*$)/g)].map((m) => m[1]).join("\n");
    expect(runBlocks).not.toMatch(/\$\{\{/);
  });
});
