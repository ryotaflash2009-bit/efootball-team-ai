# 参照データ自動更新 Production Backup方式の確定

作成日: 2026-09-20。**この文書は方式の決定と設計であり、実Production backupの取得・検証はまだ実施していない。**

**関連(2026-09-20追記)**: 本文書が確定した「行単位before snapshot(C+E)」はPromotion rollback専用。
テーブル全体を対象とするfull-table Backup(Production apply直前の障害復旧用、本文書とは別目的で併用)は
[[reference-data-production-backup-design.md]]を参照。

## 1. 比較対象

| 方式 | 概要 |
|---|---|
| A. Supabase platform backup | Supabase Dashboardが提供する自動/手動バックアップ |
| B. 対象参照テーブルだけのSQL dump | `pg_dump`等で`reference_data`スキーマのみを対象に取得 |
| C. `reference_data_ops.before_snapshots`への行単位snapshot | 変更対象行だけを、適用と同一transaction内で保存 |
| D. transaction内の一時snapshot table | Cと類似、セッション内のみ有効な一時テーブル |
| E. inverse operation plan | 「何をどう戻すか」の手順そのものを記録(データそのものではない) |
| F. 上記の組み合わせ | C+E(+補助的にA) |

## 2. 評価

| 観点 | A | B | C | D | E |
|---|---|---|---|---|---|
| Supabase Freeで利用可能か | 制限あり(自動バックアップは有料プラン中心、Freeは限定的) | 可能(自前で`pg_dump`相当を実行する必要) | 可能(自前テーブル) | 可能だがセッション終了で消える | 可能(手順書ベース) |
| Production資格情報 | Dashboard操作(専用roleとは別軸) | 直接接続が必要 | 実行roleと同一 | 実行roleと同一 | 不要(設計のみ) |
| user data混入リスク | 全体バックアップのため混入する(reference_dataだけを分離できない場合がある) | 対象を`reference_data`に限定すれば低い | 対象job分のみで低い | 対象job分のみで低い | データを保持しないため無関係 |
| 部分復元(特定job分だけ) | 困難(全体復元が基本) | テーブル単位までは可能、行単位は困難 | 可能(job_id単位) | 可能だがtransaction終了後は使えない | 可能(手順があれば) |
| 全体復元 | 可能 | 可能 | 不可(全体分を保持しない設計) | 不可 | 不可 |
| 復元時間 | 長い(数分〜) | 中程度 | 短い(該当行のみ) | 短いがtransaction内限定 | 手順次第 |
| 保存場所 | Supabase管理 | 任意(要選定) | `reference_data_ops`内 | DBセッション内(揮発) | ドキュメント/コード |
| 保持期間 | プランに依存 | 運用者が決定 | 運用ポリシーで決定(before_snapshotsは長め推奨) | なし(揮発) | 恒久 |
| 暗号化 | Supabase管理 | 別途検討が必要 | DB自体の暗号化に依存(追加の暗号化なし) | 同左 | 該当なし |
| checksum | 標準では無し | 自前で付与可能 | あり(`before_checksum`) | あり | 該当なし |
| 監査 | Supabase側ログ | 自前 | `audit_events`と連携 | 弱い | ランブックとして機能 |
| 費用 | プランによる追加費用 | 実行環境次第 | 追加費用なし(既存DB内) | 追加費用なし | 追加費用なし |
| 失敗時の復旧可能性 | 高い(全体復元) | 高い | 中(該当jobのみ、全体障害には非対応) | 低い(揮発) | 中(手順への信頼度に依存) |
| staging applyとの整合 | 別系統(タイミングがずれる) | 別系統 | 同一transaction内で一貫性を保てる | 同一transaction内 | 手順として整合させる必要 |
| rollbackとの整合 | 別系統 | 別系統 | 直接対応(`promotion_before_snapshots`) | transaction内限定で直接対応 | rollback runbookそのもの |

## 3. 結論(第一候補)

**F(組み合わせ): C(行単位before snapshot) + 対応するsource metadata snapshot + E(inverse operation plan) を必須要件とし、A(Supabase platform backup)は補助条件とする。**

理由:
- 今回のpromotionは「特定job・特定行だけを正確に戻す」ことが目的であり、全体バックアップ(A)は粒度が粗すぎて日常的なrollback判断には使えない。
- B(SQL dump)は自前運用の負担が大きく、実行のたびにProduction接続が必要になるため、既存の多層ゲート設計(承認・checksum・lock)と統合しにくい。
- D(transaction内の一時テーブル)はtransaction終了後に消えるため、成功「後」の明示rollback(このセッションの主要要件)には使えない。
- C+Eの組み合わせは、このセッションで実装した`promotion_before_snapshots`・`promotion_source_metadata_before`・`PromotionPlan.rollbackPlanId`によって実際に隔離PostgreSQL上で実証できた(`promotion-orchestrator.test.ts`、GitHub Actions向けは`promotion-orchestrator.postgres.test.ts`、未実行)。

## 4. Production apply前の最低backup要件(明文化)

Production applyを実行してよいのは、以下をすべて満たした場合に限る:

1. 対象job・対象テーブルの**before snapshot**(行単位、insert/update区別、beforeChecksum付き)が、実際のtransaction内で作成されたことを確認できる。
2. **source metadata snapshot**(昇格前の`source_metadata`状態)が保存されている。
3. **inverse operation plan**(`PromotionPlan.rollbackPlanId`に対応する、明示rollbackの実行手順)がドキュメント化され、本人が読める状態にある。
4. **dataset checksum・job ID**が記録され、`applied_checksums`・`update_jobs`と紐づいている。
5. (補助条件、必須ではないが推奨)Supabase platform backupが直近に取得されていることを、Production apply実行者が別途確認する。

**backup方式が未確定、または上記1〜4のいずれかが検証不十分な場合、Production apply-readyは必ずblockedとする。** これは`production-preflight.ts`の`ProductionApplyIntent.backupConfirmed`ゲートによって既に構造的に強制されている(`backupConfirmed: false`ならdecisionは常に`blocked`)。今回のセッションでは、この`backupConfirmed`を実運用で`true`にする根拠(実際のProduction backup取得・検証の実施)はまだ存在しないため、`backupConfirmed`は常に`false`として扱うべきである。

## 5. 今回のセッションでの実施範囲

- 上記方式比較・結論・最低要件の明文化(この文書)
- `reference_data_ops_test`・`reference_data_test`(隔離PostgreSQL専用)上での、C+Eに基づくbefore snapshot・inverse rollbackの実装と検証(ローカルfakeクライアントで実証済み、GitHub Actions実PostgreSQLでの実証はこのセッションでは未実行)
- Production platform backup(A)の実際の設定・取得・検証: **未実施**(このセッションの範囲外、独立した承認事項)
