# Production Backup 実行主体・接続経路・安全設計(design only、Production未接続)

作成日: 2026-09-20。**この文書は設計のみである。実Production Supabaseへの接続、Production
Backupの取得、role・Secret・鍵・保管先の作成は、このセッションでは一切行っていない。**

関連: [[reference-data-production-backup-design.md]]・[[reference-data-backup-manifest.md]]・
[[reference-data-production-backup-credentials.md]]・[[reference-data-production-backup-storage.md]]・
[[reference-data-production-backup-approval-runbook.md]]・[[reference-data-production-backup-threat-model.md]]

実装コード: `src/lib/reference-data/auto-update/backup-production-security-gate.ts`
(既存17項目 + 追加11項目 = 28項目のゲート、常にblocked側の入力だけでテスト済み)・
`.github/workflows/reference-data-production-backup.yml`(design only、workflow_dispatchのみ、
Secret未設定のため常に最初のステップで失敗する)・`src/lib/reference-data/auto-update/backup-workflow-audit.ts`
(このworkflow YAML自体の静的監査)。

## 1. Backup実行主体の比較

| 方式 | 概要 |
|---|---|
| A. 本人のWindows PCから手動実行 | ローカル端末で直接接続・dump |
| B. GitHub Actionsのworkflow_dispatch(承認なし) | 手動トリガーだが誰でも即実行可能 |
| C. GitHub Environment承認付きworkflow_dispatch | 手動トリガー+人間の承認が必須 |
| D. Supabase Edge Function | Supabase内で完結する関数実行 |
| E. Vercel Function | 既存デプロイ基盤内で実行 |
| F. 専用外部サーバー | 常時稼働の別サーバーで実行 |

| 観点 | A | B | C | D | E | F |
|---|---|---|---|---|---|---|
| 最小権限 | 本人PCが資格情報を保持し続ける | CI環境が資格情報を保持 | 同左、ただし承認が無いと実行自体されない | Supabase側管理領域内 | Vercel環境変数に資格情報が常駐 | 専用サーバーに資格情報が常駐 |
| 本人操作負担 | 高い(都度手動接続) | 低い(トリガーのみ) | 低い(トリガー+承認クリックのみ) | 低い | 低い | 中(サーバー保守が発生) |
| Production資格情報の露出 | 本人PCのみ(持ち出しリスク) | CI実行環境全体に一時的に展開 | 同左だが承認された実行だけに限定 | Supabase管理下(境界内) | Vercel環境変数(常駐、露出範囲が広い) | 専用サーバー(常時稼働=常時露出) |
| Audit | 本人の記憶頼み | GitHub Actionsの実行ログ | 同左+承認履歴(誰がいつ承認したか)も残る | Supabase側ログ | Vercelログ | 自前で用意する必要 |
| transaction/timeout制御 | 本人PCのスペック依存 | GitHub-hosted runnerの制約内で制御可能 | 同左 | Edge Functionの実行時間制限あり(短い) | Vercel Functionの実行時間制限あり(短い) | 自由に設計可能 |
| Backupサイズへの適合 | 制約なし | runnerのディスク・時間制約内 | 同左 | 制限が厳しい(大きいBackupに不向き) | 制限が厳しい | 制約なし |
| encryption実施環境 | 本人PC(鍵を持ち出す必要) | CI一時環境(公開鍵だけ渡せば復号能力を持たせずに済む) | 同左 | Supabase内(鍵配置が別途必要) | Vercel内 | 自前 |
| retention/restore検証との統合 | 手動で別途実施 | 同一workflow内で完結可能 | 同左 | 別途設計が必要 | 別途設計が必要 | 自前設計 |
| 費用 | 無料(本人PC) | GitHub Actions無料枠内で可能 | 同左 | Supabase Free枠に制約あり | Vercel Hobbyに制約あり | サーバー費用が発生 |
| GitHub Free/Supabase Freeとの適合 | 適合 | 適合 | 適合 | Free枠の実行時間制約が厳しい | Free枠の実行時間制約が厳しい | Free枠の概念がない(有料前提) |
| credential rotation | 手動で本人が管理 | GitHub Secretsのrotationで対応 | 同左 | Supabase側の鍵管理に依存 | Vercel側の環境変数管理に依存 | 自前で運用 |
| emergency revocation | 本人が気づくまで遅延しうる | GitHub Secretsを即座に削除・無効化できる | 同左+承認プロセス自体を止めれば実行不能にできる | Supabase側の操作が必要 | Vercel側の操作が必要 | 自前オペレーションが必要 |

