# 招待制の少人数ベータ（F-124 解除）— 2026-10-03

**判定: `F124_RELEASED_FOR_LIMITED_INVITE_BETA`**（本人の判断。確認ツール `scripts/validate-f124-release.mjs` は記録を検証するだけで、判断を作らない）

## 解除の根拠（A・B・C）

| | 内容 | 根拠 |
|---|---|---|
| A 技術 | 実装・テスト・CI・CodeQL・通知・Evidence・Apply の関門 | `auto-update-status-2026-10-02.md` の 20 条件 |
| B 設定 | `reference-data-automation`（main だけ・Secret 9 件）・変数 `true` | `evidence/2026-10-03-auto-update-apply-ready.json` |
| C 実運用 | World: run 37118431576（+75・更新 5,675）、Managers: run 37128515014（+2）。どちらも本人の承認つき Apply → applied_verified。applied-state・Evidence 更新、公開サイトで World 13,372・Managers 69 を確認 | `evidence/world-update-2026-10-03.json`・`evidence/managers-update-2026-10-03.json` |

## 試用の範囲

- **対象者**: 信頼できる 3〜5 人。URL を直接伝える（招待制）。
- **費用**: 無料。
- **機能（ログイン不要の既存機能だけ）**:
  - 選手検索・選手詳細・比較・育成
  - Managers・Squads・Best XI
  - スカッド診断・共有 URL・診断履歴・改善前後カード・共有画像
  - パーセンタイル・称号・バッジ・「あなたの一番」・成長プロフィール
- **共有**: URL を知っている信頼できる少人数だけ。
- **検索エンジン**: noindex を維持する（robots・X-Robots-Tag はそのまま）。

## 引き続き禁止

| 項目 | 状態 |
|---|---|
| 新規登録の一般開放・Custom SMTP の完成前の一般アカウント登録 | 禁止（`account-availability.ts` の Gate は変えない） |
| 写真投稿の段階 2 の本番適用・写真付き投稿の公開・コミュニティの公開 | 禁止（内部ページは本番で 404 のまま） |
| 本番の Schema・RLS・Storage の変更 | 禁止 |
| 不特定多数への告知・noindex の解除・検索エンジンへの掲載 | 禁止 |
| 課金 | 禁止 |
| Production Apply の無承認化・Rollback / Restore の自動化 | 禁止（Apply は本人の承認 1 回を維持） |

## 試用者へのお願い（伝える文面の例）

- まだ試験中のサイトです。URL はほかの人に広めないでください。
- 気づいたことは、画面の名前・操作・起きたことだけを送ってください。**本名・メールアドレス・パスワード・ゲームのアカウント情報・スクリーンショットの個人情報は送らないでください。**
- ログインや新規登録は今回の対象外です。

## 問題が起きたとき

- 表示の不具合・誤ったデータ: `invite-beta-stop-procedure.md` §1（Vercel の Instant Rollback。データは変えない）。
- 参照データの更新の問題: `auto-update-incident-response.md`。
- 試用を止める: URL の共有をやめる。必要なら `invite-beta-stop-procedure.md` §2。

## 次の段階の判断（本人）

利用状況（問題報告の件数と内容・エラー・応答時間・Vercel と Supabase の使用量）を確認してから、**10〜30 人への拡大を再判断**する。
拡大しても、上の「引き続き禁止」は別の判断が無い限り変わらない。
