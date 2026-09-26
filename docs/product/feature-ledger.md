# Feature ledger (機能台帳)

作成: 2026-09-27。出典の対応は `original-vision-traceability.md`、実装順は `integrated-roadmap.md`。

**状態の定義:** `idea` / `researched` / `designed` / `partially_implemented` / `implementation_ready` /
`in_progress` / `blocked` / `completed` / `verified` / `deferred` / `rejected` / `proposal`(Claude Code発の案・本人承認前は公開しない)。

- `completed` は「コード＋tests＋Build」まで。
- `verified` は、さらに black-box と公開環境での確認まで済んだもの。
- 状態・完成率はリポジトリの実装と Evidence から判定しており、推測で埋めていない。
- 未確認のものは「要確認」と書く。

**列の略号:**

| 略号 | 意味 |
|---|---|
| Prod | Production参照DBへの影響（R=読むだけ、W=書く、—=なし） |
| UD | user data への影響（L=ブラウザー内、C=アカウント(クラウド)、—=なし） |
| Auth | 認証の要否 |
| AI | 生成AI API の要否 |
| Tier | 提供区分（Free/Pro/未定） |

## 1. 現在の公開機能（Phase 1）

| ID | 機能 | 状態 | 完成率 | 依存 | Prod | UD | Auth | AI | Tier | Release Gate / Evidence | 次の作業 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| F-001 | 選手・カード検索（日英・Unicode・記号・絞り込み・並べ替え・ページ送り） | verified | 95% | reference data | R | — | 不要 | 不要 | Free | 総合black-box 8 viewport（2026-09-27）| 国籍絞り込みは未実装（原案に明記なし → F-001a idea） |
| F-002 | 選手詳細（能力・育成・物理データ・適性） | verified | 90% | F-001 | R | — | 不要 | 不要 | Free | 同上、物理順位の母数は時点を明示 | ポジション別OVRは F-032b（blocked） |
| F-003 | 監督検索・詳細（戦術適性・ブースター・Link-Up） | verified | 90% | reference data | R | — | 不要 | 不要 | Free | 同上 | 監督写真は保留中（権利確認） |
| F-004 | 選手比較（2〜4人・レーダー・育成比較） | verified | 90% | F-002 | R | L | 不要 | 不要 | Free | 同上 | 友達比較は F-062 |
| F-005 | お気に入り | completed | 90% | F-001 | — | L/C | 任意 | 不要 | Free | 未認証表示は black-box 済み | クラウド同期は F-052 |
| F-006 | データ更新・差分管理（週次の自動検出＋承認式の適用） | verified | 90% | GitHub Actions | R/W(承認時) | — | — | 不要 | — | `evidence/world-update-2026-09-26.json` | appearance（順位）の再取得方針（本人判断） |
| F-007 | 日本語/英語切り替え | verified | 90% | — | — | L | 不要 | 不要 | Free | 総合black-box（切替・保存） | 英語の用語監査を定期実施 |
| F-008 | 公開範囲・noindex・内部ページ404・セキュリティヘッダー | verified | 100% | — | — | — | — | — | — | 総合black-box security 18/18 | 一般公開時に noindex 解除（本人判断） |
| F-009 | 性能（Home・Players・詳細） | verified | 90% | — | R | — | — | — | — | `evidence/players-performance-2026-09-25.json`、PR #69/#73 | サムネイル縮小版（backlog） |
| F-010 | 物理データの順位・パーセンタイル（選手単位） | completed | 80% | appearance | R | — | 不要 | 不要 | Free | 順位集計時点の母数を表示 | 再集計方針（F-006） |

## 2. My Team・ビルド・スカッド・診断の中核（Phase 2）

