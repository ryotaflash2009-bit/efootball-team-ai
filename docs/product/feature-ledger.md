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
| F-003 | 監督検索・詳細（戦術適性・ブースター・Link-Up） | verified | 90% | reference data | R | — | 不要 | 不要 | Free | 同上 | 監督画像は実装しない（イニシャルアバターが正式。`docs/phase-manager-picker.md`・`phase-manager-photos-efdb.md`） |
| F-004 | 選手比較（2〜4人・レーダー・育成比較） | verified | 90% | F-002 | R | L | 不要 | 不要 | Free | 同上 | 友達比較は F-062 |
| F-005 | お気に入り | completed | 90% | F-001 | — | L/C | 任意 | 不要 | Free | 未認証表示は black-box 済み | クラウド同期は F-052 |
| F-006 | データ更新・差分管理（毎時の自動検出＋完全無人の適用。**2026-10-07 に無人の Apply を実証**: `FULLY_AUTOMATED_UPDATE_VERIFIED`） | verified | 95% | GitHub Actions | R/W(policy) | — | — | 不要 | — | `evidence/world-auto-apply-2026-10-07.json`（Apply 37643713008・applied_verified） | 毎時の検出の欠落（外部の起動は 10/13 の判断）・appearance（順位）の再取得方針（本人判断） |
| F-007 | 日本語/英語切り替え | verified | 90% | — | — | L | 不要 | 不要 | Free | 総合black-box（切替・保存） | 英語の用語監査を定期実施 |
| F-007b | 多言語の基盤（locale の契約・English への代わり・疑似ローカライズ・coverage の監査・RTL の準備） | implemented | 85% | F-007 | — | L | 不要 | 不要 | Free | PR #149・#152・#153・#157・#158・#159・次の PR、`docs/i18n/`、`docs/production-readiness/evidence/2026-10-07-multilingual-release-candidates.json`。公開は ja・en だけ。es・pt-BR・fr・de・it・ko・zh-CN・zh-TW・id・tr は RELEASE_CANDIDATE（AI 翻訳・公開画面 100%・生成文 407/407・共有カード 4 比率・ネイティブのレビュー前・言語の選択には出さない） | ネイティブのレビュー（`docs/i18n/review/<locale>/`）・ゲーム内の公式の用語の照合・法務文書の専門家の翻訳・公開の判断（本人） |
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
| F-023b | 現在の領域（ゲスト / アカウント）の全データの書き出し・読み込み・削除 | verified | 100% | F-023, F-060 | — | L | 不要 | 不要 | Free | PR #100（版つき JSON・厳密な検証・全部か何もしないかの読み込み・失敗時に元へ戻す・`__proto__` と上限超えを拒否・確認までに領域が変わったら取り消し）、black-box 28/28、`evidence/2026-10-02-backup-cards-posts.json` | — |
| F-024 | Squads（編集・テンプレート・比較・Game Plan風の配置編集） | completed | 80% | F-020 | R | L/C | 任意 | 不要 | Free | `docs/phase-squad.md`、`docs/squad-game-plan-editing.md` | 完全ゲームプラン F-033 |
| F-025 | Best XI（所持カードからのルールベース最適化。表示名は「AI Best XI」） | completed | 75% | F-020 | R | L | 不要 | 不要（ルール） | Free | `src/lib/best-xi/*` tests | 高度化 F-070 |
| F-026 | スカッド診断（総合・攻撃・守備・空中戦・スピード等8カテゴリ＋配置充足・強み・弱点・改善提案） | completed | 80% | F-024 | R | L | 不要 | 不要（ルール） | Free（詳細はPro候補） | milestone 2026-09-06 | 診断履歴 F-060 |
| F-027 | 通常/辛口コメント（詳細な戦術監査つき） | completed | 85% | F-026 | — | — | 不要 | 不要（ルール） | Free | progress.md 2026-09-06 | 改善前後カード F-043 |
| F-028 | 育成・能力計算（Progression・ルール版管理） | completed | 85% | reference data | R | L | 不要 | 不要 | Free | `docs/phase-progression-rules.md` | 規則更新時の再検証 |
| F-029 | Booster（B1/B2・条件付き・発動タイプ） | completed | 85% | F-028 | R | L | 不要 | 不要 | Free | milestones 2026-09-05 | — |
| F-029b | B2 UI の統一（比較画面と `PlayerBoosterPanel`） | completed | 100% | F-029 | — | — | 不要 | 不要 | Free | PR #181（`CONFIRMED_B2_CANDIDATES` を育成と比較の両方で使う・回帰テスト） | — |
| F-030b | Total Package の条件評価エンジン・Game Plan からの Power of Many 自動段階 | idea | 0% | F-030, F-033 | R | L | 不要 | 不要 | Free | `phase-total-package.md`・`phase-conditional-boosters.md`（`levelForRegisteredPlayers` は UI 未接続） | 効果量の出典確認（F-030）の後 |
| F-030 | Power of Many（複数ブースターの発動方式） | completed（要確認：人数別の効果量） | 70% | F-029 | R | L | 不要 | 不要 | Free | `docs/phase-total-package.md` | 効果量の出典確認 |
| F-031 | Link-Up Play | completed | 75% | F-003 | R | — | 不要 | 不要 | Free | 監督フィルタ black-box | スカッド内の発動判定（要確認） |
| F-032 | ポジション適性（表示） | completed | 80% | F-002 | R | — | 不要 | 不要 | Free | player-analysis tests | — |
| F-032b | ポジション別OVR | blocked | 10% | 計算規則の確認 | R | — | 不要 | 不要 | Free | 規則が未確認なので推測で算式を作らない | 規則サンプルの収集（本人またはデータ源） |
| F-033 | 完全ゲームプラン（戦術・役割・指示） | completed（ローカル: 指示・交代・代わりの計画・相手ごと・書き出し/読み込み。選手ごとの個別指示は不要（2026-10-10 本人の判断・NEW-43 を閉じた）） | 85% | F-024, F-003 | R | L | 不要 | 不要 | Free | 本人判断 2026-09-27：現在の配置編集を MVP 完成版とする | 個別指示は 2026-10-10 に本人の判断で不要（作らない） |
| F-035 | プレースタイル発動可否・選手間連携の分析 | idea（将来提案） | 0% | F-026 | R | L | 不要 | 不要 | Free | `docs/playing-style-ledger.md` | 公式の発動条件の確認後 |
| F-036 | 配置補助の次候補（複数選択・選択だけの左右反転・一括整列・左右/上下の均等配置・配置のコピー/貼り付け） | **completed（2026-10-04）** | 95% | F-024 | — | L | 不要 | 不要 | Free | `docs/squad-placement-assist.md` §E・§F・`placement-assist.test.ts`・`placement-clipboard.test.ts`・`black-box-squad-placement-assist.mjs` | 違うフォーメーション間の写し（枠の対応づけの規則が必要） |
| F-034 | 能力値直接操作・スライド式育成UI（能力タップ→関連強調→下部パネルの＋／－・スライダー・配分チップ・1タップ保存。選手詳細と比較画面（1人ずつの編集モード）。日英完全対応。eFHUB を UX の基準にし、素材はコピーしない） | verified | 100% | F-028 | R | L | 不要 | 不要 | Free | PR #80・#82・#83・#84、`docs/product/f034-human-factors-audit.md`（人間工学監査 15件・Sev3 全修正）、`evidence/f034-human-factors-l10n-compare-2026-09-27.json`（公開: 総合 568/568・育成 458/458・比較 168/168、8 viewport） | 本人の主観確認（発光・パネルの高さ・触り心地）。My Builds・ビルド分析の英語化は PR #89 で完了（公開 8 viewport で日本語 0） |

