# 進捗記録

## 2026-09-06 — 国際化基盤（日本語/英語）の導入

- 目的: 日本語/英語を切り替えられる国際化基盤を導入し、主要UI・スカッド診断・通常/辛口コメント・
  配置構造・戦術監査の一部・PNG診断画像へ適用した（発動可否・機械翻訳・生成AI・3言語目は対象外）。
- 設計判断（既存URL・ブラックボックステスト互換性を優先）: **URLへロケールを含めない**。
  既存の全ルート（`/squads/[squadId]`等）・全13ブラックボックス（710件）がURLパスへ強く依存しているため、
  `app/[locale]/...`化は既存URLを破壊するリスクが高いと判断し、**クライアント側のReact Context
  （`localStorage`永続化＋`navigator.language`初回判定）**方式を採用した。
- 新規 `src/lib/i18n/`: `locale.ts`（ja/en定義・`detectLocaleFromBrowserLanguage`・`normalizeLocale`・
  不正値は既定言語=jaへ安全にフォールバック）・`dictionaries/ja.ts`＋`en.ts`（構造を完全一致させた辞書。
  値はja側が既存表示と完全一致）・`translate.ts`（欠落キーはconsole.warn＋ja値へフォールバック。
  生キーは画面へ露出しない）・`LocaleContext.tsx`（`LocaleProvider`/`useLocale`/`useT`。言語変更は
  Reactコンテキストの値変更のみで、ページ遷移・再マウント・データ再取得を発生させない）・`format.ts`
  （Intl DateTimeFormat/NumberFormatによる日付・数値の言語別表示）。
- 新規 `src/components/LanguageSwitcher.tsx`（ヘッダーに設置。現在選択中言語を`aria-pressed`+下線+背景色で
  明示・キーボード操作可・国旗不使用）。新規 `scripts/audit-i18n-keys.mjs`（ja/en辞書のキー構造一致を検証。
  `package.json`に`audit:i18n-keys`を追加し`verify`へ組み込み）。
- 接続範囲: `layout.tsx`（`LocaleProvider`追加・`notranslate`メタタグ追加＝ブラウザーの自動翻訳による
  二重翻訳の混乱を防止）・`Header.tsx`/`Sidebar.tsx`/`AppShell.tsx`（ナビ・検索・アクセシブルラベル）・
  `SquadDiagnosisPanel.tsx`/`SquadDiagnosisCommentCard.tsx`（見出し・統計値・8カテゴリ名・免責文言・
  戦術監査の固定ラベル）・`squad-diagnosis-comments-en.ts`（新規・通常/辛口コメントの英語版。
  日本語版と同じ`CommentAnalysis`から独立して英文を組み立てる。改善優先順位の3件目=選手名を含む
  `result.suggestions`へのフォールバックのみ英語版では省略）・`squad-diagnosis-comments-i18n.ts`
  （新規・ロケール別ディスパッチャ）・`link-up.ts`（確認済み表記揺れ吸収のためプレースタイル正規化層を
  接続。未確認の値は既存の大小無視完全一致比較へフォールバックし、実データでの判定結果は不変）・
  `squad-diagnosis-image.ts`/`squad-diagnosis-share.ts`（PNG診断画像の見出し・カテゴリ名・総合評価・
  代表的な長所弱点(カテゴリ起因のみ英訳)・免責文言・作成日時を言語別に切替。`SquadDiagnosisShareFinding`
  へ`categoryId`を追加。`locale`引数は省略時`"ja"`で完全後方互換）。
- **既知の限定事項（意図的な安全側スコープ）**: 選手名を含む自由文（`SquadDiagnosisFinding`の
  referenceError/compatibility/config種別・`result.suggestions`・`category.note`/`evidence`・
  戦術監査の`TacticalFinding.title/summary/explanation/evidence/recommendations/limitations`本文）は
  今回英訳していない（安全に選手名を英訳する手段がないため、推測翻訳をしない方針を優先）。
  プレイヤー一覧・選手詳細・比較・My Builds・My Team・スカッド編集の監督/ベンチ/チームサマリー等の
  画面固有文言は今回未着手（次回以降の課題として明示）。
- プレースタイル正規化層（`canonicalId`・攻撃/守備分離・別名テーブル）・8カテゴリ診断・総合評価・
  ランク判定・長所弱点の選出基準・配置充足ゲート・戦術finding生成規則・Link-Up Play判定基準・
  保存スキーマ・`storageVersion`・`rulesVersion`・SQLiteはいずれも無変更。
- 検証: `npm run verify` PASS（audit:ja-labels・audit:i18n-keys(新規)・typecheck・lint・
  unit **1411/1411**）/ `npm run build` PASS（全26ルート）/ 全13ブラックボックス 合計 **710/710 PASS**
  （件数不変・`next start`上）/ SQLite integrity ok（テーブル件数もベースライン一致）/ 実ブラウザで
  日本語→英語→日本語の切替、現在のスカッド・スコア(73/A)・8カテゴリ点数が不変であること、PNG保存ボタン
  動作、コンソールエラーなしを確認。確認中、Chrome側の自動翻訳機能がテスト環境で二重に干渉する事象を
  検出したため`notranslate`メタタグを追加（アプリの状態は`localStorage`/`aria-pressed`の直接検証で
  常に正しいことを確認済み。表示上の追加翻訳はブラウザー機能によるものであり、アプリの不具合ではない）。

## 2026-09-06 — プレースタイル正規化層の実装（表記揺れ・異常値の安全な統一）

- 目的: `docs/playing-style-ledger.md`で確認済みの表記揺れ（Box To Box/Box-to-Box 等）と異常値
  （`$undefined`・AIプレースタイルの`-`）を、決定的な純関数で安全に正規化する土台を作った
  （発動可否・選手間連携分析は今回も実装していない）。
- 新規 `src/lib/world/playing-style.ts`: `normalizePlayingStyle(rawValue, attribute, source)`
  （攻撃/守備を`attribute`で明示的に分離。統合しない）・`normalizeAiPlayingStyle`（AIプレースタイル専用の
  別関数・別語彙）。大文字小文字/ハイフン/空白の無制限な自動吸収はせず、確認済みの別名3件
  （Box To Box→Box-to-Box / Deep-Lying Forward→Deep-lying Forward / Fox In The Box→Fox in the Box、
  いずれも攻撃欄どうしの綴り違い）だけを明示登録。`$undefined`は異常値、AIプレースタイルの`-`は
  未知記号として、いずれも正式なプレースタイルへ変換しない。
- **実装検証で判明した重要な事実**: `Destroyer`/`Defensive Goalkeeper`（eFHUBの**攻撃**欄
  `playing_style_name`の実値）は、類似する`The Destroyer`/`Defensive GK`が**Worldの守備欄
  `playing_style_def`専用の値**であることが判明したため、属性をまたぐ未確認の対応付けを避け、
  意図的に別名登録しなかった（`status: "unknown"`のまま）。台帳§7-3に経緯を記録。
- 既存コードへの接続: `scripts/audit-playing-styles.mjs`に正規化済み/別名一致/Basic/値なし/異常値/
  未知値/他属性一致の件数集計を追加（読み取り専用）。`src/lib/squad/link-up.ts`の`playerMatches`へ
  正規化層を接続し、確認済み表記揺れによる不一致を防止。**どちらか一方でも未確認の値なら既存の
  大小無視完全一致比較へフォールバックする設計**のため、実データ（Link-Up Play条件10種類・いずれも
  Worldの`playing_style`と完全一致）では判定結果が変わらないことをUnit Testで確認。
  配置構造・戦術監査・通常/辛口コメント・8カテゴリ診断・PNG画像保存は今回接続していない。
- `docs/playing-style-ledger.md`を第2版へ更新（識別子=実装の`canonicalId`と同期・正規化状態の反映・
  正規化層の設計/接続範囲/慎重に見送った判断を追記。発動対象ポジションは引き続きすべて「未確認」）。
- 診断ロジック・8カテゴリ計算・通常/辛口コメント・配置構造・戦術監査・PNG画像保存・保存スキーマ・
  storageVersion・rulesVersion・SQLiteは無変更。新規npm依存なし。実ユーザーデータへの書き込みなし。
- 検証: `npm run verify` PASS（unit **1371/1371**・新規`playing-style.test.ts`36件＋`link-up.test.ts`
  +6件）/ `npm run build` PASS（既存アプリコード`link-up.ts`へ接続したため実施）/ 全13ブラックボックス
  合計 **710/710 PASS**（件数不変）/ SQLite integrity ok（テーブル件数もベースライン一致）/
  実ブラウザでLink-Up Playパネルが正常表示・コンソールエラーなしを確認。

## 2026-09-06 — プレースタイル規則台帳の作成（発動可否判定の準備調査・読み取り専用）

- 目的: 「配置構造・戦術監査」の次段階として構想されている「プレースタイル発動可否・選手間連携分析」に
  向けて、まず既存データの棚卸しだけを行った（発動可否ロジックは今回実装していない）。
- 調査結果（要点）: プレースタイル名と発動対象ポジションを結びつける確認済みの対応表は本プロジェクト内に
  **存在しない**（`docs/db-schema.md`の`playstyles`テーブルは設計案のみで未実装。実データにも数値コード・
  対応表なし）。日本語表示名も一切存在しない（英語名のみ）。攻撃`playing_style`（World由来）は21種類・
  守備`playing_style_def`は14種類で語彙は完全には一致しない（共通3種類: Basic/Box-to-Box/Anchor Man）。
  eFHUB由来（19件）とWorld由来（13,009件）の間に表記揺れ（大文字小文字・区切り文字・略記差）と異常値
  （`$undefined`1件）を検出。AIプレースタイル（`world_player_ai_styles`）とLink-Up Play条件の
  プレースタイル（`manager_link_up_conditions`）は、通常のプレースタイルとは別概念であることを確認
  （Link-Up Playは選手自身の`playingStyle`と完全一致比較する既存の確認済み機能）。
