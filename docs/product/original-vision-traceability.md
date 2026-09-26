# Original vision traceability (原案と実装の対応表)

作成: 2026-09-27。本人の原案を失わないための対応表。機能の状態は `feature-ledger.md` を正とする。

## 1. 出典

| 略号 | 出典 | 内容 |
|---|---|---|
| D | `docs/efootball-team-ai-design.md`（完全設計書） | 最終目標「ユーザーの目的・所持選手・コイン数・戦術を理解し、根拠付きで助言する AI サービス」、機能群（第6章）、ユーザーストーリー U1〜U8（第7章）、AI・ガチャ・画像認識・認証・コミュニティ（第22〜27章）、Phase 1〜4（第33章）、費用（第34章） |
| R | `docs/production-readiness/implementation-roadmap.md` | 認証・同期・削除・export・監視・招待ベータの17段階 |
| P | `docs/progress.md`・`docs/milestones/*` | 実装済みの機能（スカッド診断、辛口コメント、画像保存、B1/B2、保存ビルド export/import など） |
| N | サイドメニュー（`src/components/Sidebar.tsx`） | Tier・Pack・Community が「準備中」 |
| O | 本人指示（2026-09-27、会話） | 称号・バッジ・公開ID・ライバル・独自性・改善前後・成長プロフィール・反応・ミュート・友達比較・共有URL・Pro 診断・ネイティブアプリなど |

既存資料に記載がなく、本人指示（O）だけにある案は、出典を O と明記して台帳に保持する（推測で内容を足さない）。

## 2. 対応表

同じ機能が別の名前で書かれている場合は1行に統合し、元の表現を残す。

| 原案の表現（出典） | 統合先 | 状態 |
|---|---|---|
| プレイヤー一覧・検索、U1 日本語検索・OVR 順（D） | F-001 | verified |
| 選手詳細（D）、U2 | F-002 | verified |
| 選手比較（D P1）、U4「2〜3人を比較」 | F-004（2〜4人） | verified |
| マネージャー（D P2）、U7 監督との相性 | F-003（監督）、F-026 の監督考慮は F-070 | verified / partially |
| ブースター（D P2）、B1/B2、Power of Many（P・O） | F-029, F-030 | completed |
| 育成・Max Level（D 第21章） | F-028 | completed |
| ポジション別総合値（D 第21章） | F-032b | blocked（規則未確認） |
| Tier（D P2・N） | F-090 | idea |
| スカッド作成（D P3）、Squads（O） | F-024 | completed |
| パック・ガチャ診断（D 第23章・N）、U5 | F-092 | designed |
| 私の選手 / 私のビルド（D P3）、My Team・My Builds（O） | F-020, F-021 | completed |
| ビルド分析（P・O） | F-022 | completed |
| JSON export / import（P・O）、データエクスポート（R 段階11） | F-023, F-023b | completed / idea |
| 端末間同期（D P2）、My Team・保存ビルド・スカッドの同期（R 段階7〜9） | F-052 | partially |
| 認証（D 第25章・R）、Authentication（O） | F-050, F-051 | completed |
| アカウント削除（R 段階10）、削除・退会導線（O） | F-057 | partially |
| AI スカッド分析（D 第22章）、AIスカッド診断・総合/攻撃/守備/空中戦・弱点・改善提案（O） | F-026（ルールベース） | completed |
| 通常コメント・辛口コメント（P・O） | F-027 | completed |
| 診断結果カード・画像保存（P・O） | F-040, F-041 | completed |
| 共有URL（O）、公開スカッド・ビルド `shared_squads`/`shared_builds`（D 第17章） | F-042（URL 共有 MVP）、F-080（公開） | implementation_ready / idea |
| Pro 向け詳細診断（O）、基本/詳細の出力分離（P：診断基盤） | F-044 | designed |
| 改善前後の比較カード・診断履歴・成長プロフィール（O） | F-043, F-060, F-061 | idea |
| AI Best XI（O・UI 表示名） | F-025（ルールベース）、F-070（高度化） | completed / partially |
| パーセンタイル（O）、物理データの順位（P） | F-071（カテゴリ別）、F-010（選手単位） | idea / completed |
| 称号・バッジ・「あなたの一番」・独自性評価（O） | F-072, F-073, F-074 | idea |
| 友達・ライバル・友達比較（O） | F-055, F-062 | idea |
| 公開ユーザーID・公開プロフィール・公開範囲（O）、公開範囲設定（D 第26章） | F-053, F-054 | idea |
| ブロック・通報（D 第26章）、ミュート・安全機能（O） | F-056 | idea |
| ランキング（O） | F-075 | idea |
| コミュニティ：投稿・コメント・返信・いいね・保存・フォロー（D 第26章）、反応（O） | F-080〜F-083 | idea |
| モデレーション・NG ワード・通報キュー（D 第26〜27章） | F-082 | idea |
| メタ分析・相手分析・試合後分析（D 第22章） | F-091, F-093 | idea |
| 完全ゲームプラン・戦術（O）、Game Plan 風の配置編集（P） | F-033 | partially |
| AI コーチ・自然言語の戦術相談（D 第22章・O）、U8「クロス中心で戦いたい」 | F-100（AI）、F-101（Build Intent：ルールベース） | deferred / partially |
| 画像認識によるスカッド入力（D 第24章）、U6 | F-102 | deferred |
| 個人最適化（D 第22章・O） | F-103 | deferred |
| Wiki（D P4） | F-104 | idea |
| PWA（D 9-5）、ネイティブアプリ（O） | F-110 | deferred |
| 課金・Subscription・Pro（O） | F-120 | deferred |
| 通知（O） | F-121 | idea |
| 管理画面（D 第27章） | F-122 | idea |
| 監視（R 段階14） | F-123 | idea |
| 自動更新・同期システム（D 第19章）、Automatic Update（O） | F-006 | verified |
| 国籍絞り込み（O：操作名として言及） | F-001a | proposal（原案に記載なし） |

## 3. 削除・却下した案

なし。本人が明示していない理由で削除しない。