## 3. 診断と共有（Phase 3）

| ID | 機能 | 状態 | 完成率 | 依存 | Prod | UD | Auth | AI | Tier | Release Gate / Evidence | 次の作業 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| F-040 | 診断結果カード（スカッド／ビルド） | completed | 80% | F-026 | — | — | 不要 | 不要 | Free | `squad-diagnosis-share.ts`（内部IDを含めない） | — |
| F-041 | 画像保存（PNG） | completed | 80% | F-040 | — | L | 不要 | 不要 | Free | `squad-diagnosis-image.ts`（3:4・1440×1920）、`build-diagnosis-card-image.ts`（9:16・16:9） | 共有カードのサイズ追加は F-041b |
| F-042 | 共有URL（診断カード） | verified | 100% | F-040 | — | —（サーバー保存なし・名前/ID なし） | 不要 | 不要 | Free | PR #75、`evidence/f042-share-url-2026-09-27.json`（公開 black-box 522/522） | 比較の共有URLは F-043 で追加 |
| F-041b | 診断カードの比率（3:4・1:1・9:16・16:9）とプレビュー・OS 共有 | verified | 100% | F-041 | — | L | 不要 | 不要 | Free | PR #101（3:4 は従来と同一・称号つき・Web Share（取り消しはエラーにしない・非対応は保存）・CSP の img-src に blob: を追加）、black-box 24/24、`evidence/2026-10-02-backup-cards-posts.json` | 本人の主観確認（カードの見た目） |
| F-045 | 診断の追加観点（左右バランス・監督適合・フォーメーション適合・控えを含む役割重複・GK 専用カテゴリ・空中戦の身長/利き足補正） | implementation_ready（本人の判断待ち） | 60% | F-026 | R | L | 不要 | 不要 | Free | 暫定の 8 観点をスカッドの編集の折りたたみで表示（比較のみ・点数へ不混入）。判断パッケージ `docs/product/f045-decision-package.md`・端のケース・決定性のテスト（PR #168） | **本人の判断**: 推奨は「事実の式（A）だけを表示として採用・暫定の点数化は比較のまま」 |
| F-043 | 改善前後の比較カード | verified | 100% | F-026, F-060 | — | L | 不要 | 不要 | Free | PR #77、`docs/production-readiness/evidence/f060-f043-2026-09-27.json`（公開 black-box 568/568） | 公開環境の稀な hydration 警告は既知の問題として記録（機能影響なし） |
| F-044 | Pro向け詳細診断 | designed | 20% | F-026, F-120 | — | — | 要 | 任意 | Pro | 出力は基本/詳細に分離済み | 課金の判断まで deferred |

