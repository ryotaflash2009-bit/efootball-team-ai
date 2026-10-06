import { registerGameTerms } from "../../../game-terms";

/** 한국어 — ゲームの用語の表示名（REVIEW_REQUIRED: ゲーム内の公式の表記とは照合していない）。言語の chunk の読み込みと同時に登録。 */
registerGameTerms("ko", {
  abilities: {
    offensiveAwareness: "공격 센스", ballControl: "볼 컨트롤", dribbling: "드리블", tightPossession: "볼 키핑",
    lowPass: "낮은 패스", loftedPass: "띄운 패스", finishing: "결정력", heading: "헤더", setPieceTaking: "세트피스",
    curl: "커브", defensiveAwareness: "수비 센스", tackling: "태클", aggression: "공격성",
    defensiveEngagement: "수비 참여", gkAwareness: "GK 센스", gkCatching: "GK 캐칭",
    gkParrying: "GK 쳐내기", gkReflexes: "GK 반응 속도", gkReach: "GK 커버 범위", speed: "스피드",
    acceleration: "가속력", kickingPower: "킥 파워", jumping: "점프력", physicalContact: "몸싸움",
    balance: "밸런스", stamina: "스태미나",
  },
  groups: {
    shooting: "슈팅", passing: "패스", dribbling: "드리블", dexterity: "민첩성", lowerBodyStrength: "하체 근력",
    aerialStrength: "공중전", defending: "수비", goalkeeping1: "골키퍼 1", goalkeeping2: "골키퍼 2", goalkeeping3: "골키퍼 3",
  },
  tactics: {
    possessionGame: "포제션 게임", quickCounter: "빠른 역습", longBallCounter: "롱볼 역습",
    outWide: "측면 공략", longBall: "롱볼", overload: "오버로드",
  },
});
