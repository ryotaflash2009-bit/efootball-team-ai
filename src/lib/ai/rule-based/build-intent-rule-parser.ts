import type { PrimaryGoalId } from "@/lib/progression/build-intent-analysis";
import type { BuildIntentExtractionRequest, BuildIntentClarification } from "@/lib/ai/build-intent-extractor";
import { BUILD_INTENT_RULE_DICTIONARY_JA } from "./build-intent-rule-dictionary-ja";
import { BUILD_INTENT_RULE_DICTIONARY_EN } from "./build-intent-rule-dictionary-en";
import type { RuleDictionary } from "./build-intent-rule-types";
import { FOOTBALL_ROLE_RULES_JA, type FootballRoleRuleEntry } from "./football-role-rules-ja";
import { FOOTBALL_ROLE_RULES_EN } from "./football-role-rules-en";
import { buildClarificationFromTemplate, getClarificationTemplateRelevantGroupIds } from "./build-intent-clarification";

/**
 * RuleBasedBuildIntentExtractor の中核パーサー(決定的・外部通信なし・生成AIなし)。
 *
 * - 自由記述を「文」→「節(読点・カンマ区切り)」へ分割し、能力領域の表現ごとに
 *   最も近い節を優先して優先度修飾語を判定する(節内に修飾語がなければ、文末側へ
 *   節を延長して判定する。日本語・英語ともに述語/修飾語が文末側へ来ることが多いため)。
 * - 「AよりB」「AではなくB」「B rather than A」「B instead of A」「not A but B」は
 *   専用の比較パターンとして扱い、Bを最優先・Aを低優先(捨てる表現が近ければ意図的に捨てる)とする。
 * - 矛盾の自動解消は行わない。ここで検出した候補は、必ず既存の
 *   validateBuildIntentExtraction() の排他バケット検証を通してから最終的な
 *   BuildIntentExtraction へ変換する(呼び出し側の rule-based-build-intent-extractor.ts が実施)。
 * - HTTP通信・外部API・生成AI・Math.random・現在日時分岐を一切使用しない。
 *   同一の入力からは常に同一の raw 抽出結果を返す。
 */

export interface RawRuleExtraction {
  intendedPositions: string[];
  primaryGoal: PrimaryGoalId | "unspecified";
  priorityGroups: string[];
  secondaryGroups: string[];
  normalGroups: string[];
  lowPriorityGroups: string[];
  avoidOverinvestmentGroups: string[];
  intentionallyIgnoredGroups: string[];
  comparisonTargetBuildId: string | null;
  comparisonFocusGroups: string[];
  strengthsToPreserve: string[];
  ambiguities: string[];
  clarifications: BuildIntentClarification[];
  unanalyzedSegments: string[];
  confidence: "high" | "medium" | "low";
  evidence: string[];
}

const MAX_EVIDENCE_SNIPPET = 60;
const MAX_AMBIGUITIES = 10;
const MAX_EVIDENCE = 10;