## 4. アカウントと公開範囲（Phase 4）

| ID | 機能 | 状態 | 完成率 | 依存 | Prod | UD | Auth | AI | Tier | Release Gate / Evidence | 次の作業 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| F-050 | 認証（Supabase Auth：登録・ログイン・再設定・メールのリンク確認・メール変更） | completed | 85% | Supabase | — | C | — | 不要 | Free | PR #5, #17, #86, #87, #88。新規登録は「限定テスト中」（標準 SMTP はメンバー宛てのみ）。/auth/confirm（押したときだけ検証）・エラー区分・メール変更は配信確認まで無効・Release Validator（`npm run validate:auth-email-release`）。ドメイン購入は本人がまとめ買いまで保留（`production-readiness/domain-purchase-queue.md`）。`evidence/auth-readiness-f071-f073-2026-09-27.json`（公開 114/114） | 本人: ドメインのまとめ買い → 手順書 A〜G → Validator が READY → 本人承認 → 新規登録の公開 |
| F-051 | アカウント別データ分離（RLS・ローカル名前空間） | completed | 85% | F-050 | — | L/C | 要 | 不要 | Free | PR #9–#11, #17 | — |
| F-052 | クラウド同期（My Team PoC → ビルド・スカッド） | partially_implemented | 30% | F-051 | — | C | 要 | 不要 | Free | My Team 手動保存の PoC | roadmap 段階7〜9 |
| F-053 | 公開ユーザーID・公開プロフィール | implementation_ready（Production の適用は本人の承認待ち） | 60% | F-050, F-056 | — | C | 要 | 不要 | Free | 規則 `public-id.ts`・migration の提案と使い捨ての PostgreSQL の検証 10 件（PR #174・`public-id-production-proposal.md`） | **本人の判断**: 適用（Signup・ドメインの後） |
| F-054 | 公開範囲（非公開/URL限定/友達限定/全体公開） | designed | 5% | F-053 | — | C | 要 | 不要 | Free | `docs/product/community-and-growth-design.md` §2（既定は非公開・noindex） | F-053 と同時 |
| F-055 | 友達機能 | designed | 5% | F-053, F-056 | — | C | 要 | 不要 | Free | `docs/product/community-and-growth-design.md` §3 | F-053・F-056 の後 |
| F-056 | ブロック・ミュート・通報・安全機能 | partially_implemented（ローカルの型・モック） | 30% | F-050 | — | L（モック） | 要（本番） | 不要 | Free | PR #102（通報の理由・自分の投稿は不可・重複は1件・1日の上限・ブロックは双方向・ミュートは片方向・管理者の非表示・異議申し立ての型）、black-box（モック）、`docs/product/owner-decisions-2026-10-02.md` C | 本人判断: 通報の対応体制・規約・本番マイグレーション |
| F-057 | 削除・退会導線（アカウント削除予約・取消） | partially_implemented | 30% | F-050 | — | C | 要 | 不要 | Free | 現状は問い合わせ窓口経由。セルフ削除は deferred（`production-readiness/auth-deferred-items.md`：サーバー側の権限か本番の DB 関数が必要） | 本人: 方式（Edge Function / DB 関数）の承認 |
| F-058 | データ管理（ブラウザー内データの確認・削除） | verified | 90% | — | — | L | 不要 | 不要 | Free | 総合black-box | 一括 export F-023b |

## 5. 成長・比較・個性（Phase 5〜6）

