# Production Backup・Restore運用手順(将来実施用、このセッションでは未実施)

作成日: 2026-09-20。**この文書は将来の実施手順であり、記載された操作はこのセッションでは
一切実行していない。** Production Supabaseへの接続・Production Backupの取得・Production
Restoreは、いずれも独立した承認事項である。

関連: [[reference-data-production-backup-design.md]]・[[reference-data-backup-manifest.md]]

## 1. 前提条件(実施前に必ず完了していること)

1. [[reference-data-production-readonly-preflight-result.md]]のread-only preflightが完了し、
   `reference_data`の構造がA(想定どおり)であることを確認済み。
2. `age`の鍵ペアを、本人がローカル環境で生成済み(秘密鍵はローカルだけに保持し、
   GitHub Secretsには一切登録しない)。
3. `age`の**公開鍵だけ**をGitHub Secrets(例: `BACKUP_AGE_PUBLIC_KEY`)へ登録済み
   (この手順自体は「GitHub Secrets追加」に該当するため、独立した承認が必要)。
4. Backupの保管先(Production運用案)を決定済み([[reference-data-production-backup-design.md]]
   7章)。

## 2. Backup取得手順(本人が承認したタイミングでだけ実行する)

1. Production Supabaseへ、read-onlyの資格情報で接続する(書込み権限を持つ資格情報は
   使用しない)。
2. `backup-orchestrator.ts`の`createReferenceDataBackup`相当の処理を、対象4テーブル
   (`world_player_cards`・`managers`・`player_card_analysis`・`import_batches`)だけに対して
   実行する。
3. 生成されたmanifestを目視確認し、`assertManifestHasNoSecrets`相当のチェックが合格することを
   確認する。
4. `age`の公開鍵で暗号化する。
5. 暗号化前の平文(メモリ上のバッファ)を明示的に破棄する(ディスクへ書き出さない設計を維持する)。
6. 暗号化済みファイルのchecksumを計算し、manifestと突き合わせる。
7. 決定した保管先へアップロードする。
8. アップロード後、保管先から再取得し、checksumが一致することを確認する(storage checksum成功)。

## 3. Restore試験手順(Backup取得のたびに必ず実施する)

**Backupを取得しただけではProduction apply-readyにならない。** 以下を必ず実施し、
`restoreVerified: true`を確認する。

1. 別の空の隔離環境(隔離PostgreSQLのschema、または別データベース)を準備する。
2. 暗号化済みファイルを取得する。
3. 本人がローカルで、`age`の秘密鍵を使って復号する(復号はCI上では行わない)。
4. 復号したBackup本体をCIへ安全に渡す(または、CI上では復号せずローカルで完結する)。
5. `backup-restore.ts`の`restoreReferenceDataBackup`相当の処理を、その空環境へ対して実行する。
6. 件数・checksum・source metadata checksumがすべて一致することを確認する。
7. 一致しなければ、Backup自体を不合格として扱い、取得し直す(Restoreを一致するまで
   繰り返すのではなく、原因を特定してから再取得する)。

## 4. Production Backup gateの確認

[[reference-data-production-backup-design.md]]6章の17項目([[reference-data-production-backup-design.md]]
参照)がすべて`true`であることを確認してから、初めて`ProductionApplyIntent.backupConfirmed`を
`true`にできる。1項目でも未完了であれば、Production applyへ進まない。

## 5. 異常時の対応

- 復号に失敗した場合: 鍵の取り違え、またはファイル破損の可能性がある。**再試行を繰り返さず**、
  まず鍵とファイルの対応関係を確認する。
- checksum不一致の場合: Backup自体を信頼せず、原因(取得時のエラー、保管先での破損、
  意図しない改変)を特定してから再取得する。
- Restore失敗の場合: Production applyへ進まない。Backup方式自体の見直しを検討する。

## 6. 誠実な限界の開示

この手順書は設計段階のものであり、実際にこの手順どおりに実行して成功したことを示す記録は
まだ存在しない。実施した場合は、[[reference-data-backup-restore-validation.md]]と同様の形式で
別途実施記録を作成すること。
