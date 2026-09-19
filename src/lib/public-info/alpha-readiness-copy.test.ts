import { describe, it, expect } from "vitest";
import ja from "@/lib/i18n/dictionaries/ja";
import en from "@/lib/i18n/dictionaries/en";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildReleaseReadinessItems } from "./release-readiness";
import { AVAILABLE_FEATURE_KEYS, BETA_FEATURE_KEYS, NOT_PROVIDED_FEATURE_KEYS } from "./feature-catalog";

/**
 * 招待制アルファ公開前の最終表示整合(/release-readiness・/account metadata)の
 * 回帰防止テスト。実Supabase・実ネットワークへは一切接続しない。
 */
const REPO_ROOT = resolve(__dirname, "../../..");

describe("/release-readiness: 古い断定が残っていない", () => {
  it("「ログイン機構は未実装」という古い断定を含まない(ja/en)", () => {
    expect(ja.releaseReadiness.itemAuthDesc).not.toMatch(/ログイン機構は未実装/);
    expect(ja.releaseReadiness.currentStageBody).not.toMatch(/認証.{0,10}未実装/);
    expect(en.releaseReadiness.itemAuthDesc).not.toMatch(/login mechanism is not implemented/i);
  });

  it("「アカウントの概念が無い」という古い断定を含まない(ja/en)", () => {
    expect(ja.releaseReadiness.itemDataIsolationDesc).not.toMatch(/アカウントの概念が無い/);
    expect(en.releaseReadiness.itemDataIsolationDesc).not.toMatch(/no concept of an account/i);
  });

  it("「本番ホスティングは未整備」という古い断定を含まない(ja/en)", () => {
    expect(ja.releaseReadiness.itemHostingDesc).not.toMatch(/本番ホスティングは未整備/);
    expect(en.releaseReadiness.itemHostingDesc).not.toMatch(/production hosting is not set up/i);
  });
});

describe("/release-readiness: 実装済み機能が正確に説明されている", () => {
  it("認証がSupabase Authによる実装済みとして説明される", () => {
    expect(ja.releaseReadiness.itemAuthDesc).toMatch(/Supabase Auth/);
    expect(en.releaseReadiness.itemAuthDesc).toMatch(/Supabase Auth/);
  });

  it("RLSによるユーザー別データ分離が説明される", () => {
    expect(ja.releaseReadiness.itemDataIsolationDesc).toMatch(/RLS/);
    expect(en.releaseReadiness.itemDataIsolationDesc).toMatch(/Row Level Security|RLS/);
  });

  it("My Teamクラウド保存がアルファ機能・明示操作として説明される(自動同期と誤解させない)", () => {
    expect(ja.releaseReadiness.itemCloudBackupDesc).toMatch(/明示操作/);
    expect(ja.releaseReadiness.itemCloudBackupDesc).not.toMatch(/自動的に.*保存/);
    expect(en.releaseReadiness.itemCloudBackupDesc).toMatch(/explicitly/);
  });

  it("端末間の完全な自動同期は未実装のままと明記される", () => {
    expect(ja.releaseReadiness.itemSyncDesc).toMatch(/未実装/);
    expect(en.releaseReadiness.itemSyncDesc).toMatch(/not implemented/i);
  });
});

