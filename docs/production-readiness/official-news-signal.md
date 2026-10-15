# 公式のお知らせの合図（2026-10-15）

本人の指摘（「13 日から更新が止まっていた」）と承認（「いいよ」）を受けて追加した。検出が動いていても取得元（eFootball World）が
新しいカードを載せなければ反映できないため、公式のお知らせを「新しいデータが出た合図」として使い、取得元の遅れに早く気づく。

## 取得元の候補の確認（2026-10-15・GET は合計 9 回・選手データは取得していない）

| 候補 | 結果 |
|---|---|
| eFootball World（今の取得元） | 続ける（robots.txt で許可・調査は `docs/efootball-world-data-investigation.md`） |
| PESDB（pesdb.net） | **使えない**。robots.txt に禁止は無いが、利用規約（2026-10-04 施行）§3 が自動の取得・データベースの再構築を禁止し、許可・データの提供もしないと明記 |
| eFHUB（efhub.com） | **使えない**。robots.txt で禁止（回避しない・安全規則 §11） |
| KONAMI 公式のお知らせ | データの取得元にはならない。合図として使う。robots.txt（www.konami.com → img.konami.com/robots.txt）は eFootball のページを禁止していない。見つかった規約は「eFootball™ コンテンツ利用規約」（ゲームの利用・内容の無断の複製や転載・自動操作ツールを禁止）で、Web ページを読むことを禁じるサイトの利用条件は見つからなかった |

## 仕組み

- workflow: `.github/workflows/reference-data-official-news-signal.yml`（6 時間ごと・手動も可）。script: `scripts/official-news-signal.mjs`。
- 読むのは `https://www.konami.com/efootball/ja/topic/news/list` だけ（GET 1 回・20 秒で打ち切り・リトライなし）。
  ページに埋め込まれた `newsData` の JSON から番号・掲載日時（JST）・分類を読み、題名はデータに関わるか（LiveUpdate・アップデート配信・
  スペシャル選手リスト・新アイテム など）の判定にだけ使う。題名・本文は保存も転載もしない（Issue には番号の URL と日付だけ）。
- 判定: データに関わる最新のお知らせから **3 日** たっても、applied-state の `maxAppearanceUpdatedAt`（TeamAIXI に反映済みの最も新しいカード）が
  その掲載より古ければ、通知の Issue（ラベル `reference-data-update`）にコメントする。1 日に 1 回まで。自動では何も適用しない。
- 限界: お知らせの一覧はアップデート・LiveUpdate・告知が中心で、毎週のすべての新しいカードが載るわけではない。7 日の
  「取得元が更新されていません」の知らせ（`hourly-detection.md`）と組み合わせて使う。

## 2026-10-15 の状態

データに関わる最新のお知らせは 10/08 の LiveUpdate とバージョン 6.1.0 のアップデート（#5933・#5930）。取得元・反映済みの最も新しいカードも
2026-10-08T17:01Z で、公式のお知らせに対しては遅れていない（判定 `source_caught_up`）。10/15 の 6.1.1 はパッチ（不具合の修正）。
