# World のカードの件数の定義（13,009 と 13,372・2026-10-11）

不具合ではなく、**どのデータを数えたか**の違い。

| 件数 | 何の件数か | いつ | 確認の方法（読み取りだけ） |
|---|---|---|---|
| **13,009** | ローカルの SQLite（`data/efootball.db` の `world_player_cards`）。最初の取り込みのスナップショット（取得 2026-08-27） | 2026-08-27 から更新していない（ローカルの開発用） | `node -e "const D=require('node:sqlite');console.log(new D.DatabaseSync('data/efootball.db',{readOnly:true}).prepare('select count(*) n from world_player_cards').get())"` |
| **13,372** | Production（Supabase の `reference_data.world_player_cards`・既定のデータの取得元） | 2026-10-03 の更新から（10-07 は既存のカードの更新だけ） | `https://efootball-team-ai.vercel.app/api/world/players?pageSize=1` の `totalCount`・ホームの「World のカード」・`sitemap.xml` の選手の詳細の URL の数 |

Production の件数の推移（`reference-data-applied-state.json` の履歴・Evidence）:

| 日付 | 件数 | 差 | Evidence |
|---|---|---|---|
| 2026-08-27 | 13,009 | 最初の取り込み | ローカルの SQLite と同じ |
| 2026-09-25 | 13,297 | +288（追加） | `stage4-world-rehearsal-2026-09-25.json` |
| 2026-09-26 | 13,297 | 0（既存の更新） | `world-update-2026-09-26.json` |
| 2026-10-03 | 13,372 | +75（追加） | `world-update-2026-10-03.json` |
| 2026-10-07 | 13,372 | 0（既存の 16 件の更新） | `world-auto-apply-2026-10-07.json` |

- 差の 363 件 = 288 + 75 件の**追加**。削除は 0（更新の規則で、上流から消えたカードがあれば自動では適用せず停止する）。
- 2026-10-11 の Production の確認: API の `totalCount` 13,372・ホームの表示 13,372・sitemap の選手の詳細 13,372 件（一致）。
- 同じ選手の判定（カード ID の下位 20 ビット）の監査: ローカル 13,009 枚・本番 13,372 枚のどちらも食い違い 0（`same-player-rule.md`）。
  新しいカードが加わった更新の後は `BASE_URL=https://efootball-team-ai.vercel.app node scripts/audit-person-identity.mjs` で確かめ直す
  （食い違いが出たら `PERSON_KEY_CONFLICT_EXCEPTIONS` にそのキーを入れる。規則全体は止めない）。

注意:
- ローカルの開発（`WORLD_DATA_SOURCE=sqlite`）の画面は 13,009 件のまま。Production と同じ件数で確かめたいときは Supabase の取得元（既定）を使う。
- `/api/data-status` はワールドのカードではなく、旧来の eFHUB のサンプル（Git の対象外・Vercel には無い）の件数を返す内部の API で、Production では 0 件になる。
  画面からは使っていない。World の件数の確認には使わない。