| ID | 機能 | 状態 | 完成率 | 依存 | Prod | UD | Auth | AI | Tier | Release Gate / Evidence | 次の作業 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| F-020 | My Team（所持カード管理） | completed | 85% | F-001 | R | L/C | 任意 | 不要 | Free | `docs/phase-favorites-my-team.md` | 認証済みでの black-box（テストダブル）を総合black-boxへ追加 |
| F-021 | My Builds（保存ビルド・育成案） | completed | 85% | F-028 | R | L | 任意 | 不要 | Free | `docs/my-builds.md` | クラウド同期 F-052 |
| F-022 | ビルド分析（`/build-inventory`：使用状況・重複・旧規則・参照異常） | completed | 85% | F-021 | R | L | 不要 | 不要 | Free | milestones 2026-09-01/02 | 診断カード共有は F-042 |
| F-023 | JSON export / import（保存ビルド） | completed | 90% | F-021 | — | L | 不要 | 不要 | Free | milestones 2026-09-02/05 | 全データ一括 export は F-023b（roadmap 段階11） |
| F-024 | Squads（編集・テンプレート・比較・Game Plan風の配置編集） | completed | 80% | F-020 | R | L/C | 任意 | 不要 | Free | `docs/phase-squad.md`、`docs/squad-game-plan-editing.md` | 完全ゲームプラン F-033 |
| F-025 | Best XI（所持カードからのルールベース最適化。表示名は「AI Best XI」） | completed | 75% | F-020 | R | L | 不要 | 不要（ルール） | Free | `src/lib/best-xi/*` tests | 高度化 F-070 |
| F-026 | スカッド診断（総合・攻撃・守備・空中戦・スピード等8カテゴリ＋配置充足・強み・弱点・改善提案） | completed | 80% | F-024 | R | L | 不要 | 不要（ルール） | Free（詳細はPro候補） | milestone 2026-09-06 | 診断履歴 F-060 |
| F-027 | 通常/辛口コメント（詳細な戦術監査つき） | completed | 85% | F-026 | — | — | 不要 | 不要（ルール） | Free | progress.md 2026-09-06 | 改善前後カード F-043 |
| F-028 | 育成・能力計算（Progression・ルール版管理） | completed | 85% | reference data | R | L | 不要 | 不要 | Free | `docs/phase-progression-rules.md` | 規則更新時の再検証 |
| F-029 | Booster（B1/B2・条件付き・発動タイプ） | completed | 85% | F-028 | R | L | 不要 | 不要 | Free | milestones 2026-09-05 | — |
| F-030 | Power of Many（複数ブースターの発動方式） | completed（要確認：人数別の効果量） | 70% | F-029 | R | L | 不要 | 不要 | Free | `docs/phase-total-package.md` | 効果量の出典確認 |
| F-031 | Link-Up Play | completed | 75% | F-003 | R | — | 不要 | 不要 | Free | 監督フィルタ black-box | スカッド内の発動判定（要確認） |
| F-032 | ポジション適性（表示） | completed | 80% | F-002 | R | — | 不要 | 不要 | Free | player-analysis tests | — |
| F-032b | ポジション別OVR | blocked | 10% | 計算規則の確認 | R | — | 不要 | 不要 | Free | 規則が未確認なので推測で算式を作らない | 規則サンプルの収集（本人またはデータ源） |
| F-033 | 完全ゲームプラン（戦術・役割・指示） | completed（MVP：配置編集。個別指示は deferred） | 70% | F-024, F-003 | R | L | 不要 | 不要 | Free | 本人判断 2026-09-27：現在の配置編集を MVP 完成版とする | 個別指示は、公式または許諾済みの信頼できる仕様を確認できるまで deferred（推測で実装しない） |

## 3. 診断と共有（Phase 3）

| ID | 機能 | 状態 | 完成率 | 依存 | Prod | UD | Auth | AI | Tier | Release Gate / Evidence | 次の作業 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| F-040 | 診断結果カード（スカッド／ビルド） | completed | 80% | F-026 | — | — | 不要 | 不要 | Free | `squad-diagnosis-share.ts`（内部IDを含めない） | — |
| F-041 | 画像保存（PNG） | completed | 80% | F-040 | — | L | 不要 | 不要 | Free | `squad-diagnosis-image.ts`、`build-diagnosis-card-image.ts` | 総合black-boxへ保存操作を追加 |
| F-042 | 共有URL（診断カード） | verified | 100% | F-040 | — | —（サーバー保存なし・名前/ID なし） | 不要 | 不要 | Free | PR #75、`evidence/f042-share-url-2026-09-27.json`（公開 black-box 522/522） | 比較の共有URLは F-043 で追加 |
| F-043 | 改善前後の比較カード | verified | 100% | F-026, F-060 | — | L | 不要 | 不要 | Free | PR #77、`docs/production-readiness/evidence/f060-f043-2026-09-27.json`（公開 black-box 568/568） | 公開環境の稀な hydration 警告は既知の問題として記録（機能影響なし） |
| F-044 | Pro向け詳細診断 | designed | 20% | F-026, F-120 | — | — | 要 | 任意 | Pro | 出力は基本/詳細に分離済み | 課金の判断まで deferred |

