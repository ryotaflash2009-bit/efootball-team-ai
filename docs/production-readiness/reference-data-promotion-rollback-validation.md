# 参照データ自動更新 Promotion Rollback検証記録(隔離環境)

作成日: 2026-09-20。**この記録はローカル合成fakeクライアントによる検証結果である。
GitHub Actions実PostgreSQL(`promotion-orchestrator.postgres.test.ts`)での実証は
このセッションでは未実行。実Productionへの適用・rollbackは一切行っていない。**

## 1. 自動rollback(transaction内失敗時、`promotion-orchestrator.test.ts`)

以下の失敗注入シナリオについて、transaction全体がROLLBACKされ、対象テーブル・jobの状態が
一切変化しないことを確認した(すべてfakeクライアントによる合成検証)。

| # | 失敗シナリオ | 確認内容 | 結果 |
|---|---|---|---|
| 1 | approval mismatch | 事前ゲートで拒否、BEGINへ到達しない | 合格 |
| 2 | PromotionPlan mismatch(approvalArtifactId改変) | 事前ゲートで拒否 | 合格 |
| 3 | staging checksum mismatch | 事前ゲートで拒否 | 合格 |
| 4 | row count mismatch | transaction内で検出、ROLLBACK | 合格 |
| 5 | snapshot failure(snapshot書込み例外) | ROLLBACK、対象テーブル未変更 | 合格 |
| 6 | insert failure(added書込み例外) | ROLLBACK、addedが存在しない | 合格 |
| 7 | update failure(addedが無い状態でupdated書込み例外を単独注入) | ROLLBACK、updatedが復元されない | 合格 |
| 8 | source metadata failure | ROLLBACK | 合格 |
| 9 | shadow comparison mismatch(読み戻し結果を改ざんするラッパーで直接注入) | ROLLBACK、applied checksum記録なし、job未completed | 合格 |
| 10 | expectedAfterChecksum mismatch(PromotionPlanのchecksumを直接改変) | shadow comparison合格後もROLLBACK、applied checksum記録なし | 合格 |
| 11 | audit failure | ROLLBACK | 合格 |
| 12 | job status update failure | ROLLBACK | 合格 |
| 13 | lock競合(pg_try_advisory_xact_lock失敗) | 待機せず即座にROLLBACK | 合格 |
| 14 | unchanged/removed candidate消失 | 物理削除の早期検出、ROLLBACK | 合格 |

いずれのシナリオでも、`unrelated row`(このjobが対象としない行)が不変であること、
advisory lockがtransaction終了とともに解放されること(fakeクライアントでは
`pg_try_advisory_xact_lock`をtransaction単位で判定する設計とすることで模擬)、
再試行可能であること(同一ジョブを別transactionで再実行できる設計、状態が
`running`のまま残らないよう`update_jobs`更新に失敗した場合もROLLBACKされる)を確認した。

## 2. 明示rollback(成功後の取り消し、`promotion-orchestrator.test.ts`)

| 確認項目 | 結果 |
|---|---|
| rollback承認必須(nonce等) | 合格(nonce未設定は拒否) |
| 元promotion job ID一致 | 合格(別jobへのrollbackは拒否) |
| applied checksum一致 | 合格(不一致は拒否) |
| rollback plan ID一致 | 合格(不一致は拒否) |
| completed状態のjobのみ対象 | 合格(running/rolled_back等は拒否) |
| このjobの追加行だけ削除 | 合格(addedのみ削除、updated/unchanged/removedCandidateは削除されない) |
| このjobの更新行だけbefore snapshotへ復元 | 合格(updated行のみ復元、内容が正確に一致) |
| unrelated row不変 | 合格(unchanged/removedCandidateの内容が変化しない) |
| source metadata復元 | 合格(`promotion_source_metadata_before`からの復元、または未存在なら削除) |
| rollback後checksumがbeforeChecksumと一致 | 合格(`updated_at`列は昇格・rollbackそれぞれ別の実行時刻で上書きされるため、
  `beforeChecksum`の計算からは意図的に除外している。`computeBeforeStateChecksum`参照) |
| promotion jobをrolled_backへ遷移 | 合格 |
| rollback job記録 | 合格(`rollback_jobs`) |
| 二重rollback拒否 | 合格(事前ゲート+DB側unique index`idx_rollback_jobs_target_unique_active`の両方で拒否) |
| 別jobへのrollback拒否 | 合格 |

## 3. 設計上の注意点(このセッションで判明した事項)

- `updated_at`のようなorchestrator管理列(書込みのたびに実行時刻で上書きされる列)を、
  「正確な復元」のchecksum判定に含めると、promotionとrollbackが別々の実行時刻を持つ限り
  常に不一致になってしまう。`beforeChecksum`はこの列を除外して計算する設計にした
  (`computeBeforeStateChecksum`、`expectedAfterChecksum`側は同一transaction内の同一
  時刻で書き込まれるため除外不要)。
- jsonb列(`stats`等)はDB往復後にJSON文字列として読み戻されるため、テスト側の期待値も
  同じ変換(`mapFieldsToParams`と同一ロジック)を経てから比較する必要がある。実装・
  テストの両方でこの正規化を徹底した。

## 4. 未検証・残作業

- GitHub Actions実PostgreSQL上での同等シナリオの実行(`promotion-orchestrator.postgres.test.ts`、
  正常系・トランザクション途中失敗・明示rollback・二重rollback拒否の4パターンを実装済み、
  実行は次回のGitHub Actions実行時)。
- 実Production reference_data/reference_data_opsに対するpromotion・rollbackは一切未実施。
- staging→確定テーブルの昇格を、実際の外部データ取得結果(13,009件規模)で検証すること
  (今回は少数の合成レコードのみ)。
