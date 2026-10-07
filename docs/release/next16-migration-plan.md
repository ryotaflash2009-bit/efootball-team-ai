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

---

## 2026-10-07 の更新（計画だけ・今回も更新しない）

### 現状（2026-10-07 の main で確認）
- next 15.5.27・react 19.0.0・tailwindcss 3.4.17・eslint-config-next 15.5.27。
- npm audit: 全体 high 8・moderate 3。本番の依存だけ（`--omit=dev`）では high 1・moderate 1 で、どちらも next が同梱する postcss の advisory を継承したもの
  （分類と根拠は `docs/production-readiness/npm-audit-2026-10-07.md`）。sharp・source-map-js は非破壊の更新で解消済み（PR #165）。
- 初回の JS（`npm run build` の First Load）: 共有 104 kB。Home 約 122 kB・選手の詳細 約 169 kB・`/managers/compare` 131 kB・`/best-xi` 178 kB。
  本番の LCP 約 0.52 秒・CLS 0（2026-10-07 の計測）。

### 移行の後に「まだ必要か」を検証する安全策（契約）
Next 16 / React 19.x の更新の後、次の安全策を**外す前に**、それぞれの検証を Preview で行い、結果を Evidence に残す。
検証で不要と確認できたものだけを、別の PR で外す（移行の PR では外さない）。

| 安全策 | 入った理由 | 不要と判断する条件 |
|---|---|---|
| 日付の JST 固定の表示（PR #59）・#418 の修正（#129） | サーバー（UTC）と端末の時間帯の差で hydration が合わない（React #418） | cold load の probe と 8 viewport の black-box で #418 が 0（移行の前後で同じ条件・同じ回数） |
| `useSearchParams` を Suspense の中で使い、`force-static` を付けない（`/managers/compare`・2026-10-07） | `force-static` では静的の生成で `?ids=` が空になり #418 | `force-static` を付けた試験の build で `?ids=` 付きの cold load に #418 が出ない（出るなら現状を維持） |
| 画面の移動の watchdog（5 秒・RSC の応答の 1.5 秒後 + 通信の静止 0.5 秒の早い fallback、PR #166） | RSC の画面の移動が止まる事象（3 回観測・2.1〜3.4 秒で回復） | 移行の後の 1 日の観察で、watchdog の発火が 0 回（`navigation-fallback-v1.1.md` の計測の方法で） |
| タブの題名の `keepDocumentTitle`（MutationObserver・PR #182） | 画面の移動で Next.js が題名をサーバーの日本語へ戻す | 英語の表示で 16 画面を移動し、observer なしでも題名が戻らない |
| Web Analytics の遅延読み込み（`next/dynamic`・`ssr: false`、PR #162） | 初回の JS が 1.8 kB 増えた | 増分が 0.2 kB 未満なら通常の import でもよい（必須ではない） |
| middleware の内部ページの 404・Supabase のセッション更新 | 内部ページを公開しない・ログインの維持 | Next 16 の middleware（proxy）の名称・API の変更の後も 404 と session の更新が同じ（外すものではない・回帰の確認） |
| CSP（`img-src 'self' data: blob:` など 18 項目） | 公開の security black-box | 18/18 のまま（外すものではない） |

### 品質ゲート（移行の PR）
- `npm run verify`・TypeScript・ESLint（`next lint` の廃止のため ESLint CLI へ）・Production Build・Secret scan・npm audit（本番の依存の high が 0 になることを確認）。
- 公開 black-box（Preview・576 件）・アクセシビリティ 32 件・security 18 件・perf 14 件・release gate（`scripts/black-box-release-gate.mjs`・164 件）。
- 12 言語の表示（ja・en は公開、10 言語は RC のまま）・RTL の確認（ar-XB）。
- 初回の JS・LCP・CLS を上の数値と比べ、5% を超えて悪化したら原因を特定するまで merge しない。
- PostgreSQL の CI（参照データ・公開 ID の検証）。

### 開始の条件（更新）
- 自動更新の無人 Apply が applied_verified で記録されている（2026-10-07 に Secret を修正。最新の状態からの再検証の結果を待つ）。
- 毎時の検出の観察（2026-10-13 まで）が終わっている（移行の影響と区別するため）。
- 本人の承認（依存の大きな更新）。

### 中止の条件（追加）
- 上の安全策の検証で、移行の前に無かった #418・画面の移動の停止が出て、1 日で原因を特定できない。
- 本番の依存の npm audit の high が移行の後も残り、理由を説明できない。

### 戻し方（変わらず）
- 専用 branch `chore/next16`。revert の PR（lockfile ごと）→ Vercel の Instant Rollback（データは変わらない）。