- 新規作成: `scripts/audit-playing-styles.mjs`（読み取り専用・SQLite書き込み0・恒久監査スクリプト。
  表記別件数・NULL/空文字/未知値の区別・eFHUBとWorldの表記差・大文字小文字揺れ検出・観察用のポジション
  分布集計を行う）。`docs/playing-style-ledger.md`（規則台帳。識別子・日英表記・確認状態・根拠・
  分析への使用可否をすべての値について記載。発動対象ポジション列は確認済みデータが無いためすべて
  「未確認」）。
- 診断ロジック・8カテゴリ計算・通常/辛口コメント・配置構造・戦術監査・PNG画像保存・保存スキーマ・
  storageVersion・rulesVersion・SQLiteスキーマ・実ユーザーデータはいずれも無変更（読み取り専用調査に限定）。
  新規npm依存関係なし（`node:sqlite`等の組み込みモジュールのみ使用）。
- 検証: `npm run verify` PASS（unit **1329/1329**・件数不変。新規スクリプトはNext.jsアプリのビルド・
  ルーティング・テストスイートのいずれからも参照されないため、既存ソースへの影響なしを確認）/
  SQLite `integrity_check` = `ok`（テーブル件数もベースライン一致）/ `package.json`・`package-lock.json`・
  `data/efootball.db`のいずれも本セッションで無変更（更新日時で確認）。品質ゲート§8の「Markdownだけの
  変更」という厳密な条件（`scripts/`変更なしが要件）には該当しないため機械的なベースライン継承は行わず、
  代わりに`npm run verify`を実際に再実行してPASSを確認する形で対応した。Production Build・全13ブラック
  ボックスは、新規スクリプトがアプリケーションコード・ビルド・テストのいずれの経路からも参照されない
  ことを確認した上で、今回は再実行を省略した（devサーバーも本セッションでは無停止・無変更のまま）。

## 2026-09-06 — スカッド診断: 「基礎値のまま評価」の不正確な文言を修正

- 直前セッションの調査（`engine.ts`の`calculateBuild`確認）で、保存ビルド未設定でもカード付属ブースター
  （B1）・監督補正は独立して反映され得るため、`squad-diagnosis.ts`の改善候補文言「基礎値のまま評価」は
  厳密には不正確であることが判明していた。今回、この1文言だけを対象に修正した。
- `squad-diagnosis.ts`の`suggestSquadImprovements`内、`suggest-missing-build`の`detail`文言を
  「保存ビルド未設定です（基礎値のまま評価）。」→「保存ビルド未設定のため、育成後の完成状態を
  十分に反映していません。」へ変更（B1/B2/Power of Many等の内部計算用語はユーザー向け文言に含めない）。
  この文言は改善候補セクション・改善優先順位（`squad-diagnosis-comments.ts`のフォールバック経路）の
  両方で使われるため、1箇所の修正で両方に反映される。他の診断ロジック・スコア計算・ランク判定・
  strengths/weaknesses選出・戦術分析規則・保存スキーマは無編集。前回追加した辛口コメントの説明
  （「該当する選手は、育成内容を保存した保存ビルドではなく、現在の設定にもとづいて評価されています。」）
  とも意味が整合する。
- 検証: `npm run verify` PASS（unit **1329**／新規2件：`squad-diagnosis.test.ts`に文言検証1件、
  `squad-diagnosis-comments.test.ts`に`diagnoseSquad`経由の統合確認1件）/ `npm run build` PASS（全26ルート）/
  全13ブラックボックス 合計 **710/710 PASS**（件数不変）/ SQLite integrity ok（テーブル件数もベースライン
  一致）/ 実ブラウザで実データ「あ」を確認し、旧文言が表示されないこと・新文言が改善候補と改善優先順位
  の両方に表示されること・総合評価73/評価A・8カテゴリの点数が不変であること・通常/辛口切替と
  配置構造・戦術監査とPNG保存ボタンが正常動作すること・コンソールエラーが無いことを確認。

## 2026-09-06 — スカッド診断: 保存ビルド未設定の説明強化 + 「データ充足率」表示の明確化

- **背景**: 辛口コメントで「保存ビルド未設定」が最重要の懸念になっても、既存の懸念選定ロジックには
  この種別が存在せず、改善優先順位の3件目に既存 `suggestions`（`suggest-missing-build`）の生の文章
  （複数選手名を`/`で連結した長い1文）がフォールバックで入るだけで、原因・評価への影響・次の行動を
  説明する文章になっていなかった。また、ヘッダーの「データ充足率」（実体は先発の配置・カード解決率）が
  保存ビルドの設定状況とは無関係であるにもかかわらず、名称から「育成データも含めて完全に揃っている」
  という誤解を招く状態だった。
- **実装前の事実確認（推測で文言を作らないため）**: `resolveAllocation`/`calculateBuild`（`engine.ts`）を
  確認し、保存ビルド未設定（`savedBuildId`なし）でも、カード付属ブースター（B1）・監督補正は
  `card`/`manager`から独立して常に反映され、未反映になるのは育成ポイント配分とB2/Power of Many
  （既定で空配列）であることを確認した。既存の`suggestSquadImprovements`の「基礎値のまま評価」という
  文言はこの意味で必ずしも正確ではないため、新規に書く文章では「基礎値のみ」と断定せず「現在の設定に
  もとづいて評価されています」という安全な表現を採用した（`squad-diagnosis.ts`自体は無編集）。
- `squad-diagnosis-comments.ts`: `PrimaryConcern`に`savedBuildMissing`（`count`/`total`）を追加し、
  `selectPrimaryConcern`で参照エラー→データ不足→配置充足→**保存ビルド未設定**→能力カテゴリ弱点、の
  優先順位に組み込んだ（能力カテゴリスコアより先に扱う。理由: カテゴリスコア自体が育成未反映により
  実態を反映していない可能性があるため）。`selectSecondaryConcern`・`concernToPriorityLabelAndReason`・
  `priorityRestatesConcern`・改善優先順位の重複防止（ラベルでの重複除去を追加）・
  `normalConcernSentence`・`harshConcernSentence`（配置充足カテゴリのランクに応じ「十分に整っています」/
  「大きな不足は見当たりません」と表現を出し分け、断定を避ける）を対応させた。
  辛口コメントは「配置状態→未設定人数→現在の評価データ→総合評価は無効ではないが完成評価として
  受け取るのは早い→先に保存ビルドを設定し再診断→現時点の長所」を一続きで説明する。通常コメントは
  簡潔な案内文のみ（辛口より明確に短い）。全選手名の列挙はせず、既存の「改善候補」セクション
  （`result.suggestions`・無編集）への集約に委ねた。
- `SquadDiagnosisPanel.tsx`: ヘッダーの「データ充足率」を「配置充足率」へ改称し、新たに
  「判定可能項目 X/8」（`result.categories`から純粋に導出）と、`missingSavedBuildCount>0`のときだけ
  表示する「保存ビルド未設定 X/Y人（先発）」を追加。指標間の混同を防ぐ短い補足文も追加。
  いずれも既存の`SquadDiagnosisResult`のフィールドを読むだけで、新規計算・新規保存はしていない。
- `squad-diagnosis.ts`/`squad-diagnosis-comments.ts`の既存の点数計算・ランク判定・長所弱点選出・
  `suggestions`生成・戦術分析規則は無編集。保存スキーマ・`storageVersion`・`rulesVersion`・
  SQLite・実ユーザーデータ・新規npm依存も無編集。
- 検証: `npm run typecheck`/`lint`/`audit:ja-labels` PASS / `npm run test` PASS（unit **1327**／
  `squad-diagnosis-comments.test.ts` 92→117・新規25件） / `npm run build` PASS（全26ルート）/
  全13ブラックボックス 合計 **710/710 PASS**（件数不変・`next start`上）/ SQLite integrity ok
  （テーブル件数もベースライン一致）/ 実ブラウザで実データ「あ」を確認し、ヘッダーの新指標表示・
  総合評価73/評価A・8カテゴリの点数が変更前と完全一致すること、通常/辛口切替・戦術監査・PNG保存
  ボタン・詳細根拠展開が正常動作すること、コンソールエラーがないことを確認。
  スマートフォン幅の実解像度確認は`resize_window`がビューポート幅に反映されない制約
  （`window.innerWidth`が実際には変化しなかった）により**未実施**。

## 2026-09-06 — スカッド編集画面のレイアウト再構成（スカッド診断を編成エリア下部の横幅の広い領域へ移動）

- **背景**: 前回セッションのターミナルが誤って閉じられ中断。読み取り専用の引き継ぎ監査で、正本ワークスペース
  （OneDrive外）であること・旧OneDrive版へは未アクセスであることを確認したうえで再開。中断時点で
  `SquadEditor.tsx` / `SquadDiagnosisPanel.tsx` / `SquadDiagnosisCommentCard.tsx` の変更はディスクに保存済み・
  devサーバー（`next dev`）もエラーなく稼働中で、コード変更自体は実装完了に近い状態だった。
- **目的**: 保存スカッド編集画面の右カラムが縦長になっていた問題を解消するため、「スカッド診断
  （スカッド構成評価）」パネル全体を右カラム（監督/ベンチ/チームサマリー等が並ぶ狭い列）から、
  編成エリア（ピッチ＋右カラム）全体の下にある横幅いっぱいのセクションへ移動。右カラムに残る
  既存の他パネル（ビルド使用状況・役割設定・Link-Up Play・警告/注記）は今回の対象外のためそのまま維持
  （ユーザー確認済み）。
- `SquadEditor.tsx`: 2カラムグリッド（ピッチ＋右パネル群）の外側・編成エリア全体の下に
  `<SquadDiagnosisPanel>` を独立した `mt-2` セクションとして配置（1回だけレンダリング）。
- `SquadDiagnosisPanel.tsx` / `SquadDiagnosisCommentCard.tsx`: 従来の狭い右カラム（~300–360px）向け
  縦積みレイアウトから、横幅を活かす `sm:grid-cols-2 lg:grid-cols-4`（8カテゴリ）・`lg:grid-cols-2`
  （長所/弱点）・`lg:grid-cols-[repeat(auto-fit,minmax(320px,1fr))]`（辛口モードの配置構造・戦術監査
  finding一覧）へ変更。