| ID | 機能 | 状態 | 完成率 | 依存 | Prod | UD | Auth | AI | Tier | Release Gate / Evidence | 次の作業 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| F-060 | 診断履歴（ブラウザー内） | verified | 100% | F-026, F-042 | — | L（スコープ別） | 不要 | 不要 | Free | PR #76、`evidence/f060-f043-2026-09-27.json`（公開 black-box 550/550） | 認証ユーザー向けの同期は別途設計（F-052） |
| F-061 | 成長プロフィール（ブラウザー内の版） | completed | 85% | F-060 | — | L（スコープ別） | 不要 | 不要 | Free | PR #94・v2 PR #179（最高点・最も下がったカテゴリ・新しい弱点・連続の上昇） | クラウド同期の版は認証メールの公開と本番マイグレーションの後（`community-and-growth-design.md` §4） |
| F-062 | 友達との比較・ライバル | designed | 5% | F-055 | — | C | 要 | 不要 | Free | `docs/product/community-and-growth-design.md` §3 | F-055 の後 |
| F-070 | AI Best XI 高度化（戦術・監督・ブースター考慮） | partially_implemented | 55% | F-025 | R | L | 不要 | 不要 | Free | `src/lib/best-xi/*`。監督補正は未対応。判断パッケージ `docs/product/f070-decision-package.md`（PR #173・推奨 D） | **本人の判断**: D の採用（推奨）→ 監督の選択と補正の列 |
| F-071 | 基礎能力値のパーセンタイル（能力値ごと・範囲: 全World/同ポジション/フィールド・GK） | verified | 100% | F-026, reference data | R | — | 不要 | 不要 | Free | PR #90・#95（定期検出 run 36340696128 の候補・applied-state と一致・VALID）、`evidence/f071-artifact-2026-10-01.json`（公開 115/115・実データ） | カテゴリ・スカッド単位は確定した計算式が無いため deferred。次の更新は Production Apply 後の Evidence PR で成果物も更新 |
| F-072 | 称号・バッジ（選手・スカッド診断・共有カード） | verified | 100% | F-026, F-071 | — | L | 不要 | 不要 | Free | PR #91・#95、`docs/product/f072-titles-badges.md`、`evidence/f071-artifact-2026-10-01.json`（公開 115/115。選手の称号も実データで表示） | 本人の主観確認（称号の名前・閾値の手応え） |
| F-073 | 「あなたの一番」の自動発見（My Team） | verified | 100% | F-020, F-071, F-072 | R | L | 不要 | 不要 | Free | PR（F-073）・追加の項目 v2 PR #172（最高の OVR・伸びしろ・珍しいポジション・カード種別） | — |
| F-074 | スカッド独自性評価 | designed | 5% | F-024, 利用統計 | R | C | 要 | 不要 | Free | `docs/product/community-and-growth-design.md` §5（公開を選んだスカッドだけを匿名集計・k-匿名性） | 本人判断: 集計の同意・保持期間・プライバシーポリシー。判断まで実装しない |
| F-075 | ランキング | idea | 0% | F-053, F-056 | — | C | 要 | 不要 | Free | — | コミュニティ・安全機能・小規模母数の保護の後 |
| F-130 | アクセス解析（Vercel Web Analytics・Page Views / Visitors だけ） | verified | 100% | — | — | — | 不要 | 不要 | Free | PR #162・`docs/production-readiness/web-analytics.md`・`evidence/2026-10-07-web-analytics.json`（本番の view 200・URL の query / fragment を送らない・Cookie 0・自動のブラウザーを除外） | Custom Event は本人の判断の後 |
| F-131 | 止まった画面の移動の早めの戻し（v1.1） | verified | 100% | — | — | — | 不要 | 不要 | Free | PR #166・`navigation-fallback-v1.1.md`・`evidence/2026-10-07-navigation-early-fallback.json`（止まった移動 5.3 秒 → 2.1〜3.4 秒・通常の移動 97 回で誤作動 0） | 経過の観察 |
| F-132 | 固有の用語の契約（Link-Up Play・OVR を全言語で原語） | completed | 100% | F-007b | — | — | 不要 | 不要 | Free | PR #161・`scripts/audit-fixed-terms.mjs`（43,740 文・違反 0）・`src/lib/i18n/fixed-terms.test.ts` | 正式な現地語の表記をデータ元で確認できた言語だけ更新 |
| F-133 | かなを区別しない検索・短い検索語の安全化 | completed | 100% | F-001 | R | — | 不要 | 不要 | Free | PR #167（`name_ja` の imatch・schema の変更なし・テスト 223） | 本番での確認（次の公開の確認で） |
| F-134 | 改善シミュレーション（控えとの入れ替え・配置・フォーメーションの変更） | completed | 90% | F-026 | — | L | 不要 | 不要 | Free | PR #169・`docs/product/improvement-simulation.md`（決定的・保存しない・上位 3 件・約 16 ms・v2 フォーメーションの変更 2026-10-09） | 監督・育成の変更（能力値の再計算が必要） |
| F-135 | スカッドの独自性（候補・比較用） | completed | 80% | F-045 | — | L | 不要 | 不要 | Free | PR #171・`docs/product/squad-uniqueness.md`（合成の事前分布・利用の統計は使わない） | 正式な点数の採用は本人の判断 |
| F-136 | ブースター一覧（効果と証拠の段階） | completed | 100% | F-029 | — | — | 不要 | 不要 | Free | PR #181（`/boosters`・12 言語・能力の絞り込み・名前の検索） | 本番での読み取りの確認 |
| F-137 | タブの題名の表示言語への追従 | completed | 100% | F-007b | — | — | 不要 | 不要 | Free | PR #182（英語と RC の言語・日本語は変えない） | — |
| F-138 | 総合 black-box の release gate（ログイン中のテストダブルを含む） | completed | 100% | F-051 | — | L | 不要 | 不要 | Free | PR #180（未ログインの総合 + アカウントの分離 164/164） | — |
| F-139 | TeamAIXI v1.1 Release Validator | completed | 100% | — | — | — | 不要 | 不要 | Free | PR #175（2026-10-07: BLOCKED の理由は自動更新の Secret だけ） | 本人の確認 10 件 |
| F-140 | コミュニティの安全の契約（運営者 1 人） | designed | 50% | F-084 | — | C | 要 | 不要 | Free | PR #176・`community-safety-operations.md`（本人の判断 5 件） | 表と RLS の提案 |
| F-141 | 友達・友達との比較・ライバル・AI コーチ・相手の分析・メタ分析の契約（モック） | designed | 30% | F-053 | — | C | 要 | 不要（規則の提供元） | Free | PR #177・`future-feature-contracts-2026-10-07.md` | 公開 ID・Auth の公開の後 |
| F-142 | AI ベスト11 の控え（決定的な規則・最大 12 人） | completed | 100% | F-025 | — | — | 不要 | 不要 | Free | PR #187・`docs/product/best-xi-bench.md`（本番 black-box 30/30） | 監督補正（F-070）は判断パッケージのまま |
| F-143 | 完全なゲームプラン（ローカル） | completed | 100% | F-033 | — | L | 不要 | 不要 | Free | PR #189・`docs/product/complete-game-plan.md`（本番 black-box 15/15・共有画像 2026-10-09） | ~~個別指示~~（NEW-43） |
| F-144 | 公開プロフィール・公開ビルドの契約（モック） | designed | 30% | F-053 | — | C | 要 | 不要 | Free | PR #190・`future-feature-contracts-2026-10-07.md` | 公開 ID・Auth の公開の後 |
| F-145 | 違うフォーメーション間の配置の写し（NEW-41） | completed | 100% | F-036 | — | L | 不要 | 不要 | Free | PR #185・`docs/product/placement-cross-formation.md`（本番 23/23） | — |
| F-146 | 監督の比較（NEW-23） | completed | 100% | F-003 | — | — | 不要 | 不要 | Free | PR #184・`docs/product/manager-compare.md`（本番 16/16） | — |
| F-148 | 同じ選手の別のカードは同じスカッドに 1 枚だけ（NEW-25 の置き換え・2026-10-10 本人の確認） | completed | 100% | F-025 | — | — | 不要 | 不要 | Free | `docs/product/same-player-rule.md`（人物キー＝カード ID の下位 20 ビット・本番 13,372 枚で食い違い 0・テスト 9） | World の更新ごとに `audit-person-identity.mjs` で再監査 |
| F-147 | 選手一覧の保存した絞り込み（NEW-31） | completed | 100% | F-001 | — | L | 不要 | 不要 | Free | `docs/product/saved-player-filters.md`（2026-10-09・black-box 10/10） | — |

