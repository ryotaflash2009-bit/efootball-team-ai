# 参照データ自動更新のインシデント対応（2026-10-03）

対象: 検出 → 自動進行（Plan・Backup・Dry run）→ Apply（本人の承認）→ 事後検証。
サイト全体の停止は `invite-beta-stop-procedure.md`。Production Restore は停止の手段ではない（最後の手段・別の判断）。

共通の原則:
- 自動進行は失敗したら止まる（再実行しない・Apply の run を作らない）。止まった状態は安全。
- **Claude Code は承認・Rollback・Restore・Secret の変更をしない。** 下の「本人」は本人の操作。
- 記録: 時刻・run id・判断を Issue `reference-data-update` に残す（値・行データは書かない）。

## 1. 通知と最初の判断

| 通知（Issue） | 状態 | 最初にすること |
|---|---|---|
| 更新を検出しました | 正常 | 何もしない（自動進行が進む） |
| 自動更新が停止しました | 安全に停止・書き込みなし | 段階と理由を見る（§2） |
| Apply が承認待ちです | 本人の判断待ち | 1 画面の内容を確認し、問題がなければ承認（しなくても何も書かれない） |
| Apply が完了し検証済みです | 書き込み済み・検証済み | Evidence PR（applied-state・F-071 の分布） |
| Apply 後の検証に失敗しました（要対応） | **書き込み済み・検証失敗** | §3 |
| 検出が失敗しました / 確認が必要です | 書き込みなし | upstream の状態を確認。自動では何も適用しない |

## 2. 停止の理由ごとの対応（書き込みなし）

| 段階・理由 | 意味 | 対応 |
|---|---|---|
| plan / `run_not_successful`（job が secret の確認で失敗） | Secret が未登録・名前違い | `owner-secret-entry-2026-10-03.md` の 9 件を本人が登録 → 「設定完了」 |
| plan / removed・schema drift・hard block | upstream の削除・構造変化 | 自動では進めない。Claude Code が原因を調べ、必要なら別の承認つきの手順を提案 |
| backup / 件数の不一致・未検証・期限切れ | Backup が Apply の前提を満たさない | 次の検出で自動進行をやり直す（古い Backup は使わない） |
| dry-run / re-diff ≠ 0・checksum の不一致 | Plan と Production の間で変化 | 次の検出からやり直す |
| `main_sha_changed` | 途中で main が進んだ | 次の検出からやり直す |
| `detection_run_*` | 検出 run が main の成功した初回でない | 正しい検出 run で `orchestrate` |
| `run_timed_out` | GitHub の遅延・upstream の遅延 | 時間をおいて検出からやり直す |

## 3. Apply 後の検証に失敗（rollback_required）

1. **新しい自動進行を止める**: Repository variable `REFERENCE_DATA_AUTO_UPDATE_PIPELINE_ENABLED` を `false`（本人。Claude Code も変更できるが、止める操作は本人の指示で行う）。
2. 公開サイトの表示を確認する（件数・選手の詳細）。表示に問題があれば `invite-beta-stop-procedure.md` §1（Vercel の Instant Rollback。データは変えない）。
3. Claude Code が Evidence・apply result・undo plan（artifact・90 日）を読み、原因と影響を報告する（読み取りだけ）。
4. 取り消し（undo）は本人の別の判断。Backup（暗号化・R2）は Apply の直前のものが Evidence に記録されている。
5. 原因の修正 → CI → 次の検出から通常の手順で再開。

## 4. Secret の漏えいの疑い

1. 該当の Secret を発行元で無効にする（本人）:
   - DB: Supabase で該当ロールのパスワードを再発行
   - R2: Cloudflare で API Token を削除して再発行
   - age の公開鍵は漏れても実害なし（秘密鍵は GitHub に置いていない）
2. GitHub の Environment の Secret を新しい値で更新する（本人）。
3. 漏えいの経路（ログ・artifact・Issue）を Claude Code が値を見ずに調べる（名前とパターンだけ）。見つかれば該当の run の削除を本人へ依頼する。
4. 変数を `false` にして、確認が終わるまで自動進行を止める。

## 5. R2・Backup の失敗

- Backup の run が失敗しても、Production は変わらない（読み取りだけ）。自動進行は Apply へ進まない。
- R2 の既存の object を削除・上書きしない。保持期間を変えない。
- 続けて失敗する場合は、R2 の Token の期限・権限（対象 Bucket の Object Read & Write）を本人が確認する。

## 6. 再開の条件

- 原因が特定され、修正が main に入り、CI と CodeQL が成功している。
- `npm run verify` と自動更新のテストが成功している。
- 変数を `false` にしていた場合は、本人が `true` に戻す。
