# 公開 API の濫用・CSRF の評価（NEW-39・2026-10-09）

検索への公開（2026-10-09 本人の正式決定）に合わせて、公開の API を見直した。

## 1. API の一覧

| 経路 | 方式 | 状態を変えるか | 認証の Cookie | 対策（今） |
|---|---|---|---|---|
| `/api/build-intent/extract` | POST | 変えない（AI 未設定で常に NOT_CONFIGURED） | 使わない | JSON の Content-Type 必須（別のサイトのフォームからは送れない）・スキーマ・文字数・プロセス内の連投制限・**別のサイトの Origin は 403（今回）** |
| `/api/world/players`・`/api/world/players/[id]`・`by-ids`・`/api/players*`・`/api/managers*`・`/api/percentiles/world-base`・`/api/data-status` | GET | 変えない | 使わない | 入力の検証（検索語の境界・ID の形・件数の上限）・CDN のキャッシュ（`public, max-age=60, stale-while-revalidate=300`） |
| `/api/world/player-image/[id]`・`/api/player-image/[id]` | GET | 変えない | 使わない | 許可したホストだけを中継・キャッシュ |

## 2. 評価

- **CSRF**: 状態を変える API・認証の Cookie を使う API が無い。唯一の POST も JSON 必須で、別のサイトからは CORS の事前確認で止まる。実害なし。多層防御として別のサイトの Origin を 403 にした。
- **読み取りの濫用**: 同じ URL は CDN が 60 秒キャッシュするため、同じ要求の繰り返しは Supabase に届かない。検索語を毎回変える濫用は届く。
  プロセス内のメモリでの制限はサーバーレス（複数のインスタンス）では効かないため、コードでの IP ごとの制限は入れない（効かない対策を「対策済み」と書かない）。
- robots.txt で `/api/` を disallow 済み（検索エンジンのクローラーは API を叩かない）。

## 3. 本人の操作（任意・無料の範囲）

- Vercel → Project → Firewall → Rules で「`/api/world/players` への同じ IP からの要求が 1 分に 120 回を超えたら 60 秒止める」ような Rate Limit のルールを追加する
  （プランで使えるかは Vercel の画面で確認。有料の契約はしない）。
- Supabase の Usage（API の要求数）を週に 1 回見る。急に増えたら知らせる。
