/**
 * F-084 写真付き投稿: 画像ファイルの安全確認（純関数・ブラウザー API を使わない部分）。
 *
 * - 形式は先頭のバイト（マジックナンバー）で判定する。拡張子・ファイル名・申告された MIME だけを信用しない。
 * - 受け付ける入力: JPEG・PNG・WebP（HEIC/HEIF は形式としては判定するが、ブラウザーが読めない場合は案内して止める）。
 * - 拒否: SVG（スクリプトを含みうる）・GIF（動画的な使い方・今回の対象外）・実行形式・PDF・ZIP・不明な形式・壊れたファイル。
 * - 解像度はデコード前にヘッダーから読む（巨大な画素数で端末のメモリを使い切る「解凍爆弾」相当を防ぐ）。
 * - 出力は必ず再エンコードする（EXIF・GPS・撮影端末・撮影日時などのメタデータは残らない）。
 */
export type DetectedImageType = "jpeg" | "png" | "webp" | "heic";
export type RejectReason =
  | "empty"
  | "too_large_file"
  | "svg_not_allowed"
  | "gif_not_allowed"
  | "executable_or_document"
  | "unknown_format"
  | "mime_mismatch"
  | "corrupt_header"
  | "too_many_pixels"
  | "too_small";

export const POST_IMAGE_LIMITS = Object.freeze({
  /** 選んだファイルの上限（スマホの写真を想定）。 */
  maxInputBytes: 20 * 1024 * 1024,
  /** デコード前に確認する画素数の上限（約 48MP。これを超える画像はデコードしない）。 */
  maxInputPixels: 48_000_000,
  /** 長辺の最小（小さすぎる画像は内容が読めない）。 */
  minEdge: 64,
  /** 再エンコード後の長辺の上限。 */
  outputMaxEdge: 2048,
  /** 再エンコード後のファイルの上限。 */
  maxOutputBytes: 1_500_000,
});

const MIME_OF: Record<DetectedImageType, string[]> = {
  jpeg: ["image/jpeg", "image/jpg", "image/pjpeg"],
  png: ["image/png"],
  webp: ["image/webp"],
  heic: ["image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"],
};

const ascii = (b: Uint8Array, start: number, len: number) => String.fromCharCode(...b.subarray(start, start + len));

/** 先頭のバイトから形式を判定する（少なくとも先頭 64 バイトを渡す）。 */
export function sniffImageType(head: Uint8Array): { ok: true; type: DetectedImageType } | { ok: false; reason: RejectReason } {
  if (head.length === 0) return { ok: false, reason: "empty" };
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return { ok: true, type: "jpeg" };
  if (head.length >= 8 && head[0] === 0x89 && ascii(head, 1, 3) === "PNG" && head[4] === 0x0d && head[5] === 0x0a && head[6] === 0x1a && head[7] === 0x0a) return { ok: true, type: "png" };
  if (head.length >= 12 && ascii(head, 0, 4) === "RIFF" && ascii(head, 8, 4) === "WEBP") return { ok: true, type: "webp" };
  if (head.length >= 12 && ascii(head, 4, 4) === "ftyp") {
    const brand = ascii(head, 8, 4);
    if (["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1", "heif"].includes(brand)) return { ok: true, type: "heic" };
    return { ok: false, reason: "unknown_format" }; // MP4・MOV など
  }
  if (head.length >= 6 && (ascii(head, 0, 6) === "GIF87a" || ascii(head, 0, 6) === "GIF89a")) return { ok: false, reason: "gif_not_allowed" };
  if ((head[0] === 0x4d && head[1] === 0x5a) || (head[0] === 0x7f && ascii(head, 1, 3) === "ELF") || ascii(head, 0, 4) === "%PDF" || (head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04) || ascii(head, 0, 2) === "#!") {
    return { ok: false, reason: "executable_or_document" };
  }
  // テキストとして読めて <svg / <?xml / <!DOCTYPE / <html を含むものは SVG・HTML として拒否する。
  const text = ascii(head, 0, Math.min(head.length, 256)).replace(/^﻿/, "").trimStart().toLowerCase();
  if (text.startsWith("<svg") || text.startsWith("<?xml") || text.startsWith("<!doctype") || text.startsWith("<html") || text.includes("<svg")) return { ok: false, reason: "svg_not_allowed" };
  return { ok: false, reason: "unknown_format" };
}

/** 申告された MIME（空なら確認しない）と、実際の形式が食い違っていないか。 */
export function mimeMatches(declared: string, type: DetectedImageType): boolean {
  const d = declared.trim().toLowerCase();
  if (d === "" || d === "application/octet-stream") return true; // 一部の端末は空・汎用で渡す（中身で判定済み）
  return MIME_OF[type].includes(d);
}

const u16be = (b: Uint8Array, o: number) => (b[o] << 8) | b[o + 1];
const u32be = (b: Uint8Array, o: number) => ((b[o] << 24) >>> 0) + (b[o + 1] << 16) + (b[o + 2] << 8) + b[o + 3];
const u16le = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const u24le = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16);

/**
 * デコードせずにヘッダーから幅・高さを読む（JPEG は先頭から SOF を探す。最大 `bytes` の範囲だけを見る）。
 * HEIC は読まない（null）。読めない・壊れているときは null。
 */
