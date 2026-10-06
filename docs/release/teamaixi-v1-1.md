# TeamAIXI v1.1 — Release Validator（2026-10-07）

`node scripts/validate-teamaixi-v1-1-release.mjs`（`BASE_URL=https://efootball-team-ai.vercel.app` で公開サイトの読み取りも）。
判定: `TEAMAIXI_V1_1_READY` / `TEAMAIXI_V1_1_MANUAL_REVIEW_REQUIRED` / `TEAMAIXI_V1_1_BLOCKED`。何も公開しない。

| 区分 | 内容 |
|---|---|
| リポジトリ | 追加の 10 言語は RC（未レビューの公開なし）・Link-Up Play / OVR の契約・止まった移動の早めの戻し・アクセス解析の URL の整理・npm audit の分類・改善シミュレーション・公開 ID と写真の段階 2 の提案・noindex |
| 運用（必須） | 自動更新の復旧（`FULLY_AUTOMATED_UPDATE_RESTORED`）・30 日以内の Backup の検証 |
| 品質ゲート | CI・CodeQL・verify・本番の build・PostgreSQL・Secret の確認・black-box（多言語を含む）・アクセシビリティ・性能・セキュリティ・React #418 0 |
| live | 公開の画面 200・内部の画面 404・noindex・セキュリティヘッダー・件数 = applied-state（v1.0 と同じ確認） |
| 本人 | 毎時の検出の判断・F-045・F-070・公開 ID と写真の段階 2 の適用・コミュニティの安全・ドメインと SMTP・法務の確認・Next.js 16・npm audit の major の更新 |

## 2026-10-07 の結果

`TEAMAIXI_V1_1_BLOCKED`（理由は 1 つ: `auto_update_not_restored:VERIFIED_BLOCKED_OWNER_ACTION` = 自動適用の DB の Secret の本人の入力待ち）。
live の確認・リポジトリの確認・品質ゲートはすべて合格（アクセシビリティ 32/32・本番）。本人の確認 10 件は未記録（正しい状態）。
