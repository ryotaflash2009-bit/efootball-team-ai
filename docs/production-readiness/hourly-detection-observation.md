# 毎時の検出の観測契約（2026-10-06〜2026-10-13）

本人の決定（2026-10-06）: 毎時の検出は当面 GitHub Actions の schedule だけを使う。外部 Cron サービス・新しい Token・Secret・
外部契約・有料サービスは追加しない。2026-10-13 まで schedule の実行状況を観測し、その結果で外部の起動を再検討する。

この文書は観測の定義・手順・判定の条件を決める。cron（`17 * * * *`）・Auto Apply policy・閾値・changed-field allowlist・
Kill switch・Secrets・Environments・Backup・Rollback / Restore の方針は変えない。

## 1. 観測の手順（読み取りだけ）

```
SINCE=2026-10-06T00:00:00Z UNTIL=<終了時刻> REPORT_PATH=./docs/production-readiness/evidence/<日付>-hourly-detection-observation.json \
  node scripts/observe-hourly-detection.mjs
```

- GitHub CLI（ログイン済み）で、detection workflow の run の一覧・各 run の要約（artifact `reference-data-detection-summary`）・
  通知 Issue #112 のコメント・workflow の状態を読む。workflow の起動・変数・Secret・cron には触れない。
- 要約の保持期間は 7 日。**観測の最終日（2026-10-13）の前に、2026-10-09 ごろに一度実行して途中の Evidence を保存する**
  （10-06 以降の run の要約が期限切れになる前に）。
- 集計の規則は `scripts/lib/hourly-schedule-observation.mjs`（pure）、テストは `src/lib/reference-data/auto-update/hourly-schedule-observation.test.ts`。

## 2. 観測する項目の定義

| 項目 | 定義 |
|---|---|
| Expected run | 観測期間の毎時 17 分（UTC）の枠の数 |
| Actual run | 枠に割り当てた schedule の run の数（run は作成時刻以前で最も新しい枠に入る） |
| Scheduled timestamp | 枠の時刻（`slots[].slot`） |
| Started timestamp | run の開始時刻（`slots[].startedAt`） |
| Delay | run の作成時刻 − 枠の時刻（分。0〜59） |
| Missing slot | run が無い枠 |
| Consecutive missing slots | 連続した欠落の最大の数 |
| Last successful detection | 成功した最後の検出（schedule・手動の両方） |
| Maximum gap | 成功した検出の間隔の最大（期間の最後で続いている間隔を含む） |
| Light detection | 要約の `mode: "light"`（World は 1 request の信号だけ・Managers は全件の比較） |
| Full scan | 完全な回（World 約 445 request + Managers 1 request） |
| No change | 完全な回の `overall: no_change` |
| Light, no signal change | 軽い回の `no_change_light`（World は全件を比較していないので「変化なし」とは数えない） |
| Change detected | `overall: update_available` |
| Failure | run の失敗、または要約の `attention_required` / `fetch_stopped` |
| Skip | run の結果が `skipped`（有効化の変数が `true` でない等） |
| Concurrency | 前の run が終わる前に作られた run の数（`concurrency` で 2 件が同時に動かないことの確認） |
| Request count / Downloaded bytes | 要約の `upstream.requests` / `upstream.totalBytes` の合計 |
| Duration | run の作成〜更新の秒数（中央値・合計） |
| Actions summary | 各 run の要約（artifact・7 日） |
| Issue notification | #112 の「Hourly detection schedule gap」の通知の数（130 分の基準・6 時間の抑制） |
| Delayed detection | `update_available` を検出した run の直前の成功した検出から 130 分を超えていた回数 |

## 3. 外部 Cron を再検討する条件（本人の決定）

次のどれかに当てはまれば、外部の起動の再検討を本人に提案する（自動では何も変えない）:

1. 6 時間以上 Detection がない（`reconsider.gapAtLeast6h`）
2. 上流の更新の検出に重大な遅れが出た（Delayed detection の内容で判断）
3. 更新の検出の遅れが 2 回以上（`reconsider.delayedDetectionsTwiceOrMore`）
4. schedule が継続的に無効化または欠落した（`reconsider.scheduleDisabled`・連続の欠落）
5. 長期的に予定の run の約半数以上が欠落した（`reconsider.missingAboutHalfOrMore`・24 枠以上の期間）

