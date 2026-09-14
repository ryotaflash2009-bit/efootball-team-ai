# Vercel接続に向けた本人操作チェックリスト(2026-09-14時点)

調査日: 2026-09-14。一般的な登録手順の詳細(入力項目・費用・秘密情報の扱い)は`owner-actions.md`(既存)を参照。本書は**現時点の監査結果を踏まえ、実際にいつ・何を判断すべきか**を整理したものであり、**今回はいずれの操作も実行していない**。

---

## 1. 今すぐ必要な操作: なし

**ライセンス(2026-09-14解決済み)・SQLite方式の判定(2026-09-14解決済み、Supabase `reference_data`スキーマへ実データ投入済み)はいずれも解決済み。** 残る前提条件は、アプリ本体のデータ読み取り元をSQLiteからSupabaseへ実際に切り替えること(`app-hybrid-switch-implementation-plan.md`、次ブランチで実装予定、今回のタスクでは未着手)であり、**Vercel関連の操作(アカウント登録・GitHub連携・Import)は、この切替が完了するまで引き続き不要**。

## 2. 判断済み・残る判断事項

| # | 判断事項 | 状態 |
|---|---|---|
| 1 | World参照データの再配布可否 | **解決済み(2026-09-14)**。プロジェクト責任者が許諾取得済み、原文は非公開保管(`data-distribution-rights-audit.md`0章) |
| 2 | SQLiteをそのまま使い続けるか、代替方式へ切り替えるか | **解決済み(2026-09-14)**。Supabase `reference_data`スキーマへの移行を採用し、実データ(13,009/66/19件)を投入・検証済み(`reference-data-sql-execution-log.md`)。アプリ本体の切替実装は次ブランチで実施予定 |
| 3 | 監査ブランチ(`chore/vercel-readiness-audit`)のマージ・アプリ切替ブランチの実装完了 | 未完了。この完了後に、初めてVercel接続の検討段階へ進む |

## 3. 上記が解決した後に必要になる操作(実行順)

これらは**今回実行していない**。将来、2章#3(アプリ切替完了)の後に、1操作ずつ案内する。

1. **GitHubアカウント**: 既に作成・連携済み(現在のリポジトリが存在するため)。追加操作は基本的に不要。
2. **Vercelアカウント登録**: `vercel.com`でサインアップ(GitHub連携推奨)。無料。
3. **リポジトリのImport**: Vercelダッシュボードから対象リポジトリを選択。**この時点で`main`が即座にProduction Deploymentとして公開される**ため、2章の判断が済んでから行うこと。
4. **環境変数の設定**: `NEXT_PUBLIC_SUPABASE_URL`・`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`をVercelダッシュボードの「Environment Variables」へ設定(実際の値の入力はユーザー自身。Claude Codeへは値を渡さない)。
5. **Deployment Protectionの有効化**(推奨): Preview環境を第三者からアクセス不可にする。
6. **Supabase URL Configurationの更新**: Preview用ワイルドカード・Production URL確定後に完全一致URLを追加(`preview-production-environment-design.md`3章の手順を参照)。
7. **(必要と判断した場合)カスタムSMTPの導入**: `smtp-plan.md`参照。

## 4. Claude Codeへ渡してよい情報 / 絶対に渡してはいけない情報

`owner-actions.md`12章の既存整理をそのまま適用する。特に本フェーズで新たに関係するのは以下。

- **渡してよい**: 確定したVercel Preview/Production URLの形式(ドメイン名そのもの)、選択した代替構成(A〜G)の名称。
- **絶対に渡してはいけない**: Vercelアカウントのパスワード、環境変数の実際の値、Supabaseの`service_role`キー、クレジットカード情報。

## 5. 今回のタスクでの結論(2026-09-14更新)

**Vercel登録・GitHub連携・Import・Deployのいずれも案内していない。** ライセンス・SQLite方式の判定はいずれも解決済みとなったが、次にユーザーが行うべきことは、Vercel操作ではなく、監査ブランチのコミット・PR・mainマージ、その後のアプリ切替実装(`app-hybrid-switch-implementation-plan.md`)である。
