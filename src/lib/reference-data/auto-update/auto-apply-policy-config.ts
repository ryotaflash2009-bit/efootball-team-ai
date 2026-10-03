/**
 * 完全無人の Production Apply（自動 Apply）の契約と閾値（本人の決定 2026-10-03）。
 *
 * - ここに無い値（隠れた閾値）は使わない。値を変えるときは版（version）を上げ、テストと Evidence を更新する。
 * - 閾値は、検証済みの実績（World 2026-10-03: 13,297 → 13,372・追加 75・更新 5,675・構造 6、Managers: 67 → 69・追加 2）を
 *   必要以上に広げない値にする。
 * - Rollout: A（validator・mock・静的監査・使い捨て PostgreSQL）→ B（shadow: 手動承認のまま判定を記録）→ C（自動 Apply）。
 *   実際に自動で書き込むのは、Repository variable の kill switch がすべて "true" のときだけ（それ以外は手動承認の経路）。
 */
export const AUTO_APPLY_POLICY = {
  version: "auto-apply-policy/2026-10-03.v1",
  rollout: "C",
  world: {
    targetTable: "world_player_cards",
    /** 追加件数 / 適用前の件数 の上限。 */
    maxAddRatio: 0.02,
    /** 更新件数 / 適用前の件数 の上限（card_rating だけの変更を含む）。 */
    maxUpdateRatio: 0.5,
    /** card_rating 以外の列も変わる「構造の変更」の件数の上限。 */
    maxStructuralChanged: 100,
    /** 自動で書き換えてよい列（それ以外の列の変更は手動の経路）。 */
    changedFieldAllowlist: ["card_rating", "maximum_level", "ovr_max"],
    /** 自動でも許す手動確認の理由（baseline_missing は World の適用で毎回付く構造上のもの）。 */
    allowedManualReviewCodes: ["baseline_missing"],
  },
  managers: {
    targetTable: "managers",
    /** 追加だけを自動にする（既存行の更新は手動の経路）。 */
    maxAdded: 10,
    maxUpdated: 0,
    /** manager_change は Managers の変更すべてに付く。追加だけ・更新 0 の条件と合わせて許す。 */
    allowedManualReviewCodes: ["baseline_missing", "manager_change"],
  },
  /** Backup は完了から 24 時間まで有効（手動の承認画面と同じ）。 */
  backupValidHours: 24,
  /** 公開サイトの件数の確認（読み取りだけ・認証なし）。 */
  publicSite: {
    baseUrl: "https://efootball-team-ai.vercel.app",
    paths: { world: "/api/world/players?pageSize=1", managers: "/api/managers?pageSize=1" },
    /** 公開 API のキャッシュ（max-age 60 秒）を待つ時間の上限。 */
    waitMs: 5 * 60_000,
  },
  /** 自動 Apply の実行先 Environment（承認者なし・main だけ・書き込みの資格情報だけ）。手動の経路は reference-data-production-apply のまま。 */
  automaticEnvironment: "reference-data-production-apply-automatic",
  manualEnvironment: "reference-data-production-apply",
  /** この label の Issue が open の間は、自動 Apply をしない（事後検証の失敗で自動で作る）。 */
  haltIssueLabel: "reference-data-auto-apply-halt",
  killSwitches: {
    all: "REFERENCE_DATA_AUTO_APPLY_ENABLED",
    world: "REFERENCE_DATA_AUTO_APPLY_WORLD_ENABLED",
    managers: "REFERENCE_DATA_AUTO_APPLY_MANAGERS_ENABLED",
  },
} as const;
