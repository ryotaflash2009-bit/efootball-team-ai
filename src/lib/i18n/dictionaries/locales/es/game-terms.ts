import { registerGameTerms } from "../../../game-terms";

/** Español — ゲームの用語の表示名（REVIEW_REQUIRED: ゲーム内の公式の表記とは照合していない）。言語の chunk の読み込みと同時に登録。 */
registerGameTerms("es", {
  abilities: {
    offensiveAwareness: "Actitud ofensiva", ballControl: "Control del balón", dribbling: "Regate", tightPossession: "Posesión cerrada",
    lowPass: "Pase raso", loftedPass: "Pase bombeado", finishing: "Finalización", heading: "Cabeceo", setPieceTaking: "Balón parado",
    curl: "Efecto", defensiveAwareness: "Actitud defensiva", tackling: "Recuperación de balón", aggression: "Agresividad",
    defensiveEngagement: "Compromiso defensivo", gkAwareness: "Actitud de portero", gkCatching: "Atajada de portero",
    gkParrying: "Despeje de portero", gkReflexes: "Reflejos de portero", gkReach: "Alcance de portero", speed: "Velocidad",
    acceleration: "Aceleración", kickingPower: "Potencia de tiro", jumping: "Salto", physicalContact: "Contacto físico",
    balance: "Equilibrio", stamina: "Resistencia",
  },
  groups: {
    shooting: "Disparo", passing: "Pase", dribbling: "Regate", dexterity: "Agilidad", lowerBodyStrength: "Fuerza de piernas",
    aerialStrength: "Juego aéreo", defending: "Defensa", goalkeeping1: "Portero 1", goalkeeping2: "Portero 2", goalkeeping3: "Portero 3",
  },
  tactics: {
    possessionGame: "Juego de posesión", quickCounter: "Contraataque rápido", longBallCounter: "Contraataque con balón largo",
    outWide: "Por las bandas", longBall: "Balón largo", overload: "Sobrecarga",
  },
});
