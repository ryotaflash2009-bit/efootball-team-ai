# 開発用「現実の今季成績」の正確性の確認（2026-10-31）

ローカルのサッカー AI（このPCの `127.0.0.1:7870` の `/player_form`・データは ESPN）を、選手の詳細の参考表示（内部ページを有効にしたビルドだけ）に使う前に、本人の指示（正確性と直近の情報を確認してから実装）で確認した結果。

## 1. 数値の正確性（独立した情報源との比較）

| 選手 | サッカー AI（ESPN・2026-10-31 取得） | 独立した情報源 | 判定 |
|---|---|---|---|
| Erling Haaland | Man City・2026-27 PL・8 試合・9 得点・0 アシスト | NBC Sports・FotMob（10-24 時点）9 得点・8 試合・0 アシスト | 一致 |
| Kylian Mbappé | Real Madrid・2026-27 LaLiga・10 試合・11 得点・2 アシスト | Yahoo Sports・FootyStats 11 得点・2 アシスト・10 試合 | 一致 |
| Mohamed Salah | Trabzonspor・2026-27 Süper Lig・9 試合・8 得点・3 アシスト | Al Jazeera・Vavel（移籍は 2026-08）8 得点・3 アシスト・9 試合 | 一致 |
| Rodri | Barcelona・2026-27 LaLiga | ESPN・Al Jazeera（2026-08 に Man City から移籍） | 一致（所属） |
| Lionel Messi | Inter Miami・27(2) 試合・25 得点・14 アシスト | 25 得点（10-17 時点）。アシストは情報源で 14〜15 | 得点は一致・アシストは情報源で揺れ |
| Alisson Becker | Liverpool・8 試合・失点 8・無失点 4 | FootyStats（10 月上旬）7 試合・失点 8・無失点 3 | その後の 1 試合の無失点と整合 |

取得はその都度（キャッシュなし）。`fetched_at` を画面に出す。

## 2. 見つかった問題と対策

| 問題 | 例 | 対策（`src/lib/dev/real-form.ts`） |
|---|---|---|
| 名前だけで探すため別人が返る | Roberto Carlos → Roberto Carlos Castro（Deportivo Quito）・Ronaldinho → Ronaldinho Diniz（米国）・Pedro → João Pedro・Danilo → Danilo Santos | 名前の完全一致（アクセント・大文字小文字を無視）と国籍の一致の両方を満たすときだけ出す。一致しなければ「一致しないため表示していません」 |
| 同じ名前の別の選手のカードがある | World に「Pedro」が Brazil と Spain の 2 人 | 国籍の一致を必須にする |
| 国籍の表記の違い | World「Korea Republic」・ESPN「South Korea」 | 別名の対応表 |
| 引退した選手は成績が空 | Paolo Maldini・Thierry Henry | 成績が空なら「見つかりませんでした」 |
| ESPN の見出しが未来の年 | Messi・Son の「2027 MLS Stats」（ESPN の表の行は 2026 MLS） | 見出しの年が今より先なら年を出さず、その旨を出す |
| 前のシーズンの成績 | （今回は該当なし） | 見出しのシーズンが今より前なら注意を出す |

## 3. 表示の範囲

- 内部ページを有効にしたビルド（`NEXT_PUBLIC_EFTA_INTERNAL_PAGES=enabled`）だけ。本番・Preview では API は 404・欄は出ない。
- ブラウザーからは読めない（サッカー AI の GET に CORS の許可が無い）ため、Next.js のサーバーの中から読む（`/api/dev/real-form`）。外部のサーバーへは送らない。保存しない。
- 診断・Tier・AI ベスト11 などの計算には使わない（参考の表示だけ）。
- ESPN のデータの利用条件は未確認。公開する場合は別に判断が必要。