## 6. コミュニティ（Phase 7）

認証・公開範囲・安全機能（F-053〜F-056）が verified になるまで公開しない。

| ID | 機能 | 状態 | 依存 | Auth | 次の作業 |
|---|---|---|---|---|---|
| F-080 | 公開ビルド・公開スカッド | idea（設計書 17章 `shared_builds`/`shared_squads`） | F-054, F-056 | 要 | — |
| F-081 | 反応・コメント・保存・フォロー | idea（設計書 26章） | F-080 | 要 | — |
| F-082 | モデレーション（NGワード・通報キュー・管理操作） | idea（設計書 26・27章） | F-056 | 要 | — |
| F-083 | コミュニティ発見・不正利用対策 | idea | F-082 | 要 | — |
| F-084 | 写真付き投稿（カメラ・写真ライブラリ・回転・正方形の切り取り・再エンコードでメタデータ除去・下書き・関連付け） | 段階1（ローカル/モック）完了 | 1/5 段階 | F-056, F-082 | 要（段階2以降） | 段階1は内部ページ（本番は 404）。PR #102、black-box 32/32（GPS 入り EXIF が保存画像に残らない・偽装ファイルを拒否） | 段階2（認証済みの本人だけ）は本番 Storage・RLS の本人承認が必要 |
| F-085 | 投稿フィード（カテゴリ・選手・監督・スカッド別）・投稿検索 | designed（ローカル/モックの規則・2026-10-08） | F-084 | 要 | `src/lib/posts/post-feed.ts`（公開範囲・審査中・非表示・URL 限定の契約 F-084-S3・アクセントを無視した本文の検索・決定的な並び・テスト 5 件）。画面と本番は本人の判断の後（本番の投稿の画面は 404 のまま） |