- **診断ロジック・コメント生成規則・戦術分析規則・保存スキーマ・実ユーザーデータは無編集**
  （`squad-diagnosis.ts` / `squad-diagnosis-comments.ts` / `squad-tactical-review.ts` は今回のセッションで
  変更していない。表示コンポーネントのみの変更）。
- **ビルド時に発見・対応した環境事象**: `npm run build` を稼働中の `next dev` と同時に実行したため
  `.next` が競合し、`Cannot find module for page: /my-team` 等のビルドエラー・`next dev` 側の
  `ENOENT ...routes-manifest.json` クラッシュが発生（`docs/safe-build-and-cache-policy.md` §10 に既知事象として
  記載の類型）。`.next` は削除せず、確認済み単一PIDのdevサーバー停止 → `npm run build` 再実行 → devサーバー
  再起動 → `data/server.pid` 更新、という正規手順で解消（ユーザー承認済み）。
- 検証: `npm run typecheck` PASS / `npm run lint` PASS / `npm run audit:ja-labels` PASS（allowlist 1・不変）/
  `npm run test` PASS（unit **1302/1302**・件数不変）/ `npm run build` PASS（全26ルート）/
  全13ブラックボックス 合計 **710/710 PASS**（`next start` 上・件数不変）/ SQLite `integrity_check` = `ok`
  （`world_player_cards` 13,009 / `managers` 66 / `player_index_entries` 47,479 / `player_cards` 19 /
  `player_booster_definitions` 44、すべてベースライン一致）/ 実ブラウザ（実データ「あ」・先発2/11人）で、
  診断パネルが編成エリア下部の横幅いっぱいの領域に表示され、8カテゴリが4列グリッドで並び、
  辛口モードの「配置構造・戦術監査」（配置充足状態の安全ゲート含む）も正常表示されることを確認。
  devサーバーはコード変更なしで健全に復旧。

> **記録に関する注記（2026-09-06）**: 本ファイルの直上のエントリ（レイアウト再構成）は、別セッションの
> 書き込みにより、本セッションが直前に記録していた以下4件の履歴（スカッド診断コメント関連）が
> 一時的に失われていたため、事実確認の上でここに復元した。コード自体（`squad-diagnosis-comments.ts`・
> `squad-tactical-review.ts` 等）はテスト件数（unit 1302/1302）と実ファイル内容の両方で無事を確認済み。

## 2026-09-06 — 配置構造・戦術監査の安全ゲート追加（配置不足時の過信頼度表示を修正）

- **修正した問題**: 先発が2/11人しか配置されていない実データ「あ」に対し、既存8カテゴリの点差
  （攻撃78点/守備45点）だけを根拠に「攻撃から守備への切り替え」の構造的リスクを信頼度「高」で
  断定表示していた。原因は、`contradictionToPhaseFinding`が配置充足状況を一切考慮せず
  `confidence: "high"`を固定で返しており、既存の`blockingFinding`は「先発が完全に空
  （overall.score===null）」の場合しか検出しないため、少数配置でもカテゴリスコアが算出できてしまう
  中間状態を素通りしていたため。
- 新設した配置充足状態（`TacticalCoverage`: insufficient/limited/partial/full）にもとづき、
  finding固有の信頼度と配置充足上限（`COVERAGE_CONFIDENCE_CAP`）のうち低い方を最終信頼度として採用する
  信頼度上限制御を追加（`CONFIDENCE_ORDER`による明示的な比較）。閾値は全11フォーメーションが
  GK除くフィールド10枠で構成されることを確認した上で設定。前方/中盤/後方の判定は実際のy座標
  （自由配置時は実座標）から行う。
- `insufficient`時はエリア別・役割別・局面別findingを一切生成せず、「配置構造分析: 先発配置が
  不足しています」という単一の案内だけを返す。数値上のカテゴリ差は「参考情報」として言及するにとどめる。
  「明確な欠陥は確認できません（問題なし）」と「評価できる範囲が限られています（評価不能）」を型
  （`wellComplemented`/`inconclusive`）として分離。見出しを「詳細戦術監査」から「配置構造・戦術監査」へ
  変更し、対象範囲の説明（プレースタイル発動可否・選手固有AIは判定していない旨）を常時表示。
  新設`TacticalReviewAnalysis`（`buildTacticalReview`）が配置充足状態・信頼度上限・分析全体の制限
  （`limitations`）・findingsを一括返却。既存`buildTacticalFindings`は後方互換ラッパーとして維持。
- 検証: `npm run verify` PASS（unit **1302**／`squad-tactical-review.test.ts` 45件）/ `npm run build` PASS /
  全13ブラックボックス 710/710 / SQLite integrity ok / 実ブラウザで実データ「あ」の攻守転換リスクが
  信頼度「高」の断定から「配置構造分析: 先発配置が不足しています」（信頼度データ不足）へ修正された
  ことを確認。総合評価73/100・評価A・各カテゴリスコアは不変。

## 2026-09-06 — 辛口コメント専用の詳細戦術監査（配置・役割・局面別リスク分析）

- 辛口コメントだけに、選手・配置・役割関係・局面別の構造的リスクまで踏み込む「詳細戦術監査」を追加。
  通常コメントは既存の`CommentAnalysis`のみを使用し変更していない。
- **実装前のデータ監査**: プレースタイル名と発動対象ポジションの確認済み対応表は本プロジェクト内に
  存在しないため、個別選手のプレースタイル発動可否（active/inactive）判定は実装しなかった。
  安全に実装できたのは、既存のフォーメーション座標定義（`formations.ts`）・既存の8カテゴリ診断結果・
  既存のLink-Up Play評価（`computed.linkUps`）にもとづく構造分析のみ。
- 新規 `src/lib/squad/squad-tactical-review.ts`（純関数）。フォーメーション座標から左/中央/右のエリア・
  隣接関係を決定的に導出し、ポジションラベルに対する一般的・構造的な役割分類と組み合わせて、
  エリア別の役割重複・ビルドアップの中継役不足を検出。既存の`CommentAnalysis.contradictions`を
  局面（ビルドアップ/攻撃/守備/攻守転換）へ再解釈するマッピングも追加（新規スコア計算なし）。
  各`TacticalFinding`に根拠・信頼度・限定的なリスク表現・改善優先順位・分析上の制限を保持。
- UI: `SquadDiagnosisCommentCard`に、辛口モードのときだけ「詳細戦術監査」セクションを追加。
- 検証: `npm run verify` PASS（unit **1283**／`squad-tactical-review.test.ts` 26件）/ 全13ブラックボックス
  710/710 / SQLite integrity ok。

## 2026-09-06 — スカッド診断コメントの詳細分析化（「遠慮しない専門家レビュー」化）

- 既存の通常/辛口コメント（単一の長所・単一の懸念点だけを文章化する簡易版）を、複数の診断要素を
  関連付けて説明できる詳細コメントへ強化。新設した内部分析モデル `CommentAnalysis`
  （`analyzeSquadDiagnosis()`）を単一の情報源とし、通常/辛口の両方がここから文章を組み立てる。
  最高〜2番目に低いカテゴリ・点差（`gapLevel`）・構成傾向（`profile`）・主要/二次的な長所と懸念・
  カテゴリ間の構成上の矛盾候補・改善優先順位（最大3件）を保持。
- 辛口コメントを「遠慮のない総評→最重要問題→構成上の矛盾→二次的な問題+改善優先順位→維持すべき長所」の
  複数段落構成へ強化。禁止表現（侮辱・人格否定等）は既存方針を維持。
- 検証: `npm run verify` PASS（unit **1257**／`squad-diagnosis-comments.test.ts` 92件）/ 全13ブラックボックス
  710/710 / SQLite integrity ok。

## 2026-09-06 — スカッド診断: 通常/辛口コメント追加

- 既存のルールベース「スカッド診断」結果に、決定的ルールで生成する「通常コメント」「辛口コメント」を追加。
  生成AI・外部API・ランダム処理は使用せず、既存の `SquadDiagnosisResult` のみを入力として2種類の文章を
  導出する純関数（新規 `squad-diagnosis-comments.ts`）。同じ診断結果には常に同じコメントを返す。
- 優先度: ①保存ビルド参照エラー→②データ不足→③配置充足度(D/C)→④能力カテゴリの弱点(D/C)の順で
  最重要な懸念点を1件選び、強み候補はS/Aランクの中から1件選ぶ。
- UI: `SquadDiagnosisPanel` に `SquadDiagnosisCommentCard`（通常/辛口トグル、既定は通常）を追加。
- 検証: `npm run verify` PASS（unit **1192**／新規テスト27件）/ 全13ブラックボックス 710/710 / SQLite integrity ok。

## 2026-08-28 — 最初の動作版（完了）

### フェーズ1: 資料分析・設計書 ✅
- [x] research.txt / claude-master-prompt.txt / screenshots 11枚 を読み取り（変更なし）
- [x] docs/efhub-ui-analysis.md
- [x] docs/efootball-team-ai-design.md（全39章 + セルフレビュー + 22項目回答）
- [x] docs/progress.md
- [x] docs/data-verification.md
- [x] README.md
- [x] .gitignore（通常の新規ファイル。git コマンドは未実行）

### フェーズ2: プロジェクト構築 ✅
- [x] package.json / tsconfig.json / next.config.mjs / postcss.config.mjs / tailwind.config.ts / .eslintrc.json / vitest.config.ts / next-env.d.ts
- [x] npm install --cache ./.npm-cache --no-audit --no-fund
  - 初回インストール後、next@15.1.6 にセキュリティ警告（CVE-2025-66478）が出たため
    package.json を next@^15.5.0 / eslint-config-next@^15.5.0 に更新し再インストール。
    → next 15.5.24 / eslint-config-next 15.5.24 で解決。
- [x] ダークテーマ（src/app/globals.css + tailwind.config.ts）
- [x] レイアウト（src/app/layout.tsx）+ サイドメニュー（AppShell / Sidebar）

