# 機能の完全再監査（2026-10-07）

範囲: README・CHANGELOG・RELEASE_NOTES・`docs/**`（設計書 `efootball-team-ai-design.md`・`product/*`・`production-readiness/**`・`i18n/*`・`release/*`）・
`git log origin/main`（400 件）・`src`（ルート 51・内部ページ・TODO/provisional/NOT_CONFIGURED・未接続の関数）・`.github/workflows`（7 件）・
`package.json` scripts・`docs/production-readiness/sql/*`（本番 migration の提案）。読み取りだけで実施（Production・Git の状態・依存は変更なし）。

基準: 作業ツリー `docs/2026-10-07-overnight`（d58c53d）。`origin/main`（d38026f）にだけある #164（i18n のレビュー資料 v2）・#165（npm audit の非破壊修正）は commit で参照した。

**分類の読み方:** 1 行に 1 分類。残りの作業を止めている最も強い理由で分類した（例: コードの一部があっても、次の作業が本番の migration なら PRODUCTION_CHANGE_REQUIRED）。
「公開済み」は v1.0（2026-10-05・`docs/release/teamaixi-v1.md` §1）の範囲で判定。VERIFIED_COMPLETE は公開環境の black-box などの Evidence があるもの。

## 1. 集計

### 1.1 分類ごとの件数（合計 127 件 = 台帳の行 82 + 台帳の行の段階分け 2 + NEW 43）

| 分類 | 件数 |
|---|---|
| VERIFIED_COMPLETE | 20 |
| RELEASED | 23 |
| IMPLEMENTED_NOT_EXPOSED | 1 |
| IMPLEMENTED_NEEDS_VERIFICATION | 3 |
| PARTIALLY_IMPLEMENTED | 4 |
| DESIGN_COMPLETE | 2 |
| IMPLEMENTATION_READY | 10 |
| OWNER_DECISION_REQUIRED | 10 |
| OWNER_ACTION_REQUIRED | 6 |
| PRODUCTION_CHANGE_REQUIRED | 2 |
| EXTERNAL_CONTRACT_REQUIRED | 4 |
| LEGAL_OR_RIGHTS_BLOCKED | 2 |
| DEPENDENCY_BLOCKED | 18 |
| DUPLICATE | 5 |
| CONFLICTING_REQUIREMENTS | 0 |
| DEFERRED | 13 |
| REJECTED | 1 |
| NO_REPOSITORY_EVIDENCE | 3 |
| **合計** | **127** |

### 1.2 新たに見つかった要件（台帳に行が無いもの）

A. 台帳のどこにも記載が無い（23 件）

| ID | 要件 | 出典 |
|---|---|---|
| NEW-01 | Vercel Web Analytics（ページビュー・訪問者だけ・URL 整理） | 41db191・`production-readiness/web-analytics.md`・`src/app/layout.tsx:49` |
| NEW-02 | データ鮮度（データセットごとの取得日時）の表示 | 9cfde79・`src/components/HomePageView.tsx:217`・`production-readiness/stage5-invite-beta-readiness.md:44` |
| NEW-03 | 毎時の検出と GitHub schedule の欠落の観測（台帳 F-006 は「週次」のまま） | 987726f・`.github/workflows/reference-data-update-detection.yml:8,30` |
| NEW-05 | 本番の参照データ Backup（R2・v2）と Restore | `production-readiness/reference-data-auto-update-architecture-v2.md:36`・`reference-data-backup-restore-validation.md:27` |
| NEW-07 | Release Validator 群・アクセシビリティ監査 | 8ef4830・6cc64ab・ada6409・`scripts/validate-teamaixi-v1-release.mjs` |
| NEW-08 | 法務文書（規約・プライバシー・免責）とサポート窓口 | 12814a5・`docs/release/teamaixi-v1.md:20,110` |
| NEW-13 | 認証の招待・再認証・メール変更 | `production-readiness/auth-deferred-items.md:9-11` |
| NEW-17 | 画面移動の見張り（navigation watchdog）の再評価・短縮 | `product/integrated-roadmap.md:120`・`src/lib/navigation/navigation-watchdog.ts` |
| NEW-18 | Next.js 16 への移行（build 時の npm audit の解消） | `docs/release/next16-migration-plan.md` |
| NEW-19 | React #418 の解消と観測の契約 | 09b3811・`production-readiness/react-418-observation-contract.md` |
| NEW-21 | 比較画面の育成配分の URL 復元（`al`） | `src/lib/comparison/allocation-url.ts:3-12`・`schemas.ts:70,89` |
| NEW-22 | ひらがな・カタカナ（・ローマ字）の相互検索 | `docs/efootball-team-ai-design.md:507` |
| NEW-23 | 監督の比較 | `docs/efootball-team-ai-design.md:692` |
| NEW-24 | ブースターの一覧・効果の参照 | `docs/efootball-team-ai-design.md:219,692` |
| NEW-25 | Best XI の同一実在選手（別カード）の重複判定 | `docs/release/teamaixi-v1.md:96` |
| NEW-27 | アカウントのクラウドデータの書き出し | `production-readiness/implementation-roadmap.md:75-78` |
| NEW-28 | ステージング（Preview）環境 | `production-readiness/implementation-roadmap.md:80-85`・`preview-production-environment-design.md` |
| NEW-29 / NEW-30 | アラビア語（RTL）の公開と、RTL の残りの物理指定 | `docs/i18n/owner-decisions.md:12` |
| NEW-31 | 保存した絞り込み（`saved_filters`） | `docs/efootball-team-ai-design.md:464` |
| NEW-32 | World × eFHUB の照合（曖昧な候補・値の不一致の人手確認） | `docs/phase-world-efhub-reconcile.md:1-15` |
| NEW-39 | 公開 API のレート制限・CSRF | `docs/efootball-team-ai-design.md:596` |
| NEW-40 | コミュニティのガイドライン・通報の運用（草案） | `product/community-guidelines-draft.md:3` |

