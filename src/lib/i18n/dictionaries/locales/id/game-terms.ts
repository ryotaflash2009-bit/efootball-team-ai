import { registerGameTerms } from "../../../game-terms";

/** Bahasa Indonesia — ゲームの用語の表示名（REVIEW_REQUIRED: ゲーム内の公式の表記とは照合していない）。言語の chunk の読み込みと同時に登録。 */
registerGameTerms("id", {
  abilities: {
    offensiveAwareness: "Kesadaran menyerang", ballControl: "Kontrol bola", dribbling: "Dribel", tightPossession: "Kontrol rapat",
    lowPass: "Umpan datar", loftedPass: "Umpan lambung", finishing: "Penyelesaian", heading: "Sundulan", setPieceTaking: "Bola mati",
    curl: "Lengkungan", defensiveAwareness: "Kesadaran bertahan", tackling: "Tekel", aggression: "Agresivitas",
    defensiveEngagement: "Keterlibatan bertahan", gkAwareness: "Kesadaran kiper", gkCatching: "Tangkapan kiper",
    gkParrying: "Tepisan kiper", gkReflexes: "Refleks kiper", gkReach: "Jangkauan kiper", speed: "Kecepatan",
    acceleration: "Akselerasi", kickingPower: "Kekuatan tendangan", jumping: "Lompatan", physicalContact: "Kontak fisik",
    balance: "Keseimbangan", stamina: "Stamina",
  },
  groups: {
    shooting: "Tembakan", passing: "Umpan", dribbling: "Dribel", dexterity: "Ketangkasan", lowerBodyStrength: "Kekuatan kaki",
    aerialStrength: "Duel udara", defending: "Pertahanan", goalkeeping1: "Kiper 1", goalkeeping2: "Kiper 2", goalkeeping3: "Kiper 3",
  },
  tactics: {
    possessionGame: "Penguasaan bola", quickCounter: "Serangan balik cepat", longBallCounter: "Counter bola panjang",
    outWide: "Lewat sayap", longBall: "Bola panjang", overload: "Kelebihan pemain",
  },
});
