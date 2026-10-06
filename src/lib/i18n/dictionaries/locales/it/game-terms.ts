import { registerGameTerms } from "../../../game-terms";

/** Italiano — ゲームの用語の表示名（REVIEW_REQUIRED: ゲーム内の公式の表記とは照合していない）。言語の chunk の読み込みと同時に登録。 */
registerGameTerms("it", {
  abilities: {
    offensiveAwareness: "Attitudine offensiva", ballControl: "Controllo palla", dribbling: "Dribbling", tightPossession: "Controllo stretto",
    lowPass: "Passaggio rasoterra", loftedPass: "Passaggio alto", finishing: "Finalizzazione", heading: "Colpo di testa", setPieceTaking: "Calci piazzati",
    curl: "Effetto", defensiveAwareness: "Attitudine difensiva", tackling: "Contrasto", aggression: "Aggressività",
    defensiveEngagement: "Impegno difensivo", gkAwareness: "Attitudine portiere", gkCatching: "Presa portiere",
    gkParrying: "Respinta portiere", gkReflexes: "Riflessi portiere", gkReach: "Estensione portiere", speed: "Velocità",
    acceleration: "Accelerazione", kickingPower: "Potenza di tiro", jumping: "Elevazione", physicalContact: "Contatto fisico",
    balance: "Equilibrio", stamina: "Resistenza",
  },
  groups: {
    shooting: "Tiro", passing: "Passaggio", dribbling: "Dribbling", dexterity: "Destrezza", lowerBodyStrength: "Forza nelle gambe",
    aerialStrength: "Gioco aereo", defending: "Difesa", goalkeeping1: "Portiere 1", goalkeeping2: "Portiere 2", goalkeeping3: "Portiere 3",
  },
  tactics: {
    possessionGame: "Possesso palla", quickCounter: "Contropiede rapido", longBallCounter: "Contropiede lungo",
    outWide: "Gioco sulle fasce", longBall: "Lanci lunghi", overload: "Sovraccarico",
  },
});