B. 台帳の「次の作業」・変更履歴・ロードマップにだけ書かれ、行が無い（13 件）: NEW-04（自動 Apply・F-006 に統合）、NEW-06（Rollback/Restore の自動化の禁止）、
NEW-09（法務の専門家レビュー）、NEW-10（独自ドメイン）、NEW-11（Custom SMTP）、NEW-12（TeamAIXI 名義のサポートアドレス）、NEW-14（noindex の解除）、
NEW-15（カードのサムネイル）、NEW-16（WebP/AVIF）、NEW-26（認証済みのテストダブルでの総合 black-box）、NEW-41（違うフォーメーション間の配置の写し）、
NEW-42（カテゴリ・スカッド単位のパーセンタイル）、NEW-43（ゲームプランの個別指示）。

C. 依頼の論点のうち、リポジトリに根拠が無いもの（3 件・NO_REPOSITORY_EVIDENCE）: NEW-33 データの更新履歴のページ、NEW-34 QR での共有、NEW-35 改善シミュレーション（独立の機能として）。
重複として統合したもの（DUPLICATE）: NEW-04→F-006、NEW-20→F-043、NEW-36→F-074/F-091、NEW-37→F-090、NEW-38→F-082。

## 2. 機能の一覧

略号: 台帳 = `docs/product/feature-ledger.md`、RM = `docs/product/integrated-roadmap.md`、D = `docs/efootball-team-ai-design.md`、v1 = `docs/release/teamaixi-v1.md`、
OD = `docs/product/owner-decisions-2026-10-02.md`、PR- = `docs/production-readiness/`。リスク: L/M/H。本番影響: none / migration / RLS / storage / auth / domain。

