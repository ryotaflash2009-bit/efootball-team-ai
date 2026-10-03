// Vitest の setup: 実行時に英語の辞書を読み込んだ後と同じ状態にする（本番では英語を選んだときに後から読み込む）。
import en from "@/lib/i18n/dictionaries/en";
import { registerDictionary } from "@/lib/i18n/translate";

registerDictionary("en", en);
