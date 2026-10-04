import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 legacyPlayerDetail（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const legacyPlayerDetail: Dictionary["legacyPlayerDetail"] = {
  backToList: "← プレイヤー一覧へ戻る",
  noJapaneseName: "（日本語名なし）",
  noEnglishName: "（英語名なし）",
  efhubIdLabel: "選手ID（eFHUB）",
  ovrLabel: "OVR",
  provenanceHeading: "データの来歴",
  dataSourceLabel: "データソース",
  sourceUrlLabel: "取得元 URL",
  httpMethodLabel: "HTTP メソッド",
  fetchedAtLabel: "取得日時",
  noSourceInfo: "取得元情報がありません。",
  futureHeading: "今後のバージョンで実装予定",
  futureDescription:
    "能力値（攻撃/守備/身体能力）、スキル、プレースタイル、ポジション別総合値、育成、ブースター、Tier、選手比較。これらは eFHUB の個別選手データを追加調査したうえで実装します（docs/efootball-team-ai-design.md の Phase 1〜2）。",
  imageProxyNote: "選手画像は efimg.com から自前プロキシ（/api/player-image/[id]）経由で取得しています。",
  };

registerJaNamespace("legacyPlayerDetail", legacyPlayerDetail);

export default legacyPlayerDetail;