describe("/release-readiness・/about: 参照データSupabase経路・SQLite切戻し・自動更新dry-run・Cron未実装が説明される", () => {
  it("参照データがSupabaseを既定経路とし、SQLite切戻しが可能と説明される(ja/en)", () => {
    expect(ja.about.availableReferenceDataSupabase).toMatch(/Supabase/);
    expect(ja.about.availableReferenceDataSupabase).toMatch(/SQLite/);
    expect(en.about.availableReferenceDataSupabase).toMatch(/Supabase/);
    expect(en.about.availableReferenceDataSupabase).toMatch(/SQLite/);
  });

  it("自動更新がdry-run限定でCron未実装と説明される(ja/en)", () => {
    expect(ja.about.betaReferenceDataAutoUpdateDryRun).toMatch(/dry-run/);
    expect(ja.about.betaReferenceDataAutoUpdateDryRun).toMatch(/Cron/);
    expect(en.about.betaReferenceDataAutoUpdateDryRun).toMatch(/dry-run/);
    expect(en.about.betaReferenceDataAutoUpdateDryRun).toMatch(/Cron/);
  });

  it("新設したaboutキーがAVAILABLE/BETA_FEATURE_KEYSに登録されている", () => {
    expect(AVAILABLE_FEATURE_KEYS).toContain("availableAccountAuth");
    expect(AVAILABLE_FEATURE_KEYS).toContain("availableReferenceDataSupabase");
    expect(BETA_FEATURE_KEYS).toContain("betaMyTeamCloudSave");
    expect(BETA_FEATURE_KEYS).toContain("betaReferenceDataAutoUpdateDryRun");
  });

  it("「アカウント登録・ログイン」はもう未提供機能として登録されていない", () => {
    expect(NOT_PROVIDED_FEATURE_KEYS).not.toContain("notProvidedAccount");
  });

  it("端末間の自動同期・全データの自動クラウドバックアップは引き続き未提供機能として登録されている", () => {
    expect(NOT_PROVIDED_FEATURE_KEYS).toContain("notProvidedSync");
    expect(NOT_PROVIDED_FEATURE_KEYS).toContain("notProvidedCloudBackup");
  });
});

describe("/release-readiness: データモデルのstatusが現在の実装と一致する", () => {
  const byId = new Map(buildReleaseReadinessItems().map((i) => [i.id, i]));

  it("認証・データ分離・本番ホスティングはcomplete", () => {
    expect(byId.get("auth")?.status).toBe("complete");
    expect(byId.get("data-isolation")?.status).toBe("complete");
    expect(byId.get("hosting")?.status).toBe("complete");
  });

  it("My Teamクラウド保存(cloud-backup)はpartial(全データの自動バックアップは未実装のため)", () => {
    expect(byId.get("cloud-backup")?.status).toBe("partial");
  });

  it("端末間の完全な自動同期(sync)はnot-startedのまま", () => {
    expect(byId.get("sync")?.status).toBe("not-started");
  });
});

describe("/account metadata: 現在の実装と一致する", () => {
  const source = readFileSync(resolve(REPO_ROOT, "src/app/account/page.tsx"), "utf8");

  it("「技術検証段階。クラウド同期は未実装」という古い断定を含まない", () => {
    expect(source).not.toMatch(/技術検証段階。クラウド同期は未実装/);
  });

  it("Supabase Authとの言及がある", () => {
    expect(source).toMatch(/Supabase Auth/);
  });

  it("My Teamクラウド保存・取得への言及がある", () => {
    expect(source).toMatch(/My Team.*クラウド保存/);
  });

  it("端末間の自動同期は未対応と明記される", () => {
    expect(source).toMatch(/端末間の自動同期は未対応/);
  });

  it("metadataに新しい事実(未検証の主張)を追加していない(既存のPrivacy/accountページ本文と矛盾する強い主張がない)", () => {
    expect(source).not.toMatch(/保証|完全に安全|絶対に/);
  });
});

describe("日英の整合性(新設・変更したキーの組が一致する)", () => {
  it("aboutのキー集合がja/enで一致する", () => {
    expect(Object.keys(en.about).sort()).toEqual(Object.keys(ja.about).sort());
  });

  it("releaseReadinessのキー集合がja/enで一致する", () => {
    expect(Object.keys(en.releaseReadiness).sort()).toEqual(Object.keys(ja.releaseReadiness).sort());
  });
});

describe("内部実装の過剰露出がない", () => {
  it("release-readiness関連の新規テキストに内部パス・PID・接続文字列らしき文字列を含まない", () => {
    const blob = JSON.stringify([
      ja.releaseReadiness,
      en.releaseReadiness,
      ja.about,
      en.about,
      buildReleaseReadinessItems(),
    ]);
    expect(blob).not.toMatch(/C:\\|\/data\/server\.pid|postgres(ql)?:\/\/|sb_secret_|localhost:3000/i);
  });
});
