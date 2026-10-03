# Next.js 16 移行計画（計画だけ・今回は更新しない）— 2026-10-04

## 現状
- next `^15.5.0`（実際は 15.5.27）・react / react-dom 19.0.0・App Router・RSC・streaming（loading.tsx・Suspense）・middleware（Supabase のセッション更新と内部ページの 404）・CSP（`img-src 'self' data: blob:`）・Supabase Auth（`@supabase/ssr`）。
- npm audit（2026-10-04）: high 8・moderate 1。
  - どれも build / dev の依存: tailwindcss → chokidar / fast-glob → micromatch → braces、eslint-config-next、next 内部の postcss。
  - 本番の配信経路では実行されない。
  - `npm audit fix` の非破壊の修正では解消しない。
  - Next 16 と Tailwind の更新で解消する見込み。

## 移行で確認すること
| 領域 | 確認 |
|---|---|
| 互換性 | Next 16 の breaking changes（middleware の名称・API、`next lint` の廃止 → ESLint CLI、画像の既定値、fetch のキャッシュの既定、params の非同期化の残り） |
| React | React 19 系の追従（`react@19.x` の最新）・hydration の差分（React #418 の観測を移行の前後で比較） |
| Streaming | loading.tsx・Suspense の挙動、`$RS` / `$RC` の差し替え（#418 の観測項目で比較） |
| Middleware | 内部ページの 404（status 404 のまま）・Supabase のセッション更新 |
| CSP / Security | ヘッダー 18 項目（公開 black-box の security）・source map 403・debug endpoint 404 |
| Auth | 既存のログインと新規登録の制限（limited）を壊さない |
| Build / Vercel | `next build` の出力・Vercel の build・Edge と Node の runtime |
| 依存 | eslint-config-next・@supabase/ssr・tailwindcss・postcss の対応版 |

## 手順
1. 専用 branch（`chore/next16`）。依存は Next・React・eslint-config-next・tailwindcss だけを動かし、他は固定。
2. codemod（`@next/codemod`）は差分を確認してから適用。lint を ESLint CLI へ移す。
3. 品質ゲート:
   - `npm run verify`・`npm run build`
   - 全 13 rails とローカル専用の 3 rails
   - 公開 black-box（Preview URL・8 viewport）・アクセシビリティの確認・PostgreSQL の検証
4. #418 の観測: 移行の前後で、同じ条件の cold load（probe）と 8 viewport の black-box を比べる。
5. Preview で 1 日観察 → 本番へ通常の merge。

## 戻し方
- revert の PR（lockfile ごと）→ Vercel の Instant Rollback（データは変わらない）。

## 見積もり
- 作業 1〜2 日。Preview での観察 1 日。

## 開始の条件
- v1.0 の公開後に新しい障害が 1 週間無い。
- 自動更新の最初の無人 Apply が applied_verified で記録されている。
- 本人の承認（依存の大きな更新）。

## 中止の条件
- 公開 black-box・security・内部ページの 404 のどれかが劣化し、原因が 1 日で特定できない。
- 認証・新規登録の制限が変わる。
- build が Vercel で再現性なく失敗する。
