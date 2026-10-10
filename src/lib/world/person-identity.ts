/**
 * 同じ選手（人物）の判定（2026-10-09/10・本人の確認「同じ選手の別のカードは同じスカッドに 2 枚入れられない」）。
 *
 * World のカード ID の下位 20 ビットが、カードの種類・時期をまたいで人物ごとに同じになる（`docs/product/same-player-rule.md`）。
 * - 根拠（ローカルの World 13,009 枚・2026-10-10・`scripts/audit-person-identity.mjs`）: 下位 20 ビットが同じカードの組 2,151 は、
 *   英語名・国籍が **すべて一致**（食い違い 0）。英語名と国籍が同じでも下位 20 ビットが違う 25 組は、身長・年齢・ポジションが違う
 *   **別人**（例: Hashimoto Kento 健人 / 拳人・Rodri 2 名）。16 ビットでは 59 組が別名の人と混ざる。
 * - 表示名では判定しない（同名の別人・表記の揺れ・翻訳名に左右されないため）。
 * - KONAMI の公開の仕様ではない（データから確かめた規則）。World の更新ごとに監査の script で確かめ直す。
 */
const PERSON_BITS = 20n;
const PERSON_MASK = (1n << PERSON_BITS) - 1n;
const WORLD_CARD_ID_RE = /^\d{1,20}$/;

/** 人物のキー（World のカード ID の下位 20 ビット）。ID が不正なら null（判定しない）。 */
export function personKeyOf(worldCardId: string | null | undefined): string | null {
  if (typeof worldCardId !== "string" || !WORLD_CARD_ID_RE.test(worldCardId)) return null;
  try {
    return (BigInt(worldCardId) & PERSON_MASK).toString();
  } catch {
    return null;
  }
}

/** 2 枚のカードが同じ選手か（同じカード ID も同じ選手）。 */
export function isSamePerson(a: string | null | undefined, b: string | null | undefined): boolean {
  const ka = personKeyOf(a);
  return ka !== null && ka === personKeyOf(b);
}

/** 同じ選手が 2 枚以上ある組（人物のキーごとのカード ID・入力の順）。 */
export function duplicatePersons(worldCardIds: readonly (string | null | undefined)[]): { personKey: string; worldCardIds: string[] }[] {
  const by = new Map<string, string[]>();
  for (const id of worldCardIds) {
    const k = personKeyOf(id);
    if (k === null) continue;
    const list = by.get(k) ?? [];
    list.push(id as string);
    by.set(k, list);
  }
  return [...by.entries()].filter(([, ids]) => ids.length > 1).map(([personKey, ids]) => ({ personKey, worldCardIds: ids }));
}
