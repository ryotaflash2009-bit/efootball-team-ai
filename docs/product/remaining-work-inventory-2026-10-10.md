# 残りの作業の棚卸し（2026-10-10 夜）

分類: **A** 今すぐ実行 / **B** 安全な停止点まで / **C** 本人が必要 / **D** 将来の候補 / **E** 完了済みだが文書が古い / **F** 削除・クローズの候補。
調べた範囲: コードの TODO・FIXME・HACK・XXX、文書のチェックボックス、Production / リリースの準備の文書、Evidence の依頼、既知の限界、
テストの skip・todo、Coming soon・準備中、機能フラグ、GitHub の open の Issue・PR、#206〜#228 の積み残し、一時ファイル、ローカルのサーバー、古い文書・メモ。

## A（この夜に実行・完了）

| 項目 | 結果 |
|---|---|
| カテゴリの Lv の上限 25 は無い（本人の確認） | コードは正しい。変更なし・テストで固定（`category-level-above-25.test.ts`・3） |
| 同じ選手の別のカードは 2 枚編成できない（本人の確認） | 全経路に実装（`same-player-rule.md`・人物キー＝カード ID の下位 20 ビット・本番 13,372 枚で食い違い 0） |
| 個別指示 | 確認不要としてクローズ（待ち・残作業・Evidence の依頼から削除） |
| 検出の欠落（毎時の schedule の 83% が欠落） | watchdog を追加・間隔の通知を 130 → 600 分（`hourly-detection-decision-package.md`） |
| 改善シミュレーションのテストのフィクスチャ | 全員が同じカード ID だった → 別々の ID に（同じ選手の規則で露見） |

## B（安全な停止点まで）

| 項目 | 停止点 |
|---|---|
| 2026-10-13 の毎時の検出の観測の締め | 手順・GO/NO-GO は `hourly-detection-decision-package.md` §7。日付の到来の後に読み取りだけで実行（本人の操作は不要） |

## C（本人が必要）

| 項目 | 本人の操作 |
|---|---|
| `data/work/efhub-tmp`（11 ファイル）の削除 | 下の一覧。10 件以上の削除は本人の判断（Claude Code は削除しない） |
| `data/work/wt-head`（detached の worktree・junction を含む） | 不要なら `git worktree remove data/work/wt-head`（junction の先を消さないよう、`rm -rf` は使わない） |
| Dependabot PR #151（tailwindcss のメジャー更新・CI 失敗） | Tailwind v4 への移行は別の作業（D）。不要なら PR を閉じる |

## D（将来の候補・今は実施しない）

- 外部 cron（毎時の確実な起動）: watchdog で足りない場合だけ（新しい Token が必要・本人の判断）。
- 自動 Apply の後の `reference-data-applied-state.json` の自動の PR: 今は Evidence の PR で手で更新（二重の適用は Orchestrator の `latestAutoApplied` が防ぐため機能の問題はない）。
- 公開サイトに最後の検出の時刻を出す（`hourly-detection.md` §7・v1.1 の候補）。
- アカウント機能の公開の前のセキュリティのチェックリスト（`security-checklist.md`・新規登録は未開放）。
- Tailwind v4（#151）。
- Search Console の経過の確認（数日〜数週間後の運用の確認・本人の作業でも停止の理由でもない）。
- 未使用の i18n キー `bestXi.sameNameWarningTemplate`（同じ名前の知らせの削除で未使用。12 言語の辞書から消すのは次の辞書の整理でまとめて）。

## E（完了済み・文書を更新した）

| 文書 | 更新 |
|---|---|
| `game-evidence-requests-2026-10-09.md` | 3 件すべてクローズ |
| `best-xi-same-name.md` | 「置き換え済み」と明記 |
| `remaining-work-2026-10-10.md` | #2 完了・§2 実装済み |
| `feature-ledger.md`（F-148・F-143）・`feature-reaudit-2026-10-07.md`（NEW-43）・`complete-game-plan.md`・`integrated-roadmap.md` | 本人の回答を反映 |
| `security-checklist.md` | 「Git が無い」等の古い記述に現状の注記 |
| `reference-data-supabase-default-readiness-runbook.md` | Phase E は実施済みと注記 |
| `hourly-detection.md` | 通知の基準・watchdog（§7.2） |

## F（削除・クローズの候補）

| 項目 | 判断 |
|---|---|
| `src/lib/best-xi/same-name.ts`・テスト | 削除済み（規則そのものの実装に置き換え・2 ファイル） |
| Issue #112 | **閉じない**（検出の通知の Issue として workflow が使い続ける） |
| リモートのブランチ 51 本（マージ済みが中心） | 一括の削除はしない（記録だけ。必要なら本人が GitHub の Branches の画面で） |

### `data/work/efhub-tmp`（11 ファイル・Git の対象外・合計 約 1.3 MB）

2026-10-09 の eFHUB基準の照合（`progression-efhub-crosscheck-2026-10-09.md`）のために取得した eFHUB の公開のページと JS。
照合の結果は Evidence（`evidence/efhub-progression-crosscheck-2026-10-09.json`）に要約済みで、元のファイルは再取得で再現できる。
第三者のコンテンツのため Git に入れない・移動しない。秘密情報は含まない想定（中身は開いていない）。**全件が削除の候補**（本人の判断 1 件）。

| ファイル | 用途 | 再現 | Evidence に必要 |
|---|---|---|---|
| `player.html` | 選手ページの構造の確認 | 再取得 | 不要（要約済み） |
| `c_25baf817b133f0fb.js`・`c_3247379322e3373e.js`・`c_50c072d7ed5a579b.js`・`c_80f2012e3a1119ad.js`・`c_a6dad97d9634a72d.js`・`c_cd950c8019855dc5.js` | 育成の計算の規則の確認（ページの JS の chunk） | 再取得（chunk 名は変わりうる） | 不要（規則は照合の文書に記録） |
| `robots.txt`・`sitemap.xml` | 取得してよい範囲・ページの一覧 | 再取得 | 不要 |
| `terms_terms.html`・`terms_terms-of-service.html` | 利用規約の確認（同じ内容の 2 つの URL） | 再取得 | 不要（判断は文書に記録） |

本人の操作（不要と判断した場合）: エクスプローラーで `C:\Development\eFootball-Team-AI\data\work\efhub-tmp` フォルダを開き、11 ファイルを選んで削除する
（フォルダ ごと削除してもよい。OneDrive の同期の対象外のため大量削除の警告は出ない）。