## 7. メタ・分析（Phase 8）

| ID | 機能 | 状態 | 依存 | AI | 次の作業 |
|---|---|---|---|---|---|
| F-090 | Tier（ナビは「準備中」） | idea（設計書 P2） | データ源の確認 | 不要 | Tier データの取得元と規約の確認 |
| F-091 | メタ分析 | idea（設計書 22章） | F-090 | 任意 | — |
| F-092 | Pack・ガチャ診断（ナビは「準備中」） | designed（設計書 23章 スコアリング） | Pack データ, F-020 | 不要（計算）・任意（説明文） | Pack データ源の確認 |
| F-093 | 相手分析 | idea（設計書 22章） | F-026 | 任意 | — |
| F-094 | AI 戦術分析 | idea | F-033 | 任意 | — |
| F-095 | チーム力（Team Strength）・監督相性の計算 | idea（設計書 §4・§13） | F-026, F-003 | 不要 | 計算式は本人判断（推測で確定しない） |

## 8. 生成AI・画像・個人最適化・アプリ（Phase 9〜10）と横断機能

| ID | 機能 | 状態 | AI | 費用 | 後回しの理由・再検討条件 |
|---|---|---|---|---|---|
| F-100 | AI コーチ（自然言語の相談） | deferred（設計書 22章） | 要 | LLM 従量（設計書34章：数千〜数万円/月） | API 契約・費用上限・安全方針の後。MVP：確認済みデータ＋ルールの根拠つき回答 |
| F-101 | Build Intent（自由記述からの育成意図の読み取り） | partially_implemented（ルールベースの辞書あり。AI の差し込み口は常に NOT_CONFIGURED） | 任意 | 同上 | AI 契約までルールベースで継続 |
| F-102 | 画像認識によるスカッド入力 | deferred（設計書 24章） | 要 | 従量 | 画像の個人情報・保存方針の後。確認画面は必須 |
| F-103 | 個人最適化 | deferred | 任意 | — | 利用履歴の同意設計の後 |
| F-104 | Wiki（用語・ルール解説） | idea（設計書 P4） | 不要 | 0 | — |
| F-105 | AI 生成系（ビルド生成・育成提案・監督診断・ブースター診断・試合後分析） | deferred（設計書 §21・§22） | 要 | LLM 従量 | F-100 と同じ条件（API 契約・費用上限・安全方針） |
| F-110 | PWA・ネイティブアプリ | deferred（設計書 9-5 は PWA を将来とする。`decision-record.md` §4 は iPhone 向け React Native を候補） | 不要 | ストア費用 | 利用価値と収益性の確認後 |
| F-120 | 課金・Pro 版 | deferred | — | 決済手数料 | 法務・特商法・税の確認後（本人判断） |
| F-121 | 通知 | idea | 不要 | 0〜 | 友達・コミュニティの後 |
| F-122 | 管理画面（データ競合・同期管理） | idea（設計書 27章） | 不要 | 0 | 現状は GitHub Actions ＋ Evidence で代替 |
| F-123 | 監視（Sentry 等） | idea（roadmap 段階14） | 不要 | 無料枠 | 本人のアカウント作成が必要 |
| F-124 | 利用範囲の制限（参照データの自動更新が完成・検証されるまで本人だけで検証。他人・家族への試用、招待、新規登録、コミュニティ公開をしない） | **解除（2026-10-03 本人判断: `F124_RELEASED_FOR_LIMITED_INVITE_BETA`）**。招待制・信頼できる 3〜5 人・ログイン不要の既存機能だけ・無料・noindex 維持。新規登録の一般開放・コミュニティ・写真投稿の公開・告知・検索掲載・課金は引き続き禁止 | 不要 | 0 | 自動更新の完成（`automated-update-pipeline.md` の Level 2 の実運用確認）まで |
| F-001a | 国籍での絞り込み | proposal（2026-09-27 の本人指示で操作名として言及。既存資料に記載なし） | 不要 | 0 | 原案確認後 |

## 9. 変更履歴