| ID | 機能 | 出典 | 状態 | 既存のコード・テスト・UI | 依存 | リスク | 本番影響 | 本人の判断・操作 | 優先 | 次の作業 | 完了条件 | 提供単位 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| F-001 | 選手・カード検索（日英・アクセント無視） | 台帳:27・0a62488 | VERIFIED_COMPLETE | `/players`・`search-normalize.ts`+test・総合 black-box 8vp | 参照データ | L | none | — | 6 | — | 公開 black-box の維持 | Published |
| F-001a | 国籍での絞り込み | 台帳:145 | OWNER_DECISION_REQUIRED | なし（国籍は詳細 API にある: `docs/black-box-tests/world-ui.md:50`） | F-001 | L | none | 原案に含むかの確認 | 6 | 本人に要否を確認 | 承認後に絞り込み+black-box | Local only |
| F-002 | 選手詳細 | 台帳:28 | VERIFIED_COMPLETE | `/players/world/[id]` | F-001 | L | none | — | 6 | — | 同上 | Published |
| F-003 | 監督の検索・詳細 | 台帳:29 | VERIFIED_COMPLETE | `/managers`（監督画像なしが正式） | 参照データ | L | none | — | 6 | — | 同上 | Published |
| F-004 | 選手比較（2〜4 人） | 台帳:30 | VERIFIED_COMPLETE | `/compare`・`black-box-compare*.mjs` | F-002 | L | none | — | 6 | — | 同上 | Published |
| F-005 | お気に入り | 台帳:31 | RELEASED | `/favorites`・`favorites-storage-scope.test.ts` | F-001 | L | none | — | 6 | 認証時の確認は NEW-26 | 認証/未認証の black-box | Published |
| F-006 | 参照データの自動更新（検出→Plan→Backup→Dry run→Apply→事後検証） | 台帳:32・v1:93・PR-auto-apply-db-secret-recovery.md:1-30 | OWNER_ACTION_REQUIRED | workflow 6 件・`src/lib/reference-data/auto-update/*`。10-05 の自動 Apply は 28P01 で停止（書き込み 0） | GitHub Actions・Supabase | M（DB の資格情報） | none | 自動用 Environment の `REFERENCE_DATA_APPLY_DB_URL` を再登録 | 3 | 本人が復旧の手順を実行→次の検出で確認 | 自動 Apply が applied_verified・World 16 件が反映 | Production apply waiting |
| F-007 | 日本語/英語 | 台帳:33 | VERIFIED_COMPLETE | `LanguageSwitcher.tsx` | — | L | none | — | 6 | 英語の用語監査 | 公開画面に日本語 0 | Published |
| F-007b | 多言語の基盤・10 言語の RELEASE_CANDIDATE | 台帳:34・`docs/i18n/owner-decisions.md:5-26`・746ce16 | OWNER_ACTION_REQUIRED | locale 契約・`audit:locales`・レビュー資料 v2（#164） | ネイティブのレビュー担当 | L | none | レビュー担当の手配・言語ごとの公開判断 | 9 | es・pt-BR のレビュー依頼 | reviewedBy 記録・多言語 black-box・state=PUBLISHED | Public release candidate |
| F-008 | 公開範囲・noindex・内部ページ 404・ヘッダー | 台帳:35・`src/lib/public-info/internal-pages.ts:10` | VERIFIED_COMPLETE | 内部ページ 5 件は本番 404・security 18/18 | — | L | none | noindex の解除は NEW-14 | 1 | — | security の維持 | Published |
| F-009 | 性能 | 台帳:36・CHANGELOG.md（Performance） | VERIFIED_COMPLETE | #136・#144・#145・`scripts/perf-flows.mjs` | — | L | none | — | 5 | サムネイルは NEW-15 | 計測の維持 | Published |
| F-010 | 物理データの順位・パーセンタイル（選手単位） | 台帳:37・`src/lib/world/player-analysis.ts:250-255` | RELEASED | 選手詳細（集計時点の母数を表示） | appearance | L | none | 再集計の方針 | 7 | 方針の決定待ち | 母数の時点の表示を維持 | Published |
| F-020 | My Team | 台帳:43 | RELEASED | `/my-team`・`my-team-storage-scope.test.ts` | F-001 | L | none | — | 6 | 認証時は NEW-26 | 同上 | Published |
| F-021 | My Builds | 台帳:44 | RELEASED | `/my-builds`・`black-box-my-builds.mjs` | F-028 | L | none | — | 6 | 同上 | 同上 | Published |
| F-022 | ビルド分析 | 台帳:45 | RELEASED | `/build-inventory` | F-021 | L | none | — | 6 | — | — | Published |
| F-023 | 保存ビルドの JSON 書き出し・読み込み | 台帳:46 | RELEASED | `BuildImportModal.tsx`（未知の formatVersion を拒否） | F-021 | L | none | — | 8 | — | — | Published |
| F-023b | 現在の領域の全データ Backup・Restore・削除 | 台帳:47 | VERIFIED_COMPLETE | `local-backup.ts`・`local-backup-security.test.ts`・black-box 28/28 | F-023 | M（検証済み） | none | — | 8 | — | — | Published |
| F-024 | Squads（編集・テンプレート・比較） | 台帳:48 | RELEASED | `/squads`・`/squads/compare`・`/squads/templates` | F-020 | L | none | — | 6 | — | — | Published |
| F-025 | Best XI（ルールベース） | 台帳:49 | RELEASED | `src/lib/best-xi/*`・`black-box-best-xi*.mjs` | F-020 | L | none | — | 6 | 重複は NEW-25 | — | Published |
| F-026 | スカッド診断（8 カテゴリ・強み・弱点・改善提案） | 台帳:50 | RELEASED | `squad-diagnosis.ts`+test | F-024 | L | none | — | 7 | — | — | Published |
| F-027 | 通常/辛口コメント | 台帳:51 | RELEASED | `squad-diagnosis-comments(-en).ts` | F-026 | L | none | — | 7 | — | — | Published |
| F-028 | 育成・能力計算（残りポイント・育成前後の値） | 台帳:52 | RELEASED | `src/lib/progression/*`・`StatComparison.tsx` | 参照データ | L | none | — | 7 | 規則の更新時に再検証 | — | Published |
| F-029 | Booster（B1/B2・strict/standard/experimental） | 台帳:53・`booster-resolution.ts:49` | RELEASED | `booster.test.ts` | F-028 | L | none | — | 7 | — | — | Published |
| F-029b | B2 の UI の統一（比較と `PlayerBoosterPanel`） | 台帳:54 | IMPLEMENTATION_READY | 両方の画面に別実装 | F-029 | L | none | なし | 6 | 表示の差分の棚卸し→共通化 | 両画面で同じ表示・既存 test・8vp black-box | Local only |
| F-030 | Power of Many（人数別の効果量） | 台帳:56・`booster-catalog.ts:162-169` | IMPLEMENTED_NEEDS_VERIFICATION | total-package は provisional | 出典 | L | none | 外部の出典の確認（外部アクセスは承認制） | 7 | 効果量の出典の確認 | 出典の記録・confirmed 化 | Published |
| F-030b | Game Plan からの Power of Many の自動段階 | 台帳:55・`conditional-boosters.ts:17,138` | DEPENDENCY_BLOCKED | `levelForRegisteredPlayers` は UI 未接続 | F-030・F-033 | L | none | — | 7 | F-030 の後に接続 | — | Local only |
| F-031 | Link-Up Play（監督・スカッド内の発動条件の照合） | 台帳:57・`src/lib/squad/link-up.ts:5-10`・`SquadEditor.tsx:1972` | RELEASED | 照合だけ（効果は能力へ未適用） | F-003 | L | none | — | 7 | 台帳の「要確認」を更新 | 効果の確認まで照合だけ | Published |
| F-032 | ポジション適性 | 台帳:58 | RELEASED | player-analysis tests | F-002 | L | none | — | 7 | — | — | Published |
| F-032b | ポジション別 OVR | 台帳:59・`player-analysis.ts:245` | DEPENDENCY_BLOCKED | 非表示（理由を表示） | 計算規則のサンプル | L | none | サンプルの提供 | 7 | サンプルの収集 | 複数カードで一致する算式 | Local only |
| F-033 | 完全ゲームプラン（配置編集の MVP） | 台帳:60・RM:183 | RELEASED | `squad-game-plan-editing.md`・`StoredSetPieces` | F-024 | L | none | — | 6 | 個別指示は NEW-43 | — | Published |
| F-034 | 能力値の直接操作・スライド式の育成 | 台帳:63 | VERIFIED_COMPLETE | PR #80〜#84・568/568 | F-028 | L | none | 主観の確認 | 6 | — | — | Published |
| F-035 | プレースタイルの発動・連携の分析 | 台帳:61 | DEFERRED | `docs/playing-style-ledger.md` | 公式の条件 | L | none | — | 7 | 公式の条件の確認後 | — | Local only |
| F-036 | 配置補助（複数選択・整列・均等・反転・写し） | 台帳:62 | RELEASED | `placement-assist`・`placement-clipboard` test・black-box | F-024 | L | none | — | 6 | 違う配置間は NEW-41 | — | Published |
| F-040 | 診断結果カード | 台帳:69 | RELEASED | `squad-diagnosis-share.ts`（内部 ID なし） | F-026 | L | none | — | 8 | — | — | Published |
| F-041 | 画像保存（PNG） | 台帳:70 | RELEASED | `squad-diagnosis-image.ts`・`build-diagnosis-card-image.ts` | F-040 | L | none | — | 8 | — | — | Published |
| F-041b | カードの比率・プレビュー・OS 共有 | 台帳:72・b3c9acc | VERIFIED_COMPLETE | black-box 24/24・描けない文字の保存を拒否 | F-041 | L | none | 主観の確認 | 8 | — | — | Published |
| F-042 | 診断の共有 URL（sd1・fragment） | 台帳:71・`product/share-url-contract.md` | VERIFIED_COMPLETE | 522/522・no-referrer・noindex | F-040 | M（対策済み） | none | — | 8 | — | — | Published |
| F-043 | 改善前後の比較カード・共有 | 台帳:74 | VERIFIED_COMPLETE | `diagnosis-compare.ts`・`/share/compare` | F-060 | L | none | — | 8 | — | — | Published |
| F-044 | Pro 向けの詳細診断 | 台帳:75・RM:186 | DEFERRED | 出力の基本/詳細の分離だけ | F-120 | L | auth | 課金の再判断 | 17 | — | — | Local only |
| F-045 | 診断の追加観点（左右・控え・役割重複・監督適合 等） | 台帳:73・OD:5-18・`SquadEditor.tsx:2003` | OWNER_DECISION_REQUIRED | `diagnosis-perspectives.ts`（provisional v1 を画面に暫定表示）・比較 test | F-026 | L（暫定値の誤解） | none | 重み・総合式の決定 | 7 | `f045-candidate-comparison.md` の材料で判断を依頼 | 規則の版を確定・暫定の表記を外す | Published |
| F-050 | 認証（ログイン・再設定・新規登録は限定） | 台帳:81・PR-auth-deferred-items.md:7 | OWNER_ACTION_REQUIRED | `/auth/*`・`validate:auth-email-release`・signup limited | NEW-10・NEW-11 | H | auth+domain | ドメインのまとめ買い→手順 A〜G | 11 | 購入の後に手順書 | Validator が READY+本人の承認 | Production-ready but disabled |
| F-051 | アカウント別のデータ分離（RLS・ローカルの名前空間・移行） | 台帳:82・`src/app/account/local-data-migration/page.tsx` | IMPLEMENTED_NEEDS_VERIFICATION | RLS PoC・`*-scope.test.ts`・`black-box-account-scoped-storage.mjs` | F-050 | H | RLS | — | 1 | 総合 black-box に認証済みを追加（NEW-26） | 他人のデータが見えない black-box | Published |
| F-052 | クラウド同期 | 台帳:83・PR-my-team-cloud-poc-verification-record.md | PARTIALLY_IMPLEMENTED | `my_team_snapshots` の手動 PoC（`/account/my-team-cloud`） | F-051 | M | migration+RLS | ビルド・スカッドの表の migration の承認 | 12 | ビルド同期の migration の提案 | 3 種の同期と RLS の分離 test | Published |
| F-053 | 公開 ID・公開プロフィール | 台帳:84・OD:37・`src/lib/profile/public-id.ts` | PRODUCTION_CHANGE_REQUIRED | 規則+内部の試作 `/account/public-id-preview` | F-050・F-056 | H（なりすまし） | migration+RLS | 本番 migration・規約 | 10 | `public_profiles` の migration の提案（未適用） | 提案 SQL+使い捨て PG の分離 test | Internal preview |
| F-054 | 公開範囲（非公開/URL 限定/友達/全体） | 台帳:85 | DEPENDENCY_BLOCKED | 型だけ（`post-model.ts:66`） | F-053 | H | RLS | — | 10 | F-053 と同時 | — | Mock |
| F-055 | 友達 | 台帳:86 | DEPENDENCY_BLOCKED | なし | F-053・F-056 | H | migration+RLS | 通知の方法 | 13 | — | — | Local only |
| F-056 | ブロック・ミュート・通報・異議申し立て | 台帳:87・`src/lib/safety/safety-model.ts` | PARTIALLY_IMPLEMENTED | ローカルの型・モック（`LocalSafetySample.tsx`）・test | F-050 | H | migration+RLS | 通報の対応体制・規約・migration | 10 | reports/blocks/mutes の migration 提案を使い捨て PG で検証 | 提案 SQL+RLS test | Internal preview |
| F-057 | 退会・アカウントの削除 | 台帳:88・PR-auth-deferred-items.md:12 | OWNER_DECISION_REQUIRED | 問い合わせ経由の手動削除だけ | F-050 | H（個人データの削除） | migration | 方式（Edge Function / DB 関数）の承認 | 1 | 2 方式の比較を本人へ | 本人のデータだけ消える black-box | Local only |
| F-058 | データ管理（端末内の確認・削除） | 台帳:89 | VERIFIED_COMPLETE | `/data-management` | — | L | none | — | 1 | — | — | Published |
| F-060 | 診断履歴 | 台帳:95 | VERIFIED_COMPLETE | `diagnosis-history.ts` | F-026 | L | none | — | 8 | クラウド版は F-052 | — | Published |
| F-061 | 成長プロフィール（ブラウザー内） | 台帳:96・v1:16 | RELEASED | `GrowthProfilePanel.tsx`・115/115 | F-060 | L | none | — | 8 | クラウド版は F-052 の後 | — | Published |
| F-062 | 友達との比較・ライバル | 台帳:97・`ja-ns/about.ts:40` | DEPENDENCY_BLOCKED | なし（About で「未提供」） | F-055 | M | RLS | — | 13 | — | — | Local only |
| F-070 | 監督補正つきの Best XI | 台帳:98・`best-xi/candidates.ts:21`・RM:117 | OWNER_DECISION_REQUIRED | 監督補正は常に null | F-025 | L | none | 戦術・監督ごとの評価式 | 7 | 規則の案（F-072 の能力のまとまり）を提示 | 版つき規則+test+black-box | Local only |
| F-071 | 基礎能力値のパーセンタイル | 台帳:99 | VERIFIED_COMPLETE | `src/lib/percentiles/*`・`/api/percentiles/world-base` | F-006 | L | none | — | 7 | World の適用ごとに成果物を更新 | VALID の維持 | Published |
| F-072 | 称号・バッジ | 台帳:100 | VERIFIED_COMPLETE | `src/lib/titles/*` | F-071 | L | none | 主観の確認 | 8 | — | — | Published |
| F-073 | 「あなたの一番」 | 台帳:101 | VERIFIED_COMPLETE | `your-best.ts` | F-071 | L | none | — | 8 | — | — | Published |
| F-074 | スカッドの独自性 | 台帳:102・`community-and-growth-design.md:55-59` | OWNER_DECISION_REQUIRED | なし | 公開スカッドの集計 | H（利用統計） | migration | 集計の同意・保持期間・プライバシーポリシー | 14 | — | — | Local only |
| F-075 | ランキング | 台帳:103 | DEPENDENCY_BLOCKED | なし | F-053・F-056 | H | migration | — | 14 | — | — | Local only |
| F-080 | 公開ビルド・公開スカッド | 台帳:111 | DEPENDENCY_BLOCKED | なし | F-054・F-056 | H | migration+RLS | — | 13 | — | — | Local only |
| F-081 | 反応・コメント・返信・保存・フォロー | 台帳:112・D:570 | DEPENDENCY_BLOCKED | `commentsAllowed` だけ（`post-model.ts:69`） | F-080 | H | migration+RLS | — | 13 | — | — | Mock |
| F-082 | モデレーション（NG ワード・通報キュー・管理操作） | 台帳:113 | DEPENDENCY_BLOCKED | `ModerationAction` の型だけ | F-056 | H | migration+RLS | 対応体制 | 13 | — | — | Mock |
| F-083 | コミュニティの発見・不正利用の対策 | 台帳:114 | DEPENDENCY_BLOCKED | なし | F-082 | H | migration | — | 13 | — | — | Local only |
| F-084 | 写真付き投稿 段階 1（カメラ・ライブラリ・EXIF 除去） | 台帳:115 | IMPLEMENTED_NOT_EXPOSED | `/community/local-posts`（本番 404）・`image-safety.ts`・32/32 | — | H（位置情報→除去済み） | none | — | 10 | — | — | Internal preview |
| F-084-S2 | 写真付き投稿 段階 2（本人だけの非公開投稿） | `product/photo-posts-stage2-proposal.md:13-64`・PR-sql/create-photo-posts-stage2-schema.sql | PRODUCTION_CHANGE_REQUIRED | 提案 SQL・Storage・Policy・`photo-posts-rls.postgres.test.ts` | F-050・F-056 | H | migration+RLS+storage | バケット・RLS・migration の承認 | 12 | 承認待ち | 本番適用+分離の black-box | Production migration proposal |
| F-084-S3 | 写真付き投稿 段階 3（URL 限定）の契約のモック | `product/photo-posts-stage2-proposal.md:100`・`reaudit-2026-10-01.md:80` | IMPLEMENTATION_READY | 契約の文書だけ | F-084 | M | none（モック） | なし（本番化は承認） | 10 | URL 限定の契約を型+test で実装 | 内部ページで動作・本番 404 | Mock |
| F-085 | 投稿フィード（カテゴリ・選手・監督・フォーメーション別） | 台帳:116・`reaudit-2026-10-01.md:80` | IMPLEMENTATION_READY | なし | F-084 | M | none（モック） | なし | 10 | ローカル/モックのフィード | 内部ページ・test・本番 404 | Mock |
| F-090 | Tier | 台帳:122・OD:20-31 | LEGAL_OR_RIGHTS_BLOCKED | 合成データの試作 `/tier-pack-preview`・`tier-pack/model.ts` | データ源 | M（転載） | none | 許諾の範囲・自前の規則の可否 | 14 | 判断待ち | — | Internal preview |
| F-091 | メタ分析 | 台帳:123 | DEPENDENCY_BLOCKED | なし | F-090 | M | none | — | 14 | — | — | Local only |
| F-092 | Pack・ガチャ診断 | 台帳:124・D:535-546 | LEGAL_OR_RIGHTS_BLOCKED | 合成モック | Pack データ | M | none | 同上 | 14 | 判断待ち | — | Internal preview |
| F-093 | 相手分析 | 台帳:125 | DEFERRED | なし | F-026 | L | none | — | 15 | — | — | Local only |
| F-094 | AI 戦術分析 | 台帳:126 | DEFERRED | なし | F-033 | L | none | — | 15 | — | — | Local only |
| F-095 | チーム力・監督相性の計算 | 台帳:127 | OWNER_DECISION_REQUIRED | なし | F-026・F-003 | L | none | 計算式 | 7 | — | — | Local only |
| F-100 | AI コーチ | 台帳:133 | EXTERNAL_CONTRACT_REQUIRED | なし | API 契約 | H（入力の個人情報） | none | API 契約・費用上限 | 15 | — | — | Local only |
| F-101 | Build Intent（自由記述の読み取り） | 台帳:134・`src/app/api/build-intent/extract/route.ts:11` | PARTIALLY_IMPLEMENTED | ルールベースの辞書・AI は NOT_CONFIGURED | F-100 | L | none | AI 契約（任意） | 15 | ルールベースを継続 | — | Published |
| F-102 | 画像認識によるスカッド入力 | 台帳:135・D:548-555 | EXTERNAL_CONTRACT_REQUIRED | なし（写真の安全処理は F-084） | API・保存方針 | H | storage | 契約・画像の保存方針 | 15 | — | — | Local only |
| F-103 | 個人最適化 | 台帳:136 | DEFERRED | なし | 同意の設計 | H | migration | 同意の設計 | 15 | — | — | Local only |
| F-104 | Wiki | 台帳:137 | DEFERRED | なし | — | L | none | — | 9 | — | — | Local only |
| F-105 | AI 生成系 | 台帳:138 | EXTERNAL_CONTRACT_REQUIRED | なし | F-100 | H | none | 同上 | 15 | — | — | Local only |
| F-110 | PWA・ネイティブアプリ | 台帳:139 | DEFERRED | なし | — | L | none | 価値・収益性 | 16 | — | — | Local only |
| F-120 | 課金・Pro | 台帳:140・RM:186 | DEFERRED | なし | 法務・税 | H（決済） | auth+migration | 再判断 | 17 | — | — | Local only |
| F-121 | 通知 | 台帳:141 | DEPENDENCY_BLOCKED | なし | F-055 | M | migration | — | 13 | — | — | Local only |
| F-122 | 管理画面 | 台帳:142・D:576-585 | DEFERRED | GitHub Actions+Evidence で代替 | — | M | auth | — | 13 | — | — | Local only |
| F-123 | 監視（Sentry 等） | 台帳:143 | OWNER_ACTION_REQUIRED | なし | 本人のアカウント | M | none | アカウントの作成 | 2 | — | — | Local only |
| F-124 | 利用範囲の制限 | 台帳:144・RM:127 | RELEASED | 解除済み→v1.0 の公開で置き換え | — | L | none | — | 2 | 台帳の表記を v1.0 に合わせる | — | Published |
| NEW-01 | Vercel Web Analytics | 41db191・PR-web-analytics.md・`src/app/layout.tsx:49` | VERIFIED_COMPLETE | `sanitize-analytics-event.ts`+test・`evidence/2026-10-07-web-analytics.json` | Vercel Hobby | M（URL の整理で軽減） | none | — | 1 | 表記の維持（44295df） | — | Published |
| NEW-02 | データ鮮度の表示 | 9cfde79・`HomePageView.tsx:217` | RELEASED | Home「データの状態」（`/api/data-status` は UI 未使用） | F-006 | L | none | — | 6 | — | — | Published |
| NEW-03 | 毎時の検出・schedule の欠落の観測 | 987726f・`reference-data-update-detection.yml:30`・RM:90-92 | OWNER_DECISION_REQUIRED | `observe-hourly-detection.mjs`・130 分の通知 | GitHub schedule | L | none | 10-13 の結果で外部起動を再検討 | 3 | 10-13 に観測を報告 | 本人の決定を記録 | Published |
| NEW-04 | 完全無人の自動 Apply | eb71db6・台帳:155 | DUPLICATE | F-006 に統合 | F-006 | M | none | F-006 と同じ | 3 | — | — | Production apply waiting |
| NEW-05 | 本番の参照データ Backup・Restore | PR-reference-data-auto-update-architecture-v2.md:36・PR-reference-data-backup-restore-validation.md:27 | IMPLEMENTED_NEEDS_VERIFICATION | Backup v2 は Apply の前に実行・Restore は隔離 PG だけ | — | H（データ損失） | none | 本番 Restore の演習の可否 | 1 | 最新の Backup で隔離環境の Restore を再確認 | 隔離 PG で件数・checksum が一致 | Published |
| NEW-06 | Rollback・Restore の自動化 | 台帳:155・RM:143 | REJECTED | 手動のまま | — | H | none | — | 1 | — | — | — |
| NEW-07 | Release Validator・a11y 監査 | 8ef4830・6cc64ab・ada6409 | VERIFIED_COMPLETE | validator 3 件・a11y 32/32 | — | L | none | — | 2 | リリースごとに実行 | — | Local only |
| NEW-08 | 法務文書・サポート窓口 | 12814a5・v1:20,110 | RELEASED | `/terms` `/privacy` `/disclaimer` `/support`・`black-box-support-contact.mjs` | — | M | none | — | 1 | — | — | Published |
| NEW-09 | 専門家による法務のレビュー | RM:122・`docs/release/legal-review-checklist.md` | EXTERNAL_CONTRACT_REQUIRED | チェックリストだけ | 専門家 | M | none | 依頼の判断 | 1 | — | レビューの反映 | Local only |
| NEW-10 | 独自ドメイン | RM:108・PR-domain-purchase-queue.md | OWNER_ACTION_REQUIRED | 手順書 | — | M | domain | 購入（まとめ買い） | 11 | — | Vercel・DNS の設定 | Local only |
| NEW-11 | Custom SMTP | RM:109・PR-auth-deferred-items.md:8 | DEPENDENCY_BLOCKED | メールのテンプレート（05e2ffd） | NEW-10 | H | auth+domain | — | 11 | — | 配信の確認 | Production-ready but disabled |
| NEW-12 | TeamAIXI 名義のサポートアドレス | RM:110 | DEPENDENCY_BLOCKED | — | NEW-10 | L | domain | — | 11 | — | — | Local only |
| NEW-13 | 招待・再認証・メール変更 | PR-auth-deferred-items.md:9-11 | DEPENDENCY_BLOCKED | テンプレート・`/auth/confirm` の着地点・変更画面は無効 | NEW-11 | H | auth | — | 11 | — | 配信 test | Production-ready but disabled |
| NEW-14 | noindex の解除・検索掲載 | RM:121・v1:98-102 | OWNER_DECISION_REQUIRED | X-Robots-Tag・robots.txt | — | M | none | 解除の判断 | 9 | — | — | Published |
| NEW-15 | カードのサムネイル（Vercel IO / sharp） | RM:118・v1:80-81 | OWNER_DECISION_REQUIRED | 近くだけ読み込む案 D を採用済み | 依存・費用 | L | none | 方式の選択（依存の追加は承認制） | 5 | — | — | Local only |
| NEW-16 | WebP / AVIF | RM:119 | DEPENDENCY_BLOCKED | — | NEW-15 | L | none | — | 5 | — | — | Local only |
| NEW-17 | 画面移動の見張りの再評価・短縮 | RM:120・v1:90・`navigation-watchdog.ts` | IMPLEMENTATION_READY | 5 秒の見張り（#142） | — | L | none | なし | 5 | RSC 応答の後の未確定を早く検出 | 通常の移動で発動 0・停止は 5 秒未満で完了 | Local only |
| NEW-18 | Next.js 16 への移行 | `docs/release/next16-migration-plan.md` | DESIGN_COMPLETE | 計画だけ・#165 で非破壊の修正 | 1 週間の無障害・依存の更新の承認 | M（build 時だけ） | none | 依存の更新の承認 | 1 | 条件の後に `chore/next16` | verify・13 rails・Preview 1 日 | Local only |
| NEW-19 | React #418 の解消と観測 | 09b3811・v1:89 | VERIFIED_COMPLETE | 本番 3 回連続 576/576 | — | L | none | — | 2 | 観測の継続 | — | Published |
| NEW-20 | 改善前後の共有 URL | `src/app/share/compare/page.tsx`・台帳:71 | DUPLICATE | F-043 に統合 | F-043 | L | none | — | 8 | — | — | Published |
| NEW-21 | 比較画面の育成配分の URL 復元 | `comparison/allocation-url.ts:3-12`・`schemas.ts:70,89` | RELEASED | test あり（許可リスト・長さ上限） | F-004 | L | none | — | 6 | 台帳に記録 | — | Published |
| NEW-22 | ひらがな・カタカナの相互検索 | D:507 | IMPLEMENTATION_READY | `search-normalize.ts`（アクセント・NFKC だけ） | — | L | none | なし（ローマ字は読みデータが無く対象外） | 6 | かなの正規化を検索条件へ（schema 変更なし） | test+検索 black-box | Local only |
| NEW-23 | 監督の比較 | D:692 | IMPLEMENTATION_READY | なし（戦術適性・ブースターのデータはある） | F-003 | L | none | なし | 9 | 2〜4 人の事実の比較 | test+8vp black-box・日英 | Local only |
| NEW-24 | ブースターの一覧・効果の参照 | D:219,692 | IMPLEMENTATION_READY | `booster-catalog.ts`（UI は選手・比較の中だけ） | F-029 | L | none | なし | 9 | 効果と証拠の段階を示すページ | test+black-box | Local only |
| NEW-25 | Best XI の同一実在選手の重複 | v1:96 | DEPENDENCY_BLOCKED | 既知の制約 | 実在選手の識別子（参照データに無い） | L | migration（列の追加なら） | — | 4 | 識別子の有無を調査 | — | Local only |
| NEW-26 | 認証済みのテストダブルでの総合 black-box | RM:63・台帳:43 | IMPLEMENTATION_READY | 個別の rail はある（`black-box-account-scoped-storage.mjs` ほか） | F-051 | M | none | なし | 1 | My Team・My Builds を総合 black-box へ | 認証あり/なしの両方で合格 | Local only |
| NEW-27 | アカウントのクラウドデータの書き出し | PR-implementation-roadmap.md:75-78 | DEPENDENCY_BLOCKED | ローカルは F-023b | F-052 | M | none | — | 12 | — | — | Local only |
| NEW-28 | ステージング（Preview）環境 | PR-implementation-roadmap.md:80-85・PR-preview-production-environment-design.md | DESIGN_COMPLETE | v1 は Preview URL を使わない（v1:111） | 検証用 Supabase | M | auth | Preview 用の設定 | 12 | — | — | Local only |
| NEW-29 | アラビア語（RTL）の公開 | `docs/i18n/owner-decisions.md:12` | DEFERRED | 疑似 RTL で確認済み | NEW-30 | L | none | 延期（推奨） | 9 | — | — | Local only |
| NEW-30 | RTL の残りの物理指定 | `docs/i18n/owner-decisions.md:12`・`docs/i18n/rtl-position-utilities.md` | IMPLEMENTATION_READY | 論理指定 255 か所は済み・残り left-/right- 43・translate-x 9 | — | L | none | なし | 9 | 残りを論理指定へ（LTR は不変） | RTL のガード test・LTR の回帰なし | Local only |
| NEW-31 | 保存した絞り込み | D:464 | DEFERRED | なし | — | L | none | — | 9 | — | — | Local only |
| NEW-32 | World × eFHUB の照合 | `docs/phase-world-efhub-reconcile.md:1-15` | PARTIALLY_IMPLEMENTED | ローカル SQLite のレポート（曖昧 8,681・不一致 59 は人手待ち） | F-122 | L | none | — | 7 | 現在の参照データでの要否を確認 | — | Local only |
| NEW-33 | データの更新履歴のページ | `git grep 更新履歴` 0 件（近いもの: CHANGELOG.md・`evidence/world-update-*.json`） | NO_REPOSITORY_EVIDENCE | なし | — | L | none | 要否 | 9 | — | — | — |
| NEW-34 | QR での共有 | `git grep -i qr` で該当なし（`share-url-contract.md` は URL だけ） | NO_REPOSITORY_EVIDENCE | なし | — | L | none | 要否 | 8 | — | — | — |
| NEW-35 | 改善シミュレーション（独立の機能） | 該当語なし（近いもの: F-026 の改善提案・F-043） | NO_REPOSITORY_EVIDENCE | なし | — | L | none | 要否 | 8 | — | — | — |
| NEW-36 | 選手・監督・フォーメーションの使用率 | v1:27・`community-and-growth-design.md:57-58` | DUPLICATE | F-074・F-091 に統合 | — | H | migration | — | 14 | — | — | — |
| NEW-37 | 自作ティアリスト・投票 | D:189-190 | DUPLICATE | F-090 に統合 | — | M | migration | — | 14 | — | — | — |
| NEW-38 | 匿名投稿（IP ハッシュ） | D:571・`reaudit-2026-10-01.md:18` | DUPLICATE | F-082 に統合 | — | H | migration | — | 13 | — | — | — |
| NEW-39 | 公開 API のレート制限・CSRF | D:596 | DEFERRED | 検索入力の境界の test だけ（`search-input-boundary.test.ts`） | — | M | none | — | 1 | 読み取り API の濫用の評価 | — | Local only |
| NEW-40 | コミュニティのガイドライン・通報の運用 | `product/community-guidelines-draft.md:3` | OWNER_ACTION_REQUIRED | 草案 | F-056 | H | none | 承認・法務 | 10 | — | 規約への反映 | Local only |
| NEW-41 | 違うフォーメーション間の配置の写し | 台帳:62 | IMPLEMENTATION_READY | 同じ配置どうしの写しはある（91435d0） | F-036 | L | none | なし（枠の対応の規則を文書化） | 6 | 位置の対応の決定的な規則を実装 | test+black-box | Local only |
| NEW-42 | カテゴリ・スカッド単位のパーセンタイル | 台帳:99・RM:57 | OWNER_DECISION_REQUIRED | なし | F-071 | L | none | 計算式 | 7 | — | — | Local only |
| NEW-43 | ゲームプランの個別指示 | 台帳:60・RM:183 | DEFERRED | なし | 公式の仕様 | L | none | — | 7 | — | — | Local only |

