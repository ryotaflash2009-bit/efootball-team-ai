# 追加の 10 言語の技術の状態（2026-10-08）

**公開の状態は変えていない**（ja・en だけ公開。10 言語は `RELEASE_CANDIDATE`・ネイティブのレビュー前）。
ここに書くのは、ネイティブのレビューなしで確かめられる技術の確認の結果だけ。`VERIFIED_NATIVE_QUALITY`・`PUBLISHED` にはしない。

## 確認の方法

- 多言語の black-box（内部の確認の build・`NEXT_PUBLIC_EFTA_INTERNAL_PAGES=enabled`・ローカルだけ）: 10 言語 × 390×844・1280×720 × 25 画面・操作。
  見たもの: `lang` 属性・日本語の混入・英語の混入（訳の違う英語の文が画面に残っていないか）・横のはみ出し・切れ・保存の言語の維持・
  共有カード 4 比率（3:4・1:1・9:16・16:9、PNG の大きさとファイル名）・サインイン / 登録の案内・データ管理・問い合わせ・利用規約の英語の代替の案内。
- 結果: **500/500**（初回 494/500。6 件は検出器の誤検知: fr / de の「Standard」・id の「Pressing」はその言語でも正式な訳として使われている外来語。
  検出器を「その言語の訳として使われている語は英語の混入に数えない」に直し、fr・de・id を再実行して 150/150）。
- 辞書の監査: 網羅の監査 PASS（差し込みの不一致 0・日本語の混入 0・秘密らしい値 0）・キーの監査 PASS・固定の用語（Link-Up Play・OVR）45,420 件で違反 0・
  RTL の位置の監査（論理化の残り 0）・複数形（2026-10-08 に en・es・pt-BR・fr・de・it を修正。画面に ICU の書式が出ないことを確認）。
- 検索: アクセント・ß・トルコ語の İ/ı・全角を同じに扱う（PR #167 の規則のまま。名前の翻訳・別名は作らない）。

## 言語ごとの最終の状態

| 言語 | 状態 | black-box | 共有カード 4 比率 | 備考 |
|---|---|---|---|---|
| es | RELEASE_CANDIDATE（REVIEW_REQUIRED） | 50/50 | 可 | 複数形を追加（技能・項目・先発・控え） |
| pt-BR | RELEASE_CANDIDATE（REVIEW_REQUIRED） | 50/50 | 可 | 複数形を追加 |
| fr | RELEASE_CANDIDATE（REVIEW_REQUIRED） | 50/50（再実行） | 可 | 複数形を追加・コロンの前の改行しない空白（U+00A0）を維持 |
| de | RELEASE_CANDIDATE（REVIEW_REQUIRED） | 50/50（再実行） | 可 | 複数形を追加（除外の件数） |
| it | RELEASE_CANDIDATE（REVIEW_REQUIRED） | 50/50 | 可 | 複数形を追加（先発） |
| ko | RELEASE_CANDIDATE（REVIEW_REQUIRED） | 50/50 | 可（ハングルの字形・ファイル名） | 複数形の区別なし |
| zh-CN | RELEASE_CANDIDATE（REVIEW_REQUIRED） | 50/50 | 可（簡体字の字形） | 複数形の区別なし |
| zh-TW | RELEASE_CANDIDATE（REVIEW_REQUIRED） | 50/50 | 可（繁体字の字形） | 複数形の区別なし |
| id | RELEASE_CANDIDATE（REVIEW_REQUIRED） | 50/50（再実行） | 可 | 複数形の区別なし |
| tr | RELEASE_CANDIDATE（REVIEW_REQUIRED） | 50/50 | 可（ğ・ş・İ・ı の字形・ファイル名） | 数の後は単数形（トルコ語の規則どおり） |

`BLOCKED_BY_TERMINOLOGY`・`BLOCKED_BY_LAYOUT`・`BLOCKED_BY_FONT` の言語は無い。公開に残るのはネイティブのレビュー（P0: 保存・削除・復元・読み込み・
書き出し・エラー・警告・プライバシー・問い合わせ → P1: 診断・育成・能力・弱点・改善・監督の戦術・共有カード → P2）と本人の公開の判断だけ。

Evidence: `docs/i18n/evidence-ml-blackbox-2026-10-08.json`（初回の 500 件。fr・de・id の再実行は 150/150）。
