# Production Backup 保管先・Retention設計(design only、実保管先は作成していない)

作成日: 2026-09-20。**この文書は設計のみである。実storageアカウント・実バケット・実retention
設定は、このセッションでは一切作成していない。**

関連: [[reference-data-production-backup-security-model.md]]

## 1. 保管先比較

| 候補 | 費用 | 保存期間 | encryption | access control | versioning | object lock | lifecycle deletion | download audit | restore速度 | single point of failure | GitHub依存 | 個人操作の容易さ | 長期保管 | 公開事故リスク |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| GitHub Actions Artifact | 無料枠あり(容量制限) | 既定90日(短い) | 転送時暗号化のみ(保存時はGitHub管理) | リポジトリ権限に連動 | なし | なし | 期限切れ自動削除のみ | GitHub側ログ | 速い | GitHubに単一依存 | 高い | 容易 | **不向き**(短期のみ) | 誤ってpublic repoに公開するリスクは低いが、リポジトリ権限変更の影響を受ける |
| GitHub Release asset | 無料 | 手動削除まで無期限 | 転送時暗号化のみ | リポジトリ権限に連動 | なし(上書きのみ) | なし | 手動 | GitHub側ログ | 速い | GitHubに単一依存 | 高い | 可能だがGitHub依存 | 可能 | Releaseがpublicリポジトリなら重大(このリポジトリはpublic) |
| private repository(専用) | 無料(private repoの容量制限内) | 手動削除まで無期限 | 転送時暗号化のみ | リポジトリ権限に連動 | Git履歴として残る(削除しても履歴に残留するリスク) | なし | 手動、かつGit履歴からの完全削除は困難 | GitHub側ログ | 速い | GitHubに単一依存 | 高い | 容易 | 可能 | **Git履歴に残るため特に非推奨**(BackupファイルをGit commitすること自体を禁止事項としている理由) |
| OneDrive | 個人プラン費用 | 手動削除まで | クライアント/サーバー双方で暗号化オプションあり | 個人アカウント権限 | あり | なし | 手動 | 限定的 | 中 | Microsoftアカウントに依存、かつこのプロジェクトのワークスペース運用ルール上OneDrive同期対象を避ける方針と衝突しうる | 低い(GitHub Actionsからの直接アップロードには追加実装が必要) | 中 | 可能 | 個人アカウント設定次第 |
| S3互換Object Storage(汎用) | 従量課金、小規模なら低額 | 設定次第で無期限 | server-side encryption標準対応 | IAMポリシーで細かく制御可能 | あり | あり(Object Lock対応プロバイダの場合) | lifecycle ruleで自動化可能 | アクセスログ取得可能 | 速い | プロバイダ次第(単一プロバイダ依存) | 低い | 中(初期設定が必要) | 得意 | バケット誤公開は実際に多発する事故パターン、設定ミスに注意が必要 |
| Cloudflare R2 | 無料枠あり、egress無料 | 設定次第 | server-side encryption標準対応 | APIトークンで制御 | あり | 限定的 | lifecycle rule対応 | 監査ログ(有料プラン寄り) | 速い | Cloudflareに依存 | 低い | 中 | 得意 | 同上、バケット公開設定に注意 |
| Backblaze B2 | 無料枠あり、低価格 | 設定次第 | server-side encryption対応 | application key単位で権限分離可能 | あり | Object Lock対応 | lifecycle rule対応 | 監査ログあり | 中〜速い | Backblazeに依存 | 低い | 得意(バックアップ用途向け設計) | 得意 | 同上 |
| Supabase Storage private bucket | Supabase Free枠内 | 設定次第 | server-side encryption(Supabase管理) | RLS相当のポリシーで制御 | 限定的 | なし | 手動またはpolicy | Supabase側ログ | 中 | **Production Supabase自体に依存(Backupの意義と矛盾: Backup対象と保管先が同一障害ドメインになる)** | 低い | 中 | 可能だが上記の理由で非推奨 | private設定を誤るリスクあり |
| ローカル外付け保存 | 機器費用のみ | 無期限(機器寿命まで) | 本人が別途暗号化 | 物理アクセス制御のみ | なし | なし | 手動 | なし | 遅い(手動転送) | 単一の物理媒体に依存(紛失・故障リスク) | なし | 手動転送の手間 | 可能だが単一障害点 | 物理紛失時のリスク |

