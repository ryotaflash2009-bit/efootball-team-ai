import type { RuleDictionary } from "./build-intent-rule-types";

/**
 * RuleBasedBuildIntentExtractor の英語表現辞書。
 * 能力領域の対応関係は ja 辞書と同じ確認済み定義(affectedStats)を正本とする
 * (例: "speed" は dexterity、"kicking power" は lowerBodyStrength)。
 * 全て小文字で保持し、パーサー側で入力を小文字化してから照合する。
 */

export const BUILD_INTENT_RULE_DICTIONARY_EN: RuleDictionary = {
  groupPhrases: [
    { groupId: "shooting", phrases: ["shooting", "finishing", "scoring ability", "set piece taking", "curl"] },
    { groupId: "passing", phrases: ["passing", "playmaking", "chance creation", "through pass", "crossing", "low pass", "lofted pass"] },
    { groupId: "dribbling", phrases: ["dribbling", "ball control", "tight possession", "beat defenders", "beat players", "take on defenders"] },
    { groupId: "dexterity", phrases: ["quickness", "dexterity", "acceleration", "speed", "agility"] },
    { groupId: "lowerBodyStrength", phrases: ["lower body strength", "kicking power", "stamina", "lower body"] },
    { groupId: "aerialStrength", phrases: ["aerial strength", "aerial", "heading", "jumping", "physical contact"] },
    { groupId: "defending", phrases: ["defending", "defensive awareness", "tackling", "aggression", "defensive engagement"] },
    { groupId: "goalkeeping1", phrases: ["gk1", "gk awareness", "gk reflexes"] },
    { groupId: "goalkeeping2", phrases: ["gk2", "catching", "parrying"] },
    { groupId: "goalkeeping3", phrases: ["gk3", "reach"] },
  ],
  ambiguousPhrases: [
    { phrase: "physical", candidateGroupIds: ["aerialStrength", "lowerBodyStrength"] },
    { phrase: "gk ability", candidateGroupIds: ["goalkeeping1", "goalkeeping2", "goalkeeping3"] },
    { phrase: "goalkeeper ability", candidateGroupIds: ["goalkeeping1", "goalkeeping2", "goalkeeping3"] },
  ],
  goalPhrases: [
    { goal: "scoring", phrases: ["scoring", "goal scoring", "finishing ability"] },
    { goal: "dribbling", phrases: ["dribbling past defenders", "beat players", "take on defenders", "dribble past"] },
    { goal: "passing", phrases: ["playmaking", "chance creation"] },
    { goal: "speed", phrases: ["pure speed", "fast player", "pace"] },
    { goal: "possession", phrases: ["ball retention", "possession play"] },
    { goal: "physical", phrases: ["physical presence", "physical strength"] },
    { goal: "aerial", phrases: ["aerial presence", "aerial threat"] },
    { goal: "defense", phrases: ["defensive solidity", "defensive specialist"] },
    { goal: "press", phrases: ["pressing specialist"] },
    { goal: "counter", phrases: ["counter attack specialist"] },
    { goal: "balance", phrases: ["all-round", "balanced player"] },
  ],
  positionPhrases: [
    { position: "RWF", phrases: ["rwf", "right wing forward"] },
    { position: "LWF", phrases: ["lwf", "left wing forward"] },
    { position: "CF", phrases: ["cf", "center forward", "centre forward", "striker"] },
    { position: "SS", phrases: ["ss", "second striker"] },
    { position: "AMF", phrases: ["amf", "attacking midfielder"] },
    { position: "CMF", phrases: ["cmf", "center midfielder", "centre midfielder"] },
    { position: "DMF", phrases: ["dmf", "defensive midfielder"] },
    { position: "LMF", phrases: ["lmf", "left midfielder"] },
    { position: "RMF", phrases: ["rmf", "right midfielder"] },
    { position: "LB", phrases: ["lb", "left back"] },
    { position: "RB", phrases: ["rb", "right back"] },
    { position: "CB", phrases: ["cb", "center back", "centre back"] },
    { position: "GK", phrases: ["gk", "goalkeeper"] },
  ],
  usageIntentPhrases: ["play at", "use at", "use as", "deploy as", "field this at"],
  topPriorityPhrases: [
    "top priority",
    "highest priority",
    "focus mainly on",
    "specialize in",
    "primary focus",
    "main strength",
    "most important",
  ],
  secondaryPriorityPhrases: [
    "secondary priority",
    "supporting strength",
    "keep some",
    "at least maintain",
    "minimum needed",
    "nice to have",
    "some investment",
  ],
  normalPriorityPhrases: ["average is fine", "standard", "no special priority"],
  lowPriorityPhrases: ["low priority", "not a focus", "lower priority", "can be lower"],
  negativePriorityPhrases: ["do not prioritize", "don't prioritize", "not important", "less important"],
  avoidOverinvestmentPhrases: [
    "avoid overinvesting",
    "already high enough",
    "do not raise too much",
    "keep it from getting too high",
    "do not need to raise",
    "doesn't need to raise",
    "does not need to raise",
    "already high",
    "do not want to overinvest",
  ],
  ignorePhrases: ["ignore", "sacrifice", "do not care about", "can stay low", "not needed at all", "willing to sacrifice"],
  preservePhrases: ["keep", "preserve", "maintain", "do not lose", "keep as a strength"],
  balanceHintPhrases: ["balanced", "all-round"],
  comparativeConnectors: [
    { marker: "rather than", direction: "left-preferred" },
    { marker: "instead of", direction: "left-preferred" },
    { marker: "more than", direction: "left-preferred" },
  ],
  sentenceEnderChars: [".", "!", "?", "\n", ";"],
  clauseConnectorPhrases: ["but", "however", "instead"],
};
