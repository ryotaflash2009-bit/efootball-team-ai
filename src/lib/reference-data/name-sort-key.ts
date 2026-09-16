/**
 * SQLiteの`COLLATE NOCASE`と完全に同じ並び順になる正規化ソートキーを計算する純関数。
 *
 * SQLiteの`NOCASE`は「ASCIIの26文字の大文字だけを小文字へ畳み込み、それ以外は一切変更せず、
 * 結果の文字列をバイト単位(memcmp)で比較する」という仕様(非ASCII文字の大文字小文字は
 * 一切畳み込まない。SQLite公式ドキュメントで明記されている)。
 *
 * PostgreSQL側で"C"照合順序(バイト単位比較、UTF-8エンコードされたテキストに対する
 * 単純なバイト比較で、Unicodeコードポイント順と一致する)を明示的に指定した列へ、
 * この関数で計算した値をあらかじめ格納しておけば、`ORDER BY <この列>`だけで
 * SQLiteの`ORDER BY name_en COLLATE NOCASE`と同じ並び順を、DB側のインデックス付き
 * ソート・ページングを維持したまま再現できる(PostgreSQL側のlower()やロケール依存の
 * 既定照合順序には一切依存しない。ロケール依存関数はサーバーの実際のロケール設定次第で
 * 挙動が変わりうるため、意図的に避けている)。
 */

const ASCII_UPPER_A = 0x41; // 'A'
const ASCII_UPPER_Z = 0x5a; // 'Z'
const ASCII_TO_LOWER_OFFSET = 0x20;

/**
 * ASCIIの大文字だけを小文字へ畳み込む(非ASCII文字は一切変更しない)。
 * `String.prototype.toLowerCase()`は使わない(ロケール・Unicode正規化により、
 * "Å"→"å"のような非ASCII文字まで畳み込んでしまう場合があり、SQLiteのNOCASEの
 * 「非ASCIIは畳み込まない」という仕様と食い違うため)。
 */
export function asciiNocaseFold(input: string): string {
  let out = "";
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    out += code >= ASCII_UPPER_A && code <= ASCII_UPPER_Z ? String.fromCharCode(code + ASCII_TO_LOWER_OFFSET) : input[i];
  }
  return out;
}

/**
 * name_en(NOT NULL制約あり、null/undefinedは想定外だが防御的にnullを許容する)から
 * ソートキーを計算する。
 */
export function computeNameSortKey(nameEn: string | null | undefined): string | null {
  if (nameEn == null) return null;
  return asciiNocaseFold(nameEn);
}

/**
 * 2つの文字列を「SQLiteのCOLLATE NOCASE + BINARY(バイト単位)比較」と同じ規則で比較する。
 * 主キータイブレーク等、JS側で同等の順序を再現・検証したい場合に使う
 * (実際のPostgreSQL側の並び替えはDBに任せ、この関数はローカル検証・テスト専用)。
 * UTF-16コード単位での`<`/`>`比較は、基本多言語面(BMP)内の文字ではUTF-8バイト順と
 * 一致する(サロゲートペアが必要な文字は実データの人名に通常現れないため対象外とする)。
 */
export function compareNocaseCompatible(a: string, b: string): number {
  const fa = asciiNocaseFold(a);
  const fb = asciiNocaseFold(b);
  if (fa < fb) return -1;
  if (fa > fb) return 1;
  return 0;
}
