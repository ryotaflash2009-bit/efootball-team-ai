# 毎時の検出: 判断パッケージ（2026-10-10 確定版・案 D を実装）

2026-10-10 の本人の指示「自動更新を完全に完成させて」により、2026-10-08 の下書きで推奨した **案 D（GitHub の中の watchdog）を実装**した。
外部 Cron・新しい Token / Secret・外部サービス・Production の設定・費用は変えていない（2026-10-06 の本人の決定 (a) の範囲）。
2026-10-13 の観測の締めくくりは「確認」だけで、本人の操作は不要（§7）。

## 1. 観測（読み取りだけ）

| 項目 | 10-04〜10-07 | 10-06〜10-10（`evidence/hourly-detection-observation-2026-10-10.json`） |
|---|---|---|
| 期待の枠 / 実行 | 73 / 12 | 111 / 19 |
| 欠落 | 84% | 83% |
| 最大の間隔 | 1,448 分（約 24 時間） | 452 分 |
| 遅延（中央値 / 最大） | 26 / 56 分 | 37 / 56 分 |
| 失敗・skip・取り消し・同時実行 | 0 | 0 |
| 所要時間（中央値） | 1,553 秒 | 1,552 秒（ほぼすべて完全な走査: 前回から 6 時間以上あくため） |
| 間隔の通知（130 分） | — | 15 回（毎回の通知＝意味のない通知） |

更新の反映: 2026-10-07 の World の更新は、欠落のため手動の検出で見つけ、無人の Apply で反映した（`evidence/world-auto-apply-2026-10-07.json`）。

## 2. 毎時は必要か（推奨の頻度）

- 上流（eFootball World・監督の JSON）の更新は週 1 回前後（木曜のメンテナンスの後）と臨時。applied-state の記録: 09-25・09-26・10-03・10-07。
- 1 時間ごとの検出は不要。必要なのは「更新から半日以内に確実に反映する」こと。
- **推奨: 毎時の schedule（軽い回）は今のまま・World の完全な走査は 6 時間ごと（今の規則）・watchdog で「6 時間 30 分を超えた欠落」を 3 時間ごとに埋める。**
  正常なら検出の間隔は最大でおよそ 10 時間（6.5 時間 + watchdog の 3 時間 + 遅延）。

## 3. 選択肢と採用

| 案 | 新しい Secret | 外部の当事者 | 費用 | 欠落への効果 | 判断 |
|---|---|---|---|---|---|
| A. GitHub の schedule だけ | なし | なし | 0 | なし（約 24 時間の間隔） | 不採用（実績で不足） |
| B. 外部 cron（毎時） | 要（PAT `actions:write`） | あり | 0 | 大 | 不採用（本人の決定 (a)・Token の管理と攻撃面） |
| C. 外部 cron（2 時間ごと） | 要 | あり | 0 | 中 | 不採用（同上） |
| **D. GitHub の中の watchdog** | **なし**（`GITHUB_TOKEN`） | なし | 0 | 中〜大 | **採用（2026-10-10）** |

D でも 600 分を超える間隔の通知が 10 月末までに週 2 回以上残る場合だけ、B/C を本人の判断で再検討する（§8）。

## 4. 実装（`.github/workflows/reference-data-detection-watchdog.yml`）

