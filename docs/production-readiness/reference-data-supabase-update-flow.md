# 参照データ(Supabase `reference_data`)の半自動更新・ロールバックフロー(2026-09-14)

本書は`reference-data-update.md`(2026-09-11、SQLiteファイル差し替え方式)の大原則(サイト本体デプロイと参照データ更新の分離・人による承認を必ず挟む・自動反映しない)を引き継ぎつつ、**Supabase `reference_data`スキーマへの投入を前提に、SQLファイル差し替えではなく`dataset_version`/`import_batch_id`単位のバッチ管理**へ具体化したものである。

**本書は設計のみ。実Supabaseへの接続・実データ投入は行っていない。**

---

## 1. 15ステップの更新フロー

```
 1. ソースから取得              (既存の sync-world-players-*.mjs / eFHUB取得スクリプト等の発展形)
 2. ローカルSQLiteへ保存         (現行の正本 data/efootball.db、または検証用の別ファイル)
 3. スキーマ検証                (既存のZodスキーマ・SQLite制約チェックを再利用)
 4. 件数比較                   (前回dataset_versionとの総件数差分を算出)
 5. 重複確認                   (findDuplicateIds、主キー一意性チェック)
 6. 必須項目・異常値確認         (validateWorldPlayerCard / validateManager 等)
 7. 画像URL許可ホスト確認        (isAllowedWorldImageUrl、許可外ドメイン検出)
 8. PostgreSQL形式へ変換         (transformWorldPlayerCard 等、migration-transform.ts)
 9. dataset_version付与         (computeDatasetVersion、例: world-2026-10-01)
10. import_batch_id採番+payload_hash計算 (buildManifest。投入前manifestを生成・保存)
11. 既存計算テスト・ブラックボックス (calculateBuild等の既存Unit Test + Production Buildでの回帰確認)
12. 人による承認               ★自動化しない(投入前manifestの内容を人が確認して承認)
13. Supabaseへバッチ投入         (reference_data.import_batchesにstatus='pending'を記録→対象テーブルへUPSERT→status='verified'に更新。1トランザクション内で実施)
14. 投入後照合                  (投入後の件数・payload_hashが投入前manifestと一致するか確認)
15. 問題時はimport_batch_idでロールバック (DELETE-then-re-INSERTではなく、直前のimport_batch_idのスナップショットへ戻す。詳細は3章)
```

`reference-data-update.md`の14ステップとの対応: ステップ1〜7は同じ(取得〜異常値確認)。ステップ8以降がPostgreSQL/Supabase固有の内容(旧: 「本番SQLiteファイルを差し替え」→ 新: 「dataset_version/import_batch_id付きでUPSERT」)に置き換わっている。

---

## 2. なぜDELETE-then-re-INSERTを第一選択にしないか

- 大量件数(13,009件等)の`DELETE`+`INSERT`は、実行中に一時的にテーブルが空になる時間帯を生み、その間にAPIからのSELECTが空結果を返すリスクがある(トランザクション分離レベル次第だが、単純な運用ミスで長時間ロックする恐れもある)。
- `import_batch_id`ごとに「どの行がどのバッチで投入されたか」を追跡できなくなり、ロールバック時に「1つ前の状態」を再現する手段が失われる。
- 対して、**`UPSERT`(主キー一致なら更新、なければ挿入)+バッチ内で削除すべき行を明示的に把握してから`DELETE`**という手順であれば、常時テーブルにデータが存在し、かつどのバッチでどの行が変化したかを`import_batches`テーブルで追跡できる。

### 推奨する投入方式

1. 新しいデータセット全体をローカルで変換・検証し、「今回のdataset_versionに含まれる主キー一覧」を確定する。
2. トランザクション内で:
   a. `reference_data.import_batches`に`status='pending'`の行を作成。
   b. 新データを`UPSERT`(主キーが存在すれば更新、なければ挿入)。
   c. 今回のデータセットに存在しない主キー(＝ソース側で削除されたレコード)を特定し、**安全停止条件(4章)に該当しなければ**削除する。該当すれば、この投入全体をロールバックし人へ通知する。
   d. 投入後の件数・`payload_hash`が投入前manifestと一致することを確認する。
   e. `import_batches`の`status`を`'verified'`に更新してコミット。