130 分の通知（`buildScheduleGapNotice`）は維持する。

## 4. 観測の開始時点の状態（2026-10-04T17:00Z〜2026-10-06T08:33Z）

Evidence: `docs/production-readiness/evidence/2026-10-06-hourly-detection-observation-baseline.json`

- Expected 40 / Actual 7 / **Missing 33（82.5%）**・連続の欠落の最大 8・**最大の間隔 538 分**（10-05 07:00Z → 15:58Z）。
- 遅れ（run があった枠）: 中央値 37 分・最大 43 分。同時実行 0・失敗 0・skip 0。
- 軽い回 2・完全な回 5（間隔が 6 時間を超えるため、ほとんどが完全な回になる）。
- 上流: 2,244 request・約 147 MB・合計 7,861 秒（Public リポジトリのため GitHub Actions の費用は 0）。
- #112 の間隔の通知 5 件（6 時間の抑制で 1 件は抑制）。
- **観測の開始時点で、条件 1・3・5 にすでに当てはまる。** 本人の決定どおり 2026-10-13 まで観測を続け、その結果を本人に報告する。

## 5. 欠落しても更新を取りこぼさない契約

テスト: `hourly-schedule-observation.test.ts` の「schedule が欠落しても、次の run で更新を取りこぼさない」。

- 比較の基準は前回の run ではなく `docs/production-readiness/reference-data-applied-state.json`（適用済みの状態）。
  何枠欠落しても、次の完全な回は適用済みの状態との差を全部見る。
- 前回の完全な検出から 6 時間たっていれば、次の run は必ず完全な検出をする（`full_scan_due`）。
  World の信号（件数・ページ数・1 ページ目の内容）が変われば 6 時間を待たない（`world_signal_changed`）。
- 状態（Actions cache）が失われても、次の run は完全な検出をする（`no_previous_state` / `invalid_state`）。
- Managers は毎回全件を比較する（1 request）。
- 適用されていない更新は、同じ checksum でも 24 時間後に再び Pipeline へ渡る（`markRepeatCandidate`）。

## 6. 観測中に分かった別の問題（本人の操作が必要）

- 2026-10-05T06:17 の枠の run（37275322242）が World の更新（`update_available`・16 件の評価値の更新・追加 0）を検出し、
  Pipeline が Plan → Backup → Dry run → Apply まで自動で進んだ。Auto Apply policy の判定は `AUTO_APPLY_ELIGIBLE`。
- Apply（run 37280705852）は **Production の DB への接続で失敗**（`connect_failed:sqlstate_28P01` = パスワード認証の失敗）。
  **Production への書き込みは無い。** 公開データは 10-03 の適用のまま（World 13,372・Managers 69）。
- 原因の候補: Environment `reference-data-production-apply-automatic` の Secret `REFERENCE_DATA_APPLY_DB_URL`（2026-10-03T16:22Z 登録）の値。
  手動の Environment `reference-data-production-apply` の同名の Secret は 10-03 の適用で接続できている。値は確認していない（禁止事項）。
- 本人の操作: 自動用の Environment の `REFERENCE_DATA_APPLY_DB_URL` を正しい値で登録し直す（Session pooler・apply 用の role）。
  直すまで、同じ更新は 24 時間ごとに Pipeline へ渡り、Backup・Dry run の後の Apply で同じように止まる（書き込みなし・Issue の通知あり）。

## 7. 観測の終了（2026-10-13）

1. §1 のコマンドで `SINCE=2026-10-06T00:00:00Z UNTIL=2026-10-13T23:59:59Z` の Evidence を作る（10-09 ごろの途中の Evidence と合わせる）。
2. §3 の条件の結果・Missing・最大の間隔・検出の遅れを本人に報告する。
3. 外部の起動を採るかは本人が決める（Token・Secret・外部の契約が要るため、自動では採らない）。