## 3. 文書の食い違いと判断

| # | 食い違い | 従ったもの（理由） |
|---|---|---|
| 1 | 台帳 F-006（台帳:32）は「週次の自動検出」。workflow は毎時（`reference-data-update-detection.yml:8,30`・本人の決定 2026-10-04） | コード（main）。NEW-03 を追加 |
| 2 | 台帳 F-031（台帳:57）は「スカッド内の発動判定（要確認）」。コードはスカッド編集画面で発動条件を照合している（`link-up.ts:5-10`・`SquadEditor.tsx:1972`） | コード。効果は未適用のまま |
| 3 | 台帳 F-045（台帳:73）は「designed 5%」。変更履歴（台帳:166）と `SquadEditor.tsx:2003` では暫定の観点を画面に表示 | コード。暫定の表示は公開中・確定は本人の判断 |
| 4 | F-124 は招待制 3〜5 人（RM:141）・10〜30 人への拡大は本人が再判断（RM:142）。2026-10-04 に v1.0 として URL を知る全員へ公開（RM:127） | 最新の本人の決定（v1.0）。F-124 は RELEASED（置き換え済み） |
| 5 | RM:143（2026-10-03）は「Apply の無承認化・Rollback/Restore の自動化を禁止」。2026-10-04 の本人の決定で無人の自動 Apply を実装（RM:132-136・台帳:155） | 最新の決定。自動 Apply は採用、Rollback/Restore の自動化は引き続き不採用（NEW-06） |
| 6 | i18n の判断（`docs/i18n/owner-decisions.md:7`・2026-10-06）は下書き 2.9%。台帳 F-007b（台帳:34・2026-10-07）は公開画面 100% の RELEASE_CANDIDATE | 新しい Evidence（`evidence/2026-10-07-multilingual-release-candidates.json`） |
| 7 | 対応表（`original-vision-traceability.md`）は F-023b を idea、F-056 を designed、F-061 を completed と記載 | 台帳とコード（F-023b verified・F-056 部分実装・F-061 は v1.0 で公開） |
| 8 | `data-distribution-rights-audit.md` §0 は再配布の許諾を報告。台帳 F-090/F-092・RM Q4 は確認待ち（OD:20-31） | 安全側（確認待ち）。対象のデータ源が文書から特定できないため未解決・本人の判断 |
| 9 | 設計書 9-5 は PWA を将来とし、`decision-record.md` §4 は React Native を候補（台帳:139） | 未解決（F-110 は DEFERRED のまま） |
| 10 | 作業ツリー（d58c53d）は `origin/main` の #164・#165 を含まない | 両方を commit（746ce16・186af39）で参照。分類には影響なし |