- 2026-10-09: **夜間の作業（本人の指示: 15 時間の継続開発）**。eFHUB基準の照合で育成カテゴリ 6 つを修正（#207）・検索への公開の準備（#208・環境変数は本人）・F-045 の事実の集計（#209）・ゲームプランの画像（#210）・フォーメーションの変更のシミュレーション（#211）・ブースターは 99 を超えられる（KONAMI 公式・#212）・保存した絞り込み（F-147・#213）・API の別サイトの POST の拒否（#214）・規則の台帳の更新（#215）・推定 OVR を公式の基礎 OVR に合わせる（平均の差 7.17→0.91・#216）・AI ベスト11 の同じ名前の知らせ（F-148・#219）・自動配分が総ポイントを超える不具合の修正と配分の共有リンク（#220）。構造化データ（#221）・My Builds からの共有リンク（#222）・**My Team に入れたカードの詳細の React #418（hydration の不一致）を修正**（#223・本番で再現・`useMyTeam().getByWorldId` がスナップショットを使っていなかった）・black-box の一斉の点検（全 20 本・前提つきで全件合格）。残りのゲームの画面の確認は 3 件（`game-evidence-requests-2026-10-09.md`）。
- 2026-10-06: **多言語の基盤（F-007b）**。locale の契約（18 言語 + 疑似 2）・その言語 → English → 日本語の解決・言語ごとの別 chunk・coverage と品質の監査（CI）・用語集・RTL の論理プロパティ（255 か所）。10 言語の AI の下書き（核の UI・ホーム・内部の確認だけ）。公開の言語は変えていない（ja・en）。
- 2026-10-08: **完全無人の自動更新を実証**（F-006・Apply 37643713008・Evidence PR #194）。複数形の修正（#196）・v1.1 Validator の対象の拡大（#197）・wt-head の読み取り監査と毎時の検出の判断パッケージ（#195）。
- 2026-10-07（夜）: 監督の比較（F-146）・違うフォーメーション間の配置の写し（F-145）・AI ベスト11 の控え（F-142）・完全なゲームプラン（F-143）・公開プロフィールの契約（F-144）・共有のファイル名とソースの制御文字（PR #186）・Next.js 16 の計画と Domain/SMTP/Auth の再開パッケージ（PR #188）。自動 Apply の再検証は Apply の接続で 28P01（書き込みなし・`auto-apply-db-secret-recovery.md` §8）。
- 2026-10-07（続き）: F-045・F-070 の判断パッケージ・改善シミュレーション（F-134）・スカッドの独自性（F-135）・Your Best の追加（F-073 v2）・成長プロフィール v2（F-061）・公開 ID の migration の提案と PostgreSQL の検証（F-053）・v1.1 Release Validator（F-139）・コミュニティの安全の契約（F-140）・将来の機能の契約（F-141）・RTL の UI の位置 24 か所の論理化・ブースター一覧（F-136）・B2 の候補の統一（F-029b）・タブの題名（F-137）・release gate（F-138）。本番の総合 black-box 576/576・アクセシビリティ 32/32。
- 2026-10-07: **夜間の作業**。Link-Up Play・OVR の契約（F-132）・Vercel Web Analytics（F-130）・ネイティブのレビュー資料 v2・npm audit の非破壊の修正（high 10 → 8）・止まった移動の早めの戻し（F-131）・かなの検索（F-133）・F-045 の判断パッケージ・改善シミュレーション（F-134）・機能の全面の再監査（`docs/product/feature-reaudit-2026-10-07.md`・127 件・新しい要件 43）。自動適用の DB の Secret は本人の入力待ち（`VERIFIED_BLOCKED_OWNER_ACTION`）。
- 2026-10-07: **10 言語を RELEASE_CANDIDATE へ（F-007b）**。es・pt-BR（#158・#159）に続き fr・de・it・ko・zh-CN・zh-TW・id・tr。公開画面 100%・生成文 407/407・能力名・育成グループ・戦術・共有カード 4 比率。各言語 5 画面幅のブラックボックス 209/209・React #418 0。ネイティブのレビューの資料（言語ごとの CSV）。公開の言語は ja・en のまま（言語の選択には出さない）。
- 2026-10-06: v1.0 の公開後の運用。毎時の検出の観測の仕組み（`scripts/observe-hourly-detection.mjs`・観測契約 10-06〜10-13）と、欠落しても更新を取りこぼさない契約のテスト。問い合わせページに「TeamAIXI専用サポート窓口 / TeamAIXI Support」と本人指定の注意書き、更新頻度の表記を週 1 回から 1 時間おきへ修正。選手詳細 167 kB（#144）・ログイン 120 kB（#145）。ローカルの確認用サーバーの PID の契約を修正。10-05 の自動の Apply は DB の認証で停止（書き込みなし・本人が Secret を登録し直す）。v1.1 backlog は `integrated-roadmap.md`。
- 2026-10-05: **TeamAIXI v1.0 正式リリース**。Release Validator `TEAMAIXI_V1_RELEASE_READY`（本人の最終確認 5 項目を記録）。Git tag `v1.0.0`・GitHub Release「TeamAIXI v1.0」。最終の品質: React #418 の最終ゲート 本番 3 回連続 576/576（8 viewport・hydration 0）、a11y 32/32、新規登録の制限 117/117。画面の移動: hydration 前の絞り込みの選択を保持（PR #141）、終わらない画面の移動を 5 秒で通常の移動に切り替え（PR #142）。1 時間おきの更新検出は schedule で動作を確認（run 37220971573・no_change）。F-070（監督補正）は v1.1。証跡 `evidence/2026-10-05-teamaixi-v1-release.json`。
- 2026-10-04: **TeamAIXI v1.0**（本人の決定）。表示名を TeamAIXI に変更（保存キー・Backup・書き出しの識別子・共有 URL は互換のため維持）。ログイン不要・無料・非公式の正式製品版として、既存の Vercel Production URL で公開（PR #126・noindex 維持）。ナビから Tier・Pack・Community を外し、内部ページは本番 404 のまま。利用規約・プライバシー・免責事項を v1.0 版に（専門家レビュー推奨）。Release Validator（`scripts/validate-teamaixi-v1-release.mjs`）の判定は `TEAMAIXI_V1_MANUAL_REVIEW_REQUIRED`（本人の最終確認 5 項目だけが残る・`docs/release/teamaixi-v1.md` §6）。Git tag `v1.0.0`・GitHub Release は本人の確認の後。

