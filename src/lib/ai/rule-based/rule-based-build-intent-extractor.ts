import type { BuildIntentExtractor, BuildIntentExtractionRequest, BuildIntentExtractionResult } from "@/lib/ai/build-intent-extractor";
import { validateBuildIntentExtraction } from "@/lib/ai/build-intent-extractor";
import { parseBuildIntentFreeText } from "./build-intent-rule-parser";

/**
 * 追加費用ゼロの標準抽出器(本物の生成AI・外部AI API・APIキー・課金サービスを一切使用しない)。
 *
 * - 自由記述を、決定的な辞書・文法ルールだけで構造化する(src/lib/ai/rule-based/build-intent-rule-parser.ts)。
 * - HTTP通信・外部API・生成AI・自然言語モデル・クラウドサービス・ネットワークアクセスを一切行わない。
 * - 現在日時による分岐・Math.random を使用しない(同一入力からは常に同一結果)。
 * - 自由記述・解析結果を保存しない(呼び出し元のReact stateのみで完結する)。
 * - 出力は必ず {@link validateBuildIntentExtraction} を通してから返す
 *   (許可された列挙値以外は破棄・矛盾は自動解消せず ambiguities として残す)。
 * - 能力値・育成ポイント・OVR・勝率・順位は一切生成しない(型として保持する余地もない)。
 *
 * ユーザー向け表示では、この実装による解析結果を「生成AIによる解析」と表現しないこと
 * (呼び出し側のUI文言は「標準解析・ルールベース」と表示する)。
 */
export class RuleBasedBuildIntentExtractor implements BuildIntentExtractor {
  async extract(request: BuildIntentExtractionRequest, signal?: AbortSignal): Promise<BuildIntentExtractionResult> {
    if (signal?.aborted) {
      return { ok: false, error: { code: "TIMEOUT", message: "The request was aborted before rule-based analysis completed." } };
    }
    if (!request || typeof request.freeText !== "string" || request.freeText.trim().length === 0) {
      return { ok: false, error: { code: "INVALID_INPUT", message: "freeText is required for rule-based analysis." } };
    }
    try {
      const raw = parseBuildIntentFreeText(request);
      const extraction = validateBuildIntentExtraction(raw, {
        availablePositions: request.availablePositions,
        availableComparisonBuildIds: request.availableComparisonBuilds.map((b) => b.buildId),
      });
      return { ok: true, extraction };
    } catch {
      // 解析ロジックの想定外の例外でも、成功したふりをせず安全なエラーを返す
      // (内部の正規表現・辞書構造など、実装詳細はユーザーへ露出しない)。
      return { ok: false, error: { code: "INVALID_RESPONSE", message: "Rule-based build intent analysis failed to complete safely." } };
    }
  }
}