### フェーズ3: UI ✅
- [x] ホーム画面（src/app/page.tsx）
- [x] プレイヤー一覧（src/app/players/page.tsx）
- [x] 選手詳細（src/app/players/[id]/page.tsx）
- [x] ローディング（src/app/loading.tsx）/ データなし・エラー（src/components/StateViews.tsx, error.tsx, not-found.tsx）

### フェーズ4: eFHUB データ取得 ✅
- [x] scripts/fetch-player-index.mjs
- [x] https://efhub.com/search/player-index.json へ GET 1回（2026-08-27T18:21:26Z / HTTP 200）
- [x] 受信 47,479 件 → 先頭 100 件を保存（不正 0 件）
- [x] キー判定: i=選手ID, e=英語名, j=日本語名, c=中国語名（新発見）, o=OVR
- [x] src/data/players.sample.json（100件）/ src/data/meta.json
- [x] docs/data-verification.md に結果を追記

### フェーズ5: 実データ接続・仕上げ ✅
- [x] 一覧・詳細を実データに接続（src/lib/players.ts 経由）
- [x] 日本語名検索 / 英語名検索 / 選手ID一致
- [x] OVR 順（降順・昇順）・名前順の並べ替え
- [x] 詳細への遷移（/players/:id）
- [x] データソース・取得日時の表示（ホーム・一覧・詳細）
- [x] npm run typecheck … エラー0
- [x] npm run lint … 警告0・エラー0（next lint は Next 16 で廃止予定の注意のみ）
- [x] npm run test … 15/15 パス
- [x] npm run build … 成功（全7ルート）
- [x] npm run dev … 起動（http://localhost:3000）
- [x] スモークテスト: ホーム200 / /api/players（英語・日本語検索・並べ替え・limit）200 /
      /api/data-status 200（count=100）/ 存在しないID 404 / /players 200 / /players/:id 200

### 今回やっていないこと（承認済み計画どおり）
- Git の初期化・コミット（動作版完成後に別承認で実施予定）
- 全選手同期 / eFootball World アクセス / 個別選手 RSC 解析 / Tier / 監督 / 育成計算 /
  スカッド完全版 / 認証 / 私の選手 / 私のビルド / 端末間同期 / コミュニティ / AI 機能 / 本番デプロイ

### 変更していないもの
- CLAUDE.md / research.txt / claude-master-prompt.txt / screenshots 内の全画像

---

## 2026-08-28 — 追加調査: 選手画像の配信方法

- scripts/investigate-player-images.mjs（新規）: efhub.com の個別ページ2件を GET し画像URLを抽出。
- scripts/head-check-images.mjs（新規）: efimg.com の画像2件へ HEAD。
- 結果は docs/player-image-findings.md に記録。
- 確定: 選手画像 = `https://efimg.com/efootballhub22/images/player_cards/{playerId}_l.png`（image/png）。
  playerId（= player-index.json の i）から URL を組み立て可能。
- 外部リクエスト合計4回（ページGET×2, HEAD×2）。画像バイナリの保存なし。

## 2026-08-28 — 選手画像表示の実装（自前プロキシ方式）

### 新規ファイル
- src/lib/player-image.ts … id検証(数字1〜20桁) / URL生成(固定テンプレート) / 許可URL二重チェック /
  メモリキャッシュ(最大32件・TTL1h・古いものから破棄・正常画像のみ) / fetchPlayerImage(GET,20s,redirect手動,再試行なし,3MB上限,画像CTのみ許可)
- src/lib/player-image.test.ts … 10テスト
- src/app/api/player-image/[id]/route.ts … 画像プロキシ。成功=画像+Cache-Control(public,max-age=86400,swr=604800),
  失敗=public/player-placeholder.svg を 200 + Cache-Control(public,max-age=300)
- src/components/PlayerImage.tsx … 3:4固定枠・loading=lazy・onErrorでシルエット差し替え
- src/components/PlayerSilhouette.tsx … 画面側フォールバックSVG
- public/player-placeholder.svg … ダーク背景+ライムグリーン+シルエット+「NO IMAGE」+3:4

### 編集ファイル
- src/components/PlayerCard.tsx … カード上部に画像 + OVRオーバーレイ（`// --- player image (revertable) ---` で明示）
- src/app/players/[id]/page.tsx … 大きめ画像を追加（モバイル縦積み / PC横並び）。「今後実装予定」から画像を除去
- docs/progress.md … 本記録

### 検証（外部GET: efimg.com へ 合計3回）
- npm run typecheck: エラー0 / npm run lint: 警告0 / npm run test: 25/25 パス / npm run build: 成功（全8ルート）
- GET /api/player-image/89138556575063 → 200 image/png 191865B X-Image-Cache: MISS
- GET /api/player-image/88041460996837 → 200 image/png 177194B X-Image-Cache: MISS
- GET /api/player-image/89138556575063（再） → 200 X-Image-Cache: HIT（upstream 追加なし）
- GET /api/player-image/abc → 400（外部アクセスなし）
- GET /api/player-image/99999999999999 → 200 image/svg+xml（プレースホルダー, X-Image-Placeholder: 1）
- /players → 200・画像参照100件・loading="lazy"・aspect-[3/4]（CLS対策）
- /players/89138556575063・/players/88041460996837 → 200・画像表示

### 既知の軽微な事項
- /players/{存在しないID} のページは HTTP 200 で not-found UI を表示（soft 404）。
  これはこのフェーズ以前からの挙動で、画像機能とは無関係。SEO 観点では将来 404 化を検討。


### 既知の未確認事項（次の調査対象）
- player-index.json の `o`（OVR）が 120 の選手が先頭に多い（研究資料の例は 97）。
  「最大レベル OVR」か特定カード種別かは、個別選手ページとの突き合わせが必要。
- player-index.json の並び順の基準（新着順？ 内部順？）。
- 個別選手データの取得元（JSON API か RSC か）。

### 補足: インストールスクリプトの警告
- npm 11 は既定で一部パッケージの postinstall（esbuild, unrs-resolver）をブロックする。
- 承認せずに進めたが、typecheck / test / lint / build / dev はすべて正常動作した
  （esbuild の実体はプラットフォーム別パッケージに同梱されており、ビルド不要のため）。

---

> このファイルは 2026-08-28 で更新が止まっていました。以降の各機能の詳細は `docs/*.md`（`compare-*` / `phase-squad` /
> `my-builds.md` / `phase-favorites-my-team.md` / `safe-build-and-cache-policy.md` など）を参照してください。
> 2026-09-01 以降のマイルストーンごとの完了報告は `docs/milestones/` に保存しています。
> 開発の共通ルールは `docs/development-safety-policy.md` / `docs/quality-gates.md` / `docs/project-baseline.md` /
> `docs/milestone-workflow.md`（単一の真実源）を参照してください。

## 2026-09-05 — B2 ブースター正式化監査 ＋「ビルド分析」への名称変更（詳細は `docs/milestones/2026-09-05-b2-booster-readiness.md`）

- **監査**: B1（カード付属）/ B2（ユーザー選択の追加ブースター＝ `selectedPlayerBooster`）/ Power of Many
  （`conditionalBoosterSelections`）の定義・保存フィールド・計算経路・URL/エクスポート/インポート表現・
  確認状態を総点検。`BOOSTER_CATALOG` 44 件のうち confirmationStatus:confirmed（効果の証拠が
  screenshot_verified/external_cross_verified）は 29 件。B2 の完全正式化（実験モードの必須解除・常時選択可能化）は
  **今回実施しない**（B2 は「未付属ブースターを手動で試算する」仕組みで、`calculatePlayerBooster` の構造上
  `experimentalExtraDeltas` にしか乗らず、標準/確定値には計算エンジン変更なしには反映できないため。加えて
  既存 UI・全13ブラックボックスの一部が実験モードの文言・ゲートに強く依存しており、安全な全面置換は
  この単独マイルストーンの範囲を超える）。理由を未解決問題として明記。
- **安全に実施した改善**: `BOOSTER_CATALOG` に `isB2SelectableCandidate` / `isConfirmedB2Candidate` を追加し、
  Power of Many 専用の条件付き定義（total-package）を B2 の試算選択欄から除外（既存選択があれば復元表示は維持）。
  `PlayerBoosterPanel` の既存見出し文字列（黒箱チェック依存）を変えずに「B1」「B2」バッジを追加。
  カード付属ブースターの根拠・発動方式・情報源の長文を `<details>「根拠を見る」` へ折りたたみ（短い状態表示は維持）。
- **名称変更**: ナビゲーション「ビルド棚卸し」→「ビルド分析」、ページタイトル「保存ビルド棚卸し」→
  「保存ビルド分析」。**URL `/build-inventory` は不変**。内部型名・ファイル名・関数名は変更していない。
- 計算エンジン（`calculateBuild`/`calculatePlayerBooster`/`buildComparison`/監督補正/Power of Many）・
  保存スキーマ・`storageVersion`・`rulesVersion`・URL 形式・SQLite は完全に不変。
- 検証: `npm run verify` PASS（unit 1054／`booster.test.ts` +6）/ `npm run build` PASS /
  全13ブラックボックス 合計 705/705（内訳不変・`black-box-boosters` 53/53・`black-box-progression` 99/99・
  `black-box-my-builds` 98/98・`next start` 上）/ SQLite integrity ok / 実ユーザーデータ変更なし・新規依存なし。

## 2026-09-06 — 保存スカッド編集画面のレイアウト再構成（右カラム縦長の解消）

- **解決した問題**: 右サイドカラムへ監督・ベンチ・チームサマリー・スカッド診断（総合評価・コメント・
  改善優先順位・配置構造・戦術監査・8カテゴリ・長所・弱点・改善候補・PNG保存・詳細根拠）が
  すべて縦積みされ、約300〜360px幅の狭いカラムへ長文が押し込まれて読みにくく、長距離スクロールが
  必要になっていた。一方でピッチ下・比較導線の下には大きな未使用空間が生じていた。
