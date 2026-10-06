import { registerGameTerms } from "../../../game-terms";

/** 繁體中文（台灣）— ゲームの用語の表示名（REVIEW_REQUIRED: ゲーム内の公式の表記とは照合していない）。言語の chunk の読み込みと同時に登録。 */
registerGameTerms("zh-TW", {
  abilities: {
    offensiveAwareness: "進攻意識", ballControl: "控球", dribbling: "盤帶", tightPossession: "緊密控球",
    lowPass: "低平傳球", loftedPass: "高吊傳球", finishing: "臨門一腳", heading: "頭槌", setPieceTaking: "定位球",
    curl: "弧線球", defensiveAwareness: "防守意識", tackling: "搶斷", aggression: "積極性",
    defensiveEngagement: "防守參與", gkAwareness: "守門員意識", gkCatching: "守門員接球",
    gkParrying: "守門員撲擋", gkReflexes: "守門員反應", gkReach: "守門員防守範圍", speed: "速度",
    acceleration: "加速能力", kickingPower: "踢球力道", jumping: "彈跳力", physicalContact: "身體對抗",
    balance: "平衡感", stamina: "體能",
  },
  groups: {
    shooting: "射門", passing: "傳球", dribbling: "盤帶", dexterity: "靈巧", lowerBodyStrength: "下肢力量",
    aerialStrength: "空中爭頂", defending: "防守", goalkeeping1: "守門 1", goalkeeping2: "守門 2", goalkeeping3: "守門 3",
  },
  tactics: {
    possessionGame: "控球戰術", quickCounter: "快速反擊", longBallCounter: "長傳反擊",
    outWide: "邊路進攻", longBall: "長傳打法", overload: "局部以多打少",
  },
});
