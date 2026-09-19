# 参照データ自動更新基盤 設計文書(2026-09-19)

本書は設計文書であり、**今回のセッションでは実Supabase本番DBへの自動更新書込みを一切有効化しない**。
Cron登録(Vercel/GitHub Actions/Supabase いずれも)・Edge Functionの本番デプロイ・Secret生成・
本番service role keyの設定も今回は行わない。実装したのは、手動起動・dry-run・書込み0件の
純関数基盤(`src/lib/reference-data/auto-update/`)と、それを使うdry-run専用CLIのみである。

`reference-data-update.md`(2026-09-11、SQLiteファイル差し替え方式を前提)・
`ci-cd-and-auto-update.md`(2026-09-11、サイト本体のCI/CD)は現在も有効な設計原則
(人による承認を必ず挟む・安全停止条件・ロールバック優先)を含むが、Phase E以降は参照データの
既定取得元がSupabaseになったため、本書はその前提を更新した版として位置づける。

## 1. 対象データと対象外データ

**自動更新の対象**(ユーザーデータを含まない): World player cards・stats・skills・appearances、
managers・boosters・Link-Up Play・Link-Up conditions、player card analysis、eFHUB由来の補足情報、
facets、source metadata、検索・ソート用派生値(`name_sort_key`等)、画像参照情報、更新日時、
データ件数、差分履歴。

**対象外**(自動更新が一切触れてはならない): `auth.users`、`my_team_snapshots`、`rls_probe_records`、
利用者のMy Team・お気に入り・保存ビルド・保存スカッド・認証セッション・個人情報・利用者生成データ。
これらは`docs/production-readiness/sql/create-rls-probe-records.sql`・
`create-my-team-cloud-schema.sql`が定義するRLS保護下のテーブルであり、参照データ更新パイプラインの
接続主体(将来的にservice role相当を使う場合)がこれらのテーブルへ書込み権限を持たない設計を
維持すること(`real-import-guards.ts`の`ALLOWED_TARGET_TABLES`許可リストパターンをそのまま踏襲する)。

## 2. 取得元と利用規約(推測で断定しない)

| 取得元 | 用途 | 確認済み事実 | 確認できていない事実 |
|---|---|---|---|
| `efootball-world.com`(`/api/proxy/v1/api/players/search`) | World選手カード | robots.txt: 全UAに`Allow: /`、`Disallow`は`/my/`・`/auth/`のみ、Crawl-delay指定なし、AIクローラー制限なし(`docs/efootball-world-data-investigation.md`1章、2026-08時点の実測)。既存スクリプトは間隔3秒・単一同時実行・20秒タイムアウト・429/403/CAPTCHA即停止・Cookie/認証なし・UA偽装なし・リダイレクト非追跡を実装済み。 | `/terms`ページの全文は機械的な語の有無確認のみ(`data-distribution-rights-audit.md`5章)。 |
| `raw.githubusercontent.com/amine250/efootball-managers`(`data/managers.json`) | 監督データ | 公開GitHubリポジトリのraw JSON、GitHub自体の利用規約下。リポジトリ自体にLICENSEファイルは無いが、CREDITS.md/NOTICEが存在する(`scripts/investigate-manager-image-sources.mjs`調査記録)。既存スクリプトはGET1回・redirect非追跡・20秒・再試行なしを実装済み。 | リポジトリ独自の再配布条件(LICENSE不在のため、GitHub既定のAll Rights Reserved原則が適用される可能性がある)。 |
| (旧)eFHUB系(`efhub.com`) | 旧`/players`系レガシー機能のみ、現行のWorld/Supabase構成には不使用 | `.gitignore`が「redistribution rights not confirmed」と明記(`data-distribution-rights-audit.md`4章)。 | 再配布条件全般。 |

