# Production Backup 脅威モデル(design only)

作成日: 2026-09-20。**この文書は脅威分析であり、記載された対策のうち実装済みなのは
コード側の拒否ロジック・静的監査だけである。role・Secret・鍵・保管先はこのセッションでは
未作成のため、いずれの脅威も「まだ現実には発生し得ない」状態にある。**

関連: [[reference-data-production-backup-security-model.md]]・[[reference-data-production-backup-credentials.md]]・
[[reference-data-production-backup-storage.md]]・[[reference-data-production-backup-approval-runbook.md]]

| 脅威 | Prevention(予防) | Detection(検知) | Response(対応) | Revoke(失効) | Recovery(復旧) |
|---|---|---|---|---|---|
| Database credential(read-only)漏洩 | 専用read-only roleに限定(管理者資格情報を流用しない)、Secretはこのworkflow専用 | GitHub Secretsの利用ログ、Supabase側の接続ログ(本人が別途監視) | 漏洩経路を特定、Secretを即削除 | Supabase側でroleのパスワードを再発行 | 新しいSecretを設定し直し、Backup workflowを再開 |
| GitHub Secret漏洩(ログ露出等) | `assertNoSecretValuePrinted`でsecretの生値をechoする記述を静的に拒否、GitHub Actions自体のsecretマスキング機能に依存 | ログを本人が目視確認、GitHubのsecret scanning(リポジトリ設定次第) | 漏洩したSecretを即削除・再発行 | 同上 | 同上 |
| malicious PR(悪意あるworkflow変更を含むPR) | このworkflowは`pull_request`トリガーを持たない(`assertWorkflowDispatchOnly`で保証)、fork PRからの実行は不可能 | PRレビュー | マージしない | 該当なし(実行経路が無い) | 該当なし |
| workflow改ざん(mainブランチへの不正な変更) | ブランチ保護・レビュー必須設定(このリポジトリの既存運用に依存、このセッションでは変更していない) | 差分レビュー、`backup-workflow-audit.ts`による静的監査(CIへ組み込む場合は将来検討) | 不正な変更を検出したら即座にrevert | Secretを削除して実行不能にする | 正しいworkflow定義へ復元 |
| fork PRからの実行 | `pull_request`トリガーを持たないため、fork PRはこのworkflowを一切トリガーできない | 該当なし(そもそも発生しない) | 該当なし | 該当なし | 該当なし |
| ログへの意図しない露出 | secretの生値をechoしない設計、GitHub Actionsの自動マスキング | 実行ログの目視確認 | ログを削除できないため、露出した値そのものを直ちに失効させる | Secret/role/tokenの再発行 | 再発行後のSecret設定 |
| Backup Artifactの公開露出 | このセッションではArtifactを作成していない。将来実装時も、暗号化済みファイルだけを保管先へアップロードし、GitHub Actions Artifactへは置かない設計(retentionが短く、意図せぬpublic化のリスク経路を増やさないため) | 保管先のaccess control設定の定期確認 | 誤って公開設定になっていた場合、直ちに非公開化 | アクセストークンの再発行 | 影響範囲の確認(対象データは公開的性質だが、念のため) |
| storage token漏洩 | Backup専用の最小権限トークン(全体管理者トークンを流用しない) | 保管先サービスのaccess log | トークンを即座に無効化 | 保管先側でトークン再発行 | 新トークンをSecretへ再設定 |
| storage bucket誤公開 | private設定をデフォルトとし、公開設定への変更を意図的な操作としてのみ許可する運用(保管先サービスの設定に依存、このセッションでは未作成) | 定期的なbucket設定監査(本人の手動確認、自動監視は未設計) | 直ちにprivateへ戻す | 該当なし(バケット自体の削除は最終手段) | 誤って公開されていた期間のアクセスログを確認 |
| 暗号鍵(age秘密鍵)紛失 | 本人が秘密鍵のoffline recovery copy(オフライン媒体への複製)を保持する運用を推奨(このセッションでは鍵自体を生成していないため未実施) | 本人が復号を試みて気づく | 紛失した場合、旧鍵で暗号化された既存Backupは復号不能になる可能性がある | 新しい鍵ペアを生成し、以降のBackupを新鍵で暗号化 | 紛失した鍵で暗号化されたBackupが必要な場合、offline recovery copyが唯一の救済手段(無ければ復旧不能) |
| 暗号鍵漏洩 | GitHub Actionsには公開鍵だけを渡し、秘密鍵を一切CIへ渡さない設計(age非対称暗号を選ぶ最大の理由) | 該当なし(秘密鍵はローカル外へ出ない設計のため、CI側からの漏洩経路が構造的に無い) | 本人PC側の漏洩が疑われる場合、新しい鍵ペアを生成 | 旧鍵を「危殆化」として扱い、以降使用しない | 新鍵での暗号化を以降のBackupへ適用 |
| Backup改ざん | manifestのtable/total/source metadata checksumによる検証(`restoreReferenceDataBackup`が書込み前に必ず検証、既存実装) | Restore試験時にchecksum不一致として検出 | 改ざんが疑われるBackupを不合格として扱い、Restoreを中止 | 該当なし | 別世代のBackupから復旧 |
| manifest改ざん | checksumの再計算による突き合わせ(manifestの値を鵜呑みにしない設計、既存実装) | 同上 | 同上 | 該当なし | 同上 |
| rollback plan不一致 | Promotion側の既存`PromotionPlan.rollbackPlanId`・承認artifact一致検証の枠組みを、Production Backup gateの`approvalArtifactMatches`/`rollbackPlanMatches`(既存17項目)でも要求する | gate評価時に不一致を検出 | Production applyへ進まない(blocked) | 該当なし | 正しいrollback planを再確認してから続行 |
| insider error(本人の誤操作) | confirm入力(`backup`という文字列の明示入力)+GitHub Environment承認の二重確認 | 実行ログ・承認履歴 | 誤って承認した場合、実行中のjobをキャンセル | 該当なし | 誤って取得したBackupを削除、正しい手順で再取得 |
| retention失敗(削除されるべきBackupが残る/削除されるべきでないBackupが消える) | retention categoryごとの明確なexpiresAt設計([[reference-data-production-backup-storage.md]]) | 保管先の削除ログ、定期的な本人確認 | 誤って削除された場合、他世代からの復旧を試みる | 該当なし | 別世代のBackupから復旧、無ければデータ損失として扱う |
| 平文残存(暗号化前dumpが消し忘れられる) | 設計上、平文はプロセスメモリ上にしか存在させず、ディスクへ書き出さない(既存実装の`createReferenceDataBackup`が暗号化済みBufferだけを返す設計) | コードレビュー、静的監査 | 平文ファイルが発見された場合、直ちに安全に削除 | 該当なし | 該当なし |
| user data混入(Backup対象に利用者データが紛れ込む) | Backup対象はallowlist(`BACKUP_TARGET_TABLES`)で参照データ4テーブルに固定、`auth.users`/`my_team_snapshots`/`rls_probe_records`は`checkBackupTargetAllowed`で明示拒否(既存実装、`backup-target.test.ts`で確認済み) | 静的監査(`backup-sql-audit.ts`)、Unit Test回帰 | user dataテーブルへの参照を含むコード変更を検出した場合、マージしない | 該当なし(そもそも書込み経路が無い) | 該当なし |

## 誠実な限界の開示

上記のPrevention欄で「実装済み」としているのは、コードレベルの拒否ロジック・静的監査
(`backup-production-security-gate.ts`・`backup-workflow-audit.ts`)と、既存のBackup/Restore
実装(`backup-orchestrator.ts`・`backup-restore.ts`、PR #26でmain反映済み)の設計に基づく
ものだけである。GitHub Environment・Secrets・read-only role・保管先アカウント・age鍵の
いずれも未作成のため、Detection/Response/Revoke/Recoveryの多くの項目は「実際に運用してみて
初めて有効性を検証できる」状態であり、このセッションでは検証していない。
