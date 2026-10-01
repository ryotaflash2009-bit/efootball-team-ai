# 参照データ自動更新の到達状態（2026-10-02 再監査）

根拠: `.github/workflows/reference-data-*.yml`・`src/lib/reference-data/auto-update/*`・`automated-update-pipeline.md`・Evidence。Production への接続・Apply・Secret の設定はしていない。

| 項目 | 状態 | 根拠 |
|---|---|---|
| 定期検出（週1回） | **本番で稼働**。2026-09-27 の定期実行は `no_change`（445 リクエスト・403/429 なし） | run 36340696128、`evidence/f071-artifact-2026-10-01.json` |
| 手動検出 | 稼働（confirm `detect`） | 2026-09-25 run |
| 差分・Plan | 実装・テスト済み。自動進行での本番実行は未実施 | `update-orchestrator*.ts`・テスト |
| Backup（R2・暗号化） | 実装・本番で実行済み（2026-09-24・09-26、手動の承認つき）。自動進行モードは未実施 | backup workflow・Evidence |
| Dry run（使い捨て PostgreSQL・Production の資格情報なし） | 実装・テスト済み。自動進行では未実施 | apply workflow `dry-run` |
| Apply | 実装済み。2026-09-26 に旧手順（4承認）で本番適用・事後検証 `applied_verified` | `evidence/world-update-2026-09-26.json` |
| 事後検証 | Apply の中で実行（`applied_verified` / `rollback_required`） | `stage4-world.ts` |
| applied-state | Apply 後の Evidence PR で更新（設計どおり人のレビューつき）。Apply の run が `applied_verified` のとき Evidence artifact に `applied-state.candidate.json`（source checksum12・件数・apply run id）を自動で出す | `scripts/reference-data-evidence.mjs` |
| F-071 分布の成果物 | 候補は検出で自動生成。取り込みは `npm run import:world-distribution`（VALID のときだけ書き込む）。現在 VALID | PR #95・#97 |
| 通知（GitHub Issue） | 検出: 更新あり・要確認・失敗（PR #97）。**PR #106 まで一度も起動していなかった**（検出 workflow の名前の `+` が workflow_run のパターン文字だったため）。自動進行の停止・Apply 承認待ち・Apply の結果（検証済み / 要 rollback / 失敗）も通知（`reference-data-pipeline-notify.yml`）。`GITHUB_TOKEN` だけ | PR #97・#106・本 PR |
| main 限定 | 自動進行・検出の起動条件に加え、Production apply と Backup の job も main 以外からは Environment に入る前に skip | apply / backup workflow |
| 承認者の記録 | Apply は Environment の承認記録（run approvals API）から承認者を取り、無ければ DB 接続前に停止。起動者（bot）とは別に記録 | `approved-by.ts` |
| 機械可読 Evidence | すべての mode で `evidence.json`（run・attempt・commit・ref・起動者・承認者・mode・dataset・結果・入出力ファイルの sha256）を 90 日保存 | `scripts/lib/reference-data-evidence.mjs` |
| タイムアウト | 最悪 165 分に対し job の上限 180 分（テストで固定） | PR #97 |
| ロールバック | 取り消し計画を生成。本番での実行モード・リハーサルは無い（Level 3 の条件） | apply workflow |
| 失敗時の停止 | 各段階で `stopped`（Apply の run を作らない）。テスト済み・本番未経験 | `update-orchestrator-cli.ts` |
| 再実行の安全性 | 再実行（re-run）された run は停止。main の commit が途中で変わったら停止 | 同上 |
| 二重実行の防止 | concurrency group（取り消しなし）・advisory lock（Apply） | workflow・apply |
| 削除の検出 | removed > 0 で Plan が停止（自動では削除しない） | 停止条件表 |
| 構造の変更 | schema drift・不完全なスナップショットで停止 | 同上 |
| Managers | 1回の自動進行で1データセット（World が先、Managers は次回） | orchestrator |
| `player_card_analysis` | Apply は書き込まない（権限・コードの両方） | apply role 設計 |
| Secret の数 | 自動進行用の Environment `reference-data-automation` に 9 件（Plan 2・Backup 7）。Apply の 2 件は既存の承認つき Environment | `automated-update-pipeline.md` §2・§5 |
| Environment の保護 | `reference-data-automation`: main だけ・レビューなし（読み取り専用の資格情報だけ）。`reference-data-production-apply`: 必須レビュー | 同上 |

## 「完成」の条件と残り

1. 本人: Environment `reference-data-automation` の作成、Secret 9 件の登録（値は Claude Code に渡さない）、変数 `REFERENCE_DATA_AUTO_UPDATE_PIPELINE_ENABLED=true`。
2. 次に `update_available` が出たとき（または手動の `orchestrate`）、Plan → Backup → Dry run が承認なしで1回ずつ成功し、Apply の run が `waiting` になる。
3. 本人の Approve 1回で Apply が `applied_verified`。
4. Evidence・applied-state・F-071 の成果物の PR → 公開サイトで VALID。