3. 何らかの理由でコミット前に異常を検知した場合は、トランザクションを`ROLLBACK`する(Postgresのトランザクション機能により、コミット前なら自動的に何も反映されない)。

---

## 3. コミット後に問題が発覚した場合のロールバック

- コミット後(`status='verified'`後)に問題が発覚した場合は、**直前の`import_batch_id`が投入した内容のスナップショット**(投入前に保存した`*.manifest.json`+変換済みJSON)を使って、該当バッチが変更した行だけを**前の値に戻す**(全件`DELETE`+再投入ではなく、差分だけを戻す)。
- スナップショットが失われている、または差分の特定が困難な場合の最終手段として、`rollback-reference-data-schema.sql`でスキーマごと削除し、直前の安定版から**スキーマごと再作成・再投入**する(この場合のみ全件洗い替えを許容する)。
- `import_batches`テーブルの`status`を`'rolled_back'`に更新し、ロールバックの事実を記録に残す。

---

## 4. 安全停止条件(Supabase投入に特化した追加分、`reference-data-update.md`4章の条件に追加)

| 条件 | 具体的な閾値の考え方 |
|---|---|
| トランザクション内での検証失敗 | ステップ13実行中に件数・重複・payload_hashのいずれかが投入前manifestと不一致なら即座に`ROLLBACK`し、コミットしない |
| `import_batches`の状態不整合 | 前回バッチが`'verified'`で終わっていない(`'pending'`のまま残っている)場合、新しい投入を開始せず先に前回分の状態を確認する |
| RLS/GRANTの意図しない変更 | 投入作業の過程で`reference-data-sql-audit.ts`の監査結果が変化した(例: 新しいポリシーが追加された)場合は、投入を停止しSQLの内容を確認する |
| Preview環境への投入 | Preview環境(既存の`efootball-team-ai-dev`)への投入は、Production環境への投入とは別の承認ステップを経る(5章) |

---

## 5. Preview/Productionのデータ分離(参照データ固有、`preview-production-environment-design.md`を踏まえた具体化)

| 項目 | Preview(検証用) | Production(正式公開後) |
|---|---|---|
| Supabaseプロジェクト | 既存の`efootball-team-ai-dev`をそのまま使用(ユーザーデータ用の`public`スキーマとは別の`reference_data`スキーマを追加) | **新規に分離したSupabaseプロジェクト**を正式公開前に作成する(今回は作成しない) |
| 参照データの投入 | 本書のフローに従いdry-run→承認→投入。Preview環境はテストデータ混入のリスクを許容する(既存の`preview-production-environment-design.md`の方針と同じ) | Preview環境のデータをそのまま引き継がず、**Production用に新規インポート**する(dataset_versionを新しく採番) |
| Site-URL / Redirect-URLs | 既存の開発用設定をそのまま使用 | Production独自のURLで別途設定(参照データの投入とは独立した作業) |
| ロールバック | Preview環境内で完結(他ユーザーへの影響なし) | Production環境専用の`import_batch_id`系列で管理(Previewの`import_batch_id`とは完全に別系列) |
| 第三者への共有 | 行わない(`vercel-pre-deploy-checklist.md`の既存方針と同じ) | 正式公開後は全ユーザーがアクセス |

---

## 6. 本書の位置づけ

- 本書はSupabase `reference_data`スキーマへの投入を前提とした**設計**であり、実際の投入・トランザクション実行・Supabaseプロジェクトの新規作成のいずれも今回は行っていない。
- 実装時は、`scripts/migration/reference-data-migration-tool.mjs`(現状はdry-runのみ)を拡張し、実Supabase接続を持つ別ツール(管理用の特権資格情報を用いる、通常のアプリケーションコードとは分離した経路)を新規に用意する必要がある。
