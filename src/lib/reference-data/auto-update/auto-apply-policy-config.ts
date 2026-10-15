/**
 * 完全無人の Production Apply（自動 Apply）の契約と閾値（本人の決定 2026-10-03）。
 *
 * - ここに無い値（隠れた閾値）は使わない。値を変えるときは版（version）を上げ、テストと Evidence を更新する。
 * - 閾値は、検証済みの実績（World 2026-10-03: 13,297 → 13,372・追加 75・更新 5,675・構造 6、Managers: 67 → 69・追加 2）を
 *   必要以上に広げない値にする。
 * - v2（2026-10-11・本人の指示「完全自動更新を完成させて」）: 2026-10-09 の World の通常の大型更新（13,372 → 13,455・追加 83・
 *   更新 3,310・構造 722: league 560・team 85・name_ja 22・name_en 18・name_sort_key 18・appearance_updated_at 91）が、v1 の
 *   「構造 100 件まで・card_rating 系だけ」に当たって本人の承認待ちのまま 40 時間止まった。v2 は、通常の更新で変わる**表示の列**
 *   （名前・チーム・リーグ・地域・画像・掲載日・年齢）を自動にし、構造の変更の上限を件数から割合（10%）に変える。
 *   計算に効く列（stats・skills・registered_position・playing_style・ovr_base・card_type・preferred_foot・nationality 等）は
 *   引き続き手動の経路。削除・重複・不正・件数の減少・時刻の逆行・スキーマの差は v1 と同じく止める。
 * - v3（2026-10-12）: Managers の通常の更新（2026-10-11: 追加 1・既存 1 人の link_up_plays の変更）が「更新 0 件だけ自動」に当たり、
 *   承認待ちのまま書き込みのロックを持ち、次の World の Plan が始められずに止まった。v3 は Managers の**表示の列**（Link-Up の一覧・名前・
 *   掲載日・出典の URL）の更新を 5 人まで自動にする。計算に効く列（boosters・booster_confirmation・has_booster・6 つの戦術の適性）は
 *   引き続き手動の経路。
 * - Rollout: A（validator・mock・静的監査・使い捨て PostgreSQL）→ B（shadow: 手動承認のまま判定を記録）→ C（自動 Apply）。
 *   実際に自動で書き込むのは、Repository variable の kill switch がすべて "true" のときだけ（それ以外は手動承認の経路）。
 */
export const AUTO_APPLY_POLICY = {
  version: "auto-apply-policy/2026-10-15.v4",
  rollout: "C",
  world: {
    targetTable: "world_player_cards",
    /** 追加件数 / 適用前の件数 の上限。 */
    maxAddRatio: 0.02,
    /** 更新件数 / 適用前の件数 の上限（card_rating だけの変更を含む）。 */
    maxUpdateRatio: 0.5,
    /** card_rating 以外の列も変わる「構造の変更」の件数 / 適用前の件数 の上限（v2: 件数 100 → 割合 10%）。 */
    maxStructuralRatio: 0.1,
    /** 自動で書き換えてよい列（それ以外の列の変更は手動の経路）。v2 で表示の列を追加。 */
    changedFieldAllowlist: [
      "card_rating",
      "maximum_level",
      "ovr_max",
      "name_en",
      "name_ja",
      "name_sort_key",
      "team",
      "league",
      "region",
      // v4（2026-10-15）: World の通常の更新（追加 62・更新 5,844）が国籍の変更 3 枚だけで手動の承認待ちになった。
      // 国籍は表示と絞り込みの列で、計算に使わない（チーム・リーグ・地域と同じ扱い）。
      "nationality",
      "image_url",
      "mobile_image_url",
      "appearance_updated_at",
      "age",
    ],
    /** 自動でも許す手動確認の理由（baseline_missing は World の適用で毎回付く構造上のもの）。 */
    allowedManualReviewCodes: ["baseline_missing"],
  },
  managers: {
    targetTable: "managers",
    maxAdded: 10,
    /** v3: 表示の列だけの更新を 5 人まで自動（v2 までは 0）。 */
    maxUpdated: 5,
    /** v3: 自動で書き換えてよい列（updater の列の権限の内側）。それ以外の列の変更は手動の経路。 */
    changedFieldAllowlist: ["link_up_plays", "has_link_up_play", "name_en", "name_sort_key", "released_at", "source_url"],
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