- 2026-10-04: 参照データの**完全無人の自動 Apply** を実装（本人の決定 2026-10-03）。既知の安全契約に一致する World（追加・確定列の更新）と Managers（追加だけ）は承認なしで適用、それ以外は Apply の前に停止または手動の承認の経路。Kill switch・halt Issue・事後検証（公開サイトの件数まで）。Rollback・Restore は自動にしない。有効化は自動用 Environment の Secret 2 件（本人）の後（`automated-update-pipeline.md` §7）。

- 2026-10-03: 自動更新の最初の実運用（World・Managers ともに applied_verified、本人の承認つき）。本人の判断で **F-124 を招待制の少人数ベータとして解除**（`docs/production-readiness/invite-beta-2026-10-03.md`）。

- 2026-10-02 夜間（本人の判断 A〜D に沿って自動で実施。Production の書き込み・公開なし）:
  - **自動更新**（PR #106・#107）:
    - 検出 workflow の名前の `+` が workflow_run のパターン文字だったため、通知・自動進行が一度も起動していなかった問題を修正。
    - 本番 Apply・Backup の job を main 限定にした。Apply の承認者を Environment の承認記録から取る（無ければ停止）。
    - すべての mode で機械可読 Evidence を出す（applied_verified のときは applied-state の候補も）。
    - 自動進行の停止・Apply 承認待ち・Apply の結果を通知する。
    - 手動検出 run 36901363553: update_available（World 13372・Managers 69）→ Issue #112 を自動作成。自動進行は変数未設定で skip。
  - **F-045**（PR #108）: 8 観点の暫定・比較検証用の計算式の候補（総合点なし・公式の点数/共有には使わない）。状態: 暫定の表示まで。
  - **F-053**（PR #110）: 公開 ID・表示名の規則（形式・正規化・予約語・禁止語・連絡先の拒否・30 日に 1 回）と内部の試作画面。Production の表は未作成。
  - **F-084 段階 2・F-056・F-074**（PR #111）:
    - 本人だけの非公開投稿の migration・Storage バケット・Policy・RLS の提案（未適用）。
    - CI の PostgreSQL で本人の分離を実行して確認（7 件）。
    - 削除・URL 限定・友達限定・通報/ブロック/ミュート・管理者の確認・統計の同意の契約（`photo-posts-stage2-proposal.md`）。
  - **F-090/F-092**（PR #113）: 合成データだけの型・表示の規則（外部は権利の確認済みだけ）・内部の試作画面。外部データの取得・保存なし。
  - **React #418**（PR #109）: 公開 black-box の切り分け情報を追加（例外の位置・streaming の状態・配信の地域）。この夜の本番 2 viewport では 0 件。
  - **F-124**: 継続（自動更新の Production 運用が未確認のため）。

- 2026-10-01 再監査（`docs/product/reaudit-2026-10-01.md`）: §5 の列ずれを修正。F-003・F-041・F-070 を訂正。F-023b・F-029b・F-030b・F-035・F-036・F-041b・F-045・F-084・F-085・F-095・F-105・F-124 を追加。

- 2026-09-27 初版（棚卸し：設計書・roadmap・progress・milestones・src・PR 履歴）。
