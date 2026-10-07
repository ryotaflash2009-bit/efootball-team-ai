# 毎時の検出: 継続・外部 Trigger の判断パッケージ（下書き・2026-10-08）

最終の判断は 2026-10-13 の最終 Evidence（`evidence/hourly-detection-observation-2026-10-13.json`）の後。
この文書は判断の材料を先にそろえる。**cron・変数・Secret・外部サービスは何も変えていない。**

## 1. 観測（読み取りだけ・2026-10-07 13:32Z の snapshot）

| 項目 | 値 |
|---|---|
| 期間 | 2026-10-04T12:27Z〜2026-10-07T13:32Z（cron `17 * * * *`） |
| 期待の slot / 実行 | 73 / 12（手動 2 を除く）・欠落 61（84%） |
| 最長の連続の欠落 / 最大の間隔 | 8 slot / 1,448 分（約 24 時間） |
| 遅延（中央値 / 最大） | 26 分 / 56 分 |
| 失敗・skip・取り消し・同時実行の重なり | 0・0・0・0 |
| 完全な走査 / 軽い確認 | 9 / 3（完全な走査の中央値 1,553 秒） |
| 通信 | 4,038 request・264 MB |
| 判定の補助 | `reconsiderExternalTrigger: true`（6 時間以上の間隔・半分以上の欠落・2 回以上の遅延した検出） |

更新の反映の実績: 2026-10-07 の World の更新（079f9eaf92a0）は、検出の欠落のため手動の検出で見つけ、無人の Apply で反映した
（`evidence/world-auto-apply-2026-10-07.json`）。

## 2. 選択肢

| 案 | 内容 | 新しい Secret / Token | 攻撃面 | 運用負担 | 費用 | 欠落への効果 |
|---|---|---|---|---|---|---|
| A. GitHub の schedule を継続 | 今のまま | なし | 増えない | なし | 0 | なし（約 24 時間の間隔が起こりうる） |
| B. 無料の外部 cron（毎時） | 外部サービスが `workflow_dispatch` を呼ぶ | **要**（fine-grained PAT・`actions:write`・このリポジトリだけ） | 外部のサービスに Token を預ける。漏れると任意の workflow を dispatch できる（自動 Apply は bot の起動だけを受け付け、手動の Apply は reviewer が必要なので書き込みには直結しない） | Token の期限の更新（最長 1 年）・外部の障害の監視 | 0 | 大 |
| C. 外部 Trigger を 2 時間ごと | B と同じで間隔を広げる | 要 | B と同じ | B と同じ | 0 | 中（上流の rate limit の余裕が増える） |
| D. 6 時間の watchdog（GitHub の中だけ） | 別の schedule の workflow が「最後の成功した検出からの時間」を読み、6 時間を超えたら `GITHUB_TOKEN` で検出を `workflow_dispatch` する | **不要**（`GITHUB_TOKEN` は workflow_dispatch を起動できる） | 増えない（リポジトリの中だけ・permissions は `actions: write` を watchdog の job だけに） | 小 | 0 | 中（watchdog 自体も GitHub の schedule に依存するが、複数の時刻に置けば同時の欠落の確率は下がる） |

### 確認しておく点

- 上流の rate limit: 2026-10-06 に「完全な走査 → 直後の Plan」で 429 があった。2026-10-07 は 446 request すべて 200。外部 Trigger を増やす場合も、
  完全な走査は 6 時間に 1 回（今の規則）を変えない。
- 重複の起動: 検出の workflow は `concurrency`（cancel-in-progress なし）があり、同じ候補は 24 時間に 1 回だけ Pipeline へ渡る（`repeatCandidate`）。
- 通知: 同じ通知は 6 時間に 1 回まで（Issue #112）。

## 3. 推奨（暫定・10-13 の数値で確定）

**D（GitHub の中の 6 時間 watchdog）を追加し、A を続ける。** 新しい Token・外部の当事者を増やさずに、最大の間隔（今は約 24 時間）を
おおむね 6〜7 時間へ縮められる。D を入れても 10 月末までに 6 時間を超える間隔が残る場合だけ、B（または C）を本人の判断で検討する。

- 採用する場合の作業（本人の承認の後・cron の変更を含むため今回は実施しない）: watchdog の workflow（読み取りの `gh run list` 相当の API と
  `workflow_dispatch` だけ）、テスト（間隔の判定の純関数）、runbook の追記。
- 不採用: B/C を最初から入れる案（Token の管理の負担と攻撃面に対して、D で足りるかをまず確かめる）。

## 4. 10-13 の最終 Evidence で埋める項目

期待の slot・実行・欠落・連続の欠落・最大の間隔・遅延の中央値と最大・最後の成功・軽い確認・完全な走査・変化なし・変化あり・失敗・skip・
request・byte・所要時間・同時実行・通知の抑制・更新の検出の遅れ（上流の更新の時刻 → 検出の時刻）。
コマンド: `SINCE=2026-10-06T00:00:00Z UNTIL=2026-10-13T23:59:59Z REPORT_PATH=./docs/production-readiness/evidence/hourly-detection-observation-2026-10-13.json node scripts/observe-hourly-detection.mjs`
