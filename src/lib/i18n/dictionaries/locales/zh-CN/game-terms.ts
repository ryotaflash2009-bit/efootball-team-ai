import { registerGameTerms } from "../../../game-terms";

/** 简体中文 — ゲームの用語の表示名（REVIEW_REQUIRED: ゲーム内の公式の表記とは照合していない）。言語の chunk の読み込みと同時に登録。 */
registerGameTerms("zh-CN", {
  abilities: {
    offensiveAwareness: "进攻意识", ballControl: "控球", dribbling: "盘带", tightPossession: "贴身控球",
    lowPass: "地面传球", loftedPass: "高空传球", finishing: "射术", heading: "头球", setPieceTaking: "定位球",
    curl: "弧线", defensiveAwareness: "防守意识", tackling: "抢断", aggression: "侵略性",
    defensiveEngagement: "防守投入", gkAwareness: "门将意识", gkCatching: "门将接球",
    gkParrying: "门将扑挡", gkReflexes: "门将反应", gkReach: "门将覆盖范围", speed: "速度",
    acceleration: "爆发力", kickingPower: "脚法力量", jumping: "弹跳", physicalContact: "身体对抗",
    balance: "平衡", stamina: "体力",
  },
  groups: {
    shooting: "射门", passing: "传球", dribbling: "盘带", dexterity: "灵巧", lowerBodyStrength: "下肢力量",
    aerialStrength: "空中争顶", defending: "防守", goalkeeping1: "守门 1", goalkeeping2: "守门 2", goalkeeping3: "守门 3",
  },
  tactics: {
    possessionGame: "控球战术", quickCounter: "快速反击", longBallCounter: "长传反击",
    outWide: "边路进攻", longBall: "长传冲吊", overload: "局部人数优势",
  },
});
