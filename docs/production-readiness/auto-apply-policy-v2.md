# 自動 Apply の判定 v2 と古い承認待ちの取り消し（2026-10-11）

本人の指示「完全自動更新を完成させて」。

## 何が止まっていたか

- 2026-10-09 の World の更新（Plan run 37875124827: 13,372 → 13,455・追加 83・更新 3,310・card_rating だけ 2,588・構造 722）は、
  v1（`auto-apply-policy/2026-10-03.v1`）の「構造の変更 100 件まで」と「書き換えてよい列 = card_rating・maximum_level・ovr_max」に当たり、
  `MANUAL_APPLY_REQUIRED（threshold_structural, unknown_changed_field）` で手動の経路（承認待ち）になった。
  変わった列: card_rating 2,712・league 560・appearance_updated_at 91・team 85・name_ja 22・name_en 18・name_sort_key 18（通常のシーズンの更新）。
- 承認待ちの Apply（run 37877548531）が 40 時間そのままになり、書き込みの concurrency（`reference-data-production-write`）が埋まって、
  次の Plan（run 37960339182）も保留のまま。その間に上流は 13,455 件（候補 3c064cdf73ae）になり、毎時の検出は候補を見つけ続けたが進めなかった。
- 承認待ちの Apply が binding した Backup は 24 時間で期限切れになるため、承認しても `backup_expired` で止まる＝実行できない run だった。

## v2（`auto-apply-policy/2026-10-11.v2`）

| 項目 | v1 | v2 |
|---|---|---|
| 書き換えてよい列 | card_rating・maximum_level・ovr_max | ＋ name_en・name_ja・name_sort_key・team・league・region・image_url・mobile_image_url・appearance_updated_at・age |
| 構造の変更の上限 | 100 件 | 適用前の件数の 10%（13,372 件なら 1,337 件） |
| 追加の上限 | 2% | 同じ |
| 更新の上限 | 50% | 同じ |
| 手動の経路に残す列 | — | stats・skills・registered_position・playing_style・playing_style_def・ovr_base・card_type・preferred_foot・nationality・height・weight（計算・判定に効く） |
| 止める条件（自動でも手動でも） | 削除・重複・不正・件数の減少・件数の不一致・未来の時刻・時刻の逆行・スキーマの差・Backup の期限切れ・Dry run の不一致 | 同じ |

テスト: 2026-10-09 の実際の Plan が v2 で `AUTO_APPLY_ELIGIBLE`・計算に効く列が混ざれば手動・削除や不正は v2 でも止まる（`auto-apply-policy.test.ts`）。

## 古い承認待ちの取り消し（watchdog）

`reference-data-detection-watchdog.yml`（3 時間ごと）が、`reference-data-production-apply.yml` の run のうち、状態が waiting / pending / queued /
requested で作成から 24 時間以上のものを取り消す（`scripts/lib/stale-approval.mjs`・テスト 3）。実行中・完了の run と他の workflow には触れない。
Production への書き込みは無い。取り消しの後、次の検出の候補が新しい Plan・Backup・Dry run で進み、v2 で自動の対象なら無人で Apply される。

停止: 自動 Apply の kill switch（`REFERENCE_DATA_AUTO_APPLY_ENABLED` 等）・halt の Issue・検出の変数・watchdog の停止の変数（従来どおり）。
Rollback: v1 に戻す PR（`auto-apply-policy-config.ts`）。

## 適用済みの記録の自動の更新（`reference-data-applied-state-sync.yml`）

Apply（applied_verified）の後、Evidence の artifact の `applied-state.candidate.json` から `reference-data-applied-state.json` と
Evidence の JSON（`evidence/<world|managers>-auto-apply-<日付>-<run>.json`）を作り、`github-actions[bot]` が main へ直接 commit する（手の PR は不要）。
- 起動: Orchestrator・Production apply の完了（workflow_run）・手動（confirm `sync`）。
- Orchestrator・Apply・Backup が実行中・待機中なら何もしない（Apply が binding した main の SHA を変えない）。次の完了で再試行。
- World の `maxAppearanceUpdatedAt` は、同じ候補の checksum の検出の要約の `timestamps.max` から取る（無ければ更新しない）。
- 古い・同じ checksum・件数の減少・形の不正な候補は使わない（`scripts/lib/applied-state-sync.mjs`・テスト）。
- commit できるのは 2 種類のファイルだけ（それ以外が混ざれば失敗）。push は main の fast-forward だけ。
- 停止: リポジトリの変数 `REFERENCE_DATA_APPLIED_STATE_SYNC_DISABLED` = `true`。

## v3（2026-10-12）: Managers の表示の列の更新を自動に

- 実例: 2026-10-11 16:08Z の Managers の更新（追加 1・既存 1 人の `link_up_plays` の変更）が v2 の「Managers は更新 0 件だけ自動」に当たり、
  手動の承認待ち（apply 38154230610）のまま書き込みのロック（`reference-data-production-write`）を持った。次の World の Plan（38211899640）が
  始まれず、Orchestrator（38211859381）が `run_timed_out` で止まった（データの書き込みなし）。
- v3（`auto-apply-policy/2026-10-12.v3`）: Managers の**表示の列**（`link_up_plays`・`has_link_up_play`・`name_en`・`name_sort_key`・`released_at`・
  `source_url`）だけの更新を 5 人まで自動にする。計算に効く列（`boosters`・`booster_confirmation`・`has_booster`・6 つの戦術の適性）は引き続き手動。
  updater の列の権限（`create-reference-data-updater-role.sql`）の内側だけ。
- 古い承認待ちは watchdog が 24 時間で取り消す（変更なし）。取り消しの後の次の検出から v3 で判定する。

## v4（2026-10-15）

- World の通常の更新（追加 62・更新 5,844・うち構造の変更 3・orchestrator run 38730110408・dry run verified）が、国籍（`nationality`）の変更 3 枚だけで
  `unknown_changed_field` になり、手動の承認待ちで止まった（本人の指示「なんとしてでも最新の情報に」）。
- 国籍は表示と絞り込みの列で、計算に使わない（チーム・リーグ・地域と同じ扱い）。`world.changedFieldAllowlist` に `nationality` を足した。
- それ以外の条件（追加 2%・更新 50%・構造の変更 10%・削除 0・重複 0・schema drift 0・Backup・dry run の検証）は変えない。
- 承認待ちのまま止まっていた Apply（run 38734019692）は取り消し（書き込みなし）、v4 で検出からやり直す。