- `SquadDiagnosisPanel`を右カラム（`mobileTab==="summary"`条件下）から除去し、編成エリア全体
  （ピッチ＋右カラムの2列グリッド）の下に、PC・モバイル共通で常時表示（モバイルタブの選択に依存しない）
  の下段分析エリアとして1回だけ配置。右カラムには監督・ベンチ・チームサマリー・ビルド使用状況・
  役割設定・Link-Up Play・警告のみが残る（これらは今回変更していない）。
  診断のデータ生成（`diagnoseSquad`・`analyzeSquadDiagnosis`・`buildTacticalReview`）は`SquadEditor.tsx`の
  既存の`useMemo`のまま再利用し、レイアウト変更のために複製・再計算していない。
- `SquadDiagnosisPanel.tsx`・`SquadDiagnosisCommentCard.tsx`内部のグリッドを、フル幅を活かせるよう
  拡張: 8カテゴリを`sm:grid-cols-2`から`lg:grid-cols-4`（4列×2段）へ、詳細戦術監査のfindingリストを
  `lg:grid-cols-[repeat(auto-fit,minmax(320px,1fr))]`（複数件は自動で列化、1件なら不自然に細くならない）
  へ変更。長所・弱点（既存の`lg:grid-cols-2`）はそのまま、より広い横幅で読みやすく表示されるようになった。
  免責文言・コメント文章など長文部分には`max-w-3xl`を適用し、行が長くなりすぎないよう可読性を維持。
- 通常／辛口の切り替え・配置充足ゲート・PNG画像保存・詳細根拠の展開など、既存の機能・分析内容は
  一切変更していない。`squad-diagnosis.ts`・`squad-diagnosis-comments.ts`・`squad-tactical-review.ts`の
  分析規則も無編集。
- 検証: `npm run verify` PASS（unit 1302・レイアウトのみの変更のため新規テストなし）/ `npm run build` PASS /
  全13ブラックボックス 合計 **710/710**（本番ビルドで確認。devモードでのみ`/squads/compare`の不正パラメーター
  チェックが一過性に失敗する既知のdev固有差を確認したが、本番ビルドでは無関係に710/710 PASS） /
  SQLite integrity ok（テーブル件数もベースライン一致） / 実ブラウザでPC幅（約1568px）を確認し、
  右カラムが監督・ベンチ・チームサマリーのみに短縮され、スカッド診断が編成エリア全体の下へフル幅で
  移動し、8カテゴリが4列、長所・弱点が2列で読みやすく表示されることを確認。総合評価73/100・評価A・
  各カテゴリスコアは変更前と完全に同一。1024px/768px/390pxでの視覚確認はresize_windowのツール制約
  （実際のウィンドウ幅が変化しない）により未実施。

## 2026-09-06 — 配置構造・戦術監査の安全ゲート追加（配置不足時の過信頼度表示を修正）

- **修正した問題**: 先発が2/11人しか配置されていない実データ「あ」に対し、既存8カテゴリの点差
  （攻撃78点/守備45点）だけを根拠に「攻撃から守備への切り替え」の構造的リスクを信頼度「高」で
  断定表示していた。原因は、`contradictionToPhaseFinding`が配置充足状況を一切考慮せず
  `confidence: "high"`を固定で返しており、既存の`blockingFinding`は「先発が完全に空
  （overall.score===null）」の場合しか検出しないため、少数配置でもカテゴリスコアが算出できてしまう
  中間状態を素通りしていたため。
- 新設した配置充足状態（`TacticalCoverage`: insufficient/limited/partial/full）にもとづき、
  finding固有の信頼度と配置充足上限（`COVERAGE_CONFIDENCE_CAP`）のうち低い方を最終信頼度として採用する
  信頼度上限制御を追加（`CONFIDENCE_ORDER`による明示的な比較。文字列比較には依存しない）。
  閾値は既存11フォーメーション全てがGK除くフィールド10枠で構成されることを確認した上で、
  配置人数4人未満または前方/中盤/後方のいずれか2バンド以下しか埋まっていない場合を`insufficient`、
  7人未満または3バンド未満を`limited`、期待人数未満またはエリア未確認がある場合を`partial`、
  期待人数ちょうど＋全バンド＋全エリア確認可能な場合だけを`full`とする決定的な規則で判定する。
  前方/中盤/後方の判定は、フォーメーション上の静的なline番号ではなく実際のy座標（自由配置時は
  実座標）から行う。
- `insufficient`時はエリア別・役割別・局面別findingを一切生成せず、「配置構造分析: 先発配置が
  不足しています」という単一の案内だけを返す。数値上のカテゴリ差は、この案内の中で「参考情報」
  として言及するにとどめ、独立した確定的な戦術findingとしては表示しない。
  「ビルドアップの中継役不足」（スカッド全体に対する否定的な断定）は`limited`でも生成せず、
  `partial`/`full`のときだけ生成するよう変更（配置不足を役割不足と誤認しないため）。
  「明確な欠陥は確認できません（問題なし）」と「評価できる範囲が限られています（評価不能）」を
  型（`wellComplemented`/`inconclusive`）として明確に分離。
- 名称・免責を適正化: 見出しを「詳細戦術監査」から「配置構造・戦術監査」に変更し、
  「現在の配置ポジション、フォーメーション座標、確認済み診断カテゴリにもとづく構造分析です。
  プレースタイルの発動可否、選手固有AI、実際の試合中の挙動は判定していません。」という対象範囲の
  説明を常時表示。役割タグのラベル・evidence文言も「配置構造上の役割」であることを明示する表現へ統一
  （選手固有のプレースタイル・AI挙動として誤読されないように）。
- 新設`TacticalReviewAnalysis`（`buildTacticalReview`）が、配置充足状態・信頼度上限・
  分析全体としての制限事項（`limitations`、findingごとの重複を避け集約）・findingsを一括して返す。
  既存の`buildTacticalFindings`は`buildTacticalReview(...).findings`を返す後方互換ラッパーとして維持。
- UI: `SquadDiagnosisCommentCard`が「配置 X/Y人」・配置充足状態バッジ・対象範囲の説明・集約された
  分析制限を表示するよう更新。
- `squad-diagnosis.ts`・`squad-diagnosis-comments.ts`は今回も一切編集していない（通常コメント無変更）。
  PNG画像保存機能も無変更。
- 検証: `npm run verify` PASS（unit **1302**／`squad-tactical-review.test.ts` 45件）/ `npm run build` PASS /
  全13ブラックボックス 合計 **710/710**（件数不変） / SQLite integrity ok（テーブル件数もベースライン一致） /
  実ブラウザで実データ「あ」（先発2/10人）を確認し、修正前は信頼度「高」で断定表示されていた
  攻守転換リスクが、修正後は「配置構造分析: 先発配置が不足しています」（信頼度: データ不足）
  という単一の安全な案内に置き換わったことを確認。総合評価73/100・評価A・各カテゴリスコアは不変。

## 2026-09-06 — 辛口コメント専用の詳細戦術監査（配置・役割・局面別リスク分析）

- 辛口コメントだけに、選手・配置・役割関係・局面別の構造的リスクまで踏み込む「詳細戦術監査」を追加。
  通常コメントは既存の`CommentAnalysis`のみを使用し、今回一切変更していない。
- **実装前のデータ監査（重要）**: プレースタイル名と発動対象ポジションの確認済み対応表は本プロジェクト内に
  一切存在しないため、個別選手のプレースタイル発動可否（active/inactive）判定は**実装しなかった**
  （未確認仕様を推測で埋めない方針）。身長・利き足・AIプレースタイル・選手スキルの効果も意味が
  未確認のため使用していない。個別指示・攻撃/守備参加設定は型として存在しないため対象外。
  安全に実装できたのは、既存のフォーメーション座標定義（`formations.ts`のx/y/role/line、11フォーメーション
  全て確認済み）・既存の8カテゴリ診断結果・既存のLink-Up Play評価（`computed.linkUps`）にもとづく
  構造分析のみ。
- 新規 `src/lib/squad/squad-tactical-review.ts`（純関数）。フォーメーション座標から左/中央/右のエリア・
  隣接関係を決定的に導出し（`ADJACENCY_MAX_LINE_DIFF=1`・`ADJACENCY_MAX_X_DIFF=28`、既存11フォーメーション
  の座標間隔を調査して設定）、ポジションラベルに対する一般的・構造的な役割分類（前方へ進出/後方をカバー/
  中継 等・標準的なサッカーのポジション理論にもとづく静的な対応表であり選手個別の挙動を示すものではない）
  と組み合わせて、エリア別の役割重複・ビルドアップの中継役不足を検出。既存の`CommentAnalysis.contradictions`
  （すでに計算済みのカテゴリ矛盾候補）を局面（ビルドアップ/攻撃/守備/攻守転換）へ再解釈するマッピングも
  追加（新規のスコア計算は一切行わない）。各`TacticalFinding`に根拠・信頼度（high/medium/low/insufficient）・
  「〜可能性があります」という限定的なリスク表現・改善優先順位・分析上の制限を保持させ、断定表現
  （必ず/絶対に/確実に等）を含めない設計とした。参照エラー・データ不足時は戦術分析より優先して単独表示。
  最大3件＋該当時のみinfo1件（`MAX_MAIN_FINDINGS=3`）。
- UI: `SquadDiagnosisCommentCard`に、辛口モードのときだけ「詳細戦術監査」セクションを追加（重要度・信頼度を
  文字ラベルでも表示、根拠・改善優先順位を箇条書き/番号付きで表示、内部ID非表示）。通常モードでは非表示。
  `SquadEditor.tsx`から既存の`buildSquad()`出力（`computed.formation`/`computed.slots`）だけを使って
  `TacticalPlacementInput[]`を組み立てる新規アダプタ`buildTacticalPlacementInputs`を追加（能力値・診断の
  再計算なし）。
- PNG画像保存機能は今回も変更していない（既存の1440×1920固定・既存テストとも無変更）。
- 検証: `npm run verify` PASS（unit **1283**／新規`squad-tactical-review.test.ts` 26件）/ `npm run build` PASS /
  全13ブラックボックス 合計 **710/710**（件数不変） / SQLite integrity ok（テーブル件数もベースライン一致） /
  診断ロジック・8カテゴリ計算・総合評価計算式・保存スキーマ・`storageVersion`・`rulesVersion`・
  実ユーザーデータ・新規npm依存なし。
