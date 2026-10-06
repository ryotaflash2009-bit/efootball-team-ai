/**
 * 固有の用語の契約（本人の判断 2026-10-07）:
 * - Link-Up Play・OVR は、データ元で各言語の正式な表記を確認できるまで、全言語で原語のまま使う。
 * - 現地語の短い補足は Tooltip・初回の説明に限り、原語と並べて付けてよい（例: "Link-Up Play (juego combinado)"）。
 * - AI の訳を正式なゲーム内の名称として扱わない。原語で検索できる状態を保つ。
 *
 * English の原文に用語があれば、訳にも同じ原語が必要。現地語の候補の語だけ（原語なし）は違反。
 */
export const FIXED_TERMS = [
  {
    id: "linkUpPlay",
    source: /Link-?Up/,
    required: /Link-Up/,
    // 用語集・以前の訳で使われた現地語の候補（原語なしで単独で出たら違反）
    localAlternatives: [
      /juego combinado/i, /jogada combinada/i, /jeu combiné/i, /kombinationsspiel/i, /gioco combinato/i,
      /연계 ?플레이/, /联动配合/, /聯動配合/, /kombinasyon oyunu/i,
    ],
  },
  {
    id: "ovr",
    source: /\bOVR\b/,
    required: /\bOVR\b/,
    localAlternatives: [
      /\(MED\)|\bMED\b/, /\(GER\)|\bGER\b/, /\(GEN\)|\bGEN\b/, /\(GES\)|\bGES\b/, /\(CMP\)|\bCMP\b/,
    ],
  },
];

/** 1 つの訳の文を確認する。違反の理由の配列（空なら OK）。 */
export function checkFixedTerms(enText, translated) {
  const problems = [];
  if (typeof enText !== "string" || typeof translated !== "string") return problems;
  for (const term of FIXED_TERMS) {
    const inSource = term.source.test(enText);
    const hasOriginal = term.required.test(translated);
    if (inSource && !hasOriginal) problems.push(`${term.id}: original term missing`);
    if (!hasOriginal) for (const alt of term.localAlternatives) if (alt.test(translated)) problems.push(`${term.id}: local alternative without the original term (${alt})`);
  }
  return problems;
}
