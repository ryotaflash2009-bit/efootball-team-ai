# 翻訳の管理（Translation management）— 2026-10-06

外部の翻訳管理サービス・有料の契約は使わない。すべてこのリポジトリの中で管理する。

## 1. ファイル

| ファイル | 内容 |
|---|---|
| `src/lib/i18n/locale-registry.ts` | 実行時の状態（どの言語を選べるか）。**正** |
| `docs/i18n/locale-status.json` | 言語ごとの記録: state・quality・machineAssisted・nativeReview・reviewedBy・reviewType・owner・lastUpdated・sourceLocaleVersion・knownIssues。registry と一致すること（監査） |
| `src/lib/i18n/dictionaries/locales/<code>.ts` | その言語の辞書（一部のキーだけ・`PartialDictionary`。型で元に無いキーを防ぐ） |
| `src/lib/i18n/dictionaries/locales/<code>.source.json` | 翻訳したときの元（English）の値の hash（キーごと） |
| `docs/i18n/terminology-glossary.md` | 用語集（版: `glossary-YYYY-MM-DD`） |
| `docs/i18n/coverage.{json,md}` | 自動生成の coverage（`node scripts/audit-locale-coverage.mjs`） |

## 2. 状態

- 言語の状態（registry・locale-status の `state`）: `INTERNAL_DRAFT` → `MACHINE_DRAFT` → `REVIEW_REQUIRED` → `RELEASE_CANDIDATE` →
  `PRODUCTION_READY` → `PUBLISHED`（`SUSPENDED` で一時停止）。言語の選択に出るのは `PUBLISHED` だけ。
- 翻訳の品質（locale-status の `quality`）: `VERIFIED_NATIVE_QUALITY`（ネイティブの確認済み）/ `VERIFIED_REVIEWED`（人のレビュー済み）/
  `MACHINE_DRAFT_ONLY`（機械・AI の下書きだけ）/ `INCOMPLETE` / `BLOCKED_BY_TERMINOLOGY`。
- **公開の条件**: quality が `VERIFIED_REVIEWED` 以上・`reviewedBy` の記録・core・公開画面・アクセシビリティ・エラー/空/読み込み・
  metadata・共有カードの coverage 100%・stale 0・監査の失敗 0・その言語の多言語 black-box の合格。法務文書の状態の明示。
- AI・機械の翻訳を使った場合は `machineAssisted: true`。ネイティブの確認なしに `VERIFIED_NATIVE_QUALITY` にしない（監査で失敗にする）。

## 3. 元の変更の検出（stale）

1. 翻訳・レビューの後に `node scripts/audit-locale-coverage.mjs --record <code>` で、その時点の English の値の hash を記録する。
2. English（または、それと対応する日本語）の値が変わると、監査がそのキーを `stale` として数える（その言語は公開の条件を満たさない＝要レビュー）。
3. レビューして訳を直したら、もう一度 `--record` する。

## 4. 監査（`scripts/audit-locale-coverage.mjs`）

失敗: 元に無いキー・差し込み（`{name}`）の不一致・制御文字・日本語の混入（中国語は仮名だけ）・危険なリンク・秘密らしい値・
HTML のタグの数の不一致・状態の記録と registry の不一致・公開の言語の条件の不足。
報告: 面ごとの coverage・English と同じ値の数・stale・長すぎる訳（元の 3 倍超かつ 40 文字超）。
CI では `src/lib/i18n/locale-coverage-audit.test.ts` が `--check` を実行する。

## 5. 固有の用語の契約（Link-Up Play・OVR）— 2026-10-07 本人の判断

- **Link-Up Play**（短いラベルは「Link-Up」）と **OVR** は、データ元で各言語の正式な表記を確認できるまで、全言語で原語のまま使う。
- 現地語の短い補足は Tooltip・初回の説明に限り、原語と並べて付けてよい（例: `OVR (valoración general)`）。原語の代わりにはしない。
- AI の訳を正式なゲーム内の名称として扱わない。原語で検索できる状態を保つ（検索は原語の名前のまま）。
- 監査: `node scripts/audit-fixed-terms.mjs`（辞書・生成文の表の全言語）。回帰テスト: `src/lib/i18n/fixed-terms.test.ts`（CI）。
  English の原文に用語がある文は訳にも同じ原語が必要。原語なしの現地語の候補（juego combinado・Kombinationsspiel・연계 플레이・联动配合・
  MED・GER・GEN・GES・CMP など）は違反。
- 正式な現地語の表記が確認できた場合: データ元（URL・取得日）を用語集に記録し、`scripts/lib/fixed-terms.mjs` の契約を言語ごとに更新する。
