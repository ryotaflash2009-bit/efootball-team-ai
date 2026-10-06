import { registerGameTerms } from "../../../game-terms";

/** Français — ゲームの用語の表示名（REVIEW_REQUIRED: ゲーム内の公式の表記とは照合していない）。言語の chunk の読み込みと同時に登録。 */
registerGameTerms("fr", {
  abilities: {
    offensiveAwareness: "Instinct offensif", ballControl: "Contrôle du ballon", dribbling: "Dribble", tightPossession: "Conduite serrée",
    lowPass: "Passe au sol", loftedPass: "Passe aérienne", finishing: "Finition", heading: "Jeu de tête", setPieceTaking: "Balles arrêtées",
    curl: "Effet", defensiveAwareness: "Instinct défensif", tackling: "Tacle", aggression: "Agressivité",
    defensiveEngagement: "Engagement défensif", gkAwareness: "Instinct du gardien", gkCatching: "Prise du gardien",
    gkParrying: "Parade du gardien", gkReflexes: "Réflexes du gardien", gkReach: "Envergure du gardien", speed: "Vitesse",
    acceleration: "Accélération", kickingPower: "Puissance de frappe", jumping: "Détente", physicalContact: "Contact physique",
    balance: "Équilibre", stamina: "Endurance",
  },
  groups: {
    shooting: "Tir", passing: "Passes", dribbling: "Dribble", dexterity: "Dextérité", lowerBodyStrength: "Force des jambes",
    aerialStrength: "Jeu aérien", defending: "Défense", goalkeeping1: "Gardien 1", goalkeeping2: "Gardien 2", goalkeeping3: "Gardien 3",
  },
  tactics: {
    possessionGame: "Jeu de possession", quickCounter: "Contre-attaque rapide", longBallCounter: "Contre par jeu long",
    outWide: "Jeu sur les ailes", longBall: "Jeu long", overload: "Surnombre",
  },
});
