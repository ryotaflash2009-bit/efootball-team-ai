#!/usr/bin/env node
/**
 * 同じ選手の判定（カード ID の下位 20 ビット）の監査（2026-10-10）。読み取りだけ。
 *   node scripts/audit-person-identity.mjs                       （ローカルの SQLite data/efootball.db）
 *   BASE_URL=https://efootball-team-ai.vercel.app node scripts/audit-person-identity.mjs   （公開の API・全件を 1 ページずつ）
 *
 * 合格の条件: 下位 20 ビットが同じカードの組で、英語名・国籍が食い違う組が 0。World の反映（自動更新）の後に流して確かめる。
 * 不合格なら `src/lib/world/person-identity.ts` の判定を使わない判断（本人へ報告）。
 */
const MASK = (1n << 20n) - 1n;

async function loadCards() {
  const base = (process.env.BASE_URL ?? "").replace(/\/+$/, "");
  if (base) {
    const out = [];
    for (let page = 1; page < 400; page++) {
      const r = await fetch(`${base}/api/world/players?pageSize=100&page=${page}&sort=name`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      for (const p of j.players) out.push({ id: p.worldCardId, name_en: p.nameEn, nationality: p.nationality });
      if (page >= (j.totalPages ?? 1)) break;
      await new Promise((res) => setTimeout(res, 200));
    }
    return out;
  }
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync("data/efootball.db", { readOnly: true });
  return db.prepare("select world_card_id id, name_en, nationality from world_player_cards").all();
}

const cards = await loadCards();
const byKey = new Map();
for (const c of cards) {
  if (!/^\d{1,20}$/.test(String(c.id))) continue;
  const k = (BigInt(c.id) & MASK).toString();
  (byKey.get(k) ?? byKey.set(k, []).get(k)).push(c);
}
let multi = 0;
const conflicts = [];
for (const [k, arr] of byKey) {
  if (arr.length < 2) continue;
  multi++;
  const names = new Set(arr.map((c) => c.name_en));
  const nats = new Set(arr.map((c) => c.nationality));
  if (names.size > 1 || nats.size > 1) conflicts.push({ personKey: k, names: [...names], nationalities: [...nats], cards: arr.map((c) => c.id) });
}
const verdict = conflicts.length === 0 ? "PERSON_IDENTITY_CONSISTENT" : "PERSON_IDENTITY_CONFLICT";
console.log(JSON.stringify({ verdict, cards: cards.length, persons: byKey.size, multiCardPersons: multi, conflicts: conflicts.slice(0, 20), checkedAt: new Date().toISOString() }, null, 2));
process.exit(conflicts.length ? 1 : 0);
