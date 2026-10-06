# 参照データの毎時の検出（2026-10-04）

本人の決定（2026-10-04）: 完全無人の自動更新の検出を、週 1 回から **24 時間・1 時間おき（1 日最大 24 回）** にする。
Auto Apply の Policy・閾値・Kill switch・halt Issue・手動の経路・Rollback / Restore を自動にしない方針は**変えない**。

## 1. Schedule

| 項目 | 変更前 | 変更後 |
|---|---|---|
| cron | `17 18 * * 0`（週 1 回・月曜 03:17 JST） | **`17 * * * *`**（毎時 17 分） |
| 1 日の検出の回数 | 週 1 回 | **24 回** |
| 時間帯 | UTC（GitHub の cron） | 1 時間おきなので UTC / JST の差は結果に影響しない |
| 手動の実行 | `workflow_dispatch` + `detect` | 変更なし（手動は常に完全な検出） |

毎時 00 分を使わないのは、GitHub Actions の混雑を避けるため（既存の 17 分の運用とも合わせた）。

## 2. 毎時の検出の中身（軽い回と完全な回）

上流（eFootball World）は、更新の有無を示す metadata（ETag・Last-Modified・更新日時順の取得）の契約を提供していない
（`sortBy UPDATED_AT` は HTTP 400）。そのため **推測で「World は変更なし」とは判定しない。**

| | 毎時の軽い回 | 完全な回 |
|---|---|---|
| Managers | `managers.json` の全体（1 request）を applied-state と比べる（**完全な比較**） | 同じ |
| World | 検索の 1 ページ目（作成日の新しい順）と総件数・総ページ数（1 request）だけ。decision は **`not_scanned`** | 全件（約 445 request）を比べる |
| overall | `no_change_light` / `update_available`（Managers だけ）/ `attention_required` | 従来どおり |
| 要約の schema | `reference-data-detection-summary/light-v1` | `…/v2`（`mode: "full"`・`worldScan` に理由） |

完全な World の検出を行う条件（`update-detection-light.ts`。迷ったら完全な検出）:

1. World の信号（総件数・総ページ数・1 ページ目の指紋 = 正規化したカードの ID と表示内容の更新時刻）のどれかが変わった
2. 前回の完全な検出から **6 時間**（`WORLD_FULL_SCAN_INTERVAL_MS`）。既存カードの能力値の変更は遅くとも 6 時間で検出する
3. 前回の状態が無い・壊れている・時刻が未来
4. 前回の完全な検出が失敗した → **2 時間**あけて再試行（失敗中に毎時 445 request を繰り返さない）
5. 手動の実行

状態（信号・最後の完全な検出の時刻と結果・最後に報告した候補）は GitHub Actions の cache に保存する
（公開情報の要約だけ・Secret なし）。cache が消えても、次の回が完全な検出になるだけ。

## 3. 変化があったとき（既存の完全無人の Pipeline）

```
検出（update_available の dataset だけ）→ Orchestrator → Plan → Backup → Dry run → Auto Apply Policy
  → ELIGIBLE かつ Kill switch すべて true かつ halt Issue なし → 自動 Apply → 事後検証 → 通知
  → それ以外 → Apply の前で停止 / 本人の承認待ち（従来どおり）
```

- World と Managers は別々に判定する。World だけ・Managers だけ・両方（World の後に Managers）。
- 毎時は**検出だけ**。Backup・Restore の検証・Dry run・Apply・総合 black-box は、変化があったときの Pipeline だけで行う。

## 4. 重複・同時実行の排除

| 状況 | 動作 | 仕組み |
|---|---|---|
| 前の検出が実行中 | 新しい検出は**待機**（待機は最新の 1 件だけ） | 検出 workflow の concurrency（`cancel-in-progress: false`） |
| 重い Pipeline（Orchestrator）が実行中 | 新しい検出は実行・記録して終了。Orchestrator は前の完了後に**最新の候補**を改めて判定（古い待機は GitHub が最新に置き換える） | Orchestrator の concurrency（`cancel-in-progress: false`） |
| Backup / Apply が実行中 | 途中で取り消さない。次は待機 | Backup・Apply の concurrency（`cancel-in-progress: false`。Backup は今回追加） |
| 同じ checksum の候補（24 時間以内） | Pipeline を**起動しない**・通知しない（`repeatCandidate: true`）。1 日 1 回は再試行 | `markRepeatCandidate`・`decideFromDetection`・通知 |
| 自動 Apply 済みの候補（applied-state の PR 前） | 二重に適用しない | 既存の `latestAutoApplied`（Orchestrator） |
| 新しい checksum | 前の完了後に、Plan で最新の上流を取り直して判定（古い候補は Apply しない） | 既存の Plan → Dry run の束縛（checksum・re-diff 0） |
| Production への書き込み | 1 つずつ | Apply の concurrency `reference-data-production-write`・DB の advisory lock（既存） |

stale lock: 独自の lock は持たない（GitHub の concurrency と DB の advisory lock は、job の終了で解放される）。

## 5. 通知（重複の抑制）

- 軽い回の変化なし（`no_change_light`）・同じ候補の繰り返しは通知しない。
- 同じ失敗・要確認の通知は、6 時間以内なら繰り返さない（`shouldThrottleNotification`）。Issue は 1 件にまとめる（既存）。
- **定期実行の間隔**: 前回の検出 run から 130 分を超えたら通知する（`buildScheduleGapNotice`。GitHub の schedule の遅れ・欠落）。