function clip(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

interface PhraseOccurrence {
  start: number;
  end: number;
  matched: string;
}

/** 長い表現を優先し、重複しない範囲で全出現位置を返す(部分文字列の誤爆を避ける)。 */
function findPhraseOccurrences(haystack: string, phrases: string[]): PhraseOccurrence[] {
  const sorted = [...new Set(phrases)].sort((a, b) => b.length - a.length);
  const occurrences: PhraseOccurrence[] = [];
  const consumed: [number, number][] = [];
  const overlaps = (start: number, end: number) => consumed.some(([s, e]) => start < e && end > s);
  for (const phrase of sorted) {
    if (phrase.length === 0) continue;
    let from = 0;
    for (;;) {
      const idx = haystack.indexOf(phrase, from);
      if (idx < 0) break;
      const end = idx + phrase.length;
      if (!overlaps(idx, end)) {
        occurrences.push({ start: idx, end, matched: phrase });
        consumed.push([idx, end]);
      }
      from = idx + 1;
    }
  }
  return occurrences.sort((a, b) => a.start - b.start);
}

interface GroupMention {
  groupId: string | null;
  ambiguousCandidates: string[] | null;
  start: number;
  end: number;
  matched: string;
}

function findGroupMentions(text: string, dict: RuleDictionary): GroupMention[] {
  const groupPhraseList: { phrase: string; groupId: string }[] = [];
  for (const g of dict.groupPhrases) for (const p of g.phrases) groupPhraseList.push({ phrase: p, groupId: g.groupId });
  const ambiguousPhraseList: { phrase: string; candidates: string[] }[] = dict.ambiguousPhrases.map((a) => ({ phrase: a.phrase, candidates: a.candidateGroupIds }));

  const allPhrases = [...groupPhraseList.map((g) => g.phrase), ...ambiguousPhraseList.map((a) => a.phrase)];
  const occurrences = findPhraseOccurrences(text, allPhrases);

  return occurrences.map((occ) => {
    const groupMatch = groupPhraseList.find((g) => g.phrase === occ.matched);
    if (groupMatch) return { groupId: groupMatch.groupId, ambiguousCandidates: null, start: occ.start, end: occ.end, matched: occ.matched };
    const ambiguousMatch = ambiguousPhraseList.find((a) => a.phrase === occ.matched);
    return { groupId: null, ambiguousCandidates: ambiguousMatch?.candidates ?? [], start: occ.start, end: occ.end, matched: occ.matched };
  });
}

function containsAny(text: string, phrases: string[]): string | null {
  for (const p of phrases) if (p.length > 0 && text.includes(p)) return p;
  return null;
}

type ModifierKind = "ignored" | "avoidOverinvestment" | "low" | "secondary" | "priority" | "normal";

/** 節テキストに含まれる修飾語を、優先順位(捨てる > 上げすぎ注意 > 否定的優先度 > 補助的優先 > 最優先 > 通常)で1つ判定する。 */
function classifyModifier(clauseText: string, dict: RuleDictionary): { kind: ModifierKind; evidence: string } | null {
  const ignoreHit = containsAny(clauseText, dict.ignorePhrases);
  if (ignoreHit) return { kind: "ignored", evidence: ignoreHit };
  const avoidHit = containsAny(clauseText, dict.avoidOverinvestmentPhrases);
  if (avoidHit) return { kind: "avoidOverinvestment", evidence: avoidHit };
  const negativeHit = containsAny(clauseText, dict.negativePriorityPhrases) ?? containsAny(clauseText, dict.lowPriorityPhrases);
  if (negativeHit) return { kind: "low", evidence: negativeHit };
  const secondaryHit = containsAny(clauseText, dict.secondaryPriorityPhrases);
  if (secondaryHit) return { kind: "secondary", evidence: secondaryHit };
  const topHit = containsAny(clauseText, dict.topPriorityPhrases);
  if (topHit) return { kind: "priority", evidence: topHit };
  const normalHit = containsAny(clauseText, dict.normalPriorityPhrases);
  if (normalHit) return { kind: "normal", evidence: normalHit };
  return null;
}

/** 日本語は読点、英語はカンマで節へ分割する(否定・優先度修飾語の適用範囲を局所化するため)。 */
function splitIntoClauses(sentenceText: string, locale: "ja" | "en"): string[] {
  const sep = locale === "ja" ? "、" : ",";
  return sentenceText.split(sep);
}

interface Signal {
  groupId: string;
  kind: ModifierKind;
  evidence: string;
}

/** 「維持したい長所」専用の信号(優先度バケットとは独立に、strengthsToPreserve へのみ追加する)。 */
interface PreserveSignal {
  groupId: string;
  evidence: string;
}

/** 1文中の能力領域表現を、節単位(自節に修飾語がなければ文末側へ延長)で判定する。 */
function classifyMentionsInSentence(
  sentenceText: string,
  dict: RuleDictionary,
  locale: "ja" | "en",
  consumedRanges: [number, number][],
): { signals: Signal[]; preserveSignals: PreserveSignal[]; ambiguities: string[] } {
  const clauses = splitIntoClauses(sentenceText, locale);
  const signals: Signal[] = [];
  const preserveSignals: PreserveSignal[] = [];
  const ambiguities: string[] = [];

  // 各節の開始オフセットを計算する(結合に使った区切り文字1文字を考慮)。
  const sep = locale === "ja" ? "、" : ",";
  const clauseOffsets: number[] = [];
  let acc = 0;
  for (const c of clauses) {
    clauseOffsets.push(acc);
    acc += c.length + sep.length;
  }

  const mentions = findGroupMentions(sentenceText, dict);
  for (const mention of mentions) {
    if (consumedRanges.some(([s, e]) => mention.start < e && mention.end > s)) continue; // 比較パターン等で既に処理済み
    if (mention.groupId == null) {
      if (mention.ambiguousCandidates && mention.ambiguousCandidates.length > 0) {
        ambiguities.push(`ambiguous ability phrase "${clip(mention.matched, 40)}": could refer to ${mention.ambiguousCandidates.join(" or ")}; needs confirmation`);
      }
      continue;
    }
    // この出現がどの節に属するかを求める。
    let clauseIndex = 0;
    for (let i = 0; i < clauseOffsets.length; i++) {
      if (mention.start >= clauseOffsets[i]) clauseIndex = i;
    }
    const ownClause = clauses[clauseIndex];
    let modifier = classifyModifier(ownClause, dict);
    if (!modifier) {
      // 自節に修飾語がない場合のみ、文末側の節まで延長して判定する(列挙表現に対応)。
      const extended = clauses.slice(clauseIndex).join(sep);
      modifier = classifyModifier(extended, dict);
    }
    if (modifier) signals.push({ groupId: mention.groupId, kind: modifier.kind, evidence: modifier.evidence });

    // 維持したい長所(優先度分類とは独立に判定・付与する。secondary 等と共存できる)。
    const preserveHit = containsAny(ownClause, dict.preservePhrases) ?? containsAny(clauses.slice(clauseIndex).join(sep), dict.preservePhrases);
    if (preserveHit) preserveSignals.push({ groupId: mention.groupId, evidence: preserveHit });
  }

  return { signals, preserveSignals, ambiguities };
}

/** 比較優先表現(「AよりB」「AではなくB」「B rather than A」「B instead of A」「not A but B」)を専用に処理する。 */
function classifyComparativePairs(
  sentenceText: string,
  dict: RuleDictionary,
  locale: "ja" | "en",
): { signals: Signal[]; consumedRanges: [number, number][]; evidenceSnippets: string[] } {
  const signals: Signal[] = [];
  const consumedRanges: [number, number][] = [];
  const evidenceSnippets: string[] = [];
  const allMentions = findGroupMentions(sentenceText, dict).filter((m) => m.groupId != null);

  // preferredRange/deemphasizedRange は sentenceText 上の絶対位置([start,end))。
  const applyPair = (preferredRange: [number, number], deemphasizedRange: [number, number], connectorSnippet: string) => {
    const inRange = (m: GroupMention, r: [number, number]) => m.start >= r[0] && m.end <= r[1];
    const preferredMentions = allMentions.filter((m) => inRange(m, preferredRange));
    const deemphasizedMentions = allMentions.filter((m) => inRange(m, deemphasizedRange));
    if (preferredMentions.length === 0 || deemphasizedMentions.length === 0) return false;
    const deemphasizedText = sentenceText.slice(deemphasizedRange[0], deemphasizedRange[1]);
    const ignoreHit = containsAny(deemphasizedText, dict.ignorePhrases);
    for (const m of preferredMentions) {
      signals.push({ groupId: m.groupId as string, kind: "priority", evidence: connectorSnippet });
      consumedRanges.push([m.start, m.end]);
    }
    for (const m of deemphasizedMentions) {
      signals.push({ groupId: m.groupId as string, kind: ignoreHit ? "ignored" : "low", evidence: connectorSnippet });
      consumedRanges.push([m.start, m.end]);
    }
    evidenceSnippets.push(clip(connectorSnippet, MAX_EVIDENCE_SNIPPET));
    return true;
  };

  for (const connector of dict.comparativeConnectors) {
    let from = 0;
    for (;;) {
      const idx = sentenceText.indexOf(connector.marker, from);
      if (idx < 0) break;
      const end = idx + connector.marker.length;
      const leftRange: [number, number] = [0, idx];
      const rightRange: [number, number] = [end, sentenceText.length];
      const preferredRange = connector.direction === "right-preferred" ? rightRange : leftRange;
      const deemphasizedRange = connector.direction === "right-preferred" ? leftRange : rightRange;
      applyPair(preferredRange, deemphasizedRange, sentenceText.slice(Math.max(0, idx - 15), Math.min(sentenceText.length, end + 15)));
      from = end;
    }
  }

  if (locale === "en") {
    const notButPattern = /\bnot\s+(.+?)\s+but\s+(.+?)([.!?;]|$)/i;
    const m = notButPattern.exec(sentenceText);
    if (m && m.index != null && m[1] != null && m[2] != null) {
      const notStart = m.index;
      const xStart = notStart + m[0].indexOf(m[1]);
      const xEnd = xStart + m[1].length;
      const butIdx = sentenceText.indexOf("but", xEnd);
      const yStart = butIdx >= 0 ? butIdx + 3 : xEnd;
      const yEnd = notStart + m[0].length;
      applyPair([yStart, yEnd], [xStart, xEnd], clip(m[0], MAX_EVIDENCE_SNIPPET));
    }
  }

  return { signals, consumedRanges, evidenceSnippets };
}

/** 「Aも欲しいがBが最優先」(ja専用の定型パターン)。Aを補助的優先、Bを最優先として扱う。 */
function classifyAlsoWantButTopPattern(sentenceText: string, dict: RuleDictionary): { signals: Signal[]; consumedRanges: [number, number][]; matched: boolean } {
  const pattern = /(.+?)も(?:欲しい|ほしい)(?:が|けど|ものの)、?\s*(.+?)が(?:最優先|一番重視|最も重視)/;
  const m = pattern.exec(sentenceText);
  if (!m || m.index == null || m[1] == null || m[2] == null) return { signals: [], consumedRanges: [], matched: false };
  const secondaryStart = m.index + m[0].indexOf(m[1]);
  const secondaryEnd = secondaryStart + m[1].length;
  const topStart = m.index + m[0].lastIndexOf(m[2]);
  const topEnd = topStart + m[2].length;

  const allMentions = findGroupMentions(sentenceText, dict).filter((x) => x.groupId != null);
  const inRange = (mm: GroupMention, s: number, e: number) => mm.start >= s && mm.end <= e;
  const secondaryMentions = allMentions.filter((x) => inRange(x, secondaryStart, secondaryEnd));
  const topMentions = allMentions.filter((x) => inRange(x, topStart, topEnd));
  if (secondaryMentions.length === 0 || topMentions.length === 0) return { signals: [], consumedRanges: [], matched: false };

  const evidenceSnippet = clip(m[0], MAX_EVIDENCE_SNIPPET);
  const signals: Signal[] = [
    ...secondaryMentions.map((x) => ({ groupId: x.groupId as string, kind: "secondary" as ModifierKind, evidence: evidenceSnippet })),
    ...topMentions.map((x) => ({ groupId: x.groupId as string, kind: "priority" as ModifierKind, evidence: evidenceSnippet })),
  ];
  const consumedRanges: [number, number][] = [...secondaryMentions, ...topMentions].map((x) => [x.start, x.end]);
  return { signals, consumedRanges, matched: true };
}

/** 文・意味単位への分割(句点・改行・セミコロン・箇条書き記号・接続表現)。 */
function splitIntoSentences(freeText: string, dict: RuleDictionary): string[] {
  let working = freeText;
  // 箇条書き記号を文区切りとして扱う(行頭の ・ - * 数字.)。
  working = working.replace(/^[ \t]*[・*][ \t]*/gm, "\n");
  working = working.replace(/^[ \t]*\d+[.)、][ \t]*/gm, "\n");

  const enderSet = new Set(dict.sentenceEnderChars);
  const rawSentences: string[] = [];
  let current = "";
  for (const ch of working) {
    if (enderSet.has(ch)) {
      if (current.trim().length > 0) rawSentences.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim().length > 0) rawSentences.push(current);

  // 接続表現(ただし/でも/一方で/その代わり/but/however/instead)でさらに分割する。
  // ただし、英語の "not X but Y" は専用パターンとして扱うため、"but" では分割しない
  // (先に but で切ってしまうと、否定範囲の関係("not"と"but"の対応)が失われるため)。
  const final: string[] = [];
  for (const s of rawSentences) {
    let remaining = s;
    let splitAgain = true;
    while (splitAgain) {
      splitAgain = false;
      for (const connector of dict.clauseConnectorPhrases) {
        if (connector === "but" && /\bnot\b/i.test(remaining)) continue;
        const idx = remaining.indexOf(connector);
        if (idx > 0) {
          final.push(remaining.slice(0, idx));
          remaining = remaining.slice(idx + connector.length);
          splitAgain = true;
          break;
        }
      }
    }
    if (remaining.trim().length > 0) final.push(remaining);
  }
  return final.map((s) => s.trim()).filter((s) => s.length > 0);
}

/** 英語は "use ... at" のように語順・語間が空くため、緩やかな語順パターンでも使用意図として認める。 */
const EN_USAGE_INTENT_PATTERN = /\b(use|play|deploy|field)\b[\s\S]{0,25}?\b(at|as)\b/i;

function resolvePositions(sentences: string[], dict: RuleDictionary, availablePositions: string[], locale: "ja" | "en"): { positions: string[]; ambiguity: string | null } {
  const strongCandidates = new Set<string>();
  for (const sentence of sentences) {
    const hasUsageIntent = dict.usageIntentPhrases.some((p) => sentence.includes(p)) || (locale === "en" && EN_USAGE_INTENT_PATTERN.test(sentence));
    if (!hasUsageIntent) continue;
    for (const entry of dict.positionPhrases) {
      if (!availablePositions.includes(entry.position)) continue;
      if (entry.phrases.some((p) => sentence.includes(p))) strongCandidates.add(entry.position);
    }
  }
  if (strongCandidates.size === 0) return { positions: [], ambiguity: null };
  if (strongCandidates.size === 1) return { positions: [...strongCandidates], ambiguity: null };
  return { positions: [], ambiguity: `multiple candidate positions detected (${[...strongCandidates].join(", ")}); needs confirmation` };
}

function resolveGoal(sentences: string[], dict: RuleDictionary): { goal: PrimaryGoalId | "unspecified"; ambiguity: string | null } {
  const matched = new Set<PrimaryGoalId>();
  for (const sentence of sentences) {
    for (const entry of dict.goalPhrases) {
      if (entry.phrases.some((p) => sentence.includes(p))) matched.add(entry.goal);
    }
  }
  if (matched.size === 0) return { goal: "unspecified", ambiguity: null };
  if (matched.size === 1) return { goal: [...matched][0], ambiguity: null };
  return { goal: "unspecified", ambiguity: `multiple candidate primary goals detected (${[...matched].join(", ")}); needs confirmation` };
}

function resolveComparisonTarget(
  sentences: string[],
  availableComparisonBuilds: { buildId: string; buildName: string }[],
): { buildId: string | null; focusGroupsSentence: string | null; ambiguity: string | null } {
  if (availableComparisonBuilds.length === 0) return { buildId: null, focusGroupsSentence: null, ambiguity: null };
  const matches = new Map<string, string>(); // buildId -> sentence containing the reference
  for (const sentence of sentences) {
    for (const b of availableComparisonBuilds) {
      // sentences は locale に応じて既に大文字小文字を正規化済み(en は小文字化)のため、
      // buildName 側も同じ変換をしてから比較する(大文字小文字の違いで一致を取りこぼさない)。
      const normalizedName = b.buildName.toLowerCase();
      if (normalizedName.length > 0 && sentence.toLowerCase().includes(normalizedName)) {
        if (!matches.has(b.buildId)) matches.set(b.buildId, sentence);
      }
    }
  }
  if (matches.size === 0) return { buildId: null, focusGroupsSentence: null, ambiguity: null };
  if (matches.size === 1) {
    const [[buildId, sentence]] = [...matches.entries()];
    return { buildId, focusGroupsSentence: sentence, ambiguity: null };
  }
  return { buildId: null, focusGroupsSentence: null, ambiguity: `multiple candidate comparison targets detected (${[...matches.keys()].join(", ")}); needs confirmation` };
}

/**
 * 自由記述をルールベースで解析する(外部通信・生成AI・現在日時分岐・Math.randomを一切使用しない・
 * 同一入力からは常に同一結果を返す純関数)。
 */
export function parseBuildIntentFreeText(request: BuildIntentExtractionRequest): RawRuleExtraction {
  const dict: RuleDictionary = request.locale === "ja" ? BUILD_INTENT_RULE_DICTIONARY_JA : BUILD_INTENT_RULE_DICTIONARY_EN;
  // 英語は大文字小文字の違いを正規化してから解析する(日本語は大文字小文字の区別がないため素通し)。
  const searchText = request.locale === "en" ? request.freeText.toLowerCase() : request.freeText;

  const sentences = splitIntoSentences(searchText, dict);

  const priorityGroups = new Set<string>();
  const secondaryGroups = new Set<string>();
  const normalGroups = new Set<string>();
  const lowPriorityGroups = new Set<string>();
  const avoidOverinvestmentGroups = new Set<string>();
  const intentionallyIgnoredGroups = new Set<string>();
  const strengthsToPreserve = new Set<string>();
  const ambiguities: string[] = [];
  const evidence: string[] = [];
  const unanalyzedSentences: string[] = [];

  const applySignal = (s: Signal) => {
    switch (s.kind) {
      case "priority":
        priorityGroups.add(s.groupId);
        break;
      case "secondary":
        secondaryGroups.add(s.groupId);
        break;
      case "normal":
        normalGroups.add(s.groupId);
        break;
      case "low":
        lowPriorityGroups.add(s.groupId);
        break;
      case "avoidOverinvestment":
        avoidOverinvestmentGroups.add(s.groupId);
        break;
      case "ignored":
        intentionallyIgnoredGroups.add(s.groupId);
        break;
    }
    if (evidence.length < MAX_EVIDENCE && s.evidence) evidence.push(clip(s.evidence, MAX_EVIDENCE_SNIPPET));
  };

  for (const sentence of sentences) {
    let sentenceHadSignal = false;

    const comparative = classifyComparativePairs(sentence, dict, request.locale);
    for (const s of comparative.signals) {
      applySignal(s);
      sentenceHadSignal = true;
    }

    let alsoWantButConsumed: [number, number][] = [];
    if (request.locale === "ja") {
      const alsoWantBut = classifyAlsoWantButTopPattern(sentence, dict);
      if (alsoWantBut.matched) {
        for (const s of alsoWantBut.signals) {
          applySignal(s);
          sentenceHadSignal = true;
        }
        alsoWantButConsumed = alsoWantBut.consumedRanges;
      }
    }

    const consumedRanges = [...comparative.consumedRanges, ...alsoWantButConsumed];
    const { signals, preserveSignals, ambiguities: mentionAmbiguities } = classifyMentionsInSentence(sentence, dict, request.locale, consumedRanges);
    for (const s of signals) {
      applySignal(s);
      sentenceHadSignal = true;
    }
    for (const p of preserveSignals) {
      strengthsToPreserve.add(p.groupId);
      if (evidence.length < MAX_EVIDENCE) evidence.push(clip(p.evidence, MAX_EVIDENCE_SNIPPET));
      sentenceHadSignal = true;
    }
    for (const a of mentionAmbiguities) ambiguities.push(a);
    if (mentionAmbiguities.length > 0) sentenceHadSignal = true;

    if (dict.balanceHintPhrases.some((p) => sentence.includes(p))) sentenceHadSignal = true;

    if (!sentenceHadSignal && sentence.trim().length > 0) {
      unanalyzedSentences.push(sentence.trim());
    }
  }

  const positionResult = resolvePositions(sentences, dict, request.availablePositions, request.locale);
  if (positionResult.ambiguity) ambiguities.push(positionResult.ambiguity);

  let goalResult = resolveGoal(sentences, dict);
  if (goalResult.ambiguity) ambiguities.push(goalResult.ambiguity);
  if (dict.balanceHintPhrases.some((p) => sentences.some((s) => s.includes(p))) && goalResult.goal === "unspecified") {
    goalResult = { goal: "balance", ambiguity: null };
  }

  const comparisonResult = resolveComparisonTarget(sentences, request.availableComparisonBuilds);
  if (comparisonResult.ambiguity) ambiguities.push(comparisonResult.ambiguity);
  const comparisonFocusGroups = new Set<string>();
  if (comparisonResult.focusGroupsSentence) {
    for (const m of findGroupMentions(comparisonResult.focusGroupsSentence, dict)) {
      if (m.groupId) comparisonFocusGroups.add(m.groupId);
    }
  }

  // サッカー用途・役割表現(例:「クロスゲーム」)の検出。役割自体が一意なものは主目的だけを
  // 直接設定し(能力領域の確定はしない)、複数の妥当な解釈があるものは候補確認へ回す。
  // 明示的な優先度表現で既に該当領域が解決済みの場合は、冗長な確認を出さずスキップする。
  const roleRules: FootballRoleRuleEntry[] = request.locale === "ja" ? FOOTBALL_ROLE_RULES_JA : FOOTBALL_ROLE_RULES_EN;
  const roleRulePhrases = roleRules.map((r) => r.phrase);
  const roleOccurrences = findPhraseOccurrences(searchText, roleRulePhrases);
  const clarifications: BuildIntentClarification[] = [];
  const appliedClarificationTemplates = new Set<string>();
  let clarificationSeq = 0;
  let goalOverride: PrimaryGoalId | null = null;
  for (const occ of roleOccurrences) {
    const rule = roleRules.find((r) => r.phrase === occ.matched);
    if (!rule) continue;
    if (rule.outcome.kind === "direct-goal") {
      if (goalOverride === null && goalResult.goal === "unspecified") goalOverride = rule.outcome.goal;
      if (evidence.length < MAX_EVIDENCE) evidence.push(clip(occ.matched, MAX_EVIDENCE_SNIPPET));
    } else {
      const templateId = rule.outcome.templateId;
      if (appliedClarificationTemplates.has(templateId)) continue;
      const relevantGroupIds = getClarificationTemplateRelevantGroupIds(templateId);
      const alreadyResolved = relevantGroupIds.some((g) => priorityGroups.has(g) || secondaryGroups.has(g));
      if (alreadyResolved) continue;
      appliedClarificationTemplates.add(templateId);
      clarificationSeq += 1;
      clarifications.push(buildClarificationFromTemplate(templateId, `role-${clarificationSeq}`, occ.matched));
    }
  }
  if (goalOverride !== null && goalResult.goal === "unspecified") {
    goalResult = { goal: goalOverride, ambiguity: goalResult.ambiguity };
  }

  // 文単位のループでは「優先度・比較・維持」等の信号だけを判定するため、位置・主目的・比較対象・
  // 役割表現への参照だけを含む文を誤って「読み取れなかった内容」に含めないよう、ここで改めて確認する。
  // 内部プレフィックス(旧 "unanalyzed:")を含まない、素のテキスト断片として保持する
  // (UIはこれを自然文の案内メッセージに変換して表示する。内部IDやプレフィックスを直接表示しない)。
  const allPositionPhrases = dict.positionPhrases.flatMap((p) => p.phrases);
  const allGoalPhrases = dict.goalPhrases.flatMap((g) => g.phrases);
  const comparisonNames = request.availableComparisonBuilds.map((b) => b.buildName.toLowerCase()).filter((n) => n.length > 0);
  const unanalyzedSegments: string[] = [];
  for (const sentence of unanalyzedSentences) {
    const lower = sentence.toLowerCase();
    const referencesKnownConcept =
      allPositionPhrases.some((p) => sentence.includes(p)) ||
      allGoalPhrases.some((p) => sentence.includes(p)) ||
      comparisonNames.some((n) => lower.includes(n)) ||
      dict.balanceHintPhrases.some((p) => sentence.includes(p)) ||
      roleRulePhrases.some((p) => sentence.includes(p));
    if (!referencesKnownConcept) unanalyzedSegments.push(clip(sentence, 80));
  }
  const unanalyzedCount = unanalyzedSegments.length;

  const hasPosition = positionResult.positions.length > 0;
  const hasGoal = goalResult.goal !== "unspecified";
  const hasTopPriority = priorityGroups.size > 0;
  const totalMentions = priorityGroups.size + secondaryGroups.size + normalGroups.size + lowPriorityGroups.size + avoidOverinvestmentGroups.size + intentionallyIgnoredGroups.size;

  let confidence: "high" | "medium" | "low";
  if (ambiguities.length > 0) confidence = "low";
  else if (clarifications.length > 0) confidence = "medium";
  else if (!hasPosition && !hasGoal && totalMentions === 0) confidence = "low";
  else if (hasPosition && hasGoal && hasTopPriority && unanalyzedCount === 0) confidence = "high";
  else confidence = "medium";

  return {
    intendedPositions: positionResult.positions,
    primaryGoal: goalResult.goal,
    priorityGroups: [...priorityGroups],
    secondaryGroups: [...secondaryGroups],
    normalGroups: [...normalGroups],
    lowPriorityGroups: [...lowPriorityGroups],
    avoidOverinvestmentGroups: [...avoidOverinvestmentGroups],
    intentionallyIgnoredGroups: [...intentionallyIgnoredGroups],
    comparisonTargetBuildId: comparisonResult.buildId,
    comparisonFocusGroups: [...comparisonFocusGroups],
    strengthsToPreserve: [...strengthsToPreserve],
    ambiguities: ambiguities.slice(0, MAX_AMBIGUITIES),
    clarifications,
    unanalyzedSegments: unanalyzedSegments.slice(0, MAX_AMBIGUITIES),
    confidence,
    evidence: evidence.slice(0, MAX_EVIDENCE),
  };
}