## 4. アカウントと公開範囲（Phase 4）

| ID | 機能 | 状態 | 完成率 | 依存 | Prod | UD | Auth | AI | Tier | Release Gate / Evidence | 次の作業 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| F-050 | 認証（Supabase Auth：登録・ログイン・再設定） | completed | 80% | Supabase | — | C | — | 不要 | Free | PR #5, #17 | 招待ベータ中の新規登録ポリシー（本人判断） |
| F-051 | アカウント別データ分離（RLS・ローカル名前空間） | completed | 85% | F-050 | — | L/C | 要 | 不要 | Free | PR #9–#11, #17 | — |
| F-052 | クラウド同期（My Team PoC → ビルド・スカッド） | partially_implemented | 30% | F-051 | — | C | 要 | 不要 | Free | My Team 手動保存の PoC | roadmap 段階7〜9 |
| F-053 | 公開ユーザーID・公開プロフィール | idea | 0% | F-050, F-056 | — | C | 要 | 不要 | Free | — | 安全機能の後 |
| F-054 | 公開範囲（非公開/URL限定/友達限定/全体公開） | idea | 0% | F-053 | — | C | 要 | 不要 | Free | — | — |
| F-055 | 友達機能 | idea | 0% | F-053, F-056 | — | C | 要 | 不要 | Free | — | — |
| F-056 | ブロック・ミュート・通報・安全機能 | idea（ブロック・通報は設計書 26章に記載） | 0% | F-050 | — | C | 要 | 不要 | Free | — | 公開系機能より先に実装 |
| F-057 | 削除・退会導線（アカウント削除予約・取消） | partially_implemented | 30% | F-050 | — | C | 要 | 不要 | Free | 現状は問い合わせ窓口経由 | roadmap 段階10 |
| F-058 | データ管理（ブラウザー内データの確認・削除） | verified | 90% | — | — | L | 不要 | 不要 | Free | 総合black-box | 一括 export F-023b |

## 5. 成長・比較・個性（Phase 5〜6）

| ID | 機能 | 状態 | 完成率 | 依存 | Prod | UD | Auth | AI | Tier | 次の作業 |
|---|---|---|---|---|---|---|---|---|---|---|
| F-060 | 診断履歴（ブラウザー内） | verified | 100% | F-026, F-042 | — | L（スコープ別） | 不要 | 不要 | Free | PR #76、`evidence/f060-f043-2026-09-27.json`（公開 black-box 550/550） | 認証ユーザー向けの同期は別途設計（F-052） |
| F-061 | 成長プロフィール | idea | 0% | F-060 | — | C | 要 | 不要 | Free | — |
| F-062 | 友達との比較・ライバル | idea | 0% | F-055 | — | C | 要 | 不要 | Free | — |
| F-070 | AI Best XI 高度化（戦術・監督・ブースター考慮） | partially_implemented | 40% | F-025 | R | L | 不要 | 不要 | Free | 監督適性の反映 |
| F-071 | カテゴリ別パーセンタイル（スカッド・カード全体） | designed | 10% | F-026, reference data | R | — | 不要 | 不要 | Free | 設計 `docs/product/f071-percentile-design.md`（標準最終値の全カード算出経路の確認が次） |
| F-072 | 称号・バッジ | idea | 0% | F-026, F-071 | — | L | 不要 | 不要 | Free | 付与規則の原案確認（質問Q3） |
| F-073 | 「あなたの一番」の自動発見 | idea | 0% | F-020, F-071 | R | L | 不要 | 不要 | Free | — |
| F-074 | スカッド独自性評価 | idea | 0% | F-024, 利用統計 | R | C | 要 | 不要 | Free | 集計データが必要 |
| F-075 | ランキング | idea | 0% | F-053, F-056 | — | C | 要 | 不要 | Free | コミュニティの後 |