## 4. 次に進める IMPLEMENTATION_READY 上位 10 件（本人の操作・本番の変更が不要）

| 順 | ID | 理由 |
|---|---|---|
| 1 | NEW-26 認証済みの総合 black-box | 公開中のアカウントのデータ分離を総合の確認に入れる（優先 1: プライバシー）。テストダブルだけで本番に触れない |
| 2 | NEW-17 画面移動の見張りの短縮 | 新しいブラウザーの最初の移動で停止が出ている（`evidence/2026-10-06-post-release.json`）。体感速度（優先 5）をコードだけで改善できる |
| 3 | NEW-22 かなの相互検索 | 公開中の検索の完成度（優先 6）。2026-10-06 のアクセント対応と同じく schema を変えずに検索条件だけで実装できる |
| 4 | F-029b B2 の UI の統一 | 公開中の 2 画面で B2 の表示が別実装（優先 6）。計算は変えず表示だけを揃える |
| 5 | NEW-41 違うフォーメーション間の配置の写し | 公開中の F-036 の残り（優先 6）。決定的な対応規則を文書化して実装できる |
| 6 | NEW-23 監督の比較 | 設計書 Phase 1 の要件。既存の監督データの事実を並べるだけで推測を含まない（優先 9） |
| 7 | NEW-24 ブースターの一覧 | 設計書の要件。`booster-catalog.ts` の効果と証拠の段階をそのまま表示できる（優先 9） |
| 8 | NEW-30 RTL の残りの物理指定 | 残り 52 か所。LTR を変えずに将来のアラビア語の準備を終えられる（優先 9） |
| 9 | F-085 投稿フィードのモック | 段階 1 のローカル投稿の上に作れる。本番は 404 のまま（優先 10・`reaudit-2026-10-01.md:80` の「モックまで」） |
| 10 | F-084-S3 URL 限定の契約のモック | 契約（`photo-posts-stage2-proposal.md:100`）を型と test で先に固め、段階 2 の承認の後の作業を減らす（優先 10） |
