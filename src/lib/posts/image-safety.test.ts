import { describe, it, expect } from "vitest";
import { checkPostImageFile, encodeWithinLimit, mimeMatches, planOutputSize, readImageDimensions, sniffImageType, POST_IMAGE_LIMITS } from "./image-safety";

const bytes = (...xs: (number | string)[]) => {
  const out: number[] = [];
  for (const x of xs) {
    if (typeof x === "number") out.push(x);
    else for (const ch of x) out.push(ch.charCodeAt(0));
  }
  return new Uint8Array(out);
};
const pad = (b: Uint8Array, n = 64) => {
  const o = new Uint8Array(Math.max(n, b.length));
  o.set(b);
  return o;
};
function png(w: number, h: number) {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  b.set([(w >>> 24) & 255, (w >>> 16) & 255, (w >>> 8) & 255, w & 255, (h >>> 24) & 255, (h >>> 16) & 255, (h >>> 8) & 255, h & 255], 16);
  return b;
}
function jpeg(w: number, h: number, withExifFirst = true) {
  const parts: number[] = [0xff, 0xd8];
  if (withExifFirst) {
    // APP1（EXIF）を先に置く（GPS など。再エンコードで捨てられる）
    const exif = bytes("Exif", 0, 0, "GPS-LAT-35.6");
    parts.push(0xff, 0xe1, ((exif.length + 2) >> 8) & 255, (exif.length + 2) & 255, ...exif);
  }
  parts.push(0xff, 0xc0, 0, 17, 8, (h >> 8) & 255, h & 255, (w >> 8) & 255, w & 255, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1);
  return new Uint8Array(parts);
}
function webpVp8x(w: number, h: number) {
  const b = new Uint8Array(30);
  b.set(bytes("RIFF", 0, 0, 0, 0, "WEBP", "VP8X"));
  const ww = w - 1;
  const hh = h - 1;
  b.set([ww & 255, (ww >> 8) & 255, (ww >> 16) & 255, hh & 255, (hh >> 8) & 255, (hh >> 16) & 255], 24);
  return b;
}

describe("F-084 画像の形式判定（拡張子を信用しない）", () => {
  it("JPEG・PNG・WebP・HEIC を先頭のバイトで判定する", () => {
    expect(sniffImageType(pad(jpeg(10, 10)))).toEqual({ ok: true, type: "jpeg" });
    expect(sniffImageType(pad(png(10, 10)))).toEqual({ ok: true, type: "png" });
    expect(sniffImageType(pad(webpVp8x(10, 10)))).toEqual({ ok: true, type: "webp" });
    expect(sniffImageType(pad(bytes(0, 0, 0, 24, "ftyp", "heic")))).toEqual({ ok: true, type: "heic" });
  });

  it("SVG・HTML・GIF・実行形式・PDF・ZIP・動画・不明は拒否する", () => {
    expect(sniffImageType(bytes('<?xml version="1.0"?><svg onload="x">'))).toEqual({ ok: false, reason: "svg_not_allowed" });
    expect(sniffImageType(bytes("﻿  <svg>"))).toEqual({ ok: false, reason: "svg_not_allowed" });
    expect(sniffImageType(bytes("<!DOCTYPE html><html>"))).toEqual({ ok: false, reason: "svg_not_allowed" });
    expect(sniffImageType(bytes("GIF89a", 0, 0))).toEqual({ ok: false, reason: "gif_not_allowed" });
    for (const head of [bytes("MZ", 0x90), bytes(0x7f, "ELF"), bytes("%PDF-1.7"), bytes(0x50, 0x4b, 3, 4), bytes("#!/bin/sh")]) {
      expect(sniffImageType(head)).toEqual({ ok: false, reason: "executable_or_document" });
    }
    expect(sniffImageType(pad(bytes(0, 0, 0, 24, "ftyp", "isom")))).toEqual({ ok: false, reason: "unknown_format" });
    expect(sniffImageType(bytes("hello"))).toEqual({ ok: false, reason: "unknown_format" });
    expect(sniffImageType(new Uint8Array())).toEqual({ ok: false, reason: "empty" });
  });

  it("申告された MIME と中身が違えば拒否（空・汎用は中身で判定）", () => {
    expect(mimeMatches("image/png", "jpeg")).toBe(false);
    expect(mimeMatches("image/jpeg", "jpeg")).toBe(true);
    expect(mimeMatches("", "png")).toBe(true);
    expect(mimeMatches("application/octet-stream", "webp")).toBe(true);
    // 拡張子・MIME を JPEG と偽った PNG
    expect(checkPostImageFile({ size: 100, declaredType: "image/jpeg", bytes: pad(png(500, 500)) })).toEqual({ ok: false, reason: "mime_mismatch" });
  });
});

