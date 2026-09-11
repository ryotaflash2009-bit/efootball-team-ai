# Fix: スカッドへ選手を追加しても反映されない

修正日: 2026-08-30 / 外部アクセス: 0 / SQLite 書き込み: 0

## 症状

`/squads/{squadId}` で空き枠に選手を追加しても、ピッチに表示されず先発 0/11 のまま。
平均 OVR「—」、カテゴリ平均 0、警告「先発が 0/11 人です」が残る。**ページ再読込でも復元されない。**
ピッチ枠・ベンチ・My Team 導線のすべての追加経路で発生。

## 根本原因

`src/components/squad/SquadEditor.tsx` の「配置カード詳細取得」`useEffect` の**自己キャンセル**。

```
useEffect(() => {
  let cancelled = false;
  for (const id of placedIds) {
    if (cards[id]) continue;
    setCards((c) => ({ ...c, [id]: "loading" }));   // ← cards を更新
    fetch(...).then((data) => { if (cancelled) return; setCards(...) });
  }
  return () => { cancelled = true; };
}, [placedIds, cards]);   // ← cards が依存配列に入っている
```

- `setCards(..., "loading")` が依存配列の `cards` を変更 → **同じ effect が cleanup（`cancelled = true`）＋再実行**。
- その後に `fetch` が解決すると `cancelled === true` のため**取得結果が破棄される**。
- `cards[id]` は `"loading"` のまま固定 → `makeEntry()` が `null` を返す → `buildSquad` はそのスロットを未配置扱い。
- `squad`（＝ `worldCardId`）自体は state に入り自動保存もされるが、`cards` が解決されないため
  再読込しても同じ経路で再びキャンセルされ、永久に表示されない。

`cards` が依存に入っていたのは `if (cards[id]) continue;` を読むため（exhaustive-deps 対応）。

## 修正

1. **`SquadEditor.tsx` の取得ロジックを `resolveCard(id)` に分離**（`useCallback([])` で安定）。
   - 二重要求の抑止は `requestedCardsRef`（`useRef<Set<string>>`）で判定 → `cards` を依存に入れない。
   - `cancelled` フラグを廃止（abort しない）。取得成功は常に反映。失敗時のみ ref から外して再試行可能に。
   - effect は `[placedIds]` のみに依存。
2. **解決状態の可視化**（§10）: 配置済みだが未解決のカードを「読み込み中」/「取得失敗（再試行）」として表示。
   選択中スロットのパネルも、`worldCardId` がある限り「空き枠」とは別表示。`worldCardId` は消さない。
3. **配置処理を単一の純関数へ**（§9）: `src/lib/squad/assign.ts`
   - `assignWorldCardToSlot(squad, slotId, worldCardId)` / `addWorldCardToBench(squad, worldCardId, makeSubId)`。
   - `worldCardId` は数字文字列のまま（`WORLD_CARD_ID_RE = /^[0-9]{1,20}$/`、Number 化しない）。
   - 重複配置・スロット占有・ベンチ満員・不正 ID を errorCode で返す。他スロット/監督/比較/条件設定を保持。
   - `SquadEditor` の `placeInSlot` / `addBench` はこれを呼ぶだけ（`squadRef` で最新 state を検証）。
4. **保存データの部分破損耐性**（§25）: `squad-storage.ts` の `readStore` を要素ごと検証に変更。
   - スカッド 1 件が壊れても他は読める（全消ししない）。
   - `storedSlotSchema` の不正 `worldCardId` は `null` に、`slotId` は緩め（`normalizeSquad` が再照合）。
5. **My Team → スカッド導線**（§14）: `/squads?card={worldCardId}`
   - 一覧: 各スカッドに「このカードを追加」→ `/squads/{squadId}?card={id}`。
   - 編集: `pendingWorldCardId` を受け取り、**開いただけでは配置しない**。追加候補バーを表示し、
     空き枠タップで検索を挟まず直接配置 → `router.replace` で `?card=` を消費。「やめる」「ベンチに追加」も可。

## テスト

- `src/lib/squad/assign.test.ts`（14件）: 配置・重複・占有・不正 ID・大きな worldCardId・全スロット ID 受理・ベンチ。
- `src/lib/squad/squad-storage.test.ts`（+3件）: 配置 → 保存 → 再読込で残る／20 桁 ID の精度／1 スロット破損時の他スロット保持。
- `scripts/black-box-squads.mjs`（30 → 34件）: `?card=` 導線（一覧・編集・不正値）。
- 全 487 単体テスト / 12 ブラックボックスレール PASS、回帰なし。