| 項目 | 内容 |
|---|---|
| 起動 | `43 */3 * * *`（3 時間ごと・検出の 17 分と重ならない）・手動は confirm `watchdog` |
| 判定 | `scripts/lib/detection-watchdog.mjs`（pure）: 最後に成功した検出が 6 時間 30 分より古ければ 1 回 dispatch |
| 起動しない | 検出が実行中・待機中（二重の起動の防止）／直近の検出が失敗（失敗の通知に任せる・再試行しない）／直近が skip／変数で停止 |
| 権限 | workflow 全体 `contents: read`・job だけ `actions: write`（検出の `workflow_dispatch` のため）。Secrets・Environment なし |
| 同時実行 | `concurrency: reference-data-detection-watchdog`（cancel-in-progress なし）。検出側も既存の concurrency |
| 冪等性・差分 0 | 起動された検出は通常の検出と同じ（候補の checksum・`repeatCandidate`・差分 0 は `no_change`）。Apply の規則・閾値・Kill switch は不変 |
| 誤検出・急な件数の変化・削除・スキーマの差分 | 既存の検出 → Orchestrator → 自動 Apply の方針（`auto-apply-policy-config.ts`）で止まる。watchdog は判定に関わらない |
| Production の書き込み | watchdog はなし。Apply は既存の経路だけ（Backup・Dry run・検証・監査・ロールバックの手順も既存） |
| 通知 | 成功・失敗は既存の通知（Issue #112・GitHub の失敗の通知）。間隔の通知の基準を 130 → 600 分に変更 |
| ログ・Evidence | watchdog の判定は Actions の Step summary（理由・最後の成功・分）。保持は GitHub の既定 |
| 停止（watchdog だけ） | リポジトリの変数 `REFERENCE_DATA_DETECTION_WATCHDOG_DISABLED` = `true`（即時・0 request） |
| 緊急停止（全体） | 既存: 検出の変数 `REFERENCE_DATA_AUTO_UPDATE_DETECTION_ENABLED` を `true` 以外・自動 Apply の Kill switch・Halt ラベル |
| テスト | `detection-watchdog.test.ts`（6）・`update-schedule.test.ts`（schedule を持つ workflow の許可リスト・watchdog の監査: 起動先は検出だけ・Secrets なし・権限・Gate・concurrency）・`hourly-notify.test.ts` |
| Dry run | ローカルで workflow の判定の step を偽の run の一覧で実行（stale → dispatch・fresh → なし）を確認済み |

## 5. 費用・回数（見積もり）

| | 1 日 | 1 か月 |
|---|---|---|
| watchdog の run | 8 回 × 約 20 秒 | 240 回 × 約 20 秒 ≈ 80 分 |
| watchdog が起動する検出 | 欠落の状況しだい（0〜4 回） | — |
| 上流への request | 増えない（起動される回は 6 時間ごとの完全な走査の規則で本来走る回・約 445 request） | 設計の約 55,000 / 月 以内 |
| 費用 | **0 円**（Public リポジトリの GitHub-hosted runner は無料） | 0 円 |
| 上流のタイムアウト・再試行 | 既存（429 / 403 / challenge で停止・失敗の後は 2 時間あける）。watchdog は失敗の後に起動しない | — |

## 6. 反映の手順（この PR のマージで有効）

1. PR → CI → 通常のマージ（main）。検出の変数は既に `true` なので、マージの後の最初の `43 */3` の枠から動く。
2. 確認（Claude Code・読み取りだけ）: `gh run list --workflow reference-data-detection-watchdog.yml --limit 5` で run が作られ、Step summary に判定の理由が出ること。
3. 最後の成功が 6 時間 30 分より古い時点で、検出が `workflow_dispatch` で 1 回作られ、その完了で Notify・Orchestrator（`workflow_run`）が続くこと。
   **確認済みの前例**: `GITHUB_TOKEN`（`github-actions[bot]`）で起動した run の完了でも `workflow_run` は起きる。2026-10-07 の自動の Apply
   37643713008（actor・triggering actor とも `github-actions[bot]`）の完了の 15 秒後に Pipeline notify 37643986865（`workflow_run`）が起動した。
4. ロールバック: 変数 `REFERENCE_DATA_DETECTION_WATCHDOG_DISABLED` = `true`（即時）、または watchdog の workflow を消す PR。Production の状態は何も変わらない。

## 7. 2026-10-13 の確認（本人の操作は不要）

- 観測: `SINCE=2026-10-06T00:00:00Z UNTIL=2026-10-13T23:59:59Z REPORT_PATH=./docs/production-readiness/evidence/hourly-detection-observation-2026-10-13.json SKIP_SUMMARIES=1 node scripts/observe-hourly-detection.mjs`
  （`SKIP_SUMMARIES=1` は artifact をワークスペースの外の一時フォルダへ落とさないため）。
- GO（このまま継続）: watchdog の run が作られている・最大の間隔（検出の成功どうし）が 10-11 以降 600 分以下・失敗 0。
- NO-GO（watchdog を止めて調べる）: watchdog が検出を 1 日 4 回以上起動している／watchdog の起動の直後に検出が失敗している（上流の 429 等）／
  予期しない workflow の起動。→ 変数 `REFERENCE_DATA_DETECTION_WATCHDOG_DISABLED` = `true`。

## 8. 再検討の条件（将来）

- 600 分を超える間隔の通知が週 2 回以上 → B/C（外部 cron・本人の判断と Token の登録が必要）を検討。
- 60 日間の無活動で schedule が無効になる GitHub の仕様は、watchdog でも防げない（`hourly-detection.md` §7）。
