# 暫定のカード（PES Master・2026-10-15）

本人の指示「なんとしてでも最新の情報にアップデートし続けろ」「あらゆるサイトから読んでいい」を受けて追加した。
主の取得元（eFootball World）は 2026-10-08 以降の新しいカードを載せておらず、PES Master には 10/15 時点の注目カード 57 枚があった
（TeamAIXI には 0 枚）。自動の取得を許すサイトだけを使い、World に無い新しいカードを「暫定」として先に出す。

## 取得元の確認

| サイト | 自動の取得 | 結果 |
|---|---|---|
| eFootball World | robots.txt で許可 | 主の取得元のまま |
| **PES Master** | robots.txt `User-agent: * / Allow: /`・利用規約のページは無く、プライバシーポリシーにも自動の取得を禁じる文は無い | **補う取得元に採用** |
| PESDB | 利用規約 §3 で自動の取得・データベースの再構築を禁止 | 不採用 |
| eFHUB | robots.txt で禁止 | 不採用 |
| Game8 | robots.txt で AI・データの収集のクローラーを全面拒否 | 不採用 |

## 対応の確認（両方にある 66 枚・`scripts/lib/pesmaster-provisional.mjs`）

- 能力値 26 項目: 1,716 / 1,716 が一致。
- カードの種類・ポジション・利き足・プレースタイル（攻撃・守備）・チーム・国籍: 66 / 66。
- スキル（名前の集合）: 60 / 66。残りは PES Master の選手のデータに無い新しいスキル（Shadow Hunt・Snap Strike）と World の欠け（"-"）。
- 年齢は 10 枚で PES Master が 1 つ上（誕生日の反映）。基本の OVR は 8 枚で ±1。暫定なので PES Master の値を使う。
- リーグ・地域は PES Master の表記が World と違うため、同じチーム・国籍の World のカードから引く。
- 最大レベルは PES Master では利用者の投稿で、新しいカードは 0（不明）→ null（育成の計算は出さない）。投稿されたら取り込み、`max_level_source = pesmaster_user_submitted` と記録する。
- 最大 OVR・日本語名・画像・ブースター・体格（appearance）は持たない（null）。

## 仕組み

- データ: `src/lib/reference-data/provisional/data/provisional-cards.json`（`reference_data.world_player_cards` と同じ形の行）。
  **DB には書かない**（World の自動更新の計画・差分・checksum・権限に一切触れない。DB に入れると「上流に無い行」として World の自動の反映がすべて止まるため）。
- 同期: `.github/workflows/reference-data-provisional-cards.yml`（毎時 2 回・7 分と 37 分・2026-10-25。GitHub の schedule の欠落は detection watchdog が 2 時間を超えたら起動して補う）→ `scripts/provisional-cards-sync.mjs`。
  PES Master の注目カードのページ → World に無い ID だけカードのページを読む（2 秒あけ・1 回 80 枚まで・最大レベルが不明なものは 24 時間ごとに取り直す）→
  JSON を main へ commit（Vercel が本番に反映）。World に載った ID は外す。Apply の実行中は何もしない。push の前に契約のテスト。Secrets なし。
- アプリ: World に無い ID は暫定のカードで補う（詳細・by-ids）。World にあれば常に World を優先。一覧（/players）は World だけで、
  「新しいカード（暫定）」（/players/new）とホーム・選手一覧からの案内で出す。暫定のカードの詳細は noindex。画面に「暫定」の印と説明。
- 停止: リポジトリの変数 `REFERENCE_DATA_PROVISIONAL_CARDS_DISABLED` を `true`（JSON はそのまま残る。消すときは cards を空にする PR）。

## 精度（2026-10-16・暫定から正式なデータに置き換わった 57 枚と比べた実測）

| 項目 | 当初（#281） | 改善後（同じ 57 枚で作り直した結果） |
|---|---|---|
| 能力値 26・カードの種類・ポジション・利き足・プレースタイル・チーム・年齢・身長・体重・AI のプレースタイル | 57 / 57 | 57 / 57 |
| 国籍 | 52 / 57（Turkey・Czech Republic の表記） | **57 / 57** |
| 地域 | 52 / 57 | **57 / 57** |
| リーグ | 56 / 57（昇格したばかりのチーム） | **57 / 57** |
| 日本語名 | 0 / 57（持たない） | **36 / 57**（同じ人物の既存のカードがあるもの・36 枚すべて正しい。初登場の選手は英語名のまま） |
| 基本の OVR | 56 / 57 | 56 / 57（PES Master の計算の ±1。直せない） |
| スキル | 54 / 57 | 54 / 57（PES Master に無い新しいスキル: Attacking Surge・Shadow Hunt。直せない） |
| 最大レベル | 不明 | 不明（推測しない・投稿されたら取り込む） |

改善の方法:
- 同じ人物の別のカード（人物のキー＝カード ID の下位 20 ビット・食い違い 0 件の規則）から日本語名・国籍・地域を引く。
- 表記の対応（国籍・リーグ）を、正式なデータに置き換わったカードと比べて自動で学ぶ（JSON の `aliases`）。初期値は確認済みの Turkey→Türkiye・Czech Republic→Czechia。
- リーグは同じチームの既存のカード → 学んだ対応 → 同じ名前のリーグの順で引く。
