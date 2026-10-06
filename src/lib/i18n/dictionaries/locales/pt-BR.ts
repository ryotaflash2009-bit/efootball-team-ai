import type { PartialDictionary } from "../../translate";
import core from "./pt-BR/core";
import b1 from "./pt-BR/b1";
import b2 from "./pt-BR/b2";
import b3 from "./pt-BR/b3";
import b4 from "./pt-BR/b4";
import b5 from "./pt-BR/b5";
import b6 from "./pt-BR/b6";
import b7 from "./pt-BR/b7";
import b8 from "./pt-BR/b8";
// 計算ライブラリが作る文の訳（読み込みと同時に登録される）
import "./pt-BR/generated";
import "./pt-BR/game-terms";

/**
 * Português (Brasil) (pt-BR) — machine-assisted translation of every public screen (2026-10-06). Not reviewed by a native speaker.
 * 法務文書（terms・privacy・disclaimer）は本人の方針で訳さず English で表示する（専門家のレビューの無い法務の訳を出さない）。
 * 名前空間はファイルごとに重ならない（core: 核・ホーム / b1〜b8: 画面ごと）。言語ごとに 1 つの別 chunk（その言語を選んだときだけ読み込む）。
 */
const ptBR: PartialDictionary = { ...core, ...b1, ...b2, ...b3, ...b4, ...b5, ...b6, ...b7, ...b8 };

export default ptBR;
