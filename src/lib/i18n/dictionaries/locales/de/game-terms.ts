import { registerGameTerms } from "../../../game-terms";

/** Deutsch — ゲームの用語の表示名（REVIEW_REQUIRED: ゲーム内の公式の表記とは照合していない）。言語の chunk の読み込みと同時に登録。 */
registerGameTerms("de", {
  abilities: {
    offensiveAwareness: "Offensivgespür", ballControl: "Ballkontrolle", dribbling: "Dribbling", tightPossession: "Enge Ballführung",
    lowPass: "Flachpass", loftedPass: "Hoher Pass", finishing: "Abschluss", heading: "Kopfball", setPieceTaking: "Standards",
    curl: "Effet", defensiveAwareness: "Defensivgespür", tackling: "Balleroberung", aggression: "Aggressivität",
    defensiveEngagement: "Defensiveinsatz", gkAwareness: "Torwartgespür", gkCatching: "Fangsicherheit",
    gkParrying: "Faustabwehr", gkReflexes: "Torwartreflexe", gkReach: "Torwartreichweite", speed: "Tempo",
    acceleration: "Antritt", kickingPower: "Schusskraft", jumping: "Sprungkraft", physicalContact: "Körpereinsatz",
    balance: "Gleichgewicht", stamina: "Ausdauer",
  },
  groups: {
    shooting: "Schuss", passing: "Passspiel", dribbling: "Dribbling", dexterity: "Geschick", lowerBodyStrength: "Beinkraft",
    aerialStrength: "Kopfballstärke", defending: "Abwehr", goalkeeping1: "Torwart 1", goalkeeping2: "Torwart 2", goalkeeping3: "Torwart 3",
  },
  tactics: {
    possessionGame: "Ballbesitzspiel", quickCounter: "Schneller Konter", longBallCounter: "Langball-Konter",
    outWide: "Flügelspiel", longBall: "Lange Bälle", overload: "Überladen",
  },
});