export function readImageDimensions(bytes: Uint8Array, type: DetectedImageType): { width: number; height: number } | null {
  try {
    if (type === "png") {
      if (bytes.length < 24 || ascii(bytes, 12, 4) !== "IHDR") return null;
      return { width: u32be(bytes, 16), height: u32be(bytes, 20) };
    }
    if (type === "webp") {
      const chunk = ascii(bytes, 12, 4);
      if (chunk === "VP8X" && bytes.length >= 30) return { width: u24le(bytes, 24) + 1, height: u24le(bytes, 27) + 1 };
      if (chunk === "VP8 " && bytes.length >= 30) return { width: u16le(bytes, 26) & 0x3fff, height: u16le(bytes, 28) & 0x3fff };
      if (chunk === "VP8L" && bytes.length >= 25) {
        const b = bytes;
        const width = 1 + (((b[22] & 0x3f) << 8) | b[21]);
        const height = 1 + (((b[24] & 0x0f) << 10) | (b[23] << 2) | ((b[22] & 0xc0) >> 6));
        return { width, height };
      }
      return null;
    }
    if (type === "jpeg") {
      let o = 2;
      while (o + 9 < bytes.length) {
        if (bytes[o] !== 0xff) return null;
        const marker = bytes[o + 1];
        if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
          o += 2;
          continue;
        }
        const len = u16be(bytes, o + 2);
        if (len < 2) return null;
        // SOF0〜SOF15（DHT=C4・JPG=C8・DAC=CC を除く）
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { height: u16be(bytes, o + 5), width: u16be(bytes, o + 7) };
        }
        o += 2 + len;
      }
      return null;
    }
    return null;
  } catch {
    return null;
  }
}

/** ファイルとして受け付けてよいか（サイズ・形式・MIME・画素数）。`bytes` は先頭から最大 512KB 程度で足りる。 */
export function checkPostImageFile(input: { size: number; declaredType: string; bytes: Uint8Array }):
  | { ok: true; type: DetectedImageType; width: number | null; height: number | null }
  | { ok: false; reason: RejectReason } {
  if (input.size <= 0) return { ok: false, reason: "empty" };
  if (input.size > POST_IMAGE_LIMITS.maxInputBytes) return { ok: false, reason: "too_large_file" };
  const sniff = sniffImageType(input.bytes.subarray(0, 512));
  if (!sniff.ok) return sniff;
  if (!mimeMatches(input.declaredType, sniff.type)) return { ok: false, reason: "mime_mismatch" };
  if (sniff.type === "heic") return { ok: true, type: "heic", width: null, height: null };
  const dims = readImageDimensions(input.bytes, sniff.type);
  if (!dims || dims.width <= 0 || dims.height <= 0) return { ok: false, reason: "corrupt_header" };
  if (dims.width * dims.height > POST_IMAGE_LIMITS.maxInputPixels) return { ok: false, reason: "too_many_pixels" };
  if (Math.max(dims.width, dims.height) < POST_IMAGE_LIMITS.minEdge) return { ok: false, reason: "too_small" };
  return { ok: true, type: sniff.type, width: dims.width, height: dims.height };
}

/** 回転（90 度単位）とトリミング（元画像の座標）を適用したあとの出力サイズ（長辺を上限へ縮小）。 */
export function planOutputSize(source: { width: number; height: number }, rotation: 0 | 90 | 180 | 270, crop: { x: number; y: number; width: number; height: number } | null): { cropW: number; cropH: number; outW: number; outH: number } {
  const cx = crop ? Math.max(0, Math.min(crop.x, source.width - 1)) : 0;
  const cy = crop ? Math.max(0, Math.min(crop.y, source.height - 1)) : 0;
  const cropW = crop ? Math.max(1, Math.min(crop.width, source.width - cx)) : source.width;
  const cropH = crop ? Math.max(1, Math.min(crop.height, source.height - cy)) : source.height;
  const rotated = rotation === 90 || rotation === 270 ? { w: cropH, h: cropW } : { w: cropW, h: cropH };
  const scale = Math.min(1, POST_IMAGE_LIMITS.outputMaxEdge / Math.max(rotated.w, rotated.h));
  return { cropW, cropH, outW: Math.max(1, Math.round(rotated.w * scale)), outH: Math.max(1, Math.round(rotated.h * scale)) };
}

/** 再エンコードの品質を下げながら、上限サイズに収まる最初の結果を選ぶ（エンコーダーは呼び出し側が渡す）。 */
export async function encodeWithinLimit(encode: (quality: number) => Promise<Blob | null>, maxBytes = POST_IMAGE_LIMITS.maxOutputBytes): Promise<{ ok: true; blob: Blob; quality: number } | { ok: false; reason: "encode_failed" | "still_too_large" }> {
  for (const q of [0.86, 0.78, 0.7, 0.6, 0.5]) {
    const blob = await encode(q);
    if (!blob) return { ok: false, reason: "encode_failed" };
    if (blob.size <= maxBytes) return { ok: true, blob, quality: q };
  }
  return { ok: false, reason: "still_too_large" };
}