## 6. コミュニティ（Phase 7）

認証・公開範囲・安全機能（F-053〜F-056）が verified になるまで公開しない。

| ID | 機能 | 状態 | 依存 | Auth | 次の作業 |
|---|---|---|---|---|---|
| F-080 | 公開ビルド・公開スカッド | idea（設計書 17章 `shared_builds`/`shared_squads`） | F-054, F-056 | 要 | — |
| F-081 | 反応・コメント・保存・フォロー | idea（設計書 26章） | F-080 | 要 | — |
| F-082 | モデレーション（NGワード・通報キュー・管理操作） | idea（設計書 26・27章） | F-056 | 要 | — |
| F-083 | コミュニティ発見・不正利用対策 | idea | F-082 | 要 | — |

## 7. メタ・分析（Phase 8）

| ID | 機能 | 状態 | 依存 | AI | 次の作業 |
|---|---|---|---|---|---|
| F-090 | Tier（ナビは「準備中」） | idea（設計書 P2） | データ源の確認 | 不要 | Tier データの取得元と規約の確認 |
| F-091 | メタ分析 | idea（設計書 22章） | F-090 | 任意 | — |
| F-092 | Pack・ガチャ診断（ナビは「準備中」） | designed（設計書 23章 スコアリング） | Pack データ, F-020 | 不要（計算）・任意（説明文） | Pack データ源の確認 |
| F-093 | 相手分析 | idea（設計書 22章） | F-026 | 任意 | — |
| F-094 | AI 戦術分析 | idea | F-033 | 任意 | — |

## 8. 生成AI・画像・個人最適化・アプリ（Phase 9〜10）と横断機能

| ID | 機能 | 状態 | AI | 費用 | 後回しの理由・再検討条件 |
|---|---|---|---|---|---|
| F-100 | AI コーチ（自然言語の相談） | deferred（設計書 22章） | 要 | LLM 従量（設計書34章：数千〜数万円/月） | API 契約・費用上限・安全方針の後。MVP：確認済みデータ＋ルールの根拠つき回答 |
| F-101 | Build Intent（自由記述からの育成意図の読み取り） | partially_implemented（ルールベースの辞書あり。AI の差し込み口は常に NOT_CONFIGURED） | 任意 | 同上 | AI 契約までルールベースで継続 |
| F-102 | 画像認識によるスカッド入力 | deferred（設計書 24章） | 要 | 従量 | 画像の個人情報・保存方針の後。確認画面は必須 |
| F-103 | 個人最適化 | deferred | 任意 | — | 利用履歴の同意設計の後 |
| F-104 | Wiki（用語・ルール解説） | idea（設計書 P4） | 不要 | 0 | — |
| F-110 | PWA・ネイティブアプリ | deferred（設計書 9-5 は PWA を将来とする） | 不要 | ストア費用 | 利用価値と収益性の確認後 |
| F-120 | 課金・Pro 版 | deferred | — | 決済手数料 | 法務・特商法・税の確認後（本人判断） |
| F-121 | 通知 | idea | 不要 | 0〜 | 友達・コミュニティの後 |
| F-122 | 管理画面（データ競合・同期管理） | idea（設計書 27章） | 不要 | 0 | 現状は GitHub Actions ＋ Evidence で代替 |
| F-123 | 監視（Sentry 等） | idea（roadmap 段階14） | 不要 | 無料枠 | 本人のアカウント作成が必要 |
| F-001a | 国籍での絞り込み | proposal（2026-09-27 の本人指示で操作名として言及。既存資料に記載なし） | 不要 | 0 | 原案確認後 |

## 9. 変更履歴

- 2026-09-27 初版（棚卸し：設計書・roadmap・progress・milestones・src・PR 履歴）。
