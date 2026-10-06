import type { PartialDictionary } from "../../translate";
import core from "./it/core";
import b1 from "./it/b1";
import b2 from "./it/b2";
import b3 from "./it/b3";
import b4 from "./it/b4";
import b5 from "./it/b5";
import b6 from "./it/b6";
import b7 from "./it/b7";
import b8 from "./it/b8";
// 計算ライブラリが作る文の訳・ゲームの用語（読み込みと同時に登録される）
import "./it/generated";
import "./it/game-terms";

/**
 * Italiano (it) — machine-assisted translation of every public screen (2026-10-06). Not reviewed by a native speaker.
 * 法務文書（terms・privacy・disclaimer）は本人の方針で訳さず English で表示する（専門家のレビューの無い法務の訳を出さない）。
 * 名前空間はファイルごとに重ならない（core: 核・ホーム / b1〜b8: 画面ごと）。言語ごとに 1 つの別 chunk（その言語を選んだときだけ読み込む）。
 */
const it: PartialDictionary = { ...core, ...b1, ...b2, ...b3, ...b4, ...b5, ...b6, ...b7, ...b8 };

export default it;
