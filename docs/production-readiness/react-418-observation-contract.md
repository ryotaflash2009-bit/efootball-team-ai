# React #418（hydration の不一致）の観測契約 — 2026-10-03

状態: **観測中（未解決）**。既知の問題 `KI-REACT-418-INTERMITTENT`。

## 1. これまでの観測

| 日付 | 画面 | 状況 |
|---|---|---|
| 2026-10-01 | `/best-xi`（mobile・warm） | 1 件 |
| 2026-10-02 | `/managers`（desktop 1280・mobile 390・cold） | 各 1 件。同時に `Cannot read properties of null (reading 'parentNode')`。文書は `x-vercel-cache: MISS`・age 0（新しい server render。CDN の配信のずれではない） |
| 2026-10-02 夜 | 本番 2 viewport の総合 black-box | 0 件 |
| 2026-10-03 | `/players/world/<id>`（desktop 1280・cold）・本番 8 viewport の総合 black-box で 1 件 | **新しい観測項目で初めて記録**: 文書は `MISS`・age 0・地域 kix1>iad1・`x-matched-path /players/world/[worldCardId]`・26,571 バイト。`parentNode` の例外の位置は文書の中の **`$RS`**（segment の差し替え）。読み込み後の streaming の状態は `B:` template 0・`S:` segment 0・`$RC` あり（差し替えは終わっている） |

再現しなかった試行: 105 回の再読み込み（10-01）・`/managers` の cold load 30 回・同じ観測スクリプトでの 24 回（10-02）。
コードの確認: `/best-xi`・`/managers`・共通の殻に、描画時の日時・乱数・locale・storage の差は無い（`formatDateTime` は時刻帯を固定）。

## 2. 観測で記録すること（公開 black-box・PR #97・#109）

hydration のエラー（#418・#423・#425・`did not match`）が出た読み込みだけ、次を記録する。

| 項目 | 内容 |
|---|---|
| 文書の配信元 | `x-vercel-cache`・`age`・`x-nextjs-cache`・`etag` の先頭 24 文字・Vercel の地域（request id は残さない）・`x-matched-path`・protocol・文書のバイト数 |
| 例外の位置 | 上位 3 つの呼び出し位置（同じ origin のパスと行・列・関数名） |
| streaming の状態 | 差し替え待ちの `B:` template の数・隠れた `S:` segment の数・`$RC` の有無・script の数・`<main>` の数 |
| 何回目の読み込みか | cold / warm と番号 |

記録しないもの: 本文・HTML・API の本文・利用者のデータ・request id。

## 3. 判定

| 状態 | 条件 |
|---|---|
| 観測中 | 直近の本番の総合 black-box（8 viewport）で 1 件以上、または観測回数が下の基準に届かない |
| **解決とみなす** | 本番の総合 black-box（8 viewport）を **3 回連続で 0 件**（別の日・別のデプロイを含む）。かつその間に関係するコードの変更がない |
| 原因の調査へ進む | 1 回の総合 black-box で 2 件以上、または同じ画面で 2 回続けて出た。§2 の記録（streaming の状態・例外の位置）から、境界の差し替え（`$RC`）が失敗したかを判断する |

2026-10-03 の記録で、`parentNode` の例外は `$RC` ではなく **`$RS`**（遅れて届いた segment を placeholder へ移す inline script）から出ていた。
#418 で React が server の DOM を捨てて client で描き直した後に、遅れて届いた `$RS` が移す先を見つけられずに失敗した、という順序と一致する。
つまり `parentNode` は**結果**で、原因は #418 の不一致そのもの（cold・`MISS` の新しい server render だけで起き、warm では出ていない）。
次の調査: 同じ画面を cold で非圧縮の build（`next build` の profiling / dev）で開き、#418 の差分（server と client の HTML）を取る。
対象の候補は、cold の server render と client で値が変わりうるもの（取得の時刻・件数・データの読み込み順）。

## 4. 記録の場所

- 各回の結果: `docs/production-readiness/evidence/*.json` の `knownIssues` と `qualityGate.publicProduction`。
- 0 件の回も数える（3 回連続の判定に使う）。
