import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 comparePage（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const comparePage: Dictionary["comparePage"] = {
  title: "選手比較",
  description: "2〜4 人の World カードを並べて、基本情報・26 能力値・スキル・育成ビルド・監督補正を比較します。育成の対象能力は eFHUB基準、OVR は推定です。URL に選手・育成方針・監督が入り、共有できます。",
  backToPlayers: "プレイヤー一覧へ",
  dataUnavailableTitle: "データが利用できません",
  dataUnavailableDescription: "SQLite に World データが取り込まれていません。",
  };

registerJaNamespace("comparePage", comparePage);

export default comparePage;
