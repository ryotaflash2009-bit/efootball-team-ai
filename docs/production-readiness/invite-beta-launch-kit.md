# Invite-only beta — launch kit (prepared 2026-09-25)

Everything up to sending the URL is prepared here. **Claude Code never sends the URL, never removes
noindex and never makes the site public.** Sending the URL, the final legal wording and the beta end
date are owner decisions.

## 1. Release readiness (public site, read-only checks)

| Item | State |
|---|---|
| World cards | 13,297 (World import 2026-09-25 18:21 JST, applied_verified) |
| Managers | 67 (import 2026-09-24 19:31 JST, applied_verified) |
| Player card analysis | 19 (unchanged) |
| Scheduled update detection | weekly, Mondays 03:17 JST; upstream only; never applies anything |
| Indexing | noindex meta and `X-Robots-Tag` on every response, robots `Disallow: /`, sitemap 404 |
| Internal pages | 404 |
| Release Gate | browser gate desktop and mobile, black boxes, console, network, 5xx and overflow 0 (`evidence/public-release-gate-after-world-update-2026-09-25.json`) |
| Performance | desktop `/players` fixed in PR #69 (warm 910 ms, was 3.8–6.4 s); severe issues 0 (`evidence/players-performance-2026-09-25.json`) |
| Physical ranking | totals are labeled "順位集計時点の全 13,009 件中" (ranking-time snapshot, not the current 13,297) |
| Stop procedure | `invite-beta-stop-procedure.md` |

## 2. Beta limitations (already stated on the Support page)

- Invite-only, free, not indexed by search engines, not a public release.
- Unofficial; not affiliated with KONAMI or eFootball.
- World data is imported manually after checks and may lag behind the game.
- No promise of a public release or of continued availability; features may change.
- Browser data lives in your browser; "データ管理" deletes it. For account deletion, use the support contact.
- Never send passwords, verification codes, payment details, unnecessary personal data or private
  screenshots to the contact.
- Legal pages (terms, privacy, disclaimer) are **drafts for the invite-only beta**. A formal legal
  review is required before any public release or payment.

## 3. Beta end date (proposal, owner decides)

- Proposed first beta period: **until 2026-10-31 (JST)**. It is not shown on the site yet. If you
  confirm it, it goes into the friend message below, and Claude Code can add it to the Support page in
  a small PR.

## 4. Owner acceptance test (phone and PC, about 15 minutes)

On both a phone and a PC:
1. Home: the World count shows 13,297 and the World import date shows 2026年9月25日.
2. Players: search a name you know (e.g. メッシ), filter by position, open one card → the detail shows
   stats, progression and physical data ("順位集計時点の全 13,009 件中").
3. Compare: add two players.
4. Managers: search one manager; the list shows 67.
5. Squads / Best XI: open each page; nothing breaks.
6. My Team / My Builds without logging in: the pages explain what needs an account; no errors.
7. Support / 利用規約 / プライバシー / 免責事項 / データ管理: the pages open and read correctly.
8. Subjective: text size, tap targets, scrolling and speed feel acceptable.

If something feels wrong, note the page, device and what you did, and send it to Claude Code.

## 5. Message to friends (draft, Japanese — owner sends it)

> eFootballの選手・監督データを見たり、比較・育成・スカッド作りを試せる個人開発サイトの
> 招待制ベータを始めました。よかったら触ってみて、感想を教えてください。
>
> URL: <公開URL>
>
> - 招待した人だけに共有しています（検索には出ません）。URLの転送はしないでください。
> - 無料です。非公式のファンサイトで、KONAMI・eFootball公式とは関係ありません。
> - Worldの選手データは確認してから手動で更新しているので、ゲームより遅れることがあります。
> - ベータ期間は<終了日>までの予定です。内容は変わることがあり、提供の継続は保証できません。
> - パスワード、認証コード、支払い情報、個人情報は送らないでください。
>
> 感想は下のテンプレで気軽に送ってください。

## 6. Feedback template (for friends)

```
・使った端末: スマホ / PC（機種・ブラウザ）
・見たページ: 例) 選手一覧、選手詳細、比較、スカッド、監督
・よかったところ:
・分かりにくい／使いにくいところ:
・不具合（あれば）: 何をしたら、何が起きたか
・欲しい機能:
※ パスワード・認証コード・支払い情報・個人情報は書かないでください
```

## 7. Temporary-file cleanup record (2026-09-25)

| Folder | Deleted | Method |
|---|---|---|
| `./data/stagew/` (World rehearsal summaries and rail logs) | 18 files + 6 folders | fixed allowlist, one by one; no wildcard or recursive delete |
| `./data/detect1/` (detection summary download) | 1 file + folder | same |
| `./data/stage6/` + `./data/.public-url.txt` (public gate scripts, logs, measurements) | 13 files + folder | same; checked: not tracked, no symlink or reparse point, no secrets (the only "password" hits were the route names `/auth/forgot-password` and `/auth/update-password` in a build log) |

`./data` itself is kept. Official Evidence, Backups and R2 objects were not touched.
