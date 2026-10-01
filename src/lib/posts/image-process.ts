"use client";

import { checkPostImageFile, encodeWithinLimit, planOutputSize, sniffImageType, type RejectReason } from "./image-safety";

/**
 * F-084: 選んだ写真を、投稿用の安全な画像へ作り直す（ブラウザー内だけ・送信しない）。
 * 1. 先頭のバイトで形式・MIME・画素数を確認（デコード前）
 * 2. 向き（EXIF の Orientation）を反映してデコード（iPhone の縦写真が横にならない）
 * 3. 回転・トリミング・縮小して canvas へ描き、WebP（使えなければ JPEG）で再エンコード
 *    → EXIF・GPS・撮影端末・撮影日時などのメタデータは一切残らない
 * 4. 出力も先頭のバイトで確認し、上限サイズに収まらなければ失敗
 */
export type ProcessFailure = RejectReason | "heic_unsupported" | "decode_failed" | "encode_failed" | "still_too_large" | "aborted";
export type ProcessedImage = { blob: Blob; mime: "image/webp" | "image/jpeg"; width: number; height: number };

const HEAD_BYTES = 512 * 1024;

async function decode(file: Blob): Promise<ImageBitmap | null> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return null;
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (typeof canvas.toBlob !== "function") return resolve(null);
    canvas.toBlob((b) => resolve(b), type, quality);
  });
}

export async function checkSelectedFile(file: File): Promise<{ ok: true; type: string } | { ok: false; reason: ProcessFailure }> {
  const head = new Uint8Array(await file.slice(0, HEAD_BYTES).arrayBuffer());
  const r = checkPostImageFile({ size: file.size, declaredType: file.type, bytes: head });
  return r.ok ? { ok: true, type: r.type } : { ok: false, reason: r.reason };
}

export async function processPostImage(
  file: File,
  opts: { rotation: 0 | 90 | 180 | 270; crop: { x: number; y: number; width: number; height: number } | null; signal?: AbortSignal },
): Promise<{ ok: true; image: ProcessedImage } | { ok: false; reason: ProcessFailure }> {
  const aborted = () => opts.signal?.aborted === true;
  const head = new Uint8Array(await file.slice(0, HEAD_BYTES).arrayBuffer());
  const check = checkPostImageFile({ size: file.size, declaredType: file.type, bytes: head });
  if (!check.ok) return check;
  if (aborted()) return { ok: false, reason: "aborted" };

  const bitmap = await decode(file);
  if (!bitmap) return { ok: false, reason: check.type === "heic" ? "heic_unsupported" : "decode_failed" };
  let canvas: HTMLCanvasElement | null = null;
  try {
    if (aborted()) return { ok: false, reason: "aborted" };
    const plan = planOutputSize({ width: bitmap.width, height: bitmap.height }, opts.rotation, opts.crop);
    canvas = document.createElement("canvas");
    canvas.width = plan.outW;
    canvas.height = plan.outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { ok: false, reason: "decode_failed" };
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, plan.outW, plan.outH);
    ctx.save();
    ctx.translate(plan.outW / 2, plan.outH / 2);
    ctx.rotate((opts.rotation * Math.PI) / 180);
    const drawW = opts.rotation === 90 || opts.rotation === 270 ? plan.outH : plan.outW;
    const drawH = opts.rotation === 90 || opts.rotation === 270 ? plan.outW : plan.outH;
    const sx = opts.crop ? Math.max(0, Math.min(opts.crop.x, bitmap.width - 1)) : 0;
    const sy = opts.crop ? Math.max(0, Math.min(opts.crop.y, bitmap.height - 1)) : 0;
    ctx.drawImage(bitmap, sx, sy, plan.cropW, plan.cropH, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    const c = canvas;
    let mime: "image/webp" | "image/jpeg" = "image/webp";
    const probe = await canvasToBlob(c, "image/webp", 0.8);
    if (!probe || probe.type !== "image/webp") mime = "image/jpeg"; // WebP を作れないブラウザー
    const encoded = await encodeWithinLimit((q) => (aborted() ? Promise.resolve(null) : canvasToBlob(c, mime, q)));
    if (aborted()) return { ok: false, reason: "aborted" };
    if (!encoded.ok) return { ok: false, reason: encoded.reason };
    // 出力も中身で確認する（想定外の形式を保存しない）。
    const outHead = new Uint8Array(await encoded.blob.slice(0, 64).arrayBuffer());
    const sniff = sniffImageType(outHead);
    if (!sniff.ok || (sniff.type !== "webp" && sniff.type !== "jpeg")) return { ok: false, reason: "encode_failed" };
    return { ok: true, image: { blob: encoded.blob, mime: sniff.type === "webp" ? "image/webp" : "image/jpeg", width: plan.outW, height: plan.outH } };
  } finally {
    bitmap.close();
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}