**上位の許諾状況(重要)**: `docs/production-readiness/data-distribution-rights-audit.md`0章に、
「公開、再配布、データ利用、画像利用、**更新連携**および将来の商用利用に必要な許諾は、
プロジェクト責任者が取得済み」と記録されている(許諾原文は非公開保管、公開リポジトリには非掲載)。
これにより、本書が扱う「更新連携」自体は既に許諾範囲内であることが記録上確認できる。
上表の「確認できていない事実」は、この許諾の有効性を損なうものではなく、robots.txt/利用規約の
**全文レビュー**という技術的な確認作業がまだ行われていないという記録上の事実に過ぎない
(0章のとおり、これ自体は停止条件として扱わない)。

**今回のセッションでの外部アクセス**: 本タスクでは、上記サイトへの新規アクセスは行っていない
(上表はすべて既存ドキュメントの引用)。低頻度・読み取り専用の確認が必要になった場合も、
既存スクリプトが実装済みのレート制限(間隔3秒以上・単一同時実行・20秒タイムアウト)を上回る
アクセスは行わない方針を維持する。

## 3. アーキテクチャ候補の比較

| 基準 | 案A: Vercel Cron→Route Handler | 案B: GitHub Actions schedule | 案C: Supabase Cron→Edge Function | 案D: 日次差分生成のみ(人承認・手動適用) | 案E: 定期取得→staging→検証合格後に本テーブル昇格 |
|---|---|---|---|---|---|
| Vercel Hobby互換性 | Cron自体は使えるが実行頻度・時間帯の精度保証なし(Hobbyは1日1回目安)。Route Handlerの実行時間制限(Hobby既定10秒、設定で最大60秒)が長時間データ処理に不利。 | 影響なし(Vercel外で実行) | 影響なし | 影響なし(生成はGitHub Actions等で実行) | 影響なし |
| Supabase Free互換性 | 制約なし(通常のクエリ) | 制約なし | Edge Function実行時間・呼び出し回数のFree枠制限あり | 制約なし | 制約なし |
| 料金 | Hobby範囲内(Cron自体は無料枠あり) | GitHub Actions無料枠(2,000分/月)内で十分収まる規模 | Supabase Free枠内だが将来的な従量課金の可能性 | 無料 | 無料 |
| 実行時間制限 | Route Handlerの制限に強く依存(不利) | Actionsのジョブ制限(無料枠は6時間/ジョブ)、十分な余裕 | Edge Functionの実行時間制限(数十秒程度)、大量データ処理に不利 | 制限なし(人が任意のタイミングで実行) | 実行環境依存(通常はActions等、余裕あり) |
| 1日1回で十分か | 十分(選手カード改定は数日〜数週間隔） | 十分 | 十分 | 十分 | 十分 |
| 外部サイト利用規約・robots.txt | 変わらず遵守が必要(実行場所に依存しない) | 同左 | 同左 | 同左 | 同左 |
| 取得先障害・一部取得失敗時の扱い | Route Handler内で完結させる必要があり、部分失敗時のリトライ設計が複雑になりがち | ジョブの再実行が容易(Actionsの標準機能) | 同様の複雑さ | 生成のみのため人が次回まで待てる | Actions側で完結、staging未達なら次回まで待てる |
| 重複実行・二重書込み | Vercelの同時実行保護に依存、advisory lock等の追加実装が必要 | Actionsの`concurrency`設定で比較的容易に単一実行を保証できる | 同様の追加実装が必要 | 人が起動するため二重実行リスクは低い | Actions側の`concurrency`で対応可能 |
| 全件削除事故のリスク | 実装次第(gate設計に依存、アーキテクチャ自体の差は小さい) | 同左 | 同左 | 生成のみで本番書込みが無いため最小 | staging経由のため本番への影響が最小 |
| rollback容易性 | Route Handler内でトランザクション管理が必要 | ジョブ実行のため、失敗時はそのまま何もしない(本番影響なし)が容易 | 同様 | 最も容易(そもそも書込みをしない) | stagingが失敗しても本番は無傷、容易 |
| 監査証跡 | Vercelのログ保持期間に依存(Hobbyは短め) | GitHub Actionsのログが長期保持される、Artifactとしても保存可能 | Supabaseログに依存 | GitHub Artifactとして差分レポートを保存できる | 同左 |
| 秘密情報管理 | Vercel環境変数(本番書込み権限を持つ値の管理が必要) | GitHub Actions Secretsまたは将来のOIDC | Supabase側のSecret管理 | 生成段階では読み取り専用の鍵だけで足りる | 同左 |
| Cron endpointの保護 | 公開URLになるため`CRON_SECRET`等の保護が必須 | 該当なし(Actionsのトリガー自体がGitHub権限で保護される) | 該当なし(Supabase内部トリガー) | 該当なし | 該当なし |
| 保守負担 | Next.jsアプリと密結合、デプロイのたびにCronロジックも再デプロイされる | アプリのデプロイと分離できる、保守しやすい | Edge Function特有の学習コスト | 最小(既存スクリプトの延長) | 中程度(staging schemaの追加管理が必要) |

**推奨**: 初期アルファでは**案D(差分生成のみ・人承認・手動適用)を土台に、Phase 2で案Eの
staging昇格方式を組み合わせる**。理由:
- Vercel Hobbyの実行時間制限・Cron endpoint保護の課題を、Route Handler/Edge Functionを一切
  公開しないことで構造的に回避できる(攻撃面が最小)。
- GitHub Actionsは既にCI(`​.github/workflows/ci.yml`)で稼働実績があり、`concurrency`設定による
  二重実行防止・Artifactによる差分レポート保存・無料枠内での運用実績がある。
- 案A/Cは公開Cron endpointの保護(`CRON_SECRET`等)という**今回新しいSecretを生成しない**という
  制約と相性が悪い(Secretを生成しない限り、公開エンドポイントを安全に保護できない)。
- 案Eのstaging昇格は、Phase 2(人承認後の適用)で正式採用する。stagingを「Postgres上の別スキーマ」
  にするか「ローカル/Actions実行環境内の一時ファイル」にするかは、実装時にコスト(Supabase Free枠の
  ストレージ)と検証のしやすさを比較して決定する(今回は結論を出さない)。

## 4. 推奨ロールアウト(タスク要求のPhase 1〜3をそのまま採用)

### Phase 1(今回実装した範囲)

- 手動起動可能・dry-runが標準・書込み0件。
- `src/lib/reference-data/auto-update/`: schema validation・差分計算・safety gate・plan生成・
  監査ログ生成、いずれも純関数(実DB・実ネットワーク接続なし)。
- `scripts/migration/reference-data-auto-update-dry-run.mjs`: ローカルJSON3ファイル
  (取得結果・前回スナップショット・スキーマ設定)を入力に取り、上記パイプラインを実行して
  結果を標準出力へ表示するCLI。`--execute`は存在しない(実装していない)。
- 既存の外部取得スクリプト(`sync-world-players-incremental.mjs`等)の出力を、本CLIが読める
  `StagingDataset`形式へ変換する「glue」部分は**今回は未実装**(Phase 2で設計)。

### Phase 2(次回以降、今回は実装しない)

- 明示承認後のみ適用。transaction・advisory lock・idempotency key(`checkLockAcquired`・
  `checkDatasetChecksumNotApplied`は判定ロジックのみPhase 1で用意済み、実際のlock取得・
  適用SQLの発行は未実装)。
- stagingから本テーブルへの昇格(`real-import-detail-extension-orchestrator.ts`の
  `buildBulkUpdateSql`パターンを踏襲したUPSERT/UPDATEオーケストレーター)。
- 失敗時rollback、適用後シャドー比較(`phase-d-shadow-compare.mjs`の比較パターンを
  「更新前スナップショット vs 更新後Supabase」に応用)。
- sourceMeta更新・監査記録の永続化先(Supabaseの管理専用テーブル、または
  GitHub Actions Artifact)を確定する。

### Phase 3(今回は有効化しない)

- 日次などの定期実行(GitHub Actions `schedule:`トリガー)。ただし最初はdry-runのみを
  スケジュール実行し、差分レポートを人が確認する運用に留める。
- 異常時は自動適用しない(Phase 1のsafety gateがreject判定を返した場合、Phase 2の適用処理へは
  進まない設計を維持する)。
- 十分な実績(複数回のdry-run結果が安定して妥当であることを人が確認できた後)を踏まえてから、
  限定的な自動適用(例: 追加のみ・削除は必ず人の承認、等)を検討する。**今回はこのPhaseの
  有効化条件を満たしていないため、設計のみに留める。**

## 5. 安全ゲート一覧(実装済み/設計のみを明示)

| ゲート | 実装状況 | 対応する停止条件 |
|---|---|---|
| ID形式検証・必須キー欠損検出 | 実装済み(`schema-validation.ts`) | schema異常 |
| 重複ID検出 | 実装済み(`schema-validation.ts`) | ID重複 |
| 未知フィールド検出 | 実装済み(`schema-validation.ts`・`safety-gates.ts`) | 不明なschema変更 |
| 件数増減率チェック | 実装済み(`safety-gates.ts` `checkCountDelta`) | 件数急減・件数急増 |
| 削除件数の絶対数チェック | 実装済み(`checkRemovedCount`) | 大量削除 |
| NULL率増加チェック | 実装済み(`checkNullRateIncrease`) | 異常NULL率 |
| 数値範囲チェック(OVR等) | 実装済み(`schema-validation.ts`の`numericRanges`) | OVR異常 |
| 部分取得失敗検出 | 実装済み(`checkAllTablesFetched`) | 一部テーブルだけ取得成功 |
| 直前ジョブ実行中の二重実行防止 | 判定ロジックのみ実装済み(`checkNoJobInProgress`)、実際のジョブ状態記録は未実装 | 前回ジョブ実行中 |
| advisory lock | 判定ロジックのみ実装済み(`checkLockAcquired`)、実際のlock取得は未実装 | lock取得失敗 |
| 内容ベースの重複適用防止 | 判定ロジックのみ実装済み(`checkDatasetChecksumNotApplied`)、適用済みchecksum集合の永続化は未実装 | 同一データの再適用防止 |
| 参照整合性(orphan検出) | 既存の`real-import-guards.ts`(初回投入向け)に類似実装あり、更新シナリオへの一般化は未実装 | 参照整合性違反 |
| rollback可能性 | Phase 2で設計(適用処理自体が未実装のため、rollback対象も未実装) | rollback不能 |
| 取得元利用規約不明時の停止 | 運用ルールとして明記(本書2章)、自動検知は未実装(人が定期的に目視確認する運用を推奨、`reference-data-update.md`4章から継承) | 取得元利用規約不明 |
| 本番環境変数不足 | Phase 2で設計(Phase 1はSupabase接続自体を行わないため該当なし) | 本番環境変数不足 |

いずれのゲートも、失敗した場合は`decideCommitOrRollback`(`real-import-guards.ts`、既存の
初回投入と共通の判定関数)により`reject`となり、`UpdatePlan.writesPerformed`は常に0のまま返る
(Phase 1には書込み経路自体が存在しないため、ゲートを迂回して書込みに到達することは構造的にない)。

## 6. 認証・Secret設計(方針のみ、今回は何も生成・設定しない)

- Phase 2で更新エンドポイント(GitHub Actionsのジョブ、または将来のRoute Handler)を作る場合、
  公開GETエンドポイントにはしない。候補: `CRON_SECRET`(Vercel Cron採用時)、GitHub Actionsの
  場合はワークフロー自体がリポジトリ権限で保護されるため追加のSecretは必須ではない
  (Supabaseへの書込みにはservice role相当の鍵は必要になるが、これはGitHub Actions Secretsに
  保存し、ログへは一切出力しない設計とする)。
- 本番DB書込みには`publishable key`(anon key)を使わない。書込み権限を要する鍵の導入自体を
  Phase 2の独立した承認事項とする(今回は鍵の生成・設定・命名すら行わない)。
- 禁止事項(今回・将来とも遵守): `NEXT_PUBLIC_`接頭辞のSecret、service role keyのブラウザ露出、
  Secretのログ出力、URL queryへのSecret付与、PR本文へのSecret記載、`.env`のコミット、
  クライアント側から更新処理を呼べる設計、一般利用者が更新処理を起動できる設計。
- `real-import-guards.ts`の`maskSecretValue`・`maskConnectionStringPatterns`・
  `sanitizeErrorMessage`(今回`auto-update/audit-log.ts`から再利用)を、Phase 2のログ出力にも
  必ず適用する。

## 7. Vercel Hobby適合性

- Hobbyプランは実行時間制限(Route Handler既定10秒、`maxDuration`設定で最大60秒程度)と
  Cron実行のタイミング精度に制約があるため、**厳密な時刻依存・長時間データ処理をVercel上で
  行う設計は避ける**(3章の推奨理由と同じ)。
- 参照データの更新頻度は、World選手カードの改定サイクル(数日〜数週間隔)を踏まえれば
  **日次で十分**であり、リアルタイム更新は前提にしない。
- 日次で十分と判断できるため、将来Vercel Cronを使う場合でも1日1回の起動で足り、Hobbyの
  「1日1回程度」という制約と自然に合致する。ただし本書の推奨(3章)はGitHub Actions
  schedule(案B/D/E)であり、Vercel Cronの採用自体を必須とはしない。
- より高頻度な更新が必要になった場合も、Vercel Proへの変更を検討する前に、実際に日次更新が
  不十分であった具体的な事例(選手カード改定への追随遅延等)を確認してから判断すべきである
  (今回はそのような事例は確認されていない)。

## 8. 将来のGitHub Actions workflow案(文書化のみ、`.github/workflows/`への実ファイル追加は行わない)

Phase 3で採用する場合の例(あくまで案、今回はリポジトリへ追加しない・`schedule:`は有効化しない):

```yaml
# 案(未追加・未有効化): .github/workflows/reference-data-dry-run.yml
name: Reference data auto-update (dry-run only)
on:
  workflow_dispatch: {}   # Phase 3以降でschedule:を追加検討(今回は追加しない)
concurrency:
  group: reference-data-auto-update
  cancel-in-progress: false
jobs:
  dry-run:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      # 外部取得(既存sync-*.mjsの改修版)→ staging JSON生成 → dry-run CLI実行、の順
      - run: node scripts/migration/reference-data-auto-update-dry-run.mjs --staging ... --previous ... --schema ...
      - uses: actions/upload-artifact@v4
        with:
          name: reference-data-dry-run-report
          path: <差分レポート出力先>
```

`workflow_dispatch`(手動トリガー)のみとし、`schedule:`はPhase 3の有効化条件(5章)を
満たしてから追加検討する。`concurrency`グループで二重実行を防ぐ。Secretは
「Supabaseへ書込む場合」のみ必要になるが、Phase 1のdry-run CLIは書込みを行わないため
Secret自体が不要(取得元が認証不要の公開エンドポイントであるため)。

## 9. 未確定事項

- Phase 2のstaging領域の具体的な置き場所(Supabase内の別スキーマか、Actions実行環境内の
  一時ファイルか)。
- Phase 2のCron基盤の最終選定(本書はGitHub Actions scheduleを推奨するが、実装時に再評価する)。
- 通知・アラート手段(現時点で確定していない、Phase 2で検討)。
- 削除(tombstone)の扱い方(既存レコードが取得結果から消えた場合、即座に削除するか、
  一定期間「非表示フラグ」で保持してから削除するかは未確定)。
