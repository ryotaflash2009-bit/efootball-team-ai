# Phase: 監督データ / 監督ブースター / Link-Up Play

作成日: 2026-08-28 / 外部調査: 8 リクエスト（robots.txt 2 + ページ 3 + GitHub API 1 + raw JSON 1 + WebSearch 1）

## データ取得元の調査

| サイト | robots.txt | 利用条件 / ログイン | データ構造 | 判定 |
|---|---|---|---|---|
| `www.efootballdb.com/ja/managers` | `User-agent: * / Allow: /*`（全許可・crawl-delay なし・AI 制限なし） | ログイン不要 | **JS SPA**。初期 HTML は「Loading...」。API エンドポイントは script タグ内で WebFetch からは不可視 | 自動取得は可だがデータ経路が特定できず → 今回は不使用（age/国籍/チーム/Coaching Affinity/フォーメーションの補完元候補として保留） |
| `amine250.github.io/efootball-managers/` | robots.txt なし（404 = 制限なし） | ログイン不要・GitHub Pages 静的サイト | データは GitHub リポジトリ `amine250/efootball-managers` の `data/managers.json`（**89監督・構造化済み**） | **採用**。`raw.githubusercontent.com` から JSON を1回取得 |
| eFHUB | `ClaudeBot / Disallow: /` | — | — | **アクセスしない**（RSC メッセージ `managerBoostPlusOne = "{stat} +1"` は既存資料から確認済み） |

- User-Agent 偽装・VPN・別IP・CAPTCHA 回避・認証回避 なし。Cookie/Authorization/APIキー 不使用。リダイレクト非追跡。

## `data/managers.json` の構造（採用ソース）

```
[{
  "id": "conte",                    // 監督カードの一意ID（同名別カードの識別子）
  "name": "Antonio Conte",
  "photo": "data/photos/conte.png",
  "releaseDate": "2026-08-13" | null,
  "boosterEffects": [ {"stat": "Defensive Awareness", "value": "+1"}, ... ],
  "teamPlaystyleProficiency": {
    "possessionGame": 68, "quickCounter": 90, "longBallCounter": 73,
    "outWide": 89, "longBall": 68, "overload": 69 | null
  },
  "linkUpPlay":  { "name": "...", "centerPiece": {"playingStyle","positions":[]}, "keyMan": {...} } | null,
  "linkUpPlays": [ { 同上 }, ... ]   // 複数の場合はこちら（linkUpPlay と排他的）
}]
```

## 監督ブースターの確認状態

| 項目 | 状態 | 根拠 |
|---|---|---|
| ブースター効果の形式 = 「対象能力 + N」（N は通常 +1） | **confirmed** | amine250 `boosterEffects` + eFHUB RSC `managerBoostPlusOne = "{stat} +1"` |
| 各監督の対象能力と上昇量 | **confirmed（サンプル照合済み）** | Antonio Conte: amine250 = Defensive Awareness +1 / Kicking Power +1、戦術適性 Poss 68 / QC 90 / LBC 73 / OW 89 / LB 68。→ 独立コミュニティソース（thc-efb.com / 検索合意）と**完全一致**。tactical proficiency も一致 |
| 適用順序（育成前 / 後） | **unresolved** | 未確認。エンジンは「基礎 → 育成 → 選手ブースター → **監督ブースター** → その他 → 上限」の固定加算で扱う（順序が判明したら差し替え可能な構造） |
| 適用条件（Link-Up Play の Center Piece / Key Man を満たす必要があるか） | **provisional** | boosterEffects は Link-Up Play とは別項目。ブースターは無条件、Link-Up Play は Center Piece / Key Man の選手を編成に入れると発動、とみられるが本アプリはブースターのみ適用し Link-Up Play は「情報表示」に留める |

## 実装方針

1. `managers.json`（89件）を SQLite の監督専用テーブルへ保存。既存 World / eFHUB データは変更しない。
2. `boosterEffects` の対象能力（表示名）を `stat_key_map.name_en` 経由で World キーへ変換。
3. 監督ブースターは **confirmed なので適用**（`ManagerContext` 経由で育成エンジンの `managerBoosterDelta` レイヤーへ）。
4. Link-Up Play / Center Piece / Key Man は **表示のみ**（能力値へは適用しない）。
5. age / 国籍 / チーム / Coaching Affinity / フォーメーション / 監督レーティングは amine250 に無いため null（`confirmation_status` に "not-in-source" を記録）。
6. 同名でも `id` / `releaseDate` / boosterEffects / tactical proficiency / Link-Up Play が異なれば別カードとして保存。名前だけの自動統合はしない。

## 代表監督（検証用）

| id | name | boosterEffects | Link-Up |
|---|---|---|---|
| conte | Antonio Conte | Defensive Awareness +1 / Kicking Power +1 | linkUpPlays × 2 |
| cfabregas | Cesc Fabregas | Lofted Pass +1 / Defensive Engagement +1 | linkUpPlay × 1 |
| xalonso1 | Xabi Alonso | Acceleration +1 | null（ブースターのみ） |

---

## 実装結果（2026-08-28）

- 外部アクセス: 合計 **10 リクエスト**（investigation 8 + 同期 fetch 2、初期上限10以内）。全件同期は 1 ファイル取得のみ（50回未満）。
- 同期: `node scripts/sync-managers.mjs` → **監督66件 / ブースター104 / 戦術適性396 / Link-Up Play 26 / 条件52**。同名別カード16組（Guardiola×2, Arteta×3, R.Martinez×3, Koeman×3, X.Alonso×3 等）を分離保存。
- 既存データ不変（world 13,009 / eFHUB索引 47,479 / eFHUB詳細 19）。integrity=ok / FK=0。
- 監督ブースターは confirmed（Conte を独立ソース照合で確認）→ 育成エンジンの `managerBoosterDelta` レイヤーへ適用。育成・選手ブースター・監督補正は別レイヤーで保持。
- Link-Up Play / Center Piece / Key Man は表示のみ（能力値へは適用しない、`confirmation_status='provisional'`）。
- age / 国籍 / チーム / Coaching Affinity / フォーメーション / 監督レーティングは amine250 に無いため NULL（「追加調査中」表示）。
- ルート: `/managers`, `/managers/[id]`, `/api/managers`, `/api/managers/[managerId]`。育成タブに `ManagerSelector`（検索/選択/変更/解除、配分は不変で監督レイヤーだけ再計算）。
