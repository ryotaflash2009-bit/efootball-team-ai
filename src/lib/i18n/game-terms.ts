/**
 * ゲームの用語の表示名（能力名・育成カテゴリ・監督の戦術）の言語ごとの表（2026-10-06）。
 *
 * - 日本語・English は従来の定義（`world/stat-labels.ts`・`world/stats.ts`・`managers/tactics.ts`）がそのまま正。
 * - ほかの言語はこの表。**ゲーム内の各言語の公式の表記とは照合していない**（用語集の状態は REVIEW_REQUIRED）。
 *   公式と書かない。照合できた語から用語集を `approved` にし、この表を直す。
 * - 表に無い言語・語は English の名前（呼び出し側の既存の代わり）。内部の key は変えない。
 * - 表示言語は LocaleProvider が `setGameTermsLocale` で設定する（ja・en のときは null を返し、従来の処理に任せる）。
 */

type Table = Readonly<Record<string, string>>;

const ABILITY: Readonly<Record<string, Table>> = {
  es: {
    offensiveAwareness: "Actitud ofensiva", ballControl: "Control del balón", dribbling: "Regate", tightPossession: "Posesión cerrada",
    lowPass: "Pase raso", loftedPass: "Pase bombeado", finishing: "Finalización", heading: "Cabeceo", setPieceTaking: "Balón parado",
    curl: "Efecto", defensiveAwareness: "Actitud defensiva", tackling: "Recuperación de balón", aggression: "Agresividad",
    defensiveEngagement: "Compromiso defensivo", gkAwareness: "Actitud de portero", gkCatching: "Atajada de portero",
    gkParrying: "Despeje de portero", gkReflexes: "Reflejos de portero", gkReach: "Alcance de portero", speed: "Velocidad",
    acceleration: "Aceleración", kickingPower: "Potencia de tiro", jumping: "Salto", physicalContact: "Contacto físico",
    balance: "Equilibrio", stamina: "Resistencia",
  },
  "pt-BR": {
    offensiveAwareness: "Talento ofensivo", ballControl: "Controle de bola", dribbling: "Drible", tightPossession: "Condução firme",
    lowPass: "Passe rasteiro", loftedPass: "Passe alto", finishing: "Finalização", heading: "Cabeceio", setPieceTaking: "Bola parada",
    curl: "Curva", defensiveAwareness: "Talento defensivo", tackling: "Desarme", aggression: "Agressividade",
    defensiveEngagement: "Comprometimento defensivo", gkAwareness: "Talento de goleiro", gkCatching: "Firmeza do goleiro",
    gkParrying: "Defesa com socos", gkReflexes: "Reflexos do goleiro", gkReach: "Alcance do goleiro", speed: "Velocidade",
    acceleration: "Aceleração", kickingPower: "Força do chute", jumping: "Impulsão", physicalContact: "Contato físico",
    balance: "Equilíbrio", stamina: "Resistência",
  },
};

const GROUP: Readonly<Record<string, Table>> = {
  es: {
    shooting: "Disparo", passing: "Pase", dribbling: "Regate", dexterity: "Agilidad", lowerBodyStrength: "Fuerza de piernas",
    aerialStrength: "Juego aéreo", defending: "Defensa", goalkeeping1: "Portero 1", goalkeeping2: "Portero 2", goalkeeping3: "Portero 3",
  },
  "pt-BR": {
    shooting: "Chute", passing: "Passe", dribbling: "Drible", dexterity: "Agilidade", lowerBodyStrength: "Força das pernas",
    aerialStrength: "Jogo aéreo", defending: "Defesa", goalkeeping1: "Goleiro 1", goalkeeping2: "Goleiro 2", goalkeeping3: "Goleiro 3",
  },
};

const TACTIC: Readonly<Record<string, Table>> = {
  es: {
    possessionGame: "Juego de posesión", quickCounter: "Contraataque rápido", longBallCounter: "Contraataque con balón largo",
    outWide: "Por las bandas", longBall: "Balón largo", overload: "Sobrecarga",
  },
  "pt-BR": {
    possessionGame: "Jogo de posse", quickCounter: "Contra-ataque rápido", longBallCounter: "Contra-ataque com bola longa",
    outWide: "Pelas pontas", longBall: "Bola longa", overload: "Sobrecarga",
  },
};

let current: string | null = null;

/** 表示言語（ja・en は null: 従来の表示）。 */
export function setGameTermsLocale(displayLocale: string): void {
  current = displayLocale === "ja" || displayLocale === "en" ? null : displayLocale;
}

/** 現在の表示言語（ja・en のときは null）。計算ライブラリの文の訳（generated-catalog.ts）が使う。 */
export function currentGameTermsLocale(): string | null {
  return current;
}

export function localizedAbilityName(statKey: string): string | null {
  return current ? (ABILITY[current]?.[statKey] ?? null) : null;
}
export function localizedGroupName(groupId: string): string | null {
  return current ? (GROUP[current]?.[groupId] ?? null) : null;
}
export function localizedTacticName(tacticKey: string): string | null {
  return current ? (TACTIC[current]?.[tacticKey] ?? null) : null;
}

/** テスト・監査用: 表を持つ言語と語の数。 */
export function gameTermCoverage(): Record<string, { abilities: number; groups: number; tactics: number }> {
  const out: Record<string, { abilities: number; groups: number; tactics: number }> = {};
  for (const l of Object.keys(ABILITY)) out[l] = { abilities: Object.keys(ABILITY[l]).length, groups: Object.keys(GROUP[l] ?? {}).length, tactics: Object.keys(TACTIC[l] ?? {}).length };
  return out;
}