それまで F-124（本人だけで検証・他人に試してもらわない・新規登録とコミュニティを公開しない）を続ける。

## 2026-10-02 夜間の到達状態（PR #106・#107 マージ後）

- **自動更新の判定: AUTO_UPDATE_SETTINGS_BLOCKED**
  - 実装・テスト・通知・Evidence・Apply の関門は完成している。
  - 本人の設定（下の 1 手順）が無いため、Plan・Backup・Dry run を自動では動かせない。
- **Apply の判定: 未実施**
  - 新しい候補（World 13372・Managers 69）がある。
  - 設定が無いため、Backup・Plan・Dry run の前で止めている。
  - 未設定の Environment を参照する run を起動すると、GitHub が保護なしの Environment を自動で作るため、起動していない。

### 20 の完成条件

| # | 条件 | 状態 | 根拠 |
|---|---|---|---|
| 1 | 定期検出 | ✅ 稼働（週 1 回） | detection workflow・2026-09-27 の定期 run |
| 2 | 更新の検出 | ✅ | run 36901363553: World 13372（適用 13297）・Managers 69（適用 67） |
| 3 | 4 区分の区別 | ✅ | no_change / update_available / attention_required / failed（通知のテスト） |
| 4 | 必要な通知 | ✅ | Issue #112 を自動作成（PR #106 で初めて起動）。停止・承認待ち・Apply の結果も通知（PR #107） |
| 5 | Apply の前に有効な Backup が必須 | ✅ | orchestrator の Backup の関門・apply の Backup の束縛 |
| 6 | 空・不完全・古い・対象違いの Backup で停止 | ✅ | 0 行・件数の不一致・Plan の件数欠落・期限・対象の照合（PR #106 で強化） |
| 7 | Dry run で差分を確認 | ✅ | 使い捨て PostgreSQL での dry run（本番の資格情報なし） |
| 8 | 削除・構造変更を自動適用しない | ✅ | removed > 0・schema drift で停止 |
| 9 | 許可した差分だけが候補 | ✅ | manual review の確認入力・plan の checksum の束縛 |
| 10 | Apply 後の件数・内容・applied-state の確認 | ✅ | 事後検証（applied_verified）・applied-state の候補を自動出力（PR #107） |
| 11 | F-071 は VALID だけ取り込む | ✅ | `import:world-distribution`（VALID 以外は書かない） |
| 12 | 一部の失敗を成功にしない | ✅ | Evidence の outcome（no_summary・unexpected_apply_status・rollback_required） |
| 13 | 再実行で二重に適用しない | ✅ | 再実行の run は停止・advisory lock・concurrency |
| 14 | Rollback の可否を確認 | ✅（実行は本人の判断） | undo plan の artifact（90 日）・自動の取り消しはしない |
| 15 | Evidence の自動保存 | ✅ | evidence.json（すべての mode・90 日） |
| 16 | 意図しない本番書き込みがない | ✅ | apply の mode だけが書く・承認必須・main 限定 |
| 17 | Secret の値をログに出さない | ✅ | Secret の名前だけ・要約の Secret 検査・Evidence は許可した形だけ |
| 18 | 起動者・承認者・workflow・commit・run を追跡できる | ✅ | Evidence（actor・approvedBy・commit・run・attempt）・承認記録の API |
| 19 | エラーで安全に止まる | ✅ | 各段階の stopped・Apply の run を作らない・通知 |
| 20 | 本人がコードを毎回変えずに動く | ⏳ 設定待ち | 下の 1 手順の後は、検出から Apply 承認待ちまで自動 |

### 本人の 1 手順（値は Claude Code に渡さない）

1. GitHub → Settings → Environments → **New environment** `reference-data-automation`:
   - Deployment branches: **Selected branches → `main`** だけ
   - Required reviewers: なし
2. その Environment に Secret 9 件を登録（名前は `automated-update-pipeline.md` §2・§5 のとおり）:
   - Plan の読み取り専用: 2 件
   - Backup: 7 件
3. Settings → Variables → Repository variable `REFERENCE_DATA_AUTO_UPDATE_PIPELINE_ENABLED` = `true`

その後の流れ（Claude Code が行う）:
1. 読み取り専用の確認（名前・main 限定・参照）を行う。
2. 手動の `orchestrate`（detection run 36901363553）で、Plan → Backup → Dry run を起動する。
3. Apply の run が承認待ちになる → Issue に通知が来る → 本人が **Approve and deploy** を 1 回押す。

### F-124 の判定（解除しない）

| | 内容 | 状態 |
|---|---|---|
| A 技術 | 実装・テスト・CI・通知・Evidence・関門 | ✅ 完了 |
| B 設定 | Environment・Secret 9 件・変数 | ❌ 未設定 |
| C 実運用 | 自動進行での Plan → Backup → Dry run → 承認 → applied_verified を 1 回 | ❌ 未実施 |

A・B・C がすべて確認できるまで、家族・友人・第三者への試用・新規登録の開放・コミュニティの公開をしない。