describe("F-084 デコード前の画素数確認（解凍爆弾相当の防止）", () => {
  it("ヘッダーから幅・高さを読む（JPEG は EXIF の後ろの SOF）", () => {
    expect(readImageDimensions(png(4032, 3024), "png")).toEqual({ width: 4032, height: 3024 });
    expect(readImageDimensions(jpeg(3024, 4032), "jpeg")).toEqual({ width: 3024, height: 4032 });
    expect(readImageDimensions(webpVp8x(1080, 1920), "webp")).toEqual({ width: 1080, height: 1920 });
    expect(readImageDimensions(bytes(0xff, 0xd8, 0x00), "jpeg")).toBeNull();
  });

  it("画素数・サイズ・小ささ・壊れたヘッダーで拒否する", () => {
    expect(checkPostImageFile({ size: 1000, declaredType: "image/png", bytes: png(20000, 20000) })).toEqual({ ok: false, reason: "too_many_pixels" });
    expect(checkPostImageFile({ size: POST_IMAGE_LIMITS.maxInputBytes + 1, declaredType: "image/png", bytes: png(10, 10) })).toEqual({ ok: false, reason: "too_large_file" });
    expect(checkPostImageFile({ size: 100, declaredType: "image/png", bytes: png(32, 32) })).toEqual({ ok: false, reason: "too_small" });
    expect(checkPostImageFile({ size: 100, declaredType: "image/jpeg", bytes: bytes(0xff, 0xd8, 0xff, 0xe0, 0, 2) })).toEqual({ ok: false, reason: "corrupt_header" });
    expect(checkPostImageFile({ size: 0, declaredType: "", bytes: new Uint8Array() })).toEqual({ ok: false, reason: "empty" });
    expect(checkPostImageFile({ size: 5000, declaredType: "image/jpeg", bytes: jpeg(3024, 4032) })).toEqual({ ok: true, type: "jpeg", width: 3024, height: 4032 });
    expect(checkPostImageFile({ size: 5000, declaredType: "image/heic", bytes: pad(bytes(0, 0, 0, 24, "ftyp", "heic")) })).toEqual({ ok: true, type: "heic", width: null, height: null });
  });
});

describe("F-084 出力サイズと再エンコード", () => {
  it("回転・トリミングの後に長辺を上限へ縮小する（iPhone の縦写真を想定）", () => {
    expect(planOutputSize({ width: 3024, height: 4032 }, 0, null)).toEqual({ cropW: 3024, cropH: 4032, outW: 1536, outH: 2048 });
    expect(planOutputSize({ width: 3024, height: 4032 }, 90, null)).toEqual({ cropW: 3024, cropH: 4032, outW: 2048, outH: 1536 });
    expect(planOutputSize({ width: 1000, height: 800 }, 0, { x: 900, y: 0, width: 500, height: 800 })).toEqual({ cropW: 100, cropH: 800, outW: 100, outH: 800 });
  });

  it("上限に収まるまで品質を下げる。収まらなければ失敗（不完全な画像を残さない）", async () => {
    const sizes = [2_000_000, 1_600_000, 1_200_000];
    let i = 0;
    const r = await encodeWithinLimit(async () => new Blob([new Uint8Array(sizes[i++] ?? 10)]));
    expect(r).toMatchObject({ ok: true, quality: 0.7 });
    expect(await encodeWithinLimit(async () => new Blob([new Uint8Array(3_000_000)]))).toEqual({ ok: false, reason: "still_too_large" });
    expect(await encodeWithinLimit(async () => null)).toEqual({ ok: false, reason: "encode_failed" });
  });
});