## 6. 使用量・費用・上流の負荷（見積もり）

実測（2026-10-04）: 完全な検出 約 25 分（上流への request を間隔をあけて送るため）・通知 約 15 秒・Orchestrator の実行なし 1〜5 分。
軽い回は約 2 分（checkout・npm ci・tsc・2 request）と見積もる。

| | 1 日 | 1 か月（30 日） |
|---|---|---|
| 検出の回数 | 24（軽い 20 + 完全 4 の目安） | 720 |
| 検出の Actions 時間 | 20 × 2 分 + 4 × 25 分 ≈ 140 分 | ≈ 4,200 分 |
| 通知・Orchestrator（実行なし） | 24 × (0.3 + 1.5) 分 ≈ 43 分 | ≈ 1,300 分 |
| 上流への request | 軽い 20 × 2 + 完全 4 × 447 ≈ **1,830** | ≈ 55,000 |
| 上流の転送量 | 完全な回 1 回あたり 40 MB 上限（実績は下回る）| — |

- **費用: 0 円。** リポジトリは Public で、GitHub-hosted runner の Actions 時間は Public リポジトリでは無料（従量課金を有効にしない）。
- 上流の負荷: 週 1 回（約 445 request / 週）から約 1,830 request / 日（平均 約 1.3 request / 分）。1 回の完全な検出の request の間隔・上限（462 request・40 MB）は変えない。
  429 / 403 / challenge を受けたら、その回は停止し（既存）、失敗の後は 2 時間あける。
- 比較（上流の負荷）:

| 方式 | World の完全な検出 | request / 日 | 既存カードの変更の検出の遅れ |
|---|---|---|---|
| 毎時・すべて完全 | 24 回 | 約 10,700 | 1 時間 |
| **毎時（採用）: Managers 完全 + World 軽い + 6 時間ごとの World 完全** | 4 回 + 信号の変化 | **約 1,830** | 6 時間（新しいカードは 1 時間） |
| 2 時間おき | — | 約 5,350（すべて完全） | 2 時間 |
| 6 時間おき | 4 回 | 約 1,790 | 6 時間（Managers も 6 時間） |
| 1 日 1 回 | 1 回 | 約 447 | 24 時間 |

## 7. 監視（schedule が止まった場合）

- GitHub は、Public リポジトリで **60 日間リポジトリの活動が無いと scheduled workflow を自動で無効にする。**
  毎時の検出自体は活動に数えられない。本人のコミット・PR 等の活動で防ぐ（無効になったら Actions の画面から再度有効にする）。
- 同じ GitHub の schedule の中だけでは、schedule 自体の停止は検知できない。既存の範囲での外部の確認の設計案（未実装・有料サービスは使わない）:
  1. 本人が週 1 回、Actions の detection workflow の最新の run の時刻を見る（手動・費用なし）。
  2. Vercel の Cron（既存の Hobby の範囲・1 日 1 回）で、公開の GitHub API から最新の検出 run の時刻を取り、内部の確認ページ（本番 404 の内部ページ）に表示する。通知先（メール等）は Custom SMTP の後に検討。
  3. 公開サイトの `/api/data-status` に、最後の検出の時刻を出す（applied-state の PR の時刻ではなく）— 検出は Production に書かない契約のため、別の仕組みが必要。v1.1 の候補。

### 7.1 GitHub の schedule の実測（2026-10-04〜05）

- cron `17 * * * *` に変えた後、**最初の schedule の run は 2026-10-04T17:33Z**（17:17 の枠・16 分遅れ）。run 37220971573・成功・
  `worldScan: no_previous_state`（状態が無いため完全な回）・`overall: no_change`・状態を Actions cache に保存。
- その後の 18:17 の枠は **run が作られなかった**（GitHub 側で欠落）。19:17 の枠も 20:02Z の時点で run が無い（欠落）。workflow は active・変数は `true`・
  ファイルは main で正しい（設定の問題ではない）。GitHub の schedule は混雑時に遅れ・欠落がある（ベストエフォート）。
- 影響: 検出が 1〜2 時間あくことがある。次の run が状態を引き継ぐため、取りこぼしは無い（World の完全な比較は 6 時間ごとの条件で必ず走る）。
  130 分を超えるあきは `buildScheduleGapNotice` が次の run で通知する。
- 変えない理由: 自分で dispatch し直す方式は手動の run と同じく World の完全な検出（約 445 request）になり上流の負荷が増える。
  外部の cron から GitHub API で起動する方式は token（Secret）が必要で、本人の判断が要る（Secret の変更は禁止事項）。
- 本人の判断の候補: (a) 現状のまま（推奨・費用 0）、(b) 外部の cron サービス + 細かい権限の token で workflow_dispatch（軽い回の入力を追加する変更が必要）。
- **本人の決定（2026-10-06）**: (a)。当面は GitHub Actions の schedule だけを使い、外部 Cron・新しい Token・Secret・外部契約・有料サービスは追加しない。
  2026-10-13 まで観測する。観測の定義・手順・再検討の条件は `hourly-detection-observation.md`。

## 8. 変えていないもの

Auto Apply Policy（版・World / Managers の閾値・変更列の allowlist・removed 0・不明な列で停止・Managers の UPDATE で停止）、
Backup 必須・Restore / Storage の検証・Dry run 必須・re-diff 0・checksum の一致・事後検証・halt Issue・Kill switch（3 変数）・
手動の経路・Rollback / Restore は手動だけ・Environment・Secret。