- 実ブラウザ確認中に前回セッション由来の`.next/cache/next-devtools-config.json`破損を再度検出せず、
  正常にdevサーバーが起動・稼働することを確認。

## 2026-09-06 — スカッド診断コメントの詳細分析化（「遠慮しない専門家レビュー」化）

- 既存の通常/辛口コメント（単一の長所・単一の懸念点だけを文章化する簡易版）を、複数の診断要素を
  関連付けて説明できる詳細コメントへ強化。新設した内部分析モデル `CommentAnalysis`
  （`analyzeSquadDiagnosis()`・純関数・既存の `SquadDiagnosisResult` を比較・整理するだけでスコアは
  再計算しない）を単一の情報源とし、通常/辛口の両方がここから文章を組み立てる二段構成に変更。
  `CommentAnalysis` は判定可能/対象外カテゴリ・最高〜2番目に低いカテゴリ・点差
  （`gapLevel`: small/moderate/large/extreme、境界は10/20/30点で固定）・構成傾向（`profile`:
  攻撃偏重型/守備安定型/スピード志向型/パス・ビルドアップ志向型/ドリブル・ボール保持志向型/
  プレス志向型/カウンター志向型/空中戦に強みがある構成/バランス型/明確な武器が不足している構成/
  データ不足により分類できない構成の11種、僅差の1位だけで特化型と断定しないための
  `PROFILE_FEATURE_MARGIN`＝8点を明示）・主要/二次的な長所と懸念・カテゴリ間の構成上の矛盾候補
  （固定9ペアのルールリストから、十分な点差(≥20点)とS/A対C/Dの評価差がある場合だけ検出）・
  改善優先順位（最大3件・重複排除）を保持する。
- 辛口コメントは、通常コメントの単純な言い換えから「遠慮のない総評→最重要問題→構成上の矛盾→
  二次的な問題+改善優先順位→維持すべき長所」の複数段落構成へ強化し、通常コメントより明確に率直な
  表現（「放置できない」「見過ごせる水準ではありません」「完成していると判断するのは早いです」等）
  を用いる一方、ユーザー本人への侮辱・人格否定・暴言・嘲笑・煽り・全国順位や勝率の創作は既存の
  禁止方針を維持して一切含めない。同じ指摘を懸念文と改善優先順位文で二重に繰り返さないよう、
  優先順位1位が懸念文の内容と重複する場合は「続いて〜」の言い回しへ切り替える重複排除ロジックを追加。
- UI: `SquadDiagnosisCommentCard` に、改善優先順位（最大3件）を番号付きリストとして
  別途表示する領域を追加（プローズ内でも触れるが、視認性のため一覧としても提示）。
  モード切替・非永続化・診断再実行なしの既存方針は維持。
- 既存27件のテストを、新しい分析モデル・多段落構成に合わせて92件へ拡充（決定性・総合評価の解釈・
  カテゴリ点差・構成傾向・カテゴリ間の関係・長所と弱点・改善優先順位・通常/辛口コメント・
  不足/エラー状態・§24の代表テストケース9件・`diagnoseSquad`との統合を検証）。
- 実ブラウザ確認中に `next dev` が `.next/cache/next-devtools-config.json` の破損（何らかの書き込み競合で
  末尾に余分な `}` が付加）により起動できない状態を発見。ユーザーの明示承認を得た上で、この1ファイルだけを
  正常なJSON内容へ上書き修正（`.next`全体やキャッシュ全体の削除は行っていない）。
- PNG画像保存機能（`squad-diagnosis-image.ts` 等）は今回も変更していない（前回同様、画面表示のみ）。
- 検証: `npm run verify` PASS（unit **1257**／`squad-diagnosis-comments.test.ts` 92件）/ `npm run build` PASS /
  全13ブラックボックス 合計 **710/710**（件数不変） / SQLite integrity ok（テーブル件数もベースライン一致） /
  診断ロジック・8カテゴリ計算・総合評価計算式・保存スキーマ・`storageVersion`・`rulesVersion`・
  実ユーザーデータ・新規npm依存なし。

## 2026-09-06 — スカッド診断: 通常/辛口コメント追加

- 既存のルールベース「スカッド診断」結果に、決定的ルールで生成する「通常コメント」「辛口コメント」を追加。
  生成AI・外部API・ランダム処理は使用せず、既存の `SquadDiagnosisResult` のみを入力として2種類の文章を
  導出する純関数（新規 `squad-diagnosis-comments.ts`）。同じ診断結果には常に同じコメントを返す。
- 優先度: ①保存ビルド参照エラー→②データ不足→③配置充足度(D/C)→④能力カテゴリの弱点(D/C)の順で
  最重要な懸念点を1件選び、強み候補はS/Aランクの中から1件選ぶ（`selectPrimaryConcern`/`selectPrimaryStrength`）。
  同点時は `ABILITY_CATEGORIES` の既存の固定順（`Object.keys()` 非依存）で先着優先というタイブレークを明記。
  判定対象外は0点/弱点として扱わず、データ不足・参照エラーは能力面の弱点と別カテゴリとして文章化。
- 辛口コメントは禁止表現（侮辱・人格否定・順位/勝率の断定・不必要な煽り等）を一切使用しない設計とし、
  27件のUnit Testで断定的表現の不在・強み/弱点の捏造なし・決定性・タイブレークを検証。
- UI: `SquadDiagnosisPanel` に `SquadDiagnosisCommentCard`（通常/辛口トグル、既定は通常）を追加。
  モードはコンポーネント内 `useState` のみで保持し、localStorage/SQLite/URLへは一切保存しない。
  切替は既存の診断結果の表示切替のみで、診断エンジンの再実行・能力値の再計算は発生しない。
- PNG画像保存機能（`squad-diagnosis-image.ts` 等）は今回変更していない。可読性を損なう懸念があるため、
  コメントは画面表示のみとし画像には含めない（既存の1440×1920出力・既存テストは無変更）。
- 実ブラウザ確認で発見・修正: 辛口コメントの「配置充足度」の文言で `選手配置の充足状況（選手配置の充足状況）`
  とラベルが二重表示される表現の重複バグを発見し、通常コメントと同じ表現に統一して修正。
- 検証: `npm run verify` PASS（unit **1192**／新規 `squad-diagnosis-comments.test.ts` 27件）/ `npm run build` PASS /
  全13ブラックボックス 合計 **710/710**（件数不変） / SQLite integrity ok（テーブル件数もベースライン一致） /
  診断ロジック・8カテゴリ計算・総合評価計算式・保存スキーマ・`storageVersion`・`rulesVersion`・
  実ユーザーデータ・新規npm依存なし。

## 2026-09-06 — スカッド診断カードのUI改善 + PNG画像保存

- 保存スカッド編集画面の「スカッド診断」カードへ、視覚的なゲージ（判定対象外は破線枠で区別・0点と混同しない）・
  配置/参照エラーに関する重要な警告（先頭付近に表示）を追加。**診断ロジック・各カテゴリの点数計算・
  総合評価の計算式・ランク判定基準は一切変更していない**（`squad-diagnosis.ts` は無編集）。
- 新規「診断結果を画像で保存」ボタン（PNG）。既存に画像生成ライブラリが無いため新規依存を追加せず、
  ブラウザー標準の Canvas 2D API だけでゼロから描画（DOMスクリーンショットではないため、ボタン等の
  操作UI・画面外の内部情報が写り込む余地が構造的にない）。画像には総合評価・ランク・8カテゴリ・
  代表的な長所/弱点1件ずつ・作成日時・短縮免責文言のみを含み、worldCardId・buildId・squadId等の
  内部IDは含めない。ファイル名は `efootball-team-ai-squad-diagnosis-<チーム名>-YYYYMMDD.png`
  （使用禁止文字はサニタイズ・空チーム名は既定値）。連打防止・生成中表示・成功/失敗フィードバック・
  一時リソース（Object URL・`<a>`要素）の解放を実装。
- 新規 `squad-diagnosis-share.ts`（安全なデータ抽出の純関数）・`squad-diagnosis-image.ts`（Canvas描画・
  保存処理）・`SquadDiagnosisImageSaveButton.tsx`。既存 `browser-download.ts` と同じ後始末方針を踏襲。
- 実装中に発見・修正したバグ: `SquadDiagnosisImageSaveButton` の mounted フラグが React 18 StrictMode の
  開発時二重マウントでマウント時にリセットされず、開発環境でのみボタンが「生成中」表示のまま固まる問題を修正
  （本番ビルドには影響しない旨を確認）。実ブラウザでの動作確認で発見。
- 検証: `npm run verify` PASS（unit **1165**／新規テスト29件）/ `npm run build` PASS /
  全13ブラックボックス 合計 **710/710**（件数不変・パネルはlocalStorage依存のためSSRシェルには元々出ない）/
  SQLite integrity ok / 診断ロジック・保存スキーマ・storageVersion・rulesVersion・実ユーザーデータ・
  SQLite変更なし・新規npm依存なし。

## 2026-09-06 — スカッド診断（スカッド構成評価）基盤（詳細は `docs/milestones/2026-09-06-squad-diagnosis-foundation.md`）

- 保存スカッド編集画面（サマリータブ）に、説明可能で決定的なルールベース「スカッド診断」を追加。
  攻撃/守備/空中戦/スピード/パス・ビルドアップ/ドリブル・ボール保持/プレス適性/カウンター適性の8カテゴリ
  （0-100・ランクS〜D）＋選手配置の充足状況（構造評価）＋総合評価（判定可能項目の単純平均）。
  全国順位・勝率予測・辛口評価・生成AI・共有・課金は実装せず、免責文言を常時表示。
