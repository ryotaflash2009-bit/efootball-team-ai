import { registerGameTerms } from "../../../game-terms";

/** Türkçe — ゲームの用語の表示名（REVIEW_REQUIRED: ゲーム内の公式の表記とは照合していない）。言語の chunk の読み込みと同時に登録。 */
registerGameTerms("tr", {
  abilities: {
    offensiveAwareness: "Hücum farkındalığı", ballControl: "Top kontrolü", dribbling: "Top sürme", tightPossession: "Yakın top kontrolü",
    lowPass: "Yerden pas", loftedPass: "Havadan pas", finishing: "Bitiricilik", heading: "Kafa vuruşu", setPieceTaking: "Duran top",
    curl: "Falso", defensiveAwareness: "Savunma farkındalığı", tackling: "Top kapma", aggression: "Agresiflik",
    defensiveEngagement: "Savunma katılımı", gkAwareness: "Kaleci farkındalığı", gkCatching: "Kaleci top tutma",
    gkParrying: "Kaleci yumruklama", gkReflexes: "Kaleci refleksi", gkReach: "Kaleci menzili", speed: "Hız",
    acceleration: "İvmelenme", kickingPower: "Şut gücü", jumping: "Sıçrama", physicalContact: "Fiziksel temas",
    balance: "Denge", stamina: "Dayanıklılık",
  },
  groups: {
    shooting: "Şut", passing: "Pas", dribbling: "Top sürme", dexterity: "Beceri", lowerBodyStrength: "Bacak gücü",
    aerialStrength: "Hava hakimiyeti", defending: "Savunma", goalkeeping1: "Kaleci 1", goalkeeping2: "Kaleci 2", goalkeeping3: "Kaleci 3",
  },
  tactics: {
    possessionGame: "Topa sahip olma", quickCounter: "Hızlı kontra", longBallCounter: "Uzun top kontra",
    outWide: "Kanat oyunu", longBall: "Uzun top", overload: "Sayısal üstünlük",
  },
});
