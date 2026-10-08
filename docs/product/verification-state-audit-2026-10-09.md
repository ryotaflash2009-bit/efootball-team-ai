# 「検証中・確認中・暫定」などの再監査（2026-10-09）

公開の画面の文言（`src/lib/i18n/dictionaries/ja-ns/*`・英語と追加の 10 言語は同じキー）を、現在のコード・テスト・データ・本番の表示から確かめ直した。
過去の報告は根拠にしていない。文言だけを消して問題を隠すことはしていない（計算・データ・テストを確認した上で、具体的な説明に変えた）。

## 1. 数

| 対象 | 件数 |
|---|---|
| 公開の画面の辞書で「検証中・確認中・暫定・準備中・開発中・対応予定」を含む文（2026-10-08 の開始時） | 64 |
| うち具体的な説明へ変えた（OUTDATED_TEXT_REMOVED / 置き換え） | 19（PR #202 で 8 キー・今回 11 キー。各 12 言語） |
| 残り（下の §3 で分類済み） | 45（37 キー） |
| 「候補」（75 件）・「推定」（52 件）・「未確認」（38 件） | 多くは状態ではなく内容（選考の候補・推定 OVR・証拠の段階）。§4 |

## 2. 変えたもの

| キー | 以前 | 今 | 分類 |
|---|---|---|---|
| progressionTab.targetsUnverifiedTag・ruGrStatsProvisional | 対象能力は検証中 | 対象能力は推定（説明つき） | VERIFIED_PARTIAL（Shooting だけ確認・9 カテゴリは公開の情報源なし。`progression-rules-evidence.md`） |
| progressionTab.groupsHint | 他は検証中 | 他のカテゴリは推定（ゲームの画面で未確認） | 同上 |
| progressionTab.anOvrByPosPending・*.totalOvrPlaceholder・playerControlColumn.currentOverallNote | 計算規則を確認中 | 公式の計算式が非公開のため計算しません | VERIFIED_NOT_IMPLEMENTED（公式の式が公開されていない） |
| progressionTab.pointsFormulaConfirmed | 消費は段階コスト（検証中） | 4 段階ごとに +1pt（確認済み） | VERIFIED_COMPLETE（PR #202 で規則を修正） |
| progressionTab.ruModeProvisional・*.calcModeProvisional | 検証中（暫定規則を使用）・暫定規則 | 推定値（能力ごとの上昇量は推定） | VERIFIED_PARTIAL（1 段階あたりの能力ごとの上昇量は公式の値が無い） |
| playerDetailPage.progressionHeading | 育成（検証中） | 育成 | OUTDATED_TEXT_REMOVED（推定の部分は中の表示で個別に示す） |
| comparisonTables.estimatedOvrLabel | 推定OVR（検証中） | 推定OVR（公式の計算式ではありません） | VERIFIED_PARTIAL |
| slotPlayerPanel.estimateNote | （推定・検証中） | （推定） | 同上 |
| linkUp.notice・managerPicker.linkUpNote・manager.linkUpPlayAvailable・managerDetail.linkUpHint | 効果は検証中 | 条件の照合だけ・ゲーム内の効果は未確認のため能力値に反映しない | VERIFIED_PARTIAL（発動条件の照合は実装済み・効果の値は公式に無い） |
| progressionTab.anRelativePending・anPhysNoteNoRanks | 相対評価は準備中 | 比べられる順位のデータが無いため表示しない | VERIFIED_NOT_IMPLEMENTED（データ元に順位が無い） |

## 3. 残したもの（分類と理由）

