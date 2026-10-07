# 将来の機能の契約（モック・Production に接続しない）— 2026-10-07

| 機能 | 契約 | テスト | 本番の前に必要なこと |
|---|---|---|---|
| 友達 | `src/lib/social/friends.ts`（申請・承認・拒否・取り消し・削除・ブロック・1 日 20 件・300 人・通知は申請と承認だけ） | `friends.test.ts` | 公開 ID の適用・Auth の公開・表と RLS の提案（公開 ID と同じ方式） |
| 友達との比較 | 同上（共有の要約だけ・公開の設定・関係・ブロック・規則の版が違えば数値を並べない） | 同上 | 共有の要約の保存の契約（現在は URL の fragment だけ） |
| ライバル | 同上（両方のオプトイン・5 人・オプトアウトで空・週 / 月の成長は同じ規則の版だけ） | 同上 | 同上 |
| AI コーチ | `src/lib/coach/coach-contract.ts`（提供元に依存しない・規則の提供元だけで動く・最小の文脈・事実 / 推測 / 提案と出典・回数 / 費用 / 時間切れ / 再試行の上限） | `coach-contract.test.ts` | 外部の AI の契約と API key は本人の判断の後（今は追加しない） |
| 相手の分析 | `src/lib/squad/opponent-analysis.ts`（手で入れた相手の情報だけ・保存しない） | `opponent-analysis.test.ts` | 画面（ローカル）・辞書 |
| メタ分析 | `src/lib/meta/meta-contract.ts`（合成 / 参照のデータ・オプトインの統計は母数 50 以上・警告・信頼度・同意の撤回） | `meta-contract.test.ts` | オプトイン・匿名化・同意の撤回の契約（本人の判断） |
| コミュニティの安全 | `src/lib/community/moderation.ts`（`community-safety-operations.md`） | `moderation.test.ts` | 本人の判断 5 件・表と RLS の提案 |

どれも生成 AI・外部の API・Production の DB を使わない。決定的・版つき・テストつき。

## 公開プロフィール・公開ビルド（モック・2026-10-07 追加）

`src/lib/profile/public-profile.ts`（テスト `public-profile.test.ts`・Production に接続しない・純関数）。

- 公開の範囲は項目ごと（プロフィール・ビルド・称号）に private / friends / public。**既定はすべて private**。
- ブロック（どちらから）・存在しない・非公開は、見る人には同じ「見つからない」（存在の推測を防ぐ）。本人には項目ごとの範囲も見せる。
- 公開ビルドに出すのは、World のカード ID・ビルド名・OVR・育成の配分・ブースター・規則の版だけ（最大 30 件・ビルドごとに公開を選ぶ・既定は含めない）。
  内部の buildId・作成と更新の時刻・育成の目的・計算の内訳は出さず、識別子は公開用の slug。
- 表示名: 制御文字・双方向の制御文字を除き、なりすまし（公式・運営・KONAMI 等）・URL・メールアドレスを拒否。
- 前提: 公開 ID の表（提案 `public-id-production-proposal.md`）・`user_blocks`・Auth の公開。画面と保存は本人の判断の後。