- 新規 `src/lib/squad/squad-diagnosis.ts`（純関数・localStorage/SQLite/HTTP アクセスなし・
  `diagnoseSquad`/`scoreSquadCategory`/`calculateDataCoverage`/`suggestSquadImprovements` 等）。
  入力は既存 `buildSquad()` の出力（`SquadComputed`）をそのまま再利用し、B1/B2/Power of Many/監督補正の
  計算はやり直さない（Unit Testで既存計算との完全一致を確認）。GK/フィールド・先発/ベンチを区別し、
  欠損データは0点にせず「判定対象外」を明示。削除済み保存ビルド参照は既存 `classifyBuildReference` と同じ
  基準で検出。長所・弱点（各最大3件・kindで能力/データ不足/参照エラーを区別）・改善候補（最大3件・提案のみ・
  自動適用なし）。無料版候補（`basicSummary`）と詳細情報をコード構造上分離（認証・課金は今回未実装）。
- 新規 `src/components/squad/SquadDiagnosisPanel.tsx`（読み取り専用）。`SquadEditor.tsx` の
  `TeamSummaryPanel` 直後に配置。表示だけでスカッド・保存ビルド・My Team・SQLiteは変更しない。
- 検証: `npm run verify` PASS（unit **1136**／`squad-diagnosis.test.ts` 55件）/ `npm run build` PASS /
  全13ブラックボックス 合計 **710/710**（`black-box-squads` 46→50・他レール件数不変・`next start` 上）/
  SQLite integrity ok / 保存スキーマ・storageVersion・rulesVersion・新規localStorageキー・SQLite・
  既存能力値計算・B1/B2/Power of Many・監督補正・ポジション別OVR変更なし・実ユーザーデータ変更なし・新規依存なし。

## 2026-09-06 — B1/B2 育成画面インライン配置（詳細は `docs/milestones/2026-09-05-b1-b2-inline-layout.md`）

- 育成ポイント表示の直下（選手詳細の育成タブ）に、カード付属ブースター（B1）と追加ブースター（B2）を
  1つの「ブースター」領域として統合。PC（1024px以上）では2列横並び、モバイルでは縦積み。
  **計算エンジン（`calculate-player-booster.ts`/`calculate-final-stats.ts`/`types.ts`/`engine.ts`）は無編集**。
- 新規 `AttachedBoosterSection.tsx`（B1・「カード固有・変更不可」バッジ・「条件付きブースター（Power of Many）」
  ラベルを追加）／`B2BoosterSelector.tsx`（B2・既存 `selectedPlayerBooster` 状態と更新処理をそのまま移設）。
  従来ページ下部の折りたたみ内にあったB1詳細一覧・B2選択欄は撤去し、`selectedPlayerBooster` 状態・
  B2選択UIは1箇所のみに統合（重複0）。`PlayerBoosterPanel.tsx` は「適用モード」「検証情報」のみへスリム化。
- Power of Many（`conditionalBoosterSelections`）・未確認B2/`total-package`の互換表示（自動削除・自動変換なし）は
  すべて既存仕様のまま維持。比較画面（`PlayerControlColumn`）は対象外のため無変更。
- 検証: `npm run verify` PASS（unit **1081**・件数不変=計算コード無編集のため）/ `npm run build` PASS /
  全13ブラックボックス 合計 **706/706**（件数不変・`next start` 上）/ SQLite integrity ok /
  保存スキーマ・`storageVersion`・`rulesVersion`・URL・比較・JSON互換・実ユーザーデータ変更なし・新規依存なし。

## 2026-09-05 — B2ブースター標準計算統合（詳細は `docs/milestones/2026-09-05-b2-standard-integration.md`）

- 直前セッションで作業ディレクトリ矛盾（OneDrive基準で起動・正本側4ファイルへ未検証編集）が判明。
  読み取り専用引き継ぎ監査で矛盾解消を確認後、中断文書 `docs/milestones/in-progress/b2-standard-integration.md`
  を作成してから設計レビュー・テストを実施。
- `calculate-player-booster.ts` の B2（`selectedPlayerBooster`）を `isConfirmedB2Candidate` で確認済み/未確認に
  分離し、確認済み分（`confirmedB2Deltas`）を `standardFinalValue`（＝通常の最終値・比較の順位・チーム集計）へ
  安全に統合。未確認分・`total-package`（Power of Many専用）は従来どおり試算専用（`experimentalExtraDeltas`）
  のまま・自動削除や「なし」への自動変換はしない。B1・Power of Many・監督補正・対象能力・上限・丸めは不変
  （二重加算なしを単体テストで確認）。`experimentalFinalValue` は数値としては維持（内訳の移動のみ）。
- `types.ts`/`engine.ts` に `confirmedB2BoosterDelta`/`playerBoosterByStat.confirmedB2`/
  `booster.confirmedB2Total`/`booster.hasConfirmedB2` を追加（保存スキーマは無変更）。
- `PlayerBoosterPanel` のB2欄を「実験的なブースター試算（手動）」→「追加ブースター（B2・手動選択）」へ整理し、
  確認済み候補は実験モード不要で常時選択可能に変更。未確認・過去の保存値（`total-package`含む）は通常候補
  一覧に混ぜず、警告付きで復元表示（削除・自動変換なし）。比較画面（`PlayerControlColumn`）の説明文言も
  新挙動に整合。
- 検証: `npm run verify` PASS（unit **1081**／`booster.test.ts` +25 含む）/ `npm run build` PASS /
  全13ブラックボックス 合計 **706/706**（`black-box-boosters` 53→54・他レール件数不変・`next start` 上）/
  SQLite integrity ok / 保存スキーマ・`storageVersion`・`rulesVersion`・URL・SavedBuild/MyTeamRecord/StoredSquad
  変更なし・実ユーザーデータ変更なし・新規依存なし。

## 2026-09-05 — 保存ビルドエクスポートの保存場所選択（詳細は `docs/milestones/2026-09-05-saved-build-export-location.md`）

- 保存ビルド JSON のエクスポート時、対応ブラウザーでは File System Access API（`showSaveFilePicker`）で
  ユーザーに保存場所を選ばせ、確認画面で Windows の「ドキュメント」フォルダーの選択を案内する（**断定はしない**）。
  非対応・例外時は既存の Blob + `<a download>` 方式へ安全にフォールバック。
- 新規 `src/lib/browser-save-file.ts`（`saveTextFile` / `isSaveFilePickerSupported`）。`showSaveFilePicker` は
  `suggestedName`（既存 `buildExportFilename`）・JSON MIME/拡張子・`startIn:"documents"`（絶対パスではない
  候補ヒント）を指定し `createWritable → write → close`。ユーザーキャンセル（`AbortError`）は
  `reason:"cancelled"` としてエラー/成功と区別。`FileSystemFileHandle` は永続化しない。
- `BuildExportModal.tsx` は `downloadTextFile` 直呼び出しを `saveTextFile` 経由へ変更。JSON 形式・
  `format`/`formatVersion`/`itemCount`/決定的並び順/UTF-8・BOM なし/直前再取得・競合再検証は**すべて不変**。
  `src/lib/browser-download.ts` は無変更（フォールバックとして継続使用）。
- 検証: `npm run verify` PASS（unit 1048／`browser-save-file.test.ts` 17）/ `npm run build` PASS /
  全13ブラックボックス 合計 705/705（`black-box-my-builds` 95→98・`next start` 上）/ SQLite integrity ok /
  スキーマ・localStorage キー・URL・計算エンジン・SQLite・実ユーザーデータ変更なし・新規依存なし。

## 2026-09-05 — 保存ビルド重複候補（詳細は `docs/milestones/2026-09-02-saved-build-duplicate-review.md`）

- `/build-inventory` に、JSON インポートや複製で増えた可能性がある保存ビルドの**重複候補**を安全に確認する
  読み取り専用セクションを追加（`/my-builds` には案内のみ）。**自動統合・自動削除・自動上書き・一括処理ではない。**
- 完全一致候補: 同じ worldCardId 内で worldCardId/rulesVersion/progressionAllocation/selectedPlayerBooster/
  conditionalBoosterSelections が一致するビルドを、決定的フィンガープリント（正規化 JSON 文字列・localStorage
  不保存）でグループ化。buildId/buildName/createdAt/updatedAt/calculatedStats/calculatedOvr は同一性に使わない。
- 類似候補（安全な2パターンのみ実装）: 「配分1カテゴリのみ差分」「ブースター/Power of Manyのみ差分」。複合差分は
  「別ビルド」扱い。ペア表示（n件グループ化しない）。架空の類似度は使わない。
- 判定不能（規則不明・スキーマ検証失敗）は比較対象から除外し「重複候補なし」に含めない。既存 Build Inventory
  の使用状況・参照索引をそのまま再利用（再計算・再走査なし）。
- 新規: `src/lib/progression/build-duplicate-review.ts` / `DuplicateReviewSection.tsx` / `DuplicateReviewTeaser.tsx`
  ＋テスト40件。変更: `BuildInventoryView.tsx` / `MyBuildsView.tsx` / `black-box-my-builds.mjs`（+15）。
- 検証: `npm run verify` PASS（unit 1031／`build-duplicate-review.test.ts` 40）/ `npm run build` PASS /
  全13ブラックボックス 合計 702/702（`black-box-my-builds` 95/95・`next start` 上）/ SQLite integrity ok /
  スキーマ・localStorage キー・URL・計算エンジン・SQLite・実ユーザーデータ変更なし・新規依存なし。

## 2026-09-02 — 保存ビルドのローカル JSON インポート（詳細は `docs/milestones/2026-09-02-saved-build-import.md`）

- My Builds に、前回このアプリから書き出した正式なエクスポート JSON を**ユーザーの最終確認後に**保存ビルドとして
  **追加**する機能（**インポートのみ**・既存を上書きしない・全件単位保存）。エクスポートと同じ `format` /
  `formatVersion` / `savedBuildSchema` を再利用。対象は `SavedBuild` のみ（My Team・スカッド・お気に入りは触れない）。
- 段階分離: ファイル選択 → サイズ/JSON/形式/`format`/`formatVersion`/`itemCount`/各 `SavedBuild`（strict）検証 →
  ファイル内 `buildId` 重複拒否 → 既存 `buildId` 衝突は `generateUniqueBuildId` で新 ID 発行（内容・日時は維持）→
  プレビュー → 最終確認（inline `role="alertdialog"`）→ 保存直前に既存再取得・競合再検証 →
  `importBuilds` で全件単位 1 回書込（`storeSchema` 検証 → 単一 `setItem`・部分保存なし）→ 保存後再検証。