## 2. 推奨保管先

**第一候補: S3互換Object Storage(Cloudflare R2またはBackblaze B2)。**
**予備保管先: GitHub Release asset(privateリポジトリではなく、このリポジトリ自体はpublicのため、
暗号化済みファイルのみをRelease assetとして置く場合は特に、平文が絶対に混入しないことを
二重に確認する運用にする)。**

理由:
- Supabase Storage(単一のSupabaseプロジェクトに保管先が依存する)は、Production DB自体に
  障害が起きた場合にBackupへもアクセスできなくなるリスクがあり、Backupの目的(障害復旧)と
  矛盾する。
- GitHub Actions Artifactは既定retentionが短く(90日)、長期保管には不向き。
- Cloudflare R2はegress無料でFree枠が大きく、個人開発の規模に適合しやすい。Backblaze B2は
  バックアップ用途向けに設計されたサービスで、Object Lock(改ざん・削除防止)にも対応する。
- **単一障害点を避けるため、暗号化済みBackupは第一候補(R2/B2)へ保存しつつ、直近世代だけ
  予備としてGitHub Release assetへも複製する2系統構成を推奨する**(GitHub依存だけに
  一本化しない)。

**このセッションでは、いずれのアカウントもリポジトリも作成していない。**

## 3. Retention設計

| retention category | 対象 | 保持期間 | 削除主体 | 削除監査 |
|---|---|---|---|---|
| `isolated-test-ephemeral` | GitHub Actions隔離検証(このセッションで既に実装済み) | ジョブ終了時に破棄 | CI(job終了) | 不要(実体が残らない) |
| `production-daily` | 通常運用のProduction Backup(将来) | 直近7世代 | lifecycle rule(保管先側の自動削除) | 保管先の削除ログ |
| `production-weekly` | 週次のまとめ | 直近4世代 | 同上 | 同上 |
| `production-monthly` | 月次のまとめ | 直近3世代 | 同上 | 同上 |
| `production-pre-apply-permanent` | **初回Production apply直前のBackup** | 永久保管候補(次の安定確認が取れるまで削除しない) | 本人の手動判断のみ、自動削除の対象外 | 本人記録 |

- `expiresAt`はmanifestに既に含まれるフィールド([[reference-data-backup-manifest.md]])であり、
  上記retention categoryごとに計算する。
- 暗号鍵rotationとの関係: 鍵をrotationした場合、**旧鍵で暗号化された既存Backupは、旧鍵の
  秘密鍵を保持し続けない限り復号できなくなる**。そのため、鍵rotation実施時は、旧鍵での
  復号が必要な期間(例: 直近世代がすべてRestore検証済みになるまで)は旧秘密鍵を安全に
  保持し続ける運用とする。
- `restoreVerified`が`false`のまま一定期間経過したBackupは、「壊れたBackup」として扱い、
  retentionルールで自動削除されるより前に本人へ通知する設計が望ましい(具体的な通知経路は
  未設計)。
- Production dataset checksumとの関連: manifestの`tableChecksums`/`totalChecksum`が、対応する
  `applied_checksums`(Promotion側、既存)と突き合わせ可能であることを、将来の運用設計で
  明確にする(このセッションでは突き合わせロジック自体は未実装)。

## 4. 誠実な限界の開示

上記はすべて比較・設計であり、このセッションではいずれのアカウント・バケット・リポジトリ
設定も作成・変更していない。Free枠の正確な条件(容量・egress・API呼び出し回数の上限)は
各サービスの最新の料金ページを本人が確認する必要があり、このセッションでは実際の申し込み・
確認を行っていない。