| キー | 分類 | 理由・次の行動 |
|---|---|---|
| boosterList.evidence_effect_provisional・progressionTab.boostEvidencePending・boostIconProvisional・boostFixedVerifying・boostFixedProvisionalPost・boostStageExternalProvisional・anExcludedNote・anTrialFormula・ruExWarning・ruListProvisional・ruPbMode*Desc・ruPbStandardNote・playerControlColumn.underVerificationNote・slotPlayerPanel.underVerificationNote・squadCompareBoard.provisionalNote | RELEASED（証拠の段階の正式な表示） | ブースターの効果の証拠の段階（`booster-list` の 5 段階）を示す名前。「効果検証中」は「外部の 1 ソースだけ・確認の例が足りない」という定義つきの段階で、標準の最終値には入れない。曖昧な作業中の表示ではない。段階が上がればデータの更新で自動的に変わる |
| progressionTab.ruCapUnconfirmedClamp | VERIFIED_PARTIAL | 最終の能力値の上限 99（育成・ブースター・監督の補正込み）の公式の確認が無い。99 で止める処理と、その理由を表示 |
| progressionTab.anInternalTraitsHeading・anSuitNoteEfhub・anPhysNoteRanks | VERIFIED_PARTIAL | eFHUB 由来の内部の値・副ポジションの適性の段階の意味は公式の説明が無い。値は表示し、意味の限界を説明 |
| progressionTab.underVerification・pointsFormulaUnverified | 通常は表示されない | 確認の状態が provisional のときだけの文言。ポイント総数は confirmed のため現在は出ない（コードの分岐として残す） |
| diagnosisPerspectives.badge・note・kindProvisional | VERIFIED_BLOCKED_OWNER_DECISION | F-045 の追加の観点（本人の判断待ち・`f045-decision-package.md`）。総合点・順位・共有画像に使わないことを明示した比較用の表示 |
| teamSummary.avgDisplayedOvrLabel | INDETERMINATE_REQUIRES_PRODUCTION_EVIDENCE | 表示 OVR の平均。公式のチームパワーの式との関係が公開されていない。説明の文（teamSummary の注記）で限界を示している |
| support.*Unset・notConfiguredNotice・releaseReadiness.contactStatusUnset | VERIFIED_BLOCKED_OWNER_ACTION | 問い合わせの窓口（メール・ドメイン）が未設定。ドメイン・SMTP の再開パッケージの後に本人が設定 |
| localDataMigration.notYetMigratableNotice | VERIFIED_BLOCKED_OWNER_DECISION | アカウント別の領域への移行は Auth の公開（本人の判断）の後 |
| myTeamCloud.checkingMessage・buildImportModal.validatingText・safetyMock.status_reviewing | RELEASED（処理中の表示） | 「確認中…」は読み込み・検証の処理中を示す一時的な表示（状態のラベルではない） |

## 4. 「候補」「推定」「未確認」

- 「候補」: Best XI の選考の候補・重複の確認の候補など、**内容としての候補**（未確定の機能ではない）。変えない。
- 「推定」: 推定 OVR・推定の対象能力・固定型（推定）など、**計算や判定が推定であることの正直な表示**。何が推定かを文で示している。
- 「未確認」: 証拠の段階・B2 の未確認の選択など、**データとして未確認であることの表示**。変えない。

## 5. 公開の画面に残る「検証中」の扱い

公開の機能そのものが未完成という意味の「検証中」は無くした。残る「効果検証中」はブースターの証拠の段階の名前（定義と説明つき）だけ。
それ以外は、何が確認済みで何が推定・未対応かを具体的に書いた。

## 6. 本人の判断・操作が必要なもの

- 育成カテゴリの対象能力（Shooting 以外の 9 カテゴリ）: ゲームの育成画面の記録（カテゴリごとに 1 枚）が必要（`progression-rules-evidence.md` §4）。
- F-045 の追加の観点の採用・問い合わせの窓口・アカウントの移行（Auth の公開）。

## 7. 追加の整理（2026-10-09・2 回目）

公開の画面に「検証中」という開発の状態の表示を残さないため、次の 14 キー（12 言語）も具体的な表現へ変えた。

| キー | 今 | 分類 |
|---|---|---|
| progressionTab.boostEvidencePending・boostIconProvisional・boostFixedVerifying・ruListProvisional・ruExWarning・ruExBullet2・ruPbModeExperimentalDesc・anTrialFormula・anExcludedNote | 「効果未確定」「効果が未確定の付属ブースター」 | RELEASED（証拠の段階の名前。定義つき） |
| playerControlColumn.underVerificationNote・slotPlayerPanel.underVerificationNote | 効果未確定・（比較に）不反映 | RELEASED |
| progressionTab.anInternalTraitsHeading | 内部特性値（段階の意味は公式に未公開） | VERIFIED_PARTIAL |
| progressionTab.underVerification（推定 OVR の横） | 公式の計算式ではありません | VERIFIED_PARTIAL |
| teamSummary.avgDisplayedOvrLabel | 平均 推定OVR（公式の計算式ではない） | VERIFIED_PARTIAL（値は各選手の推定 OVR の平均） |

残る「検証中・確認中」は次だけ:

| キー | 分類 | 理由 |
|---|---|---|
| buildImportModal.validatingText（ファイルを検証中です…）・myTeamCloud.checkingMessage（確認中…） | LOADING_STATE | 処理中の一時的な表示 |
| safetyMock.status_reviewing（確認中） | INTERNAL_PREVIEW | 内部の確認の画面（本番は 404）のモック |
| progressionTab.pointsFormulaUnverified | 表示されない分岐 | ポイント総数は confirmed のため現在は出ない |
| comparePage・comparisonTables・squadList・teamSummary・anPhysNoteRanks の説明文 | RELEASED | 「確認」は「照合した」の意味の説明文（状態の表示ではない） |

あわせて、保存ビルドの書き出しでコストの規則（`costRuleId`）が落ちていた不具合を直した（`canonicalizeExportBuild`）。読み込みも同じ関数を通るため、
現行の規則で保存したビルドを書き出し → 読み込みすると旧規則として扱われていた。テストで往復を確認。