- 上限: ファイル 4MB / itemCount 3000。未対応 `formatVersion` は変換せず拒否。無効 `SavedBuild` が 1 件でも全体拒否。
  プロトタイプ汚染対策（`__proto__`/`constructor`/`prototype` 拒否・`strict` スキーマ・明示フィールド構築）。
- 新規: `src/lib/progression/build-import.ts` / `src/lib/browser-upload.ts` /
  `src/components/progression/BuildImportModal.tsx` ＋テスト 2 ファイル。
  変更（最小）: `build-storage.ts`（`generateUniqueBuildId` ＋ `importBuilds` 追加・既存関数とスキーマ不変）・
  `MyBuildsView.tsx`・`black-box-my-builds.mjs`。
- 検証: `npm run verify` PASS（unit 991／`build-import.test.ts` 40・`browser-upload.test.ts` 7・`build-storage.test.ts` +10）/
  `npm run build` PASS / 全13ブラックボックス 合計 687/687（`black-box-my-builds` 80/80・`next start` 上）/
  SQLite integrity ok / スキーマ・`storageVersion`・localStorage キー・URL・計算エンジン・SQLite・実ユーザーデータ変更なし・新規依存なし。

## 2026-09-02 — 保存ビルドのローカル JSON エクスポート（詳細は `docs/milestones/2026-09-02-saved-build-export.md`）

- My Builds に、保存ビルドを **ローカル JSON ファイル**として端末へ書き出す機能を追加（**エクスポートのみ**・
  インポート/アップロード/復元/上書きなし）。全件・選択の両方に対応。ブラウザー内だけで処理し、サーバー API・
  外部送信・アップロードなし。エクスポートしても保存ビルド・My Team・スカッド・お気に入り・SQLite・`updatedAt` を変更しない。
- 形式: `format`（固定）/ `formatVersion`（固定 `"1"`・保存スキーマの `rulesVersion`/`schemaVersion` とは別軸）/
  `app` / `exportedAt`（UTC ISO 8601）/ `itemCount`（builds.length 一致）/ `builds`（`savedBuildSchema` 検証済み・
  決定的な並び順）。ファイル名 `efootball-team-ai-builds-YYYY-MM-DD-HHMMSS-mmmZ.json`（UTC）。
- 出力直前に `listAllBuilds()` を再取得し、buildId 集合（全件）または buildId+worldCardId+updatedAt（選択）と
  スキーマを再検証。競合・無効データがあればダウンロードせず `role="alert"` ＋再読込を案内。
- 新規: `src/lib/progression/build-export.ts` / `src/lib/browser-download.ts` /
  `src/components/progression/BuildExportModal.tsx` ＋テスト 2 ファイル。
  変更（最小）: `build-storage.ts`（`savedBuildSchema` に `export` 追加のみ）・`MyBuildsView.tsx`・`black-box-my-builds.mjs`。
- 検証: `npm run verify` PASS（unit 934／`build-export.test.ts` 34・`browser-download.test.ts` 6）/ `npm run build` PASS /
  全13ブラックボックス 合計 674/674（`black-box-my-builds` 67/67・`next start` 上）/ SQLite integrity ok /
  スキーマ・localStorage キー・URL・計算エンジン・SQLite・実ユーザーデータ変更なし・新規依存なし。

## 2026-09-01 — 旧規則ビルド確認ガイド（`/build-inventory` 内・詳細は `docs/milestones/2026-09-01-legacy-build-guide.md`）

- 保存ビルド棚卸し画面に、旧 `rulesVersion` の保存ビルドを**安全に発見・影響範囲確認**し、ユーザーが
  個別に現在の育成画面で確認し直すための**読み取り専用ガイド**を追加。新ページなし（`/build-inventory` 内 `<details>`）。
  「自動移行機能」ではない — 自動変換・一括変換・上書き・削除・解除・付け替えなし。移行状態を保存しない・新キーなし。
- 判定は `ruleKind === "legacy"`（`resolveBuildRuleStatus` / `isLegacyRulesVersion`）のみ。規則不明は別扱い。
  ポイントは保存済み `rulesVersion` のルールセット（`buildPointSummary`）で表示・無条件再計算なし・不能は「—」。
- 純関数追加（`build-inventory.ts` 末尾・非破壊）: `summarizeLegacyBuilds(items)` / `legacyOnlyFilter()`。
  `LegacyBuildGuide`（`BuildInventoryView` 内）＋各カードに「育成で開く」（`?tab=progression`）導線。
- 検証: `npm run verify` PASS（unit 894／`build-inventory.test.ts` 28）/ `npm run build` PASS /
  全13ブラックボックス 合計 664/664（`black-box-my-builds` 57/57・`next start` 上）/ SQLite integrity ok /
  スキーマ・localStorage キー・URL・計算エンジン・SQLite 変更なし。

## 2026-09-01 — 開発運用基盤（安全・品質・使用量最適化）の整備（詳細は `docs/milestones/2026-09-01-dev-operations-baseline.md`）

- 毎回のプロンプトへ再掲していた共通安全規則・品質ゲートを、正式リポジトリ内の**単一の真実源**へ整理。
  ルールの短縮・削除ではない。安全性・精度・品質ゲート・重大停止条件・完了判定は一切弱めていない。
- 新規: `docs/development-safety-policy.md` / `docs/quality-gates.md` / `docs/project-baseline.md` /
  `docs/milestone-workflow.md` / `docs/milestones/`（README ＋ `in-progress/`）。
- 更新（最小差分）: `CLAUDE.md`（末尾に参照文書索引・本文不変）/ `docs/safe-build-and-cache-policy.md`
  （冒頭に正本ワークスペース移行注記・§1〜§10 不変）/ 本ファイル。
- コード変更 0（`src/` `scripts/` `package.json` `package-lock.json` `data/efootball.db` 不変）。
  Markdown だけの変更のため、`quality-gates.md` §8 に従い直前の完全成功ベースライン（保存ビルド棚卸し）を継承。
  `next dev` は正常稼働のまま維持（停止・再起動なし）。

## 2026-09-01 — 正本ワークスペースを OneDrive 外へ移行

- `C:\Users\akihi\OneDrive\デスクトップ\eFootball-Team-AI` → `C:\Development\eFootball-Team-AI`（OneDrive 同期対象外）。
  旧フォルダはバックアップとして保持（開かない・編集しない）。移行理由・手順・検証は会話ログと `safe-build-and-cache-policy.md` を参照。
- 移行後: `npm ci` PASS / `npm run verify` PASS（unit 822/822）/ `npm run build` PASS / 全13ブラックボックス 637/637 / SQLite integrity ok。

## 2026-09-01 — 保存ビルド棚卸し `/build-inventory`（詳細は `docs/my-builds.md`）

- 保存ビルドが My Team（selectedBuildId / favoriteBuildId）とスカッド（先発/ベンチ savedBuildId）の
  どこで使われているか・未使用・削除済み/worldCardId 不一致/不正 buildId 参照を一画面で確認する**読み取り専用**画面。
  一括操作・自動修復なし。個別導線のみ。純ロジック `src/lib/progression/build-inventory.ts`
  （`buildInventory` / `collectBuildReferences` / `classifyBuildReference` / `filterBuildInventory` / `sortBuildInventory` / `filterBuildInventoryIssues`）。
- 新規: `build-inventory.ts` / `BuildInventoryView.tsx` / `app/build-inventory/page.tsx`。`Sidebar` にナビ 1 行。
- 検証: `npm run verify` PASS（unit 888／`build-inventory.test.ts` 22）/ `npm run build` PASS / 全13ブラックボックス（`black-box-my-builds` 48/48） /
  SQLite integrity ok / スキーマ・localStorage キー・SQLite・計算・URL 変更なし。

## 2026-09-01 — スカッド編集: 保存ビルド選択パネル + ビルド使用状況サマリー（詳細は `docs/my-builds.md`）

- **M1**: スカッド編集の各枠（先発 slotId / ベンチ subId）に「保存ビルドを選ぶ」パネル（`SquadBuildPanel`）。
  対象枠の `savedBuildId` だけを設定・解除（既存の「保存ビルドを適用...」select は残置）。My Team の
  `selectedBuildId` / `favoriteBuildId` は変更しない。純関数 `resolveBuildRef` / `validateSquadBuildAssignment`。
- **M2**: 同画面に「ビルド使用状況」サマリー（`SquadBuildUsagePanel`・表示専用・一括操作なし）。純関数
  `summarizeSquadBuilds` / `filterSquadBuildUsage`。M1 のパネルを再利用。
- 検証: `npm run verify` PASS（unit 866／`my-builds.test.ts` 142・`squad-storage.test.ts` 30）/ `npm run build` PASS /
  全13ブラックボックス 642/642 / SQLite integrity ok / 架空 OVR 0 / スキーマ・localStorage キー・SQLite 変更なし。

## 2026-09-01 — My Team「保存ビルドを選ぶ」パネル（詳細は `docs/my-builds.md`）

- My Team 画面で対象カードの保存ビルドを内容まで確認しながら、選択中ビルド（`selectedBuildId`）と
  お気に入りビルド（`favoriteBuildId`）を**独立して**設定・解除できる `MyTeamBuildPanel` を追加。
  既存の「かんたん選択」`<select>` は残置。新規 localStorage キー / スキーマ変更なし・既存 `updateMyTeamRecord` のみ使用。
- `my-builds.ts` に純関数追加: `resolveMyTeamBuildRefs` / `sortMyTeamBuildPanel` / `validateMyTeamBuildRefClear`。
- 検証: `npm run verify` PASS（unit 842/842・`my-builds.test.ts` 143 件）/ `npm run build` PASS /
  全13ブラックボックス 637/637（`black-box-my-builds` 35/35）/ SQLite integrity ok / 架空 OVR 0。