## 2. 推奨実行主体

**C. GitHub Environmentの本人承認を必須とするworkflow_dispatch。**

理由:
- workflow_dispatch単体(B)は「誰かがトリガーボタンを押せば即実行される」ため、リポジトリへの書込み権限を持つ第三者(将来的な協力者等)が誤って実行するリスクを構造的に防げない。GitHub Environmentの承認を必須にすることで、**トリガーと実行開始の間に必ず人間の判断が入る**設計にできる。
- A(本人PC手動)は、本人PCへProduction資格情報を持ち出す必要があり、PC紛失・マルウェア等のリスク面で望ましくない。
- D/E(Edge Function/Vercel Function)は実行時間制限が短く、Backupのようなまとまった処理には不向きで、かつ資格情報が常駐する設計になりやすい。
- F(専用サーバー)は追加費用・追加保守負担が発生し、このプロジェクトの規模(Supabase Free、個人開発)に見合わない。

## 3. 接続経路

| 項目 | 内容 | 確認状況 |
|---|---|---|
| 接続方式候補 | Supabase direct connection / session pooler / transaction pooler | **未確認**(実接続を伴う検証はこのセッションでは実施していない) |
| IPv6/IPv4 add-on | Supabaseのネットワーク構成次第 | **未確認** |
| GitHub-hosted runnerからの接続経路 | runner IPは実行ごとに変動する(固定IPではない) | 確認可能な事実として記録(Supabase Network Restrictionsを使う場合、固定IPレンジでの許可リストが技術的に機能しない設計上の制約になりうる、要別途確認) |
| SSL | Supabase接続は標準でSSL必須 | 一般的な仕様として記録、この接続固有の設定は**未確認** |
| certificate validation | 未確認 | **未確認** |
| Network Restrictions | Supabase Dashboardの機能、設定可否は本人操作次第 | **未確認** |

接続文字列の実値はこの文書のどこにも記載しない。「host category」(例: pooler経由か直接接続か)と「database fingerprint」(SHA-256短縮値)だけを、実装時には`production-preflight.ts`の既存設計([[reference-data-production-preflight.md]])に従って扱う。

## 4. Production Backup gate(既存17項目 + 追加11項目 = 28項目)

`backup-production-security-gate.ts`が実装する追加11項目:

1. Environment approval(GitHub Environmentでの本人承認)
2. read-only role確認済み(管理者資格情報・service role keyの流用ではない)
3. Secret scope確認済み
4. age recipient(公開鍵)設定済み
5. storage destination確認済み
6. retention policy確認済み
7. 平文削除手順確認済み
8. restore-test destination確認済み(Production非依存)
9. emergency revoke手順確認済み
10. credential owner確認済み
11. key owner確認済み

**このセッション終了時点では、これら11項目はすべて`false`である(Secret・role・鍵・保管先のいずれも作成していないため)。** `decideProductionBackupSecurityGate`は、既存17項目と合わせて常に`blocked`を返す(`backup-production-security-gate.test.ts`の「2026-09-20時点の実際の状態」テストで確認済み)。readyになる合成fixtureは、純粋なゲートロジック検証専用であり、Productionの現実を主張するものではない。

## 5. 誠実な限界の開示

- 実PostgreSQL read-only roleの作成SQLは[[reference-data-production-backup-credentials.md]]に設計案として記載するが、このセッションでは一切実行していない。
- GitHub Environment(`production-backup-approval`)自体は、このセッションでは作成・設定していない(GitHub Web UIでの設定操作が必要、独立した承認事項)。
- `.github/workflows/reference-data-production-backup.yml`はこのブランチにファイルとして存在するが、コミット・pushはこのセッションでは行っていない。仮に将来コミット・pushされたとしても、4つのSecretが存在しない限り、実行は必ず最初のsecret確認ステップで失敗する。
