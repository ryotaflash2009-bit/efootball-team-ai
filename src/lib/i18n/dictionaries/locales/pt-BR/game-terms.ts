import { registerGameTerms } from "../../../game-terms";

/** Português (Brasil) — ゲームの用語の表示名（REVIEW_REQUIRED: ゲーム内の公式の表記とは照合していない）。言語の chunk の読み込みと同時に登録。 */
registerGameTerms("pt-BR", {
  abilities: {
    offensiveAwareness: "Talento ofensivo", ballControl: "Controle de bola", dribbling: "Drible", tightPossession: "Condução firme",
    lowPass: "Passe rasteiro", loftedPass: "Passe alto", finishing: "Finalização", heading: "Cabeceio", setPieceTaking: "Bola parada",
    curl: "Curva", defensiveAwareness: "Talento defensivo", tackling: "Desarme", aggression: "Agressividade",
    defensiveEngagement: "Empenho defensivo", gkAwareness: "Talento de goleiro", gkCatching: "Firmeza do goleiro",
    gkParrying: "Defesa com socos", gkReflexes: "Reflexos do goleiro", gkReach: "Alcance do goleiro", speed: "Velocidade",
    acceleration: "Aceleração", kickingPower: "Força do chute", jumping: "Impulsão", physicalContact: "Contato físico",
    balance: "Equilíbrio", stamina: "Resistência",
  },
  groups: {
    shooting: "Chute", passing: "Passe", dribbling: "Drible", dexterity: "Agilidade", lowerBodyStrength: "Força das pernas",
    aerialStrength: "Jogo aéreo", defending: "Defesa", goalkeeping1: "Goleiro 1", goalkeeping2: "Goleiro 2", goalkeeping3: "Goleiro 3",
  },
  tactics: {
    possessionGame: "Jogo de posse", quickCounter: "Contra-ataque rápido", longBallCounter: "Contra-ataque com bola longa",
    outWide: "Pelas pontas", longBall: "Bola longa", overload: "Sobrecarga",
  },
});
